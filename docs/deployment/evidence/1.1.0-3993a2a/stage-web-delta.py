from pathlib import Path, PurePosixPath
import json,hashlib,zipfile,sys,shutil,datetime
base=Path('/opt/openacad');source='3993a2a3d9ed1485ef1b50b73adf389b6caf71f8'
release=base/'releases/1.1.0-3993a2a';previous=base/'releases/1.1.0-80370e0'
archive=base/'releases/artifact-3993a2a-web-delta.zip'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sys.argv[1]=='f30901ede3d2e33427c52e4aaf5cccf29ba91b68417a99158cb2c8aadef814e0' and digest(archive)==sys.argv[1]
assert (base/'current').resolve()==previous and not release.exists()
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 manifest=json.loads(z.read('manifest.json'))
 assert manifest['sourceRevision']==source and manifest['sourceRun']==34182366813
 assert manifest['sourceArchiveSha256']=='68853b9e7f6532c8d6f7fa9bdf5322502798083eb9591b70f27399d5c01e199d'
 assert set(z.namelist())=={'manifest.json',*['payload/'+n for n in manifest['payloadFiles']]}
 assert len(manifest['files'])==398
 browser={'stats':manifest['browserStats']};performance=manifest['performance']
 assert browser['stats']['expected']==233 and browser['stats']['skipped']==539 and browser['stats']['unexpected']==browser['stats']['flaky']==0
 release.mkdir();count=0
 for name,record in manifest['files'].items():
  p=PurePosixPath(name);assert not p.is_absolute() and '..' not in p.parts
  target=release/'web'/name;target.parent.mkdir(parents=True,exist_ok=True)
  if name in manifest['payloadFiles']:target.write_bytes(z.read('payload/'+name))
  else:
   origin=previous/'web'/name;assert origin.is_file() and not origin.is_symlink() and digest(origin)==record['sha256']
   shutil.copyfile(origin,target)
  assert target.stat().st_size==record['bytes'] and digest(target)==record['sha256'];count+=1
 (release/'web-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

web_manifest = manifest
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
              archiveSha256=web_manifest['sourceArchiveSha256'], webDeltaSha256=sys.argv[1], reusedFiles=394, allFilesVerified=True, files=count, woff2FilesVerified=len(fonts),
              exampleSha256=samples, publicResearchReportsRemoved=True,
              browserStats=browser['stats'], performance=performance, serviceChanged=False)
(release / 'staged-web.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in report.items() if k != 'performance'}, ensure_ascii=False, indent=2))
