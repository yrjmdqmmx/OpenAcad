import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { basicTemplates, isNumericAxis } from "../src/templates/basic";
import {
  histogramBins,
  gaussianKde,
  kdeBandwidth,
  kdeDomain,
  sampleSd,
} from "../src/templates/basic/math";
import { numericScale } from "../src/templates/basic/shared";
import { compactLetters } from "../src/templates/basic/Statistics";
import type { Project } from "../src/core/types";
const make = (id: string): Project => {
  const t = basicTemplates.find((t) => t.id === id)!;
  return {
    schemaVersion: 1,
    id,
    name: t.name,
    templateId: id,
    templateVersion: 1,
    createdAt: "",
    updatedAt: "",
    dataset: structuredClone(t.example),
    mapping: {},
    style: structuredClone(t.defaultStyle) as Project["style"],
    layers: [],
    layout: {},
  };
};
const html = (p: Project) =>
  renderToStaticMarkup(
    React.createElement(
      basicTemplates.find((t) => t.id === p.templateId)!.Renderer,
      { project: p },
    ),
  );
const doc = (p: Project) =>
  new JSDOM(html(p), { contentType: "image/svg+xml" }).window.document;
describe("基础高级编辑的有效分支", () => {
  it("log2/log10 使用真实对数坐标并拒绝非正值", () => {
    const p = make("scatter");
    const scale = numericScale(
      [1, 2, 4, 8],
      { ...p.style, xScale: "log2", xMin: 1, xMax: 8 },
      "x",
      [0, 300],
    );
    expect(scale(2)).toBeCloseTo(100, 10);
    expect(scale(4)).toBeCloseTo(200, 10);
    p.style.xScale = "log10";
    p.dataset.tables[0].rows[0][1] = 0;
    expect(
      basicTemplates
        .find((t) => t.id === p.templateId)!
        .validate(p.dataset, p.style)
        .some((e) => e.message.includes("大于 0")),
    ).toBe(true);
  });
  it("断轴压缩区间并从可见刻度和图形裁切排除", () => {
    const p = make("bar");
    p.style.yBreak = true;
    p.style.yBreakStart = 26;
    p.style.yBreakEnd = 29;
    const d = doc(p);
    expect(d.querySelectorAll("clipPath rect").length).toBe(2);
    const scale = numericScale(
      [0, 50],
      { ...p.style, yMin: 0, yMax: 50 },
      "y",
      [400, 0],
    );
    expect(Math.abs(scale(29) - scale(26))).toBe(16);
    expect(scale.ticks(20).some((v) => v > 26 && v < 29)).toBe(false);
  });
  it("纹理有实际 pattern 引用，系列局部覆盖只改变目标颜色", () => {
    const p = make("bar-grouped");
    p.style.pattern = "diagonal";
    expect(
      doc(p).querySelector('[data-part="marks"] rect')!.getAttribute("fill"),
    ).toMatch(/^url\(#basic/);
    p.style.pattern = "none";
    p.style.seriesStyles = { 实验一: { color: "#ff0099", opacity: 0.2 } };
    const fills = [...doc(p).querySelectorAll('[data-part="marks"] rect')].map(
      (e) => e.getAttribute("fill"),
    );
    expect(fills.filter((v) => v === "#ff0099")).toHaveLength(4);
    expect(fills.filter((v) => v !== "#ff0099")).toHaveLength(4);
  });
  it("持久化标签位置和局部字体在项目往返后保留", () => {
    const p = make("bar");
    p.style.showLabels = true;
    p.style.seriesStyles = {
      对照: { labelSize: 23, labelBold: true, labelColor: "#ff00aa" },
    };
    p.layout.labels = { "bar:对照:数据": { x: 155, y: 81 } };
    const label = doc(p).querySelector('[data-label-id="bar:对照:数据"]')!;
    expect(label.getAttribute("x")).toBe("155");
    expect(label.getAttribute("font-size")).toBe("23");
    expect(label.getAttribute("font-weight")).toBe("700");
    expect(html(JSON.parse(JSON.stringify(p)))).toBe(html(p));
  });
  it("折线面积与新增符号确实改变几何，节点开关生效", () => {
    const p = make("line");
    const base = html(p);
    p.style.fillArea = true;
    p.style.pointShape = "star";
    expect(doc(p).querySelector('[data-part="line-area"]')).not.toBeNull();
    expect(html(p)).not.toBe(base);
    const combo = make("bar-line");
    combo.style.showPoints = false;
    expect(
      doc(combo).querySelectorAll('[data-part="marks"] circle'),
    ).toHaveLength(0);
  });
  it("图例文字/字号/符号使用本系列设置", () => {
    const p = make("line");
    p.style.seriesStyles = {
      处理甲: { legendLabel: "试验甲", legendSize: 24, legendShape: "line" },
    };
    const d = doc(p);
    expect(d.querySelector('[data-part="legend"]')!.textContent).toContain(
      "试验甲",
    );
    expect(
      [...d.querySelectorAll('[data-part="legend"] text')].some(
        (t) => t.getAttribute("font-size") === "24",
      ),
    ).toBe(true);
  });
  it("UpSet 真实集合大小、空交集和筛选", () => {
    const p = make("upset"),
      a = doc(p);
    expect(
      [...a.querySelectorAll("[data-set]")].map((n) =>
        Number(n.getAttribute("data-size")),
      ),
    ).toEqual([3, 3, 2]);
    const count = a.querySelectorAll("[data-intersection]").length;
    p.style.showEmpty = true;
    expect(doc(p).querySelectorAll("[data-intersection]")).toHaveLength(7);
    expect(count).toBeLessThan(7);
    p.style.minDegree = 3;
    expect(doc(p).querySelectorAll("[data-intersection]")).toHaveLength(1);
  });
  it("P 值和字母分组来自真实结果，非传递显著性不误分组", () => {
    const comparisons = [
      { left: "A", right: "B", p: 0.4, adjustedP: 0.5 },
      { left: "B", right: "C", p: 0.4, adjustedP: 0.5 },
      { left: "A", right: "C", p: 0.001, adjustedP: 0.003 },
    ];
    const letters = compactLetters(comparisons);
    const overlap = (a: string, b: string) => [...a].some((v) => b.includes(v));
    expect(overlap(letters.A, letters.B)).toBe(true);
    expect(overlap(letters.B, letters.C)).toBe(true);
    expect(overlap(letters.A, letters.C)).toBe(false);
    expect(() => compactLetters(comparisons.slice(0, 2))).toThrow("全部两两");
    const p = make("bar-error");
    p.analysis = {
      method: "tests",
      params: {},
      inputHash: "test",
      result: {
        data: {
          comparisons: [
            { left: "对照", right: "处理甲", p: 0.01, adjustedP: 0.023 },
          ],
        },
      },
    };
    p.style.showStatistics = true;
    p.style.statLabel = "p";
    expect(
      doc(p).querySelector('[data-part="statistics"]')!.textContent,
    ).toContain("0.023");
  });
  it("分类轴控件条件与命名色带真实消费", () => {
    const p = make("bar");
    expect(isNumericAxis(p, "x")).toBe(false);
    p.layers = [
      {
        id: "bands",
        type: "basic:category-band",
        name: "批次",
        visible: true,
        settings: { axis: "x", width: 24, gap: 8 },
        data: {
          tables: [
            {
              id: "b",
              name: "分类",
              role: "annotation",
              columns: ["类别", "颜色", "文字"],
              rows: [
                ["对照", "#ffcc00", "第一批"],
                ["处理甲", "#00bbcc", "第二批"],
              ],
            },
          ],
        },
      },
    ];
    expect(
      doc(p).querySelectorAll('[data-part="category-bands"] rect'),
    ).toHaveLength(2);
    expect(
      doc(p).querySelector('[data-part="category-bands"]')!.textContent,
    ).toContain("第一批");
  });
});
it("堆叠组分连接带、跨大组开关与标题分别消费", () => {
  const p = make("bar-grouped-stacked");
  const no = doc(p).querySelectorAll('[data-part="stack-connection"]').length;
  p.style.connectStacks = true;
  const count = doc(p).querySelectorAll(
    '[data-part="stack-connection"]',
  ).length;
  expect(count).toBeGreaterThan(no);
  p.style.connectAcrossGroups = true;
  expect(
    doc(p).querySelectorAll('[data-part="stack-connection"]').length,
  ).toBeGreaterThan(count);
  expect(doc(p).querySelector('[data-part="stack-groups"]')).not.toBeNull();
  p.style.showGroupHeaders = false;
  expect(doc(p).querySelector('[data-part="stack-groups"]')).toBeNull();
});
it("雷达与哑铃逐系列点形、大小、透明度和标签位置真实生效", () => {
  for (const id of ["radar", "dumbbell"]) {
    const p = make(id),
      before = html(p);
    const rows = p.dataset.tables[0],
      series =
        id === "radar"
          ? String(rows.rows[0][rows.columns.indexOf("分组")])
          : "起点";
    p.style.seriesStyles = {
      [series]: { pointSize: 13, pointShape: "star", opacity: 0.3 },
    };
    p.style.showLabels = true;
    expect(html(p)).not.toBe(before);
    expect(doc(p).querySelectorAll("[data-label-id]").length).toBeGreaterThan(
      0,
    );
  }
});
it("数值标签独立于绘图区裁切，可保存自定义位置", () => {
  const p = make("bar");
  p.style.showLabels = true;
  p.layout.labels = { "bar:对照:数据": { x: -20, y: 20 } };
  const label = doc(p).querySelector('[data-label-id="bar:对照:数据"]')!;
  expect(label.closest("[clip-path]")).toBeNull();
  expect(label.getAttribute("x")).toBe("-20");
});
it("统计标注自定义位置保存后与真实 P 值共同恢复", () => {
  const p = make("bar-error");
  p.analysis = {
    method: "tests",
    params: {},
    inputHash: "test",
    result: {
      data: {
        comparisons: [
          { left: "对照", right: "处理甲", p: 0.01, adjustedP: 0.023 },
        ],
      },
    },
  };
  p.style.showStatistics = true;
  p.layout.statistics = { "对照|处理甲": { x: 20, y: 30 } };
  expect(
    doc(p).querySelector("[data-statistic-id]")?.getAttribute("transform"),
  ).toBe("translate(20,30)");
  expect(html(JSON.parse(JSON.stringify(p)))).toBe(html(p));
});
it("误差下界非正不能进入对数坐标，越界断轴给出明确错误", () => {
  const p = make("bar-error");
  p.style.yScale = "log10";
  p.style.errorInput = "summary";
  p.dataset.tables[0] = {
    id: "d",
    name: "d",
    role: "data",
    columns: ["类别", "数值", "标准差", "样本量"],
    rows: [
      ["甲", 1, 5, 4],
      ["乙", 2, 5, 4],
    ],
  };
  expect(
    basicTemplates
      .find((t) => t.id === p.templateId)!
      .validate(p.dataset, p.style)
      .some((i) => i.message.includes("误差区间")),
  ).toBe(true);
  const q = make("bar");
  q.style.yBreak = true;
  q.style.yBreakStart = 200;
  q.style.yBreakEnd = 300;
  expect(
    basicTemplates
      .find((t) => t.id === q.templateId)!
      .validate(q.dataset, q.style)
      .some((i) => i.message.includes("严格位于")),
  ).toBe(true);
});

it("等宽分箱数精确且最大端点纳入末箱，不用样条制造频数", () => {
  const bins = histogramBins([0, 0.5, 1, 1.5, 2, 2.5, 3], [0, 3], 3);
  expect(bins.map((b) => b.count)).toEqual([2, 2, 3]);
  expect(bins.length).toBe(3);
  const p = make("violin");
  p.style.distribution = "histogram";
  p.style.binCount = 5;
  expect(html(p)).not.toMatch(/NaN|Infinity/);
});

describe("SciPy 独立核密度基准（含两端的512点）", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../../server/tests/artifacts/basic-kde-reference.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [name, value] of Object.entries(fixture.cases) as [
    string,
    any,
  ][]) {
    it(name + " 逐点误差小于1e-12", () => {
      const h =
        name === "customAbsoluteWidth"
          ? value.absoluteBandwidth
          : name === "customFactor"
            ? sampleSd(fixture.values) * value.factor
            : kdeBandwidth(
                fixture.values,
                value.bwMethod,
                value.bandwidthMultiplier,
              );
      expect(h).toBeCloseTo(value.absoluteBandwidth, 12);
      const curve = gaussianKde(fixture.values, h, [-1, 15]);
      expect(curve).toHaveLength(512);
      expect(curve[0].x).toBe(-1);
      expect(curve.at(-1)!.x).toBe(15);
      expect(
        Math.max(
          ...curve.map((v, i) => Math.abs(v.density - value.gridDensity[i])),
        ),
      ).toBeLessThan(1e-12);
    });
  }
  it("默认Scott与512，trim扩域明确使用总体标准差", () => {
    for (const id of ["violin", "raincloud", "ridgeline"]) {
      const t = basicTemplates.find((t) => t.id === id)!;
      expect(t.defaultStyle.kdeBandwidth).toBe("scott");
      expect(t.defaultStyle.kdePoints).toBe(512);
      expect(t.analysisMethods?.some((m) => m.method === "density")).toBe(true);
    }
    const populationSd = sampleSd(fixture.values) * Math.sqrt(5 / 6);
    expect(kdeDomain(fixture.values, false)).toEqual([
      1 - 3 * populationSd,
      13 + 3 * populationSd,
    ]);
  });
});
