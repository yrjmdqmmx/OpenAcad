import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { specialTemplates } from "./index";
import { makeProject, encodeProject, decodeProject } from "../../core/project";
const render = (p: ReturnType<typeof makeProject>) =>
  renderToStaticMarkup(
    React.createElement(
      specialTemplates.find((t) => t.id === p.templateId)!.Renderer,
      { project: p },
    ),
  );
describe("矩阵与关系模板的实际交付契约", () => {
  for (const t of specialTemplates)
    it(`${t.id}：两组数据、SVG、项目重开`, () => {
      const p = makeProject(t);
      expect(t.validate(p.dataset, p.style)).toEqual([]);
      const first = render(p);
      expect(first).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(first).toContain(`data-chart="${t.id}"`);
      expect(first).not.toMatch(/NaN|Infinity|请修正数据/);
      p.dataset = structuredClone(t.alternate);
      expect(t.validate(p.dataset, p.style)).toEqual([]);
      const second = render(p);
      expect(second).not.toEqual(first);
      expect(second).not.toMatch(/NaN|Infinity|请修正数据/);
      p.style.title = "重新打开后可继续编辑";
      p.layout = { nodePositions: { 甲: { x: 100, y: 120 } } };
      const reopened = decodeProject(encodeProject(p), specialTemplates);
      expect(reopened.dataset).toEqual(p.dataset);
      expect(reopened.layout).toEqual(p.layout);
      expect(render(reopened)).toContain("重新打开后可继续编辑");
    });
  it("逐单元格错误包括表、行、列", () => {
    for (const id of [
      "heatmap",
      "binary-dot",
      "bubble-matrix",
      "correlation",
    ]) {
      const t = specialTemplates.find((t) => t.id === id)!;
      const p = makeProject(t);
      p.dataset.tables[0].rows[0][1] = "不是数字";
      expect(t.validate(p.dataset, p.style)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tableId: p.dataset.tables[0].id,
            row: 2,
            column: 2,
            message: expect.stringContaining("不是有限数字"),
          }),
        ]),
      );
    }
  });
  it("图形控件修改几何或颜色，网络箭头保留方向", () => {
    for (const [id, key, val] of [
      ["heatmap", "cellGap", 10],
      ["circle-heatmap", "sweepAngle", 180],
      ["bubble-matrix", "bubbleScale", 0.3],
      ["packing", "groupPacking", false],
      ["sankey", "nodeWidth", 40],
      ["network", "directedEdges", true],
      ["map", "projection", "orthographic"],
    ] as const) {
      const p = makeProject(specialTemplates.find((t) => t.id === id)!);
      const before = render(p);
      p.style[key] = val;
      expect(render(p)).not.toEqual(before);
      if (id === "network")
        expect(render(p)).toContain('marker-end="url(#network-arrow-');
    }
  });
  it("拒绝悬空边、流向环路与越界坐标", () => {
    const network = specialTemplates.find((t) => t.id === "network")!;
    let d = structuredClone(network.example);
    d.tables[1].rows[0][1] = "不存在的节点";
    expect(network.validate(d).some((i) => i.message.includes("不存在"))).toBe(
      true,
    );
    const flow = specialTemplates.find((t) => t.id === "sankey")!;
    d = structuredClone(flow.example);
    d.tables[0].rows.push(["居民", "太阳能", 1]);
    expect(flow.validate(d).some((i) => i.message.includes("环路"))).toBe(true);
    const map = specialTemplates.find((t) => t.id === "map")!;
    d = structuredClone(map.example);
    d.tables[0].rows[0][1] = 190;
    expect(map.validate(d)).toEqual(
      expect.arrayContaining([expect.objectContaining({ row: 2, column: 2 })]),
    );
  });
  it("相关性只用原始角色计算，偏 Mantel 要求独立控制矩阵", () => {
    const t = specialTemplates.find((t) => t.id === "correlation")!;
    expect(
      t.prepareAnalysis!("correlation", t.example, {}).data.tables,
    ).toEqual([
      expect.objectContaining({ id: "raw-environment", role: "matrix" }),
    ]);
    const m = specialTemplates.find((t) => t.id === "mantel")!;
    const d = {
      tables: m.example.tables.filter((t) => t.role !== "raw-control"),
    };
    expect(() => m.prepareAnalysis!("mantel.partial", d, {})).toThrow("独立");
  });
  it("原始模式不把模拟系数冒充计算结果；真实 Mantel 读取服务结果", () => {
    const t = specialTemplates.find((t) => t.id === "mantel")!;
    const p = makeProject(t);
    p.style.inputMode = "raw";
    expect(render(p)).toContain("请在分析面板执行真实计算");
    p.analysis = {
      method: "mantel",
      params: {},
      inputHash: "test",
      result: {
        data: {
          environmentCorrelation: {
            r: [
              [1, 0.23],
              [0.23, 1],
            ],
            p: [
              [0, 0.13],
              [0.13, 0],
            ],
            rowLabels: ["温度", "水分"],
            columnLabels: ["温度", "水分"],
          },
          edges: [
            { source: "raw-community", target: "温度", r: 0.78, p: 0.02 },
          ],
        },
      },
    };
    const svg = render(p);
    expect(svg).toContain("0.78");
    expect(svg).toContain("原始群落丰度");
    expect(svg).not.toContain("请在分析面板执行真实计算");
  });
});

