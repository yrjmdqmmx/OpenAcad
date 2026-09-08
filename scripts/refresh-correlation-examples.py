"""Regenerate fixed-seed simulated inputs through the real local OpenAcad worker.
Run refresh-reference-hashes.mjs after ordination regeneration. Never substitutes mock statistics.
"""
import json,random,time,urllib.request,pathlib,os
root=pathlib.Path(__file__).resolve().parents[1]
def req(path,body=None,token=None):
 h={'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 return json.load(urllib.request.urlopen(urllib.request.Request(os.environ.get('OPENACAD_EXAMPLE_API','http://127.0.0.1:18082')+'/api/'+path,data=json.dumps(body).encode() if body else None,headers=h),timeout=60))
ord=json.loads((root/'web/src/templates/ordination/example-inputs.json').read_text())['cca']['example']['dataset']['tables'];rng=random.Random(79013)
env={'id':'raw-environment','role':'raw-environment','name':'模拟土壤环境观测','columns':['样本','温度','含水率','有效磷','有机碳'],'rows':[r+[round(12+.22*r[2]+rng.gauss(0,3),3)] for r in ord[1]['rows']]}
community={'id':'raw-community','role':'raw-community','name':'细菌功能群','columns':['样本','碳利用','氮转化','胁迫响应'],'rows':[[r[0],*r[1:4]] for r in ord[0]['rows']]}
fungal={'id':'raw-fungal','role':'raw-community','name':'真菌功能群','columns':['样本','分解功能','共生功能','抗逆功能'],'rows':[[r[0],*r[4:7]] for r in ord[0]['rows']]}
control={'id':'raw-control','role':'raw-control','name':'模拟空间控制','columns':['样本','海拔','距离'],'rows':[[r[0],round(300+rng.random()*250,2),round(rng.random()*35,2)] for r in env['rows']]}
outputs={}
for id in ['correlation','double-correlation','mantel']:
 raw=[env]+([community] if id!='correlation' else [])+([fungal,control] if id=='mantel' else [])
 method='mantel' if id=='mantel' else 'correlation'
 params={'speciesDistance':'bray','environmentDistance':'euclidean','permutations':999,'seed':2026} if id=='mantel' else {'correlation':'pearson','pAdjust':'BH'}
 data={'tables':[{**t,'role':('environment' if t['role']=='raw-environment' else 'community') if id=='mantel' else 'matrix'} for t in raw if t['role']!='raw-control']}
 job=req('jobs',{'kind':'analysis','method':method,'data':data,'params':params})
 while True:
  state=req('jobs/'+job['id'],token=job['token'])
  if state['status'] in ['finished','completed','succeeded','success']:break
  if state['status'] in ['failed','canceled']:raise RuntimeError(state.get('error'))
  time.sleep(.5)
 result=state['result'];d=result['data'];corr=d['environmentCorrelation'] if id=='mantel' else d
 tables=[]
 for role,key in [('correlation','r'),('pvalues','p')]:
  values=corr[key]
  tables.append({'id':role,'role':role,'name':'模拟观测的 Pearson '+('相关系数' if role=='correlation' else 'P 值（未校正）'),'columns':['变量',*corr['columnLabels']],'rows':[[label,*values[i]] for i,label in enumerate(corr['rowLabels'])]})
 if id=='mantel':
  names={t['id']:t['name'] for t in raw}
  tables.append({'id':'mantel','role':'mantel','name':'模拟观测的真实 Mantel 检验','columns':['source','target','r','p'],'rows':[[names.get(e['source'],e['source']),e['target'],e['r'],e['p']] for e in d['edges']]})
 outputs[id]={'dataset':{'tables':tables+raw},'request':{'method':method,'data':data,'params':params},'result':result}
 print(id, 'calculated',len(corr['r']),'by',len(corr['columnLabels']), 'edges',len(d.get('edges',[])),flush=True)
(root/'web/src/templates/scientific-correlations.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+'\n')
