"""Read-only validation of the eight actual desktop/mobile production downloads."""
import datetime, hashlib, json, pathlib, subprocess, sys
import xml.etree.ElementTree as ET

repo = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(repo / 'server/scripts'))
from production_smoke import png_check

root = repo / 'tests/artifacts/production-browser-1.1.0-artifacts'
out = root / 'independent-previews'
out.mkdir(exist_ok=True)
files = sorted(root.glob('*/[cm]*-chinese-serif.*'))
assert len(files) == 8
cases = []
for file in files:
    fmt = file.suffix[1:]
    record = {'file': str(file.relative_to(root)), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'format': fmt}
    if fmt == 'svg':
        svg = ET.parse(file).getroot()
        assert svg.attrib['viewBox'] == '0 0 960 640'
        assert not list(svg.iter('{http://www.w3.org/2000/svg}text'))
        assert len(list(svg.iter('{http://www.w3.org/2000/svg}path'))) > 0
        record.update(scope='XML structure and outlined paths; exported SVG not separately rasterized', viewBox=svg.attrib['viewBox'])
    else:
        decoded = file
        if fmt in ('pdf', 'eps'):
            decoded = out / (file.stem + '-' + fmt + '.png')
            command = ['pdftoppm', '-f', '1', '-singlefile', '-r', '96', '-png', str(file), str(decoded.with_suffix(''))] if fmt == 'pdf' else ['gs', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pngalpha', '-r96', '-dEPSCrop', '-sOutputFile=' + str(decoded), str(file)]
            subprocess.run(command, check=True, capture_output=True, timeout=60)
            record['decoder'] = 'Poppler' if fmt == 'pdf' else 'Ghostscript'
        record['pixels'] = png_check(decoded)
        assert (record['pixels']['width'], record['pixels']['height']) == ((1500, 1000) if fmt == 'png' else (960, 640))
        if fmt == 'pdf':
            fonts = subprocess.check_output(['pdffonts', str(file)], text=True)
            assert 'NotoSerifCJKsc-Bold' in fonts
            assert all(row.split()[-5] == 'yes' for row in fonts.splitlines()[2:])
            record['fonts'] = fonts
    record['passed'] = True
    cases.append(record)
report = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'passed': True, 'sourceRevision': '7e68b5b9f740855e89bf5c8d49d0c5d8c6dfacff', 'cases': cases}
(root / 'independent-export-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'passed': True, 'files': len(cases)}))
