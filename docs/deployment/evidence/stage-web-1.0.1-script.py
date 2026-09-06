import zipfile,json,hashlib,subprocess,datetime,sys,shutil
from pathlib import Path,PurePosixPath
base=Path('/opt/openacad');release=base/'releases/1.0.1-01c5d87';old=base/'releases/1.0.0-23d5bb0'
archive=base/'releases/artifact-01c5d87-web.zip';expected=sys.argv[1]
source='01c5d87a6f36263b236bd964d70996d25635a907';backend='23d5bb098d4b1a6d8551f3de8fe6e88893807f91';tree='b72dd0184d2ae8aec271727058f311de3c0eae53'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for data in iter(lambda:f.read(1024*1024),b''):h.update(data)
 return h.hexdigest()
assert len(expected)==64 and sha(archive)==expected
assert not release.exists();release.mkdir();count=0
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for m in z.infolist():
  if not m.filename.startswith('web/dist/') or m.is_dir():continue
  p=PurePosixPath(m.filename).relative_to('web/dist');assert not p.is_absolute() and '..' not in p.parts and m.file_size<100_000_000
  out=release/'web'/str(p);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(z.read(m));count+=1
 version=json.loads((release/'web/version.json').read_text());assert version['revision']==source and version['version']=='1.0.1'
 performance=json.loads(z.read('tests/artifacts/style-performance.json'))
 browser=json.loads(z.read('tests/artifacts/browser-results.json'));assert browser['stats']['unexpected']==0
font_manifest=json.loads((release/'web/fonts/webfont-manifest.json').read_text());fonts=[]
for family in font_manifest['fonts']:
 for shard in family['shards']:
  p=release/'web/fonts'/shard['file'];assert sha(p)==shard['sha256'];fonts.append(shard['file'])
assert len(fonts)==92 and not list((release/'web/fonts').glob('*.otf'))
image=json.loads(subprocess.check_output(['docker','image','inspect','openacad-worker:1.0.0-23d5bb0']))[0]
assert image['Id']=='sha256:cec91c1f008073236405713073ff14011102d9913fecea48fbdcadfb0134d168' and image['Architecture']=='amd64'
shutil.copyfile(old/'compose.yml',release/'compose.yml');shutil.copyfile(old/'release.env',release/'release.env')
(release/'REVISION').write_text(source+'\n');(release/'BACKEND_REVISION').write_text(backend+'\n')
report={'stagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':version,'archiveSha256':expected,'files':count,'woff2FilesVerified':len(fonts),'performance':performance,'browserStats':browser['stats'],'backend':{'sourceRevision':backend,'sourceTreeAtBothRevisions':tree,'imageId':image['Id'],'imageTag':'openacad-worker:1.0.0-23d5bb0','reuseReason':'server directory Git tree identical; original image verified and production five-task smoke complete'},'serviceChanged':False}
(release/'staging-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'stagedAt':report['stagedAt'],'version':version,'woff2FilesVerified':len(fonts),'browserStats':browser['stats'],'backend':report['backend']},ensure_ascii=False,indent=2))
