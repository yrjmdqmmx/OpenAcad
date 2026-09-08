import {test,expect,type Page} from '@playwright/test';
async function start(page:Page,id:string){await page.goto(`/#template/${id}`);await page.getByRole('button',{name:'用示例开始',exact:true}).click();}
const svg=(page:Page)=>page.locator('.figure-paper svg[data-chart]').first();
async function change(page:Page,key:string,value:string|boolean){
 const row=page.locator(`[data-control-key="${key}"]`);await expect(row).toHaveCount(1);
 const details=row.locator('xpath=ancestor::details[1]');if(await details.count()&&await details.getAttribute('open')===null)await details.locator('summary').click();
 const input=row.locator('input,select'),before=await svg(page).innerHTML();
 if(typeof value==='boolean')await input.setChecked(value);else if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(value);else await input.fill(value);
 await expect.poll(()=>svg(page).innerHTML()).not.toBe(before);
}
for(const id of ['heatmap','circle-heatmap','bubble-matrix','correlation','double-correlation','mantel'])test(`${id} 专用色带和适用条件真实生效`,async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,id);
 const diverging=page.locator('[data-control-key="diverging"] input');if(!await diverging.isChecked())await change(page,'diverging',true);
 for(const [key,color] of [['lowColor','#3849c7'],['midColor','#e8e2a4'],['highColor','#81377e']])await change(page,key,color);
 await change(page,'diverging',false);await expect(page.locator('[data-control-key="midColor"]')).toHaveCount(0);await expect(page.locator('[data-control-key="colorCenter"]')).toHaveCount(0);
 if(id==='bubble-matrix'){
  await change(page,'diverging',true);
  await change(page,'bubbleColorMode','row');for(const key of ['lowColor','midColor','highColor','diverging','colorCenter'])await expect(page.locator(`[data-control-key="${key}"]`)).toHaveCount(0);
  await change(page,'bubbleScale','0.55');await expect(svg(page)).toContainText('绝对值');await change(page,'bubbleColorMode','continuous');await change(page,'lowColor','#e57a43');
 }
 const values=page.locator('[data-control-key="showValues"] input');if(await values.isChecked())await change(page,'showValues',false);await expect(page.locator('[data-control-key="digits"]')).toHaveCount(0);
});
test('火山图三个类别颜色独立生效',async({page},info)=>{test.skip(info.project.name!=='chromium');await start(page,'volcano');for(const [key,color]of[['upColor','#b74129'],['downColor','#183fb3'],['neutralColor','#555555']])await change(page,key,color);});
for(const id of ['enrichment-dot','enrichment-bar','enrichment-circle'])test(`${id} 显著性渐变两端颜色独立生效`,async({page},info)=>{test.skip(info.project.name!=='chromium');await start(page,id);await change(page,'lowQColor','#753093');await change(page,'highQColor','#237a42');});
for(const id of ['bar-stacked','bar-grouped-stacked'])test(`${id} 非等总量数据下归一化和排序生效`,async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,id);await page.getByRole('textbox',{name:/第 2 行第 2 列$/}).fill('120');await change(page,'normalize',false);await change(page,'sort','ascending');
});
test('共线性染色体手动排序后可切换名称排序',async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,'synteny');
 const chromosomes=page.locator('[data-drag-chromosome]'),before=await chromosomes.evaluateAll(es=>es.map(e=>e.getAttribute('data-drag-chromosome')));
 const a=await chromosomes.first().boundingBox(),b=await chromosomes.last().boundingBox();
 await page.mouse.move(a!.x+a!.width/2,a!.y+30);await page.mouse.down();await page.mouse.move(b!.x+b!.width/2,b!.y+30,{steps:8});await page.mouse.up();
 await expect.poll(()=>chromosomes.evaluateAll(es=>es.map(e=>e.getAttribute('data-drag-chromosome')))).not.toEqual(before);
 await change(page,'chromosomeSort','name');await expect.poll(()=>chromosomes.evaluateAll(es=>es.map(e=>e.getAttribute('data-drag-chromosome')))).toEqual([...before].sort((a,b)=>a!.localeCompare(b!,'zh-CN')));
});
test('矩形树右边距在内容占满画布时改变输出尺寸',async({page},info)=>{
 test.skip(info.project.name!=='chromium');await start(page,'tree-normal');await change(page,'width','500');await change(page,'marginRight','240');
});
test('环形树最小高度超过内容高度时扩展画布',async({page},info)=>{test.skip(info.project.name!=='chromium');await start(page,'tree-circle');await expect(page.locator('[data-control-key="height"]')).toContainText('最小高度');await change(page,'height','2000');await expect(svg(page)).toHaveAttribute('height','2000');});
