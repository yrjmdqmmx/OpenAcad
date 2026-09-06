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
const save = async (name) => {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  const file = new URL(name + ".openacad.json", folder).pathname;
  await (await waiting).saveAs(file);
  return JSON.parse(await fs.readFile(file, "utf8"));
};
try {
  await page.goto("http://127.0.0.1:5178/#editor/bar-error");
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "分析", exact: true })
    .click();
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".analysis-panel [role=status]")).toHaveText(
    "计算完成",
    { timeout: 90000 },
  );
  await page
    .getByRole("checkbox", { name: "绘制组间比较括号", exact: true })
    .check();
  await page
    .getByRole("combobox", { name: "显示内容", exact: true })
    .selectOption("p");
  await expect(page.locator('[data-part="statistics"]')).toBeVisible();
  const p = await save("statistics-real-p");
  if (
    !p.analysis.result.provenance ||
    p.analysis.result.data.comparisons.length !== 3
  )
    throw Error("缺少真实结果基准或完整比较");
  const shown = await page.locator('[data-part="statistics"]').textContent();
  if (!shown.includes("校正 P=")) throw Error("P值未渲染");
  await page
    .getByRole("combobox", { name: "显示内容", exact: true })
    .selectOption("letters");
  const letters = await page.locator('[data-part="statistics"]').textContent();
  if (!letters.trim()) throw Error("字母分组未显示");
  const target = page.locator("[data-statistic-id]").first(),
    initial = await target.getAttribute("transform"),
    box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 25,
    box.y + box.height / 2 + 18,
    { steps: 8 },
  );
  await page.mouse.up();
  const moved = await target.getAttribute("transform");
  if (initial === moved) throw Error("统计字母不可拖动");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  if ((await target.getAttribute("transform")) !== initial)
    throw Error("统计拖动非一步撤销");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  const letterProject = await save("statistics-real-letters");
  if (!letterProject.layout.statistics) throw Error("统计位置未保存");
  const projectPath = new URL("statistics-real-letters.openacad.json", folder)
    .pathname;
  const restored = await context.newPage();
  await restored.goto("http://127.0.0.1:5178/");
  await restored.locator("input[type=file]").first().setInputFiles(projectPath);
  await expect(restored.locator("[data-statistic-id]").first()).toHaveAttribute(
    "transform",
    moved,
  );
  await page.screenshot({
    path: new URL("statistics-real-screen.png", folder).pathname,
  });
  results.push({
    case: "real-tests-p-letters-drag",
    passed: true,
    method: p.analysis.method,
    provenance: p.analysis.result.provenance,
    comparisons: p.analysis.result.data.comparisons,
    letters,
    moved,
    oneStepUndo: true,
    projectRoundtrip: true,
  });
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "数据", exact: true })
    .click();
  await page
    .getByRole("button", { name: "试用另一组数据", exact: true })
    .click();
  await expect(page.locator('[data-part="statistics"]')).toHaveCount(0);
  results.push({ case: "stale-data-hides-statistics", passed: true });
} catch (e) {
  results.push({ passed: false, error: String(e) });
  console.error(e);
} finally {
  await fs.writeFile(
    new URL("browser-statistics.json", folder),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify(
    results.map((r) => ({ case: r.case, passed: r.passed, error: r.error })),
  ),
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
