import base64
import hashlib
import json
import math
import os
import re
import shutil
import struct
import tempfile
from io import BytesIO
from pathlib import Path
import xml.etree.ElementTree as ET
from defusedxml.ElementTree import fromstring
from pypdf import PdfReader
from .errors import AnalysisError, require
from .process import run_process

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
MIMES = {"svg": "image/svg+xml", "png": "image/png", "pdf": "application/pdf", "eps": "application/postscript"}
ABSOLUTE_WEIGHT = re.compile(r"(\s*)(normal|bold|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(\s*!\s*important)?(\s*)", re.I)


def static_font_weight(value, *, important=False):
    """Match the shipped 400/700 static faces using CSS font-weight matching."""
    match = ABSOLUTE_WEIGHT.fullmatch(value)
    if not match or (match[3] and not important):
        return value  # Relative/inherited/variable values need their CSS context.
    number = {"normal": 400, "bold": 700}.get(match[2].lower())
    if number is None:
        number = float(match[2])
    if not math.isfinite(number) or not 1 <= number <= 1000:
        return value
    return match[1] + ("400" if number <= 500 else "700") + (match[3] or "") + match[4]


def static_weight_declarations(css, observe=None):
    """Rewrite complete declarations, without touching strings/custom values.

    The scanner preserves selectors, nesting, declaration order and !important.
    It deliberately does not evaluate relative weights, var(), or font shorthand.
    """
    replacements, blocks = [], []
    start, quote, parentheses, brackets, custom_depth = 0, None, 0, 0, 0

    def declaration(end):
        match = re.fullmatch(r"(\s*font-weight\s*:\s*)(.*)", css[start:end], re.I | re.S)
        if match:
            if observe:
                observe(match[2], important=True)
            value = static_font_weight(match[2], important=True)
            if value != match[2]:
                replacements.append((start, end, match[1] + value))

    escaped = False
    for i, char in enumerate(css):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in ("'", '"'):
            quote = char
        elif char == "(":
            parentheses += 1
        elif char == ")":
            parentheses = max(0, parentheses - 1)
        elif char == "[":
            brackets += 1
        elif char == "]":
            brackets = max(0, brackets - 1)
        elif not parentheses and not brackets:
            if char == "{":
                custom = bool(custom_depth or re.match(r"\s*--[\w-]+\s*:", css[start:i]))
                blocks.append((custom, start))
                if custom:
                    custom_depth += 1
                else:
                    start = i + 1
            elif char == "}":
                if blocks:
                    custom, previous = blocks.pop()
                    if custom:
                        custom_depth -= 1
                        start = previous
                    else:
                        declaration(i)
                        start = i + 1
            elif char == ";" and not custom_depth:
                declaration(i)
                start = i + 1
    if not custom_depth:
        declaration(len(css))
    pieces, previous = [], 0
    for begin, end, value in replacements:
        pieces.extend((css[previous:begin], value))
        previous = end
    pieces.append(css[previous:])
    return "".join(pieces)