describe("生信原格式与统计边界", () => {
  it("原格式 CDD / MEME / MCScanX 多文件示例和替代数据都真实解析", () => {
    for (const [id, key, mode] of [
      ["protein-domains", "proteinInput", "native"],
      ["protein-motifs", "proteinInput", "native"],
      ["synteny", "syntenyInput", "native"],
    ] as const) {
      const t = specialTemplates.find((t) => t.id === id)!;
      const p = makeProject(t);
      p.style[key] = mode;
      expect(t.validate(p.dataset, p.style)).toEqual([]);
      const first = render(p);
      expect(first).not.toMatch(/请修正数据|NaN|Infinity/);
      p.dataset = structuredClone(t.alternate);
      expect(t.validate(p.dataset, p.style)).toEqual([]);
      expect(render(p)).not.toEqual(first);
    }
  });
  it("缺少 CDD FASTA 与 MCScanX collinearity 给出文件角色错误", () => {
    for (const [id, key, missing] of [
      ["protein-domains", "proteinInput", "fasta"],
      ["synteny", "syntenyInput", "collinearity"],
    ] as const) {
      const t = specialTemplates.find((t) => t.id === id)!;
      const p = makeProject(t);
      p.style[key] = "native";
      p.dataset.files = p.dataset.files!.filter((f) => f.role !== missing);
      expect(
        t.validate(p.dataset, p.style).some((i) => i.message.includes(missing)),
      ).toBe(true);
    }
  });
  it("GC 模式的原始 FASTA 和真实结果显示分开", () => {
    const t = specialTemplates.find((t) => t.id === "genome-circos")!;
    const p = makeProject(t);
    p.style.genomeInput = "fasta";
    expect(t.validate(p.dataset, p.style)).toEqual([]);
    expect(render(p)).toContain("请在分析面板执行 GC");
    expect(t.prepareAnalysis!("gc", p.dataset, {}).data.sequences).toContain(
      ">模拟片段甲",
    );
    p.analysis = {
      method: "gc",
      params: {},
      inputHash: "test",
      result: {
        data: {
          sequences: [
            {
              name: "真实样本",
              length: 400,
              gcContent: [
                { start: 1, end: 200, value: 37.5 },
                { start: 201, end: 400, value: null },
              ],
              gcSkew: [
                { start: 1, end: 200, value: -0.2 },
                { start: 201, end: 400, value: null },
              ],
            },
          ],
        },
      },
    };
    expect(render(p)).toContain("真实样本");
    expect(render(p)).toContain("37.5");
    expect(render(p)).not.toMatch(/NaN|请在分析面板/);
  });
  it("火山图拒绝 P=0，富集圈要求 Up+Down=Count，区间拒绝越界", () => {
    const v = specialTemplates.find((t) => t.id === "volcano")!;
    let d = structuredClone(v.example);
    d.tables[0].rows[0][2] = 0;
    expect(v.validate(d)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          column: 3,
          message: expect.stringContaining("必须大于 0"),
        }),
      ]),
    );
    const e = specialTemplates.find((t) => t.id === "enrichment-circle")!;
    d = structuredClone(e.example);
    d.tables[0].rows[0][7] = 90;
    expect(e.validate(d).some((i) => i.message.includes("Up + Down"))).toBe(
      true,
    );
    const p = specialTemplates.find((t) => t.id === "protein-domains")!;
    d = structuredClone(p.example);
    d.tables[1].rows[0][3] = 99999;
    expect(p.validate(d).some((i) => i.message.includes("超过序列长度"))).toBe(
      true,
    );
  });
});

