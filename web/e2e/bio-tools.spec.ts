import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
const golden = JSON.parse(readFileSync(new URL("../src/bio/__fixtures__/biopython-golden.json", import.meta.url), "utf8"));

test("AB1 真实文件导入、定位、缩放、拖动、联动及三种实际导出", async ({ page }, info) => {
  const errors: string[] = [], posts: string[] = [];
  page.on("pageerror", e => errors.push(e.message)); page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/#bio/ab1");
  await expect(page.getByRole("heading", { name: "AB1 测序文件查看器", exact: true })).toBeVisible();
  await page.getByLabel("AB1 文件", { exact: true }).setInputFiles(resolve("public/examples/bio/3730.ab1"));
  await expect(page.getByLabel("完整碱基序列", { exact: true })).toHaveValue(golden.samples["3730"].sequence);
  await expect(page.locator(".ab1-plot [data-channel]")).toHaveCount(4);
  await page.getByLabel("每屏碱基", { exact: true }).selectOption("30");
  await page.getByRole("spinbutton", { name: "定位碱基", exact: true }).fill("100");
  await page.getByRole("button", { name: "定位", exact: true }).click();
  await expect(page.getByTestId("ab1-selection")).toContainText("第 100 位 · G");
  await expect(page.getByTestId("ab1-selection")).toContainText("Q50");
  await expect(page.getByTestId("ab1-selection")).toContainText("1279");
  await expect(page.getByTestId("ab1-selection")).toContainText("G：651");
  await page.getByRole("button", { name: "碱基 101 C", exact: true }).click();
  await expect(page.getByTestId("ab1-selection")).toContainText("第 101 位 · C");
  const markerX = await page.getByTestId("selected-peak").getAttribute("x1");
  expect(Number(markerX)).toBeGreaterThan(38);
  await page.locator('.ab1-plot [data-quality-index="100"]').click();
  await expect(page.getByTestId("ab1-selection")).toContainText("第 100 位 · G");
  await page.locator(".ab1-plot svg").click({ position: { x: Number(markerX), y: 140 } });
  await expect(page.getByTestId("ab1-selection")).toContainText("第 101 位 · C");
  const svg = page.locator(".ab1-plot svg"); await svg.scrollIntoViewIfNeeded(); const rect = (await svg.boundingBox())!;
  const before = await page.getByRole("slider", { name: "横向移动查看区域" }).inputValue();
  await page.mouse.move(rect.x + rect.width * .6, rect.y + 130); await page.mouse.down(); await page.mouse.move(rect.x + rect.width * .3, rect.y + 130, { steps: 8 }); await page.mouse.up();
  expect(Number(await page.getByRole("slider", { name: "横向移动查看区域" }).inputValue())).toBeGreaterThan(Number(before));
  for (const [button, extension] of [["区域 SVG", "svg"], ["区域 PNG", "png"], ["导出 FASTA", "fasta"]]) {
    const pending = page.waitForEvent("download"); await page.getByRole("button", { name: button, exact: true }).click(); const dl = await pending;
    const path = info.outputPath(`ab1-export.${extension}`); await dl.saveAs(path); const bytes = await readFile(path);
    if (extension === "fasta") expect(bytes.toString().split("\n").slice(1).join("")).toBe(golden.samples["3730"].sequence);
    if (extension === "svg") { expect(bytes.toString()).toContain('data-channel="A"'); expect(bytes.toString()).not.toMatch(/NaN|Infinity/); expect(bytes.toString()).toContain("碱基"); }
    if (extension === "png") { expect(bytes.subarray(1, 4).toString()).toBe("PNG"); expect(bytes.readUInt32BE(16)).toBeGreaterThan(400); expect(bytes.readUInt32BE(20)).toBe(700); }
  }
  await expect(page.locator("vite-error-overlay")).toHaveCount(0); expect(errors).toEqual([]); expect(posts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("ab1-result.png"), fullPage: true });
});

test("AB1 损坏文件、缺失质量字段与导航返回保留", async ({ page }) => {
  await page.goto("/#bio/ab1"); await page.getByRole("button", { name: "打开真实样例", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3730.ab1", exact: true })).toBeVisible();
  await page.getByLabel("AB1 文件", { exact: true }).setInputFiles({ name: "broken.ab1", mimeType: "application/octet-stream", buffer: Buffer.from("ABIF broken") });
  await expect(page.getByRole("alert")).toContainText("文件损坏"); await expect(page.getByLabel("完整碱基序列", { exact: true })).toHaveValue(golden.samples["3730"].sequence);
  const bytes = await readFile(resolve("public/examples/bio/3730.ab1")), root = bytes.readUInt32BE(26), total = bytes.readUInt32BE(18);
  for (let i = 0; i < total; i++) { const p = root + i * 28; if (bytes.toString("ascii", p, p + 4) === "PCON" && bytes.readUInt32BE(p + 4) === 2) bytes.write("TEST", p); }
  await page.getByLabel("AB1 文件", { exact: true }).setInputFiles({ name: "missing-quality.ab1", mimeType: "application/octet-stream", buffer: bytes });
  await expect(page.getByText(/质量字段 PCON 缺失/)).toBeVisible(); await expect(page.getByTestId("ab1-selection")).toContainText("质量值：缺失");
  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "首页", exact: true }).click();
  await page.getByRole("link", { name: "AB1 测序文件查看器", exact: true }).click();
  await expect(page.getByRole("heading", { name: "missing-quality.ab1", exact: true })).toBeVisible();
});

