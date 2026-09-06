import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

test("中文斜体实际改变字形像素，关闭后恢复原图", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "桌面编辑器字体像素专项");
  await page.goto("/#editor/bar");
  const text = "开放学术 中文 Aa12";
  await page.getByRole("textbox", { name: "标题", exact: true }).fill(text);
  const title = page.locator(".figure-paper svg[data-chart] text").filter({ hasText: /^开放学术 中文 Aa12$/ }).first();
  const italicToggle = page.getByRole("switch", { name: "标题斜体", exact: true });
  const report = [];
  for (const family of ["Noto Sans SC", "Noto Serif CJK SC"]) {
    await page.getByRole("combobox", { name: "字体", exact: true }).selectOption(family);
    for (const weight of [400, 700]) {
      await page.getByRole("switch", { name: "标题粗体", exact: true }).setChecked(weight === 700);
      await italicToggle.setChecked(false);
      await title.evaluate(async (node) => {
        const style = getComputedStyle(node);
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const faces = await document.fonts.load(font, node.textContent || "");
        if (!faces.length || !document.fonts.check(font, node.textContent || "")) throw new Error("实际标题字体未加载");
      });
      // WebKit's protocol bounding box for SVG <text> can omit its x/y
      // placement. Resolve all four local bbox corners through the screen CTM.
      const bounds = await title.evaluate((element) => {
        const node = element as SVGGraphicsElement;
        const box = node.getBBox(), matrix = node.getScreenCTM();
        if (!matrix) throw new Error("标题屏幕变换矩阵不可用");
        const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
          .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
        const x = Math.min(...corners.map((point) => point.x)), y = Math.min(...corners.map((point) => point.y));
        const right = Math.max(...corners.map((point) => point.x)), bottom = Math.max(...corners.map((point) => point.y));
        return { x, y, right, bottom, width: right - x, height: bottom - y };
      });
      expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
      expect(bounds.width).toBeGreaterThan(100);
      expect(bounds.height).toBeGreaterThan(10);
      // Keep the same padded viewport crop for all three states. The test
      // compares rendered pixels, not differing SVG markup or text boxes.
      const clip = {
        x: Math.floor(bounds.x) - 16, y: Math.floor(bounds.y) - 10,
        width: Math.ceil(bounds.right) - Math.floor(bounds.x) + 32,
        height: Math.ceil(bounds.bottom) - Math.floor(bounds.y) + 20,
      };
      const states = [];
      for (const italic of [false, true, false]) {
        await italicToggle.setChecked(italic);
        await expect(title).toHaveCSS("font-style", italic ? "italic" : "normal");
        await expect(title).toHaveCSS("font-weight", String(weight));
        const face = await title.evaluate(async (node, wanted) => {
          const style = getComputedStyle(node);
          const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const faces = await document.fonts.load(font, node.textContent || "");
          const matched = faces.filter((face) => face.status === "loaded" && face.style === wanted.style && face.weight === String(wanted.weight));
          if (!matched.length || !document.fonts.check(font, node.textContent || "")) throw new Error("当前字重/斜体字体面未加载");
          return { style: style.fontStyle, weight: style.fontWeight, matched: matched.length };
        }, { style: italic ? "italic" : "normal", weight });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const png = await page.screenshot({ clip, animations: "disabled", caret: "hide" });
        const ink = await page.evaluate(async (base64) => {
          const image = new Image();
          image.src = "data:image/png;base64," + base64;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          let count = 0, minX = canvas.width, maxX = -1;
          for (let offset = 0; offset < data.length; offset += 4) {
            // Faint canvas borders/backgrounds are deliberately excluded.
            if (data[offset + 3] > 128 && (data[offset] + data[offset + 1] + data[offset + 2]) / 3 < 150) {
              const x = (offset / 4) % canvas.width;
              count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            }
          }
          return { pixels: count, horizontalCoverage: (maxX - minX + 1) / canvas.width, width: canvas.width, height: canvas.height };
        }, png.toString("base64"));
        expect(ink.pixels, "标题裁片必须实际包含深色文字，不能只截空白或边框").toBeGreaterThan(100);
        expect(ink.horizontalCoverage, "墨迹应覆盖标题裁片的主要宽度").toBeGreaterThan(0.5);
        const name = `${family.includes("Serif") ? "serif" : "sans"}-${weight}-${states.length}-${italic ? "italic" : "normal"}`;
        await testInfo.attach(name, { body: png, contentType: "image/png" });
        const fullSvg = await page.locator(".figure-paper > svg").first().screenshot({ animations: "disabled", caret: "hide" });
        await testInfo.attach(name + "-full-svg", { body: fullSvg, contentType: "image/png" });
        states.push({ italic, face, ink, clip, screenshot: name, sha256: createHash("sha256").update(png).digest("hex") });
      }
      expect(states[1].sha256, `${family} ${weight} 斜体应真实改变字形像素`).not.toBe(states[0].sha256);
      expect(states[2].sha256, "关闭斜体应恢复完全相同的像素").toBe(states[0].sha256);
      report.push({ family, weight, bounds, states });
    }
  }
  await testInfo.attach("italic-pixel-report", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
});