describe("新增注释、动态轨道、断轴与完整符号", () => {
  it("矩形/二值/气泡/圈形注释真实绘制并随数值更新", () => {
    for (const id of [
      "heatmap",
      "binary-dot",
      "bubble-matrix",
      "circle-heatmap",
    ]) {
      const t = specialTemplates.find((t) => t.id === id)!,
        p = makeProject(t);
      p.layers = [
        {
          id: "annotation",
          name: "行条形注释",
          type: "matrix-row-bar",
          visible: true,
          settings: { size: 24 },
          data: {
            tables: [
              {
                id: "annotation",
                name: "行条形注释",
                role: "annotation",
                columns: ["标签", "值"],
                rows: p.dataset.tables[0].rows.map((r, i) => [r[0], i + 1]),
              },
            ],
          },
        },
      ];
      const first = render(p);
      expect(first).toContain(
        id === "circle-heatmap" ? "circle-annotations" : "matrix-annotations",
      );
      p.layers[0].data!.tables[0].rows[0][1] = 40;
      expect(render(p)).not.toEqual(first);
      const saved = decodeProject(encodeProject(p), specialTemplates);
      expect(saved.layers).toEqual(p.layers);
    }
  });
  it("矩形与圈形都依据真实聚类结果绘出 linkage 分支", () => {
    for (const id of ["heatmap", "circle-heatmap"]) {
      const p = makeProject(specialTemplates.find((t) => t.id === id)!);
      p.analysis = {
        method: "cluster",
        params: {},
        inputHash: "fixture",
        result: {
          data: {
            values: [
              [1, 2],
              [3, 5],
              [8, 2],
            ],
            rowLabels: ["甲", "乙", "丙"],
            columnLabels: ["A", "B"],
            row: {
              order: [2, 0, 1],
              linkage: [
                [0, 1, 2, 2],
                [2, 3, 6, 3],
              ],
            },
            column: { order: [0, 1], linkage: [[0, 1, 3, 2]] },
          },
        },
      };
      const svg = render(p);
      expect(svg).toContain(
        id === "circle-heatmap" ? "圈形真实聚类树" : "真实层次聚类树",
      );
      expect(svg).not.toMatch(/NaN|Infinity/);
      p.style.showDendrogram = false;
      expect(render(p)).not.toContain(
        id === "circle-heatmap" ? "圈形真实聚类树" : "真实层次聚类树",
      );
    }
  });
  it("网络7种符号、地图14填充模式和可见自环", () => {
    const shapes = [
      "circle",
      "cross",
      "diamond",
      "square",
      "star",
      "triangle",
      "wye",
    ];
    const p = makeProject(specialTemplates.find((t) => t.id === "network")!);
    const network = new Set(
      shapes.map((shape) => {
        p.style.nodeShape = shape;
        return render(p);
      }),
    );
    expect(network.size).toBe(7);
    p.dataset.tables[1].rows.push(["n1", "n1", 2]);
    expect(render(p)).not.toContain("请修正数据");
    expect(render(p)).toMatch(
      / C[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+/,
    );
    const m = makeProject(specialTemplates.find((t) => t.id === "map")!);
    expect(
      new Set(
        shapes
          .flatMap((shape) => [shape, shape + "-hollow"])
          .map((shape) => {
            m.style.mapPointShape = shape;
            return render(m);
          }),
      ).size,
    ).toBe(14);
  });
  it("基因簇断轴压缩真实坐标，两种箭头造型生效", () => {
    const p = makeProject(
      specialTemplates.find((t) => t.id === "gene-cluster")!,
    );
    const original = render(p);
    p.layers = [
      {
        id: "break",
        name: "基因间隔",
        type: "gene-break",
        visible: true,
        settings: {},
        data: {
          tables: [
            {
              id: "break",
              name: "基因间隔",
              role: "gene-break",
              columns: ["cluster", "start", "end"],
              rows: [["菌株甲", 761, 919]],
            },
          ],
        },
      },
    ];
    const compressed = render(p);
    expect(compressed).toContain("gene-break");
    expect(compressed).not.toEqual(original);
    p.style.geneArrowShape = "simple";
    expect(render(p)).not.toEqual(compressed);
    p.layers[0].data!.tables[0].rows[0][1] = 150;
    expect(render(p)).toContain("断轴区间与基因重叠");
  });
  it("圈图动态轨道支持独立区间、排序、4种图形与项目持久化", () => {
    const p = makeProject(
      specialTemplates.find((t) => t.id === "genome-circos")!,
    );
    p.layers = [
      {
        id: "track",
        name: "覆盖度",
        type: "genome-track",
        visible: true,
        settings: { size: 18, kind: "bar" },
        data: {
          tables: [
            {
              id: "track",
              name: "覆盖度",
              role: "genome-track",
              columns: ["chromosome", "start", "end", "value"],
              rows: [
                ["染色体甲", 1, 1000, 10],
                ["染色体甲", 1001, 2000, 40],
                ["染色体乙", 1, 1000, -15],
              ],
            },
          ],
        },
      },
    ];
    const images = ["bar", "line", "point", "heatmap"].map((kind) => {
      p.layers[0].settings.kind = kind;
      return render(p);
    });
    expect(new Set(images).size).toBe(4);
    for (const svg of images) {
      expect(svg).toContain("dynamic-genome-tracks");
      expect(svg).not.toMatch(/请修正数据|NaN|Infinity/);
    }
    expect(decodeProject(encodeProject(p), specialTemplates).layers).toEqual(
      p.layers,
    );
  });
});

describe("条件设置在相关数据条件下生效", () => {
  it("网络边标签、源/目标着色与桑基渐变使用真实数据", () => {
    const p = makeProject(specialTemplates.find((t) => t.id === "network")!);
    const edges = p.dataset.tables.find((t) => t.role === "edges")!;
    edges.columns.push("label");
    edges.rows.forEach((r, i) => r.push(`关系${i}`));
    p.style.showEdgeLabels = true;
    p.style.directedEdges = true;
    const base = render(p);
    expect(base).toContain("关系0");
    p.style.edgeColorMode = "source";
    const source = render(p);
    p.style.edgeColorMode = "target";
    expect(render(p)).not.toEqual(source);
    expect(source).not.toEqual(base);
    p.style.edgeLabelColor = "#e41969";
    expect(render(p)).toContain("#e41969");
    const s = makeProject(specialTemplates.find((t) => t.id === "sankey")!);
    s.style.flowColor = "gradient";
    expect(render(s)).toContain('stroke="url(#flow-gradient-');
  });
  it("网络节点分类形状和边分类不依赖全局统一样式", () => {
    const t = specialTemplates.find((t) => t.id === "network")!,
      p = makeProject(t),
      nodes = p.dataset.tables[0],
      edges = p.dataset.tables[1];
    nodes.columns.push("shape");
    nodes.rows.forEach((r, i) => r.push(i % 2 ? "star" : "cross"));
    edges.columns.push("group");
    edges.rows.forEach((r, i) => r.push(i % 2 ? "激活" : "抑制"));
    expect(t.validate(p.dataset)).toEqual([]);
    p.style.nodeShapeMode = "column";
    p.style.edgeColorMode = "group";
    const a = render(p);
    expect(a).toContain("边：激活");
    p.style.nodeShapeMode = "group";
    expect(render(p)).not.toEqual(a);
    nodes.rows[0][nodes.columns.indexOf("shape")] = "未定义形状";
    expect(
      t.validate(p.dataset).some((i) => i.message.includes("节点形状须为")),
    ).toBe(true);
  });
  it("Venn 标签位置和染色体手动顺序进入项目往返及 SVG", () => {
    const v = makeProject(specialTemplates.find((t) => t.id === "venn")!);
    const before = render(v);
    v.layout.labelPositions = {
      [`venn-${v.dataset.tables[0].columns[0]}`]: { x: 99, y: 123 },
    };
    expect(render(v)).not.toEqual(before);
    expect(render(decodeProject(encodeProject(v), specialTemplates))).toEqual(
      render(v),
    );
    const s = makeProject(specialTemplates.find((t) => t.id === "synteny")!);
    const original = render(s);
    s.layout.chromosomeOrder = s.dataset.tables[0].rows
      .map((r) => String(r[0]))
      .reverse();
    expect(render(s)).not.toEqual(original);
    expect(render(decodeProject(encodeProject(s), specialTemplates))).toEqual(
      render(s),
    );
  });
  it("箭头肩部高度及富集分类注释可独立调整", () => {
    const g = makeProject(
      specialTemplates.find((t) => t.id === "gene-cluster")!,
    );
    const original = render(g);
    g.style.arrowHeadHeight = 2.3;
    expect(render(g)).not.toEqual(original);
    for (const id of ["enrichment-dot", "enrichment-bar"]) {
      const p = makeProject(specialTemplates.find((t) => t.id === id)!);
      p.style.showEnrichClass = true;
      expect(render(p)).toContain('data-enrich-class="生物过程"');
      expect(render(p)).toContain("enrich-class-legend");
    }
  });
  it("气泡矩阵连续数值及行列分类配色实际变化", () => {
    const p = makeProject(
      specialTemplates.find((t) => t.id === "bubble-matrix")!,
    );
    const a = render(p);
    p.style.bubbleColorMode = "row";
    const b = render(p);
    expect(b).not.toEqual(a);
    p.style.bubbleColorMode = "column";
    expect(render(p)).not.toEqual(b);
  });
  it("跨图层重叠的断轴被明确拒绝", async () => {
    const { specialProjectIssues } = await import("./advanced");
    const p = makeProject(
      specialTemplates.find((t) => t.id === "gene-cluster")!,
    );
    const cluster = String(p.dataset.tables[0].rows[0][0]);
    p.layers = [0, 1].map((i) => ({
      id: `break${i}`,
      type: "gene-break",
      name: `断轴${i}`,
      visible: true,
      settings: {},
      data: {
        tables: [
          {
            id: `table${i}`,
            name: `表${i}`,
            role: "gene-break",
            columns: ["cluster", "start", "end"],
            rows: [[cluster, 1600, 1700]],
          },
        ],
      },
    }));
    expect(
      specialProjectIssues(p).some((i) => i.message.includes("前序区间重叠")),
    ).toBe(true);
  });
  it("专有注释按字段名读取，不因上传表列顺序变化而交换数据", async () => {
    const { specialLayerTable } = await import("./advanced");
    const result = specialLayerTable({
      id: "t",
      type: "genome-track",
      name: "轨道",
      visible: true,
      settings: {},
      data: {
        tables: [
          {
            id: "a",
            name: "自定义轨道",
            role: "track",
            columns: ["value", "end", "chromosome", "start"],
            rows: [[3, 200, "染色体甲", 100]],
          },
        ],
      },
    })!;
    expect(result.columns).toEqual(["chromosome", "start", "end", "value"]);
    expect(result.rows).toEqual([["染色体甲", 100, 200, 3]]);
  });
  it("零值留白、二值缺失色、零交集都在匹配数据上变化", () => {
    const h = makeProject(specialTemplates.find((t) => t.id === "heatmap")!);
    h.dataset.tables[0].rows[0][1] = 0;
    const b = render(h);
    h.style.blankZero = true;
    expect(render(h)).not.toEqual(b);
    const dot = makeProject(
      specialTemplates.find((t) => t.id === "binary-dot")!,
    );
    const a = render(dot);
    dot.style.absentColor = "#ffcc00";
    expect(render(dot)).not.toEqual(a);
    const v = makeProject(specialTemplates.find((t) => t.id === "venn")!);
    v.dataset.tables[0].rows = v.dataset.tables[0].rows.map((r, i) =>
      r.map((_, j) => `独有${i}-${j}`),
    );
    const c = render(v);
    v.style.showZero = true;
    expect(render(v)).not.toEqual(c);
  });
  it("流对齐、类别透明度与普通数值轨道上限使用相应输入", () => {
    const f = makeProject(specialTemplates.find((t) => t.id === "sankey")!);
    f.dataset.tables[0].rows.push(["太阳能", "短路径", 12]);
    const a = render(f);
    f.style.flowAlign = "left";
    expect(render(f)).not.toEqual(a);
    const g = makeProject(
      specialTemplates.find((t) => t.id === "gene-cluster")!,
    );
    g.style.connectCategories = true;
    const b = render(g);
    g.style.homologyOpacity = 0.5;
    expect(render(g)).not.toEqual(b);
    const c = makeProject(
      specialTemplates.find((t) => t.id === "genome-circos")!,
    );
    c.dataset.tables[1].rows[0][4] = "value";
    const before = render(c);
    c.style.trackValueMax = 300;
    expect(render(c)).not.toEqual(before);
  });
  it("富集标签开关与共线性名称排序在对应情况下可见", () => {
    const e = makeProject(
      specialTemplates.find((t) => t.id === "enrichment-dot")!,
    );
    const before = render(e);
    e.style.showLabels = false;
    expect(render(e)).not.toEqual(before);
    const s = makeProject(specialTemplates.find((t) => t.id === "synteny")!);
    s.dataset.tables[0].rows.reverse();
    const original = render(s);
    s.style.chromosomeSort = "name";
    expect(render(s)).not.toEqual(original);
  });
});