test("KO Excel列选择、部分失败重试、原行保留、筛选与实际导出", async ({ page }, info) => {
  const requests: string[][] = []; let attempts = 0;
  await page.route("**/api/bio/ko-pathways", async route => {
    const body = route.request().postDataJSON(); expect(Object.keys(body)).toEqual(["ids"]); requests.push(body.ids); attempts++;
    await route.fulfill({ json: { results: body.ids.map((ko: string) => ({ ko, status: ko === "K99999" ? "unmatched" : (ko === "K00844" && attempts === 1 ? "failed" : "matched"), pathways: ko === "K99999" || (ko === "K00844" && attempts === 1) ? [] : [{ id: "map00010", name: "Glycolysis / Gluconeogenesis", classification: "Metabolism; Carbohydrate metabolism" }, { id: "map00620", name: "Pyruvate metabolism" }], fetchedAt: "2026-09-07T11:00:00Z", sourceUrl: `https://rest.kegg.jp/get/ko:${ko}`, message: ko === "K00844" && attempts === 1 ? "模拟网络失败" : "" })), warnings: [] } });
  });
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["说明"], ["模拟数据"]]), "说明");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["gene", "other", "KO"], ["a", 12, "K00001"], ["b", 30, "ko:K00001;K00844;K00001"], ["c", 0, "BAD"], ["d", 6, ""], ["e", 8, "K99999"]]), "KO数据");
  await page.goto("/#bio/ko");
  await page.getByLabel("KO 表格文件", { exact: true }).setInputFiles({ name: "test.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { bookType: "xlsx", type: "buffer" }) });
  await page.getByLabel("工作表", { exact: true }).selectOption("1"); await page.getByLabel("KO 所在列", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "开始转换", exact: true }).click(); await expect(page.getByRole("button", { name: "重试失败及待查询项", exact: true })).toBeVisible();
  expect(requests[0]).toEqual(["K00001", "K00844", "K99999"]);
  const table = page.getByLabel("KO pathway 结果", { exact: true });
  await expect(table).toContainText("模拟网络失败"); await expect(table).toContainText("编号无效"); await expect(table).toContainText("空值"); await expect(table).toContainText("未匹配");
  await page.getByRole("button", { name: "重试失败及待查询项", exact: true }).click();
  await expect(page.getByRole("button", { name: "重试失败及待查询项", exact: true })).toHaveCount(0); expect(requests[1]).toEqual(["K00844"]);
  await page.getByLabel("匹配状态", { exact: true }).selectOption("matched"); await page.getByLabel("检索结果", { exact: true }).fill("K00001");
  // 全文搜索也覆盖原KO单元格：同一原行的K00844展开行仍命中K00001。
  await expect(table.locator("tbody tr")).toHaveCount(6);
  for (const [name, ext] of [["导出 CSV", "csv"], ["导出 Excel", "xlsx"]]) {
    const pending = page.waitForEvent("download"); await page.getByRole("button", { name, exact: true }).click(); const dl = await pending; const path = info.outputPath("ko-filtered." + ext); await dl.saveAs(path);
    const bytes = await readFile(path); const workbook = XLSX.read(bytes, { type: "buffer", raw: true }); const cells = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as unknown[][];
    expect(cells).toHaveLength(7); expect(cells[0]).toContain("原表[2]·other"); expect(cells[1].map(String)).toContain("12");
    if (ext === "xlsx") expect(workbook.SheetNames).toContain("来源与规则");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("ko-result.png"), fullPage: true });
});

