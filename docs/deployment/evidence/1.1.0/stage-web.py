import datetime, hashlib, json, sys, zipfile
from pathlib import Path, PurePosixPath

base = Path('/opt/openacad')
source = '7e68b5b9f740855e89bf5c8d49d0c5d8c6dfacff'
release = base / 'releases/1.1.0-7e68b5b'
archive = base / 'releases/artifact-7e68b5b-web.zip'

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

assert digest(archive) == sys.argv[1]
assert not release.exists()
release.mkdir()
count = 0
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for item in z.infolist():
        if not item.filename.startswith('web/dist/') or item.is_dir():
            continue
        p = PurePosixPath(item.filename).relative_to('web/dist')
        assert not p.is_absolute() and '..' not in p.parts and item.file_size < 100_000_000
        out = release / 'web' / str(p)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open('xb') as f:
            f.write(z.read(item))
        count += 1
    browser = json.loads(z.read('tests/artifacts/browser-results.json'))
    performance = json.loads(z.read('tests/artifacts/style-performance.json'))
assert browser['stats']['unexpected'] == 0 and browser['stats']['flaky'] == 0
version = json.loads((release / 'web/version.json').read_text())
assert version['version'] == '1.1.0' and version['revision'] == source
assert not (release / 'web/research').exists() and not (release / 'web/acceptance').exists()
manifest = json.loads((release / 'web/fonts/webfont-manifest.json').read_text())
fonts = []
for face in manifest['fonts']:
    for shard in face['shards']:
        assert digest(release / 'web/fonts' / shard['file']) == shard['sha256']
        fonts.append(shard['file'])
assert len(fonts) == 368 and len(manifest['fonts']) == 8
assert not list((release / 'web/fonts').glob('*.otf'))
samples = {name: digest(release / 'web/examples/bio' / name) for name in ['3730.ab1', '310.ab1', '3100.ab1', 'empty.ab1', 'ko-example.tsv']}
report = dict(stagedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), version=version,
              archiveSha256=sys.argv[1], files=count, woff2FilesVerified=len(fonts),
              exampleSha256=samples, publicResearchReportsRemoved=True,
              browserStats=browser['stats'], performance=performance, serviceChanged=False)
(release / 'staged-web.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in report.items() if k != 'performance'}, ensure_ascii=False, indent=2))
