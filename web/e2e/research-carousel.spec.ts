import { test, expect, type Page } from "@playwright/test";

const carousel = (page: Page) => page.getByRole("region", { name: "科研绘图工作台实景", exact: true });
const count = (page: Page) => carousel(page).locator(".research-carousel-count");
async function openCarousel(page: Page) {
  await page.goto("/#home");
  await carousel(page).scrollIntoViewIfNeeded();
  await expect.poll(() => carousel(page).locator(".research-slide.is-current img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

test("科研实景逐张加载，标题、大图与模板同步，支持循环和键盘", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCarousel(page);
  const ids = ["bar-grouped", "heatmap", "volcano", "sankey", "tree-circle"];
  const initial = await carousel(page).boundingBox();
  for (let index = 0; index < ids.length; index++) {
    await expect(count(page)).toHaveText(`${index + 1} / 5`);
    const image = carousel(page).locator(".research-slide.is-current img");
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1710, 838]);
    await expect(image).toHaveAttribute("alt", /真实工作台截图，使用自带模拟数据/);
    const imageUrl = `/images/research/${ids[index]}.jpg?v=journal-20260908`;
    await expect(image).toHaveAttribute("src", imageUrl);
    await expect(image.locator("..")).toHaveAttribute("href", imageUrl);
    await expect(carousel(page).getByRole("link", { name: "查看大图", exact: true })).toHaveAttribute("href", imageUrl);
    await expect(carousel(page).getByRole("link", { name: "试用此模板", exact: true })).toHaveAttribute("href", `#template/${ids[index]}`);
    expect((await carousel(page).boundingBox())!.height).toBeCloseTo(initial!.height, 0);
    await carousel(page).getByRole("button", { name: "下一张科研绘图截图" }).click();
  }
  await expect(count(page)).toHaveText("1 / 5");
  await carousel(page).getByRole("button", { name: "上一张科研绘图截图" }).click();
  await expect(count(page)).toHaveText("5 / 5");
  await carousel(page).getByRole("button", { name: "上一张科研绘图截图" }).press("ArrowRight");
  await expect(count(page)).toHaveText("1 / 5");
  await carousel(page).getByRole("button", { name: "查看第 2 张：数值热图", exact: true }).click();
  await expect(count(page)).toHaveText("2 / 5");
  await carousel(page).getByRole("link", { name: "试用此模板", exact: true }).click();
  await expect(page).toHaveURL(/#template\/heatmap$/);
  await expect(page.getByRole("button", { name: "用示例开始", exact: true })).toBeVisible();
});

test("科研实景每三秒切换，悬停暂停，离开后继续", async ({ page }) => {
  await page.clock.install();
  await openCarousel(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  await carousel(page).hover();
  await carousel(page).getByRole("button", { name: "查看第 1 张：分组柱状图", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(2900);
  await expect(count(page)).toHaveText("1 / 5");
  await page.clock.fastForward(200);
  await expect(count(page)).toHaveText("2 / 5");
  await carousel(page).hover();
  await page.clock.fastForward(12000);
  await expect(count(page)).toHaveText("2 / 5");
  await page.mouse.move(0, 0);
  for (const value of ["3 / 5", "4 / 5", "5 / 5", "1 / 5"]) {
    await page.clock.fastForward(3100);
    await expect(count(page)).toHaveText(value);
  }
  await carousel(page).getByRole("button", { name: "下一张科研绘图截图" }).press("ArrowRight");
  await expect(count(page)).toHaveText("2 / 5");
  await page.clock.fastForward(12000);
  await expect(count(page)).toHaveText("2 / 5");
});

test("减少动态效果时停播，两组轮播独立且图研信息完整", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await openCarousel(page);
  await page.clock.fastForward(18000);
  await expect(count(page)).toHaveText("1 / 5");
  await carousel(page).getByRole("button", { name: "下一张科研绘图截图" }).click();
  await expect(count(page)).toHaveText("2 / 5");
  const tuyan = page.getByRole("region", { name: "图研官网实景", exact: true });
  await tuyan.scrollIntoViewIfNeeded();
  await expect(tuyan.locator(".tuyan-carousel-count")).toHaveText("1 / 5");
  await tuyan.getByRole("button", { name: "下一张图研截图" }).click();
  await expect(tuyan.locator(".tuyan-carousel-count")).toHaveText("2 / 5");
  await expect(count(page)).toHaveText("2 / 5");
  await expect(page.locator(".tuyan-use-cases dt")).toHaveText(["方法框架与流程", "机制与关系示意", "参考图辅助与精修"]);
  await expect(page.getByRole("link", { name: "访问图研 Tuyan", exact: true })).toHaveAttribute("target", "_blank");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("科研截图加载失败保留说明与模板入口", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/images/research/bar-grouped.jpg*", route => route.abort());
  await page.goto("/#home");
  await expect(carousel(page).getByText("截图暂时无法加载，请从下方进入模板。", { exact: true })).toBeVisible();
  await carousel(page).getByRole("link", { name: "试用此模板", exact: true }).click();
  await expect(page).toHaveURL(/#template\/bar-grouped$/);
});

test("科研实景手机触摸横滑切图，竖滑滚页，不误开大图", async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== "chromium", "原生触摸事件通过 Chromium 验证");
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await openCarousel(page);
  const cdp = await context.newCDPSession(page);
  const box = (await carousel(page).locator(".research-carousel-viewport").boundingBox())!;
  const y = box.y + box.height / 2;
  async function swipe(x1: number, y1: number, x2: number, y2: number) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1, id: 1 }] });
    for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + (x2 - x1) * step / 8, y: y1 + (y2 - y1) * step / 8, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await swipe(box.x + box.width - 30, y, box.x + 30, y);
  await expect(count(page)).toHaveText("2 / 5");
  await swipe(box.x + 30, y, box.x + box.width - 30, y);
  await expect(count(page)).toHaveText("1 / 5");
  expect(context.pages()).toHaveLength(1);
  const before = await page.evaluate(() => scrollY);
  await swipe(box.x + box.width / 2, y + 45, box.x + box.width / 2, y - 55);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await expect(count(page)).toHaveText("1 / 5");
  await context.close();
});
