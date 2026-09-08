import {chromium} from '/Users/a1-6/Documents/ChatGPT/OpenAcad/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('.',import.meta.url).pathname,out=root+'serif';await fs.mkdir(out,{recursive:true});
async function walk(dir){let files=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;files.push(...entry.isDirectory()?await walk(path):[path]);}return files;}
const originals=(await walk(root+'browser-artifacts')).filter(f=>/\/(chromium|mobile)-chinese-serif\.(svg|png|pdf|eps)$/.test(f));
if(originals.length!==8)throw new Error('Expected eight actual desktop/mobile downloads');
const rows=[],browser=await chromium.launch(),page=await browser.newPage({offline:true,viewport:{width:1300,height:1000}});
for(const source of originals){
 const name=source.split('/').at(-1),file=out+'/'+name,data=await fs.readFile(source);await fs.writeFile(file,data);
 const row={source,file:name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
 if(name.endsWith('.svg')){
  if(/<text\b/.test(data.toString()))throw new Error('Outlined SVG still has text');
  await page.goto('file://'+file);const svg=page.locator('svg').first();
  row.dimensions=await svg.evaluate(e=>[e.width.baseVal.value,e.height.baseVal.value]);
  await svg.screenshot({path:file+'.png'});row.outlined=true;row.independentOpen=true;
 }
 rows.push(row);
}
await browser.close();await fs.writeFile(out+'/manifest.json',JSON.stringify(rows,null,2));console.log('Eight original serif downloads copied and two outlined SVGs opened offline.');
