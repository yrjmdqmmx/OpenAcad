import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import type { Project } from "../src/core/types";

const cases: { id: string; name: string; project: Project }[] = JSON.parse(readFileSync("../tests/artifacts/template-cases.json", "utf8"));
const expectedDataset = (project: Project) => project.dataset.tables.length
  ? { tables: project.dataset.tables.filter(table => !table.role.startsWith("raw-")) }
  : project.dataset;

// Math.sin-generated fixtures can differ by one ULP between V8 and WebKit.
// Check their numeric baseline within 1e-13 relative tolerance, then check the
// same browser's visible cells, actual download and saved project exactly.
function expectFixtureRows(actual: (string | number | null)[][], expected: (string | number | null)[][]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((row, i) => {
    expect(actual[i]).toHaveLength(row.length);
    row.forEach((value, j) => {
      if (typeof value === "number") expect(Math.abs(Number(actual[i][j]) - value)).toBeLessThanOrEqual(Math.max(1, Math.abs(value)) * 1e-13);
      else expect(String(actual[i][j] ?? "")).toBe(String(value ?? ""));
    });
  });
}

const shownSheets = async (page: import("@playwright/test").Page) => page.locator(".example-sheet").evaluateAll(sheets => sheets.map(sheet => ({
  role: sheet.getAttribute("data-sheet-role"),
  columns: Array.from(sheet.querySelectorAll("thead tr:last-child th")).slice(1).map(cell => cell.textContent || ""),
  rows: Array.from(sheet.querySelectorAll("tbody tr")).map(row => Array.from(row.querySelectorAll("td")).map(cell => cell.textContent || "")),
  fields: Array.from(sheet.querySelectorAll(".example-field dt strong")).map(field => field.textContent || ""),
})));

