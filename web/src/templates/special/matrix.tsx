import React from "react";
import { figureLines } from '../../core/FigureHeading';
import { contrastText, SizeLegend } from "./legends";
import {
  annotationSize,
  MatrixAnnotations,
  CircleAnnotations,
  AnnotationLegend,
  specialProjectIssues,
} from "./advanced";
import type {
  Dataset,
  Issue,
  Project,
  RendererProps,
  Template,
} from "../../core/types";
import {
  baseStyle,
  bool,
  col,
  createTemplate,
  dataset,
  dimensions,
  enabled,
  error,
  fmt,
  Frame,
  Invalid,
  matrixIssues,
  num,
  numericCell,
  opt,
  palette,
  pick,
  required,
  rowIssue,
  table,
  text,
  uniqueIds,
  value,
} from "./shared";

const names = ["样本甲", "样本乙", "样本丙", "样本丁", "样本戊"];
const features = ["代谢通路A", "代谢通路B", "代谢通路C", "代谢通路D"];
const matrixExample = dataset(
  table(
    "matrix",
    "表达量模拟矩阵",
    "matrix",
    ["样本", ...features],
    names.map((n, i) => [
      n,
      ...features.map((_, j) => [2, 6, 11, 4, 8][(i + j) % 5] + i * j * 0.7),
    ]),
  ),
);
const matrixAlternate = dataset(
  table(
    "matrix",
    "替换后的模拟矩阵",
    "matrix",
    ["样本", "光合作用", "抗逆响应", "碳代谢"],
    ["处理甲", "处理乙", "对照"].map((n, i) => [
      n,
      ...[18, 5, 9].map((x, j) => x / (i + 1) + j * 3),
    ]),
  ),
);
const binaryExample = dataset(
  table(
    "matrix",
    "存在与缺失模拟矩阵",
    "matrix",
    ["样本", ...features],
    names.map((n, i) => [
      n,
      ...features.map((_, j) => ((i + j) % 3 === 0 ? 0 : 1)),
    ]),
  ),
);
const binaryAlternate = dataset(
  table(
    "matrix",
    "另一组存在与缺失",
    "matrix",
    ["样本", "基因A", "基因B", "基因C"],
    [
      ["菌株甲", 1, 0, 0],
      ["菌株乙", 0, 1, 1],
      ["菌株丙", 1, 1, 0],
    ],
  ),
);
function corrData(prefix = "环境", alt = false): Dataset {
  const labels = alt
    ? ["酸碱度", "水分", "温度"]
    : ["温度", "水分", "氮含量", "有机质"];
  const r = alt
    ? [
        [1, -0.72, 0.22],
        [-0.72, 1, 0.61],
        [0.22, 0.61, 1],
      ]
    : [
        [1, 0.67, -0.42, 0.21],
        [0.67, 1, -0.25, 0.58],
        [-0.42, -0.25, 1, -0.73],
        [0.21, 0.58, -0.73, 1],
      ];
  return dataset(
    table(
      "correlation",
      `${prefix}相关系数（模拟）`,
      "correlation",
      ["变量", ...labels],
      labels.map((x, i) => [x, ...r[i]]),
    ),
    table(
      "pvalues",
      "显著性 P 值（模拟）",
      "pvalues",
      ["变量", ...labels],
      labels.map((x, i) => [
        x,
        ...labels.map((_, j) =>
          i === j
            ? 0
            : Math.abs(r[i][j]) > 0.6
              ? 0.003
              : Math.abs(r[i][j]) > 0.35
                ? 0.04
                : 0.3,
        ),
      ]),
    ),
  );
}
const doubleExample = dataset(
  table(
    "correlation",
    "组间相关系数（模拟）",
    "correlation",
    ["变量", "基因A", "基因B", "基因C"],
    [
      ["酸碱度", 0.71, -0.22, 0.41],
      ["温度", -0.31, 0.63, 0.12],
      ["含水量", 0.18, 0.33, -0.77],
      ["有机碳", 0.44, -0.52, 0.68],
    ],
  ),
  table(
    "pvalues",
    "组间 P 值（模拟）",
    "pvalues",
    ["变量", "基因A", "基因B", "基因C"],
    [
      ["酸碱度", 0.003, 0.4, 0.04],
      ["温度", 0.12, 0.005, 0.62],
      ["含水量", 0.42, 0.11, 0.002],
      ["有机碳", 0.03, 0.01, 0.008],
    ],
  ),
);
const doubleAlternate = dataset(
  table(
    "correlation",
    "第二组相关系数（模拟）",
    "correlation",
    ["变量", "指标甲", "指标乙"],
    [
      ["处理前", 0.2, 0.8],
      ["处理后", -0.6, 0.1],
    ],
  ),
  table(
    "pvalues",
    "第二组 P 值（模拟）",
    "pvalues",
    ["变量", "指标甲", "指标乙"],
    [
      ["处理前", 0.3, 0.001],
      ["处理后", 0.01, 0.6],
    ],
  ),
);
const mantelExample = {
  ...corrData(),
  tables: [
    ...corrData().tables,
    table(
      "mantel",
      "Mantel 检验结果（模拟）",
      "mantel",
      ["source", "target", "r", "p"],
      [
        ["细菌群落", "温度", 0.36, 0.01],
        ["细菌群落", "水分", 0.61, 0.003],
        ["真菌群落", "氮含量", 0.28, 0.08],
        ["真菌群落", "有机质", -0.42, 0.02],
        ["真菌群落", "温度", 0.15, 0.2],
      ],
    ),
  ],
};
const mantelAlternate = {
  ...corrData("", true),
  tables: [
    ...corrData("", true).tables,
    table(
      "mantel",
      "替换的 Mantel 结果（模拟）",
      "mantel",
      ["source", "target", "r", "p"],
      [
        ["微生物群落", "水分", 0.71, 0.001],
        ["微生物群落", "温度", -0.26, 0.15],
      ],
    ),
  ],
};
const rawEnvironment = table(
  "raw-environment",
  "原始环境观测（模拟，可执行分析）",
  "raw-environment",
  ["样本", "温度", "水分", "氮含量", "有机质"],
  Array.from({ length: 12 }, (_, i) => [
    `样本${i + 1}`,
    12 + i * 0.9 + (i % 3),
    20 + i * 1.4 + (i % 4) * 2,
    15 - i * 0.3 + (i % 2) * 2,
    3 + i * 0.25 + (i % 3) * 0.4,
  ]),
);
const rawCommunity = table(
  "raw-community",
  "原始群落丰度（模拟，可执行分析）",
  "raw-community",
  ["样本", "物种甲", "物种乙", "物种丙"],
  Array.from({ length: 12 }, (_, i) => [
    `样本${i + 1}`,
    8 + i * 2 + (i % 3),
    25 - i + (i % 4) * 3,
    5 + (i % 5) * 4,
  ]),
);
const rawControl = table(
  "raw-control",
  "偏 Mantel 控制数据（模拟）",
  "raw-control",
  ["样本", "海拔", "距离"],
  Array.from({ length: 12 }, (_, i) => [
    `样本${i + 1}`,
    50 + i * 7 + (i % 4) * 5,
    3 + (i % 4) * 2 + i * 0.8,
  ]),
);
function withRaw(d: Dataset, multiple = false, mantel = false): Dataset {
  return {
    ...d,
    tables: [
      ...d.tables,
      structuredClone(rawEnvironment),
      ...(multiple || mantel ? [structuredClone(rawCommunity)] : []),
      ...(mantel ? [structuredClone(rawControl)] : []),
    ],
  };
}
function prepareAnalysis(
  method: string,
  d: Dataset,
  params: Record<string, unknown>,
) {
  if (method === "cluster") {
    const t = d.tables.find((t) => ["matrix", "correlation"].includes(t.role));
    if (!t) throw new Error("缺少可聚类的数值矩阵");
    return { data: { tables: [t] }, params: { ...params, axis: "both" } };
  }
  const env = d.tables.find((t) => t.role === "raw-environment");
  const communities = d.tables.filter((t) => t.role === "raw-community");
  if (!env)
    throw new Error(
      "请添加角色 raw-environment 的原始样本数值表；相关系数与 P 值表不能再次作为原始数据计算。",
    );
  if (method === "correlation")
    return {
      data: {
        tables: [
          { ...env, role: "matrix" },
          ...communities.slice(0, 1).map((t) => ({ ...t, role: "matrix" })),
        ],
      },
      params,
    };
  const control = d.tables.find((t) => t.role === "raw-control");
  if (method === "mantel.partial" && !control)
    throw new Error("偏 Mantel 必须提供独立的 raw-control 控制矩阵");
  if (!communities.length)
    throw new Error("Mantel 需要至少一张 raw-community 原始群落表");
  return {
    data: {
      tables: [
        { ...env, role: "environment" },
        ...communities.map((t) => ({ ...t, role: "community" })),
        ...(control && method === "mantel.partial"
          ? [{ ...control, role: "control" }]
          : []),
      ],
    },
    params,
  };
}
function resolvedAnalysis(p: Project): Project | null {
  const cluster =
    p.analysis?.method === "cluster"
      ? (p.analysis.result?.data as
          | {
              values?: number[][];
              rowLabels?: string[];
              columnLabels?: string[];
              row?: { order: number[] };
              column?: { order: number[] };
            }
          | undefined)
      : undefined;
  if (cluster?.values && cluster.rowLabels && cluster.columnLabels) {
    const ro = cluster.row?.order ?? cluster.rowLabels.map((_, i) => i),
      co = cluster.column?.order ?? cluster.columnLabels.map((_, i) => i);
    return {
      ...p,
      dataset: dataset(
        table(
          "matrix",
          "真实聚类与标准化矩阵",
          "matrix",
          ["样本", ...co.map((i) => cluster.columnLabels![i])],
          ro.map((i) => [
            cluster.rowLabels![i],
            ...co.map((j) => cluster.values![i][j]),
          ]),
        ),
      ),
      style: { ...p.style, rowOrder: "input", clusteredMatrix: true },
    };
  }
  if (text(p, "inputMode", "result") !== "raw") return p;
  const payload = p.analysis?.result?.data as
    | Record<string, unknown>
    | undefined;
  if (!payload) return null;
  const raw = p.dataset.tables.find((t) => t.role === "raw-environment");
  if (p.templateId === "mantel" && Array.isArray(payload.edges) && raw) {
    const env = payload.environmentCorrelation as
      | {
          rowLabels: string[];
          columnLabels: string[];
          r: number[][];
          p: number[][];
          adjustedP?: number[][];
        }
      | undefined;
    const labels =
      env?.rowLabels ??
      Array.from(
        new Set((payload.edges as { target: string }[]).map((e) => e.target)),
      );
    const edgeTable = table(
      "mantel",
      "真实 Mantel 结果",
      "mantel",
      ["source", "target", "r", "p"],
      (
        payload.edges as {
          source: string;
          target: string;
          r: number;
          p: number;
          adjustedP?: number;
        }[]
      ).map((e) => [
        p.dataset.tables.find((t) => t.id === e.source)?.name ?? e.source,
        e.target,
        e.r,
        e.adjustedP ?? e.p,
      ]),
    );
    const tables = env
      ? [
          table(
            "correlation",
            "真实环境 Pearson 相关系数",
            "correlation",
            ["变量", ...env.columnLabels],
            env.rowLabels.map((n, i) => [n, ...env.r[i]]),
          ),
          table(
            "pvalues",
            "真实环境 P 值",
            "pvalues",
            ["变量", ...env.columnLabels],
            env.rowLabels.map((n, i) => [n, ...(env.adjustedP ?? env.p)[i]]),
          ),
          edgeTable,
        ]
      : [
          table(
            "correlation",
            "环境变量列表",
            "correlation",
            ["变量", ...labels],
            labels.map((n, i) => [
              n,
              ...labels.map((_, j) => (i === j ? 1 : 0)),
            ]),
          ),
          edgeTable,
        ];
    return {
      ...p,
      dataset: dataset(...tables),
      style: { ...p.style, mantelEdgesOnly: !env },
    };
  }
  if (
    !Array.isArray(payload.r) ||
    !Array.isArray(payload.rowLabels) ||
    !Array.isArray(payload.columnLabels)
  )
    return null;
  const rows = payload.rowLabels as string[],
    columns = payload.columnLabels as string[],
    r = payload.r as number[][],
    pv = (payload.adjustedP ?? payload.p) as number[][];
  return {
    ...p,
    dataset: dataset(
      table(
        "correlation",
        "真实计算的相关系数",
        "correlation",
        ["变量", ...columns],
        rows.map((n, i) => [n, ...r[i]]),
      ),
      ...(pv
        ? [
            table(
              "pvalues",
              "真实计算的 P 值",
              "pvalues",
              ["变量", ...columns],
              rows.map((n, i) => [n, ...pv[i]]),
            ),
          ]
        : []),
    ),
  };
}

