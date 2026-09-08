import {chromium} from '/Users/a1-6/Documents/ChatGPT/OpenAcad/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const base='/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/release/production';
const target=process.env.OPENACAD_BASE_URL,expected=process.env.EXPECTED_REVISION;
if(target!=='https://openacad.xyz'||!expected?.match(/^[0-9a-f]{40}$/))throw new Error('Explicit production URL and immutable revision required');
const mode=process.argv[2]||'stress',out=base+'/'+mode;await fs.mkdir(out,{recursive:true});
const all=JSON.parse(await fs.readFile(base+'/before/manifest.json','utf8')).filter(t=>!process.env.ONLY||process.env.ONLY.split(',').includes(t.id));
const browser=await chromium.launch();const context=await browser.newContext();const results=[];
const version=await(await context.request.get(target+'/version.json?qa='+Date.now())).json();if(version.revision!==expected)throw new Error('Production revision mismatch');await fs.writeFile(base+'/source.json',JSON.stringify({target,expected,version,startedAt:new Date().toISOString()},null,2));
async function save(page){const promise=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
async function load(page,p){await page.goto(target+'/#catalog');await page.locator('input[type=file]').first().setInputFiles({name:p.templateId+'.openacad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.locator('.figure-paper').waitFor();}
const svg=page=>page.locator('.figure-paper svg[data-chart]').first();
async function measure(page){return svg(page).evaluate(el=>{const b=el.getBoundingClientRect();return {width:el.getAttribute('width'),height:el.getAttribute('height'),invalid:/NaN|Infinity/.test(el.innerHTML),texts:el.querySelectorAll('text').length,overflow:[...el.querySelectorAll('text')].filter(e=>!e.closest('defs')).flatMap(e=>{const r=e.getBoundingClientRect();return r.width&& (r.x<b.x-2||r.right>b.right+2||r.y<b.y-2||r.bottom>b.bottom+2)?[{text:e.textContent,x:Math.round(r.x-b.x),y:Math.round(r.y-b.y)}]:[]})};});}
function longVariant(p){p=structuredClone(p);p.layout={};const id=p.templateId;
 if(id==='scatter') {p.style.xTitle='长期处理后的叶片氮含量 (mg/g)';p.style.yTitle='叶片单位面积净光合速率 (μmol/m²/s)';}
 if(id==='upset') for(const t of p.dataset.tables) if(t.columns.includes('集合')) t.rows.forEach(r=>r[t.columns.indexOf('集合')]='长期处理_'+r[t.columns.indexOf('集合')]);
 if(['pca','pcoa','nmds','cca','rda'].includes(id)){p.layout.sampleAnnotations=Object.fromEntries(p.dataset.tables[0].rows.map((r,i)=>[String(r[0]),{label:'长期处理 '+r[0]+' 样本',group:'处理组 '+(i%5+1)}]));return p;}
 if(id.startsWith('tree-')) {const groupTable=p.layers.find(l=>l.type==='tree:label-background').data.tables[0];const gi=groupTable.columns.indexOf('分类'),ci=groupTable.columns.indexOf('颜色');groupTable.rows.slice(0,3).forEach(r=>{r[gi]='新增生境';if(ci>=0)r[ci]='#b39345';});const labels=p.layers.find(l=>l.type==='tree:label-background').data.tables[0].rows.map(r=>r[0]);p.layers.push({id:'qa-rename',type:'tree:rename',name:'长标签验收',visible:true,data:{tables:[{id:'qa-rename',name:'长名称',role:'data',columns:['nodeID','文字'],rows:labels.map((n,i)=>[n,'长期处理样本_'+n+'_'+(i+1)])}]},settings:{}});p.style.labelWidth=220;return p;}
 const table=p.dataset.tables.find(t=>['data','matrix','correlation','genes','sequences','nodes','items','sets','chromosomes','enrichment','locations','links'].includes(t.role))||p.dataset.tables[0];
 if(!table)return p;
 const names=new Set();
 if(['matrix','correlation'].includes(table.role)) {table.rows.forEach(r=>names.add(String(r[0])));table.columns.slice(1).forEach(c=>names.add(c));}
 else if(table.role==='sets') table.columns.forEach(c=>names.add(c));
 else {const col=id==='network'?table.columns.indexOf('label'):table.columns.findIndex(c=>['类别','名称','name','id','cluster','source','Description'].includes(c));if(col>=0)table.rows.forEach(r=>{if(!Number.isFinite(Number(r[col])))names.add(String(r[col]));});}
 const renamed=new Map([...names].map(n=>[n,'长期处理_'+n]));
 for(const t of p.dataset.tables){t.columns=t.columns.map(c=>renamed.get(c)||c);t.rows=t.rows.map(r=>r.map(v=>typeof v==='string'?(renamed.get(v)||v):v));}
 for(const l of p.layers)for(const t of l.data?.tables||[])t.rows=t.rows.map(r=>r.map(v=>typeof v==='string'?(renamed.get(v)||v):v));
 const gi=table.columns.findIndex(c=>['分组','group'].includes(c));if(gi>=0){const gs=[...new Set(table.rows.map(r=>r[gi]))];table.rows.forEach(r=>r[gi]='分组 '+(gs.indexOf(r[gi])+1));if(gs.length&&table.role==='data'&&gi>0){const original=structuredClone(table.rows.filter(r=>r[gi]==='分组 1'));table.rows.push(...original.map(r=>{r[gi]='分组 '+(gs.length+1);if(table.columns[0]==='名称')r[0]+='_额外';if(typeof r[1]==='number')r[1]=Number(r[1])*.8;return r;}));}}
 return p;
}
async function work(t){const page=await context.newPage();await page.setViewportSize({width:1600,height:1000});page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(45000);const row={id:t.id,checks:[],errors:[]};page.on('pageerror',e=>row.errors.push(e.message));
 try{
  await page.goto(target+'/#template/'+t.id);await page.getByRole('button',{name:'用示例开始',exact:true}).click();await svg(page).waitFor();await page.evaluate(()=>document.fonts.ready);const p=await save(page);const accepted=JSON.parse(await fs.readFile('/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/exports/'+t.id+'.openacad.json','utf8'));for(const key of ['style','dataset','layers'])if(JSON.stringify(p[key])!==JSON.stringify(accepted[key]))throw new Error('Released default differs from accepted '+key);await fs.writeFile(out+'/'+t.id+'.openacad.json',JSON.stringify(p,null,2));await svg(page).screenshot({path:out+'/'+t.id+'-default.png'});row.checks.push({variant:'default',...await measure(page)});
  if(mode==='exports'){
   for(const format of (process.env.FORMATS||'svg,png,pdf,eps').split(',')){
    await page.getByRole('button',{name:'导出图片',exact:true}).click();await page.getByRole('combobox',{name:'图片格式',exact:true}).selectOption(format);if(format==='png')await page.getByRole('combobox',{name:'分辨率',exact:true}).selectOption('150');
    const event=page.waitForEvent('download',{timeout:110000});await page.getByRole('button',{name:'下载图片',exact:true}).click();const d=await event;await d.saveAs(out+'/'+t.id+'.'+format);row.checks.push({format,bytes:(await fs.stat(out+'/'+t.id+'.'+format)).size});await page.getByRole('button',{name:'关闭',exact:true}).click();
   }
  }
  {
   if(t.id.startsWith('tree-')) {await page.getByText('树文件与文本',{exact:true}).click();await page.getByRole('textbox',{name:'树文本',exact:true}).fill(p.dataset.text.replace(/:[0-9.]+/g,m=>':'+(Number(m.slice(1))*1.4).toFixed(3)));await page.getByRole('button',{name:'应用树文本',exact:true}).click();} else await page.getByRole('button',{name:'试用另一组数据',exact:true}).click();
   if(['pca','pcoa','nmds','cca','rda'].includes(t.id)) {await page.locator('.panel-tabs').getByRole('button',{name:'分析',exact:true}).click();await page.getByRole('button',{name:'开始计算',exact:true}).click();await page.locator('.analysis-panel [role=status]').filter({hasText:'计算完成'}).waitFor({timeout:90000});}
   if(await svg(page).count()){await page.evaluate(()=>document.fonts.ready);await svg(page).screenshot({path:out+'/'+t.id+'-alternate.png'});row.checks.push({variant:'alternate',...await measure(page)});const a=await save(page);row.alternateChanges=JSON.stringify(a.dataset)!==JSON.stringify(p.dataset);}
   else row.errors.push('alternate: '+(await page.locator('.figure-paper').innerText()));
   if(process.env.STRESS_VARIANTS==='1') for(const [name,v] of [['small',{...structuredClone(p),style:{...p.style,width:640,height:t.id==='genome-circos'?700:480}}],['wide',{...structuredClone(p),style:{...p.style,width:1300,height:650}}],['long-groups',longVariant(p)]]){
    await load(page,v);if(!await svg(page).count()){row.errors.push(name+': '+(await page.locator('.figure-paper').innerText()));continue;}
    await page.evaluate(()=>document.fonts.ready);await svg(page).screenshot({path:out+'/'+t.id+'-'+name+'.png'});row.checks.push({variant:name,...await measure(page)});
    const back=await save(page);for(const k of ['dataset','style','layers','layout','analysis'])if(JSON.stringify(back[k])!==JSON.stringify(v[k]))row.errors.push(name+' changed '+k);
   }
  }
  await load(page,p);const reopened=await save(page);row.roundtrip=['dataset','style','layers','layout','analysis'].every(k=>JSON.stringify(p[k])===JSON.stringify(reopened[k]));
 }catch(e){row.errors.push(String(e));}finally{await page.close();results.push(row);await fs.writeFile(out+'/'+(process.env.REPORT||(process.env.ONLY?'report-recheck.json':'report.json')),JSON.stringify(results,null,2));console.log(t.id,JSON.stringify({errors:row.errors,overflow:row.checks.filter(v=>v.overflow?.length).map(v=>[v.variant,v.overflow.length])}));}
}
let cursor=0;await Promise.all(Array.from({length:2},async()=>{while(cursor<all.length)await work(all[cursor++]);}));await browser.close();

if(results.some(r=>r.errors.length||!r.roundtrip||!r.alternateChanges||r.checks.some(c=>c.invalid||c.overflow?.length)))process.exitCode=1;
