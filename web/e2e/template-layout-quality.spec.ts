import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function start(page:Page,id:string){await page.goto(`/#template/${id}`);await page.getByRole('button',{name:'用示例开始',exact:true}).click();await page.evaluate(()=>document.fonts.ready);}
async function save(page:Page){const event=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();return readFile((await (await event).path())!);}
async function reopen(page:Page,buffer:Buffer){await page.goto('/#catalog');await page.locator('input[type=file]').first().setInputFiles({name:'layout.openacad.json',mimeType:'application/json',buffer});await expect(page.locator('.figure-paper svg[data-chart]').first()).toBeVisible();}
for(const id of ['pca','nmds']) test(`${id} 标签避让、手动调整与保存重开`,async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,id);
 const labels=page.locator('.figure-paper svg [data-label-id]');
 const boxes=await labels.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height}}));
 const overlaps=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)overlaps.push([a.label,b.label]);}
 expect(overlaps).toEqual([]);
 const label=labels.first(), before=await label.getAttribute('x'),box=await label.boundingBox();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+40,box!.y+box!.height/2+30,{steps:8});await page.mouse.up();
 await expect(label).not.toHaveAttribute('x',before!);
 const buffer=await save(page),project=JSON.parse(buffer.toString());expect(Object.keys(project.layout.labels).length).toBeGreaterThan(0);
 const after=await label.getAttribute('x');await reopen(page,buffer);await expect(labels.first()).toHaveAttribute('x',after!);
});
for(const id of ['tree-normal','tree-circle','tree-unrooted']) test(`${id} 自动适配、100%顶边可达与注释保存`,async({page},info)=>{
 test.skip(info.project.name!=='chromium');await page.setViewportSize({width:1710,height:838});await start(page,id);
 const fit=async()=>{const state=await page.locator('.figure-paper').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement!.getBoundingClientRect();return {top:r.top,parentTop:p.top,bottom:r.bottom,parentBottom:p.bottom,left:r.left,parentLeft:p.left,right:r.right,parentRight:p.right};});expect(state.top).toBeGreaterThanOrEqual(state.parentTop);expect(state.bottom).toBeLessThanOrEqual(state.parentBottom+1);expect(state.left).toBeGreaterThanOrEqual(state.parentLeft);expect(state.right).toBeLessThanOrEqual(state.parentRight+1);};
 await fit();await page.getByRole('button',{name:/^\d+%$/}).click();
 await expect(page.getByRole('button',{name:'100%',exact:true})).toBeVisible();
 const top=await page.locator('.figure-paper').evaluate(el=>el.getBoundingClientRect().top-el.parentElement!.getBoundingClientRect().top);expect(top).toBeGreaterThanOrEqual(0);
 await page.getByRole('button',{name:'适应窗口',exact:true}).click();await fit();
 const countBefore=JSON.parse((await save(page)).toString()).layers.length;
 await page.getByRole('combobox',{name:'树注释类型',exact:true}).selectOption('label-color');
 await page.getByRole('button',{name:'添加可试用的图层',exact:true}).click();await fit();
 const buffer=await save(page);expect(JSON.parse(buffer.toString()).layers).toHaveLength(countBefore+1);await reopen(page,buffer);await fit();
});
test('误差图切换区间后，显示的原始观测均留在画布内',async({page},info)=>{
 test.skip(info.project.name!=='chromium');
 for(const id of ['bar-error','bar-grouped-error','scatter-error','line-error']){
  await start(page,id);await page.getByRole('combobox',{name:'误差表示',exact:true}).selectOption('ci');
  const outside=await page.locator('.figure-paper svg[data-chart]').first().evaluate(svg=>{const s=svg.getBoundingClientRect();return [...svg.querySelectorAll('circle')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.top<s.top-1||r.bottom>s.bottom+1||r.left<s.left-1||r.right>s.right+1)}).length});expect(outside).toBe(0);
 }
});
test('网络节点拖动位置与数据随项目往返',async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,'network');
 const node=page.locator('.figure-paper svg g').filter({has:page.locator(':scope > title')}).filter({hasText:'基因01（n1）'}).last();
 const before=await node.getAttribute('transform'),box=await node.boundingBox();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+45,box!.y+box!.height/2+25,{steps:8});await page.mouse.up();await expect(node).not.toHaveAttribute('transform',before!);
 const buffer=await save(page),saved=JSON.parse(buffer.toString());expect(saved.layout.nodePositions.n1).toBeTruthy();
 const after=await node.getAttribute('transform');await reopen(page,buffer);await expect(node).toHaveAttribute('transform',after!);
});
test('网络默认标签无重叠，手动标签位置可以往返',async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,'network');const labels=page.locator('[data-drag-label^="network-"]');
 const boxes=await labels.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,text:e.textContent}}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1,`${a.text}/${b.text}`).toBe(false);}
 const label=labels.first(),box=await label.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+30,box!.y+box!.height/2+20,{steps:8});await page.mouse.up();const x=await label.getAttribute('x'),y=await label.getAttribute('y');const buffer=await save(page);expect(JSON.parse(buffer.toString()).layout.labelPositions).toBeTruthy();await reopen(page,buffer);await expect(labels.first()).toHaveAttribute('x',x!);await expect(labels.first()).toHaveAttribute('y',y!);
});
test('树数值标签为下一注释层预留空间',async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,'tree-normal');
 const bars=page.locator('[data-tree-layer="bar"]');
 for(const bar of await bars.all()){
  const id=await bar.getAttribute('data-node-id'),label=await bar.locator('text').last().boundingBox(),heat=await page.locator(`[data-tree-layer="heatmap"][data-node-id="${id}"]`).boundingBox();
  expect(label!.x+label!.width).toBeLessThan(heat!.x);
 }
});