export function correlationIssues(
  d: Dataset,
  square = true,
  mantel = false,
): Issue[] {
  const t = pick(d, "correlation");
  const issues = matrixIssues(
    dataset(...(t ? [{ ...t, role: "matrix" }] : [])),
  );
  if (!t) return issues;
  t.rows.forEach((r, i) =>
    r.slice(1).forEach((_, j) => {
      numericCell(t, i, j + 1, issues, { min: -1, max: 1 });
    }),
  );
  const rowNames = t.rows.map((r) => String(r[0]));
  const columns = t.columns.slice(1);
  if (
    square &&
    (rowNames.length !== columns.length ||
      columns.some((x) => !rowNames.includes(x)))
  )
    issues.push(
      error("组内相关系数必须为方阵，行标签与数值列名必须为同一组变量", t),
    );
  if (
    square &&
    rowNames.length === columns.length &&
    columns.every((x) => rowNames.includes(x))
  ) {
    for (let i = 0; i < rowNames.length; i++)
      for (let j = i + 1; j < columns.length; j++) {
        const ri = rowNames.indexOf(columns[j]),
          cj = columns.indexOf(rowNames[i]) + 1;
        if (
          Math.abs(Number(t.rows[i][j + 1]) - Number(t.rows[ri]?.[cj])) > 1e-6
        )
          issues.push(rowIssue(t, i, j + 1, "组内相关系数矩阵应当对称"));
      }
  }
  const p = d.tables.find((x) => x.role === "pvalues");
  if (p) {
    issues.push(...matrixIssues(dataset({ ...p, role: "matrix" })));
    if (
      p.columns.slice(1).join("\0") !== columns.join("\0") ||
      p.rows.map((r) => r[0]).join("\0") !== rowNames.join("\0")
    )
      issues.push(error("P 值表的行标签、列名及顺序必须与相关系数表一致", p));
    p.rows.forEach((r, i) =>
      r
        .slice(1)
        .forEach((_, j) =>
          numericCell(p, i, j + 1, issues, { min: 0, max: 1 }),
        ),
    );
  }
  if (mantel) {
    const edges = d.tables.find((x) => x.role === "mantel");
    if (!edges)
      issues.push(
        error("缺少角色为 mantel 的结果表，需要 source、target、r、p 四列"),
      );
    else {
      issues.push(...required(edges, ["source", "target", "r", "p"]));
      if (edges.columns.includes("r") && edges.columns.includes("p"))
        edges.rows.forEach((r, i) => {
          const a = edges.columns.indexOf("source"),
            b = edges.columns.indexOf("target");
          if (!String(r[a] ?? "").trim())
            issues.push(rowIssue(edges, i, a, "群落名称不能为空"));
          if (!columns.includes(String(r[b])))
            issues.push(
              rowIssue(edges, i, b, `环境因子“${r[b]}”未出现在相关矩阵中`),
            );
          numericCell(edges, i, edges.columns.indexOf("r"), issues, {
            min: -1,
            max: 1,
          });
          numericCell(edges, i, edges.columns.indexOf("p"), issues, {
            min: 0,
            max: 1,
          });
        });
    }
  }
  return issues;
}
const rgb = (s: string) => {
  const h = s.replace("#", "");
  const a =
    h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h;
  return [0, 2, 4].map((i) => parseInt(a.slice(i, i + 2), 16) || 0);
};
function blend(a: string, b: string, t: number) {
  const x = rgb(a),
    y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t)))).join(",")})`;
}
function colorScale(p: Project, min: number, max: number) {
  const low = text(p, "lowColor", "#287d8e"),
    mid = text(p, "midColor", "#f9f6eb"),
    high = text(p, "highColor", "#c45963");
  const center = value(p, "colorCenter", (min + max) / 2);
  return (x: number) =>
    enabled(p, "diverging", true)
      ? x <= center
        ? blend(low, mid, (x - min) / (center - min || 1))
        : blend(mid, high, (x - center) / (max - center || 1))
      : blend(low, high, (x - min) / (max - min || 1));
}
function polar(cx: number, cy: number, r: number, a: number) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function sector(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  a0: number,
  a1: number,
) {
  const a = polar(cx, cy, outer, a0),
    b = polar(cx, cy, outer, a1),
    c = polar(cx, cy, inner, a1),
    d = polar(cx, cy, inner, a0);
  return `M${a} A${outer},${outer} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${b} L${c} A${inner},${inner} 0 ${a1 - a0 > Math.PI ? 1 : 0},0 ${d} Z`;
}
const commonControls = [
  num("cellGap", "单元格间距", 0, 12),
  num("cellStroke", "边框宽度", 0, 6, 0.5),
  col("cellStrokeColor", "边框颜色"),
  bool("showValues", "显示数值"),
  num("digits", "数值小数位", 0, 6),
  col("lowColor", "低值颜色"),
  col("midColor", "中间颜色"),
  col("highColor", "高值颜色"),
  bool("diverging", "使用三点配色"),
  {
    ...num("colorCenter", "配色中点", -100000, 100000, 0.1),
    help: "留空时自动取数据极值的中点",
  },
  opt("rowOrder", "行排序", [
    ["input", "数据顺序"],
    ["label", "名称升序"],
    ["mean", "平均值从高到低"],
  ]),
  num("labelAngle", "列标签旋转角", -90, 90, 5),
];
const correlationControls = [
  ...commonControls,
  opt("triangle", "显示区域", [
    ["full", "完整矩阵"],
    ["upper", "上三角"],
    ["lower", "下三角"],
  ]),
  opt("cellShape", "格内图形", [
    ["rect", "完整方格"],
    ["circle", "圆形（大小映射绝对值）"],
    ["square", "方形（大小映射绝对值）"],
  ]),
  bool("hideDiagonal", "隐藏对角线"),
  bool("showStars", "显示显著性星号"),
];
function Matrix({ project }: RendererProps) {
  const resolved = resolvedAnalysis(project);
  if (!resolved)
    return (
      <Frame project={project}>
        <text
          x={dimensions(project).w / 2}
          y={dimensions(project).h / 2}
          textAnchor="middle"
        >
          当前为原始数据模式，请在分析面板执行真实计算；已有结果不会冒充计算结果。
        </text>
      </Frame>
    );
  const p = resolved,
    id = p.templateId,
    isCorr =
      ["correlation", "double-correlation", "mantel"].includes(id) &&
      !enabled(p, "clusteredMatrix", false),
    isMantel = id === "mantel" && !enabled(p, "clusteredMatrix", false),
    binary = id.startsWith("binary") && !enabled(p, "clusteredMatrix", false),
    bubble = id === "bubble-matrix",
    circle = id === "circle-heatmap";
  const issues = isCorr
    ? correlationIssues(p.dataset, id !== "double-correlation", isMantel)
    : matrixIssues(p.dataset, "matrix", binary);
  issues.push(...specialProjectIssues(p));
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const t = pick(p.dataset, isCorr ? "correlation" : "matrix")!;
  const pv = p.dataset.tables.find((x) => x.role === "pvalues");
  const { w, h, left, top: baseTop, iw, ih } = dimensions(p);
  const clustering =
    p.analysis?.method === "cluster" &&
    enabled(p, "showDendrogram", true) &&
    (p.analysis.result?.data as ClusterResult | undefined);
  const rowAnnotation = annotationSize(p, "row"),
    columnAnnotation = annotationSize(p, "column");
  const top =
    baseTop +
    (clustering && !circle ? 65 : 0) +
    (circle ? 0 : columnAnnotation);
  const gap = value(p, "cellGap", 2),
    stroke = value(p, "cellStroke", 0.5),
    digits = value(p, "digits", 2),
    n = t.rows.length,
    m = t.columns.length - 1;
  const rows = t.rows.map((r, i) => ({ r, i }));
  const order = text(p, "rowOrder", "input");
  if (order === "label")
    rows.sort((a, b) => String(a.r[0]).localeCompare(String(b.r[0]), "zh-CN"));
  if (order === "mean")
    rows.sort(
      (a, b) =>
        b.r.slice(1).reduce<number>((s, x) => s + Number(x), 0) -
        a.r.slice(1).reduce<number>((s, x) => s + Number(x), 0),
    );
  const vals = t.rows.flatMap((r) => r.slice(1).map(Number));
  const min = isCorr ? -1 : Math.min(...vals),
    max = isCorr ? 1 : Math.max(...vals);
  const scale = colorScale(p, min, max),
    angle = value(p, "labelAngle", -35),
    pal = palette(p);
  const plotX =
      left +
      (isMantel ? 175 : 0) +
      (clustering && !circle ? 65 : 0) +
      (circle ? 0 : rowAnnotation),
    plotW =
      iw -
      (isMantel ? 175 : 0) -
      (clustering && !circle ? 65 : 0) -
      (circle ? 0 : rowAnnotation),
    plotH =
      ih -
      (enabled(p, "showLegend") ? 42 : 0) -
      (clustering && !circle ? 65 : 0) -
      (circle ? 0 : columnAnnotation),
    cw = plotW / m,
    ch = plotH / n;
  const maxAbs = Math.max(...vals.map(Math.abs), 1e-10);
  const bubbleColorMode = bubble
    ? text(p, "bubbleColorMode", "continuous")
    : "continuous";
  const bubbleCategories =
    bubbleColorMode === "row"
      ? rows.map((x) => String(x.r[0]))
      : t.columns.slice(1);
  const legend = (
    <g transform={`translate(${plotX},${top + plotH + 61})`}>
      {bubble && bubbleColorMode !== "continuous" ? (
        <>
          <text y={-14} fontSize={p.style.publicationVersion ? 14 : 10}>
            圆面积表示数值绝对值；颜色按
            {bubbleColorMode === "row" ? "行" : "列"}分类
          </text>
          {bubbleCategories.slice(0, 6).map((name, i) => (
            <g key={name} transform={`translate(${(i * plotW) / 6},0)`}>
              <circle r={4} fill={pal[i % pal.length]} />
              <text x={8} y={3} fontSize={9}>
                {name.length > 7 ? name.slice(0, 6) + "…" : name}
                <title>{`${name}`}</title>
              </text>
            </g>
          ))}
          <SizeLegend x={0} y={52} max={maxAbs} radius={n => Math.sqrt(n / maxAbs) * Math.max(0, Math.min(cw,ch) - value(p,"cellGap",2)) / 2 * value(p,"bubbleScale",.86)} title="绝对值（圆面积）" />
        </>
      ) : binary ? (
        <>
          <circle cx={7} r={5} fill={pal[0]} />
          <text x={19} y={4} fontSize={p.style.publicationVersion ? 14 : 11}>
            1：存在
          </text>
          <circle
            cx={107}
            r={5}
            fill={text(p, "absentColor", "#eef3f1")}
            stroke={pal[0]}
          />
          <text x={119} y={4} fontSize={p.style.publicationVersion ? 14 : 11}>
            0：缺失
          </text>
        </>
      ) : (
        <>
          {Array.from({ length: 80 }, (_, i) => (
            <rect
              key={i}
              x={i * 2.8}
              y={-5}
              width={3}
              height={10}
              fill={scale(min + ((max - min) * i) / 79)}
            />
          ))}
          {[0, 0.5, 1].map((x) => (
            <text
              key={x}
              x={x * 224}
              y={21}
              textAnchor={x === 0 ? "start" : x === 1 ? "end" : "middle"}
              fontSize={p.style.publicationVersion ? 14 : 10}
            >
              {fmt(min + (max - min) * x, digits)}
            </text>
          ))}
          {bubble && <SizeLegend x={275} y={0} max={maxAbs}
            radius={n => Math.sqrt(n / maxAbs) * Math.max(0, Math.min(cw,ch) - value(p,"cellGap",2)) / 2 * value(p,"bubbleScale",.86)} title="绝对值（圆面积）" /> }
        </>
      )}
    </g>
  );
  if (circle) {
    const cx = left + iw / 2,
      cy = top + plotH / 2;
    const outer = Math.max(30, Math.min(iw, plotH) * 0.46 - rowAnnotation);
    const inner = Math.min(
      outer * (p.style.publicationVersion ? .52 : .8),
      Math.max(value(p, "innerRadius", 55), clustering ? outer * 0.47 : 0),
    );
    const start = (value(p, "startAngle", -90) * Math.PI) / 180,
      sweep = (value(p, "sweepAngle", 310) * Math.PI) / 180;
    const rw = (outer - inner) / m,
      da = sweep / n;
    return (
      <Frame project={p}>
        <CircleAnnotations
          project={p}
          rows={rows.map((x) => String(x.r[0]))}
          columns={t.columns.slice(1)}
          cx={cx}
          cy={cy}
          inner={inner}
          outer={outer}
          start={start}
          sweep={sweep}
        />
        {clustering && (
          <RadialClusterTrees
            result={clustering}
            cx={cx}
            cy={cy}
            inner={inner}
            outer={outer}
            start={start}
            sweep={sweep}
          />
        )}

        {rows.map(({ r }, i) => (
          <g key={i}>
            {r.slice(1).map((v, j) => (
              <path
                key={j}
                d={sector(
                  cx,
                  cy,
                  inner + j * rw,
                  inner + (j + 1) * rw - gap,
                  start + i * da + gap / outer,
                  start + (i + 1) * da - gap / outer,
                )}
                fill={
                  Number(v) === 0 && enabled(p, "blankZero", false)
                    ? "none"
                    : scale(Number(v))
                }
                stroke={text(p, "cellStrokeColor", "#ffffff")}
                strokeWidth={stroke}
              >
                <title>{`${r[0]} / ${t.columns[j + 1]}：${v}`}</title>
              </path>
            ))}
            {enabled(p, "showLabels") && (
              <text
                x={
                  polar(
                    cx,
                    cy,
                    outer + rowAnnotation + 14,
                    start + (i + 0.5) * da,
                  )[0]
                }
                y={
                  polar(
                    cx,
                    cy,
                    outer + rowAnnotation + 14,
                    start + (i + 0.5) * da,
                  )[1]
                }
                textAnchor={
                  Math.cos(start + (i + 0.5) * da) > 0 ? "start" : "end"
                }
                dominantBaseline="middle"
                fontSize={p.style.publicationVersion ? 16 : 11}
              >
                {String(r[0])}
              </text>
            )}
            {enabled(p, "showValues", false) &&
              r.slice(1).map((v, j) => {
                const a = start + (i + 0.5) * da,
                  pos = polar(cx, cy, inner + (j + 0.5) * rw, a);
                return (
                  <text
                    key={j}
                    x={pos[0]}
                    y={pos[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={contrastText(scale(Number(v)), p.style.textColor)}
                    fontSize={Math.min(12, rw * 0.5)}
                  >
                    {fmt(Number(v), digits)}
                  </text>
                );
              })}
          </g>
        ))}
        {!clustering && !p.style.publicationVersion && (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize={12}>
              由内向外
            </text>
            {t.columns.slice(1).map((x, j) => (
              <text
                key={x}
                x={cx}
                y={cy + 10 + j * 15}
                textAnchor="middle"
                fontSize={10}
              >
                {x}
              </text>
            ))}
          </>
        )}
        {Boolean(p.style.publicationVersion) && <g>
          <text x={cx} y={cy-8} textAnchor="middle" fontSize={Math.min(16, inner*.42)}>{n} 个样本</text>
          <text x={cx} y={cy+16} textAnchor="middle" fontSize={Math.min(14, inner*.38)}>{m} 个变量</text>
          <text x={left} y={top+plotH+28} fontSize={14}>{'由内向外：'+t.columns.slice(1).join(' / ')}</text>
        </g>}
        {clustering && (
          <text x={cx} y={top + plotH + 30} textAnchor="middle" fontSize={10}>
            <title>{`${t.columns.slice(1).join(" / ")}`}</title>
            {("由内向外：" + t.columns.slice(1).join(" / ")).slice(
              0,
              Math.floor(iw / 11),
            )}
          </text>
        )}
        {enabled(p, "showLegend") && legend}
        <AnnotationLegend
          project={p}
          x={left + 260}
          y={top + plotH + 57}
          width={iw - 260}
        />
      </Frame>
    );
  }
  if (isMantel && enabled(p, "mantelEdgesOnly", false))
    return (
      <Frame project={p}>
        <MantelLinks
          project={p}
          matrixX={plotX + 78}
          matrixY={top}
          height={plotH}
          rowNames={rows.map((x) => String(x.r[0]))}
        />
        {rows.map(({ r }, i) => (
          <g key={i}>
            <circle
              cx={plotX + 20}
              cy={top + ((i + 0.5) * plotH) / n}
              r={5}
              fill={pal[0]}
            />
            <text x={plotX + 34} y={top + ((i + 0.5) * plotH) / n + 4}>
              {String(r[0])}
            </text>
          </g>
        ))}
        <text x={plotX} y={top + plotH + 35} fontSize={11}>
          真实 Mantel 关联结果；环境相关矩阵需另外执行相关性计算。
        </text>
      </Frame>
    );
  const shape = binary
    ? id === "binary-dot"
      ? "binary"
      : "rect"
    : bubble
      ? "circle"
      : text(p, "cellShape", "rect");
  const stars = (r: number, j: number) => {
    const q = Number(pv?.rows[r]?.[j + 1]);
    return q < 0.001 ? "***" : q < 0.01 ? "**" : q < 0.05 ? "*" : "";
  };
  return (
    <Frame project={p}>
      {clustering && (
        <ClusterTrees
          result={clustering}
          x={plotX}
          y={top}
          width={plotW}
          height={plotH}
          rowOffset={rowAnnotation}
          columnOffset={columnAnnotation}
        />
      )}
      <MatrixAnnotations
        project={p}
        rows={rows.map((x) => String(x.r[0]))}
        columns={t.columns.slice(1)}
        x={plotX}
        y={top}
        width={plotW}
        height={plotH}
      />
      <g transform={`translate(${plotX},${top})`}>
        {rows.map(({ r, i: originalI }, i) => (
          <g key={String(r[0])}>
            {r.slice(1).map((v, j) => {
              const x = j * cw + cw / 2,
                y = i * ch + ch / 2,
                nv = Number(v),
                diag = String(r[0]) === t.columns[j + 1],
                tri = text(p, "triangle", "full");
              if (
                (isCorr && enabled(p, "hideDiagonal", false) && diag) ||
                (isCorr && tri === "upper" && originalI > j) ||
                (isCorr && tri === "lower" && originalI < j)
              )
                return null;
              const size =
                (Math.max(0, Math.min(cw, ch) - gap) / 2) *
                (shape === "circle" || shape === "square"
                  ? Math.sqrt(Math.abs(nv) / maxAbs)
                  : 1);
              const fill = binary
                ? nv === 1
                  ? text(p, "presentColor", pal[0])
                  : text(p, "absentColor", "#f1f4f2")
                : nv === 0 && enabled(p, "blankZero", false)
                  ? "none"
                  : bubbleColorMode === "row"
                    ? pal[i % pal.length]
                    : bubbleColorMode === "column"
                      ? pal[j % pal.length]
                      : scale(nv);
              return (
                <g key={j}>
                  <title>{`${r[0]} / ${t.columns[j + 1]}：${v}${pv ? `；P=${pv.rows[originalI]?.[j + 1]}` : ""}`}</title>
                  {enabled(p, "showGrid") && (
                    <rect
                      x={j * cw}
                      y={i * ch}
                      width={cw}
                      height={ch}
                      fill="none"
                      stroke="#e6eceb"
                      strokeWidth={0.5}
                    />
                  )}
                  {shape === "circle" || shape === "binary" ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={
                        shape === "binary"
                          ? Math.max(1, size * 0.55)
                          : size * value(p, "bubbleScale", 0.86)
                      }
                      fill={fill}
                      stroke={
                        shape === "binary"
                          ? text(p, "presentColor", pal[0])
                          : text(p, "cellStrokeColor", "#ffffff")
                      }
                      strokeWidth={stroke}
                    />
                  ) : (
                    <rect
                      x={shape === "square" ? x - size : j * cw + gap / 2}
                      y={shape === "square" ? y - size : i * ch + gap / 2}
                      width={
                        shape === "square" ? size * 2 : Math.max(0, cw - gap)
                      }
                      height={
                        shape === "square" ? size * 2 : Math.max(0, ch - gap)
                      }
                      rx={value(p, "cellRadius", 0)}
                      fill={fill}
                      stroke={text(p, "cellStrokeColor", "#ffffff")}
                      strokeWidth={stroke}
                    />
                  )}{" "}
                  {enabled(p, "showValues", false) && (
                    <text
                      x={x}
                      y={y + (isCorr && enabled(p, "showStars", true) ? -3 : 0)}
                      dominantBaseline="middle"
                      textAnchor="middle"
                      fill={contrastText(fill, p.style.textColor)}
                      fontSize={Math.min(value(p, "fontSize", 13), ch * (p.style.publicationVersion ? .38 : .28), cw * .28)}
                    >
                      {fmt(nv, digits)}
                    </text>
                  )}
                  {isCorr && pv && enabled(p, "showStars", true) && !diag && (
                    <text
                      x={x}
                      y={y + (enabled(p, "showValues", false) ? Math.min(ch * .28, 15) : 4)}
                      fill={contrastText(fill, p.style.textColor)}
                      textAnchor="middle"
                      fontSize={12}
                    >
                      {stars(originalI, j)}
                    </text>
                  )}
                </g>
              );
            })}
            {enabled(p, "showLabels") && (
              <text
                x={-rowAnnotation - (clustering ? 90 : 10)}
                y={(i + 0.5) * ch}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={Math.min(value(p, "fontSize", 13), ch * 0.7)}
              >
                {p.style.publicationVersion ? figureLines(String(r[0]),Math.max(40,left-26),Math.min(p.style.fontSize,ch*.7)).map((line,k,lines)=><tspan key={k} x={-rowAnnotation-(clustering?90:10)} dy={k? p.style.fontSize*1.15 : -(lines.length-1)*p.style.fontSize*.575}>{line}</tspan>) : String(r[0])}
              </text>
            )}
          </g>
        ))}
        {enabled(p, "showLabels") &&
          t.columns.slice(1).map((c, j) => (
            <text
              key={c}
              transform={`translate(${(j + 0.5) * cw},${plotH + 17}) rotate(${angle})`}
              textAnchor={angle === 0 ? "middle" : angle < 0 ? "end" : "start"}
              fontSize={Math.min(value(p, "fontSize", 13), cw * 0.35)}
            >
              {p.style.publicationVersion && angle===0 ? figureLines(c,cw-8,Math.min(p.style.fontSize,cw*.35)).map((line,k)=><tspan x={0} dy={k?p.style.fontSize*1.2:0} key={k}>{line}</tspan>) : c}
            </text>
          ))}
      </g>
      {enabled(p, "showLegend") && legend}
      {pv && enabled(p,"showLegend") && enabled(p,"showStars",true) && <text x={plotX} y={top + plotH + 102} fontSize={10}>* P &lt; 0.05；** P &lt; 0.01；*** P &lt; 0.001</text>}
      <AnnotationLegend
        project={p}
        x={plotX + 260}
        y={top + plotH + 57}
        width={plotW - 260}
      />
      {isMantel && (
        <MantelLinks
          project={p}
          matrixX={plotX}
          matrixY={top}
          height={plotH}
          rowNames={rows.map((x) => String(x.r[0]))}
        />
      )}
    </Frame>
  );
}
type ClusterPart = {
  linkage?: number[][];
  order?: number[];
  labels?: string[];
};
type ClusterResult = { row?: ClusterPart; column?: ClusterPart };
function ClusterTrees({
  result,
  x,
  y,
  width,
  height,
  rowOffset = 0,
  columnOffset = 0,
}: {
  rowOffset?: number;
  columnOffset?: number;
  result: ClusterResult;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const draw = (part: ClusterPart | undefined, row: boolean) => {
    if (!part?.linkage?.length || !part.order?.length) return null;
    const n = part.order.length,
      max = Math.max(...part.linkage.map((z) => z[2]), 1e-12),
      nodes = new Map<number, { position: number; distance: number }>();
    part.order.forEach((leaf, i) =>
      nodes.set(leaf, {
        position: ((i + 0.5) * (row ? height : width)) / n,
        distance: 0,
      }),
    );
    return part.linkage.map((z, i) => {
      const a = nodes.get(z[0]),
        b = nodes.get(z[1]);
      if (!a || !b) return null;
      const parent = {
        position: (a.position + b.position) / 2,
        distance: (z[2] / max) * (row ? 63 : 50),
      };
      nodes.set(n + i, parent);
      const path = row
        ? `M${x - rowOffset - 12 - a.distance},${y + a.position} H${x - rowOffset - 12 - parent.distance} V${y + b.position} H${x - rowOffset - 12 - b.distance}`
        : `M${x + a.position},${y - columnOffset - 12 - a.distance} V${y - columnOffset - 12 - parent.distance} H${x + b.position} V${y - columnOffset - 12 - b.distance}`;
      return (
        <path key={i} d={path} fill="none" stroke="#6c858e" strokeWidth={1.1}>
          <title>{`合并距离 ${fmt(z[2], 4)}；包含 ${z[3]} 个叶节点`}</title>
        </path>
      );
    });
  };
  return (
    <g aria-label="真实层次聚类树">
      {draw(result.row, true)}
      {draw(result.column, false)}
    </g>
  );
}

function MantelLinks({
  project: p,
  matrixX,
  matrixY,
  height,
  rowNames,
}: {
  project: Project;
  matrixX: number;
  matrixY: number;
  height: number;
  rowNames: string[];
}) {
  const t = p.dataset.tables.find((x) => x.role === "mantel")!;
  const key = (x: string) => t.columns.indexOf(x),
    source = key("source"),
    target = key("target"),
    ri = key("r"),
    pi = key("p");
  const groups = Array.from(new Set(t.rows.map((r) => String(r[source]))));
  const pal = palette(p);
  const threshold = value(p, "pFilter", 1);
  return (
    <g>
      {rowNames.map((n, i) => (
        <circle
          key={n}
          cx={matrixX - 58}
          cy={matrixY + ((i + 0.5) * height) / rowNames.length}
          r={3}
          fill="#9bafb4"
        />
      ))}
      {t.rows
        .filter((r) => Number(r[pi]) <= threshold)
        .map((r, i) => {
          const gi = groups.indexOf(String(r[source])),
            yi = rowNames.indexOf(String(r[target])),
            x0 = matrixX - 170,
            y0 = matrixY + ((gi + 1) * height) / (groups.length + 1),
            x1 = matrixX - 58,
            y1 = matrixY + ((yi + 0.5) * height) / rowNames.length;
          const path =
            text(p, "linkShape", "curve") === "line"
              ? `M${x0},${y0} L${x1},${y1}`
              : `M${x0},${y0} C${x0 + 40},${y0} ${x1 - 35},${y1} ${x1},${y1}`;
          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke={
                Number(r[pi]) < 0.05
                  ? text(p, "significantColor", "#3d977f")
                  : text(p, "nonsignificantColor", "#bec8ca")
              }
              strokeWidth={
                1 + Math.abs(Number(r[ri])) * value(p, "linkWidthScale", 8)
              }
              strokeDasharray={
                Number(r[ri]) < 0 && enabled(p, "negativeDash", true)
                  ? "5 4"
                  : undefined
              }
            >
              <title>{`${r[source]} → ${r[target]}；r=${r[ri]}，P=${r[pi]}`}</title>
            </path>
          );
        })}
      {groups.map((g, i) => (
        <g
          key={g}
          transform={`translate(${matrixX - 170},${matrixY + ((i + 1) * height) / (groups.length + 1)})`}
        >
          <circle r={7} fill={pal[i % pal.length]} />
          <text
            x={-11}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={12}
          >
            {g.length > 12 ? g.slice(0, 11) + "…" : g}
          </text>
          <title>{`${g}`}</title>
        </g>
      ))}
      {enabled(p, "showLegend") && (
        <g data-mantel-legend="true" transform={`translate(${matrixX - 225},${matrixY + height + 42})`}>
          {[.2,.5,.8].map((r,i)=><g key={r} transform={`translate(${i*66},0)`}><line x2={30} stroke={p.style.textColor} strokeWidth={1+r*value(p,"linkWidthScale",8)}/><text x={34} y={3} fontSize={9}>{r}</text></g>)}
          <text y={18} fontSize={9}>|Mantel r|；虚线表示负相关</text>
          <line y1={32} y2={32} x2={25} stroke={text(p,"significantColor","#3d977f")} strokeWidth={3}/><text x={31} y={35} fontSize={9}>P &lt; 0.05</text>
          <line x1={100} x2={125} y1={32} y2={32} stroke={text(p,"nonsignificantColor","#bec8ca")} strokeWidth={3}/><text x={131} y={35} fontSize={9}>P ≥ 0.05</text>
        </g>
      )}
    </g>
  );
}
const analysisMethods = [
  {
    method: "correlation",
    label: "相关性检验",
    description:
      "从原始样本×变量矩阵计算相关系数与 P 值；支持 Pearson、Spearman、Kendall。",
    params: { correlation: "pearson" },
  },
  {
    method: "cluster",
    label: "层次聚类",
    description: "按指定距离与连接方法真实计算行列聚类。",
    params: {
      linkage: "complete",
      distance: "euclidean",
      standardization: "None",
      direction: "column",
      axis: "both",
    },
  },
];
const matrixHelp =
  "角色 matrix：单个宽表，第一列是唯一的行名称，其余各列是数值特征。所有数字单元格必填，不能包含单位文字；CSV/TSV 的第一行是列名。矩阵示例为自行模拟。";
const correlationHelp =
  "角色 correlation：第一列为变量名，后续数值为已经计算的相关系数，范围 −1～1。角色 pvalues 为可选 P 值矩阵（0～1），标签及顺序必须一致。普通相关矩阵要求对称方阵；组间矩阵可以是长方形。默认示例由固定种子模拟观测经 Pearson 检验计算；不能作为真实实验结论。";
const source = (path: string) => [`https://www.chiplot.online/${path}.html`];
export const matrixTemplates: Template[] = [
  createTemplate(
    "heatmap",
    "数值热图",
    "矩阵与相关",
    "用颜色表达行与列交叉处的数值，支持真实数据替换与精确标注。",
    matrixExample,
    matrixAlternate,
    Matrix,
    {
      familyId: "matrix",
      variant: "矩形",
      controls: [
        ...commonControls,
        bool("blankZero", "零值留白"),
        num("cellRadius", "圆角", 0, 20),
      ],
      inputHelp: matrixHelp,
      sourceUrls: source("heatmap"),
      analysisMethods: analysisMethods.slice(1),
    },
  ),
  createTemplate(
    "circle-heatmap",
    "圈形热图",
    "矩阵与相关",
    "以同心环排列指标，用扇区表达每个样本的数值。",
    matrixExample,
    matrixAlternate,
    Matrix,
    {
      familyId: "matrix",
      variant: "圈形",
      defaultStyle: {
        ...baseStyle,
        title: "圈形热图",
        marginLeft: 110,
        innerRadius: 65,
        sweepAngle: 310,
      },
      controls: [
        ...commonControls.filter((c) => c.key !== "labelAngle"),
        num("innerRadius", "内圈半径", 10, 220),
        num("startAngle", "起始角", -180, 180),
        num("sweepAngle", "环形角度", 30, 355),
        bool("blankZero", "零值留白"),
      ],
      inputHelp: matrixHelp,
      sourceUrls: source("circle_heatmap"),
      analysisMethods: analysisMethods.slice(1),
    },
  ),
  ...(["dot", "rect"] as const).map((mode) =>
    createTemplate(
      `binary-${mode}`,
      mode === "dot" ? "圆点二值图" : "方格二值图",
      "矩阵与相关",
      "展示特征的存在（1）与缺失（0）。",
      binaryExample,
      binaryAlternate,
      Matrix,
      {
        familyId: "binary",
        variant: mode === "dot" ? "圆点" : "方格",
        controls: [
          num("cellGap", "单元格间距", 0, 12),
          num("cellStroke", "描边宽度", 0.5, 5, 0.5),
          col("presentColor", "存在颜色"),
          col("absentColor", "缺失颜色"),
          bool("showValues", "显示 0/1"),
          opt("rowOrder", "行排序", [
            ["input", "数据顺序"],
            ["label", "名称升序"],
            ["mean", "存在数量降序"],
          ]),
          num("labelAngle", "列标签角度", -90, 90, 5),
        ],
        defaultStyle: {
          ...baseStyle,
          title: mode === "dot" ? "圆点二值图" : "方格二值图",
          presentColor: "#237c83",
          absentColor: "#eef3f1",
        },
        validate: (d) => matrixIssues(d, "matrix", true),
        inputHelp: matrixHelp + " 数值必须严格为 0 或 1。",
        sourceUrls: source(mode === "dot" ? "binary_plot" : "binary_plot2"),
        analysisMethods: analysisMethods.slice(1),
      },
    ),
  ),
  createTemplate(
    "bubble-matrix",
    "数值气泡矩阵",
    "矩阵与相关",
    "用圆面积和颜色同时显示二维矩阵中的数值。",
    matrixExample,
    matrixAlternate,
    Matrix,
    {
      familyId: "matrix",
      variant: "气泡",
      controls: [
        ...commonControls,
        num("bubbleScale", "气泡尺寸倍率", 0.1, 1, 0.05),
        opt("bubbleColorMode", "气泡配色依据", [
          ["continuous", "连续数值"],
          ["row", "按行分类"],
          ["column", "按列分类"],
        ]),
      ],
      validate: (d) => matrixIssues(d),
      inputHelp:
        matrixHelp +
        " 圆面积映射数值绝对值；连续色保留数值和正负，按行/列分类时颜色只表达类别。0 值圆面积为 0。分类图例显示前 6 项，完整行列名仍在矩阵轴上。",
      sourceUrls: source("bubble_plot"),
    },
  ),
  createTemplate(
    "correlation",
    "组内相关性热图",
    "矩阵与相关",
    "展示同一组变量之间的相关系数、显著性和上/下三角布局。",
    corrData(),
    corrData("", true),
    Matrix,
    {
      familyId: "correlation",
      variant: "组内",
      defaultStyle: { ...baseStyle, title: "组内相关性热图", colorCenter: 0 },
      controls: correlationControls,
      validate: (d) => correlationIssues(d, true),
      inputHelp: correlationHelp,
      sourceUrls: source("correlation_heatmap"),
      analysisMethods,
    },
  ),
  createTemplate(
    "double-correlation",
    "组间相关性热图",
    "矩阵与相关",
    "比较两组不同变量之间的相关性，允许行列数量不同。",
    doubleExample,
    doubleAlternate,
    Matrix,
    {
      familyId: "correlation",
      variant: "组间",
      defaultStyle: { ...baseStyle, title: "组间相关性热图", colorCenter: 0 },
      controls: correlationControls.filter(
        (c) => !["triangle", "hideDiagonal"].includes(c.key),
      ),
      validate: (d) => correlationIssues(d, false),
      inputHelp: correlationHelp,
      sourceUrls: source("dubble_matrices_correlation_heatmap"),
      analysisMethods: [
        {
          ...analysisMethods[0],
          method: "double_correlation",
          label: "两矩阵相关性检验",
        },
        analysisMethods[1],
      ],
    },
  ),
  createTemplate(
    "mantel",
    "Mantel 关联热图",
    "矩阵与相关",
    "环境相关性矩阵结合群落—环境 Mantel 检验结果，显示关联强度和显著性。",
    mantelExample,
    mantelAlternate,
    Matrix,
    {
      familyId: "correlation",
      variant: "Mantel",
      defaultStyle: {
        ...baseStyle,
        width: 1120,
        marginLeft: 180,
        title: "Mantel 关联热图",
        colorCenter: 0,
      },
      controls: [
        ...correlationControls,
        num("pFilter", "仅显示 P ≤", 0, 1, 0.01),
        num("linkWidthScale", "连线粗细倍率", 1, 20),
        opt("linkShape", "连线形状", [
          ["curve", "曲线"],
          ["line", "直线"],
        ]),
        col("significantColor", "P < 0.05 颜色"),
        col("nonsignificantColor", "其他 P 值颜色"),
        bool("negativeDash", "负相关显示虚线"),
      ],
      validate: (d) => correlationIssues(d, true, true),
      inputHelp:
        correlationHelp +
        " 另外需要角色 mantel 的边表：source 为群落名，target 为矩阵中的环境变量名，r 为 −1～1 的 Mantel 系数，p 为 0～1。",
      sourceUrls: source("mantel_test_correlation_heatmap"),
      analysisMethods: [
        {
          method: "mantel",
          label: "Mantel 检验",
          description:
            "对真实环境与群落输入执行 Mantel/ade4/偏 Mantel 检验；偏 Mantel 需要独立控制矩阵。",
          params: {
            method: "mantel",
            spec_distance: "bray",
            env_distance: "euclidean",
            permutations: 999,
            seed: 2026,
          },
        },
      ],
      limitations: [
        "图中已有结果展示与分析面板的原始数据计算分开；示例仅为模拟，未计算时不声称完成统计检验。",
      ],
    },
  ),
];
for (const t of matrixTemplates) {
  if (t.analysisMethods?.some((m) => m.method === "cluster")) {
    t.controls.push(bool("showDendrogram", "显示真实聚类树"));
    t.defaultStyle.showDendrogram = true;
  }
  if (!["correlation", "double-correlation", "mantel"].includes(t.id))
    t.validate = (d) => matrixIssues(d, "matrix", t.id.startsWith("binary"));
  t.prepareAnalysis = prepareAnalysis;
  if (["correlation", "double-correlation", "mantel"].includes(t.id)) {
    t.example = withRaw(
      t.example,
      t.id === "double-correlation",
      t.id === "mantel",
    );
    t.alternate = withRaw(
      t.alternate,
      t.id === "double-correlation",
      t.id === "mantel",
    );
    const resultValidate = t.validate;
    t.validate = (d, s) => {
      if (s?.inputMode !== "raw") return resultValidate(d, s);
      const issues = d.tables
        .filter((t) =>
          ["raw-environment", "raw-community", "raw-control"].includes(t.role),
        )
        .flatMap((t) => matrixIssues(dataset({ ...t, role: "matrix" })));
      if (!d.tables.some((t) => t.role === "raw-environment"))
        issues.push(error("原始分析缺少角色 raw-environment 的样本数值表"));
      if (
        ["double-correlation", "mantel"].includes(t.id) &&
        !d.tables.some((t) => t.role === "raw-community")
      )
        issues.push(error("原始分析缺少角色 raw-community 的第二组样本数值表"));
      return issues;
    };
    t.defaultStyle.inputMode = "result";
    t.controls.unshift(
      opt(
        "inputMode",
        "数据模式",
        [
          ["result", "已有结果绘图"],
          ["raw", "原始数据真实分析"],
        ],
        "数据",
      ),
    );
    t.inputHelp +=
      " 原始分析只读取 raw-environment、raw-community、raw-control 角色的表。切换“原始数据真实分析”后执行分析，图中显示真实服务结果。";
    if (t.id === "double-correlation") t.analysisMethods = analysisMethods;
    if (t.id === "mantel")
      t.analysisMethods = [
        "mantel",
        "mantel.randtest",
        "mantel.rtest",
        "mantel.partial",
      ].map((method) => ({
        method,
        label:
          method === "mantel.partial"
            ? "偏 Mantel 检验"
            : method === "mantel.randtest"
              ? "Mantel（ade4 C++）"
              : method === "mantel.rtest"
                ? "Mantel（ade4 R）"
                : "Mantel（vegan）",
        description: "使用原始环境、群落表；偏 Mantel 另需独立控制矩阵。",
        params: {
          speciesDistance: "bray",
          environmentDistance: "euclidean",
          controlDistance: "euclidean",
          permutations: 999,
          seed: 2026,
        },
      }));
  }
}

