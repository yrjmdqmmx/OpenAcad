import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const OUT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(OUT, '../../..');
const require = createRequire(join(ROOT, 'web/package.json'));
const { chromium, expect } = require('@playwright/test');
const BASE = 'http://127.0.0.1:5178';
const API = 'http://127.0.0.1:18084';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = JSON.parse(await readFile(join(OUT, 'run-provenance.json'), 'utf8'));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { scope: 'local-browser-oblique-layout', startedAt: new Date().toISOString(), browser: browser.version(), cases: [], failures: [] };

async function contextFor(record) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'http:' && url.hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
  await context.route('**/api/**', async route => {
    const req = route.request();
    const response = await route.fetch({ url: API + new URL(req.url()).pathname });
    const body = await response.json();
    if (req.method() === 'POST' && response.ok()) {
      record.jobs.push({ id: body.id, token: body.token });
      const data = req.postDataJSON();
      const sha = digest(Buffer.from(data.data.svg));
      record.submittedSources.push({ format: data.params.format, sourceSha256: sha });
      await writeFile(join(OUT, record.id, `submitted-${data.params.format}.svg`), data.data.svg);
    }
    if (req.method() === 'GET' && body.status === 'finished' && body.result) {
      const result = body.result;
      assert.deepEqual(result.provenance.availableFontsSha256, provenance.fontManifest);
      if (!record.completedJobs.has(body.id)) {
        record.completedJobs.add(body.id);
        record.exportResults.push({ format: result.provenance.format, provenance: result.provenance, diagnostics: result.diagnostics });
      }
    }
    await route.fulfill({ response });
  });
  context.on('response', response => {
    if (response.url().includes('/fonts/') && response.url().endsWith('.woff2')) record.fontUrls.add(response.url());
  });
  return context;
}

