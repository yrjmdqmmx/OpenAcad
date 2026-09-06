import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import type { Project, Template, Layer } from "../src/core/types";
import {
  treeTemplates,
  parseNewick,
  parseNexus,
  parsePhyloXml,
  modifyTree,
  writeNewick,
  walk,
  leaves,
  layerExample,
  treeLayerSpecs,
  validateLayer,
  layoutTree,
} from "../src/templates/tree";
import {
  defaultLayerSettings,
  importMemeLayer,
} from "../src/templates/tree/layers";
function project(t: Template): Project {
  return {
    schemaVersion: 1,
    id: "tree-test",
    name: t.name,
    templateId: t.id,
    templateVersion: 1,
    createdAt: "2026-09-06",
    updatedAt: "2026-09-06",
    dataset: structuredClone(t.example),
    mapping: {},
    style: structuredClone(t.defaultStyle) as Project["style"],
    layers: [],
    layout: {},
  };
}
const render = (p: Project) =>
  renderToStaticMarkup(
    React.createElement(treeTemplates[0].Renderer, { project: p }),
  );
const dom = (p: Project) =>
  new JSDOM(render(p), { contentType: "image/svg+xml" }).window.document;
const mark = (p: Project) =>
  [...dom(p).querySelectorAll("path,rect,circle,line,text")]
    .map((n) => n.outerHTML)
    .join("");
