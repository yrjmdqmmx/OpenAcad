import { test, expect } from "@playwright/test";

test("离开工作台再返回保留最新数据与样式", async ({ page }, info) => {
  await page.goto("/#editor/bar");
  await page.getByRole("textbox", { name: "项目名称", exact: true }).fill("导航后的研究项目");
  if (info.project.name === "mobile")
    await page.locator(".mobile-tabs").getByRole("button", { name: "数据", exact: true }).click();
  await page.getByRole("textbox", { name: "示例数据第 2 行第 2 列", exact: true }).fill("42");
  if (info.project.name === "mobile")
    await page.locator(".mobile-tabs").getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("textbox", { name: "标题", exact: true }).fill("返回后仍可编辑");
  await page.getByRole("link", { name: "帮助中心", exact: true }).click();
  await expect(page.locator("h1")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("textbox", { name: "项目名称", exact: true })).toHaveValue("导航后的研究项目");
  if (info.project.name === "mobile")
    await page.locator(".mobile-tabs").getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "标题", exact: true })).toHaveValue("返回后仍可编辑");
  if (info.project.name === "mobile")
    await page.locator(".mobile-tabs").getByRole("button", { name: "数据", exact: true }).click();
  const cell = page.getByRole("textbox", { name: "示例数据第 2 行第 2 列", exact: true });
  await expect(cell).toHaveValue("42");
  await cell.fill("63");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(cell).toHaveValue("42");
});
