import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const examples = path.resolve('public/examples/magnetic-correlation');
test('磁异常模板三文件上传、真实计算、三格式导出与项目往返', async ({ page }, info) => {
  test.skip(!process.env.OPENACAD_LIVE_API, '需要真实 API、Redis、worker 和 Inkscape');
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#catalog');
  await page.getByRole('textbox', { name: '搜索图表' }).fill('磁异常');
  await expect(page.locator('.template-card')).toHaveCount(1);
  await page.goto('/#template/magnetic-correlation');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('磁异常曲线与磁异常相关成像剖面图');
  for (const name of ['下载磁异常曲线 CSV', '下载海底和基底 CSV', '下载测线位置 JSON']) {
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.(csv|json)$/);
  }
  await page.getByRole('button', { name: '用示例开始', exact: true }).click();
  if (info.project.name === 'mobile') await page.locator('.mobile-tabs').getByRole('button', { name: '数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeEnabled();
  await page.getByLabel('上传磁异常曲线数据').setInputFiles(path.join(examples, 'magnetic-curve.csv'));
  await expect(page.getByText('请补齐两份 CSV 和一份测线 JSON 后开始计算。')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeDisabled();
  await page.getByLabel('上传海底和基底数据').setInputFiles(path.join(examples, 'magnetic-profile.csv'));
  const track = JSON.parse(await readFile(path.join(examples, 'magnetic-track.json'), 'utf8'));
  await page.getByLabel('上传测线位置').setInputFiles({ name: 'my-track.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ 'TEST-LINE': track.OBS93 })) });
  await page.getByRole('button', { name: '开始计算', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeEnabled({ timeout: 90000 });
  await expect(page.locator('.figure-paper')).toContainText('TEST-LINE');
  await expect(page.locator('[data-magnetic="station"]')).toHaveCount(0);
  await expect(page.locator('[data-magnetic="fault"]')).toHaveCount(0);
  await expect(page.locator('[data-magnetic="moho"]')).toHaveCount(0);
  await page.getByLabel('地磁倾角（°）', { exact: true }).fill('34');
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '开始计算', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeEnabled({ timeout: 90000 });
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const file = await (await saved).path();
  const project = JSON.parse(await readFile(file!, 'utf8'));
  expect(project.dataset.files).toHaveLength(1);
  expect(project.analysis.params.inc).toBe(34);
  expect(project.analysis.result.data.correlation).toHaveLength(23);
  await page.locator('input[type=file]').first().setInputFiles(file!);
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeEnabled();
  for (const format of ['svg', 'png', 'pdf']) {
    await page.getByRole('button', { name: '导出图片', exact: true }).click();
    await expect(page.getByLabel('图片格式').locator('option')).toHaveCount(3);
    await page.getByLabel('图片格式').selectOption(format);
    const download = page.waitForEvent('download', { timeout: 45000 });
    await page.getByRole('button', { name: '下载图片', exact: true }).click();
    const artifact = await download;
    const bytes = await readFile((await artifact.path())!);
    if (format === 'svg') { expect(bytes.toString()).toContain('<text'); expect(bytes.toString()).not.toContain('<image'); }
    if (format === 'png') expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    if (format === 'pdf') { expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(bytes.subarray(-1024).toString()).toContain('%%EOF'); }
    if (process.env.OPENACAD_MAGNETIC_OUTPUT) await artifact.saveAs(path.join(process.env.OPENACAD_MAGNETIC_OUTPUT, `magnetic-correlation.${format}`));
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('磁异常模板详情与编辑器在窄屏可操作', async ({ page }, info) => {
  for (const route of ['/#template/magnetic-correlation', '/#editor/magnetic-correlation']) {
    await page.goto(route);
    await expect(page.locator('svg[data-chart]').first()).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  if (info.project.name === 'mobile') await page.locator('.mobile-tabs').getByRole('button', { name: '数据', exact: true }).click();
  const curve = page.getByRole('region', { name: '磁异常曲线数据', exact: true });
  await expect(curve.getByRole('status')).toContainText('示例数据');
  const picker = page.waitForEvent('filechooser');
  await curve.getByLabel('上传磁异常曲线数据').click();
  await (await picker).setFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('dist_km,mag_nT\n0,NaN\n1,2') });
  await expect(page.getByRole('alert')).toContainText('必须是有限数字');
  await expect(curve.getByRole('status')).toContainText('示例数据');
  for (const [label, filename] of [['磁异常曲线数据', 'magnetic-curve.csv'], ['海底和基底数据', 'magnetic-profile.csv'], ['测线位置', 'magnetic-track.json']]) {
    const card = page.getByRole('region', { name: label, exact: true });
    const chooser = page.waitForEvent('filechooser');
    await card.getByLabel(`上传${label}`).click();
    await (await chooser).setFiles(path.join(examples, filename));
    await expect(card.getByRole('status')).toContainText(filename);
    await expect(card.getByRole('status')).toContainText('已上传');
    if (label === '磁异常曲线数据') {
      await expect(page.getByRole('region', { name: '海底和基底数据', exact: true }).getByRole('status')).toContainText('待上传');
      await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeDisabled();
    }
  }
  await expect(page.getByRole('button', { name: '开始计算', exact: true })).toBeEnabled();
});

test('计算任务创建期间上传新文件，晚到任务不能覆盖新数据', async ({ page }, info) => {
  test.skip(!process.env.OPENACAD_LIVE_API || info.project.name !== 'chromium', '真实队列竞态在 Chromium 验证');
  let release!: () => void;
  let created!: () => void;
  const submitted = new Promise<void>(resolve => { created = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jobs', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    created();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto('/#editor/magnetic-correlation');
  await page.getByRole('button', { name: '开始计算', exact: true }).click();
  await submitted;
  await page.getByLabel('上传磁异常曲线数据').setInputFiles(path.join(examples, 'magnetic-curve.csv'));
  await expect(page.getByText('请补齐两份 CSV 和一份测线 JSON 后开始计算。')).toBeVisible();
  const canceled = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().includes('/api/jobs/'));
  release();
  await canceled;
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const project = JSON.parse(await readFile((await (await saved).path())!, 'utf8'));
  expect(project.dataset.tables).toHaveLength(1);
  expect(project.dataset.files).toHaveLength(0);
  expect(project.analysis.result).toBeUndefined();
  await expect(page.getByRole('button', { name: '导出图片', exact: true })).toBeDisabled();
});
