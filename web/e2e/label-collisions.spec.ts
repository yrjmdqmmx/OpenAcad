import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

test('雷达图相近数值与径向刻度无重叠，字体切换不移动数据点', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/#template/radar');
  await page.getByRole('button', { name: '用示例开始', exact: true }).click();
  const svg = page.locator('.figure-paper svg[data-chart]').first();
  const polygons = await svg.locator('polygon').evaluateAll(es => es.map(e => e.getAttribute('points')));
  for (const family of ['Noto Sans SC', 'Noto Serif CJK SC']) {
    await page.getByRole('combobox', { name: '字体', exact: true }).selectOption(family);
    await page.evaluate(() => document.fonts.ready);
    await expect(svg.locator('[data-label-id^="radar:"]')).toHaveCount(10);
    const boxes = await svg.locator('[data-part="marks"] text').evaluateAll(es => es.filter(e => /^\d+(\.\d+)?$/.test(e.textContent || '')).map(e => {
      const r = e.getBoundingClientRect(); return { text: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
    }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1, `${family}: ${a.text}/${b.text}`).toBe(false);
    }
    expect(await svg.locator('polygon').evaluateAll(es => es.map(e => e.getAttribute('points')))).toEqual(polygons);
  }
});

test('雷达图手动数值标签位置随旧格式项目往返', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium');
  await page.goto('/#template/radar');
  await page.getByRole('button', { name: '用示例开始', exact: true }).click();
  const label = page.locator('[data-label-id^="radar:"]').first();
  const before = await label.getAttribute('x'), box = await label.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down(); await page.mouse.move(box!.x + box!.width / 2 + 35, box!.y + box!.height / 2 + 25, { steps: 8 }); await page.mouse.up();
  await expect(label).not.toHaveAttribute('x', before!);
  const x = await label.getAttribute('x'), y = await label.getAttribute('y');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const bytes = await readFile((await (await pending).path())!); const saved = JSON.parse(bytes.toString());
  expect(saved.schemaVersion).toBe(1); expect(saved.layout.labels[await label.getAttribute('data-label-id') as string]).toBeTruthy();
  await page.goto('/#catalog'); await page.locator('input[type=file]').first().setInputFiles({ name: 'radar.openacad.json', mimeType: 'application/json', buffer: bytes });
  await expect(label).toHaveAttribute('x', x!); await expect(label).toHaveAttribute('y', y!);
});

for (const id of ['radar', 'gene-cluster']) test(`${id} 保留全部标签保存重开并导出四种格式`, async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium' || process.env.OPENACAD_LIVE_API !== '1');
  test.setTimeout(180000);
  const output = process.env.OPENACAD_RADAR_OUTPUT || info.outputPath('charts');
  const folder = path.join(output, id);
  await mkdir(folder, { recursive: true });
  await page.goto(`/#template/${id}`);
  await page.getByRole('button', { name: '用示例开始', exact: true }).click();
  const svg = page.locator('.figure-paper svg[data-chart]').first();
  if (id === 'radar') await expect(svg.locator('[data-label-id^="radar:"]')).toHaveCount(10);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(folder, `${id}-workbench.png`) });
  await svg.screenshot({ path: path.join(folder, `${id}-figure.png`) });
  const positions = () => svg.locator('text').evaluateAll(es => es.map(e => [e.textContent, e.getAttribute('x'), e.getAttribute('y'), e.getAttribute('transform')]));
  const before = await positions();
  const saving = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const project = await saving;
  await project.saveAs(path.join(folder, `${id}.openacad.json`));
  await page.goto('/#catalog');
  await page.locator('input[type=file]').first().setInputFiles(path.join(folder, `${id}.openacad.json`));
  await expect(svg).toBeVisible();
  expect(await positions()).toEqual(before);
  for (const format of ['svg', 'png', 'pdf', 'eps']) {
    await page.getByRole('button', { name: '导出图片', exact: true }).click();
    await page.getByRole('combobox', { name: '图片格式', exact: true }).selectOption(format);
    if (format === 'png') await page.getByRole('combobox', { name: '分辨率', exact: true }).selectOption('150');
    const downloading = page.waitForEvent('download', { timeout: 110000 });
    await page.getByRole('button', { name: '下载图片', exact: true }).click();
    const image = await downloading;
    await image.saveAs(path.join(folder, `${id}.${format}`));
    expect((await readFile((await image.path())!)).length).toBeGreaterThan(1000);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
});


test('基因簇各行坐标刻度不与下一行基因名重叠', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/#template/gene-cluster');
  await page.getByRole('button', { name: '用示例开始', exact: true }).click();
  const svg = page.locator('.figure-paper svg[data-chart]').first();
  for (const family of ['Noto Sans SC', 'Noto Serif CJK SC']) {
    await page.getByRole('combobox', { name: '字体', exact: true }).selectOption(family);
    await page.evaluate(() => document.fonts.ready);
    const boxes = await svg.locator('text').evaluateAll(es => es.map(e => {
      const r = e.getBoundingClientRect(); return { text: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
    }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1, `${family}: ${a.text}/${b.text}`).toBe(false);
    }
  }
});
