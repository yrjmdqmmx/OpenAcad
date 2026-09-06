import { test, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

type BrowserSample = {
  inputAt?: number;
  mutationAt?: number;
  firstFrameAt?: number;
  paintedFrameAt?: number;
  error?: string;
};
type Sample = BrowserSample & {
  template: string;
  sample: number;
  milliseconds: number | null;
  svgMutationMilliseconds: number | null;
  frameWaitMilliseconds: number | null;
  automationUntilTitleMilliseconds: number;
  automationTotalMilliseconds: number;
};
const percentile95 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null;
};

test("常规示例样式更新响应时间", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  const rows: Sample[] = [];
  const templates = [
    "bar",
    "line",
    "scatter",
    "box",
    "heatmap",
    "sankey",
    "network",
    "map",
    "pca",
    "tree-normal",
  ];
  let failure: unknown;
  try {
    for (const id of templates) {
      await page.goto("/#editor/" + id);
      const title = page.getByRole("textbox", { name: "标题", exact: true });
      await expect(title).toBeVisible();
      await expect(
        page.locator(".figure-paper svg[data-chart]").first(),
      ).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      for (let sample = 1; sample <= 3; sample++) {
        const expectedTitle = `样式响应检验-${id}-${sample}`;
        // Arm before Playwright fills. Timing starts only at the real input event,
        // so locator resolution, automatic scrolling and transport are excluded.
        await title.evaluate((element, expected) => {
          const host = window as Window & {
            __openacadStyleMeasurement?: {
              result: Promise<BrowserSample>;
              cleanup: () => void;
            };
          };
          host.__openacadStyleMeasurement?.cleanup();
          let finish!: (result: BrowserSample) => void;
          const result = new Promise<BrowserSample>((resolve) => {
            finish = resolve;
          });
          const times: BrowserSample = {};
          let completed = false;
          let firstFrame = 0;
          let secondFrame = 0;
          let timer = 0;
          const hasUpdatedSvgTitle = () => {
            const svg = document.querySelector(".figure-paper svg[data-chart]");
            // Require actual SVG text, not merely accessible <title> metadata.
            return Boolean(
              svg &&
                Array.from(svg.querySelectorAll("text")).some(
                  (text) => text.textContent === expected,
                ),
            );
          };
          const cleanup = () => {
            observer.disconnect();
            element.removeEventListener("input", input, true);
            cancelAnimationFrame(firstFrame);
            cancelAnimationFrame(secondFrame);
            clearTimeout(timer);
          };
          const complete = (error?: string) => {
            if (completed) return;
            completed = true;
            cleanup();
            finish({ ...times, ...(error ? { error } : {}) });
          };
          const inspect = () => {
            if (
              times.inputAt === undefined ||
              times.mutationAt !== undefined ||
              !hasUpdatedSvgTitle()
            )
              return;
            times.mutationAt = performance.now();
            observer.disconnect();
            // A single rAF is before paint. The second rAF crosses a complete
            // rendering opportunity after the updated SVG was observed.
            firstFrame = requestAnimationFrame(() => {
              times.firstFrameAt = performance.now();
              secondFrame = requestAnimationFrame(() => {
                times.paintedFrameAt = performance.now();
                complete(
                  hasUpdatedSvgTitle()
                    ? undefined
                    : "绘制帧时 SVG 标题已不匹配",
                );
              });
            });
          };
          const input = (event: Event) => {
            if (event.target !== element || times.inputAt !== undefined) return;
            times.inputAt = performance.now();
            inspect();
          };
          const observer = new MutationObserver(inspect);
          observer.observe(document.querySelector(".figure-paper")!, {
            subtree: true,
            childList: true,
            characterData: true,
          });
          element.addEventListener("input", input, true);
          timer = window.setTimeout(
            () => complete("未在 5 秒内观察到输入、SVG 标题更新及后续绘制帧"),
            5000,
          );
          host.__openacadStyleMeasurement = { result, cleanup };
        }, expectedTitle);
        const automationStart = performance.now();
        await title.fill(expectedTitle);
        await expect(page.locator(".figure-paper")).toContainText(
          expectedTitle,
        );
        const automationUntilTitleMilliseconds =
          performance.now() - automationStart;
        const browser = await page.evaluate(async () => {
          const host = window as Window & {
            __openacadStyleMeasurement?: {
              result: Promise<BrowserSample>;
              cleanup: () => void;
            };
          };
          const measurement = host.__openacadStyleMeasurement;
          if (!measurement) throw new Error("浏览器性能测量未初始化");
          const result = await measurement.result;
          delete host.__openacadStyleMeasurement;
          return result;
        });
        const delta = (end?: number, start?: number) =>
          end !== undefined && start !== undefined ? end - start : null;
        rows.push({
          template: id,
          sample,
          ...browser,
          milliseconds: delta(browser.paintedFrameAt, browser.inputAt),
          svgMutationMilliseconds: delta(browser.mutationAt, browser.inputAt),
          frameWaitMilliseconds: delta(
            browser.paintedFrameAt,
            browser.mutationAt,
          ),
          automationUntilTitleMilliseconds,
          automationTotalMilliseconds: performance.now() - automationStart,
        });
        expect(browser.error, `${id} 第 ${sample} 次测量失败`).toBeUndefined();
      }
    }
  } catch (error) {
    failure = error;
  }
  const valid = rows.filter(
    (row): row is Sample & { milliseconds: number } =>
      !row.error && row.milliseconds !== null,
  );
  const byTemplate = templates.map((template) => {
    const samples = valid.filter((row) => row.template === template);
    const values = samples.map((row) => row.milliseconds);
    return {
      template,
      samples: values.length,
      p95: percentile95(values),
      max: values.length ? Math.max(...values) : null,
    };
  });
  const result = {
    schemaVersion: 2,
    measurement: "browser-input-to-svg-two-animation-frames-v1",
    note: "常规模拟数据，仅测标题编辑路径，不能外推其他样式或数据重布局；浏览器捕获真实 input 事件起，用 MutationObserver 确认可见 SVG 标题更新，再等待连续两次 requestAnimationFrame 跨过一次渲染机会。全部主计时使用同一页面 performance.now()；不包含 Playwright 定位、滚动和往返。双帧是浏览器渲染机会估计，不等同屏幕光学或合成器完成时间，不代表大数据或统计计算延迟。",
    automationNote:
      "automationUntilTitleMilliseconds 保留旧口径（Node 端填入到断言标题文本出现），automationTotalMilliseconds 另包含读取跨帧结果；两者均含自动化开销，不作为 300ms 产品目标判断。",
    generatedAt: new Date().toISOString(),
    project: info.project.name,
    url: page.url(),
    browserVersion: page.context().browser()?.version(),
    rows,
    byTemplate,
    p95: percentile95(valid.map((row) => row.milliseconds)),
    automationP95: percentile95(
      rows.map((row) => row.automationUntilTitleMilliseconds),
    ),
    target: 300,
    expectedSamples: 30,
    measuredSamples: valid.length,
    overTarget: valid
      .filter((row) => row.milliseconds > 300)
      .map(({ template, sample, milliseconds }) => ({
        template,
        sample,
        milliseconds,
      })),
    ...(failure ? { error: String(failure) } : {}),
  };
  const report =
    process.env.OPENACAD_PERFORMANCE_REPORT ||
    "../tests/artifacts/style-performance.json";
  await mkdir(dirname(report), { recursive: true });
  await writeFile(report, JSON.stringify(result, null, 2));
  await info.attach("样式响应时间独立测量", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  if (failure) throw failure;
  expect(valid).toHaveLength(30);
  expect(result.p95).toBeLessThanOrEqual(300);
  // Three observations per template: nearest-rank p95 is the maximum. This
  // prevents one slow template from disappearing inside the pooled percentile.
  for (const row of byTemplate)
    expect(
      row.p95,
      `${row.template} 的真实浏览器跨帧预览延迟`,
    ).toBeLessThanOrEqual(300);
});
