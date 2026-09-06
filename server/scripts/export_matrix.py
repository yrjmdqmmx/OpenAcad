#!/usr/bin/env python3
"""Repeatable SVG export acceptance. Requires Pillow, Poppler and Ghostscript.

Example (from repository root):
  python3 server/scripts/export_matrix.py --api http://127.0.0.1:18082 \
    --input tests/artifacts/svg --output tests/artifacts/exports \
    --report tests/artifacts/export-matrix.json --only-changed

Omit --only-changed whenever the conversion engine, fonts, DPI or policy changes.
Only simulated SVG files should be included in committed acceptance evidence.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.export_matrix import main

if __name__ == '__main__':
    main()
