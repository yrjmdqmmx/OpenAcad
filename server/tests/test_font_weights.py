"""Real exports must use the installed 400/700 faces, never a synthetic bold."""
import base64
import hashlib
import json
import os
import re
import shutil
import struct
import zlib
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest

from app.export import render, sanitize
from app.errors import AnalysisError


@pytest.mark.parametrize("weight,expected", [
    ("1", "400"), ("400", "400"), ("500", "400"), ("500.01", "700"),
    ("650", "700"), ("1000", "700"), ("6.5e2", "700"),
    ("normal", "400"), ("bold", "700"), ("bolder", "bolder"),
    ("lighter", "lighter"), ("inherit", "inherit"), ("var(--weight)", "var(--weight)"),
    ("0", "0"), ("1001", "1001"), ("650px", "650px"),
])
def test_weight_boundaries_and_relative_values(weight, expected):
    root, *_ = sanitize(f'<svg xmlns="http://www.w3.org/2000/svg"><text font-weight="{weight}">650</text></svg>', {})
    assert root[0].get("font-weight") == expected
    assert root[0].text == "650"


def test_weight_declarations_preserve_cascade_and_other_properties():
    source = '''<svg xmlns="http://www.w3.org/2000/svg">
    <style>.x {font-weight: 650 !important; font-stretch:650%; --font-weight:650;
      content:"font-weight:650"; --tokens:{font-weight:650; nested:{font-weight:900;};};}
      @media (min-width:1px) { text:hover {font-weight:500} }
    </style>
    <text font-weight="650" style="font-weight:400; FONT-WEIGHT:650!important; font-stretch:650%; --font-weight:650;">font-weight:650</text>
    </svg>'''
    root, *_ = sanitize(source, {})
    stylesheet, node = list(root)
    assert "font-weight: 700 !important" in stylesheet.text
    assert "font-weight:400}" in stylesheet.text
    assert 'content:"font-weight:650"' in stylesheet.text
    assert "--tokens:{font-weight:650; nested:{font-weight:900;};}" in stylesheet.text
    assert "font-stretch:650%; --font-weight:650;" in stylesheet.text
    assert node.get("font-weight") == "700"
    assert node.get("style") == "font-weight:400; FONT-WEIGHT:700!important; font-stretch:650%; --font-weight:650;"
    assert node.text == "font-weight:650"


@pytest.mark.parametrize("content", [
    '<style>.x{font-weight:650;fill:url(https://invalid.example/font)}</style>',
    '<style>.x{font-weight:650;/* hidden */}</style>',
    '<text style="font-weight:650;fill:url(data:image/png;base64,AA)"/>',
])
def test_weight_normalization_does_not_bypass_security(content):
    with pytest.raises(AnalysisError):
        sanitize('<svg xmlns="http://www.w3.org/2000/svg">'+content+'</svg>', {})


@pytest.mark.parametrize("content", [
    '<g font-weight="300"><text font-weight="bolder">文字</text></g>',
    '<g style="font-weight:750"><text style="font-weight:lighter!important">文字</text></g>',
    '<style>.parent{font-weight:650}.child{font-weight:bolder !important}</style>',
])
def test_relative_weight_with_numeric_remapping_is_explicitly_rejected(content):
    with pytest.raises(AnalysisError, match="相对字重.*明确的 400 或 700") as error:
        sanitize('<svg xmlns="http://www.w3.org/2000/svg">'+content+'</svg>', {})
    assert error.value.detail["code"] == "RELATIVE_FONT_WEIGHT"


@pytest.mark.parametrize("weight", ["normal", "bold", "400.0", "700.00"])
def test_equivalent_weights_do_not_trigger_relative_rejection(weight):
    root, *_ = sanitize(f'<svg xmlns="http://www.w3.org/2000/svg"><g font-weight="{weight}"><text style="font-weight:bolder">文字</text></g></svg>', {})
    assert root[0][0].get("style") == "font-weight:bolder"


def test_relative_words_in_strings_and_custom_properties_are_not_declarations():
    root, *_ = sanitize('''<svg xmlns="http://www.w3.org/2000/svg">
    <style>.x{--weight:bolder;--tokens:{font-weight:lighter;};content:"font-weight:bolder";font-weight:650}</style>
    <text style="--relative:lighter; font-weight:300">bolder</text></svg>''', {})
    assert "font-weight:700}" in root[0].text
    assert root[1].get("style") == "--relative:lighter; font-weight:400"
    assert root[1].text == "bolder"


