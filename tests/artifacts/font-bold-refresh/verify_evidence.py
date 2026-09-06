#!/usr/bin/env python3
"""Verify the frozen historical inputs and the newly rendered Bold evidence."""
from pathlib import Path
import datetime as dt
import hashlib
import json
import subprocess
import argparse
import xml.etree.ElementTree as ET


BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--run-directory", type=Path, default=BASE)
HERE = parser.parse_args().run_directory.resolve()
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
run = json.loads((HERE / "run-provenance.json").read_text())
summary = {"schemaVersion": 1, "scope": "local-isolated-font-refresh",
           "verifiedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
           "fontManifestSha256": sha(HERE / "font-manifest.json"),
           "fontManifest": run["fontManifest"], "groups": {}, "failures": []}


def check(condition, message):
    if not condition:
        summary["failures"].append(message)


for group, spec in run["groups"].items():
    report_path = HERE / group / "export-matrix.json"
    report = json.loads(report_path.read_text())
    old_path = ROOT / spec["previousReport"]
    check(sha(old_path) == spec["previousReportSha256"], f"{group}: historical report changed")
    old_rows = json.loads(old_path.read_text())["files"]
    for row in old_rows:
        check(sha(Path(row["file"])) == row["sha256"], f"{group}: historical output changed: {row['file']}")
    check(not report["failures"], f"{group}: export failures: {report['failures']}")
    check(report["reusedFiles"] == 0, f"{group}: old output was reused")
    check(len(report["files"]) == spec["expectedOutputCount"], f"{group}: incomplete output count")
    expected = {(p["template"], f) for p in spec["sources"] for f in ("png", "pdf", "eps")}
    actual = {(r["template"], r["format"]) for r in report["files"]}
    check(expected == actual and len(actual) == len(report["files"]), f"{group}: unexpected or duplicate output identity")
    actual_paths = {str(p.resolve()) for p in (HERE / group / "outputs").iterdir() if p.is_file()}
    reported_paths = {str(Path(r["file"]).resolve()) for r in report["files"]}
    check(actual_paths == reported_paths and len(reported_paths) == spec["expectedOutputCount"], f"{group}: output directory/report path mismatch")
    sources = {p["template"]: p for p in spec["sources"]}
    pdfs = []
    png_comparisons = []
    changed = 0
    for row in report["files"]:
        name = row["template"]
        source = sources[name]
        snapshot = ROOT / source["snapshotSource"]
        check(sha(snapshot) == source["sourceSha256"] == row["sourceSha256"], f"{group}/{name}: source SHA mismatch")
        check(sha(ROOT / source["originalSource"]) == source["sourceSha256"], f"{group}/{name}: original SVG changed")
        check(sha(Path(row["file"])) == row["sha256"], f"{group}/{name}.{row['format']}: output SHA mismatch")
        check(row["provenance"]["availableFontsSha256"] == run["fontManifest"], f"{group}/{name}: incorrect font identity")
        check(row["opened"] and not row["touchesPageEdge"], f"{group}/{name}.{row['format']}: opening or page bounds failure")
        changed += row["sha256"] != spec["previousOutputSha256"][name + "." + row["format"]]
        if row["format"] == "pdf":
            output = subprocess.check_output(["pdffonts", row["file"]], text=True)
            fonts = [line.split()[0] for line in output.splitlines()[2:] if line.strip()]
            svg_root = ET.fromstring(snapshot.read_text())
            weights = [node.get("font-weight") for node in svg_root.iter() if node.get("font-weight")]
            styles = [node.get("font-style") for node in svg_root.iter() if node.get("font-style")]
            has_italic = any(style in ("italic", "oblique") for style in styles) or "font-style: italic" in snapshot.read_text()
            cairo = any("CairoFont" in f for f in fonts)
            expects_bold = any(w == "bold" or (w.isdigit() and int(w) > 500) for w in weights)
            check(not cairo or has_italic, f"{group}/{name}: unexplained synthetic PDF font detected")
            check(not expects_bold or any("Noto" in f and "Bold" in f for f in fonts), f"{group}/{name}: expected real Bold PDF resource missing")
            pdfs.append({"template": name, "explicitSourceWeights": weights,
                         "expectsBoldFromExplicitAttributes": expects_bold,
                         "explicitSourceStyles": styles, "sourceHasItalic": has_italic,
                         "pdfFontResources": fonts, "syntheticCairoFont": cairo,
                         "italicSynthesisNeedsVisualReview": cairo and has_italic})
        if row["format"] == "png" and HERE != BASE:
            from PIL import Image, ImageChops
            before = BASE / group / "outputs" / (name + ".png")
            after = Path(row["file"])
            has650 = any(n.get("font-weight") == "650" for n in ET.fromstring(snapshot.read_text()).iter())
            with Image.open(before) as old, Image.open(after) as new:
                check(old.size == new.size, f"{group}/{name}: font fix changed raster dimensions")
                difference = ImageChops.difference(old.convert("RGB"), new.convert("RGB"))
                bounds = difference.getbbox()
                red, green, blue = difference.split()
                nonzero = ImageChops.lighter(ImageChops.lighter(red, green), blue)
                changed_pixels = difference.width * difference.height - nonzero.histogram()[0]
            check(bool(bounds) == has650, f"{group}/{name}: unexpected 650 pixel comparison result")
            png_comparisons.append({"template": name, "sourceContains650": has650,
                                    "changedPixels": changed_pixels, "differenceBounds": bounds,
                                    "matchesExpectedChange": bool(bounds) == has650})
    (HERE / group / "pdf-font-resources.json").write_text(json.dumps(pdfs, ensure_ascii=False, indent=2) + "\n")
    if png_comparisons:
        (HERE / group / "png-normalization-comparison.json").write_text(json.dumps(png_comparisons, ensure_ascii=False, indent=2) + "\n")
    summary["groups"][group] = {"sourceCount": spec["sourceCount"],
                               "reportRows": len(report["files"]),
                               "uniqueOutputPaths": len(reported_paths),
                               "actualOutputFiles": len(actual_paths),
                               "convertedFiles": report["convertedFiles"],
                               "reusedFiles": report["reusedFiles"],
                               "openedFiles": sum(r["opened"] for r in report["files"]),
                               "touchesPageEdge": sum(r["touchesPageEdge"] for r in report["files"]),
                               "outputsDifferentFromRegularRun": changed,
                               "pdfsWithRealBoldResource": sum(any("Noto" in f and "Bold" in f for f in p["pdfFontResources"]) for p in pdfs),
                               "pngNormalizationComparisons": len(png_comparisons),
                               "pngChangedFor650": sum(p["sourceContains650"] and p["matchesExpectedChange"] for p in png_comparisons),
                               "pngUnchangedWithout650": sum(not p["sourceContains650"] and p["matchesExpectedChange"] for p in png_comparisons),
                               "report": str(report_path.relative_to(ROOT)), "reportSha256": sha(report_path)}
summary["passed"] = not summary["failures"]
(HERE / "verification-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(summary, ensure_ascii=False, indent=2))
raise SystemExit(0 if summary["passed"] else 1)
