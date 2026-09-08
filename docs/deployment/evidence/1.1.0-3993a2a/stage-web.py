# Unused full-ZIP staging template; final release used stage-web-delta.py.
import datetime, hashlib, json, sys, zipfile
from pathlib import Path, PurePosixPath

base = Path('/opt/openacad')
source = '3993a2a3d9ed1485ef1b50b73adf389b6caf71f8'
release = base / 'releases/1.1.0-3993a2a'
archive = base / 'releases/artifact-3993a2a-web-verified.zip'

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
assert browser['stats']['expected'] == 233 and browser['stats']['skipped'] == 539
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
images = {'bar-grouped.jpg': '37c6633022eb8a7b3a19dc09e41c7acd2ee304d9dd9c2c5ff786bba188289e4d', 'volcano.jpg': '05c55d9a1518464878402d4a01a1c9ef2a9084a44b24e31026d2e20250b41c82', 'sankey.jpg': '7eeb8918a7ca58aedc08601db1f7b74437abb6730ad1f96c83b6975bed981aca', 'tree-circle.jpg': '05e2d45529e239f450a71009ec98540ab0ae74758cf37b8e9ab616c3a92fd690', 'heatmap.jpg': '2677edf8f12c107f11449d9db75e7416e743f4e03f0eb9d33e1fb91c51b002dc'}
for name, sha in images.items(): assert digest(release / 'web/images/research' / name) == sha
report = dict(homepageImageSha256=images, stagedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), version=version,
              archiveSha256=sys.argv[1], files=count, woff2FilesVerified=len(fonts),
              exampleSha256=samples, publicResearchReportsRemoved=True,
              browserStats=browser['stats'], performance=performance, serviceChanged=False)
(release / 'staged-web.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in report.items() if k != 'performance'}, ensure_ascii=False, indent=2))
