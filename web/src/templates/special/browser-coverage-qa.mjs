import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
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
async function open(id) {
  await page.goto(`http://127.0.0.1:5178/#editor/${id}`);
  await page.locator(`svg[data-chart="${id}"]`).waitFor();
}
async function save(label) {
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  const d = await wait;
  const path = new URL(`${label}.openacad.json`, folder).pathname;
  await d.saveAs(path);
  return { path, project: JSON.parse(await fs.readFile(path, "utf8")) };
}
async function svg(id, label) {
  const chart = page.locator(`svg[data-chart="${id}"]`);
  const box = await chart.evaluate((s) => {
    const r = s.getBBox();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      canvasWidth: +s.getAttribute("width"),
      canvasHeight: +s.getAttribute("height"),
    };
  });
  await page.getByRole("button", { name: "导出图片", exact: true }).click();
  const wait = page.waitForEvent("download", { timeout: 7000 });
  await page.getByRole("button", { name: "下载图片", exact: true }).click();
  const d = await wait;
  await d.saveAs(new URL(`${label}.svg`, folder).pathname);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .locator(".figure-paper")
    .screenshot({ path: new URL(`${label}.png`, folder).pathname });
  return box;
}

const choose = async (label, val) =>
  page
    .locator(".right-panel")
    .getByRole("combobox", { name: label, exact: true })
    .selectOption(val);
const toggle = async (label) =>
  page
    .locator(".right-panel label")
    .filter({ hasText: new RegExp("^" + label) })
    .locator("input[type=checkbox]")
    .check();
async function reopen(path) {
  await page.locator(".site-header input[type=file]").setInputFiles(path);
  await page.waitForTimeout(100);
}
async function caseRun(id, fn) {
  try {
    await open(id);
    await fn();
    console.log(id, "COVERAGE PASS");
  } catch (e) {
    results.push({ id, error: e.message });
    console.log(id, e.message);
  }
}
await caseRun("network", async () => {
  const initial = await save("network-coverage-input");
  const p = initial.project,
    edges = p.dataset.tables.find((t) => t.role === "edges"),
    first = p.dataset.tables.find((t) => t.role === "nodes").rows[0][0];
  edges.columns.push("label");
  edges.rows.forEach((r, i) => r.push("关系" + (i + 1)));
  edges.rows.push([first, first, 3, "自循环"]);
  await fs.writeFile(initial.path, JSON.stringify(p));
  await reopen(initial.path);
  await choose("连线配色", "source");
  await toggle("显示方向箭头");
  await toggle("显示边标签");
  await choose("节点形状", "star");
  await choose("布局", "circle");
  const s = await save("network-labeled-loops");
  expect(s.project.style.edgeColorMode).toBe("source");
  const edge = page.locator("[data-network-edge]");
  expect(await edge.last().textContent()).toContain("自循环");
  results.push({
    id: "network-labeled-loops",
    svg: true,
    box: await svg("network", "network-labeled-loops"),
  });
  const mapped = s.project,
    nodes = mapped.dataset.tables.find((t) => t.role === "nodes"),
    links = mapped.dataset.tables.find((t) => t.role === "edges");
  nodes.columns.push("shape");
  nodes.rows.forEach((r, i) => r.push(i % 2 ? "cross" : "triangle"));
  links.columns.push("group");
  links.rows.forEach((r, i) => r.push(i % 2 ? "抑制" : "激活"));
  await fs.writeFile(s.path, JSON.stringify(mapped));
  await reopen(s.path);
  await choose("节点形状依据", "column");
  await choose("连线配色", "group");
  const label = page.locator("[data-drag-label]").first(),
    lb = await label.boundingBox();
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.mouse.down();
  await page.mouse.move(lb.x + lb.width / 2 - 90, lb.y + lb.height / 2 - 35, {
    steps: 5,
  });
  await page.mouse.up();
  const m = await save("network-attribute-mappings");
  expect(Object.keys(m.project.layout.labelPositions).length).toBe(1);
  await reopen(m.path);
  expect(
    await page.locator('svg[data-chart="network"]').textContent(),
  ).toContain("边：激活");
  results.push({
    id: "network-attribute-mappings",
    labelDrag: true,
    projectReopen: true,
    svg: true,
    box: await svg("network", "network-attribute-mappings"),
  });
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "图层", exact: true })
    .click();
  await page.getByRole("button", { name: "清除手动位置", exact: true }).click();
  const reset = await save("network-layout-reset");
  expect(reset.project.layout.labelPositions).toBeUndefined();
});
await caseRun("sankey", async () => {
  await choose("流带颜色", "gradient");
  await save("sankey-gradient");
  expect(
    await page
      .locator('svg[data-chart="sankey"] path[stroke^="url(#flow-gradient-"]')
      .count(),
  ).toBeGreaterThan(0);
  results.push({
    id: "sankey-gradient",
    svg: true,
    box: await svg("sankey", "sankey-gradient"),
  });
});
await caseRun("venn", async () => {
  const label = page.locator("[data-drag-label]").first(),
    before = await label.getAttribute("x"),
    b = await label.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 25, {
    steps: 6,
  });
  await page.mouse.up();
  expect(await label.getAttribute("x")).not.toBe(before);
  const s = await save("venn-dragged-label");
  expect(Object.keys(s.project.layout.labelPositions).length).toBe(1);
  const at = await label.getAttribute("x");
  await reopen(s.path);
  expect(
    await page.locator("[data-drag-label]").first().getAttribute("x"),
  ).toBe(at);
  results.push({
    id: "venn-dragged-label",
    drag: true,
    projectReopen: true,
    svg: true,
    box: await svg("venn", "venn-dragged-label"),
  });
});
await caseRun("synteny", async () => {
  const chrs = page.locator("[data-drag-chromosome]"),
    first = await chrs.first().getAttribute("data-drag-chromosome");
  const a = await chrs.first().locator("text").first().boundingBox(),
    b = await chrs.last().locator("text").first().boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 9 });
  await page.mouse.up();
  const s = await save("synteny-reordered");
  expect(s.project.layout.chromosomeOrder.at(-1)).toBe(first);
  await reopen(s.path);
  expect(
    await page
      .locator("[data-drag-chromosome]")
      .last()
      .getAttribute("data-drag-chromosome"),
  ).toBe(first);
  results.push({
    id: "synteny-reordered",
    drag: true,
    projectReopen: true,
    svg: true,
    box: await svg("synteny", "synteny-reordered"),
  });
});
for (const id of ["enrichment-dot", "enrichment-bar"])
  await caseRun(id, async () => {
    await toggle("显示条目分类色带");
    await save(id + "-class");
    expect(await page.locator("[data-enrich-class]").count()).toBe(6);
    results.push({
      id: id + "-class",
      svg: true,
      box: await svg(id, id + "-class"),
    });
  });
await caseRun("bubble-matrix", async () => {
  await choose("气泡配色依据", "column");
  await save("bubble-matrix-category");
  results.push({
    id: "bubble-matrix-category",
    svg: true,
    box: await svg("bubble-matrix", "bubble-matrix-category"),
  });
});
await fs.writeFile(
  new URL("browser-coverage.json", folder),
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
);
await browser.close();
if (results.some((x) => x.error)) process.exitCode = 1;
