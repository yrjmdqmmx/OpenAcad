import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const basicDir = new URL("./evidence/", import.meta.url),
  treeDir = new URL("../tree/evidence/", import.meta.url);
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
  reopen = await context.newPage(),
  results = [];
const must = (condition, message) => {
  if (!condition) throw Error(message);
};
const clean = (s) => s.replace(/basic[a-zA-Z0-9]+/g, "basicID");
const chart = (page) => page.locator(".figure-paper svg[data-chart]").first();
const download = async (page, button, path) => {
  const waiting = page.waitForEvent("download", { timeout: 110000 });
  await page.getByRole("button", { name: button, exact: true }).click();
  const dl = await waiting;
  await dl.saveAs(path);
  return dl;
};
const exportAll = async (page, dir, name) => {
  const artifacts = [];
  for (const format of ["svg", "png", "pdf", "eps"]) {
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    await page
      .getByRole("combobox", { name: "图片格式", exact: true })
      .selectOption(format);
    if (format === "png")
      await page
        .getByRole("combobox", { name: "分辨率", exact: true })
        .selectOption("150");
    const file = new URL(name + "." + format, dir).pathname;
    await download(page, "下载图片", file);
    const bytes = await fs.readFile(file);
    must(bytes.length > 1000, "文件过小");
    if (format === "png")
      must(
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        "PNG签名",
      );
    if (format === "pdf")
      must(bytes.toString("utf8", 0, 5) === "%PDF-", "PDF签名");
    if (format === "eps")
      must(bytes.toString("utf8", 0, 4) === "%!PS", "EPS签名");
    if (format === "svg") {
      must(!/NaN|Infinity/.test(bytes.toString()), "SVG有限几何");
      const opened = await context.newPage();
      await opened.goto("file://" + file);
      await opened.locator("svg").first().waitFor();
      must((await opened.locator("svg").count()) > 0, "SVG无法重开");
      await opened.close();
    }
    artifacts.push({ format, bytes: bytes.length, file });
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  return artifacts;
};
try {
  await page.goto("http://127.0.0.1:5178/#editor/bar");
  await chart(page).waitFor();
  await page.getByRole("switch", { name: "显示数值", exact: true }).click();
  await page
    .getByRole("combobox", { name: "填充纹理", exact: true })
    .selectOption("diagonal");
  await page
    .getByRole("combobox", { name: "字体", exact: true })
    .selectOption("Noto Serif CJK SC");
  await page.getByRole("switch", { name: "纵轴省略区间", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "纵轴省略起点", exact: true })
    .fill("26");
  await page
    .getByRole("spinbutton", { name: "纵轴省略终点", exact: true })
    .fill("29");
  const label = page.locator('[data-label-id="bar:对照:数据"]'),
    before = await label.evaluate((el) => ({
      x: el.getAttribute("x"),
      y: el.getAttribute("y"),
    }));
  const box = await label.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 36,
    box.y + box.height / 2 - 30,
    { steps: 8 },
  );
  await page.mouse.up();
  const after = await label.evaluate((el) => ({
    x: el.getAttribute("x"),
    y: el.getAttribute("y"),
  }));
  must(JSON.stringify(before) !== JSON.stringify(after), "标签未移动");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  must(
    JSON.stringify(before) ===
      JSON.stringify(
        await label.evaluate((el) => ({
          x: el.getAttribute("x"),
          y: el.getAttribute("y"),
        })),
      ),
    "一步撤销未恢复标签",
  );
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await page
    .locator(".basic-style-panel summary")
    .filter({ hasText: "分类色带图层" })
    .click();
  await page.getByRole("button", { name: "添加分类色带", exact: true }).click();
  must(
    (await page.locator('[data-part="category-bands"] rect').count()) === 4,
    "色带未生成",
  );
  const saved = new URL("bar-advanced.openacad.json", basicDir).pathname;
  await download(page, "保存项目", saved);
  const project = JSON.parse(await fs.readFile(saved));
  must(
    project.layout.labels && project.layers.length === 1,
    "项目遗漏布局图层",
  );
  await reopen.goto("http://127.0.0.1:5178/");
  await reopen.locator("input[type=file]").first().setInputFiles(saved);
  await chart(reopen).waitFor();
  must(
    clean(await chart(reopen).innerHTML()) ===
      clean(await chart(page).innerHTML()),
    "基础高级项目恢复不一致",
  );
  const artifacts = await exportAll(page, basicDir, "bar-advanced");
  await page.screenshot({
    path: new URL("bar-advanced-screen.png", basicDir).pathname,
  });
  results.push({
    case: "basic-advanced",
    passed: true,
    before,
    after,
    oneStepUndo: true,
    projectRoundtrip: true,
    artifacts,
  });
  for (const layout of ["normal", "circle", "unrooted"]) {
    await page.goto("http://127.0.0.1:5178/#editor/tree-" + layout);
    await page.locator(".tree-panel").waitFor();
    const options = await page
      .getByRole("combobox", { name: "树注释类型", exact: true })
      .locator("option")
      .evaluateAll((a) =>
        a.map((o) => ({ value: o.value, label: o.textContent })),
      );
    const cases = [];
    for (const option of options) {
      try {
        await page
          .getByRole("combobox", { name: "树注释类型", exact: true })
          .selectOption(option.value);
        const base = await chart(page).innerHTML();
        await page
          .getByRole("button", { name: "添加可试用的图层", exact: true })
          .click();
        const panel = page.locator(".tree-panel .layer-item").last();
        const initial = await chart(page).innerHTML();
        must(initial !== base, "添加后无真实SVG差异");
        await panel
          .getByRole("button", { name: "另一组示例", exact: true })
          .click();
        const alternate = await chart(page).innerHTML();
        must(alternate !== initial, "第二组无SVG差异");
        must(!(await panel.getByRole("alert").count()), "示例出现错误");
        const file = new URL(
          layout + "-" + option.value + ".openacad.json",
          treeDir,
        ).pathname;
        await download(page, "保存项目", file);
        await reopen.locator("input[type=file]").first().setInputFiles(file);
        await reopen.locator(".tree-panel").waitFor();
        must(
          clean(await chart(reopen).innerHTML()) === clean(alternate),
          "逐层项目恢复不一致",
        );
        await panel.getByRole("button", { name: "隐藏", exact: true }).click();
        const hidden = await chart(page).innerHTML();
        must(hidden !== alternate, "隐藏无SVG差异");
        await panel.getByRole("button", { name: "删除", exact: true }).click();
        cases.push({
          type: option.value,
          name: option.label,
          passed: true,
          alternateChanged: true,
          hiddenChanged: true,
          projectRoundtrip: true,
        });
      } catch (e) {
        cases.push({
          type: option.value,
          name: option.label,
          passed: false,
          error: String(e),
        });
        const panels = page.locator(".tree-panel .layer-item");
        if (await panels.count())
          await panels
            .last()
            .getByRole("button", { name: "删除", exact: true })
            .click();
      }
    }
    results.push({
      case: "tree-" + layout,
      layers: cases,
      passed: cases.every((c) => c.passed),
    });
    await fs.writeFile(
      new URL("browser-advanced.json", basicDir),
      JSON.stringify(results, null, 2),
    );
    console.log(
      layout + ": " + cases.filter((c) => c.passed).length + "/" + cases.length,
    );
  }
  // Composite circle tree: independent layer data, expanded dimensions, Chinese serif and all formats.
  await page.goto("http://127.0.0.1:5178/#editor/tree-circle");
  await page.locator(".tree-panel").waitFor();
  for (const kind of ["leaf-pie", "heatmap", "motif"]) {
    await page
      .getByRole("combobox", { name: "树注释类型", exact: true })
      .selectOption(kind);
    await page
      .getByRole("button", { name: "添加可试用的图层", exact: true })
      .click();
  }
  await page.getByRole("switch", { name: "显示图例", exact: true }).click();
  await page
    .getByRole("combobox", { name: "字体", exact: true })
    .selectOption("Noto Serif CJK SC");
  const size = await chart(page).evaluate((svg) => ({
    width: +svg.getAttribute("width"),
    height: +svg.getAttribute("height"),
    inner: [...svg.querySelectorAll("svg")].map((s) => [
      +s.getAttribute("width"),
      +s.getAttribute("height"),
    ]),
  }));
  must(
    size.inner.every((d) => d[0] === size.width && d[1] === size.height),
    "内外画布尺寸不一致",
  );
  const artifactsTree = await exportAll(page, treeDir, "circle-three-layers");
  await download(
    page,
    "保存项目",
    new URL("circle-three-layers.openacad.json", treeDir).pathname,
  );
  await page.screenshot({
    path: new URL("circle-three-layers-screen.png", treeDir).pathname,
  });
  results.push({
    case: "tree-composite-exports",
    passed: true,
    size,
    artifacts: artifactsTree,
  });
} catch (e) {
  results.push({ case: "fatal", passed: false, error: String(e) });
  console.error(e);
} finally {
  await fs.writeFile(
    new URL("browser-advanced.json", basicDir),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify(
    results.map((r) => ({
      case: r.case,
      passed: r.passed,
      failed: r.layers?.filter((l) => !l.passed),
    })),
  ),
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
