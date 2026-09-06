#!/usr/bin/env python3
"""Build complete, disjoint unicode-range WOFF2 faces from pinned server OTFs.

Install scripts/font-delivery-requirements.txt in an isolated Python environment.
This does not modify the canonical OTFs, server images, or font drawing settings.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
import math
import shutil
from pathlib import Path
import tempfile

from fontTools import __version__ as fonttools_version, subset
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
import brotli

ROOT = Path(__file__).resolve().parents[1]
FONT_ROOT = ROOT / "web/public/fonts"
SOURCE_ROOT = ROOT / "server/fonts"
FONTS = [
    ("NotoSansCJKsc-Regular.otf", "noto-sans-sc", "Noto Sans SC", 400, "normal"),
    ("NotoSerifCJKsc-Regular.otf", "noto-serif-sc", "Noto Serif CJK SC", 400, "normal"),
    ("NotoSansCJKsc-Bold.otf", "noto-sans-sc-bold", "Noto Sans SC", 700, "normal"),
    ("NotoSerifCJKsc-Bold.otf", "noto-serif-sc-bold", "Noto Serif CJK SC", 700, "normal"),
    ("OpenAcadNotoSansCJKsc-Oblique.otf", "openacad-noto-sans-sc-oblique", "Noto Sans SC", 400, "italic"),
    ("OpenAcadNotoSerifCJKsc-Oblique.otf", "openacad-noto-serif-sc-oblique", "Noto Serif CJK SC", 400, "italic"),
    ("OpenAcadNotoSansCJKsc-BoldOblique.otf", "openacad-noto-sans-sc-bold-oblique", "Noto Sans SC", 700, "italic"),
    ("OpenAcadNotoSerifCJKsc-BoldOblique.otf", "openacad-noto-serif-sc-bold-oblique", "Noto Serif CJK SC", 700, "italic"),
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ranges(points: list[int]) -> str:
    output = []
    ordered = sorted(set(points))
    if not ordered:
        raise ValueError("字体子集不得为空")
    first = last = ordered[0]
    for cp in ordered[1:] + [None]:
        if cp == last + 1:
            last = cp
        else:
            output.append(f"U+{first:X}" if first == last else f"U+{first:X}-{last:X}")
            first = last = cp
    return ",".join(output)


def uvs(font: TTFont) -> dict[tuple[int, int], str | None]:
    return {(cp, selector): name for table in font["cmap"].tables if table.format == 14
            for selector, entries in table.uvsDict.items() for cp, name in entries}


def partition(cmap: dict[int, str], common: Counter) -> list[tuple[str, list[int]]]:
    # Keep Latin/Greek letters and combining marks together for shaping/kerning.
    latin = {cp for cp in cmap if cp <= 0x052F or 0x1E00 <= cp <= 0x1FFF
             or 0x2000 <= cp <= 0x214F or 0x3000 <= cp <= 0x303F
             or 0xFF00 <= cp <= 0xFFEF}
    frequent = {cp for cp in cmap if cp in common and cp not in latin}
    result = [("latin", sorted(latin))]
    # All currently authored Chinese UI text fits in two small common shards.
    ordered_common = sorted(frequent, key=lambda cp: (-common[cp], cp))
    for index in range(0, len(ordered_common), 512):
        result.append((f"common-{index // 512:02}", sorted(ordered_common[index:index + 512])))
    remaining = sorted(set(cmap) - latin - frequent)
    for index in range(0, len(remaining), 1024):
        result.append((f"rest-{index // 1024:02}", remaining[index:index + 1024]))
    return result


def create_shard(job: tuple) -> dict:
    source_name, stem, family, weight, style, name, points, output = job
    source = SOURCE_ROOT / source_name
    font = TTFont(source, recalcTimestamp=False)
    if font["OS/2"].usWeightClass != weight:
        raise ValueError(f"原字体真实字重与声明不符：{source_name}")
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.glyph_names = True
    options.notdef_outline = True
    options.recalc_timestamp = False
    sub = subset.Subsetter(options=options)
    selectors = {selector for _, selector in uvs(font)}
    sub.populate(unicodes=set(points) | selectors)
    sub.subset(font)
    # Layout/UVS closure can retain aliases sharing a requested glyph. The face
    # must advertise exactly its assigned characters, while keeping the glyphs
    # needed by those characters' shaping and variation sequences.
    wanted = set(points)
    for table in font["cmap"].tables:
        if table.format == 14:
            table.uvsDict = {selector: [(cp, glyph) for cp, glyph in values if cp in wanted]
                             for selector, values in table.uvsDict.items()}
            table.uvsDict = {selector: values for selector, values in table.uvsDict.items() if values}
        elif table.isUnicode():
            table.cmap = {cp: glyph for cp, glyph in table.cmap.items() if cp in wanted}
    font.flavor = "woff2"
    destination = Path(output) / f"{stem}-{name}.woff2"
    font.save(destination)
    font.close()
    digest = sha(destination)
    hashed_destination = destination.with_name(f"{stem}-{name}.{digest[:12]}.woff2")
    destination.rename(hashed_destination)
    destination = hashed_destination
    return {"name": name, "file": "woff2/" + destination.name, "family": family,
            "fontWeight": weight, "fontStyle": style, "fontId": stem,
            "codepoints": points, "unicodeRange": ranges(points),
            "bytes": destination.stat().st_size, "sha256": digest}


def face_metadata(font: TTFont, weight: int, style: str) -> dict:
    """Check effective CFF transform, real face flags and derivative identity."""
    italic = style == "italic"
    top = font["CFF "].cff.topDictIndex[0]
    matrix = list(top.FontMatrix)
    expected = [.001, 0, .001 * math.tan(math.radians(12)) if italic else 0, .001, 0, 0]
    # fontTools 4.64 CFF encodeFloat uses %.8G (matching AFDKO). Require
    # the exact serialized matrix, rather than comparing to unencoded doubles.
    expected = [float(format(value, ".8g")) for value in expected]
    ps = font["name"].getDebugName(6)
    if matrix != expected:
        raise ValueError("CFF 顶层有效矩阵不符合固定风格")
    if any(getattr(fd, "FontMatrix", None) is not None for fd in top.FDArray):
        raise ValueError("CID FD 不得覆盖已核准的顶层矩阵")
    if font["OS/2"].usWeightClass != weight or bool(font["OS/2"].fsSelection & 1) != italic or bool(font["head"].macStyle & 2) != italic:
        raise ValueError("真实字重或 OS/2/head 斜体标记不符")
    angle = -12 if italic else 0
    if font["post"].italicAngle != angle or top.ItalicAngle != angle:
        raise ValueError("post/CFF 的固定倾斜角度不符")
    if font["CFF "].cff.fontNames != [ps] or (italic and not ps.startswith("OpenAcad")):
        raise ValueError("PostScript 派生身份不符")
    return {"fontWeight": weight, "fontStyle": style, "fontMatrix": matrix,
            "postScriptName": ps, "italicAngle": angle,
            "cidFdMatrices": "none; all inherit checked top FontMatrix"}


def verify_metadata(font_record: dict, directory: Path) -> dict:
    """Supplement a completed full geometry check without repeating its work."""
    if sha(SOURCE_ROOT / font_record["source"]) != font_record["sourceSha256"]:
        raise ValueError("已完成几何检查所用的原始字体 SHA 已改变")
    source = TTFont(SOURCE_ROOT / font_record["source"])
    weight, style = font_record["fontWeight"], font_record.get("fontStyle", "normal")
    expected = face_metadata(source, weight, style)
    source.close()
    hashes = {}
    for shard in font_record["shards"]:
        path = directory / shard["file"]
        actual_sha = sha(path)
        if actual_sha != shard["sha256"]:
            raise ValueError(f"已完成几何检查的分片 SHA 已改变：{path}")
        font = TTFont(path)
        if face_metadata(font, weight, style) != expected:
            raise ValueError(f"分片有效风格/派生身份与固定源不符：{path}")
        hashes[shard["file"]] = actual_sha
        font.close()
    return {**expected, "source": font_record["source"], "sourceSha256": sha(SOURCE_ROOT / font_record["source"]),
            "shardsChecked": len(hashes), "sameOutputSha256": hashes, "passed": True}


def verify_family(font_record: dict, directory: Path, outlines: bool = True) -> dict:
    if sha(SOURCE_ROOT / font_record["source"]) != font_record["sourceSha256"]:
        raise ValueError("清单记录的源字体 SHA 已改变")
    source = TTFont(SOURCE_ROOT / font_record["source"], recalcTimestamp=False)
    source_map = source.getBestCmap()
    source_uvs = uvs(source)
    original_glyphs = source.getGlyphSet()
    covered = set()
    covered_uvs = {}
    outlines_checked = set()
    metrics_checked = 0
    weight = font_record["fontWeight"]
    style = font_record.get("fontStyle", "normal")
    source_metadata = face_metadata(source, weight, style)
    for shard in font_record["shards"]:
        path = directory / shard["file"]
        if sha(path) != shard["sha256"]:
            raise ValueError(f"子集 SHA 不符：{path}")
        font = TTFont(path)
        if face_metadata(font, weight, style) != source_metadata:
            raise ValueError(f"子集字体有效风格/身份改变：{path}")
        cmap = font.getBestCmap()
        expected = set(shard["codepoints"])
        if set(cmap) != expected or covered & expected:
            raise ValueError(f"子集字符覆盖丢失、额外或重叠：{path}")
        covered.update(expected)
        covered_uvs.update(uvs(font))
        if font["head"].unitsPerEm != source["head"].unitsPerEm:
            raise ValueError(f"unitsPerEm 改变：{path}")
        for table, fields in [("hhea", ["ascent", "descent", "lineGap"]),
                              ("OS/2", ["sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent"])]:
            if any(getattr(font[table], key) != getattr(source[table], key) for key in fields):
                raise ValueError(f"字体行高 metrics 改变：{path}")
        glyphs = font.getGlyphSet()
        glyph_names = set(font.getGlyphOrder())
        for cp, name in cmap.items():
            original_name = source_map[cp]
            for table in ["hmtx", "vmtx"]:
                if table in source and font[table].metrics[name] != source[table].metrics[original_name]:
                    raise ValueError(f"{table} U+{cp:X} metrics 改变：{path}")
            metrics_checked += 1
        if outlines:
            for name in glyph_names:
                if name in outlines_checked:
                    continue
                for table in ["hmtx", "vmtx"]:
                    if table in source and font[table].metrics[name] != source[table].metrics[name]:
                        raise ValueError(f"{table} shaping glyph metrics 改变：{path} / {name}")
                before, after = RecordingPen(), RecordingPen()
                original_glyphs[name].draw(before)
                glyphs[name].draw(after)
                if before.value != after.value:
                    raise ValueError(f"字形轮廓改变：{path} / {name}")
                outlines_checked.add(name)
        font.close()
    if covered != set(source_map) or covered_uvs != source_uvs:
        raise ValueError(f"完整字符或 variation sequence 覆盖改变：{font_record['source']}")
    source.close()
    return {**source_metadata,
            "sourceCodepoints": len(source_map), "coveredCodepoints": len(covered),
            "variationSequences": len(covered_uvs), "metricsChecked": metrics_checked,
            "outlineGlyphsChecked": len(outlines_checked), "missingCodepoints": 0,
            "overlappingCodepoints": 0, "metricsMismatches": 0, "outlineMismatches": 0}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    checks = parser.add_mutually_exclusive_group()
    checks.add_argument("--check", action="store_true", help="只校验现有 WOFF2、字符/变体覆盖、全部字形与 metrics")
    checks.add_argument("--check-metadata", action="store_true", help="仅追加核对全部固定 SHA、CFF/FD 矩阵、斜体标志/角度/身份，不重复已完成几何检查")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    manifest_path = FONT_ROOT / "webfont-manifest.json"
    expected_hashes = json.loads((SOURCE_ROOT / "manifest.json").read_text())
    for name, _, _, _, _ in FONTS:
        if sha(SOURCE_ROOT / name) != expected_hashes[name]:
            raise ValueError(f"原始 OTF 不符合固定 SHA：{name}")
    if args.check or args.check_metadata:
        manifest = json.loads(manifest_path.read_text())
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            results = pool.map(verify_metadata if args.check_metadata else verify_family, manifest["fonts"], [FONT_ROOT] * len(manifest["fonts"]))
            for item, result in zip(manifest["fonts"], results):
                print(item["family"], json.dumps(result), flush=True)
        return
    corpus_files = sorted(p for p in (ROOT / "web/src").rglob("*") if p.suffix in {".ts", ".tsx"})
    corpus = "\n".join(p.read_text() for p in corpus_files)
    common = Counter(map(ord, corpus))
    manifest = {"schemaVersion": 3, "fontTools": fonttools_version, "brotli": brotli.__version__,
                "sourceCorpusSha256": hashlib.sha256(corpus.encode()).hexdigest(),
                "strategy": "disjoint unicode ranges; all original cmap and variation sequences; UI common512/rest1024",
                "fonts": []}
    previous_manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"fonts": []}
    previous_faces = {item["fontId"]: item for item in previous_manifest["fonts"]}
    with tempfile.TemporaryDirectory(prefix="openacad-webfonts-") as staging:
        staging_root = Path(staging)
        (staging_root / "woff2").mkdir()
        jobs = []
        for source_name, stem, family, weight, style in FONTS:
            font = TTFont(SOURCE_ROOT / source_name)
            record = {"family": family, "fontId": stem, "fontWeight": weight, "fontStyle": style,
                      "source": source_name, "sourceSha256": expected_hashes[source_name],
                      "sourceBytes": (SOURCE_ROOT / source_name).stat().st_size,
                      "version": font["name"].getDebugName(5), "shards": []}
            previous = previous_faces.get(stem, {})
            reusable = previous.get("sourceSha256") == expected_hashes[source_name] and previous.get("fontStyle", "normal") == style
            prior_shards = {shard["name"]: shard for shard in previous.get("shards", [])} if reusable else {}
            for name, points in partition(font.getBestCmap(), common):
                old = prior_shards.get(name)
                if old and old["codepoints"] == points and (FONT_ROOT / old["file"]).exists() and sha(FONT_ROOT / old["file"]) == old["sha256"]:
                    cached = {**old, "fontStyle": style}
                    shutil.copyfile(FONT_ROOT / old["file"], staging_root / old["file"])
                    record["shards"].append(cached)
                else:
                    jobs.append((source_name, stem, family, weight, style, name, points, str(staging_root / "woff2")))
            font.close()
            manifest["fonts"].append(record)
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            for shard in pool.map(create_shard, jobs):
                next(item for item in manifest["fonts"] if item["fontId"] == shard["fontId"])["shards"].append(shard)
                print(shard["family"], shard["fontWeight"], shard["name"], shard["bytes"], flush=True)
        css = ["/* Generated by scripts/build-webfonts.py. Upstream and disclosed derivative OTFs: server/fonts (OFL-1.1). */"]
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            verifications = list(pool.map(verify_family, manifest["fonts"], [staging_root] * len(manifest["fonts"])))
        for item, verification in zip(manifest["fonts"], verifications):
            item["shards"].sort(key=lambda shard: (0 if shard["name"] == "latin" else 1, shard["name"]))
            item["verification"] = verification
            item["totalWoff2Bytes"] = sum(shard["bytes"] for shard in item["shards"])
            item["commonWoff2Bytes"] = sum(shard["bytes"] for shard in item["shards"] if not shard["name"].startswith("rest-"))
            for shard in item["shards"]:
                css.append(f"@font-face{{font-family:'{item['family']}';src:url('/fonts/{shard['file']}') format('woff2');font-weight:{item['fontWeight']};font-style:{item['fontStyle']};font-display:swap;unicode-range:{shard['unicodeRange']};}}")
        destination = FONT_ROOT / "woff2"
        destination.mkdir(exist_ok=True)
        expected_files = set()
        for path in (staging_root / "woff2").iterdir():
            expected_files.add(path.name)
            (destination / path.name).write_bytes(path.read_bytes())
        for old in destination.glob("*.woff2"):
            if old.name not in expected_files:
                old.unlink()
        (ROOT / "web/src/styles/font-faces.css").write_text("\n".join(css) + "\n")
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps([{key: item[key] for key in ["family", "fontWeight", "fontStyle", "sourceBytes", "totalWoff2Bytes", "commonWoff2Bytes", "verification"]} for item in manifest["fonts"]], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