async function ready(page) {
  await expect(page.locator('.figure-paper svg[data-chart]').first()).toBeVisible();
  return page.locator('.figure-paper svg[data-chart]').first().evaluate(async svg => {
    const available = [...document.fonts].map(f => ({ family: f.family.replace(/^["']|["']$/g, ''), style: f.style, weight: f.weight }));
    for (const family of ['Noto Sans SC', 'Noto Serif CJK SC'])
      for (const style of ['normal', 'italic'])
        for (const weight of ['400', '700'])
          if (!available.some(f => f.family === family && f.style === style && f.weight === weight)) throw Error(`缺少CSS字体面 ${family}/${style}/${weight}`);
    const loaded = [];
    for (const node of svg.querySelectorAll('text, tspan')) {
      if (!node.textContent) continue;
      const s = getComputedStyle(node), font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const faces = await document.fonts.load(font, node.textContent);
      if (!faces.length || faces.some(f => f.status !== 'loaded') || !document.fonts.check(font, node.textContent)) throw Error(`实际字形字体未就绪 ${font}`);
      loaded.push({ text: node.textContent, font, faces: faces.map(f => ({ family: f.family, style: f.style, weight: f.weight, status: f.status })) });
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = svg.getBBox(), v = svg.viewBox.baseVal;
    if (b.x < -1 || b.y < -1 || b.x + b.width > v.width + 1 || b.y + b.height > v.height + 1) throw Error('文字或图形超出画布');
    return { bounds: { x: b.x, y: b.y, width: b.width, height: b.height }, viewBox: { width: v.width, height: v.height }, loaded };
  });
}

async function screenshot(page, id, name) {
  await ready(page);
  const bytes = await page.locator('.figure-paper svg[data-chart]').first().screenshot({ animations: 'disabled' });
  const path = join(OUT, id, name + '.png');
  await writeFile(path, bytes);
  return { file: path, sha256: digest(bytes) };
}

async function treeCase(page, record) {
  await page.goto(BASE + '/#editor/tree-normal');
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('tree-mixed-italic');
  await page.getByRole('combobox', { name: '树注释类型', exact: true }).selectOption('italic');
  await page.getByRole('button', { name: '添加可试用的图层', exact: true }).click();
  const layer = page.locator('.tree-panel .layer-item').filter({ hasText: '局部斜体' });
  await layer.getByRole('textbox', { name: '局部斜体数据', exact: true }).fill('nodeID\t文字\n拟南芥\t南芥\n油菜\t菜\n水稻\t稻');
  await layer.getByRole('button', { name: '应用数据', exact: true }).click();
  await layer.getByRole('button', { name: '隐藏', exact: true }).click();
  record.normal = await screenshot(page, record.id, 'normal');
  const anchors = () => page.locator('[data-part="leaf-label"]').evaluateAll(nodes => nodes.map(n => ({ id: n.getAttribute('data-node-id'), transform: n.getAttribute('transform'), anchor: n.querySelector('text').getAttribute('text-anchor') })));
  const beforeAnchors = await anchors();
  await layer.getByRole('button', { name: '显示', exact: true }).click();
  record.italic = await screenshot(page, record.id, 'italic');
  assert.notEqual(record.italic.sha256, record.normal.sha256, '局部斜体必须实际改变字形像素');
  assert.deepEqual(await anchors(), beforeAnchors, '局部斜体不应改变叶标签锚点/变换');
  const runs = await page.locator('[data-part="leaf-label"] text').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, runs: [...n.querySelectorAll('tspan')].map(t => ({ text: t.textContent, style: getComputedStyle(t).fontStyle })) })));
  assert(runs.some(n => n.text === '拟南芥' && n.runs.some(r => r.text === '拟' && r.style === 'normal') && n.runs.some(r => r.text === '南芥' && r.style === 'italic')));
  assert(runs.some(n => n.text === '小麦' && n.runs.every(r => r.style === 'normal')));
  record.mixedRuns = runs; record.anchors = beforeAnchors;
  await layer.getByRole('button', { name: '隐藏', exact: true }).click();
  record.restoredNormal = await screenshot(page, record.id, 'restored-normal');
  assert.equal(record.restoredNormal.sha256, record.normal.sha256);
  await layer.getByRole('button', { name: '显示', exact: true }).click();
}

async function barCase(page, record) {
  await page.goto(BASE);
  await page.locator('input[type=file]').first().setInputFiles(join(ROOT, 'web/src/templates/basic/evidence/bar-advanced.openacad.json'));
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('bar-rotated-bold-italic');
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('粗斜体标题 · 开放学术 Aa12');
  await page.getByRole('combobox', { name: '字体', exact: true }).selectOption('Noto Serif CJK SC');
  await page.getByRole('switch', { name: '标题粗体', exact: true }).setChecked(true);
  await page.getByRole('spinbutton', { name: '横轴刻度旋转', exact: true }).fill('35');
  await page.getByRole('spinbutton', { name: '下边距', exact: true }).fill('145');
  await page.getByRole('switch', { name: '标题斜体', exact: true }).setChecked(false);
  await page.getByRole('switch', { name: '横轴刻度斜体', exact: true }).setChecked(false);
  record.normal = await screenshot(page, record.id, 'normal');
  await page.getByRole('switch', { name: '标题斜体', exact: true }).setChecked(true);
  await page.getByRole('switch', { name: '横轴刻度斜体', exact: true }).setChecked(true);
  record.italic = await screenshot(page, record.id, 'italic');
  assert.notEqual(record.italic.sha256, record.normal.sha256);
  record.textRuns = await page.locator('.figure-paper svg text').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, weight: getComputedStyle(n).fontWeight, style: getComputedStyle(n).fontStyle, transform: n.getAttribute('transform'), anchor: n.getAttribute('text-anchor') })));
  assert(record.textRuns.some(n => n.text === '粗斜体标题 · 开放学术 Aa12' && n.weight === '700' && n.style === 'italic' && n.anchor === 'middle'));
  assert(record.textRuns.some(n => n.style === 'italic' && n.transform?.includes('rotate(35')));
  await page.getByRole('switch', { name: '标题斜体', exact: true }).setChecked(false);
  await page.getByRole('switch', { name: '横轴刻度斜体', exact: true }).setChecked(false);
  record.restoredNormal = await screenshot(page, record.id, 'restored-normal');
  assert.equal(record.restoredNormal.sha256, record.normal.sha256);
  await page.getByRole('switch', { name: '标题斜体', exact: true }).setChecked(true);
  await page.getByRole('switch', { name: '横轴刻度斜体', exact: true }).setChecked(true);
}

