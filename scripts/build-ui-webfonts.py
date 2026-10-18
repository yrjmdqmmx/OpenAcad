#!/usr/bin/env python3
"""Small UI-only faces; scientific chart/export fonts remain unchanged.

Run with scripts/font-delivery-requirements.txt. These aliases prevent new UI
copy from fetching many 1024-character scientific-font fallback shards.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

ROOT = Path(__file__).resolve().parents[1]
corpus = "".join(p.read_text() for p in sorted((ROOT / "web/src").rglob("*.tsx")) if ".test." not in p.name)
points = set(map(ord, corpus)) | set(range(32, 127))
output = ROOT / "web/public/fonts/ui"
output.mkdir(parents=True, exist_ok=True)
faces = [("NotoSansCJKsc-Regular.otf", "OpenAcad UI Sans", 400),
         ("NotoSansCJKsc-Bold.otf", "OpenAcad UI Sans", 700),
         ("NotoSerifCJKsc-Bold.otf", "OpenAcad UI Serif", 700)]
css, records = [], []
for source, family, weight in faces:
    path = ROOT / "server/fonts" / source
    original = TTFont(path, recalcTimestamp=False)
    font = TTFont(path, recalcTimestamp=False)
    selected = points & set(original.getBestCmap())
    options = subset.Options()
    options.layout_features = ["*"]
    options.glyph_names = True
    options.recalc_timestamp = False
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=selected)
    worker.subset(font)
    # Compare actual outlines and advances, not only CSS family names.
    source_glyphs, glyphs = original.getGlyphSet(), font.getGlyphSet()
    for cp in selected:
        old, new = original.getBestCmap()[cp], font.getBestCmap()[cp]
        assert original["hmtx"][old] == font["hmtx"][new]
        a, b = RecordingPen(), RecordingPen()
        source_glyphs[old].draw(a); glyphs[new].draw(b)
        assert a.value == b.value
    font.flavor = "woff2"
    temporary = output / (source + ".woff2")
    font.save(temporary)
    digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
    final = output / (source.removesuffix(".otf") + "." + digest[:12] + ".woff2")
    temporary.replace(final)
    # Advertise exact glyph coverage so unusual user project names can fall
    # back normally; chart text still uses the complete scientific families.
    ranges = ",".join(f"U+{cp:X}" for cp in sorted(selected))
    css.append(f"@font-face{{font-family:'{family}';src:url('/fonts/ui/{final.name}') format('woff2');font-weight:{weight};font-style:normal;font-display:swap;unicode-range:{ranges};}}")
    records.append({"source": source, "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "family": family,
                    "weight": weight, "file": final.name, "sha256": digest, "bytes": final.stat().st_size,
                    "verifiedOutlinesAndAdvances": len(selected)})
    original.close(); font.close()
(ROOT / "web/src/styles/ui-font-faces.css").write_text("/* Generated UI aliases only; OFL sources in server/fonts. */\n" + "\n".join(css) + "\n")
(output / "manifest.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps(records, indent=2))
subprocess.run([sys.executable, str(ROOT / "scripts/build-critical-webfonts.py")], check=True)
