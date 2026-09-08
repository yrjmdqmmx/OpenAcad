from pathlib import Path, PurePosixPath
import argparse, datetime, hashlib, json, os, shutil, zipfile

p=argparse.ArgumentParser()
p.add_argument('--manifest',type=Path,required=True)
p.add_argument('--manifest-sha256',required=True)
p.add_argument('--payload',type=Path,required=True)
p.add_argument('--release',type=Path,required=True)
a=p.parse_args()
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
assert a.release.resolve().parent==Path('/opt/openacad/releases')
assert digest(a.manifest)==a.manifest_sha256
m=json.loads(a.manifest.read_text())
assert m['revision']=='b04a48cb71e8e14417e6027651d2c8c286c74cfc' and m['version']['revision']==m['revision']
assert m['sourceConclusion']=='success' and m['allSourceZipBytesVerified']
assert m['browserStats']['unexpected']==0 and m['browserStats']['flaky']==0 and m['browserStats']['expected']==238
assert digest(a.payload)==m['payloadSha256'] and a.payload.stat().st_size==m['payloadBytes']
old=Path(m['previousRelease'])/'web'
assert old.parent.parent==Path('/opt/openacad/releases') and old.is_dir()
web=a.release/'web'; temporary=a.release/'web.staging'
assert not web.exists() and not temporary.exists()
temporary.mkdir()
reused=[]; transferred=[]
with zipfile.ZipFile(a.payload) as z:
    expected={name for name,e in m['files'].items() if e['source']=='payload'}
    assert set(z.namelist())==expected and len(z.namelist())==len(expected)
    for name,e in m['files'].items():
        relative=PurePosixPath(name)
        assert name==relative.as_posix() and not relative.is_absolute() and '..' not in relative.parts
        target=temporary/relative;target.parent.mkdir(parents=True,exist_ok=True)
        if e['source']=='previous-verified-by-content':
            source=old/relative
            assert source.resolve().is_relative_to(old.resolve())
            assert source.stat().st_size==e['bytes'] and digest(source)==e['sha256']
            shutil.copy2(source,target);reused.append(name)
        else:
            assert e['source']=='payload'
            with target.open('xb') as out:out.write(z.read(name))
            transferred.append(name)
        assert target.stat().st_size==e['bytes'] and digest(target)==e['sha256'],name
assert json.loads((temporary/'version.json').read_text())==m['version']
assert (temporary/'index.html').is_file() and (temporary/'fonts/OFL.txt').is_file()
os.replace(temporary,web)
report={'stagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':m['version'],'sourceRun':m['sourceRun'],'sourceArtifact':m['sourceArtifact'],'sourceMode':m['sourceMode'],'manifestSha256':a.manifest_sha256,'payloadSha256':m['payloadSha256'],'payloadBytes':m['payloadBytes'],'files':len(m['files']),'reusedFiles':len(reused),'transferredFiles':len(transferred),'allWebFilesVerifiedAgainstCI':True,'publicSourceFilesVerified':m['publicSourceFilesVerified'],'woff2FilesVerified':m['woff2FilesVerified'],'browserStats':m['browserStats'],'serviceChanged':False,'webFileManifest':m['files']}
(a.release/'staged-web.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='webFileManifest'},ensure_ascii=False,indent=2))
