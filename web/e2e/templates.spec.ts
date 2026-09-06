import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const templates = JSON.parse(
  readFileSync("../tests/artifacts/template-cases.json", "utf8"),
) as { id: string; name: string; project: any }[];
import { readFile, mkdir } from "node:fs/promises";
for (const t of templates)
  test(`${t.name}：示例、几何、项目与 SVG 文件`, async ({ page }, info) => {
    test.skip(
      info.project.name !== "chromium",
      "完整逐图在 Chromium；公共工作流另跑三引擎及手机",
    );
    await page.goto("/#catalog");
    const p = t.project;
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "验收.openacad.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(p)),
      });
    const svg = page.locator(".figure-paper svg[data-chart]").first();
    await expect(svg).toBeVisible();
    await expect(page.locator(".chart-error")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(await svg.innerHTML()).not.toMatch(/NaN|Infinity/);
    const save = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    const project = JSON.parse(
      await readFile((await (await save).path())!, "utf8"),
    );
    expect(project.dataset).toEqual(p.dataset);
    expect(project.analysis?.result).toEqual(p.analysis?.result);
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    const dl = await download;
    await mkdir("../tests/artifacts/svg", { recursive: true });
    await dl.saveAs(`../tests/artifacts/svg/${t.id}.svg`);
    const raw = await readFile((await dl.path())!, "utf8");
    const parsed = await page.evaluate((raw) => {
      const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
      return {
        error: doc.querySelector("parsererror")?.textContent,
        width: doc.documentElement.getAttribute("width"),
        count: doc.querySelectorAll("path,rect,circle,line,text").length,
      };
    }, raw);
    expect(parsed.error).toBeFalsy();
    expect(Number(parsed.width)).toBeGreaterThan(0);
    expect(parsed.count).toBeGreaterThan(3);
    const preview = await page.context().newPage();
    await preview.goto(
      "data:image/svg+xml;base64," + Buffer.from(raw).toString("base64"),
    );
    await expect(preview.locator("svg").first()).toBeVisible();
    await expect(preview.locator("parsererror")).toHaveCount(0);
    await preview.close();
  });
