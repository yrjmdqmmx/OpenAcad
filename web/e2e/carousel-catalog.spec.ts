import { test, expect } from "@playwright/test";

const carousel = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "图研官网实景", exact: true });
const activeSlide = (page: import("@playwright/test").Page) => carousel(page).locator('.tuyan-slide.is-current');
async function openCarousel(page: import("@playwright/test").Page) {
  await page.goto('/#home');
  await carousel(page).scrollIntoViewIfNeeded();
  await expect.poll(() => activeSlide(page).locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
}

test('官网轮播支持手动循环、逐张来源及键盘切换', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCarousel(page);
  const frame = await carousel(page).locator('.tuyan-carousel-viewport').boundingBox();
  const names: string[] = [];
  const sources: string[] = [];
  for (let index = 0; index < 5; index++) {
    await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText(`${index + 1} / 5`);
    const image = activeSlide(page).getByRole('img');
    await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    names.push((await image.getAttribute('alt'))!);
    sources.push((await carousel(page).getByRole('link', { name: '图片来源', exact: true }).getAttribute('href'))!);
    await expect(carousel(page).getByRole('link', { name: '图片来源', exact: true })).toHaveAttribute('rel', 'noopener noreferrer');
    const box = await carousel(page).locator('.tuyan-carousel-viewport').boundingBox();
    expect(box?.height).toBeCloseTo(frame!.height, 0);
    await carousel(page).getByRole('button', { name: '下一张图研截图' }).click();
  }
  expect(new Set(names).size).toBe(5);
  expect(sources.slice(0, 3).every(s => s.startsWith('https://www.paperbanana.asia/leaderboard/cases/'))).toBe(true);
  expect(sources[3]).toBe('https://www.paperbanana.asia/leaderboard');
  expect(names[4]).toContain('参考图不是生成结果');
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('1 / 5');
  const previous = carousel(page).getByRole('button', { name: '上一张图研截图' });
  await previous.click();
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('5 / 5');
  await previous.press('ArrowRight');
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('1 / 5');
  const newPage = page.waitForEvent('popup');
  await activeSlide(page).getByRole('link').click();
  const popup = await newPage;
  await popup.waitForLoadState();
  await expect(popup).toHaveURL(/\/images\/tuyan-slide-biological\.png$/);
  await expect(page).toHaveURL(/#home$/);
  await popup.close();
});

test('自动轮播每三秒循环，悬停停止，移开后继续且不显示暂停按钮', async ({ page }) => {
  await page.clock.install();
  await openCarousel(page);
  // Freeze after loading, then reset the interval through hover/leave. Page
  // loading time must not consume part of the first 2900 ms assertion.
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  await carousel(page).hover();
  await carousel(page).getByRole('button', { name: /^查看第 1 张/ }).click();
  await expect(carousel(page).getByRole('button', { name: /暂停|播放|开启自动轮播/ })).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.clock.fastForward(2900);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('1 / 5');
  await page.clock.fastForward(200);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('2 / 5');
  await carousel(page).hover();
  await page.clock.fastForward(18000);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('2 / 5');
  await page.mouse.move(0, 0);
  for (const count of ['3 / 5', '4 / 5', '5 / 5', '1 / 5']) {
    await page.clock.fastForward(3100);
    await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText(count);
  }
});

test('减少动态效果时默认暂停，仍可手动选择截图', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await openCarousel(page);
  await expect(carousel(page).getByRole('button', { name: /暂停|播放|开启自动轮播/ })).toHaveCount(0);
  await page.clock.fastForward(18000);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('1 / 5');
  await carousel(page).getByRole('button', { name: '查看第 4 张：图研模型排行榜' }).click();
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('4 / 5');
});

test('全部模板、分类和搜索共用分类导航顺序，网格按行阅读', async ({ page }) => {
  await page.goto('/#catalog');
  const cards = page.locator('.template-card');
  const ids = () => cards.locator('a.template-preview').evaluateAll(elements => elements.map(e => e.getAttribute('href')));
  const all = await ids();
  expect(all.length).toBeGreaterThan(0);
  expect(new Set(all).size).toBe(all.length);
  const categoryNames = (await page.locator('.category-rail button').allTextContents()).slice(1);
  const groups = new Map<string, (string | null)[]>();
  const concat: (string | null)[] = [];
  for (const category of categoryNames) {
    await page.locator('.category-rail').getByRole('button', { name: category, exact: true }).click();
    const group = await ids();
    groups.set(category, group);
    concat.push(...group);
  }
  expect(all).toEqual(concat);
  await page.locator('.category-rail').getByRole('button', { name: '全部模板', exact: true }).click();
  expect(await ids()).toEqual(all);
  const rectangles = await cards.evaluateAll(elements => elements.map(e => ({top:e.getBoundingClientRect().top, left:e.getBoundingClientRect().left})));
  rectangles.slice(1).forEach((rect, i) => {
    const before = rectangles[i];
    expect(rect.top >= before.top - 1).toBe(true);
    if (Math.abs(rect.top - before.top) < 1) expect(rect.left).toBeGreaterThan(before.left);
  });
  for (const query of ['分组', '相关']) {
    await page.getByRole('textbox', { name: '搜索图表' }).fill(query);
    const search = await ids();
    expect(search.length).toBeGreaterThan(0);
    expect(search).toEqual(all.filter(id => search.includes(id)));
    for (const category of categoryNames) {
      await page.locator('.category-rail').getByRole('button', { name: category, exact: true }).click();
      expect(await ids()).toEqual(search.filter(id => groups.get(category)!.includes(id)));
    }
    await page.locator('.category-rail').getByRole('button', { name: '全部模板', exact: true }).click();
    expect(await ids()).toEqual(search);
  }
  await page.getByRole('textbox', { name: '搜索图表' }).fill('no-such-template-2026');
  await expect(cards).toHaveCount(0);
  await page.getByRole('button', { name: '清除', exact: true }).click();
  expect(await ids()).toEqual(all);
  await cards.first().getByRole('button', { name: '用示例开始', exact: true }).click();
  await expect(page).toHaveURL(/#editor\/bar-grouped$/);
  await expect(page.getByRole('textbox', { name: '项目名称', exact: true })).toBeVisible();
});

test('手机原生触摸：左右滑动切图不打开链接，竖向滑动仍滚动页面', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', '此项使用 Chromium 原生触摸输入；其余浏览器覆盖按钮、键盘、自动轮播和排序');
  const context = await browser.newContext({ baseURL, viewport: {width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
  const page = await context.newPage();
  await openCarousel(page);
  const cdp = await context.newCDPSession(page);
  const box = (await page.locator('.tuyan-carousel-viewport').boundingBox())!;
  const y = box.y + box.height / 2;
  async function swipe(x1:number,y1:number,x2:number,y2:number) {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:x1,y:y1,id:1}]});
    for (let step=1;step<=8;step++) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x1+(x2-x1)*step/8,y:y1+(y2-y1)*step/8,id:1}]});
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  }
  await swipe(box.x+box.width-35,y,box.x+35,y);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('2 / 5');
  await swipe(box.x+35,y,box.x+box.width-35,y);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('1 / 5');
  expect(context.pages()).toHaveLength(1);
  const before = await page.evaluate(()=>scrollY);
  await swipe(box.x+box.width/2,y+45,box.x+box.width/2,y-65);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before);
  await expect(carousel(page).locator('.tuyan-carousel-count')).toHaveText('1 / 5');
  await context.close();
});
