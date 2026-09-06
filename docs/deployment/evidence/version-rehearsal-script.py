from pathlib import Path
import subprocess,json,hashlib,datetime
base=Path('/opt/openacad')
final=base/'releases/1.0.0-23d5bb0'
previous=base/'releases/0.1.0-fb4cacd'
out=base/'verification/version-rehearsal'
out.mkdir(parents=True,exist_ok=True)
record={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'steps':[],'passed':False}
def snapshot(expected):
 current=(base/'current').resolve();assert current==expected,(current,expected)
 health=json.loads(subprocess.check_output(['curl','--silent','--show-error','--fail','--max-time','15','http://127.0.0.1:13310/api/health']))
 assert health['status']=='ok' and health['workers']>=2,health
 image_status=[]
 tag=next(line.split('=',1)[1] for line in (current/'release.env').read_text().splitlines() if line.startswith('OPENACAD_IMAGE='))
 expected_image=subprocess.check_output(['docker','image','inspect',tag,'--format','{{.Id}}'],text=True).strip()
 for name in ['openacad-api-1','openacad-worker-one-1','openacad-worker-two-1']:
  item=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
  assert item['State']['Health']['Status']=='healthy',name
  assert item['Image']==expected_image,{'container':name,'actualImage':item['Image'],'expectedImage':expected_image}
  image_status.append({'container':name,'imageId':item['Image'],'health':item['State']['Health']['Status']})
 body=subprocess.check_output(['curl','--silent','--show-error','--fail','--max-time','15','--resolve','openacad.xyz:443:127.0.0.1','https://openacad.xyz/'])
 expected_hash=hashlib.sha256((current/'web/index.html').read_bytes()).hexdigest()
 assert hashlib.sha256(body).hexdigest()==expected_hash,'HTTPS frontend differs from release'
 assert not (base/'shared/maintenance').exists()
 return {'release':str(current),'revision':(current/'REVISION').read_text().strip(),'health':health,'containers':image_status,'httpsIndexSha256':expected_hash,'maintenancePresent':False,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
def switch(destination,label):
 with (out/(label+'.log')).open('w') as log:
  result=subprocess.run(['bash',str(base/'bin/update.sh'),str(destination)],stdout=log,stderr=subprocess.STDOUT,timeout=600)
 assert result.returncode==0,{'label':label,'exitCode':result.returncode}
 state=snapshot(destination);state['action']=label;state['exitCode']=result.returncode
 record['steps'].append(state)
try:
 record['before']=snapshot(final)
 switch(previous,'restore-previous')
 switch(final,'restore-final')
 assert record['steps'][0]['httpsIndexSha256']!=record['steps'][1]['httpsIndexSha256']
 record['passed']=True
except Exception as error:
 record['error']=str(error)
 if (base/'current').resolve()!=final:
  try:switch(final,'recover-final-after-rehearsal-error')
  except Exception as recovery:record['recoveryError']=str(recovery)
finally:
 record['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 (out/'report.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
print(json.dumps(record,ensure_ascii=False,indent=2))
assert record['passed']
