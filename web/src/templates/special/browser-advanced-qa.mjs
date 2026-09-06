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
async function layer(kind) {
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "图层", exact: true })
    .click();
  await page.getByLabel("专有图层类型").selectOption(kind);
  await page
    .locator(".special-panel")
    .getByRole("button", {
      name:
        kind === "gene-break"
          ? "添加断轴"
          : kind === "genome-track"
            ? "添加轨道"
            : "添加注释",
      exact: true,
    })
    .click();
  await page.waitForTimeout(80);
  if (await page.locator(".chart-error").count())
    throw new Error(await page.locator(".chart-error").innerText());
}
for (const id of ["heatmap", "binary-dot", "bubble-matrix", "circle-heatmap"]) {
  try {
    await open(id);
    await layer("matrix-row-color");
    await layer("matrix-column-bar");
    expect(
      await page
        .locator(`svg[data-chart="${id}"] [data-special-layer]`)
        .count(),
    ).toBeGreaterThan(0);
    const saved = await save(id + "-annotated");
    expect(saved.project.layers.length).toBe(2);
    await page
      .locator(".site-header input[type=file]")
      .setInputFiles(saved.path);
    await page.waitForTimeout(100);
    const box = await svg(id, id + "-annotated");
    results.push({
      id: id + "-annotations",
      layers: 2,
      projectReopen: true,
      svg: true,
      box,
    });
    console.log(id, "ANNOTATIONS PASS");
  } catch (e) {
    results.push({ id: id + "-annotations", error: e.message });
    console.log(id, e.message);
  }
}
try {
  await open("gene-cluster");
  await layer("gene-break");
  await page
    .locator(".right-panel label")
    .filter({ hasText: /^箭头造型/ })
    .locator("select")
    .selectOption("simple");
  const s = await save("gene-cluster-broken");
  expect(s.project.layers[0].type).toBe("gene-break");
  results.push({
    id: "gene-cluster-break",
    svg: true,
    box: await svg("gene-cluster", "gene-cluster-broken"),
  });
  console.log("gene-cluster BREAK PASS");
} catch (e) {
  results.push({ id: "gene-cluster-break", error: e.message });
}
try {
  await open("genome-circos");
  await layer("genome-track");
  await layer("genome-track");
  await page
    .locator(".special-panel label")
    .filter({ hasText: /^轨道图形/ })
    .locator("select")
    .last()
    .selectOption("line");
  const s = await save("genome-custom-tracks");
  expect(s.project.layers.length).toBe(2);
  results.push({
    id: "genome-custom-tracks",
    tracks: 2,
    svg: true,
    box: await svg("genome-circos", "genome-custom-tracks"),
  });
  await layer("genome-track").catch(() => {});
  expect(await page.locator(".chart-error").textContent()).toContain(
    "可用空间",
  );
  console.log("genome DYNAMIC TRACKS PASS");
} catch (e) {
  results.push({ id: "genome-custom-tracks", error: e.message });
}
const jobs = process.env.OPENACAD_SKIP_ANALYSIS
  ? []
  : [
      ["circle-heatmap", "cluster", null],
      ["correlation", "correlation", "raw"],
      ["double-correlation", "correlation", "raw"],
      ["mantel", "mantel", "raw"],
      ["mantel", "mantel.randtest", "raw"],
      ["mantel", "mantel.rtest", "raw"],
      ["mantel", "mantel.partial", "raw"],
      ["genome-circos", "gc", "fasta"],
    ];
for (const [id, method, mode] of jobs) {
  try {
    await open(id);
    if (mode)
      await page
        .locator(".right-panel label")
        .filter({ hasText: /^数据模式/ })
        .locator("select")
        .selectOption(mode);
    await page
      .locator(".panel-tabs")
      .getByRole("button", { name: "分析", exact: true })
      .click();
    await page
      .locator(".analysis-panel label")
      .filter({ hasText: /^分析方法/ })
      .locator("select")
      .selectOption(method);
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".analysis-panel [role=status]")).toHaveText(
      "计算完成",
      { timeout: 60000 },
    );
    const s = await save(`${id}-${method}`);
    expect(s.project.analysis.result.provenance).toBeTruthy();
    const hasResult = !!s.project.analysis.result.data;
    results.push({
      id: `${id}-${method}`,
      realAnalysis: true,
      hasResult,
      method: s.project.analysis.result.method,
      svg: true,
      box: await svg(id, `${id}-${method}`),
    });
    console.log(id, method, "REAL ANALYSIS PASS");
  } catch (e) {
    results.push({ id: `${id}-${method}`, error: e.message });
    console.log(id, method, e.message);
  }
}
await fs.writeFile(
  new URL("browser-advanced.json", folder),
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
);
await browser.close();
