import { test, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
test("常规示例样式更新响应时间", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  const rows = [];
  for (const id of [
    "bar",
    "line",
    "scatter",
    "box",
    "heatmap",
    "sankey",
    "network",
    "map",
    "pca",
    "tree-normal",
  ]) {
    await page.goto("/#editor/" + id);
    await page.evaluate(() => document.fonts.ready);
    const start = Date.now();
    await page
      .getByRole("textbox", { name: "标题", exact: true })
      .fill("样式响应检验");
    await expect(page.locator(".figure-paper")).toContainText("样式响应检验");
    rows.push({ template: id, milliseconds: Date.now() - start });
  }
  const ms = rows.map((r) => r.milliseconds).sort((a, b) => a - b);
  const result = {
    note: "同一本机Chrome，常规模拟示例，测量填入标题到预览出现的总耗时（包含自动化交互开销），不代表大数据或统计计算时延。",
    rows,
    p95: ms[Math.ceil(ms.length * 0.95) - 1],
    target: 300,
  };
  await mkdir("../tests/artifacts", { recursive: true });
  await writeFile(
    "../tests/artifacts/style-performance.json",
    JSON.stringify(result, null, 2),
  );
  expect(result.p95).toBeLessThanOrEqual(300);
});
