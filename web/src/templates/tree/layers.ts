import { parseMeme } from "../special/biology";
import type { Control, Dataset, Issue, Layer } from "../../core/types";
import { leaves, walk, type TreeNode } from "./model";
export interface TreeLayerSpec {
  type: string;
  label: string;
  help: string;
  columns: string[];
  numeric: string[];
  unrooted: boolean;
  track: boolean;
}
const specs: [string, string, string[], string[], boolean, boolean, string][] =
  [
    [
      "rename",
      "替换叶名",
      ["nodeID", "文字"],
      [],
      true,
      false,
      "以 nodeID 匹配叶节点，替换显示名称，保持树结构 ID 不变。",
    ],
    [
      "append",
      "追加叶名",
      ["nodeID", "文字"],
      [],
      true,
      false,
      "将文字追加到叶名称后面。",
    ],
    [
      "superscript",
      "叶名上标",
      ["nodeID", "文字"],
      [],
      true,
      false,
      "将文字以上标追加到叶名称后面。",
    ],
    [
      "italic",
      "局部斜体",
      ["nodeID", "文字"],
      [],
      true,
      false,
      "将叶名中与“文字”相同的片段设为斜体；填写完整叶名可全部斜体。",
    ],
    [
      "label-color",
      "叶名分类色",
      ["nodeID", "分类", "颜色"],
      [],
      true,
      false,
      "同类使用相同文字色，颜色填写 #RRGGBB；留空按配色表。",
    ],
    [
      "label-font",
      "叶名字体分类",
      ["nodeID", "字体", "字号"],
      ["字号"],
      true,
      false,
      "按节点指定字体和字号；字体可用 Noto Sans SC（黑体）或 Noto Serif CJK SC（宋体），与导出使用相同字体。",
    ],
    [
      "branch-color",
      "分支分类色",
      ["nodeID", "分类", "颜色"],
      [],
      true,
      false,
      "设置通向节点的分支颜色；可启用继承到整个子树。",
    ],
    [
      "label-background",
      "叶名背景色块",
      ["nodeID", "颜色"],
      [],
      true,
      false,
      "为叶名称绘制背景色块。",
    ],
    [
      "node-symbol",
      "节点符号",
      ["nodeID", "形状", "大小", "颜色"],
      ["大小"],
      true,
      false,
      "形状支持圆、方、三角、星；大小为半径。",
    ],
    [
      "leaf-pie",
      "叶侧饼图",
      ["nodeID", "系列", "数值"],
      ["数值"],
      true,
      true,
      "同一个叶节点可多行，按系列数值计算真实饼图比例。",
    ],
    [
      "branch-pie",
      "分支饼图",
      ["nodeID", "系列", "数值"],
      ["数值"],
      true,
      false,
      "在指定节点分支位置显示按系列比例的饼图。",
    ],
    [
      "bar",
      "普通柱",
      ["nodeID", "数值"],
      ["数值"],
      false,
      true,
      "每叶一个数值，零基线柱长映射数值。",
    ],
    [
      "category-bar",
      "分类柱",
      ["nodeID", "数值", "分类"],
      ["数值"],
      false,
      true,
      "数值控制柱长，分类控制颜色。",
    ],
    [
      "lollipop",
      "普通棒棒糖",
      ["nodeID", "数值"],
      ["数值"],
      false,
      true,
      "用线段与端点显示数值。",
    ],
    [
      "category-lollipop",
      "分类棒棒糖",
      ["nodeID", "数值", "分类"],
      ["数值"],
      false,
      true,
      "用分类色区分棒棒糖的线段和端点。",
    ],
    [
      "stacked-bar",
      "堆叠柱",
      ["nodeID", "系列", "数值"],
      ["数值"],
      false,
      true,
      "每个节点多行组成数据，按系列堆叠，可归一到 100%。",
    ],
    [
      "box",
      "普通箱线",
      ["nodeID", "数值"],
      ["数值"],
      false,
      true,
      "每节点多行原始观测，计算 R-7 分位数与 1.5 IQR 观测须。",
    ],
    [
      "category-box",
      "分类箱线",
      ["nodeID", "数值", "分类"],
      ["数值"],
      false,
      true,
      "在每个节点位置按分类并排展示原始观测箱图。",
    ],
    [
      "heatmap",
      "热图",
      ["nodeID", "列", "数值"],
      ["数值"],
      false,
      true,
      "节点为行，列名为列，数值映射连续色。",
    ],
    [
      "binary1",
      "二值矩阵·色块",
      ["nodeID", "列", "数值"],
      ["数值"],
      false,
      true,
      "数值只能是 0 或 1，以空心/实心格表示。",
    ],
    [
      "binary2",
      "二值矩阵·符号",
      ["nodeID", "列", "数值"],
      ["数值"],
      false,
      true,
      "数值只能是 0 或 1，以叉号/圆点表示。",
    ],
    [
      "bubble",
      "气泡矩阵",
      ["nodeID", "列", "数值"],
      ["数值"],
      false,
      true,
      "非负数值映射气泡面积。",
    ],
    [
      "text-matrix",
      "文本矩阵",
      ["nodeID", "列", "文字"],
      [],
      false,
      true,
      "按节点和列定位文字。",
    ],
    [
      "category-text-matrix",
      "分类文本矩阵",
      ["nodeID", "列", "文字", "分类"],
      [],
      false,
      true,
      "矩阵文字按分类着色。",
    ],
    [
      "branch-text",
      "分支文字",
      ["nodeID", "文字"],
      [],
      true,
      false,
      "在通向指定节点的分支中点添加文字。",
    ],
    [
      "node-link",
      "两节点连线",
      ["nodeID", "目标节点", "数值"],
      ["数值"],
      true,
      false,
      "连接源节点与目标节点，数值映射线宽；不改变拓扑。",
    ],
    [
      "geologic",
      "地质年代尺",
      ["nodeID", "起点", "终点", "文字", "颜色"],
      ["起点", "终点"],
      false,
      false,
      "绘制真实区间长度的独立年代尺，数字单位由图层标题说明；数据不用于推断分歧时间。",
    ],
    [
      "motif",
      "MEME 基序位置",
      ["nodeID", "起点", "终点", "基序", "序列长度"],
      ["起点", "终点", "序列长度"],
      false,
      true,
      "读取已经定位的基序区间。起点/终点为从 1 开始的闭区间，序列长度用于横向定位；不运行 MEME 分析。",
    ],
    [
      "recombination",
      "重组片段",
      ["nodeID", "起点", "终点", "颜色", "序列长度"],
      ["起点", "终点", "序列长度"],
      false,
      true,
      "绘制已经计算出的重组区间，使用从 1 开始的闭区间坐标；不执行重组检测。",
    ],
  ];
