import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('首次打开磁异常模板只加载共享常用字字体，生僻字仍可显示和导出', async ({ page }) => {
  const fonts: string[] = [];
  const errors: string[] = [];
  page.on('request', request => {
    if (/\/fonts\/.*\.woff2$/.test(request.url())) fonts.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#template/magnetic-correlation', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('磁异常曲线与磁异常相关成像剖面图');
  await page.evaluate(() => document.fonts.ready);
  expect(fonts).toHaveLength(2);
  expect(fonts.every(url => /-critical\.[a-f0-9]+\.woff2$/.test(url))).toBe(true);
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => /\/fonts\/.*\.woff2$/.test(entry.name))
    .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).decodedBodySize, 0));
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThan(1_000_000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  // User-supplied characters outside the authored-text subset must still load
  // the original face, and editable SVG must embed that fallback as well.
  await page.goto('/#editor/bar');
  const mobileStyleTab = page.locator('.mobile-tabs').getByRole('button', { name: '设置', exact: true });
  if (await mobileStyleTab.isVisible()) await mobileStyleTab.click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('𠮷');
  const previewTab = page.locator('.mobile-tabs').getByRole('button', { name: '预览', exact: true });
  if (await previewTab.isVisible()) await previewTab.click();
  const title = page.locator('.figure-paper text').filter({ hasText: /^𠮷$/ }).first();
  await expect(title).toBeVisible();
  await title.evaluate(async element => {
    const style = getComputedStyle(element);
    await document.fonts.load(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, '𠮷');
  });
  expect(fonts.some(url => /-rest-/.test(url))).toBe(true);
  await page.getByRole('button', { name: '导出图片', exact: true }).click();
  await page.getByLabel('图片格式').selectOption('svg');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载图片', exact: true }).click();
  const artifact = await waiting;
  const svg = await readFile((await artifact.path())!, 'utf8');
  expect(svg).toContain('𠮷');
  expect(svg).toContain('data:font/woff2;base64,');
  expect(svg).toContain('data-openacad-font-license');
  expect(svg).not.toContain('<image');
  expect(errors).toEqual([]);
});