def dimension(value):
    require(bool(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?(?:px)?", str(value))), "画布宽高必须为正数，单位为 px")
    result = float(str(value).removesuffix("px"))
    require(0 < result <= 16000, "画布宽高必须大于 0 且不超过 16000 px")
    return result


def pdf_page_count(content):
    """Reject truncated engine output even when Inkscape exits successfully."""
    require(content.startswith(b"%PDF-") and content.rstrip().endswith(b"%%EOF"),
            "导出 PDF 不完整，请重试或启用文字转曲线", "EXPORT_FAILED")
    try:
        document = PdfReader(BytesIO(content), strict=True)
        pages = len(document.pages)
        valid = pages > 0 and not document.is_encrypted
        for page in document.pages:
            valid = valid and float(page.mediabox.width) > 0 and float(page.mediabox.height) > 0
        if not valid:
            raise ValueError("PDF has no readable pages")
    except Exception:
        raise AnalysisError("导出 PDF 无法完整读取，请重试或启用文字转曲线", "EXPORT_FAILED") from None
    return pages


def export_content(target):
    require(target.exists(), "导出引擎未生成文件", "EXPORT_FAILED")
    content = target.read_bytes()
    require(0 < len(content) <= 50_000_000, "导出文件为空或超过 50 MB，请减少数据量", "EXPORT_FAILED")
    return content


def sanitize(source, params):
    require(isinstance(source, str) and len(source.encode()) <= 10_000_000, "SVG 不能为空，且不能超过 10 MB")
    try:
        root = fromstring(source, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except Exception:
        raise AnalysisError("SVG 格式不正确，或含不允许的实体/文档声明", "INVALID_SVG")
    require(root.tag == f"{{{NS}}}svg", "文件必须是标准 SVG 图像", "INVALID_SVG")
    unsafe = {"script", "foreignobject", "iframe", "object", "embed", "audio", "video", "animate", "animatetransform", "animatemotion", "set"}
    transparency = False
    elements = list(root.iter())
    require(len(elements) <= 150000, "图形元素过多，请减少数据量后导出")
    for node in elements:
        name = node.tag.rsplit("}", 1)[-1].lower()
        require(name not in unsafe, f"SVG 含不允许的元素：{name}", "UNSAFE_SVG")
        require(not node.tag.startswith("{") or node.tag.startswith("{" + NS + "}"), "SVG 含不允许的外部命名空间", "UNSAFE_SVG")
        texts = [node.text or ""] if name == "style" else []
        if name == "style" and node.text:
            node.text = node.text.replace("Noto Sans SC", "Noto Sans CJK SC")
        for key, value in node.attrib.items():
            local = key.rsplit("}", 1)[-1].lower()
            if local in ("font-family", "style"):
                node.set(key, value.replace("Noto Sans SC", "Noto Sans CJK SC"))
            require(not local.startswith("on") and local != "base", "SVG 不允许事件处理或外部基址", "UNSAFE_SVG")
            if local in ("href", "src"):
                require(bool(re.fullmatch(r"#[A-Za-z0-9_.:-]+", value)), "SVG 不允许外部链接或嵌入式图片", "UNSAFE_SVG")
            texts.append(value)
            if "opacity" in local:
                try:
                    transparency = transparency or float(value) < 1
                except ValueError:
                    transparency = True
            if local == "filter" and value != "none":
                transparency = True
        for value in texts:
            require(not re.search(r"@import|@font-face|expression\s*\(|(?:https?|file|ftp|data|javascript)\s*:|[\\]|/\*", value, re.I), "SVG 不允许外部资源、脚本或混淆样式", "UNSAFE_SVG")
            for match in re.finditer(r"url\s*\(([^)]*)\)", value, re.I):
                require(bool(re.fullmatch(r"[\s'\"]*#[A-Za-z0-9_.:-]+[\s'\"]*", match.group(1))), "SVG 只允许引用内部图形资源", "UNSAFE_SVG")
            if re.search(r"rgba|hsla|filter\s*:", value, re.I):
                transparency = True
            for opacity in re.findall(r"(?:fill-|stroke-)?opacity\s*:\s*([^;\s}]+)", value, re.I):
                try:
                    transparency = transparency or float(opacity) < 1
                except ValueError:
                    transparency = True
    # Keep validation on the original values above: normalization must never
    # hide an unsafe resource or alter custom properties/string contents.
    relative_weight, remapped_number = False, False

    def observe_weight(value, *, important=False):
        nonlocal relative_weight, remapped_number
        relative = re.fullmatch(r"\s*(bolder|lighter)(\s*!\s*important)?\s*", value, re.I)
        relative_weight |= bool(relative and (important or not relative[2]))
        absolute = ABSOLUTE_WEIGHT.fullmatch(value)
        if absolute and (important or not absolute[3]) and absolute[2].lower() not in ("normal", "bold"):
            number = float(absolute[2])
            if math.isfinite(number) and 1 <= number <= 1000:
                remapped_number |= number != (400 if number <= 500 else 700)

    for node in elements:
        if node.tag.rsplit("}", 1)[-1].lower() == "style" and node.text:
            node.text = static_weight_declarations(node.text, observe_weight)
        for key, value in list(node.attrib.items()):
            local = key.rsplit("}", 1)[-1].lower()
            if local == "font-weight":
                observe_weight(value)
                node.set(key, static_font_weight(value))
            elif local == "style":
                node.set(key, static_weight_declarations(value, observe_weight))
    require(not (relative_weight and remapped_number),
            "SVG 同时包含相对字重（bolder/lighter）和需要映射的数值字重，无法保证继承关系不变。请先将文字字重转换为明确的 400 或 700 后导出。",
            "RELATIVE_FONT_WEIGHT")
    vb = root.get("viewBox", "").replace(",", " ").split()
    width = dimension(params.get("width", root.get("width", vb[2] if len(vb) == 4 else "800")))
    height = dimension(params.get("height", root.get("height", vb[3] if len(vb) == 4 else "600")))
    require(width * height <= 40_000_000, "画布总面积不能超过 4000 万像素")
    root.set("width", str(width)); root.set("height", str(height))
    if "viewBox" not in root.attrib:
        root.set("viewBox", f"0 0 {width} {height}")
    else:
        try:
            require(len(vb) == 4 and all(math.isfinite(float(x)) for x in vb) and float(vb[2]) > 0 and float(vb[3]) > 0, "SVG viewBox 格式不正确")
        except ValueError:
            raise AnalysisError("SVG viewBox 必须是 4 个有限数字")
    background = params.get("background")
    if background is not None:
        require(background == "transparent" or bool(re.fullmatch(r"#[0-9a-fA-F]{6}", str(background))), "背景只能为 transparent 或六位十六进制颜色")
    if background and background != "transparent":
        view = root.get("viewBox").split()
        ET.SubElement(root, f"{{{NS}}}rect")  # insert before all visible content
        node = root[-1]; root.remove(node)
        node.attrib.update(x=view[0], y=view[1], width=view[2], height=view[3], fill=background)
        root.insert(0, node)
    return root, width, height, transparency


def render(payload):
    require(payload["method"] == "render", "不支持的导出方法")
    params = payload.get("params", {})
    fmt = params.get("format", "svg")
    require(fmt in MIMES, "导出格式必须为 SVG、PNG、PDF 或 EPS")
    dpi = params.get("dpi", 300)
    require(type(dpi) in (int, float) and dpi in (150, 300, 600), "分辨率只支持 150、300 或 600 DPI")
    require(type(params.get("outline", False)) is bool, "文字转曲线必须为布尔值")
    root, width, height, transparency = sanitize(payload["data"].get("svg"), params)
    require(width * height * (dpi / 96) ** 2 <= 80_000_000, "当前画布和 DPI 组合超过 8000 万像素，请降低 DPI 或画布尺寸")
    binary = shutil.which(os.getenv("INKSCAPE", "inkscape"))
    require(binary is not None, "图片导出引擎尚未就绪，请稍后重试", "EXPORT_UNAVAILABLE")
    diagnostics = []
    effective_outline = params.get("outline", False)
    pdf_pages = None
    with tempfile.TemporaryDirectory(prefix="openacad-export-") as folder:
        source = Path(folder) / "input.svg"
        source.write_bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))
        target = Path(folder) / f"output.{fmt}"
        if fmt == "eps":
            background = params.get("background")
            if background in (None, "transparent"):
                background = "#ffffff"
            if transparency:
                # PostScript cannot represent alpha. Flatten explicitly, never silently discard it.
                png = Path(folder) / "flattened.png"
                run_process([binary, str(source), "--export-type=png", f"--export-filename={png}", f"--export-dpi={dpi}", f"--export-background={background}", "--export-background-opacity=1"], cwd=folder)
                encoded = base64.b64encode(png.read_bytes()).decode()
                source.write_text(f'<svg xmlns="{NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><image width="{width}" height="{height}" xlink:href="data:image/png;base64,{encoded}"/></svg>')
                diagnostics.append({"code": "EPS_ALPHA_FLATTENED", "message": f"EPS 不支持透明效果，已按 {dpi} DPI 合并到背景色；此 EPS 内含栅格图像"})
            else:
                view = root.get("viewBox").split()
                rect = ET.Element(f"{{{NS}}}rect", x=view[0], y=view[1], width=view[2], height=view[3], fill=background)
                root.insert(0, rect)
                source.write_bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))
            diagnostics.append({"code": "EPS_BACKGROUND", "message": f"EPS 使用不透明背景 {background}"})
        args = [binary, str(source), f"--export-type={fmt}", f"--export-filename={target}", "--export-area-page", f"--export-dpi={dpi}"]
        if effective_outline:
            args.append("--export-text-to-path")
        if fmt == "svg":
            args.append("--export-plain-svg")
        run_process(args, cwd=folder)
        if fmt == "pdf":
            try:
                content = export_content(target)
                pdf_pages = pdf_page_count(content)
            except AnalysisError:
                if effective_outline:
                    raise
                # Some Inkscape/Cairo builds return exit code 0 after producing
                # an unfinished PDF when embedding CJK text. Retry once using
                # paths, and report the actual output instead of hiding it.
                target.unlink(missing_ok=True)
                run_process([*args, "--export-text-to-path"], cwd=folder)
                content = export_content(target)
                pdf_pages = pdf_page_count(content)
                effective_outline = True
                diagnostics.append({"code": "PDF_TEXT_OUTLINED_FALLBACK", "message": "导出引擎未生成完整的 PDF，已通过文字转曲线重试。此 PDF 的文字作为矢量路径保存；如需编辑文字，请下载 SVG。"})
        else:
            content = export_content(target)
        if fmt == "svg":
            try:
                parsed = fromstring(content)
                require(parsed.tag == f"{{{NS}}}svg", "导出 SVG 格式不正确", "EXPORT_FAILED")
                if params.get("outline"):
                    require(not any(n.tag == f"{{{NS}}}text" for n in parsed.iter()), "文字转曲线未完成，请重试", "EXPORT_FAILED")
            except ET.ParseError:
                raise AnalysisError("导出 SVG 无法打开", "EXPORT_FAILED")
        if fmt == "png":
            require(content.startswith(b"\x89PNG\r\n\x1a\n"), "导出 PNG 无法打开", "EXPORT_FAILED")
            pixels = struct.unpack(">II", content[16:24])
            require(all(abs(actual - expected * dpi / 96) <= 1 for actual, expected in zip(pixels, (width, height))), "PNG 尺寸与设定不一致", "EXPORT_FAILED")
        if fmt == "eps":
            require(content.startswith(b"%!PS-Adobe"), "导出文件格式不正确", "EXPORT_FAILED")
        version, _ = run_process([binary, "--version"], timeout=10)
    name = re.sub(r"[^\w\u4e00-\u9fff .-]", "_", str(params.get("filename", "OpenAcad图表")))[:100].strip(" .") or "OpenAcad图表"
    name = name.encode("utf-8")[:180].decode("utf-8", errors="ignore").strip(" .") or "OpenAcad图表"
    font_manifest = Path("/usr/local/share/fonts/openacad/manifest.json")
    available_fonts = json.loads(font_manifest.read_text()) if font_manifest.exists() else {}
    provenance = {"engine": version.strip(), "format": fmt, "dpi": dpi, "width": width, "height": height, "outline": effective_outline, "availableFontsSha256": available_fonts, "sha256": hashlib.sha256(content).hexdigest()}
    if fmt == "pdf":
        provenance.update(pdfPageCount=pdf_pages, requestedOutline=params.get("outline", False))
    return {"schemaVersion": 1, "method": "render", "data": {}, "artifact": {"filename": f"{name}.{fmt}", "mimeType": MIMES[fmt], "contentBase64": base64.b64encode(content).decode()}, "provenance": provenance, "diagnostics": diagnostics}
