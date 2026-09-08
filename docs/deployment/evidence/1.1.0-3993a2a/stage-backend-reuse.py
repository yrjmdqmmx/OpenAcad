from pathlib import Path
import json,hashlib,subprocess,datetime
base=Path('/opt/openacad');release=base/'releases/1.1.0-3993a2a';previous=base/'releases/1.1.0-80370e0'
source='3993a2a3d9ed1485ef1b50b73adf389b6caf71f8';backend='80370e0f495d9517f7bf99ccd4cb1de0b84fbfe1';tag='openacad-worker:1.1.0-80370e0'
assert (base/'current').resolve()==previous
assert (previous/'REVISION').read_text().strip()==backend
assert json.loads((release/'web/version.json').read_text())['revision']==source
ci=json.loads((release/'worker-image-inspect.json').read_text())[0]
loaded=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
verified=json.loads((previous/'transport/loaded-image-verification.json').read_text())
assert verified['dockerLoadVerified'] and ci['Id']==verified['configDigest']
assert loaded['Id']=='sha256:0e523f651921f8bcccd7f270befd9d19d04d1c7f32e82f727c80a820bc18a20d'
assert loaded['RootFS']==ci['RootFS'] and loaded['Architecture']==ci['Architecture']=='amd64' and loaded['Os']==ci['Os']=='linux'
assembly=json.loads((previous/'transport/reconstruction-report.json').read_text())
assert {k:loaded['Config'].get(k) for k in assembly['runtimeConfigKeys']}=={k:ci['Config'].get(k) for k in assembly['runtimeConfigKeys']}
inspect_path=release/'loaded-image-inspect.json';inspect_path.write_text(json.dumps([loaded]))
subprocess.run(['python3',str(base/'verification/1.1.0-80370e0/image_delta.py'),'verify-loaded','--assembly-report',str(previous/'transport/reconstruction-report.json'),'--inspect-json',str(inspect_path),'--output',str(release/'backend-loaded-verification.json')],check=True,stdout=subprocess.DEVNULL)
assert json.loads((release/'backend-loaded-verification.json').read_text())['dockerLoadVerified']
assert (release/'compose.yml').read_bytes()==(previous/'compose.yml').read_bytes()
(release/'release.env').write_text('OPENACAD_IMAGE='+tag+'\n')
(release/'REVISION').write_text(source+'\n');(release/'BACKEND_REVISION').write_text(backend+'\n')
report={'stagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'frontendRevision':source,'backendRevision':backend,'imageTag':tag,'ciConfigDigest':ci['Id'],'loadedOciRoot':loaded['Id'],'rootfsEqual':True,'runtimeConfigEqual':True,'serviceChanged':False}
(release/'backend-reuse.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