def ink_coverage(raw):
    """Decode tiny true-colour PNGs and sum darkness after compositing on white."""
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    position, compressed, header = 8, bytearray(), None
    while position < len(raw):
        length = struct.unpack(">I", raw[position:position + 4])[0]
        kind = raw[position + 4:position + 8]
        body = raw[position + 8:position + 8 + length]
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            compressed.extend(body)
        position += length + 12
    assert header is not None
    width, height, depth, colour, compression, filtering, interlace = header
    assert depth == 8 and colour in (2, 6) and interlace == 0
    channels = 3 if colour == 2 else 4
    stride = width * channels
    data = zlib.decompress(compressed)
    assert len(data) == height * (stride + 1)
    previous, coverage, pixel_hash = bytearray(stride), 0.0, hashlib.sha256()
    for y in range(height):
        start = y * (stride + 1)
        mode, row = data[start], bytearray(data[start + 1:start + 1 + stride])
        assert mode in range(5)
        for i in range(stride):
            a = row[i - channels] if i >= channels else 0
            b = previous[i]
            c = previous[i - channels] if i >= channels else 0
            if mode == 4:
                p = a + b - c
                distances = (abs(p - a), abs(p - b), abs(p - c))
                predictor = (a, b, c)[distances.index(min(distances))]
            else:
                predictor = (0, a, b, (a + b) // 2)[mode]
            row[i] = (row[i] + predictor) & 255
        for i in range(0, stride, channels):
            alpha = row[i + 3] / 255 if channels == 4 else 1
            coverage += (1 - sum(row[i:i + 3]) / (3 * 255)) * alpha
        pixel_hash.update(row)
        previous = row
    return {"width": width, "height": height, "darkPixelEquivalent": coverage,
            "decodedPixelSha256": pixel_hash.hexdigest()}


@pytest.mark.skipif(shutil.which("inkscape") is None, reason="需要 Inkscape 集成镜像")
@pytest.mark.parametrize("family,postscript", [
    ("Noto Sans SC", "NotoSansCJKsc"),
    ("Noto Serif CJK SC", "NotoSerifCJKsc"),
])
def test_real_regular_and_bold_exports(family, postscript, tmp_path):
    measurements, outlines = {}, {}
    evidence = os.getenv("OPENACAD_FONT_EXPORT_EVIDENCE")
    output = Path(evidence) if evidence else tmp_path
    output.mkdir(parents=True, exist_ok=True)
    for weight, face in ((400, "Regular"), (700, "Bold"), (650, "Bold")):
        # A small mixed Chinese/Latin fixture detects the exact missing-Bold bug.
        source = (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128">'
                  '<rect width="512" height="128" fill="#ffffff"/>'
                  f'<text x="20" y="90" font-family="{family}" font-size="64" '
                  f'font-weight="{weight}" fill="#000000">开放学术 Aa12</text></svg>')
        (output / f"{postscript}-{weight}-source.svg").write_text(source)
        measurements[str(weight)] = {}
        for fmt in ("svg", "png", "pdf"):
            result = render({"method": "render", "data": {"svg": source},
                             "params": {"format": fmt, "dpi": 150, "outline": fmt == "svg"}})
            raw = base64.b64decode(result["artifact"]["contentBase64"])
            name = f"{postscript}-{weight}.{fmt}"
            (output / name).write_bytes(raw)
            measurements[str(weight)][fmt] = {
                "file": name, "sha256": hashlib.sha256(raw).hexdigest(),
                "provenance": result["provenance"],
            }
            if fmt == "svg":
                root = ET.fromstring(raw)
                assert not root.findall(".//{http://www.w3.org/2000/svg}text")
                outlines[weight] = [p.get("d") for p in root.findall(".//{http://www.w3.org/2000/svg}path")]
                assert outlines[weight]
            elif fmt == "png":
                pixels = ink_coverage(raw)
                assert [pixels["width"], pixels["height"]] == [800, 200]
                measurements[str(weight)][fmt].update(pixels)
            else:
                # Cairo synthetic bold uses a generated CairoFont name. With
                # real faces, PDF font resources identify the genuine OTF face.
                fonts = re.findall(rb"/BaseFont\s*/([^\s/<>\[\]()]+)", raw)
                names = sorted({name.decode("ascii") for name in fonts})
                assert any(name.endswith(postscript + "-" + face) for name in names), names
                assert not any("CairoFont" in name for name in names), names
                measurements[str(weight)][fmt]["pdfFontResources"] = names
    assert outlines[400] != outlines[700], "700 reused Regular glyph outlines"
    assert outlines[650] == outlines[700], "650 did not select the same real Bold outlines as 700"
    assert measurements["650"]["png"]["decodedPixelSha256"] == measurements["700"]["png"]["decodedPixelSha256"]
    assert measurements["650"]["pdf"]["pdfFontResources"] == measurements["700"]["pdf"]["pdfFontResources"]
    regular = measurements["400"]["png"]["darkPixelEquivalent"]
    bold = measurements["700"]["png"]["darkPixelEquivalent"]
    assert bold > regular * 1.15, "Bold raster strokes did not become meaningfully heavier"
    report = {"family": family, "passed": True, "boldInkRatio": bold / regular,
              "regularAndBoldPathsDiffer": True, "weight650And700PathsAndPixelsIdentical": True,
              "exports": measurements}
    (output / f"{postscript}-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


@pytest.mark.skipif(shutil.which("inkscape") is None, reason="需要 Inkscape 集成镜像")
@pytest.mark.parametrize("family,postscript", [
    ("Noto Sans SC", "NotoSansCJKsc"),
    ("Noto Serif CJK SC", "NotoSerifCJKsc"),
])
@pytest.mark.parametrize("weight", [400, 700])
def test_real_italic_changes_geometry_and_pixels(family, postscript, weight, tmp_path):
    output = Path(os.environ["OPENACAD_FONT_EXPORT_EVIDENCE"]) if os.getenv("OPENACAD_FONT_EXPORT_EVIDENCE") else tmp_path
    output.mkdir(parents=True, exist_ok=True)
    exports, geometry = {}, {}
    for font_style in ("normal", "italic"):
        source = (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128">'
                  '<rect width="512" height="128" fill="#ffffff"/>'
                  f'<text x="20" y="90" font-family="{family}" font-size="64" '
                  f'font-weight="{weight}" font-style="{font_style}" fill="#000000">开放学术 Aa12</text></svg>')
        exports[font_style] = {}
        for fmt in ("svg", "png", "pdf"):
            result = render({"method": "render", "data": {"svg": source},
                             "params": {"format": fmt, "dpi": 150, "outline": fmt == "svg"}})
            raw = base64.b64decode(result["artifact"]["contentBase64"])
            name = f"{postscript}-{weight}-{font_style}.{fmt}"
            (output / name).write_bytes(raw)
            exports[font_style][fmt] = {"file": name, "sha256": hashlib.sha256(raw).hexdigest(), "provenance": result["provenance"]}
            if fmt == "svg":
                root = ET.fromstring(raw)
                assert not root.findall(".//{http://www.w3.org/2000/svg}text")
                geometry[font_style] = [(p.tag, p.get("d"), p.get("transform")) for p in root.iter() if p.get("d") or p.get("transform")]
            elif fmt == "png":
                pixels = ink_coverage(raw)
                assert [pixels["width"], pixels["height"]] == [800, 200]
                exports[font_style][fmt].update(pixels)
            else:
                face = (postscript + ("-Regular" if weight == 400 else "-Bold")) if font_style == "normal" else ("OpenAcad" + postscript + ("-Oblique" if weight == 400 else "-BoldOblique"))
                fonts = sorted({name.decode("ascii") for name in re.findall(rb"/BaseFont\s*/([^\s/<>\[\]()]+)", raw)})
                assert any(name.endswith(face) for name in fonts), fonts
                assert not any("CairoFont" in name for name in fonts), fonts
                exports[font_style][fmt]["pdfFontResources"] = fonts
    assert geometry["normal"] != geometry["italic"], "Italic did not change outlined geometry"
    assert exports["normal"]["png"]["decodedPixelSha256"] != exports["italic"]["png"]["decodedPixelSha256"]
    report = {"family": family, "weight": weight, "passed": True, "normalAndItalicGeometryDiffer": True,
              "normalAndItalicPixelsDiffer": True, "requiresVisibleSlant": True, "exports": exports}
    (output / f"{postscript}-{weight}-italic-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
