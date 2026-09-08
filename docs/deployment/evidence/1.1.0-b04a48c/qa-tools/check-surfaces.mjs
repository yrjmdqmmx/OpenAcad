import {chromium} from '/Users/a1-6/Documents/ChatGPT/OpenAcad/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const target=process.env.OPENACAD_BASE_URL;if(target!=='https://openacad.xyz')throw new Error('Explicit production target required');
const root=new URL('.',import.meta.url).pathname,out=root+'surfaces';await fs.mkdir(out,{recursive:true});
const cases=JSON.parse(await fs.readFile(root+'before/manifest.json','utf8')),b=await chromium.launch(),p=await b.newPage({viewport:{width:1600,height:1000}}),report=[];
const canon=el=>{const c=el.cloneNode(true),map=new Map([...c.querySelectorAll('[id]')].map((e,i)=>[e.id,'figure-id-'+i]));let s=c.outerHTML;for(const [a,z]of map)s=s.split(a).join(z);return s;};
const hash=s=>createHash('sha256').update(s).digest('hex');
await p.goto(target+'/#catalog');await p.evaluate(()=>document.fonts.ready);
const cards={};
for(const t of cases){const el=p.locator(`.template-preview[href="#template/${t.id}"] svg[data-chart]`).first();await el.scrollIntoViewIfNeeded();cards[t.id]=await el.evaluate(canon);await el.screenshot({path:out+'/'+t.id+'-card.png'});}
await p.locator('.catalog-intro').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/catalog.png'});
for(const t of cases){
 await p.goto(target+'/#template/'+t.id);await p.evaluate(()=>document.fonts.ready);
 const detail=await p.locator('.detail-figure-scroll > svg[data-chart]').evaluate(canon);
 await p.getByRole('button',{name:'用示例开始',exact:true}).click();await p.evaluate(()=>document.fonts.ready);
 const work=await p.locator('.figure-paper > svg[data-chart]').evaluate(canon);
 await p.screenshot({path:out+'/'+t.id+'-workbench.png'});
 const row={id:t.id,card:hash(cards[t.id]),detail:hash(detail),workbench:hash(work),identical:cards[t.id]===detail&&detail===work};report.push(row);
 if(!row.identical){for(const [k,s]of [['card',cards[t.id]],['detail',detail],['workbench',work]])await fs.writeFile(out+'/'+t.id+'-'+k+'.svg',s);}
}
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(report.filter(r=>!r.identical));console.log('identical',report.filter(r=>r.identical).length,'of',report.length);await b.close();

if(report.some(r=>!r.identical)||report.length!==55)process.exitCode=1;
