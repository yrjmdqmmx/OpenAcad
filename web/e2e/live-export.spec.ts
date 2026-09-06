import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
for (const format of ["svg", "png", "pdf", "eps"])
  test(`真实 ${format.toUpperCase()} 下载与中文字体`, async ({
    page,
  }, info) => {
    test.skip(
      !["chromium", "mobile"].includes(info.project.name) ||
        !process.env.OPENACAD_LIVE_API,
      "需要真实 Inkscape 服务",
    );
    test.setTimeout(120000);
    await page.goto("/#editor/bar");
    if (info.project.name === "mobile")
      await page
        .locator(".mobile-tabs")
        .getByRole("button", { name: "设置", exact: true })
        .click();
    await page
      .getByRole("textbox", { name: "标题", exact: true })
      .fill("中文导出检验：处理组浓度");
    await page
      .getByRole("combobox", { name: "字体", exact: true })
      .selectOption("Noto Serif CJK SC");
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    await page
      .getByRole("combobox", { name: "图片格式", exact: true })
      .selectOption(format);
    if (format === "svg")
      await page
        .getByLabel("文字转为路径（避免接收方字体缺失）", { exact: true })
        .check();
    if (format === "png")
      await page
        .getByRole("combobox", { name: "分辨率", exact: true })
        .selectOption("150");
    const download = page.waitForEvent("download", { timeout: 110000 });
    await page.getByRole("button", { name: "下载图片", exact: true }).click();
    const dl = await download;
    const bytes = await readFile((await dl.path())!);
    expect(bytes.length).toBeGreaterThan(1000);
    if (format === "png")
      expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    else if (format === "pdf")
      expect(bytes.toString("utf8", 0, 5)).toBe("%PDF-");
    else if (format === "eps")
      expect(bytes.toString("utf8", 0, 4)).toBe("%!PS");
    else {
      expect(bytes.toString()).toContain("<svg");
      expect(bytes.toString()).not.toMatch(/<text\b/);
    }
    await mkdir("../tests/artifacts/live-exports", { recursive: true });
    await dl.saveAs(
      "../tests/artifacts/live-exports/" +
        info.project.name +
        "-chinese-serif." +
        format,
    );
  });
