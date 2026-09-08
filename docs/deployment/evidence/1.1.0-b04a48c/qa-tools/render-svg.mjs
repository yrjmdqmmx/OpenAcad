import {chromium} from '/Users/a1-6/Documents/ChatGPT/OpenAcad/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const root=new URL('.',import.meta.url).pathname, reports=JSON.parse(await fs.readFile(root+'exports/report.json','utf8')).filter(r=>!process.env.ONLY||process.env.ONLY.split(',').includes(r.id));
await fs.mkdir(root+'export-renders',{recursive:true});
const b=await chromium.launch(),p=await b.newPage({offline:true}),opened=[];
for(const row of reports){
 const d=row.checks[0];await p.setViewportSize({width:Math.ceil(+d.width)+24,height:Math.ceil(+d.height)+24});
 await p.goto('file://'+root+'exports/'+row.id+'.svg');await p.evaluate(()=>document.fonts.ready);
 const fontCount=await p.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').length);
 if(!fontCount)throw new Error(row.id+': embedded fonts did not load offline');
 await p.locator('svg').first().screenshot({path:root+'export-renders/'+row.id+'-svg.png'});
 opened.push({id:row.id,offline:true,embeddedFontsLoaded:fontCount});
}
await fs.writeFile(root+'export-renders/svg-independent-open.json',JSON.stringify(opened,null,2));
await b.close();console.log(reports.length+' standalone SVGs reopened offline and rasterized with their embedded fonts.');
