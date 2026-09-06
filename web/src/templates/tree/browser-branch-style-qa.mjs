import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const output = new URL('./evidence/branch-styles/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1800, height: 1300 }, acceptDownloads: true });
const page = await context.newPage(), results = [];
const chart = () => page.locator('.figure-paper svg[data-chart]').first();
const assert = (x, message) => { if (!x) throw Error(message); };
async function download(button, file) {
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  await (await ready).saveAs(new URL(file, output).pathname);
}
async function saveSvg(name) {
  await page.getByRole('button', { name: '导出图片', exact: true }).click();
  await page.getByRole('combobox', { name: '图片格式', exact: true }).selectOption('svg');
  await download('下载图片', name + '.svg');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const view = await context.newPage();
  await view.goto('file://' + new URL(name + '.svg', output).pathname);
  const geom = await view.locator('svg').first().evaluate(svg => {
    const bb = svg.getBBox(), vb = svg.viewBox.baseVal;
    return { finite: !/NaN|Infinity/.test(svg.outerHTML), x: bb.x, y: bb.y, width: bb.width, height: bb.height, canvas: [vb.width || svg.width.baseVal.value, vb.height || svg.height.baseVal.value] };
  });
  assert(geom.finite && geom.width > 0 && geom.height > 0, name + ' SVG几何不合法');
  await view.close();
  return geom;
}
try {
  for (const [layout, styles] of Object.entries({normal:['rectangular','rounded','linear','elliptical','bezierX','bezierY'],circle:['rectangular','linear','elliptical','bezierX','bezierY'],unrooted:['linear','bezierX','bezierY']})) {
    await page.goto('http://127.0.0.1:5178/#editor/tree-' + layout);
    await chart().waitFor();
    await page.locator('.tree-panel summary').filter({hasText:'树文件与文本'}).click();
    await page.getByRole('textbox',{name:'树文本',exact:true}).fill('((甲:1,乙:2)85[&other=0.84,posterior=0.84]:3,(丙:2,丁:3)96[&other=0.96,posterior=0.96]:2)100[&other=1,posterior=1];');
    await page.getByRole('button',{name:'应用树文本',exact:true}).click();
    const paths = new Set();
    for (const style of styles) {
      await page.getByRole('combobox', {name:'分支连接样式',exact:true}).selectOption(style);
      const ds = await chart().locator('[data-part="branches"] path').evaluateAll(es => es.map(e => e.getAttribute('d')).join('|'));
      assert(!paths.has(ds), layout + ' ' + style + '未改变分支'); paths.add(ds);
      results.push({ case:layout+'-'+style, passed:true, geometry:await saveSvg(layout+'-'+style) });
    }
    console.log(layout + ' ' + styles.length + ' styles passed');
  }
  await page.getByRole('combobox',{name:'树布局',exact:true}).selectOption('normal');
  await page.getByRole('combobox',{name:'支持度数据来源',exact:true}).selectOption('posterior');
  await page.getByRole('spinbutton',{name:'支持度缩放倍数',exact:true}).fill('100');
  const posteriorTexts = await chart().locator('[data-part="tree-support-label"] text').allTextContents();
  assert(posteriorTexts.includes('84.00') && posteriorTexts.includes('96.00'), '后验概率真实来源未正确显示');
  await page.getByRole('combobox',{name:'支持度数据来源',exact:true}).selectOption('variable');
  await page.getByRole('textbox',{name:'节点变量名',exact:true}).fill('OTHER');
  await page.getByRole('spinbutton',{name:'支持度缩放倍数',exact:true}).fill('100');
  await page.getByRole('combobox',{name:'支持度显示形式',exact:true}).selectOption('circle');
  await expect(chart().locator('[data-part="tree-support-label"] circle')).toHaveCount(3);
  const colors = await chart().locator('[data-part="tree-support-label"] circle').evaluateAll(es => es.map(e => e.getAttribute('fill')));
  assert(colors.filter(c=>c==='#808080').length===1 && colors.filter(c=>c==='#000000').length===2,'圈阈值颜色不正确');
  await expect(page.getByRole('spinbutton',{name:'支持度字号',exact:true})).toHaveCount(0);
  await saveSvg('support-circles');
  await page.getByRole('combobox',{name:'支持度显示形式',exact:true}).selectOption('text');
  await page.getByRole('spinbutton',{name:'文字最小值（留空不限）',exact:true}).fill('90');
  await expect(chart().locator('[data-part="tree-support-label"] text')).toHaveCount(2);
  await page.getByRole('spinbutton',{name:'文字最小值（留空不限）',exact:true}).fill('');
  const label = chart().locator('[data-part="tree-support-label"]').nth(1);
  const before = await label.getAttribute('transform');
  const box = await label.boundingBox(); assert(box,'支持度标签不可见');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+42,box.y+box.height/2-21,{steps:8});await page.mouse.up();
  const after = await label.getAttribute('transform'); assert(before!==after,'拖动未修改位置');
  await page.getByRole('button',{name:'撤销',exact:true}).click(); assert(await label.getAttribute('transform')===before,'拖动撤销不准确');
  await page.getByRole('button',{name:'重做',exact:true}).click(); assert(await label.getAttribute('transform')===after,'拖动重做不准确');
  await download('保存项目','support-drag.openacad.json');
  const saved = JSON.parse(await fs.readFile(new URL('support-drag.openacad.json',output)));
  assert(Object.keys(saved.layout.treeSupportOffsets).length===1,'项目缺失单节点拖动位置');
  const reopened = await context.newPage();await reopened.goto('http://127.0.0.1:5178/');await reopened.locator('input[type=file]').first().setInputFiles(new URL('support-drag.openacad.json',output).pathname);await reopened.locator('.figure-paper svg[data-chart]').first().waitFor();
  assert(await reopened.locator('.figure-paper svg[data-chart]').first().locator('[data-part="tree-support-label"]').nth(1).getAttribute('transform')===after,'重开丢失支持度拖动');await reopened.close();
  results.push({case:'support-variable-circle-filter-drag-undo-redo-reopen',passed:true,before,after,colors,geometry:await saveSvg('support-drag')});
  await page.screenshot({path:new URL('support-drag-screen.png',output).pathname});
  console.log('support drag/filter/source/project passed');
} catch(e){results.push({case:'fatal',passed:false,error:String(e)});console.error(e);} finally { await fs.writeFile(new URL('browser-report.json',output),JSON.stringify(results,null,2));await browser.close(); }
if(results.some(r=>!r.passed))process.exitCode=1;
