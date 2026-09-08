import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
for (const id of ["pca", "pcoa", "nmds", "cca", "rda"])
  test(`${id} 真实服务计算、失效结果和项目保留`, async ({ page }, info) => {
    test.skip(
      info.project.name !== "chromium" || !process.env.OPENACAD_LIVE_API,
      "需要真实统计服务的专用联测",
    );
    test.setTimeout(120000);
    await page.goto("/#editor/" + id);
    const old = await page.locator(".figure-paper svg").first().innerHTML();
    await page
      .getByRole("button", { name: "试用另一组数据", exact: true })
      .click();
    await expect(page.locator(".stale-banner")).toBeVisible();
    await expect(page.getByRole("button", { name: "导出图片", exact: true })).toBeDisabled();
    await page
      .locator(".panel-tabs")
      .getByRole("button", { name: "分析", exact: true })
      .click();
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".analysis-panel [role=status]")).toHaveText(
      "计算完成",
      { timeout: 90000 },
    );
    await expect(page.locator(".stale-banner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "导出图片", exact: true })).toBeEnabled();
    expect(
      await page.locator(".figure-paper svg").first().innerHTML(),
    ).not.toBe(old);
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    const saved = await dl;
    const content = await readFile((await saved.path())!, "utf8");
    const p = JSON.parse(content);
    expect(p.analysis.method).toBe(id);
    expect(p.analysis.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.analysis.result.data.scores.length).toBe(
      p.dataset.tables[0].rows.length,
    );
    expect(p.analysis.result.provenance).toBeTruthy();
    await writeFile(
      info.outputPath(id + ".openacad.json"),
      content,
    );
    await page
      .getByRole("textbox", { name: "标题", exact: true })
      .fill("计算后的中文样式");
    const requests: any[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/jobs"))
        requests.push(r.url());
    });
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(0);
  });
