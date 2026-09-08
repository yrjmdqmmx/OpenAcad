import {chromium} from '/Users/a1-6/Documents/ChatGPT/OpenAcad/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const root=new URL('.',import.meta.url).pathname,out=root+'legacy';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1000}}),rows=[];
page.setDefaultTimeout(60000);
const version=await(await page.request.get('https://openacad.xyz/version.json')).json();
if(version.revision!=='b04a48cb71e8e14417e6027651d2c8c286c74cfc')throw new Error('Unexpected deployed revision');
for(const id of ['scatter','bar-grouped','volcano','tree-circle']){
 const original=JSON.parse(await fs.readFile(root+'../../before/'+id+'.openacad.json','utf8'));
 if(original.style.publicationVersion)throw new Error('Expected a real previous project');
 let current=original;
 for(let round=0;round<2;round++){
  await page.goto('https://openacad.xyz/#catalog');
  await page.locator('input[type=file]').first().setInputFiles({name:id+'.openacad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(current))});
  await page.locator('.figure-paper > svg[data-chart]').waitFor();await page.evaluate(()=>document.fonts.ready);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
  current=JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));
  for(const key of ['dataset','style','layers','layout','analysis'])if(JSON.stringify(current[key])!==JSON.stringify(original[key]))throw new Error(id+': changed '+key);
 }
 await page.locator('.figure-paper > svg[data-chart]').screenshot({path:out+'/'+id+'.png'});
 await fs.writeFile(out+'/'+id+'.openacad.json',JSON.stringify(current,null,2));rows.push({id,saveAndReopenRounds:2,fiveFieldsIdentical:true,originalStylesPreserved:true});
}
await fs.writeFile(out+'/report.json',JSON.stringify({version,rows},null,2));await browser.close();console.log(JSON.stringify(rows));