test("全部图表详情：两部分结构、逐表完整数据、字段与示例图", async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const item of cases) {
    await page.goto(`/#template/${item.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.name);
    await expect(page.locator("main h2")).toHaveText(["图表介绍", "如何使用"]);
    await expect(page.locator(".chart-error, vite-error-overlay")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("示例来源");
    const svg = page.locator(".detail-figure-scroll > svg[data-chart]");
    await expect(svg).toBeVisible();
    expect(await svg.innerHTML()).not.toMatch(/NaN|Infinity/);
    const expected = expectedDataset(item.project);
    const actual = await shownSheets(page);
    expect(actual, item.id).toHaveLength(expected.tables.length);
    expected.tables.forEach((table, index) => {
      expect(actual[index].role).toBe(table.role);
      expect(actual[index].columns).toEqual(table.columns);
      expect(actual[index].fields).toEqual(table.columns);
      expectFixtureRows(actual[index].rows, table.rows);
    });
    if (expected.text) await expect(page.getByLabel("完整示例树文本")).toHaveText(expected.text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), item.id).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.goto("/#template/bar-grouped");
  await page.screenshot({ path: info.outputPath("detail-overview.png"), fullPage: true });
});

for (const id of ["bar-grouped", "network", "correlation", "protein-domains", "protein-motifs", "genome-circos", "synteny", "cca", "tree-circle"]) {
  test(`${id}：实际下载、用示例开始与保存后的数据一致`, async ({ page }, info) => {
    const item = cases.find(item => item.id === id)!;
    const expected = expectedDataset(item.project);
    await page.goto(`/#template/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.name);
    const displayed = await shownSheets(page);
    const usage = page.getByRole("region", { name: "如何使用", exact: true });
    const downloading = page.waitForEvent("download");
    await usage.getByRole("button", { name: "下载示例数据", exact: true }).click();
    const download = await downloading;
    const bytes = await readFile((await download.path())!);
    if (expected.tables.length) {
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
      const book = XLSX.read(bytes, { type: "buffer" });
      expect(book.SheetNames).toHaveLength(expected.tables.length);
      expected.tables.forEach((table, index) => {
        const cells = XLSX.utils.sheet_to_json<(string | number | null)[]>(book.Sheets[book.SheetNames[index]], { header: 1, raw: true, defval: "" });
        expectFixtureRows(cells, [table.columns, ...table.rows]);
        expect(cells.map(row => row.map(value => String(value ?? "")))).toEqual([displayed[index].columns, ...displayed[index].rows]);
      });
    } else {
      expect(download.suggestedFilename()).toMatch(/\.nwk$/);
      expect(bytes.toString()).toBe(expected.text);
    }
    await usage.getByRole("button", { name: "用示例开始", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#editor/${id}$`));
    await expect(page.locator(".chart-error")).toHaveCount(0);
    const saving = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    const saved = await saving;
    const project = JSON.parse(await readFile((await saved.path())!, "utf8"));
    if (expected.tables.length) {
      expect(Object.keys(project.dataset)).toEqual(["tables"]);
      expect(project.dataset.tables).toHaveLength(expected.tables.length);
      project.dataset.tables.forEach((table: Project["dataset"]["tables"][number], index: number) => {
        expect({ ...table, rows: [] }).toEqual({ ...expected.tables[index], rows: [] });
        expect(table.rows.map(row => row.map(value => String(value ?? "")))).toEqual(displayed[index].rows);
      });
    } else expect(project.dataset).toEqual(expected);
    expect(project.analysis).toEqual(item.project.analysis);
    if (id === "bar-grouped") {
      if (info.project.name === "mobile") await page.locator(".mobile-tabs").getByRole("button", { name: "数据", exact: true }).click();
      const cell = page.getByRole("textbox", { name: /第 2 行第 2 列$/, exact: true });
      await cell.fill("80");
      await page.locator("input[type=file]").first().setInputFiles((await saved.path())!);
      if (info.project.name === "mobile") await page.locator(".mobile-tabs").getByRole("button", { name: "数据", exact: true }).click();
      await expect(page.getByRole("textbox", { name: /第 2 行第 2 列$/, exact: true })).toHaveValue(String(expected.tables[0].rows[0][1]));
      await page.getByRole("button", { name: "导出图片", exact: true }).click();
      const exporting = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载图片", exact: true }).click();
      const exportFile = await exporting;
      const svg = await readFile((await exportFile.path())!, "utf8");
      expect(svg).toContain("<svg");
      expect(svg).toContain(String(expected.tables[0].rows[0][2]));
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
}

test("预览图适应宽度并可放大，表内滚动不撑宽手机页面", async ({ page }, info) => {
  await page.goto("/#template/enrichment-circle");
  const figure = page.locator(".detail-figure-scroll");
  expect(await figure.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "放大查看", exact: true }).click();
  await expect(page.getByRole("button", { name: "适应宽度", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "适应宽度", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const sheet = page.locator(".example-grid-scroll");
  await sheet.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("detail-worksheet.png") });
});

for (const id of ["network", "protein-domains"]) {
  test(`${id}：照说明重新导入下载的多工作表并指定角色`, async ({ page }, info) => {
    const item = cases.find(item => item.id === id)!;
    const expected = expectedDataset(item.project);
    await page.goto(`/#template/${id}`);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载示例数据", exact: true }).click();
    const download = await downloading;
    const bytes = await readFile((await download.path())!);
    await page.getByRole("button", { name: "用示例开始", exact: true }).click();
    if (info.project.name === "mobile") await page.locator(".mobile-tabs").getByRole("button", { name: "数据", exact: true }).click();
    const before = await page.locator(".figure-paper > svg").innerHTML();
    await page.locator(".data-panel input[type=file]").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes });
    await page.getByRole("button", { name: "导入所选内容", exact: true }).click();
    for (const [index, table] of expected.tables.entries()) {
      await page.getByLabel("选择数据表", { exact: true }).selectOption(String(index));
      await page.locator(".role-row select").selectOption(table.role);
    }
    await expect(page.locator(".data-panel [role=alert]")).toHaveCount(0);
    await expect(page.locator(".chart-error")).toHaveCount(0);
    await expect.poll(() => page.locator(".figure-paper > svg").innerHTML()).toBe(before);
    const saving = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    const saved = JSON.parse(await readFile((await (await saving).path())!, "utf8"));
    expected.tables.forEach((table, index) => {
      expect(saved.dataset.tables[index].role).toBe(table.role);
      expect(saved.dataset.tables[index].columns).toEqual(table.columns);
      expect(saved.dataset.tables[index].rows).toEqual(table.rows);
    });
  });
}