const layer = (
  type: string,
  root: ReturnType<typeof parseNewick>,
  alternate = false,
): Layer => ({
  id: type,
  type: "tree:" + type,
  name: type,
  visible: true,
  settings: { ...defaultLayerSettings },
  data: layerExample(type, root, alternate),
});
describe("树文件解析与真实拓扑编辑", () => {
  it("Newick 引号、单引号转义、科学计数与嵌套注释", () => {
    const t = parseNewick(
      "(('A species':1e-3,'O''Brien':2.5)[comment[nest]]95:3,B:0.2)root;",
    );
    expect(leaves(t).map((n) => n.name)).toEqual(["A species", "O'Brien", "B"]);
    expect(leaves(t)[0].length).toBe(0.001);
    expect(t.children[0].support).toBe(95);
    expect(writeNewick(parseNewick(writeNewick(t)))).toBe(writeNewick(t));
  });
  it("Nexus TREE 区块与 TRANSLATE 正确映射", () => {
    const t = parseNexus(
      "#NEXUS\nBEGIN TREES; TRANSLATE 1 '水稻 样本', 2 玉米, 3 小麦; TREE t1 = [&R] ((1:0.2,2:0.3)95:0.1,3:0.4); END;",
    );
    expect(leaves(t).map((n) => n.name)).toEqual(["水稻 样本", "玉米", "小麦"]);
  });
  it("phyloXML namespace、实体、branch_length、confidence", () => {
    const t = parsePhyloXml(
      '<px:phyloxml xmlns:px="urn:test"><px:phylogeny><px:clade><px:name>根</px:name><px:confidence type="bootstrap">95</px:confidence><px:clade><px:name>A &amp; B</px:name><px:branch_length>0.2</px:branch_length></px:clade><px:clade><px:name>C</px:name><px:branch_length>1e-2</px:branch_length></px:clade></px:clade></px:phylogeny></px:phyloxml>',
    );
    expect(leaves(t)[0].name).toBe("A & B");
    expect(t.support).toBe(95);
    expect(leaves(t)[1].length).toBe(0.01);
  });
  it("MEME 原始 XML 转换保留 1-based 闭区间与真实序列长度", () => {
    const data = importMemeLayer(
      '<MEME><sequence id="s1" name="拟南芥" length="400"/><motif id="m1" width="10"/><scanned_sites sequence_id="s1"><scanned_site motif_id="m1" position="5" pvalue="0.001"/></scanned_sites></MEME>',
    );
    expect(data.tables[0].rows).toEqual([["拟南芥", 6, 15, "m1", 400]]);
  });
  it("损坏树文本和含混叶名称给出明确错误", () => {
    expect(() => parseNewick("(A:foo,B:1);")).toThrow("分支长度");
    expect(() => parseNewick("(A:1,A:2);")).toThrow("重复");
    expect(() => parseNewick("(A,B)")).toThrow("分号");
    expect(() => parsePhyloXml("<phyloxml><phylogeny></phyloxml>")).toThrow(
      "闭合",
    );
  });
  it("换根保留叶 ID 和所有叶间路径距离", () => {
    const root = parseNewick("((A:1,B:2)N:3,(C:4,D:5)M:6)R;");
    function distance(t: ReturnType<typeof parseNewick>, a: string, b: string) {
      const edges = new Map(
        walk(t).map((n) => [n.id, [] as { id: string; w: number }[]]),
      );
      for (const n of walk(t))
        for (const c of n.children) {
          edges.get(n.id)!.push({ id: c.id, w: c.length });
          edges.get(c.id)!.push({ id: n.id, w: c.length });
        }
      function find(id: string, prev: string): number | undefined {
        if (id === b) return 0;
        for (const e of edges.get(id)!)
          if (e.id !== prev) {
            const d = find(e.id, id);
            if (d !== undefined) return e.w + d;
          }
      }
      return find(a, "");
    }
    const reroot = modifyTree(root, "A", "reroot", { offset: 0.2 });
    expect(new Set(leaves(reroot).map((n) => n.id))).toEqual(
      new Set(["A", "B", "C", "D"]),
    );
    for (const a of ["A", "B", "C", "D"])
      for (const b of ["A", "B", "C", "D"])
        expect(distance(reroot, a, b)).toBeCloseTo(distance(root, a, b)!, 12);
  });
  it("折叠/展开/删除/反序/分支更新互不破坏源树", () => {
    const root = parseNewick("((A:1,B:2)N:3,C:4)R;");
    expect(modifyTree(root, "N", "fold").children[0].collapsed).toBe(true);
    expect(
      modifyTree(root, "N", "reverse").children[0].children.map((n) => n.id),
    ).toEqual(["B", "A"]);
    expect(leaves(modifyTree(root, "A", "delete")).map((n) => n.id)).toEqual([
      "B",
      "C",
    ]);
    expect(
      modifyTree(root, "B", "update", { length: 8, support: 99 }).children[0]
        .children[1].length,
    ).toBe(8);
    expect(root.children[0].children[1].length).toBe(2);
  });
});
describe("三布局与 29 种注释实际渲染", () => {
  it("矩形环形各29层、无根13层，来源和输入格式明确", () => {
    expect(treeLayerSpecs).toHaveLength(29);
    expect(treeLayerSpecs.filter((s) => s.unrooted)).toHaveLength(13);
    expect(treeTemplates.map((t) => t.layerTypes!.length)).toEqual([
      29, 29, 13,
    ]);
  });
  for (const template of treeTemplates) {
    it(template.name + " 示例/第二组数据/结构保存", () => {
      const p = project(template),
        q = structuredClone(p);
      q.dataset = template.alternate;
      expect(template.validate(p.dataset)).toEqual([]);
      expect(template.validate(q.dataset)).toEqual([]);
      expect(mark(p)).not.toEqual(mark(q));
      expect(render(p)).not.toMatch(/(?:NaN|Infinity)/);
      const root = parseNewick(p.dataset.text!);
      p.layout.treeState = {
        source: p.dataset.text,
        root: modifyTree(root, root.children[0].id, "fold"),
      };
      expect(render(p)).toBe(render(JSON.parse(JSON.stringify(p))));
    });
    for (const spec of treeLayerSpecs.filter(
      (s) => template.id !== "tree-unrooted" || s.unrooted,
    )) {
      it(`${template.id} · ${spec.label} 有示例、替代几何、隐藏和项目恢复`, () => {
        const p = project(template),
          root = parseNewick(p.dataset.text!);
        p.layers = [layer(spec.type, root)];
        expect(validateLayer(p.layers[0], root)).toEqual([]);
        const initial = mark(p);
        const other = structuredClone(p);
        other.layers = [layer(spec.type, root, true)];
        expect(validateLayer(other.layers[0], root)).toEqual([]);
        expect(mark(other)).not.toEqual(initial);
        expect(render(p)).not.toMatch(/(?:NaN|Infinity)/);
        expect(render(JSON.parse(JSON.stringify(p)))).toEqual(render(p));
        const hidden = structuredClone(p);
        hidden.layers[0].visible = false;
        expect(mark(hidden)).not.toEqual(initial);
      });
    }
  }
  it("图层具体行和列校验，不存在节点不能静默忽略", () => {
    const p = project(treeTemplates[0]),
      root = parseNewick(p.dataset.text!);
    const l = layer("heatmap", root);
    l.data!.tables[0].rows[0][0] = "不存在的叶";
    l.data!.tables[0].rows[1][2] = "abc";
    const errors = validateLayer(l, root);
    expect(
      errors.some((e) => e.row === 2 && e.message.includes("不在当前树")),
    ).toBe(true);
    expect(errors.some((e) => e.row === 3 && e.column === 3)).toBe(true);
  });
  it("图层宽度、透明度与颜色真实影响输出", () => {
    const p = project(treeTemplates[0]),
      root = parseNewick(p.dataset.text!);
    p.layers = [layer("bar", root)];
    for (const [key, value] of [
      ["width", 180],
      ["color", "#aa2288"],
      ["opacity", 0.3],
    ] as const) {
      const q = structuredClone(p);
      q.layers[0].settings[key] = value;
      expect(render(q)).not.toEqual(render(p));
    }
  });
  it("无根布局真实分支长度与等长拓扑得到不同节点坐标", () => {
    const root = parseNewick("((A:1,B:4)N:2,C:1)R;");
    const options = {
      width: 900,
      height: 900,
      treeWidth: 350,
      trackWidth: 0,
      labelWidth: 100,
      useLength: true,
      rotation: 0,
      angleRange: 360,
      rowHeight: 25,
    };
    const a = layoutTree(root, "unrooted", options),
      b = layoutTree(root, "unrooted", { ...options, useLength: false });
    expect(a.nodes.map((n) => [n.x, n.y])).not.toEqual(
      b.nodes.map((n) => [n.x, n.y]),
    );
  });
});
it("phyloXML clade 分支长度属性、任意重排与重复换根保持唯一ID", () => {
  const xml =
    '<phyloxml><phylogeny><clade><clade branch_length="0.2"><name>A</name></clade><clade branch_length="1e-2"><name>B</name></clade></clade></phylogeny></phyloxml>';
  expect(leaves(parsePhyloXml(xml)).map((n) => n.length)).toEqual([0.2, 0.01]);
  const root = parseNewick("(A:1,B:2,C:3)R;"),
    ordered = modifyTree(root, "R", "reorder", { order: ["C", "A", "B"] });
  expect(ordered.children.map((n) => n.id)).toEqual(["C", "A", "B"]);
  expect(() =>
    modifyTree(root, "R", "reorder", { order: ["A", "A", "C"] }),
  ).toThrow("不能重复");
  const changed = modifyTree(modifyTree(root, "A", "reroot"), "A", "reroot");
  expect(new Set(walk(changed).map((n) => n.id)).size).toBe(
    walk(changed).length,
  );
});
it("叶名和叶数排序实际改变布局并保留原节点长度", () => {
  const root = parseNewick("(Z:1,(B:2,A:3)N:4,C:5)R;");
  expect(
    leaves(modifyTree(root, "R", "sort", { sort: "name" })).map((n) => n.name),
  ).toEqual(["A", "B", "C", "Z"]);
  expect(
    modifyTree(root, "R", "sort", { sort: "leafCount" }).children.at(-1)!.id,
  ).toBe("N");
  expect(walk(root).find((n) => n.id === "B")!.length).toBe(2);
});
it("导出前校验定位可见图层的错误，隐藏层保留警告", async () => {
  const { treeProjectIssues } = await import("../src/templates/tree");
  const p = project(treeTemplates[0]),
    root = parseNewick(p.dataset.text!);
  p.layers = [layer("heatmap", root)];
  p.layers[0].data!.tables[0].rows[0][0] = "旧树叶ID";
  expect(
    treeProjectIssues(p).some(
      (i) =>
        i.severity === "error" && i.message.includes("heatmap") && i.row === 2,
    ),
  ).toBe(true);
  p.layers[0].visible = false;
  expect(treeProjectIssues(p).every((i) => i.severity === "warning")).toBe(
    true,
  );
});
it("图例需有分类注释；密集图层右边距改变真实画布尺寸", async () => {
  const { requiredTreeCanvas } = await import("../src/templates/tree");
  const p = project(treeTemplates[0]),
    root = parseNewick(p.dataset.text!);
  const control = treeTemplates[0].controls.find(
    (c) => c.key === "showLegend",
  )!;
  expect(control.visible!(p)).toBe(false);
  p.layers = [layer("leaf-pie", root)];
  expect(control.visible!(p)).toBe(true);
  const before = render(p);
  p.style.showLegend = true;
  expect(render(p)).not.toBe(before);
  expect(dom(p).querySelector('[data-part="tree-legend"]')).not.toBeNull();
  p.layers = Array.from({ length: 8 }, (_, i) => ({
    ...layer("bar", root),
    id: "bar" + i,
  }));
  const size = requiredTreeCanvas(p);
  p.style.marginRight += 100;
  expect(requiredTreeCanvas(p).width).toBeCloseTo(size.width + 100);
  expect(+dom(p).documentElement.getAttribute("width")!).toBe(
    requiredTreeCanvas(p).width,
  );
});

