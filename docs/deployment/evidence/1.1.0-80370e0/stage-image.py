from pathlib import Path
import json,hashlib,subprocess,zipfile,datetime,sys,os
base=Path('/opt/openacad');release=base/'releases/1.1.0-80370e0';out=release/'transport';out.mkdir(exist_ok=True)
sha='80370e0f495d9517f7bf99ccd4cb1de0b84fbfe1';config=sys.argv[2]
archive=base/'releases/artifact-80370e0-delta.zip';expected_zip_sha=sys.argv[1]
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
assert len(expected_zip_sha)==64 and digest(archive)==expected_zip_sha,'ZIP checksum differs'
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None,'ZIP CRC invalid'
 for name in ['openacad-worker.delta.tar.gz','delta-report.json','delta-source-run.json']:
  info=z.getinfo(name);assert info.file_size<2_000_000_000
  with (out/name).open('xb') as f:f.write(z.read(info))
 # The downloaded helper must match the independently uploaded, reviewed helper.
 helpers=[n for n in z.namelist() if n.endswith('/image_delta.py') or n=='image_delta.py'];assert len(helpers)==1
 assert hashlib.sha256(z.read(helpers[0])).hexdigest()==digest(base/'verification/1.1.0-80370e0/image_delta.py')
source=json.loads((out/'delta-source-run.json').read_text());delta=json.loads((out/'delta-report.json').read_text())
assert source['id']==34178615830 and source['head_sha']==sha and source['status']=='completed' and source['conclusion']=='success'
assert delta['configDigest']==config and delta['architecture']=='amd64' and delta['os']=='linux'
assert delta['deltaSha256']==digest(out/'openacad-worker.delta.tar.gz')
helper=base/'verification/1.1.0-80370e0/image_delta.py';assembled=out/'openacad-worker-reconstructed.tar'
env=os.environ.copy();tmp=base/'verification/1.1.0-80370e0/tmp';tmp.mkdir(exist_ok=True);env['TMPDIR']=str(tmp)
subprocess.run(['python3',str(helper),'assemble','--baseline',str(base/'releases/openacad-worker.tar.gz'),'--delta',str(out/'openacad-worker.delta.tar.gz'),'--expected-image-id',config,'--output',str(assembled),'--report',str(out/'reconstruction-report.json')],check=True,env=env)
with (out/'docker-load.log').open('w') as f:subprocess.run(['docker','load','--input',str(assembled)],check=True,stdout=f,stderr=subprocess.STDOUT)
inspected=subprocess.check_output(['docker','image','inspect','openacad-worker:verified']);(out/'loaded-image-inspect.json').write_bytes(inspected)
subprocess.run(['python3',str(helper),'verify-loaded','--assembly-report',str(out/'reconstruction-report.json'),'--inspect-json',str(out/'loaded-image-inspect.json'),'--output',str(out/'loaded-image-verification.json')],check=True)
verified=json.loads((out/'loaded-image-verification.json').read_text());assert verified['dockerLoadVerified'] and verified['configDigest']==config
assert json.loads(inspected)[0]['Config']['User']=='10001:10001'
version=json.loads((release/'web/version.json').read_text());assert version['revision']==sha and version['version']=='1.1.0'
tag='openacad-worker:1.1.0-80370e0';subprocess.run(['docker','tag','openacad-worker:verified',tag],check=True)
(release/'release.env').write_text('OPENACAD_IMAGE='+tag+'\n');(release/'REVISION').write_text(sha+'\n')
record={'stagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'release':str(release),'sourceRevision':sha,'version':version,'imageTag':tag,'image':verified,'archiveSha256':expected_zip_sha,'deltaBytes':delta['deltaBytes'],'reusedBytes':delta['reusedBytes'],'serviceChanged':False}
(out/'staging-report.json').write_text(json.dumps(record,ensure_ascii=False,indent=2));print(json.dumps(record,ensure_ascii=False,indent=2),flush=True)
