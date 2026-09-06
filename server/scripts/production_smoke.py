#!/usr/bin/env python3
"""Verify an OpenAcad deployment using only deterministic simulated data.

Does not change infrastructure, DNS, or other users' tasks. Creates five small
anonymous test jobs, saves their public results locally, then deletes those jobs.
Python standard library only; independent PDF/EPS opening uses Poppler and gs.
"""
import argparse
import base64
import binascii
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class Api:
    def __init__(self, base, timeout):
        parsed = urllib.parse.urlsplit(base)
        require(parsed.scheme in ('http', 'https') and parsed.netloc and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment, 'base URL 必须是无凭据的 HTTP(S) 网站地址')
        self.base, self.timeout = base.rstrip('/'), timeout

    def request(self, path, payload=None, token=None, method=None, raw=False):
        headers = {'Content-Type':'application/json', 'User-Agent':'OpenAcad-production-smoke/1'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
        req = urllib.request.Request(self.base+path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                status, content = response.status, response.read(25_000_001)
        except urllib.error.HTTPError as error:
            status, content = error.code, error.read(1_000_000)
        require(len(content)<=25_000_000, '响应超过验收脚本大小上限')
        return status, content if raw else json.loads(content)

    def job(self, payload):
        status, task = self.request('/api/jobs', payload)
        require(status==202 and isinstance(task.get('token'),str), f'新建模拟任务失败，HTTP {status}')
        path, token = '/api/jobs/'+task['id'], task['token']
        try:
            require(self.request(path)[0]==404, '无访问凭据时仍可查询任务')
            require(self.request(path, token='invalid-smoke-token')[0]==404, '错误访问凭据时仍可查询任务')
            deadline = time.monotonic()+self.timeout
            while time.monotonic()<deadline:
                status, state = self.request(path, token=token)
                require(status==200, f'查询模拟任务失败，HTTP {status}')
                if state['status']=='failed':
                    raise RuntimeError('模拟任务失败：'+json.dumps(state.get('error'),ensure_ascii=False))
                if state['status']=='finished':
                    return state['result']
                time.sleep(.4)
            raise RuntimeError('模拟任务等待超时')
        finally:
            require(self.request(path,token=token,method='DELETE')[0]==200, '模拟任务清理失败')
            require(self.request(path,token=token)[0]==404, '清理后任务凭据未失效')


def check_pca(result, rows):
    data = result['data']; scores, loadings = data['scores'], data['loadings']
    require(len(scores)==len(rows) and len(loadings)==3 and len(scores[0])==3, 'PCA 得分/载荷矩阵尺寸错误')
    error = max(abs(sum(scores[i][k]*loadings[j][k] for k in range(3))+data['center'][j]-row[j+1]) for i,row in enumerate(rows) for j in range(3))
    require(error<1e-7, f'PCA 得分与载荷不能重构模拟数据，误差 {error}')
    require(abs(sum(data['explainedRatio'])-1)<1e-8, 'PCA 解释率之和错误')
    require(result['provenance'].get('packages'), 'PCA 缺少真实计算引擎版本')
    return {'reconstructionMaxAbsoluteError':error, 'explainedRatioSum':sum(data['explainedRatio'])}


def check_lm(result, rows):
    xs,ys = [r[1] for r in rows],[r[2] for r in rows]
    mx,my = sum(xs)/len(xs),sum(ys)/len(ys)
    slope = sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
    intercept = my-slope*mx
    series = result['data']['series'][0]; coef = series['model']['coefficients']
    require(abs(coef['x']-slope)<1e-10 and abs(coef['(Intercept)']-intercept)<1e-10, 'R LM 系数与独立最小二乘公式不符')
    require(len(series['curve'])==80, 'LM 预测曲线点数错误')
    for point in series['curve']:
        require(abs(point['y']-(intercept+slope*point['x']))<1e-9 and point['lower']<=point['y']<=point['upper'], 'LM 曲线或置信区间错误')
    require(result['provenance'].get('r') and result['provenance'].get('rPackages'), 'LM 缺少 R 及包版本')
    return {'referenceIntercept':intercept,'referenceSlope':slope,'coefficientTolerance':1e-10,'curvePoints':80}


def make_svg(pca, lm):
    def scale(values, low, high):
        a,b=min(values),max(values)
        return lambda value:low+(value-a)/(b-a)*(high-low)
    scores=pca['data']['scores']; series=lm['data']['series'][0]
    px=scale([x[0] for x in scores],70,425); py=scale([x[1] for x in scores],420,120)
    obs=series['observations']; curve=series['curve']
    lx=scale([x['x'] for x in obs],545,900); ly=scale([x['y'] for x in obs],420,120)
    nodes=['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">', '<rect width="960" height="560" fill="#ffffff"/>', '<g font-family="Noto Sans SC" fill="#162c3a">', '<text x="45" y="45" font-size="27">OpenAcad 线上验收（模拟数据）</text>', '<text x="65" y="90" font-size="22">主成分分析</text>', '<text x="540" y="90" font-family="Noto Serif CJK SC" font-size="22">线性回归与置信区间</text>', '<path d="M55 110V440H445 M530 110V440H920" fill="none" stroke="#4e6674"/>']
    nodes += [f'<circle cx="{px(x[0]):.5f}" cy="{py(x[1]):.5f}" r="5" fill="#168b98"/>' for x in scores]
    band=[(x['x'],x['lower']) for x in curve]+[(x['x'],x['upper']) for x in reversed(curve)]
    nodes.append('<polygon points="'+' '.join(f'{lx(x):.5f},{ly(y):.5f}' for x,y in band)+'" fill="#e39a36" opacity="0.22"/>')
    nodes.append('<polyline points="'+' '.join(f"{lx(x['x']):.5f},{ly(x['y']):.5f}" for x in curve)+'" fill="none" stroke="#cf772a" stroke-width="2.5"/>')
    nodes += [f'<circle cx="{lx(x["x"]):.5f}" cy="{ly(x["y"]):.5f}" r="4" fill="#21618c"/>' for x in obs]
    nodes += ['<text x="65" y="490" font-size="18">真实 PCA 得分与载荷 · 真实 R LM 计算</text>', '<text x="65" y="525" font-size="16">确定性模拟示例，无用户研究数据；仅检查本次部署。</text>', '</g></svg>']
    return ''.join(nodes)


def png_check(path):
    raw=path.read_bytes(); require(raw[:8]==b'\x89PNG\r\n\x1a\n','PNG 文件签名错误')
    position=8; compressed=bytearray(); header=None; ended=False
    while position<len(raw):
        size=struct.unpack('>I',raw[position:position+4])[0]; kind=raw[position+4:position+8]
        body=raw[position+8:position+8+size]; crc=raw[position+8+size:position+12+size]
        require(len(crc)==4 and binascii.crc32(kind+body)&0xffffffff==struct.unpack('>I',crc)[0], 'PNG 数据校验和错误')
        if kind==b'IHDR': header=struct.unpack('>IIBBBBB',body)
        elif kind==b'IDAT': compressed.extend(body)
        elif kind==b'IEND': ended=True
        position+=12+size
    require(header and ended,'PNG 结构不完整')
    width,height,depth,color,compression,filter_method,interlace=header
    require(depth==8 and color in (0,2,4,6) and interlace==0,'PNG 需要独立解码器检查此颜色/交错格式')
    channels={0:1,2:3,4:2,6:4}[color]; stride=width*channels
    pixels=zlib.decompress(compressed)
    require(len(pixels)==height*(stride+1),'PNG 像素数据长度错误')
    previous=bytearray(stride); bounds=[width,height,-1,-1]
    for y in range(height):
        offset=y*(stride+1); mode=pixels[offset]; row=bytearray(pixels[offset+1:offset+1+stride])
        require(mode in (0,1,2,3,4),'PNG 行过滤方式错误')
        if mode:
            for i in range(stride):
                a=row[i-channels] if i>=channels else 0; b=previous[i]; c=previous[i-channels] if i>=channels else 0
                if mode==1: pred=a
                elif mode==2: pred=b
                elif mode==3: pred=(a+b)//2
                else:
                    p=a+b-c; pa,pb,pc=abs(p-a),abs(p-b),abs(p-c); pred=a if pa<=pb and pa<=pc else b if pb<=pc else c
                row[i]=(row[i]+pred)&255
        for x in range(width):
            i=x*channels
            rgb=row[i:i+3] if color in (2,6) else [row[i]]*3
            alpha=row[i+channels-1] if color in (4,6) else 255
            if any((255-v)*alpha>8*255 for v in rgb):
                bounds=[min(bounds[0],x),min(bounds[1],y),max(bounds[2],x),max(bounds[3],y)]
        previous=row
    require(bounds[2]>=bounds[0], '解码后图像为空白')
    edge=bounds[0]<=0 or bounds[1]<=0 or bounds[2]>=width-1 or bounds[3]>=height-1
    require(not edge,'模拟图表触到输出页面边界，需检查裁切')
    return {'width':width,'height':height,'decoded':True,'inkBounds':bounds,'touchesPageEdge':edge}


def check_export(result, fmt, output, independent=True):
    artifact=result['artifact']; data=base64.b64decode(artifact['contentBase64'],validate=True)
    target=output/('analysis.'+fmt); target.write_bytes(data)
    require(hashlib.sha256(data).hexdigest()==result['provenance']['sha256'], '下载内容 SHA-256 不一致')
    validation={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    if fmt=='png':
        validation.update(png_check(target)); require((validation['width'],validation['height'])==(1500,875),'150 DPI PNG 像素尺寸错误')
    else:
        require(data.startswith(b'%PDF-' if fmt=='pdf' else b'%!PS-Adobe'),'图片格式与文件内容不一致')
        if independent:
            decoded=output/('decoded-'+fmt+'.png')
            command=['pdftoppm','-f','1','-singlefile','-r','96','-png',str(target),str(decoded.with_suffix(''))] if fmt=='pdf' else ['gs','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pngalpha','-r96','-dEPSCrop','-sOutputFile='+str(decoded),str(target)]
            process=subprocess.run(command,capture_output=True,timeout=60)
            require(process.returncode==0,f'{fmt.upper()} 独立解析器无法打开输出文件')
            validation.update(png_check(decoded)); validation['independentDecoder']='Poppler' if fmt=='pdf' else 'Ghostscript'
        else:
            validation['limitation']='仅格式与校验和检查，未独立打开，不能作为完整导出验收'
    if fmt=='eps': require(any(d['code']=='EPS_ALPHA_FLATTENED' for d in result['diagnostics']), 'EPS 透明置信带未明确报告栅格合成')
    if fmt=='pdf' and independent and shutil.which('pdffonts'):
        listing=subprocess.check_output(['pdffonts',str(target)],text=True,timeout=20)
        require('NotoSansCJKsc' in listing and 'NotoSerifCJKsc' in listing,'PDF 缺少黑体或宋体')
        require(all(len(row.split())>=5 and row.split()[-5]=='yes' for row in listing.splitlines()[2:]),'PDF 字体没有嵌入')
        validation['fontInspection']=listing
    return validation


def main():
    parser=argparse.ArgumentParser(description='仅使用模拟数据验证 OpenAcad 线上 API/统计/导出，并保存本地结果。')
    parser.add_argument('base_url',help='例如 https://openacad.xyz')
    parser.add_argument('--output',type=Path,required=True,help='本地验收结果目录')
    parser.add_argument('--min-workers',type=int,default=2,help='生产默认需要2个近期活跃worker；单worker本地验收可设1')
    parser.add_argument('--timeout',type=int,default=180,help='每个任务的最大等待秒数')
    parser.add_argument('--skip-independent-open',action='store_true',help='跳过Poppler/Ghostscript；报告标为部分验证')
    args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    report={'schemaVersion':1,'baseUrl':args.base_url,'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'dataSource':'本脚本确定性生成的模拟数据','cases':[],'complete':False}
    try:
        if not args.skip_independent_open:
            require(all(shutil.which(name) for name in ['pdftoppm','gs']), '完整导出验收需要本机 Poppler(pdftoppm) 和 Ghostscript(gs)，或显式选择 --skip-independent-open 进行部分验证')
        api=Api(args.base_url,args.timeout)
        status,page=api.request('/',raw=True);require(status==200 and b'OpenAcad' in page,'网站首页不可访问或标题不符')
        status,health=api.request('/api/health');require(status==200 and health['status']=='ok' and health['workers']>=args.min_workers,'API/worker 健康状态不符')
        report['health']=health
        pca_rows=[[f'模拟样本{i+1}',float(i),2*i+3+.2*math.sin(i),(i%4)*.8+.3*math.cos(i)] for i in range(12)]
        lm_rows=[[f'模拟样本{i+1}',float(i),1.5*i+4+.25*math.sin(i)] for i in range(12)]
        results={}
        for method,rows,columns in [('pca',pca_rows,['样本','长度','宽度','质量']),('lm',lm_rows,['样本','x','y'])]:
            payload={'kind':'analysis','method':method,'data':{'tables':[{'id':'simulated-'+method,'role':'matrix','columns':columns,'rows':rows}]},'params':{'seed':41,**({'points':80} if method=='lm' else {})}}
            (args.output/(method+'-request.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
            result=api.job(payload);results[method]=result
            validation=check_pca(result,rows) if method=='pca' else check_lm(result,rows)
            (args.output/(method+'-result.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
            report['cases'].append({'case':method,'passed':True,'validation':validation,'provenance':result['provenance']});print(method+' 真实计算与独立数值校验通过',flush=True)
        svg=make_svg(results['pca'],results['lm']);(args.output/'analysis-source.svg').write_text(svg)
        for fmt in ['png','pdf','eps']:
            result=api.job({'kind':'export','method':'render','data':{'svg':svg},'params':{'format':fmt,'dpi':150,'outline':False,'filename':'模拟验收'}})
            validation=check_export(result,fmt,args.output,not args.skip_independent_open)
            metadata={k:v for k,v in result.items() if k!='artifact'}
            (args.output/(fmt+'-metadata.json')).write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
            report['cases'].append({'case':fmt,'passed':True,'validation':validation,'provenance':result['provenance'],'diagnostics':result['diagnostics']});print(fmt.upper()+' 导出校验通过',flush=True)
        report['complete']=not args.skip_independent_open
        report['status']='passed' if report['complete'] else 'partial'
        print('完整验收通过' if report['complete'] else '部分验收通过：PDF/EPS尚未独立打开',flush=True)
    except Exception as error:
        report['status']='failed';report['error']=str(error);print('验收失败：'+str(error),file=sys.stderr)
    finally:
        (args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return 0 if report['status'] in ('passed','partial') else 1


if __name__=='__main__':
    raise SystemExit(main())