import {
  timeExamples,
  timeInfo,
  timeIssues,
  treeProjectIssues,
} from "../src/templates/tree";
import { parseTimeAnnotations } from "../src/templates/tree/time";
describe("已有 MCMCTree / BEAST 时间树", () => {
  it("MCMCTree UTREE 时间枝长映射相对年代并保留当前 95%HPD", () => {
    const root = parseNexus(timeExamples.mcmctree);
    expect(root.age).toBe(10);
    expect(root.hpd).toEqual([8.8, 11.5]);
    expect(root.hpdKind).toBe("hpd");
    expect(root.timeSource).toBe("MCMCTree");
    expect(walk(root).find((n) => n.id === "十字花科")?.age).toBe(4);
    expect(leaves(root).every((n) => n.age === 0)).toBe(true);
    expect(
      timeIssues(root, treeTemplates[0].defaultStyle as Project["style"]),
    ).toEqual([]);
  });
  it("BEAST Nexus translate 与 height/mean/median/posterior 不混同 bootstrap", () => {
    const root = parseNexus(timeExamples.beast),
      node = walk(root).find((n) => n.id === "十字花科")!;
    expect(root.age).toBe(12);
    expect(root.ageMean).toBe(12.2);
    expect(node.posterior).toBe(0.98);
    expect(node.support).toBeUndefined();
    expect(walk(root).find((n) => n.id === "油菜")?.age).toBe(1);
    expect(
      timeInfo(root, {
        ...treeTemplates[0].defaultStyle,
        nodeAgeSource: "mean",
      } as Project["style"]).ages["十字花科"],
    ).toBe(5.2);
  });
  it("只读取节点元注释，冒号后的分支注释和裸名称不冒充年代", () => {
    expect(parseNewick("(height=3:1,B:1)根;").age).toBeUndefined();
    expect(
      parseNewick("(A:1[&height=9],B:1)根;").children[0].age,
    ).toBeUndefined();
  });
  it("旧 95% 不会冒称 HPD；新标记往返保留", () => {
    const old = parseNewick("(A:2,B:2)根[&95%={1,3}];");
    expect(old.hpdKind).toBe("unspecified");
    expect(parseNewick(writeNewick(old)).hpdKind).toBe("unspecified");
    const root = parseNexus(timeExamples.beast),
      copy = parseNewick(writeNewick(root));
    expect(copy.hpd).toEqual(root.hpd);
    expect(copy.ageMean).toBe(root.ageMean);
    expect(walk(copy).find((n) => n.id === "十字花科")?.posterior).toBe(0.98);
  });
  it("空端点、非数值、逆区间、缺失时间枝长、负年代与后验范围有具体错误", () => {
    for (const text of [
      '[&height=""]',
      "[&height=abc]",
      "[&height_95%_HPD={,5}]",
      "[&95%HPD={3,2}]",
      "[&posterior=1.2]",
    ])
      expect(() => parseTimeAnnotations(text)).toThrow();
    expect(() => parseNewick("(A,B:2)根[&95%HPD={1,3}];")).toThrow(
      "缺少年代和时间分支长度",
    );
    const root = parseNewick("(A:3,B:2)根[&height=2];");
    expect(
      timeIssues(root, treeTemplates[0].defaultStyle as Project["style"]).some(
        (i) => i.message.includes("非负"),
      ),
    ).toBe(true);
  });
  it("父子时间矛盾阻断年龄图导出，原始枝长模式保留输入", () => {
    const p = project(treeTemplates[0]);
    p.dataset = {
      tables: [],
      text: "(A[&height=4]:1,B[&height=0]:3)根[&height=3];",
      format: "newick",
    };
    expect(
      treeProjectIssues(p).some((i) => i.message.includes("大于父节点")),
    ).toBe(true);
    p.style.timeLayout = "branch";
    expect(treeProjectIssues(p)).toEqual([]);
  });
  for (const kind of ["normal", "circle", "unrooted"])
    it(`${kind} 的年代和区间修改真实改变几何，显隐和项目往返有效`, () => {
      const p = project(treeTemplates.find((t) => t.id === "tree-" + kind)!);
      p.dataset = { tables: [], text: timeExamples.beast, format: "nexus" };
      p.style.showNodeAges = true;
      p.style.showPosterior = true;
      const doc = dom(p);
      expect(doc.querySelectorAll('[data-part="node-hpd"]').length).toBe(5);
      expect(doc.querySelectorAll('[data-part="node-age"]').length).toBe(5);
      const before = doc
        .querySelector('[data-part="tree-node"][data-node-id="十字花科"]')!
        .getAttribute("transform");
      const root = modifyTree(
        parseNexus(timeExamples.beast),
        "十字花科",
        "update",
        { age: 5.5, hpd: [4.4, 6.7] },
      );
      p.layout.treeState = { source: timeExamples.beast, root };
      expect(
        dom(p)
          .querySelector('[data-part="tree-node"][data-node-id="十字花科"]')!
          .getAttribute("transform"),
      ).not.toBe(before);
      expect(render(JSON.parse(JSON.stringify(p)))).toBe(render(p));
      const current = render(p);
      p.style.hpdWidth = 13;
      p.style.hpdColor = "#a03463";
      expect(render(p)).not.toBe(current);
      expect(
        dom(p).querySelector('[data-part="node-hpd"]')?.getAttribute("stroke"),
      ).toBe("#a03463");
      p.style.showHPD = false;
      expect(dom(p).querySelectorAll('[data-part="node-hpd"]').length).toBe(0);
    });
  it("时间控件只对实际输入显示，原始树不出现无效年代控件", () => {
    const p = project(treeTemplates[0]),
      control = treeTemplates[0].controls.find((c) => c.key === "hpdWidth")!;
    expect(control.visible?.(p)).toBe(false);
    p.dataset = { tables: [], text: timeExamples.mcmctree, format: "nexus" };
    expect(control.visible?.(p)).toBe(true);
    p.style.showHPD = false;
    expect(control.visible?.(p)).toBe(false);
  });
});