test("KO 粘贴、CSV、TSV和空输入错误", async ({ page }) => {
  await page.goto("/#bio/ko"); await page.getByRole("button", { name: "读取粘贴内容", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("粘贴");
  await page.getByLabel("或粘贴 KO 列表 / 表格", { exact: true }).fill("K00001\nK00844\nBAD\n\nK99999"); await page.getByRole("button", { name: "读取粘贴内容", exact: true }).click();
  await expect(page.getByLabel("输入表格预览", { exact: true }).locator("tbody tr")).toHaveCount(5);
  for (const [name, text] of [["test.csv", 'id,KO,note\na,K00001,"one,two"\nb,,missing'], ["test.tsv", "id\tKO\tnote\na\tK00001\t中文\nb\t\t空值"]]) {
    await page.getByLabel("KO 表格文件", { exact: true }).setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) }); await expect(page.getByLabel("KO 所在列", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("输入表格预览", { exact: true }).locator("tbody tr")).toHaveCount(2);
  }
  await page.getByLabel("KO 表格文件", { exact: true }).setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("broken") }); await expect(page.getByRole("alert")).toContainText("不支持");
});

test("KO 批次停止保留完成结果并可恢复", async ({ page }) => {
  let called = 0;
  await page.route("**/api/bio/ko-pathways", async route => {
    called++;
    if (called === 2) { await new Promise(resolve => setTimeout(resolve, 800)); await route.abort().catch(() => {}); return; }
    const ids = route.request().postDataJSON().ids;
    await route.fulfill({ json: { results: ids.map((ko: string) => ({ ko, status: "unmatched", pathways: [], fetchedAt: "2026-09-07T00:00:00Z", sourceUrl: "https://rest.kegg.jp", message: "模拟未匹配" })), warnings: [] } });
  });
  await page.goto("/#bio/ko"); await page.getByLabel("或粘贴 KO 列表 / 表格", { exact: true }).fill(Array.from({ length: 12 }, (_, i) => `K${String(i + 1).padStart(5, "0")}`).join("\n")); await page.getByRole("button", { name: "读取粘贴内容", exact: true }).click();
  await page.getByRole("button", { name: "开始转换", exact: true }).click(); await expect.poll(() => called).toBe(2); await page.getByRole("button", { name: "停止查询", exact: true }).click();
  await expect(page.getByRole("button", { name: "重试失败及待查询项", exact: true })).toBeVisible();
  expect(await page.locator(".ko-stats div").filter({ hasText: "未匹配 KO" }).locator("dd").innerText()).toBe("10");
  await page.getByRole("button", { name: "重试失败及待查询项", exact: true }).click(); await expect(page.locator(".ko-stats div").filter({ hasText: "未匹配 KO" }).locator("dd")).toHaveText("12");
});

test("AB1 手机原生触摸平移，竖向滑动保留页面滚动", async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== "chromium", "原生触摸输入用 Chromium CDP；其他浏览器覆盖按钮、定位、滑块及拖动");
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/#bio/ab1"); await page.getByRole("button", { name: "打开真实样例", exact: true }).click();
  const plot = page.locator(".ab1-plot svg"); await expect(plot).toBeVisible(); await plot.scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(page);
  async function swipe(x1: number, y1: number, x2: number, y2: number) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1, id: 1 }] });
    for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + (x2 - x1) * step / 8, y: y1 + (y2 - y1) * step / 8, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  const box = (await plot.boundingBox())!, y = box.y + 160;
  const slider = page.getByRole("slider", { name: "横向移动查看区域" });
  await swipe(box.x + box.width - 40, y, box.x + 40, y);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0);
  const position = await slider.inputValue(), scroll = await page.evaluate(() => scrollY);
  await swipe(box.x + box.width / 2, y + 40, box.x + box.width / 2, y - 80);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
  await expect(slider).toHaveValue(position);
  await context.close();
});

test("KO 真实 KEGG 已知对应关系与实时获取时间", async ({ page }, info) => {
  test.skip(!process.env.OPENACAD_LIVE_API, "需要本地生信查询服务与 KEGG 网络，OPENACAD_LIVE_API=1 开启");
  test.setTimeout(150000);
  await page.goto("/#bio/ko"); await page.getByRole("button", { name: "打开模拟示例", exact: true }).click(); await page.getByRole("button", { name: "开始转换", exact: true }).click();
  await expect(page.locator(".ko-stats div").filter({ hasText: "已匹配 KO" }).locator("dd")).toHaveText("2", { timeout: 120000 });
  await expect(page.locator(".ko-stats div").filter({ hasText: "未匹配 KO" }).locator("dd")).toHaveText("1");
  const table = page.getByLabel("KO pathway 结果", { exact: true }); await expect(table).toContainText("map00010"); await expect(table).toContainText("Glycolysis / Gluconeogenesis"); await expect(table).toContainText("Metabolism; Carbohydrate metabolism");
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "导出 Excel", exact: true }).click(); const dl = await pending; await dl.saveAs(info.outputPath("ko-live.xlsx"));
  await writeFile(info.outputPath("live-summary.txt"), await page.locator(".ko-stats").innerText());
});
