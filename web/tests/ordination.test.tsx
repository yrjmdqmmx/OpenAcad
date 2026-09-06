import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ordinationTemplates,
  ordinationIssues,
} from "../src/templates/ordination";
import {
  makeProject,
  inputHash,
  encodeProject,
  decodeProject,
} from "../src/core/project";
for (const t of ordinationTemplates) {
  test(t.id + " 真实示例输入摘要、分组与已有坐标", async () => {
    const p = makeProject(t);
    expect(p.analysis?.result?.provenance).toBeTruthy();
    expect(
      await inputHash(p.dataset, p.analysis!.method, p.analysis!.params),
    ).toBe(p.analysis?.inputHash);
    expect(t.validate(p.dataset)).toEqual([]);
    const base = renderToStaticMarkup(<t.Renderer project={p} />);
    expect(base).toContain("data-sample");
    const id = String(p.dataset.tables[0].rows[0][0]);
    p.layout.sampleAnnotations = {
      [id]: { group: "新增试验组", label: "试验标签甲" },
    };
    const grouped = renderToStaticMarkup(<t.Renderer project={p} />);
    expect(grouped).toContain("新增试验组");
    expect(grouped).toContain("试验标签甲");
    expect(grouped).not.toBe(base);
    expect(ordinationIssues(p)).toEqual([]);
    expect(decodeProject(encodeProject(p), ordinationTemplates).layout).toEqual(
      p.layout,
    );
    p.layout.sampleAnnotations = { 不存在: { group: "组" } };
    expect(ordinationIssues(p)[0].message).toContain("不存在");
    p.layout.sampleAnnotations = {};
    p.style.ordinationInput = "scores";
    p.analysis = undefined;
    p.dataset.tables = [
      {
        id: "scores",
        name: "已有排序坐标",
        role: "scores",
        columns: ["样本", "轴甲", "轴乙"],
        rows: [
          ["A", -1, 2],
          ["B", 3, -4],
          ["C", 5, 1],
        ],
      },
    ];
    const raw = renderToStaticMarkup(<t.Renderer project={p} />);
    expect(raw).toContain("轴甲");
    expect(raw).toContain("轴乙");
    expect(raw).not.toContain("准备好数据");
    expect(raw).not.toMatch(/NaN|Infinity/);
    p.dataset.tables[0].rows[0][1] = 19;
    expect(renderToStaticMarkup(<t.Renderer project={p} />)).not.toBe(raw);
  });
}
