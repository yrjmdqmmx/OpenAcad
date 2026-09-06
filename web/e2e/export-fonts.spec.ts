import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function evidence(name: string, details: Record<string, unknown>) {
  await mkdir("../tests/artifacts/export-fonts", { recursive: true });
  await writeFile(`../tests/artifacts/export-fonts/${name}.json`, JSON.stringify({
    checkedAt: new Date().toISOString(),
    environment: "本地 Chromium 浏览器；字体或任务响应按专项条件控制",
    ...details,
    passed: true,
  }, null, 2) + "\n");
}

test("字体准备期间取消不会提交或延迟下载，随后可以正常导出", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "本次专项只运行 Chromium");
  const fonts = gate();
  let fontRequests = 0, posts = 0, downloads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/jobs") && request.method() === "POST") posts++;
  });
  page.on("download", () => { downloads++; });
  await page.route(/\/fonts\/.*\.(?:otf|woff2)(?:\?.*)?$/, async (route) => {
    fontRequests++;
    await fonts.promise;
    await route.continue();
  });
  try {
    await page.goto("/#editor/bar", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".figure-paper svg").first()).toBeVisible();
    await expect.poll(() => fontRequests).toBeGreaterThan(0);
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    await page.getByRole("combobox", { name: "图片格式", exact: true }).selectOption("png");
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("正在准备图表字体…");
    await page.getByRole("button", { name: "取消导出", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("已取消导出。");
    await expect(page.getByRole("button", { name: "下载图片", exact: true })).toBeEnabled();
    expect(posts).toBe(0);
    fonts.release();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(requestAnimationFrame);
    });
    expect(downloads).toBe(0);
    expect(posts).toBe(0);
    await page.getByRole("combobox", { name: "图片格式", exact: true }).selectOption("svg");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    const file = await download;
    const svg = await readFile((await file.path())!, "utf8");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("<text");
    expect(downloads).toBe(1);
    expect(posts).toBe(0);
    await evidence("cancel-font-preparation", { fontRequests, posts, downloads, lateDownload: false, retrySvgBytes: Buffer.byteLength(svg) });
  } finally {
    fonts.release();
  }
});

test("当前SVG下载不等待无关页面字体", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "本次专项只运行 Chromium");
  const unrelated = gate(), requested = gate();
  await page.route("**/fonts/unrelated-export-regression.woff2", async (route) => {
    requested.release();
    await unrelated.promise;
    await route.abort("failed");
  });
  try {
    await page.goto("/#editor/bar");
    await expect(page.locator(".figure-paper svg").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const face = new FontFace("Unrelated Export Regression", 'url("/fonts/unrelated-export-regression.woff2")');
      document.fonts.add(face);
      void face.load().catch(() => {});
    });
    await requested.promise;
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loading");
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    const download = page.waitForEvent("download", { timeout: 5000 });
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.svg$/);
    expect(await page.evaluate(() => document.fonts.status)).toBe("loading");
    await evidence("unrelated-font", { unrelatedFontStillLoadingAtDownload: true, filename: file.suggestedFilename() });
  } finally {
    unrelated.release();
  }
});

test("POST返回前取消后会删除迟到任务且不轮询或下载", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "本次专项只运行 Chromium");
  const response = gate(), submitted = gate();
  let deletes = 0, polls = 0, downloads = 0;
  page.on("download", () => { downloads++; });
  await page.route("**/api/jobs", async (route) => {
    expect(route.request().method()).toBe("POST");
    submitted.release();
    await response.promise;
    await route.fulfill({ status: 202, json: { id: "export-cancel-regression", token: "simulated-test-token", status: "queued" } });
  });
  await page.route("**/api/jobs/export-cancel-regression", async (route) => {
    if (route.request().method() === "DELETE") {
      deletes++;
      await route.fulfill({ status: 204 });
    } else {
      polls++;
      await route.fulfill({ json: { id: "export-cancel-regression", status: "failed", error: "本测试不应轮询" } });
    }
  });
  try {
    await page.goto("/#editor/bar");
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    await page.getByRole("combobox", { name: "图片格式", exact: true }).selectOption("png");
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    await submitted.promise;
    await page.getByRole("button", { name: "取消导出", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("已取消导出。");
    // Start a new local export before the previous POST response returns.
    // The previous attempt must never clear or overwrite the newer attempt.
    await page.getByRole("combobox", { name: "图片格式", exact: true }).selectOption("svg");
    const retry = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    await retry;
    response.release();
    await expect.poll(() => deletes).toBe(1);
    expect(polls).toBe(0);
    expect(downloads).toBe(1);
    await expect(page.getByRole("status")).toContainText("SVG 已下载");
    await evidence("cancel-pending-post", { deletes, polls, downloads, lateRemoteDownload: false, retryPreserved: true });
  } finally {
    response.release();
  }
});

test("当前图表字体请求失败时明确提示且不提交导出", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "本次专项只运行 Chromium");
  let posts = 0, downloads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/jobs") && request.method() === "POST") posts++;
  });
  page.on("download", () => { downloads++; });
  await page.route(/\/fonts\/.*\.(?:otf|woff2)(?:\?.*)?$/, (route) => route.abort("failed"));
  await page.goto("/#editor/bar", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "导出图片", exact: true }).click();
  await page.getByRole("button", { name: "下载图片", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("图表字体加载失败");
  await expect(page.getByRole("button", { name: "下载图片", exact: true })).toBeEnabled();
  expect(posts).toBe(0);
  expect(downloads).toBe(0);
  await evidence("font-load-failure", { posts, downloads, message: await page.getByRole("alert").innerText() });
});


test("保留文字的SVG下载保存真实字重匹配且不改预览", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "静态字重匹配专项使用 Chromium");
  await page.goto("/#editor/heatmap");
  const title = page.locator('.figure-paper text[font-weight="650"]').first();
  await expect(title).toBeVisible();
  const text = await title.textContent();
  await page.getByRole("button", { name: "导出图片", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载图片", exact: true }).click();
  const downloaded = await pending;
  const content = await readFile((await downloaded.path())!, "utf8");
  const weights = await page.evaluate(({ content, text }) => {
    const svg = new DOMParser().parseFromString(content, "image/svg+xml");
    if (svg.querySelector("parsererror")) throw new Error("导出SVG无法解析");
    const nodes = [...svg.querySelectorAll<SVGElement>("text")];
    const title = nodes.find((node) => node.textContent === text);
    return { title: title?.style.fontWeight, normal: nodes.filter((node) => node.style.fontWeight === "400").length };
  }, { content, text });
  expect(weights.title).toBe("700");
  expect(weights.normal).toBeGreaterThan(0);
  await expect(title).toHaveAttribute("font-weight", "650");
  await evidence("static-weight-svg", { originalTitleWeight: 650, exportedTitleWeight: 700, normalTextCount: weights.normal, browserPreviewUnmodified: true });
});
