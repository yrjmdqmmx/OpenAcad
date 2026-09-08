import json, subprocess, concurrent.futures, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
root=Path(__file__).parent
out=root/'export-renders';out.mkdir(exist_ok=True)
rows=json.loads((root/'exports/report.json').read_text())
if os.getenv('ONLY'):rows=[r for r in rows if r['id'] in os.environ['ONLY'].split(',')]
def raster(task):
 id,fmt=task;src=root/'exports'/f'{id}.{fmt}';dest=out/f'{id}-{fmt}.png'
 if fmt in ['pdf','eps']:
  subprocess.run(['/opt/homebrew/bin/gs','-q','-dSAFER','-dBATCH','-dNOPAUSE','-dEPSCrop','-dUseCropBox','-sDEVICE=png16m','-r96','-dTextAlphaBits=4','-dGraphicsAlphaBits=4',f'-sOutputFile={dest}',str(src)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 else:Image.open(src).convert('RGB').save(dest)
 return id,fmt
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 for _ in pool.map(raster,[(r['id'],f) for r in rows for f in ['png','pdf','eps']]):pass
def compare(id,fmt):
 ref=Image.open(out/f'{id}-svg.png').convert('RGB');im=Image.open(out/f'{id}-{fmt}.png').convert('RGB');original=im.size
 im=im.resize(ref.size,Image.Resampling.LANCZOS)
 a=np.asarray(ref,dtype=float);b=np.asarray(im,dtype=float)
 mask=np.minimum(a.min(2),b.min(2))<240
 # Global error plus blurred error separate renderer antialiasing from layout.
 aa=np.asarray(ref.filter(ImageFilter.GaussianBlur(1)),dtype=float);bb=np.asarray(im.filter(ImageFilter.GaussianBlur(1)),dtype=float)
 return dict(format=fmt,dimensions=original,aspectError=abs(original[0]/original[1]-ref.width/ref.height),mae=round(float(abs(a-b).mean()/255),5),inkMae=round(float(abs(a-b)[mask].mean()/255),5),blurMae=round(float(abs(aa-bb).mean()/255),5))
report=[dict(id=r['id'],comparisons=[compare(r['id'],f) for f in ['png','pdf','eps']]) for r in rows]
if os.getenv('ONLY'):
 updated={r['id']:r for r in report};report=[updated.get(r['id'],r) for r in json.loads((out/'comparison.json').read_text())]
(out/'comparison.json').write_text(json.dumps(report,indent=2))
print(json.dumps(sorted(report,key=lambda r:max(c['blurMae'] for c in r['comparisons']),reverse=True)[:12],indent=2))
