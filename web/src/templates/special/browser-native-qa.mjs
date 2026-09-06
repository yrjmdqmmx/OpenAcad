import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }),
  page = await browser.newPage({ viewport: { width: 1720, height: 1100 } }),
  results = [];
for (const id of ["protein-domains", "protein-motifs", "synteny"]) {
  try {
    await page.goto(`http://127.0.0.1:5178/#editor/${id}`);
    const svg = page.locator(`svg[data-chart="${id}"]`);
    await svg.waitFor();
    const before = await svg.evaluate((s) => s.outerHTML);
    await page
      .locator(".right-panel label")
      .filter({ hasText: /^输入模式/ })
      .locator("select")
      .selectOption("native");
    await page.waitForTimeout(120);
    if (await page.locator(".chart-error").count())
      throw new Error(await page.locator(".chart-error").innerText());
    const after = await svg.evaluate((s) => s.outerHTML);
    if (before === after && id !== "synteny")
      throw new Error("原格式未改变图形");
    await page
      .getByRole("button", { name: "试用另一组数据", exact: true })
      .click();
    await page.waitForTimeout(100);
    if (await page.locator(".chart-error").count())
      throw new Error(await page.locator(".chart-error").innerText());
    results.push({ id: `${id}-native`, native: true, alternateNative: true });
    console.log(id, "NATIVE PASS");
  } catch (e) {
    results.push({ id: `${id}-native`, error: e.message });
    console.log(id, e.message);
  }
}
const path = new URL("./evidence/browser-interactions.json", import.meta.url),
  report = JSON.parse(await fs.readFile(path, "utf8"));
report.results = report.results
  .filter((x) => !x.id.endsWith("-native"))
  .concat(results);
report.nativeRerunDate = new Date().toISOString();
await fs.writeFile(path, JSON.stringify(report, null, 2));
await browser.close();
