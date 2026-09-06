import base64
import hashlib
import math
import os
import re
import shutil
import struct
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from defusedxml.ElementTree import fromstring
from .errors import AnalysisError, require
from .process import run_process

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
MIMES = {"svg": "image/svg+xml", "png": "image/png", "pdf": "application/pdf", "eps": "application/postscript"}


def dimension(value):
    require(bool(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?(?:px)?", str(value))), "画布宽高必须为正数，单位为 px")
    result = float(str(value).removesuffix("px"))
    require(0 < result <= 16000, "画布宽高必须大于 0 且不超过 16000 px")
    return result


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
        for key, value in node.attrib.items():
            local = key.rsplit("}", 1)[-1].lower()
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
        if params.get("outline"):
            args.append("--export-text-to-path")
        if fmt == "svg":
            args.append("--export-plain-svg")
        run_process(args, cwd=folder)
        require(target.exists(), "导出引擎未生成文件", "EXPORT_FAILED")
        content = target.read_bytes()
        require(0 < len(content) <= 50_000_000, "导出文件为空或超过 50 MB，请减少数据量", "EXPORT_FAILED")
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
        if fmt in ("pdf", "eps"):
            require(content.startswith(b"%PDF-" if fmt == "pdf" else b"%!PS-Adobe"), "导出文件格式不正确", "EXPORT_FAILED")
        version, _ = run_process([binary, "--version"], timeout=10)
    name = re.sub(r"[^\w\u4e00-\u9fff .-]", "_", str(params.get("filename", "OpenAcad图表")))[:100].strip(" .") or "OpenAcad图表"
    return {"schemaVersion": 1, "method": "render", "data": {}, "artifact": {"filename": f"{name}.{fmt}", "mimeType": MIMES[fmt], "contentBase64": base64.b64encode(content).decode()}, "provenance": {"engine": version.strip(), "format": fmt, "dpi": dpi, "width": width, "height": height, "outline": params.get("outline", False), "sha256": hashlib.sha256(content).hexdigest()}, "diagnostics": diagnostics}
