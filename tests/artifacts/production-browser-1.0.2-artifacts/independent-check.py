#!/usr/bin/env python3
"""Reopen frozen browser downloads locally. Never submits jobs or writes source files."""
from pathlib import Path
import argparse, ast, binascii, datetime, hashlib, json, re, struct, subprocess, sys, types, unicodedata, zlib
parser=argparse.ArgumentParser()
parser.add_argument('artifacts',type=Path)
parser.add_argument('--repo',type=Path,required=True)
parser.add_argument('--source-revision',required=True)
args=parser.parse_args(); root=args.repo.resolve(); out=args.artifacts.resolve()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def require(condition,message):
    if not condition: raise AssertionError(message)
def run(command):
    result=subprocess.run(command,capture_output=True,text=True,timeout=90)
    require(result.returncode==0,f'{command[0]} failed: {result.stderr}')
    return result.stdout
checker=root/'server/scripts/production_smoke.py'
function=next(node for node in ast.parse(checker.read_text()).body if isinstance(node,ast.FunctionDef) and node.name=='png_check')
exec(compile(ast.Module(body=[function],type_ignores=[]),str(checker),'exec'),globals())
smoke=types.SimpleNamespace(png_check=png_check)
manifest_path=out/'manifest.json'; manifest=json.loads(manifest_path.read_text())
require(manifest['sourceRevision']==args.source_revision,'Browser evidence source revision is not the expected new release')
expected=[f'live-exports/{device}-chinese-serif.{fmt}' for device in ['chromium','mobile'] for fmt in ['svg','png','pdf','eps']]
listed={row['path']:row for row in manifest['files']}
for name in expected:
    require(name in listed,'Download absent from this run manifest: '+name)
    require((out/name).is_file(),'Download absent: '+name)
    require(sha(out/name)==listed[name]['sha256'],'Download SHA mismatch: '+name)
    require((out/name).stat().st_size==listed[name]['bytes'],'Download byte length mismatch: '+name)