export const treeLayerSpecs: TreeLayerSpec[] = specs.map(
  ([type, label, columns, numeric, unrooted, track, help]) => ({
    type,
    label,
    columns,
    numeric,
    unrooted,
    track,
    help,
  }),
);
export const specFor = (type: string) =>
  treeLayerSpecs.find((s) => s.type === type.replace(/^tree:/, ""));
export const layerRows = (
  layer: Layer,
): Record<string, string | number | null>[] => {
  const t = layer.data?.tables[0];
  return t
    ? t.rows.map((row) =>
        Object.fromEntries(t.columns.map((c, i) => [c, row[i] ?? null])),
      )
    : [];
};
export const defaultLayerSettings = {
  width: 84,
  gap: 12,
  opacity: 0.88,
  color: "#087f8c",
  fontSize: 12,
  lineWidth: 1.6,
  pointSize: 5,
  title: "",
  showTitle: true,
  normalize: false,
  inherit: false,
  showValues: false,
  cellPadding: 1,
};
export const layerControls: Control[] = [
  { key: "width", label: "图层宽度", type: "number", min: 20, max: 600 },
  { key: "gap", label: "与前层间距", type: "number", min: 0, max: 100 },
  {
    key: "opacity",
    label: "透明度",
    type: "number",
    min: 0,
    max: 1,
    step: 0.05,
  },
  { key: "color", label: "主色", type: "color" },
  { key: "fontSize", label: "字号", type: "number", min: 6, max: 40 },
  {
    key: "lineWidth",
    label: "线宽",
    type: "number",
    min: 0.5,
    max: 12,
    step: 0.5,
  },
  { key: "pointSize", label: "符号半径", type: "number", min: 1, max: 20 },
  { key: "title", label: "图层标题", type: "text" },
  { key: "showTitle", label: "显示图层标题", type: "boolean" },
  { key: "showValues", label: "显示数值", type: "boolean" },
];
export function layerExample(
  type: string,
  root: TreeNode,
  alternate = false,
): Dataset {
  const spec = specFor(type)!;
  const leaf = leaves(root);
  const internal = walk(root).filter((n) => n.children.length);
  const targets = [
    "branch-pie",
    "branch-text",
    "node-symbol",
    "branch-color",
  ].includes(spec.type)
    ? [...internal.slice(0, 2), ...leaf.slice(0, 4)]
    : leaf;
  const rows: (string | number | null)[][] = [];
  for (const [i, n] of targets.entries()) {
    const k = alternate ? i + (spec.type.startsWith("binary") ? 3 : 4) : i;
    const push = (obj: Record<string, string | number>) =>
      rows.push(spec.columns.map((c) => obj[c] ?? ""));
    const base = {
      nodeID: n.id,
      文字: alternate ? "验证" + (i + 1) : "注释" + (i + 1),
      分类: i % 2 ? "实验组" : "对照组",
      颜色: (i + (alternate ? 1 : 0)) % 2 ? "#eb8972" : "#087f8c",
      数值: 4 + ((k * 7) % 17),
    };
    if (["leaf-pie", "branch-pie", "stacked-bar"].includes(spec.type)) {
      for (let j = 0; j < 3; j++)
        push({
          ...base,
          系列: ["功能甲", "功能乙", "功能丙"][j],
          数值: 3 + ((k + j * 3) % 10),
        });
    } else if (["box", "category-box"].includes(spec.type)) {
      for (let j = 0; j < 10; j++)
        push({
          ...base,
          数值: +(10 + k * 2 + Math.sin(j * 1.2 + k) * 3 + j * 0.4).toFixed(2),
          分类: j < 5 ? "条件甲" : "条件乙",
        });
    } else if (
      [
        "heatmap",
        "binary1",
        "binary2",
        "bubble",
        "text-matrix",
        "category-text-matrix",
      ].includes(spec.type)
    ) {
      for (let j = 0; j < 4; j++)
        push({
          ...base,
          列: ["指标甲", "指标乙", "指标丙", "指标丁"][j],
          数值: spec.type.startsWith("binary")
            ? (k + j) % 2
            : 1 + ((k * j + j + 2) % 12),
          文字: alternate ? "高" : "中",
        });
    } else if (["motif", "recombination"].includes(spec.type)) {
      for (let j = 0; j < 3; j++)
        push({
          ...base,
          起点: 10 + j * 80 + k * 2,
          终点: 50 + j * 80 + k * 2,
          基序: ["基序甲", "基序乙", "基序丙"][j],
          序列长度: 350,
        });
    } else if (spec.type === "geologic") {
      if (i < 3)
        push({
          ...base,
          起点: k * 20,
          终点: k * 20 + 20 + (alternate ? i * 7 : 0),
          文字: ["阶段一", "阶段二", "阶段三"][i],
        });
    } else if (spec.type === "node-link") {
      if (i < Math.floor(leaf.length / 2))
        push({
          ...base,
          目标节点: leaf[leaf.length - 1 - i].id,
          数值: 1 + (k % 3),
        });
    } else
      push({
        ...base,
        文字:
          spec.type === "italic"
            ? alternate
              ? n.name.slice(-1)
              : n.name.slice(0, 2)
            : base.文字,
        字体: i % 2 ? "Noto Serif CJK SC" : "Noto Sans SC",
        字号: 12 + ((k + (alternate ? 2 : 0)) % 4),
        形状: ["圆", "方", "三角", "星"][k % 4],
        大小: 4 + (k % 4),
      });
  }
  return {
    tables: [
      {
        id: "annotation",
        name: spec.label + "示例",
        role: "annotation",
        columns: spec.columns,
        rows,
      },
    ],
  };
}
export function validateLayer(layer: Layer, root: TreeNode): Issue[] {
  const spec = specFor(layer.type);
  if (!spec) return [{ message: "无法识别的树图层。" }];
  const t = layer.data?.tables[0];
  if (!t) return [{ message: "图层尚未填写数据。" }];
  const issues: Issue[] = [];
  if (!t.rows.length) issues.push({ message: "图层至少需要一行注释数据。" });
  for (const c of spec.columns)
    if (!t.columns.includes(c))
      issues.push({ message: `图层“${layer.name}”缺少列“${c}”。` });
  if (issues.length) return issues;
  const ids = new Set(walk(root).map((n) => n.id));
  const rs = layerRows(layer);
  for (const [i, r] of rs.entries()) {
    for (const c of spec.columns) {
      if (r[c] === null || String(r[c]).trim() === "") {
        if (c !== "颜色")
          issues.push({
            tableId: t.id,
            row: i + 2,
            column: t.columns.indexOf(c) + 1,
            message: `第 ${i + 2} 行“${c}”不能为空。`,
          });
      } else if (spec.numeric.includes(c) && !Number.isFinite(Number(r[c])))
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: t.columns.indexOf(c) + 1,
          message: `第 ${i + 2} 行“${c}”不是有限数字。`,
        });
    }
    if (!ids.has(String(r.nodeID)))
      issues.push({
        row: i + 2,
        message: `第 ${i + 2} 行 nodeID“${r.nodeID}”不在当前树中。`,
      });
    const matchingNode = walk(root).find((n) => n.id === String(r.nodeID));
    if (
      matchingNode?.children.length &&
      !matchingNode.collapsed &&
      (spec.track ||
        [
          "rename",
          "append",
          "superscript",
          "italic",
          "label-color",
          "label-font",
          "label-background",
        ].includes(spec.type))
    )
      issues.push({
        row: i + 2,
        column: t.columns.indexOf("nodeID") + 1,
        message: `第 ${i + 2} 行 nodeID“${r.nodeID}”是内部节点；该图层需要叶节点或已折叠的末端节点。`,
      });
    if (spec.type === "node-link" && !ids.has(String(r["目标节点"])))
      issues.push({
        row: i + 2,
        message: `第 ${i + 2} 行目标节点“${r["目标节点"]}”不在当前树中。`,
      });
    if (spec.type.startsWith("binary") && ![0, 1].includes(Number(r["数值"])))
      issues.push({
        row: i + 2,
        message: `第 ${i + 2} 行二值数据必须为 0 或 1。`,
      });
    if (
      ["leaf-pie", "branch-pie", "stacked-bar", "bubble"].includes(spec.type) &&
      Number(r["数值"]) < 0
    )
      issues.push({ row: i + 2, message: `第 ${i + 2} 行“数值”不能小于 0。` });
    if (
      ["geologic", "motif", "recombination"].includes(spec.type) &&
      Number(r["起点"]) >= Number(r["终点"])
    )
      issues.push({ row: i + 2, message: `第 ${i + 2} 行起点必须小于终点。` });
    if (
      ["motif", "recombination"].includes(spec.type) &&
      (Number(r["起点"]) < 1 || Number(r["终点"]) > Number(r["序列长度"]))
    )
      issues.push({
        row: i + 2,
        message: `第 ${i + 2} 行区间必须位于 1 到序列长度之间。`,
      });
    if (
      spec.type === "label-font" &&
      !["Noto Sans SC", "Noto Serif CJK SC"].includes(String(r["字体"]))
    )
      issues.push({
        row: i + 2,
        message: `第 ${i + 2} 行字体应为 Noto Sans SC 或 Noto Serif CJK SC。`,
      });
    if (spec.type === "label-font" && Number(r["字号"]) <= 0)
      issues.push({ row: i + 2, message: `第 ${i + 2} 行字号必须大于 0。` });
    if (r["颜色"] && !/^#[\da-f]{6}$/i.test(String(r["颜色"])))
      issues.push({ row: i + 2, message: `第 ${i + 2} 行颜色应为 #RRGGBB。` });
  }
  const uniqueKeys = new Set<string>();
  const scalarTypes = [
    "bar",
    "category-bar",
    "lollipop",
    "category-lollipop",
    "label-font",
    "label-color",
    "branch-color",
    "label-background",
    "node-symbol",
  ];
  for (const [i, r] of rs.entries()) {
    const key = [
      "heatmap",
      "binary1",
      "binary2",
      "bubble",
      "text-matrix",
      "category-text-matrix",
    ].includes(spec.type)
      ? String(r.nodeID) + " / " + r["列"]
      : scalarTypes.includes(spec.type)
        ? String(r.nodeID)
        : "";
    if (key) {
      if (uniqueKeys.has(key))
        issues.push({
          row: i + 2,
          message: `第 ${i + 2} 行“${key}”重复，此图层每个节点或矩阵单元只能有一行。`,
        });
      uniqueKeys.add(key);
    }
  }
  if (["motif", "recombination"].includes(spec.type)) {
    const lengths = new Map<string, number>();
    for (const r of rs) {
      const key = String(r.nodeID),
        length = Number(r["序列长度"]);
      if (lengths.has(key) && lengths.get(key) !== length)
        issues.push({ message: `节点“${key}”的序列长度不一致。` });
      lengths.set(key, length);
    }
  }
  if (["box", "category-box", "leaf-pie", "branch-pie"].includes(spec.type)) {
    const groups = new Map<string, number[]>();
    for (const r of rs) {
      const k =
        String(r.nodeID) +
        (spec.type === "category-box" ? " / " + r["分类"] : "");
      groups.set(k, [...(groups.get(k) || []), Number(r["数值"])]);
    }
    for (const [key, v] of groups)
      if (
        spec.type.includes("box")
          ? v.length < 2
          : v.reduce((a, b) => a + b, 0) <= 0
      )
        issues.push({
          message: `节点“${key}”${spec.type.includes("box") ? "至少需要两个原始观测。" : "饼图的数值总和必须大于 0。"}`,
        });
  }
  return issues;
}

export function importMemeLayer(source: string): Dataset {
  const parsed = parseMeme(source);
  const lengths = new Map(parsed.proteins.map((p) => [p.id, p.length]));
  return {
    tables: [
      {
        id: "annotation",
        name: "MEME 扫描位点",
        role: "annotation",
        columns: ["nodeID", "起点", "终点", "基序", "序列长度"],
        rows: parsed.segments.map((s) => [
          s.sequence,
          s.start,
          s.end,
          s.name,
          lengths.get(s.sequence)!,
        ]),
      },
    ],
    files: [
      {
        id: "meme",
        name: "meme.xml",
        role: "meme",
        format: "xml",
        text: source,
      },
    ],
  };
}