try {
  assert.equal((await (await fetch(API + '/api/health')).json()).status, 'ok');
  for (const [id, configure] of [['tree-mixed-italic', treeCase], ['bar-rotated-bold-italic', barCase]]) {
    await mkdir(join(OUT, id));
    const record = { id, jobs: [], completedJobs: new Set(), fontUrls: new Set(), submittedSources: [], exportResults: [] };
    const context = await contextFor(record); const page = await context.newPage();
    let reopenContext;
    try {
      await configure(page, record);
      await ready(page);
      const event = page.waitForEvent('download');
      await page.getByRole('button', { name: '保存项目', exact: true }).click();
      const download = await event; const projectPath = join(OUT, id, id + '.openacad.json');
      await download.saveAs(projectPath);
      const project = JSON.parse(await readFile(projectPath, 'utf8'));
      if (id.startsWith('tree')) assert(project.layers.some(l => l.type === 'tree:italic' && l.visible));
      else assert(project.style.titleItalic && project.style.xTickItalic && project.style.titleBold && project.style.axisRotation === 35);
      reopenContext = await contextFor(record); const reopened = await reopenContext.newPage();
      await reopened.goto(BASE); await reopened.locator('input[type=file]').first().setInputFiles(projectPath);
      record.reopened = await screenshot(reopened, id, 'reopened');
      assert.equal(record.reopened.sha256, record.italic.sha256, '新浏览器上下文重开项目应恢复相同斜体图像');
      record.actualFontsAndBounds = await ready(reopened);
      record.project = { file: projectPath, sha256: digest(await readFile(projectPath)), reopenedInFreshContext: true };
      await reopened.getByRole('button', { name: '导出图片', exact: true }).click();
      record.downloads = [];
      for (const format of ['svg', 'png', 'pdf', 'eps']) {
        await reopened.getByRole('combobox', { name: '图片格式', exact: true }).selectOption(format);
        if (format !== 'png') await reopened.getByLabel('文字转为路径（避免接收方字体缺失）', { exact: true }).setChecked(format === 'svg');
        if (format === 'png' || format === 'eps') await reopened.getByRole('combobox', { name: '分辨率', exact: true }).selectOption('150');
        const waiting = reopened.waitForEvent('download', { timeout: 90000 });
        await reopened.getByRole('button', { name: '下载图片', exact: true }).click();
        const dl = await waiting; const output = join(OUT, id, id + '.' + format); await dl.saveAs(output);
        const bytes = await readFile(output); assert(bytes.length > 1000);
        if (format === 'svg') {
          assert(bytes.toString().includes('<svg')); assert(!/<text\b/.test(bytes.toString()));
          const viewer = await reopenContext.newPage();
          await viewer.setContent(`<img alt="独立打开转曲SVG" src="data:image/svg+xml;base64,${bytes.toString('base64')}">`);
          const opened = await viewer.locator('img').evaluate(async img => { await img.decode(); return { width: img.naturalWidth, height: img.naturalHeight, complete: img.complete }; });
          assert(opened.complete && opened.width > 100 && opened.height > 100);
          await viewer.setViewportSize({ width: opened.width + 20, height: opened.height + 20 });
          await viewer.locator('img').screenshot({ path: join(OUT, id, 'svg-independently-opened.png') });
          record.svgIndependentOpen = { decoder: 'Chromium image decoder', ...opened };
          await viewer.close();
        }
        record.downloads.push({ format, file: output, bytes: bytes.length, sha256: digest(bytes), suggestedFilename: dl.suggestedFilename(), outline: format === 'svg' });
        if (format === 'svg') await reopened.getByLabel('文字转为路径（避免接收方字体缺失）', { exact: true }).uncheck();
      }
      assert.equal(record.downloads.length, 4); assert.equal(record.exportResults.length, 4);
      assert.equal(new Set(record.submittedSources.map(s => s.sourceSha256)).size, 1);
      record.passed = true;
    } catch (error) {
      record.error = String(error.stack || error);
      record.alerts = await page.getByRole('alert').allTextContents();
      await page.screenshot({ path: join(OUT, id, 'failure-page.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally {
      for (const job of record.jobs) await fetch(API + '/api/jobs/' + job.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + job.token } });
      delete record.jobs; delete record.completedJobs; record.fontUrls = [...record.fontUrls];
      await writeFile(join(OUT, id, 'browser-result.json'), JSON.stringify(record, null, 2) + '\n');
      report.cases.push(record); await context.close(); if (reopenContext) await reopenContext.close();
    }
  }
} catch (error) { report.failures.push(String(error.stack || error)); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString(); report.passed = !report.failures.length && report.cases.length === 2 && report.cases.every(c => c.passed);
  await writeFile(join(OUT, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close(); console.log(JSON.stringify({ passed: report.passed, cases: report.cases.map(c => ({ id: c.id, passed: c.passed, downloads: c.downloads?.length })), failures: report.failures }, null, 2));
}
