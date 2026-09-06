import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("排序图分组、已有坐标模式和项目恢复", async ({ page, browser }, info) => {
  test.skip(
    info.project.name !== "chromium",
    "排序图专项在Chromium，公共流程覆盖其他引擎",
  );
  await page.goto("/#editor/pca");
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/jobs"))
      requests.push(r.url());
  });
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "图层", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /显示标签$/ })
    .first()
    .fill("重新标注的样本");
  await page.getByRole("textbox", { name: /组别$/ }).first().fill("对照组");
  await expect(page.locator(".figure-paper svg").first()).toContainText(
    "重新标注的样本",
  );
  const select = page.getByRole("combobox", { name: "输入内容", exact: true });
  await select
    .locator("xpath=ancestor::details")
    .evaluate((e: HTMLDetailsElement) => {
      e.open = true;
    });
  await select.selectOption("scores");
  await expect(page.locator(".stale-banner")).toHaveCount(0);
  await expect(page.locator(".figure-paper svg").first()).not.toContainText(
    "解释率",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  const bytes = await readFile((await (await pending).path())!);
  const saved = JSON.parse(bytes.toString());
  expect(Object.values(saved.layout.sampleAnnotations)[0]).toEqual(
    expect.objectContaining({ group: "对照组", label: "重新标注的样本" }),
  );
  expect(saved.style.ordinationInput).toBe("scores");
  expect(requests).toHaveLength(0);
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto("/#catalog");
  await fresh
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "分组.openacad.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await expect(fresh.locator(".figure-paper svg").first()).toContainText(
    "重新标注的样本",
  );
  await context.close();
});
