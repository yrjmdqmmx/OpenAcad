from pathlib import Path, PurePosixPath
import hashlib, json, zipfile

base=Path(__file__).parent
source=base/'web-b04a48c.zip.partial'
revision='b04a48cb71e8e14417e6027651d2c8c286c74cfc'
run=json.loads((base/'ci-current-push.json').read_text())
assert run['head_sha']==revision and run['conclusion']=='success'
artifact=next(a for a in json.loads((base/'ci-current-artifacts.json').read_text())['artifacts'] if a['name']=='web-evidence')
def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
assert source.stat().st_size==artifact['size_in_bytes']
assert digest(source)==artifact['digest'].removeprefix('sha256:')
previous=json.loads((base/'previous-web-inventory.json').read_text())
public=json.loads((base/'public-source-manifest-current.json').read_text())
payload=base/'web-payload-b04a48c.zip'
assert not payload.exists()
files={}
with zipfile.ZipFile(source) as z,zipfile.ZipFile(payload,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as output:
    version=json.loads(z.read('web/dist/version.json'))
    stats=json.loads(z.read('tests/artifacts/browser-results.json'))['stats']
    assert version['revision']==revision and stats['expected']==238 and stats['unexpected']==0 and stats['flaky']==0
    for entry in z.infolist():
        if not entry.filename.startswith('web/dist/') or entry.is_dir():continue
        name=entry.filename.removeprefix('web/dist/')
        p=PurePosixPath(name)
        assert not p.is_absolute() and '..' not in p.parts and name==p.as_posix() and name not in files
        data=z.read(entry)
        record={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        same=previous['files'].get(name)==record
        files[name]={**record,'source':'previous-verified-by-content' if same else 'payload'}
        if not same:output.writestr(name,data)
assert files and 'index.html' in files and 'fonts/OFL.txt' in files
for name,value in public['files'].items():assert {k:files[name][k] for k in ['bytes','sha256']}==value,name
manifest={'revision':revision,'version':version,'sourceRun':run['id'],'sourceConclusion':run['conclusion'],'sourceArtifact':{k:artifact[k] for k in ['id','name','size_in_bytes','digest']},'allSourceZipBytesVerified':True,'sourceMode':'Exact CI web files; unchanged previous files reused only after byte hashes match; no application rebuild','previousRelease':previous['release'],'payloadSha256':digest(payload),'payloadBytes':payload.stat().st_size,'browserStats':stats,'publicSourceFilesVerified':len(public['files']),'woff2FilesVerified':sum(n.endswith('.woff2') for n in public['files']),'files':files}
path=base/'web-deployment-manifest.json'
path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(base/'web-deployment-manifest.sha256').write_text(digest(path)+'\n')
source.rename(base/'web-b04a48c.zip')
print(json.dumps({k:v for k,v in manifest.items() if k!='files'},ensure_ascii=False,indent=2))
print(json.dumps({'reusedFiles':sum(v['source']!='payload' for v in files.values()),'payloadFiles':sum(v['source']=='payload' for v in files.values()),'totalFiles':len(files),'manifestSha256':digest(path)}))
