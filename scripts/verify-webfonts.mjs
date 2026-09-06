// Narrow real-Chrome font delivery check. Does not submit jobs or alter servers.
import { chromium } from '../web/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=path.join(root,'tests/artifacts/font-delivery');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'web/public/fonts/webfont-manifest.json'),'utf8'));
const browser=await chromium.launch({headless:true,...(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
const requests=[],errors=[];
page.on('request',r=>{if(/\/fonts\//.test(r.url()))requests.push({url:r.url(),at:Date.now()})});
page.on('pageerror',e=>errors.push(e.message));
await cdp.send('Network.enable');
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:160*1024,uploadThroughput:80*1024,connectionType:'cellular3g'});
const started=Date.now();
await page.goto((process.env.OPENACAD_BASE_URL||'http://127.0.0.1:5178')+'/#editor/bar',{timeout:90000});
await page.getByRole('textbox',{name:'标题',exact:true}).waitFor({timeout:90000});
const cases=[];
for(const family of ['Noto Sans SC','Noto Serif CJK SC']){
  await page.getByRole('combobox',{name:'字体',exact:true}).selectOption(family);
  for(const text of ['中文科研图表','𠮷']){
    const before=requests.length,at=Date.now();
    await page.getByRole('textbox',{name:'标题',exact:true}).fill(text);
    const loaded=await page.evaluate(async({family,text})=>{
      const found=await document.fonts.load(`400 20px "${family}"`,text);
      if(!found.length||!document.fonts.check(`400 20px "${family}"`,text))throw new Error('指定字形字体未就绪');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const node=Array.from(document.querySelectorAll('.figure-paper svg[data-chart] text')).find(n=>n.textContent===text);
      if(!node)throw new Error('实际SVG标题未更新');
      document.querySelectorAll('[data-font-proof]').forEach(n=>n.removeAttribute('data-font-proof'));
      node.setAttribute('data-font-proof','true');
      return {faces:found.length,fontFamily:getComputedStyle(node).fontFamily,check:true};
    },{family,text});
    const {root:doc}=await cdp.send('DOM.getDocument');
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.nodeId,selector:'[data-font-proof]'});
    const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
    if(!fonts.length||fonts.some(f=>!f.isCustomFont)||!fonts.some(f=>f.familyName.includes('Noto')))throw new Error('SVG 字形回退到系统字体');
    const requested=requests.slice(before).map(r=>r.url);
    cases.push({family,text,milliseconds:Date.now()-at,...loaded,platformFonts:fonts,requested});
  }
}
const requestedUrls=[...new Set(requests.map(r=>r.url))];
const shards=requestedUrls.map(url=>manifest.fonts.flatMap(f=>f.shards).find(s=>url.endsWith('/fonts/'+s.file))).filter(Boolean);
if(requestedUrls.some(url=>url.endsWith('.otf')))throw new Error('网页仍请求完整 OTF');
if(shards.length!==requestedUrls.length)throw new Error('字体请求不在固定子集清单');
const commonBytes=shards.filter(s=>!s.name.startsWith('rest-')).reduce((n,s)=>n+s.bytes,0);
const report={source:'same pinned OTFs, complete unicode-range WOFF2 delivery',browser:browser.version(),network:{latencyMS:80,downloadBytesPerSecond:160*1024,cacheDisabled:true},elapsedMilliseconds:Date.now()-started,cases,requestedShards:shards.map(({file,bytes,name})=>({file,bytes,name})),commonBytes,totalFontBytes:shards.reduce((n,s)=>n+s.bytes,0),fullOtfRequests:0,pageErrors:errors,passed:errors.length===0};
await page.screenshot({path:path.join(output,'rare-serif.png')});
await writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(errors.length)throw new Error(errors.join('\n'));
console.log(JSON.stringify({passed:report.passed,cases:cases.map(({family,text,milliseconds})=>({family,text,milliseconds})),commonBytes,totalFontBytes:report.totalFontBytes,requests:shards.length},null,2));
