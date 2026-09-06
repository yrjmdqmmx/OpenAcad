import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
test('模板搜索、数据更换、错误定位、撤销和项目往返',async({page,browser},testInfo)=>{
  await page.goto('/');await page.getByRole('textbox',{name:'搜索图表'}).fill('分组柱状');await expect(page.locator('.template-card')).toHaveCount(1);await page.getByRole('button',{name:'用示例开始',exact:true}).click();
  if(testInfo.project.name==='mobile')await page.locator('.mobile-tabs').getByRole('button',{name:'数据',exact:true}).click();
  const cell=page.getByRole('textbox',{name:'示例数据第 2 行第 2 列',exact:true});const before=await page.locator('.figure-paper svg').first().innerHTML();await cell.fill('42');await expect(page.locator('.figure-paper svg').first()).not.toHaveJSProperty('innerHTML',before);
  await cell.fill('错误数字');await expect(page.getByRole('alert')).toContainText('第 2 行');await expect(page.getByRole('alert')).toContainText('数值');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(cell).toHaveValue('42');
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const saved=await dl;expect(saved.suggestedFilename()).toMatch(/\.openacad\.json$/);const path=await saved.path();expect(path).toBeTruthy();const project=JSON.parse(await readFile(path!,'utf8'));expect(project.dataset.tables[0].rows[0][1]).toBe('42');
  const context=await browser.newContext(testInfo.project.name==='mobile'?{viewport:{width:390,height:844}}:{});const reopen=await context.newPage();await reopen.goto('/');await reopen.locator('input[type=file]').first().setInputFiles(path!);await expect(reopen.locator('.figure-paper svg').first()).toBeAttached();if(testInfo.project.name==='mobile')await reopen.locator('.mobile-tabs').getByRole('button',{name:'数据',exact:true}).click();await expect(reopen.getByRole('textbox',{name:'示例数据第 2 行第 2 列',exact:true})).toHaveValue('42');await context.close();
  const width=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth}));expect(width.sw).toBeLessThanOrEqual(width.w+1);
});
test('样式修改、图层保存、SVG 实际下载',async({page},testInfo)=>{
  await page.goto('/#editor/bar');if(testInfo.project.name==='mobile')await page.locator('.mobile-tabs').getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('textbox',{name:'标题',exact:true}).fill('中文导出验收');
  await expect(page.locator('.figure-paper')).toContainText('中文导出验收');await page.getByRole('button',{name:'导出图片',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载图片',exact:true}).click();const dl=await download;const content=await readFile((await dl.path())!,'utf8');expect(content).toContain('xmlns="http://www.w3.org/2000/svg"');expect(content).toContain('中文导出验收');expect(content).not.toMatch(/NaN|Infinity/);
  if(testInfo.project.name==='chromium'){await mkdir('../tests/artifacts',{recursive:true});await dl.saveAs('../tests/artifacts/bar-cn.svg');await page.getByRole('button',{name:'关闭',exact:true}).click();await page.screenshot({path:'../tests/artifacts/editor-desktop.png'});}
});
test('模板库、详情、帮助与手机页面无横向溢出',async({page},testInfo)=>{
  for(const route of ['/#catalog','/#template/bar','/#help/bar','/#projects','/#methods']){await page.goto(route);await expect(page.locator('h1').first()).toBeVisible();const dims=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));expect(dims.scroll).toBeLessThanOrEqual(dims.inner+1);}
  await page.goto('/#catalog');if(testInfo.project.name==='chromium')await page.screenshot({path:'../tests/artifacts/catalog-desktop.png'});if(testInfo.project.name==='mobile')await page.screenshot({path:'../tests/artifacts/catalog-mobile.png'});
});