describe("树方向与已确认文字控件", () => {
  it("矩形RTL的树、叶名、图层位置正确翻转且保持画布内", () => {
    const p = project(treeTemplates[0]);
    p.layers = [layer("heatmap", parseNewick(String(p.dataset.text)))];
    const ltr = dom(p);
    p.style.treeDirection = "rtl";
    const rtl = dom(p);
    const xy = (el: Element) =>
      el
        .getAttribute("transform")!
        .match(/[-\d.]+/g)!
        .map(Number);
    expect(
      xy(rtl.querySelector('[data-part="tree-node"][data-node-id="植物"]')!)[0],
    ).toBeGreaterThan(
      xy(
        rtl.querySelector('[data-part="tree-node"][data-node-id="拟南芥"]')!,
      )[0],
    );
    expect(
      rtl
        .querySelector('[data-part="leaf-label"] text')
        ?.getAttribute("text-anchor"),
    ).toBe("end");
    expect(rtl.querySelector('[data-part="branches"]')?.outerHTML).not.toBe(
      ltr.querySelector('[data-part="branches"]')?.outerHTML,
    );
    expect(render(p)).not.toMatch(/NaN|Infinity/);
  });
  it("环形向内及内半径有实际几何，29层仍能绘制", () => {
    const p = project(treeTemplates[1]);
    const original = render(p);
    p.style.inwardTree = true;
    p.style.innerRadius = 240;
    expect(render(p)).not.toBe(original);
    const first = render(p);
    p.style.innerRadius = 400;
    expect(render(p)).not.toBe(first);
    const root = parseNewick(String(p.dataset.text));
    for (const spec of treeLayerSpecs) {
      p.layers = [layer(spec.type, root)];
      expect(render(p), spec.type).not.toMatch(/NaN|Infinity/);
      expect(
        dom(p).querySelectorAll("path,circle,rect,text").length,
      ).toBeGreaterThan(10);
    }
  });
  it("区间文本/换算/字体和年代文字数值各自真实生效", () => {
    const p = project(treeTemplates[0]);
    p.dataset = { tables: [], text: timeExamples.beast, format: "nexus" };
    p.style.hpdType = "text";
    p.style.hpdFactor = 2;
    p.style.hpdTextX = 25;
    p.style.hpdTextY = -30;
    p.style.hpdTextColor = "#bd4a77";
    p.style.hpdTextBold = true;
    p.style.showNodeAges = true;
    p.style.ageFactor = 100;
    p.style.ageDecimals = 1;
    p.style.ageBold = true;
    p.style.ageAnchor = "middle";
    const doc = dom(p);
    expect(doc.querySelector('[data-part="node-hpd"]')?.textContent).toBe(
      "[21, 27.2]",
    );
    expect(
      doc.querySelector('[data-part="node-hpd"]')?.getAttribute("fill"),
    ).toBe("#bd4a77");
    expect(doc.querySelector('[data-part="node-age"]')?.textContent).toBe(
      "1200.0",
    );
    expect(
      doc.querySelector('[data-part="node-age"]')?.getAttribute("text-anchor"),
    ).toBe("middle");
  });
  it("多节点变量与斜杠多值支持度可真实读取和Newick重开", () => {
    const root = parseNewick("((A:1,B:1)98/85[&UFBoot=99,SHaLRT=83]:1,C:2)根;");
    expect(root.children[0].support).toBe(98);
    expect(root.children[0].annotationValues?.support2).toBe(85);
    expect(root.children[0].annotationValues?.ufboot).toBe(99);
    expect(
      parseNewick(writeNewick(root)).children[0].annotationValues?.shalrt,
    ).toBe(83);
  });
  it("枝长与叶数双向排序保持拓扑与枝长", () => {
    const root = parseNewick("(A:3,(B:1,C:1)BC:1,D:2)根;");
    expect(
      modifyTree(root, "根", "sort", { sort: "length" }).children.map(
        (n) => n.id,
      ),
    ).toEqual(["BC", "D", "A"]);
    expect(
      modifyTree(root, "根", "sort", {
        sort: "length",
        descending: true,
      }).children.map((n) => n.id),
    ).toEqual(["A", "D", "BC"]);
    expect(
      modifyTree(root, "根", "sort", { sort: "leafCount", descending: true })
        .children[0].id,
    ).toBe("BC");
  });
  it("不会把指向未折叠内部节点的末端轨道静默跳过", () => {
    const root = parseNewick(String(treeTemplates[0].example.text)),
      l = layer("bar", root);
    l.data!.tables[0].rows[0][0] = "植物";
    expect(
      validateLayer(l, root).some((i) => i.message.includes("内部节点")),
    ).toBe(true);
  });
});

it("树公共显示数值开关实际显示已有分支长度", () => {
  for (const t of treeTemplates) {
    const p = project(t);
    expect(
      dom(p).querySelectorAll('[data-part="tree-branch-length-label"]').length,
    ).toBe(0);
    p.style.showLabels = true;
    expect(
      dom(p).querySelectorAll('[data-part="tree-branch-length-label"]').length,
    ).toBe(11);
  }
});
