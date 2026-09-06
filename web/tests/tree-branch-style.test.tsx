import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { advancedBranchPath, branchStyleForLayout, supportMark, SupportLabels, BranchLengthLabels, branchLinkOptions, supportControls } from "../src/templates/tree/branch-style";
import type { Project } from "../src/core/types";
import { layoutTree, type PositionedNode, type TreeGeometry } from "../src/templates/tree/geometry";
import { parseNewick } from "../src/templates/tree/model";

const tree = () => parseNewick("((A:1,B:2)85:3,C:5)95;");
const geometry = (kind: TreeGeometry["kind"] = "normal") => layoutTree(tree(), kind, {
  width: 900, height: 650, treeWidth: 400, trackWidth: 0, labelWidth: 90, useLength: true,
  rotation: 0, angleRange: 360, rowHeight: 25,
});
const document = (element: React.ReactNode) => new JSDOM(renderToStaticMarkup(<svg>{element}</svg>), { contentType: "image/svg+xml" }).window.document;

describe("分支连接样式的几何约束", () => {
  it("六种矩形样式可区分且连接同一对端点", () => {
    const g = geometry();
    const p = { ...g.nodes[1], x: 150, y: 130 };
    const parent = { ...g.nodes[0], x: 20, y: 30 };
    const paths = branchLinkOptions.map(({ value }) => advancedBranchPath(p, parent, g, { branchLinkType: value }));
    expect(new Set(paths).size).toBe(6);
    for (const path of paths) {
      expect(path).toMatch(/^M20,30/);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
    expect(paths[0]).toBe("M20,30V130H150");
    expect(paths[1]).toBe("M20,30V120Q20,130 30,130H150");
    expect(paths[2]).toBe("M20,30L150,130");
    expect(paths[3]).toBe("M20,30A130,100 0 0 0 150,130");
    expect(paths[4]).toBe("M20,30C85,30 85,130 150,130");
    expect(paths[5]).toBe("M20,30C20,80 150,80 150,130");
  });
  it("圆角左右反向以及向上枝不会超出两端包围框", () => {
    const g = geometry();
    const a = { ...g.nodes[0], x: 150, y: 130 }, b = { ...g.nodes[1], x: 20, y: 30 };
    expect(advancedBranchPath(b, a, g, { branchLinkType: "rounded" })).toBe("M150,130V40Q150,30 140,30H20");
    expect(advancedBranchPath({ ...b, x: 150 }, a, g, { branchLinkType: "elliptical" })).toBe("M150,130L150,30");
  });
  it.each(["normal", "circle", "unrooted"] as const)("%s 所有边及零长根保持有限路径", kind => {
    const g = geometry(kind), lookup = new Map(g.nodes.map(p => [p.node.id, p]));
    for (const p of g.nodes.filter(p => p.parent)) for (const { value } of branchLinkOptions) {
      const path = advancedBranchPath(p, lookup.get(p.parent!)!, g, { branchLinkType: value });
      expect(path).not.toMatch(/NaN|Infinity/);
      expect(path.length).toBeGreaterThan(5);
    }
    const zero: PositionedNode = { ...g.nodes[0], x: g.cx, y: g.cy };
    expect(advancedBranchPath(g.nodes[1], zero, { ...g, kind: "circle" }, {})).not.toContain("A0,0");
  });
  it("切换布局对不适用样式使用已说明的默认连接", () => {
    expect(branchStyleForLayout("rounded", "circle")).toBe("rectangular");
    expect(branchStyleForLayout("elliptical", "unrooted")).toBe("linear");
    expect(branchStyleForLayout("bezierX", "unrooted")).toBe("bezierX");
    expect(branchStyleForLayout(undefined, "unrooted")).toBe("linear");
  });
});
describe("支持度真实值、阈值与项目状态", () => {
  it("百分比圈边界：70隐藏、90灰、>90黑，按乘数后的值筛选", () => {
    const node = tree();
    expect(supportMark({ ...node, support: 70 }, { supportType: "circle" })).toBeNull();
    expect(supportMark({ ...node, support: 90 }, { supportType: "circle" })?.fill).toBe("#808080");
    expect(supportMark({ ...node, support: 90.01 }, { supportType: "circle" })?.fill).toBe("#000000");
    const posterior = { ...node, posterior: 0.95 };
    expect(supportMark(posterior, { supportType: "circle", supportSource: "posterior" })).toBeNull();
    expect(supportMark(posterior, { supportType: "circle", supportSource: "posterior", supportFactor: 100 })?.value).toBe(95);
  });
  it("多源仅读取选中真实变量，缺失/非有限值不捏造支持度", () => {
    const node = { ...tree(), annotationValues: { bootstrap2: 0.92345 } };
    expect(supportMark(node, { supportSource: "variable", supportVariable: "bootstrap2", supportFactor: 100, supportDecimals: 2 })?.text).toBe("92.34");
    expect(supportMark(node, { supportSource: "variable", supportVariable: "BOOTSTRAP2", supportFactor: 100, supportDecimals: 2 })?.text).toBe("92.34");
    expect(supportMark(node, { supportSource: "variable", supportVariable: "missing" })).toBeNull();
    expect(supportMark({ ...node, support: NaN }, {})).toBeNull();
    expect(supportMark(node, { supportSource: "posterior" })).toBeNull();
  });
  it("控件按数据来源是否存在及显示类型切换，纯posterior数据仍可选来源", () => {
    const root = { ...tree(), support: undefined, posterior: 0.93, children: [] };
    const p = { dataset: { text: "source", tables: [] }, layout: { treeState: { source: "source", root } }, style: { supportType: "circle" } } as unknown as Project;
    const visible = () => supportControls.filter(c => c.visible?.(p)).map(c => c.key);
    expect(visible()).toContain("supportSource");
    expect(visible()).toContain("supportCircleSize");
    expect(visible()).not.toContain("supportDecimals");
    expect(visible()).not.toContain("supportFrom");
    p.style.supportType = "text";
    expect(visible()).not.toContain("supportCircleSize");
    expect(visible()).toContain("supportDecimals");
    p.style.showSupport = false;
    expect(visible()).toEqual(["showSupport"]);
    root.posterior = undefined as unknown as number;
    expect(visible()).toEqual([]);
  });
  it("文本保留真实0，空阈值不限，阈值包含端点且不影响圆点规则", () => {
    const node = tree();
    expect(supportMark({ ...node, support: 0 }, { supportFrom: "", supportTo: "" })?.value).toBe(0);
    expect(supportMark(node, { supportFrom: 95, supportTo: 95 })?.value).toBe(95);
    expect(supportMark(node, { supportTo: 94 })).toBeNull();
    expect(supportMark(node, { supportType: "circle", supportTo: 80 })?.value).toBe(95);
  });
  it("样式与保存的节点偏移真实改变SVG且JSON重开一致", () => {
    const g = geometry(), p = g.nodes[1];
    const layout = { treeSupportOffsets: { [p.node.id]: { x: 31, y: -14 } } };
    const props = { g, style: { supportBold: true, supportItalic: true, supportColor: "#cc2200", supportAnchor: "end", supportSize: 19, supportDecimals: 1 }, layout };
    const doc = document(<SupportLabels {...props} />);
    const labels = [...doc.querySelectorAll('[data-part="tree-support-label"]')];
    expect(labels).toHaveLength(2);
    const label = labels.find(e => e.getAttribute("data-node-id") === p.node.id)!;
    expect(label.getAttribute("transform")).toBe(`translate(${p.x + 5 + 31},${p.y - 6 - 14})`);
    expect(label.querySelector("text")?.textContent).toBe("85.0");
    expect(label.querySelector("text")?.getAttribute("fill")).toBe("#cc2200");
    expect(label.querySelector("text")?.getAttribute("font-weight")).toBe("700");
    expect(label.querySelector("text")?.getAttribute("font-style")).toBe("italic");
    expect(label.querySelector("text")?.getAttribute("text-anchor")).toBe("end");
    expect(renderToStaticMarkup(<SupportLabels {...props} />)).toBe(renderToStaticMarkup(<SupportLabels {...JSON.parse(JSON.stringify(props))} />));
  });
  it("支持度关闭无标记，圆点不是伪文本；枝长缩放格式化只显示非根真实枝长", () => {
    const g = geometry();
    expect(document(<SupportLabels g={g} style={{ showSupport: false }} layout={{}} />).querySelectorAll("text,circle")).toHaveLength(0);
    expect(document(<SupportLabels g={g} style={{ supportType: "circle" }} layout={{}} />).querySelectorAll("circle")).toHaveLength(2);
    const doc = document(<BranchLengthLabels g={g} style={{ showBranchLengths: true, branchLengthFactor: 10, branchLengthDecimals: 1 }} layout={{}} />);
    expect([...doc.querySelectorAll("text")].map(e => e.textContent)).toEqual(["30.0", "10.0", "20.0", "50.0"]);
    g.nodes[1].node.lengthSpecified = false;
    expect(document(<BranchLengthLabels g={g} style={{ showBranchLengths: true }} layout={{}} />).querySelectorAll("text")).toHaveLength(3);
  });
});