original={name:sha(out/name) for name in expected}
preview=out/'independent-previews'; preview.mkdir(exist_ok=True)
svg_script=out/'independent-svg-open.mjs'
svg_script.write_text('''import { createRequire } from "node:module";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
const [repo,out]=process.argv.slice(2), req=createRequire(repo+"/web/package.json"), {chromium}=req("@playwright/test");
const browser=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
const report={version:browser.version(),files:[]};
try { for(const device of ["chromium","mobile"]) {
const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:1});
const page=await context.newPage(), errors=[],requests=[];
page.on("pageerror", e=>errors.push(e.message));
await page.route(/https?:/,route=>{requests.push(route.request().url());return route.abort();});
const source=`live-exports/${device}-chinese-serif.svg`,preview=`independent-previews/${device}-chinese-serif-svg.png`;
await page.goto(pathToFileURL(out+"/"+source).href,{waitUntil:"load"});
const structure=await page.locator("svg").first().evaluate(el=>({width:el.width.baseVal.value,height:el.height.baseVal.value,viewBox:el.getAttribute("viewBox"),textElements:el.querySelectorAll("text").length,paths:el.querySelectorAll("path").length,embeddedImages:el.querySelectorAll("image").length,label:el.getAttribute("aria-label")}));
await page.screenshot({path:out+"/"+preview});
report.files.push({source,preview,...structure,pageErrors:errors,externalRequests:requests.length});
await context.close();
}} finally {await browser.close();}
await fs.writeFile(out+"/independent-previews/svg-open.json",JSON.stringify(report,null,2)+"\\n");
''')
run(['node',str(svg_script),str(root),str(out)])
svg_results=json.loads((preview/'svg-open.json').read_text()); svg_by_path={row['source']:row for row in svg_results['files']}
report={'schemaVersion':2,'status':'running','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':args.source_revision,'sourceManifestSha256':sha(manifest_path),'baseUrl':manifest['baseUrl'],'scope':'8 actual desktop/mobile browser downloads; local reopening only; no server jobs','tools':{'chrome':svg_results['version'],'poppler':subprocess.run(['pdftoppm','-v'],capture_output=True,text=True).stderr.splitlines()[0],'ghostscript':run(['gs','--version']).strip(),'python':sys.version.split()[0],'pngValidation':'production_smoke.py png_check: signature, all chunk CRC, zlib/filter pixel decoding, white-composited ink bounds','pngCheckerSha256':sha(root/'server/scripts/production_smoke.py')},'cases':[]}
title='中文导出检验：处理组浓度'
for name in expected:
    path=out/name; fmt=path.suffix[1:]; row={'file':name,'format':fmt,'device':'mobile' if path.name.startswith('mobile') else 'desktop','bytes':path.stat().st_size,'sha256':sha(path),'sourceManifestSha256Matches':True,'passed':False}
    try:
        raster=path if fmt=='png' else preview/(path.stem+'-'+fmt+'.png')
        if fmt=='svg':
            structure=svg_by_path[name]; row.update(structure=structure,decoder='Google Chrome',textMode='all text outlined to SVG paths; no font dependency')
            require(structure['width']==960 and structure['height']==640,'Unexpected SVG dimensions')
            require(structure['viewBox']=='0 0 960 640','Unexpected SVG viewBox')
            require(structure['textElements']==0 and structure['paths']>0,'Outlined SVG unexpectedly retains text or lacks paths')
            require(structure['label']==title,'SVG accessible title mismatch')
            require(not structure['pageErrors'] and structure['externalRequests']==0,'SVG local opening encountered errors or external dependencies')
        elif fmt=='pdf':
            require(path.read_bytes().startswith(b'%PDF-'),'PDF signature mismatch')
            info=run(['pdfinfo',str(path)]); fonts=run(['pdffonts',str(path)]); text=run(['pdftotext',str(path),'-'])
            pages=int(re.search(r'^Pages:\s+(\d+)',info,re.M)[1]); dimensions=list(map(float,re.search(r'^Page size:\s+([\d.]+) x ([\d.]+)',info,re.M).groups()))
            rows=[line.split() for line in fonts.splitlines()[2:] if line.strip()]
            require(pages==1 and dimensions==[720,480],'Unexpected PDF dimensions/page count')
            require(rows and all(line[-5]=='yes' for line in rows),'PDF contains unembedded fonts')
            require('NotoSerifCJKsc-Bold' in fonts,'PDF title lacks actual Noto Serif CJK SC Bold resource')
            require('NotoSerifCJKsc-Regular' in fonts,'PDF lacks actual Noto Serif CJK SC Regular resource')
            require('CairoFont' not in fonts,'Normal-style PDF unexpectedly uses synthetic Cairo font')
            exact=title in text; normalized=unicodedata.normalize('NFKC',title) in unicodedata.normalize('NFKC',text)
            require(normalized,'PDF extracted Chinese title unavailable even after NFKC on both values')
            row.update(decoder='Poppler',pages=pages,pagePoints=dimensions,fontInspection=fonts,allFontsEmbedded=True,actualBoldResourcePresent=True,syntheticCairoFontPresent=False,expectedTitleMatchesExactUnicode=exact,expectedTitleMatchesAfterNFKC=normalized,textMode='embedded actual Regular and Bold font text')
            if not exact: row['unicodeLimitation']='Text extraction exposes compatibility code points; Unicode NFKC on expected and actual values matches the intended title.'
            run(['pdftoppm','-f','1','-singlefile','-r','96','-png',str(path),str(raster.with_suffix(''))])
        elif fmt=='eps':
            raw=path.read_text(errors='replace'); require(raw.startswith('%!PS-Adobe'),'EPS signature mismatch')
            bbox=list(map(int,re.search(r'^%%BoundingBox:\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)',raw,re.M).groups()))
            dimensions=[bbox[2]-bbox[0],bbox[3]-bbox[1]]; require(dimensions==[720,480],'Unexpected EPS dimensions')
            operators=len(re.findall(r'^\s*cairo_image\s*$',raw,re.M))
            row.update(decoder='Ghostscript',boundingBoxPoints=bbox,pagePoints=dimensions,imageOperators=operators,textMode='raster composite embedded in EPS' if operators else 'PostScript graphics')
            if operators: row['rasterLimitation']='EPS contains a Cairo raster composite; visual appearance is retained but pure-vector or text editability cannot be claimed.'
            run(['gs','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pngalpha','-r96','-dEPSCrop','-sOutputFile='+str(raster),str(path)])
        else: row.update(decoder='PNG CRC/zlib/filter pixel decoder',textMode='raster pixels; font identity cannot be recovered from PNG alone')
        pixels=smoke.png_check(raster); expected_size=(1500,1000) if fmt=='png' else (960,640)
        require((pixels['width'],pixels['height'])==expected_size,'Unexpected decoded image dimensions')
        row.update(preview=str(raster.relative_to(out)),pixels=pixels,previewSha256=sha(raster),passed=True)
    except Exception as error: row['error']=str(error)
    report['cases'].append(row)
report['originalFilesUnmodified']=all(sha(out/name)==value for name,value in original.items())
report['desktopMobilePreviewComparisons']=[{'format':fmt,'samePixelPreviewSha256':len({row.get('previewSha256') for row in report['cases'] if row['format']==fmt})==1} for fmt in ['svg','png','pdf','eps']]
report['machineChecksPassed']=sum(row['passed'] for row in report['cases']); report['visualReview']='pending manual visual inspection'
report['status']='machine-checks-passed-awaiting-visual-review' if report['machineChecksPassed']==8 and report['originalFilesUnmodified'] else 'failed'
(out/'independent-export-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'cases':len(report['cases']),'passed':report['machineChecksPassed'],'unchanged':report['originalFilesUnmodified'],'failures':[row for row in report['cases'] if not row['passed']]},ensure_ascii=False,indent=2))
raise SystemExit(0 if report['machineChecksPassed']==8 and report['originalFilesUnmodified'] else 1)
