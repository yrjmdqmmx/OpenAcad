import { test, expect, type Page } from "@playwright/test";

async function expectNoPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
}

test("平台首页呈现已上线绘图、独立图研入口和后续工具说明", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", "/#home"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /^专注研究，\s*从容表达。$/,
    );
    await expect(page.getByText("面向科研与学术工作的综合平台", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/本站模块\s*·\s*已上线/),
    ).toHaveCount(0);
    await expect(page.locator(".site-header .brand")).toHaveAttribute(
      "href",
      "#home",
    );
    const navigation = page.getByRole("navigation", { name: "主导航" });
    const tuyanNavigation = navigation.getByRole("link", { name: "图研 Tuyan", exact: true });
    await expect(tuyanNavigation).toHaveAttribute("href", "https://www.paperbanana.asia/");
    await expect(tuyanNavigation).toHaveAttribute("target", "_blank");
    await expect(tuyanNavigation).toHaveAttribute("rel", "noopener noreferrer");
    await expect(navigation.locator('a[href="#home"]')).toHaveClass(/active/);
    await expect(
      navigation.getByRole("link", { name: "科研绘图", exact: true }),
    ).toHaveAttribute("href", "#catalog");
    await expect(
      page.getByRole("link", { name: "进入科研绘图", exact: true }),
    ).toHaveAttribute("href", "#catalog");
    await expect(
      page.getByRole("link", { name: "继续本机项目", exact: true }),
    ).toHaveAttribute("href", "#projects");

    const logo = page.getByRole("img", { name: "图研 Tuyan Logo", exact: true });
    await logo.scrollIntoViewIfNeeded();
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(logo).toHaveAttribute("src", "/images/tuyan-logo.svg");

    const tuyan = page.getByRole("link", {
      name: "访问图研 Tuyan",
      exact: true,
    });
    await expect(tuyan).toBeVisible();
    await expect(tuyan).toHaveAttribute(
      "href",
      "https://www.paperbanana.asia/",
    );
    await expect(tuyan).toHaveAttribute("target", "_blank");
    const rel = (await tuyan.getAttribute("rel"))?.split(/\s+/);
    expect(rel).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    expect(new URL((await tuyan.getAttribute("href"))!).origin).not.toBe(
      new URL(page.url()).origin,
    );
    const screenshot = page.getByRole("img", {
      name: "图研官网真实生成结果截图：细胞膜至细胞核信号传导机制图",
    });
    await screenshot.scrollIntoViewIfNeeded();
    await expect.poll(() => screenshot.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

    const upcoming = page.locator('section[aria-labelledby="upcoming-title"]');
    await expect(upcoming).toBeVisible();
    await expect(upcoming.locator("a, button, [role=button], [role=link]")).toHaveCount(0);
    await expectNoPageOverflow(page);
  }
  await page.screenshot({
    path: info.outputPath("platform-home.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "进入科研绘图", exact: true }).click();
  await expect(page).toHaveURL(/#catalog$/);
  await expect(page.getByRole("textbox", { name: "搜索图表" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "主导航" })
      .getByRole("link", { name: "科研绘图", exact: true }),
  ).toHaveClass(/active/);
});

test("绘图直链保留模板库、模板详情与工作台导航状态", async ({ page }) => {
  for (const route of ["/#catalog", "/#template/bar", "/#editor/bar"]) {
    await page.goto(route);
    await expect(
      page.getByRole("navigation", { name: "主导航" })
        .getByRole("link", { name: "科研绘图", exact: true }),
    ).toHaveClass(/active/);
    if (route === "/#catalog") {
      await expect(page.getByRole("textbox", { name: "搜索图表" })).toBeVisible();
    } else if (route === "/#template/bar") {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "用示例开始", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("textbox", { name: "项目名称", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".figure-paper svg").first()).toBeAttached();
    }
    await expectNoPageOverflow(page);
  }
});

test("工作台经首页前进后退及本机草稿继续保留数据与样式", async ({
  page,
}, info) => {
  const projectName = "从学术首页继续的研究项目";
  const chartTitle = "首页往返后保留的中文标题";
  const isMobile = info.project.name === "mobile";
  const showTab = async (name: "数据" | "设置") => {
    if (isMobile) {
      await page.locator(".mobile-tabs")
        .getByRole("button", { name, exact: true }).click();
    }
  };
  const expectRetainedProject = async () => {
    await expect(page).toHaveURL(/#editor\/bar$/);
    await expect(
      page.getByRole("textbox", { name: "项目名称", exact: true }),
    ).toHaveValue(projectName);
    await showTab("设置");
    await expect(
      page.getByRole("textbox", { name: "标题", exact: true }),
    ).toHaveValue(chartTitle);
    await showTab("数据");
    await expect(
      page.getByRole("textbox", {
        name: "示例数据第 2 行第 2 列",
        exact: true,
      }),
    ).toHaveValue("42");
  };

  await page.goto("/#editor/bar");
  await page.getByRole("textbox", { name: "项目名称", exact: true })
    .fill(projectName);
  await showTab("数据");
  await page.getByRole("textbox", {
    name: "示例数据第 2 行第 2 列",
    exact: true,
  }).fill("42");
  await showTab("设置");
  await page.getByRole("textbox", { name: "标题", exact: true })
    .fill(chartTitle);
  await expect(page.getByText("本机草稿已保存", { exact: true })).toBeVisible();

  await page.locator(".site-header .brand").click();
  await expect(page).toHaveURL(/#home$/);
  await page.goBack();
  await expectRetainedProject();
  await page.goForward();
  await expect(page).toHaveURL(/#home$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^专注研究，\s*从容表达。$/,
  );
  await page.goBack();
  await expectRetainedProject();

  await page.locator(".site-header .brand").click();
  await page.getByRole("link", { name: "继续本机项目", exact: true }).click();
  await expect(page).toHaveURL(/#projects$/);
  const draft = page.locator(".project-list article").filter({
    has: page.getByRole("heading", { name: projectName, exact: true }),
  });
  await draft.getByRole("button", { name: "继续编辑", exact: true }).click();
  await expectRetainedProject();
  await expectNoPageOverflow(page);
});
