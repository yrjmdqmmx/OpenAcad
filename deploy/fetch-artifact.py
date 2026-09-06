#!/usr/bin/env python3
"""将通过 Actions 生成的私有发行附件直接传至授权服务器；不写入访问凭据。"""
import argparse,json,subprocess,urllib.request,urllib.error,ssl,shlex,re
p=argparse.ArgumentParser();p.add_argument('--run',required=True,type=int);p.add_argument('--artifact',default='worker-image');p.add_argument('--host',required=True);p.add_argument('--out',required=True);a=p.parse_args()
if not a.out.startswith('/opt/openacad/releases/') or not re.fullmatch(r'[\w@.-]+',a.host):raise SystemExit('服务器或发行路径不合法')
meta=json.loads(subprocess.check_output(['gh','api',f'repos/yrjmdqmmx/OpenAcad/actions/runs/{a.run}/artifacts']))
item=next(x for x in meta['artifacts'] if x['name']==a.artifact and not x['expired'])
token=subprocess.check_output(['gh','auth','token'],text=True).strip()
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
try:
 import certifi
 context=ssl.create_default_context(cafile=certifi.where())
except ImportError:context=ssl.create_default_context()
opener=urllib.request.build_opener(Redirect(),urllib.request.HTTPSHandler(context=context))
try:opener.open(urllib.request.Request(item['archive_download_url'],headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}),timeout=30);raise SystemExit('预期取得临时下载重定向')
except urllib.error.HTTPError as e:
 if e.code!=302:raise SystemExit(f'GitHub 附件访问返回 {e.code}')
 location=e.headers['Location']
if not location.startswith('https://') or any(c in location for c in '\n\r"'):raise SystemExit('下载地址无效')
del token
command=f'curl --silent --show-error --fail --location --retry 2 --max-time 1200 --output {shlex.quote(a.out)} --config - && sha256sum {shlex.quote(a.out)}'
result=subprocess.run(['ssh','-o','BatchMode=yes',a.host,command],input=f'url = "{location}"\n',text=True,capture_output=True)
if result.returncode:raise SystemExit(re.sub(r'https://\S+','[临时下载地址]',result.stderr))
actual=result.stdout.split()[0];expected=item.get('digest','').removeprefix('sha256:')
if expected and actual!=expected:raise SystemExit('附件校验值与GitHub记录不同，禁止使用')
print(json.dumps({'run':a.run,'artifact':a.artifact,'zipBytes':item['size_in_bytes'],'serverPath':a.out,'sha256':actual,'matchesGitHubDigest':bool(expected)},ensure_ascii=False))
