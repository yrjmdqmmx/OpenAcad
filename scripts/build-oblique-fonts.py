#!/usr/bin/env python3
"""Derive clearly identified 12-degree OpenAcad Oblique CFF faces under OFL.

The upstream OTF files are never modified. CFF FontMatrix performs a shear;
charstrings, cmap/UVS, advance widths and layout tables remain upstream data.
Run before build-webfonts.py. No system-wide fonts are installed.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
import math
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_ROOT = ROOT / "server/fonts"
SOURCES = [
    ("NotoSansCJKsc-Regular.otf", "OpenAcadNotoSansCJKsc-Oblique", "Noto Sans CJK SC", 400),
    ("NotoSerifCJKsc-Regular.otf", "OpenAcadNotoSerifCJKsc-Oblique", "Noto Serif CJK SC", 400),
    ("NotoSansCJKsc-Bold.otf", "OpenAcadNotoSansCJKsc-BoldOblique", "Noto Sans CJK SC", 700),
    ("NotoSerifCJKsc-Bold.otf", "OpenAcadNotoSerifCJKsc-BoldOblique", "Noto Serif CJK SC", 700),
]
ANGLE = 12


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def derive(source_spec: tuple) -> dict:
    source_name, postscript, family, weight, expected_sha = source_spec
    source_path = FONT_ROOT / source_name
    if digest(source_path) != expected_sha:
        raise ValueError(f"原始字体 SHA 不符：{source_name}")
    font = TTFont(source_path, recalcTimestamp=False)
    original_cmap = font["cmap"].compile(font)
    original_hmtx = dict(font["hmtx"].metrics)
    original_vmtx = dict(font["vmtx"].metrics)
    top = font["CFF "].cff.topDictIndex[0]
    original_matrix = list(top.FontMatrix)
    if original_matrix != [.001, 0, 0, .001, 0, 0]:
        raise ValueError("派生器仅接受已核准的 Noto 1000 UPM CFF 矩阵")
    if any(getattr(fd, "FontMatrix", None) is not None for fd in top.FDArray):
        raise ValueError("FD 自定义矩阵尚未纳入该派生器")
    shear = math.tan(math.radians(ANGLE))
    top.FontMatrix = [.001, 0, .001 * shear, .001, 0, 0]
    top.ItalicAngle = -ANGLE
    full_name = "OpenAcad " + family + (" Bold Oblique" if weight == 700 else " Oblique")
    top.FullName = full_name
    font["CFF "].cff.fontNames = [postscript]
    font["post"].italicAngle = -ANGLE
    font["OS/2"].fsSelection = (font["OS/2"].fsSelection | 1) & ~64
    font["head"].macStyle |= 2
    font["hhea"].caretSlopeRise = 1000
    font["hhea"].caretSlopeRun = round(1000 * shear)
    style = "Bold Italic" if weight == 700 else "Italic"
    version = font["name"].getDebugName(5)
    description = (f"OpenAcad derived Oblique, {ANGLE} degree right shear via CFF FontMatrix; "
                   f"based on {source_name} {version}. Not an official Noto Italic design. "
                   "Original glyph programs, cmap/UVS and advance widths retained. SIL OFL 1.1.")
    names = {1: family, 2: style, 3: postscript + ";OpenAcadOblique-1.0-12deg",
             4: full_name, 5: version + "; OpenAcad Oblique 1.0", 6: postscript,
             10: description, 16: family, 17: style}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    for name_id, value in names.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)
    destination = FONT_ROOT / (postscript + ".otf")
    font.save(destination)
    saved = TTFont(destination, recalcTimestamp=False)
    if saved["cmap"].compile(saved) != original_cmap:
        raise ValueError(f"cmap/UVS 被修改：{destination.name}")
    if saved["hmtx"].metrics != original_hmtx or saved["vmtx"].metrics != original_vmtx:
        raise ValueError(f"水平或垂直字宽被修改：{destination.name}")
    if saved["OS/2"].usWeightClass != weight or not saved["OS/2"].fsSelection & 1:
        raise ValueError(f"字重/斜体 metadata 不符：{destination.name}")
    original = TTFont(source_path, recalcTimestamp=False)
    original_top = original["CFF "].cff.topDictIndex[0]
    saved_top = saved["CFF "].cff.topDictIndex[0]
    count = 0
    for name in original.getGlyphOrder():
        before, after = original_top.CharStrings[name], saved_top.CharStrings[name]
        before.decompile(); after.decompile()
        if before.program != after.program:
            raise ValueError(f"原字形程序被修改：{destination.name}/{name}")
        count += 1
    result = {"file": destination.name, "sha256": digest(destination), "source": source_name,
              "sourceSha256": expected_sha, "sourceVersion": version, "fontWeight": weight,
              "fontStyle": "italic", "postScriptName": postscript, "angleDegrees": ANGLE,
              "method": "CFF FontMatrix shear; glyph programs unchanged", "fontMatrix": saved_top.FontMatrix,
              "bytes": destination.stat().st_size, "glyphProgramsChecked": count,
              "cmapAndUvsUnchanged": True, "horizontalAndVerticalMetricsUnchanged": True}
    original.close(); saved.close(); font.close()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    manifest_path = FONT_ROOT / "manifest.json"
    hashes = json.loads(manifest_path.read_text())
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        records = list(pool.map(derive, [(*spec, hashes[spec[0]]) for spec in SOURCES]))
    for record in records:
        hashes[record["file"]] = record["sha256"]
    manifest_path.write_text(json.dumps(hashes, indent=2) + "\n")
    (FONT_ROOT / "oblique-derivation.json").write_text(json.dumps({
        "license": "SIL OFL 1.1", "derivedBy": "OpenAcad", "fonts": records,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(records, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
