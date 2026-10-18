import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const cases = JSON.parse(readFileSync('../tests/artifacts/template-cases.json','utf8')) as {id:string;name:string}[];
const output = process.env.OPENACAD_QUALITY_OUTPUT;
test.describe.configure({mode:'parallel'});
async function chartMarkup(page:Page) {
  return page.locator('.figure-paper svg[data-chart]').first().evaluate(svg => {
    const clone=svg.cloneNode(true) as SVGElement;
    const ids = new Map<string,string>();
    clone.querySelectorAll('[id]').forEach((e,i)=>ids.set(e.id,`stable-${i}`));
    clone.querySelectorAll('*').forEach(e=>Array.from(e.attributes).forEach(a=>{
      let v=a.value; for(const [from,to] of ids) v=v.replaceAll(from,to); e.setAttribute(a.name,v);
    }));
    return clone.innerHTML;
  });
}
async function change(page:Page,key:string,value:string|boolean) {
  const row=page.locator(`[data-control-key="${key}"]`);
  if(!await row.count()) return false;
  const details=row.locator('xpath=ancestor::details[1]');
  if(await details.count() && await details.getAttribute('open') === null) await details.locator('summary').click();
  const input=row.locator('input,select');
  const before=await chartMarkup(page);
  if(typeof value==='boolean') await input.setChecked(value);
  else if(await input.evaluate(e=>e.tagName)==='SELECT') await input.selectOption(value);
  else await input.fill(value);
  await expect.poll(()=>chartMarkup(page)).not.toBe(before);
  return true;
}
for(const t of cases) test(`${t.name}：新建示例、控件实操、保存重开及可用格式`,async({page},info)=>{
  test.skip(info.project.name!=='chromium'||!output||!process.env.OPENACAD_LIVE_API,'显式开启完整质量验收及真实导出服务');
  test.setTimeout(180000);
  await mkdir(path.join(output!, 'defaults'),{recursive:true});
  await mkdir(path.join(output!, 'exports'),{recursive:true});
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/#template/${t.id}`);
  await page.getByRole('button',{name:'用示例开始',exact:true}).click();
  const svg=page.locator('.figure-paper svg[data-chart]').first();
  await expect(svg).toBeVisible();
  await expect(page.locator('.chart-error')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'导出图片',exact:true})).toBeEnabled();
  await page.evaluate(()=>document.fonts.ready);
  expect(await svg.textContent()).toMatch(/模拟/);
  await page.screenshot({path:path.join(output!,'defaults',`${t.id}.png`)});
  await page.screenshot({path:path.join(output!,'defaults',`${t.id}-figure.png`),clip:(await svg.boundingBox())!});
  await change(page,'titleSize','28');
  await page.getByRole('combobox',{name:'字体',exact:true}).selectOption('Noto Serif CJK SC');
  const palette=page.getByRole('combobox',{name:'配色方案',exact:true});
  if(await palette.count()) {
    const before=await chartMarkup(page);await palette.selectOption({label:'灰阶'});
    await expect.poll(()=>chartMarkup(page)).not.toBe(before);
  }
  const labels=page.locator('[data-control-key="showLabels"] input');
  if(await labels.count()) await change(page,'showLabels',!await labels.isChecked());
  const values=page.locator('[data-control-key="showValues"] input');
  if(await values.count()) await change(page,'showValues',!await values.isChecked());
  if(['heatmap','circle-heatmap','bubble-matrix','correlation','double-correlation','mantel'].includes(t.id)) await change(page,'lowColor','#1d3f87');
  if(t.id==='volcano') {await change(page,'upColor','#c42938');await change(page,'foldThreshold','2');}
  if(t.id.startsWith('enrichment-')) await change(page,'lowQColor','#c42938');
  if(['bar-grouped','bar-category','lollipop-category'].includes(t.id)) {
    const direction=page.locator('[data-control-key="orientation"] select');
    const current=await direction.inputValue();await change(page,'orientation',current==='horizontal'?'vertical':'horizontal');
  }
  if(['bar-error','bar-grouped-error','scatter-error','line-error'].includes(t.id)) {await change(page,'errorType','se');await expect(svg).toContainText('SE');await change(page,'errorType','ci');await expect(svg).toContainText('95%');}
  const save=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
  const dl=await save; const bytes=await readFile((await dl.path())!);const saved=JSON.parse(bytes.toString());
  await writeFile(path.join(output!,'exports',`${t.id}.openacad.json`),bytes);
  const before=await chartMarkup(page);
  await page.goto('/#catalog');
  await page.locator('input[type=file]').first().setInputFiles({name:`${t.id}.openacad.json`,mimeType:'application/json',buffer:bytes});
  await expect(svg).toBeVisible();await expect.poll(()=>chartMarkup(page)).toBe(before);
  const reopenSave=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
  const reopened=JSON.parse(await readFile((await (await reopenSave).path())!,'utf8'));
  for(const field of ['dataset','style','layers','layout','analysis']) expect(reopened[field]).toEqual(saved[field]);
  await page.screenshot({path:path.join(output!,'defaults',`${t.id}-edited.png`)});
  for(const format of (t.id === 'magnetic-correlation' ? ['svg','png','pdf'] : ['svg','png','pdf','eps'])) {
    await page.getByRole('button',{name:'导出图片',exact:true}).click();
    await page.getByRole('combobox',{name:'图片格式',exact:true}).selectOption(format);
    if(format==='png') await page.getByRole('combobox',{name:'分辨率',exact:true}).selectOption('150');
    const exported=page.waitForEvent('download',{timeout:110000});
    const failure=page.getByRole('dialog').getByRole('alert').waitFor({state:'visible',timeout:110000}).then(async()=>{throw new Error(await page.getByRole('dialog').getByRole('alert').innerText())});
    await page.getByRole('button',{name:'下载图片',exact:true}).click();
    const file=await Promise.race([exported,failure]);await file.saveAs(path.join(output!,'exports',`${t.id}.${format}`));
    expect((await readFile((await file.path())!)).length).toBeGreaterThan(1000);
    await page.getByRole('button',{name:'关闭',exact:true}).click();
  }
  expect(errors).toEqual([]);
});
