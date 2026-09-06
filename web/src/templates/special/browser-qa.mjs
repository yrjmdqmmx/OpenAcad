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
const folder = new URL("./evidence/", import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const context = await browser.newContext({
  viewport: { width: 1720, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
const report = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const id of ids) {
  const record = { id };
  report.push(record);
  try {
    await page.goto(`http://127.0.0.1:5178/#editor/${id}`);
    const svg = page.locator(`svg[data-chart="${id}"]`);
    await svg.waitFor();
    const before = await svg.evaluate((e) => e.outerHTML);
    const clipped = await svg.evaluate((svg) => {
      const b = svg.getBoundingClientRect();
      return [...svg.querySelectorAll("text")]
        .filter((e) => !e.closest("[clip-path]"))
        .map((e) => ({ text: e.textContent, b: e.getBoundingClientRect() }))
        .filter(
          ({ b: r }) =>
            r.width > 0 &&
            (r.left < b.left - 2 ||
              r.right > b.right + 2 ||
              r.top < b.top - 2 ||
              r.bottom > b.bottom + 2),
        )
        .map(({ text, b: r }) => ({
          text,
          left: r.left - b.left,
          right: r.right - b.left,
          top: r.top - b.top,
          bottom: r.bottom - b.top,
          canvasWidth: b.width,
          canvasHeight: b.height,
        }));
    });
    record.clipped = clipped;
    if (
      [
        "heatmap",
        "circle-heatmap",
        "mantel",
        "network",
        "map",
        "gene-cluster",
        "protein-domains",
        "genome-circos",
        "enrichment-circle",
        "synteny",
      ].includes(id)
    )
      await page
        .locator(".figure-paper")
        .screenshot({ path: new URL(`${id}.png`, folder).pathname });
    await page
      .getByRole("button", { name: "试用另一组数据", exact: true })
      .click();
    await page.waitForTimeout(100);
    const alternate = await svg.evaluate((e) => e.outerHTML);
    if (before === alternate) throw new Error("替换数据后 SVG 未改变");
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await page.waitForTimeout(80);
    const undone = await svg.evaluate((e) => e.outerHTML);
    if (before !== undone) throw new Error("撤销未恢复原图");
    await page
      .getByRole("textbox", { name: "标题", exact: true })
      .fill(`浏览器核验 ${id}`);
    await page.waitForTimeout(60);
    if (!(await svg.textContent().then((x) => x.includes(`浏览器核验 ${id}`))))
      throw new Error("标题未生效");
    const wait = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    const download = await wait;
    const file = await download.path();
    const p = JSON.parse(await fs.readFile(file, "utf8"));
    if (p.templateId !== id || !p.dataset?.tables)
      throw new Error("项目文件不完整");
    await page
      .getByRole("textbox", { name: "标题", exact: true })
      .fill("待重新打开");
    await page.locator(".site-header input[type=file]").setInputFiles(file);
    await page.waitForTimeout(120);
    if (!(await svg.textContent().then((x) => x.includes(`浏览器核验 ${id}`))))
      throw new Error("项目重新打开未恢复样式");
    Object.assign(record, {
      example: true,
      alternate: true,
      undo: true,
      title: true,
      projectDownload: true,
      projectReopen: true,
      clipped,
    });
    console.log(
      id,
      clipped.length
        ? "CLIPPED " + clipped.map((x) => x.text).join(" | ")
        : "PASS",
    );
  } catch (e) {
    Object.assign(record, { error: e.message });
    console.log(id, "ERROR", e.message);
  }
}
await fs.writeFile(
  new URL("browser-qa.json", folder),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      url: "http://127.0.0.1:5178",
      browser: "installed Google Chrome; separate headless context",
      report,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
