import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  basicTemplates,
  boxSummary,
  sampleSd,
  quantile,
  gaussianKde,
  studentT975,
  errorAmount,
  prepareBasicAnalysis,
} from "../src/templates/basic";
import type { Project, Template } from "../src/core/types";
function project(t: Template, alternate = false): Project {
  return {
    schemaVersion: 1,
    id: "test",
    name: t.name,
    templateId: t.id,
    templateVersion: 1,
    createdAt: "2026-09-06",
    updatedAt: "2026-09-06",
    dataset: structuredClone(alternate ? t.alternate : t.example),
    mapping: {},
    style: t.defaultStyle as Project["style"],
    layers: [],
    layout: {},
  };
}
function svg(t: Template, p: Project) {
  return renderToStaticMarkup(React.createElement(t.Renderer, { project: p }));
}
function geometry(t: Template, p: Project) {
  const doc = new JSDOM(svg(t, p), { contentType: "image/svg+xml" }).window
    .document;
  return [
    ...doc.querySelectorAll(
      '[data-part="marks"] path,[data-part="marks"] rect,[data-part="marks"] circle,[data-part="marks"] polygon,[data-part="marks"] line',
    ),
  ]
    .map(
      (e) => (e.parentElement?.getAttribute("transform") || "") + e.outerHTML,
    )
    .join("");
}
describe("全部基础模板的独立数据与实际几何", () => {
  it("25 个唯一且可用的注册入口", () => {
    expect(basicTemplates).toHaveLength(25);
    expect(new Set(basicTemplates.map((t) => t.id)).size).toBe(25);
  });
  for (const template of basicTemplates) {
    it(`${template.name}：示例与替代数据合法且产生不同的有效 SVG`, () => {
      const p = project(template),
        q = project(template, true);
      expect(template.validate(p.dataset, p.style)).toEqual([]);
      expect(template.validate(q.dataset, q.style)).toEqual([]);
      const a = svg(template, p);
      expect(a).toContain('data-chart="true"');
      expect(a).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(a).not.toMatch(/(?:="|,|\s)(?:NaN|Infinity)(?:"|,|\s)/);
      expect(geometry(template, p)).not.toEqual(geometry(template, q));
    });
    it(`${template.name}：缺失必填列给出中文错误`, () => {
      const p = project(template);
      p.dataset.tables[0].columns = [];
      expect(
        template
          .validate(p.dataset, p.style)
          .some((i) => i.message.includes("缺少必填列")),
      ).toBe(true);
    });
  }
  it("非法数字精确定位到含表头的行和列", () => {
    const t = basicTemplates.find((t) => t.id === "bar")!,
      p = project(t);
    p.dataset.tables[0].rows[1][1] = "12 mg";
    const issue = t.validate(p.dataset, p.style)[0];
    expect(issue.row).toBe(3);
    expect(issue.column).toBe(2);
    expect(issue.message).toContain("12 mg");
  });
  it("横向条形、百分比堆叠、线形、点形确实改变几何", () => {
    for (const [id, key, value] of [
      ["bar", "orientation", "horizontal"],
      ["bar-stacked", "normalize", true],
      ["line", "curve", "step"],
      ["scatter", "pointShape", "square"],
    ] as const) {
      const t = basicTemplates.find((t) => t.id === id)!,
        p = project(t),
        q = structuredClone(p);
      q.style[key] = value;
      expect(geometry(t, p)).not.toEqual(geometry(t, q));
    }
  });
  it("分组堆叠保留两个大组", () => {
    const t = basicTemplates.find((t) => t.id === "bar-grouped-stacked")!;
    const doc = new JSDOM(svg(t, project(t)), { contentType: "image/svg+xml" })
      .window.document;
    expect(
      new Set(
        [...doc.querySelectorAll("[data-category]")].map((n) =>
          n.getAttribute("data-category"),
        ),
      ).size,
    ).toBe(6);
  });
  it("项目 JSON 往返后绘图完全一致", () => {
    for (const t of basicTemplates) {
      const p = project(t);
      p.style.showLabels = true;
      p.style.palette = ["#954466", "#22aa88"];
      const q = JSON.parse(JSON.stringify(p));
      expect(svg(t, p)).toEqual(svg(t, q));
    }
  });
  it("统计结果曲线与置信带消费真实服务器坐标", () => {
    const t = basicTemplates.find((t) => t.id === "scatter")!,
      p = project(t);
    p.analysis = {
      method: "lm",
      params: {},
      inputHash: "test",
      result: {
        data: {
          series: [
            {
              name: "数据",
              curve: [
                { x: 1, y: 8, lower: 6, upper: 10 },
                { x: 5, y: 13, lower: 11, upper: 15 },
              ],
            },
          ],
        },
      },
    };
    const doc = new JSDOM(svg(t, p), { contentType: "image/svg+xml" }).window
      .document;
    expect(doc.querySelectorAll('[data-part="regression"] path')).toHaveLength(
      2,
    );
  });
});
describe("明确的统计定义与基准值", () => {
  it("R-7 分位数、样本 SD 和实际观测须端", () => {
    const a = [1, 2, 3, 4, 8];
    expect(quantile(a, 0.25)).toBe(2);
    expect(quantile(a, 0.5)).toBe(3);
    expect(quantile(a, 0.75)).toBe(4);
    expect(sampleSd(a)).toBeCloseTo(Math.sqrt(7.3), 12);
    expect(boxSummary(a)).toEqual({
      q1: 2,
      median: 3,
      q3: 4,
      low: 1,
      high: 4,
      outliers: [8],
    });
  });
  it("95% t 区间在小样本不使用正态 1.96", () => {
    expect(studentT975(1)).toBeCloseTo(12.7062047364321, 8);
    expect(studentT975(4)).toBeCloseTo(2.7764451051978, 8);
    expect(studentT975(10)).toBeCloseTo(2.22813885196494, 8);
    expect(errorAmount(2, 5, "ci")).toBeCloseTo(
      (2.7764451051978 * 2) / Math.sqrt(5),
      8,
    );
  });
  it("Gaussian KDE 对称且密度积分约为 1", () => {
    const curve = gaussianKde([-1, 0, 1], 0.5, [-6, 6], 1000);
    let area = 0;
    for (let i = 1; i < curve.length; i++)
      area +=
        ((curve[i].x - curve[i - 1].x) *
          (curve[i].density + curve[i - 1].density)) /
        2;
    expect(area).toBeCloseTo(1, 6);
    expect(curve[250].density).toBeCloseTo(curve[749].density, 10);
  });
  it("配对 ID 不缺失不重复，独立组不猜测配对", () => {
    const t = basicTemplates.find((t) => t.id === "bar-grouped-error")!,
      d = structuredClone(t.example);
    const out = prepareBasicAnalysis("tests", d, { test: "ttest_rel" });
    const table = (out.data.tables as any[])[0];
    expect(table.columns).toHaveLength(7);
    expect(table.rows).toHaveLength(12);
    d.tables[0].rows.pop();
    expect(() =>
      prepareBasicAnalysis("tests", d, { test: "ttest_rel" }),
    ).toThrow("样本");
  });
  it("没有样本 ID 时拒绝配对检验", () => {
    const t = basicTemplates.find((t) => t.id === "bar")!;
    expect(() =>
      prepareBasicAnalysis("tests", t.example, { test: "ttest_rel" }),
    ).toThrow("样本");
  });
});
