import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const ids = [
  "heatmap",
  "circle-heatmap",
  "binary-dot",
  "binary-rect",
  "bubble-matrix",
  "correlation",
  "double-correlation",
  "mantel",
  "venn",
  "packing",
  "sankey",
  "network",
  "map",
  "gene-cluster",
  "protein-domains",
  "protein-motifs",
  "genome-circos",
  "volcano",
  "enrichment-dot",
  "enrichment-bar",
  "enrichment-circle",
  "synteny",
];
const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }),
  context = await browser.newContext({
    viewport: { width: 1720, height: 1100 },
    acceptDownloads: true,
  }),
  page = await context.newPage(),
  folder = new URL("./evidence/", import.meta.url),
  results = [];
for (const id of ids) {
  try {
    await page.goto(`http://127.0.0.1:5178/#editor/${id}`);
    await page.locator(`svg[data-chart="${id}"]`).waitFor();
    const box = await page.locator(`svg[data-chart="${id}"]`).evaluate((s) => {
      const b = s.getBBox();
      return {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        svgWidth: +s.getAttribute("width"),
        svgHeight: +s.getAttribute("height"),
      };
    });
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    const dl = page.waitForEvent("download", { timeout: 3500 });
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    const download = await dl;
    const path = new URL(`${id}.svg`, folder).pathname;
    await download.saveAs(path);
    const svg = await fs.readFile(path, "utf8");
    if (!svg.includes('xmlns="http://www.w3.org/2000/svg"'))
      throw new Error("SVG 缺少命名空间");
    const opened = await context.newPage();
    await opened.goto("file://" + path);
    await opened.locator("svg").first().waitFor();
    if (await opened.locator("parsererror").count())
      throw new Error("浏览器报告 SVG XML 解析错误");
    await opened.close();
    results.push({
      id,
      svgDownload: true,
      reopenedInChrome: true,
      box,
      bytes: svg.length,
    });
    console.log(id, "SVG PASS");
  } catch (e) {
    results.push({ id, error: e.message });
    console.log(id, e.message);
  }
}
try {
  await page.goto("http://127.0.0.1:5178/#editor/network");
  const node = page
    .locator('svg[data-chart=network] g[style*="cursor: grab"]')
    .first();
  await node.waitFor();
  const before = await node.getAttribute("transform"),
    box = await node.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 50,
    box.y + box.height * 0.25 + 35,
    { steps: 6 },
  );
  await page.mouse.up();
  await page.waitForTimeout(80);
  const after = await node.getAttribute("transform");
  if (before === after) throw new Error("节点拖动位置未改变");
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  const download = await wait,
    path = await download.path(),
    p = JSON.parse(await fs.readFile(path, "utf8"));
  if (!Object.keys(p.layout.nodePositions ?? {}).length)
    throw new Error("节点坐标未进入项目");
  await page.locator(".site-header input[type=file]").setInputFiles(path);
  await page.waitForTimeout(150);
  if (
    (await page
      .locator('svg[data-chart=network] g[style*="cursor: grab"]')
      .first()
      .getAttribute("transform")) !== after
  )
    throw new Error("重开后节点坐标没有恢复");
  results.push({
    id: "network-drag",
    before,
    after,
    persisted: p.layout.nodePositions,
  });
  console.log("network DRAG PASS");
} catch (e) {
  results.push({ id: "network-drag", error: e.message });
}
for (const id of ["protein-domains", "protein-motifs", "synteny"]) {
  try {
    await page.goto(`http://127.0.0.1:5178/#editor/${id}`);
    const svg = page.locator(`svg[data-chart="${id}"]`);
    await svg.waitFor();
    const before = await svg.evaluate((s) => s.outerHTML);
    await page.getByLabel(/输入模式/).selectOption("native");
    await page.waitForTimeout(80);
    if (await page.locator(".chart-error").count())
      throw new Error(await page.locator(".chart-error").innerText());
    const after = await svg.evaluate((s) => s.outerHTML);
    if (before === after && id !== "synteny")
      throw new Error("原格式未改变图形");
    await page
      .getByRole("button", { name: "试用另一组数据", exact: true })
      .click();
    await page.waitForTimeout(60);
    if (await page.locator(".chart-error").count())
      throw new Error(await page.locator(".chart-error").innerText());
    results.push({ id: `${id}-native`, native: true, alternateNative: true });
    console.log(id, "NATIVE PASS");
  } catch (e) {
    results.push({ id: `${id}-native`, error: e.message });
  }
}
await fs.writeFile(
  new URL("browser-interactions.json", folder),
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
);
await browser.close();
