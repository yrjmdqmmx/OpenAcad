"""Regenerate fixed-seed simulated inputs through the real local OpenAcad worker.
Run refresh-reference-hashes.mjs after ordination regeneration. Never substitutes mock statistics.
"""
import json,random,math,time,hashlib,urllib.request,pathlib,os
root=pathlib.Path(__file__).resolve().parents[1] / 'web/src/templates/ordination'
inputs=json.loads((root/'example-inputs.json').read_text());results={}
def req(path,body=None,token=None):
 h={'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 q=urllib.request.Request(os.environ.get('OPENACAD_EXAMPLE_API','http://127.0.0.1:18082')+'/api/'+path,data=json.dumps(body).encode() if body is not None else None,headers=h)
 return json.load(urllib.request.urlopen(q,timeout=40))
for method,variants in inputs.items():
 results[method]={}
 for variant,entry in variants.items():
  rng=random.Random(20260907+(variant=='alternate')*91)
  rows=[];env=[]
  for group in range(3):
   for i in range(6):
    sample=['对照','升温','补水'][group]+' '+str(i+1).zfill(2)
    temperature=round(22+group*1.9+rng.gauss(0,1.6),2)
    moisture=round(40+[0,-9,12][group]+rng.gauss(0,5.5),2)
    nutrient=round(18+[0,3,1][group]+rng.gauss(0,3.5),2)
    vals=[round(max(.2, 22*math.exp(-((moisture-opt)/19)**2) + (temperature-23)*slope + rng.gauss(0,3.4)),3) for opt,slope in [(24,1.3),(32,-.5),(39,.8),(46,-.8),(53,.5),(61,-.4)]]
    rows.append([sample,*vals]);env.append([sample,temperature,moisture,nutrient])
  t=entry['dataset']['tables'][0];t['name']='土壤群落模拟丰度';t['columns']=['样本编号',*[f'类群{x}' for x in '甲乙丙丁戊己']];t['rows']=rows
  if len(entry['dataset']['tables'])>1:
   t=entry['dataset']['tables'][1];t['columns']=['样本编号','温度 (°C)','含水率 (%)','有效磷 (mg/kg)'];t['rows']=env
  job=req('jobs',{'kind':'analysis','method':method,'data':entry['dataset'],'params':entry['params']})
  deadline=time.monotonic()+300
  while time.monotonic()<deadline:
   state=req('jobs/'+job['id'],token=job['token'])
   if state['status'] in ['finished','completed','succeeded','success']:break
   if state['status'] in ['failed','canceled']:raise RuntimeError(str(state.get('error')))
   time.sleep(.8)
  else:raise TimeoutError(method)
  result=state['result'];result.setdefault('provenance',{})['purpose']='固定种子生成土壤群落模拟数据，经真实算法计算；非真实实验结论'
  payload={'dataset':entry['dataset'],'method':method,'params':entry['params']}
  # JavaScript refresh script finalizes hashes using JSON.stringify semantics.
  results[method][variant]={'method':method,'params':entry['params'],'inputHash':'','result':result}
  data=result.get('data',{}); print(method,variant,'scores',len(data.get('scores',[])),'stress',data.get('stress'),'converged',data.get('converged'),flush=True)
(root/'example-inputs.json').write_text(json.dumps(inputs,ensure_ascii=False,indent=2)+'\n')
(root/'reference-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