function RadialClusterTrees({
  result,
  cx,
  cy,
  inner,
  outer,
  start,
  sweep,
}: {
  result: ClusterResult;
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  start: number;
  sweep: number;
}) {
  const draw = (part: ClusterPart | undefined, row: boolean) => {
    if (!part?.order || !part.linkage) return null;
    const n = part.order.length,
      max = Math.max(...part.linkage.map((z) => z[2]), 1e-9),
      nodes = new Map<number, { pos: number; distance: number }>();
    part.order.forEach((leaf, i) =>
      nodes.set(leaf, {
        pos: row
          ? start + ((i + 0.5) * sweep) / n
          : inner + ((i + 0.5) * (outer - inner)) / n,
        distance: 0,
      }),
    );
    return part.linkage.map((z, i) => {
      const a = nodes.get(z[0])!,
        b = nodes.get(z[1])!;
      if (!a || !b) return null;
      const parent = { pos: (a.pos + b.pos) / 2, distance: z[2] / max };
      nodes.set(n + i, parent);
      const get = (v: { pos: number; distance: number }) =>
        row
          ? polar(
              cx,
              cy,
              Math.max(4, (inner - 10) * (1 - v.distance * 0.88)),
              v.pos,
            )
          : polar(
              cx,
              cy,
              v.pos,
              start +
                sweep +
                (2 * Math.PI - sweep) * 0.52 +
                v.distance * Math.max(0.05, (2 * Math.PI - sweep) * 0.4),
            );
      const ap = get(a),
        bp = get(b),
        pa = get({ ...parent, pos: a.pos }),
        pb = get({ ...parent, pos: b.pos });
      return (
        <path
          key={i}
          d={`M${ap} L${pa} L${pb} L${bp}`}
          fill="none"
          stroke="#6c858e"
          strokeWidth={1}
        >
          <title>{`真实聚类合并距离 ${fmt(z[2], 4)}`}</title>
        </path>
      );
    });
  };
  return (
    <g aria-label="圈形真实聚类树">
      {draw(result.row, true)}
      {draw(result.column, false)}
    </g>
  );
}
