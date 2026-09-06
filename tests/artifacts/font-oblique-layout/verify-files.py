#!/usr/bin/env python3
"""Independently open the eight actual UI downloads and retain font identity."""
from pathlib import Path
import sys
import json
import hashlib
import subprocess
import xml.etree.ElementTree as ET
import datetime as dt

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
sys.path.insert(0, str(ROOT / 'server'))
from app.export_matrix import independent_open

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
browser = json.loads((OUT / 'browser-report.json').read_text())
run = json.loads((OUT / 'run-provenance.json').read_text())
assert browser['passed'] and len(browser['cases']) == 2, browser['failures']
report = {'scope': 'local-oblique-layout', 'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
          'browserReportSha256': sha(OUT / 'browser-report.json'),
          'fontManifest': run['fontManifest'], 'fontManifestSha256': run['fontManifestSha256'],
          'cases': [], 'failures': []}
for case in browser['cases']:
    item = {'id': case['id'], 'files': [], 'projectReopened': case['project']['reopenedInFreshContext'],
            'mixedOrRotatedLayout': case.get('mixedRuns', case.get('textRuns'))}
    assert len(case['downloads']) == 4
    for entry in case['downloads']:
        path = Path(entry['file']); assert sha(path) == entry['sha256']
        fmt = entry['format']; provenance = next(r['provenance'] for r in case['exportResults'] if r['format'] == fmt)
        assert provenance['sha256'] == entry['sha256']
        assert provenance['availableFontsSha256'] == run['fontManifest']
        source = OUT / case['id'] / ('submitted-' + fmt + '.svg')
        assert sha(source) == next(s['sourceSha256'] for s in case['submittedSources'] if s['format'] == fmt)
        result = {**entry, 'sourceSha256': sha(source), 'provenance': provenance}
        if fmt == 'svg':
            root = ET.fromstring(path.read_bytes()); assert root.tag == '{http://www.w3.org/2000/svg}svg'
            assert len(root.findall('.//{http://www.w3.org/2000/svg}path')) > 10
            assert not root.findall('.//{http://www.w3.org/2000/svg}text')
            result.update(case['svgIndependentOpen'], opened=True, xmlParsed=True, textConvertedToPaths=True)
            result['independentRenderedImage'] = independent_open(OUT / case['id'] / 'svg-independently-opened.png')
        else:
            result.update(independent_open(path)); assert result['opened'] and not result['touchesPageEdge']
        if fmt == 'pdf':
            output = subprocess.check_output(['pdffonts', str(path)], text=True)
            names = [line.split()[0] for line in output.splitlines()[2:] if line.strip()]
            expected = 'OpenAcadNotoSansCJKsc-Oblique' if case['id'].startswith('tree') else 'OpenAcadNotoSerifCJKsc-BoldOblique'
            assert any(name.endswith(expected) for name in names), names
            assert not any('CairoFont' in name for name in names), names
            result['pdfFontResources'] = names
        item['files'].append(result)
    assert len({f['file'] for f in item['files']}) == 4
    item['passed'] = True; report['cases'].append(item)
report['passed'] = True
report['downloadedFileCount'] = sum(len(c['files']) for c in report['cases'])
(OUT / 'file-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'passed': True, 'cases': len(report['cases']), 'files': report['downloadedFileCount']}, ensure_ascii=False))
