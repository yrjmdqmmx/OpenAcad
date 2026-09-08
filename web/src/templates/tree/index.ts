import type { ChartStyle, Control, Template } from "../../core/types";
import { defaults } from "../basic/shared";
import { parseTree, sourceText, stateFor, walk } from "./model";
import { TreeRenderer } from "./Renderer";
import {
  branchStyleControls,
  branchStyleDefaults,
  supportControls,
  treeLabelControls,
} from "./branch-style";
import { timeInfo, timeIssues } from "./time";
export { timeInfo, timeIssues, timeExamples } from "./time";
import { layerExample, treeLayerSpecs, specFor, validateLayer } from "./layers";
export { TreePanel } from "./TreePanel";
export { TreeRenderer, requiredTreeCanvas } from "./Renderer";
export {
  parseNewick,
  parseNexus,
  parsePhyloXml,
  parseTree,
  modifyTree,
  writeNewick,
  stateFor,
  walk,
  leaves,
} from "./model";
export { treeLayerSpecs, layerExample, validateLayer } from "./layers";
export { layoutTree } from "./geometry";
const primary =
  "((拟南芥:0.22,油菜:0.31)十字花科:0.28,(水稻:0.38,(玉米:0.18,小麦:0.24)禾本组:0.15)禾本科:0.21,(大豆:0.29,豌豆:0.35)豆科:0.33)植物;";
const alternate =
  "((拟南芥:0.4,油菜:0.2)十字花科:0.1,((水稻:0.16,玉米:0.35)禾本组:0.3,小麦:0.2)禾本科:0.4,(豌豆:0.2,大豆:0.4)豆科:0.15)植物;";
export const treeExample = { tables: [], text: primary, format: "newick" };
export const treeAlternate = { tables: [], text: alternate, format: "newick" };
const c = (
  key: string,
  label: string,
  type: Control["type"],
  min?: number,
  max?: number,
): Control => ({ key, label, type, min, max, section: "树布局" });
const controls: Control[] = [
  {
    key: "fontFamily",
    label: "字体",
    type: "select",
    section: "标题与文字",
    options: [
      { value: "Noto Sans SC", label: "思源黑体" },
      { value: "Noto Serif CJK SC", label: "思源宋体" },
    ],
  },
  {
    key: "treeLayout",
    label: "树布局",
    type: "select",
    section: "树布局",
    options: [
      { value: "normal", label: "矩形树" },
      { value: "circle", label: "环形树" },
      { value: "unrooted", label: "无根树" },
    ],
  },
  c("treeWidth", "树区域宽度", "number", 180, 1400),
  c("labelWidth", "叶名区域宽度", "number", 40, 500),
  c("leafSpacing", "最小叶间距", "number", 16, 100),
  c("useBranchLength", "按真实分支长度布局", "boolean"),
  c("showNodes", "显示节点", "boolean"),
  c("nodeSize", "节点半径", "number", 1, 15),
  c("branchColor", "分支颜色", "color"),
  c("nodeColor", "节点颜色", "color"),
  c("lineWidth", "分支线宽", "number", 0.5, 10),
  c("showSupport", "显示支持度", "boolean"),
  c("supportSize", "支持度字号", "number", 6, 30),
  c("supportColor", "支持度颜色", "color"),
  c("showBranchLengths", "显示分支长度数值", "boolean"),
  c("showScale", "显示分支长度尺", "boolean"),
  c("alignLabels", "叶名对齐", "boolean"),
  c("labelRotation", "矩形叶名旋转", "number", -90, 90),
  c("treeRotation", "环形与无根树旋转", "number", -360, 360),
  c("angleRange", "环形扇区角度", "number", 90, 360),
];
export const treeTemplates: Template[] = (
  ["normal", "circle", "unrooted"] as const
).map((kind) => ({
  id: "tree-" + kind,
  familyId: "phylogenetic-tree",
  variant: kind,
  version: 1,
  name: {
    normal: "矩形进化树工作台",
    circle: "环形进化树工作台",
    unrooted: "无根进化树工作台",
  }[kind],
  category: "进化树与注释",
  description:
    "导入真实树结构，编辑分支与节点，并将科研数据映射为可编辑注释图层。",
  tags: ["进化树", "系统发育", "Newick", "Nexus", "phyloXML", "图层"],
  sourceUrls: ["https://www.chiplot.online/tvbot.html"],
  status: "available",
  defaultStyle: {
    ...defaults,
    title: {
      normal: "植物亲缘关系 · 矩形树",
      circle: "植物亲缘关系 · 环形树",
      unrooted: "植物亲缘关系 · 无根树",
    }[kind],
    subtitle: "自行生成的模拟树 · 不代表真实系统发育结论",
    width: kind === "normal" ? 1050 : 900,
    height: kind === "normal" ? 650 : 900,
    treeLayout: kind,
    treeWidth: kind === "normal" ? 400 : 340,
    labelWidth: 130,
    leafSpacing: 28,
    useBranchLength: true,
    showNodes: true,
    nodeSize: 3,
    lineWidth: 1.7,
    branchColor: "#536875",
    nodeColor: "#087f8c",
    showSupport: true,
    supportSize: 10,
    alignLabels: true,
    showLegend: false,
    showScale: true,
    treeRotation: -90,
    angleRange: 360,
    timeLayout: "age",
    treeDirection: "ltr",
    inwardTree: false,
    innerRadius: 180,
    nodeAgeSource: "height",
    showHPD: true,
    hpdColor: "#447eaf",
    hpdWidth: 7,
    hpdOpacity: 0.35,
    hpdCaps: true,
    showTimeAxis: true,
    showNodeAges: false,
    showPosterior: false,
    ageFontSize: 10,
    ageColor: "#314d5a",
    timeUnit: "原树时间单位",
  },
  controls: [...controls],
  example: treeExample,
  alternate: treeAlternate,
  inputHelp:
    "在树工作台粘贴或上传 Newick（.nwk/.tree/.treefile）、Nexus（.nex/.nexus）或 phyloXML（.xml）。树以叶名称或内部名称作为 nodeID；无名内部节点自动编号。MCMCTree 的时间枝长和 95% 区间、BEAST 的 height/height_mean/height_median/height_95%_HPD/posterior 可直接导入；年代单位由原始分析决定。注释另用 UTF-8 CSV/TSV 或 Excel 表，nodeID 必须存在。",
  tutorial: [
    "点击树工作台，粘贴树文本或上传树文件；也可使用模拟示例。",
    "点击画布节点或在节点列表中选择，折叠、展开、换根、删除、重排，编辑分支长度和支持度。",
    "选择注释类型，添加示例图层；在 TSV 表格中以 nodeID 对应当前节点，更改数据与样式。",
    "时间树可按既有年代布局、编辑节点年代及区间；选择平均/中位来源时，使用文件提供的相应摘要，缺项沿用原树年代。未运行分歧时间估计。",
    "图层可排序、隐藏、删除；结构和图层均保存到项目文件，并可撤销/重做。",
    "导出图片前检查真实画布尺寸：图层过多时会自动扩大画布以避免裁切。",
  ],
  limitations: [
    "仅展示输入树，不运行序列比对、建树或分歧时间估计。",
    "Nexus 当前读取 TREES 区块中的第一棵 TREE；需要其他树时请单独导出。",
    "图层输入中的 nodeID 必须唯一匹配；重组和 MEME 基序位置由用户已计算结果提供。",
  ],
  formats: ["nwk", "newick", "tree", "treefile", "nex", "nexus", "xml"],
  exampleSource: {
    kind: "simulated",
    label: "OpenAcad 自制模拟拓扑与分支长度",
    license: "CC0-1.0",
  },
  validate: (dataset) => {
    try {
      parseTree(sourceText(dataset), dataset.format);
      return [];
    } catch (e) {
      return [{ message: e instanceof Error ? e.message : "无法解析树文本。" }];
    }
  },
  Renderer: TreeRenderer,
  layerTypes: treeLayerSpecs
    .filter((spec) => kind !== "unrooted" || spec.unrooted)
    .map((spec) => ({
      type: "tree:" + spec.type,
      label: spec.label,
      help: spec.help,
      example: layerExample(spec.type, parseTree(primary)),
    })),
}));

for (const t of treeTemplates)
  for (const c of t.controls) {
    if (
      [
        "treeRotation",
        "angleRange",
        "leafSpacing",
        "labelRotation",
        "alignLabels",
        "supportSize",
        "supportColor",
        "showSupport",
        "labelWidth",
      ].includes(c.key)
    )
      c.visible = (p: import("../../core/types").Project) => {
        const kind = String(
          p.style.treeLayout || p.templateId.replace("tree-", ""),
        );
        if (c.key === "treeRotation") return kind !== "normal";
        if (c.key === "angleRange") return kind === "circle";
        if (c.key === "leafSpacing" || c.key === "labelRotation")
          return kind === "normal";
        if (c.key === "alignLabels") return kind !== "unrooted";
        if (c.key === "labelWidth")
          return p.layers.some(
            (l) =>
              l.visible &&
              treeLayerSpecs.find((s) => s.type === l.type.replace("tree:", ""))
                ?.track,
          );
        if (c.key.startsWith("support") || c.key === "showSupport") {
          try {
            return (
              walk(stateFor(p).root).some((n) => n.support !== undefined) &&
              (c.key === "showSupport" || p.style.showSupport !== false)
            );
          } catch {
            return false;
          }
        }
        return true;
      };
  }

/** Validate the edited topology and every stored annotation against stable node IDs. */
export function treeProjectIssues(
  project: import("../../core/types").Project,
): import("../../core/types").Issue[] {
  let root: ReturnType<typeof parseTree>;
  try {
    root = stateFor(project).root;
  } catch (e) {
    return [{ message: e instanceof Error ? e.message : "无法解析当前树。" }];
  }
  const issues: import("../../core/types").Issue[] = [];
  const seen = new Set<string>();
  try {
    for (const n of walk(root)) {
      if (!n.id || seen.has(n.id))
        issues.push({
          message: `树中的节点 ID“${n.id}”为空或重复。请重新导入具有唯一节点的树。`,
        });
      seen.add(n.id);
      if (!Number.isFinite(n.length) || n.length < 0)
        issues.push({ message: `节点“${n.id}”的分支长度必须为非负有限数字。` });
      if (n.support !== undefined && !Number.isFinite(n.support))
        issues.push({ message: `节点“${n.id}”的支持度不是有限数字。` });
    }
  } catch {
    return [{ message: "保存的树结构不完整，请重新导入树文件。" }];
  }
  issues.push(...timeIssues(root, project.style));
  const layout = String(
    project.style.treeLayout || project.templateId.replace("tree-", ""),
  );
  for (const layer of project.layers) {
    const spec = specFor(layer.type);
    if (!spec) continue;
    const active = layer.visible && (layout !== "unrooted" || spec.unrooted);
    for (const issue of validateLayer(layer, root))
      issues.push({
        ...issue,
        severity: active ? "error" : "warning",
        message: `图层“${layer.name}”：${issue.message}${active ? "" : "（当前图层已隐藏或此布局暂停绘制；数据仍保留在项目中）"}`,
      });
  }
  return issues;
}

for (const template of treeTemplates)
  template.controls.push({
    key: "showLegend",
    label: "显示图例",
    type: "boolean",
    section: "配色与图形",
    visible: (p) =>
      p.layers.some(
        (l) =>
          l.visible &&
          Boolean(specFor(l.type)) &&
          (String(p.style.treeLayout || p.templateId.replace("tree-", "")) !==
            "unrooted" ||
            Boolean(specFor(l.type)?.unrooted)) &&
          l.data?.tables.some((t) =>
            ["系列", "分类", "基序"].some((c) => t.columns.includes(c)),
          ),
      ),
  });

const timeControls: Control[] = [
  {
    key: "hpdType",
    label: "可信区间显示方式",
    type: "select",
    options: [
      { value: "line", label: "区间线" },
      { value: "text", label: "区间文字" },
    ],
  },
  {
    key: "hpdFactor",
    label: "区间换算倍率（对齐原树单位）",
    type: "number",
    min: 0.000001,
    max: 1000000,
  },
  { key: "hpdTextColor", label: "区间文字颜色", type: "color" },
  {
    key: "hpdTextSize",
    label: "区间文字字号",
    type: "number",
    min: 6,
    max: 40,
  },
  { key: "hpdTextBold", label: "区间文字加粗", type: "boolean" },
  {
    key: "hpdTextX",
    label: "区间文字横向偏移",
    type: "number",
    min: -500,
    max: 500,
  },
  {
    key: "hpdTextY",
    label: "区间文字纵向偏移",
    type: "number",
    min: -500,
    max: 500,
  },
  {
    key: "ageFactor",
    label: "年代文字换算倍率",
    type: "number",
    min: 0.000001,
    max: 1000000,
  },
  {
    key: "ageDecimals",
    label: "年代文字小数位",
    type: "number",
    min: 0,
    max: 10,
  },
  { key: "ageBold", label: "年代文字加粗", type: "boolean" },
  {
    key: "ageAnchor",
    label: "年代文字对齐",
    type: "select",
    options: [
      { value: "start", label: "左对齐" },
      { value: "middle", label: "居中" },
      { value: "end", label: "右对齐" },
    ],
  },
  {
    key: "ageX",
    label: "年代文字横向偏移",
    type: "number",
    min: -500,
    max: 500,
  },
  {
    key: "ageY",
    label: "年代文字纵向偏移",
    type: "number",
    min: -500,
    max: 500,
  },

  {
    key: "timeLayout",
    label: "时间树布局依据",
    type: "select",
    options: [
      { value: "age", label: "已有节点年代" },
      { value: "branch", label: "原始枝长" },
    ],
  },
  {
    key: "nodeAgeSource",
    label: "年代来源",
    type: "select",
    options: [
      { value: "height", label: "原树 height / 时间枝长" },
      { value: "mean", label: "文件平均值（缺项沿用原树值）" },
      { value: "median", label: "文件中位值（缺项沿用原树值）" },
    ],
  },
  { key: "timeUnit", label: "原始时间单位", type: "text" },
  { key: "showHPD", label: "显示 95% 可信区间", type: "boolean" },
  { key: "hpdColor", label: "可信区间颜色", type: "color" },
  {
    key: "hpdWidth",
    label: "可信区间条带厚度",
    type: "number",
    min: 1,
    max: 24,
  },
  {
    key: "hpdOpacity",
    label: "可信区间不透明度",
    type: "number",
    min: 0,
    max: 1,
    step: 0.05,
  },
  { key: "hpdCaps", label: "可信区间端帽", type: "boolean" },
  { key: "showNodeAges", label: "显示节点年代", type: "boolean" },
  { key: "showLeafAges", label: "同时显示叶节点年代", type: "boolean" },
  { key: "showPosterior", label: "显示后验概率", type: "boolean" },
  {
    key: "ageFontSize",
    label: "年代与时间尺字号",
    type: "number",
    min: 6,
    max: 28,
  },
  { key: "ageColor", label: "年代与时间尺颜色", type: "color" },
  { key: "showTimeAxis", label: "显示年代尺", type: "boolean" },
];
for (const template of treeTemplates) {
  for (const control of timeControls)
    template.controls.push({
      ...control,
      section: "时间树",
      visible: (p) => {
        try {
          const root = stateFor(p).root,
            info = timeInfo(root, p.style),
            nodes = walk(root);
          if (!info.hasTime) return false;
          const k = control.key;
          if (k === "nodeAgeSource")
            return nodes.some(
              (n) => n.ageMean !== undefined || n.ageMedian !== undefined,
            );
          if (
            [
              "ageFactor",
              "ageDecimals",
              "ageBold",
              "ageAnchor",
              "ageX",
              "ageY",
              "showLeafAges",
            ].includes(k) &&
            !p.style.showNodeAges
          )
            return false;
          if (k === "showPosterior")
            return nodes.some((n) => n.posterior !== undefined);
          if (k.startsWith("hpdText") && p.style.hpdType !== "text")
            return false;
          if (
            ["hpdWidth", "hpdColor", "hpdCaps", "hpdOpacity"].includes(k) &&
            p.style.hpdType === "text"
          )
            return false;
          if (k === "showHPD" || k.startsWith("hpd"))
            return (
              info.active &&
              nodes.some((n) => n.hpd) &&
              (k === "showHPD" || p.style.showHPD !== false)
            );
          if (k === "showTimeAxis")
            return info.active && p.style.treeLayout !== "unrooted";
          return true;
        } catch {
          return false;
        }
      },
    });
  for (const control of template.controls)
    if (["useBranchLength", "showScale"].includes(control.key))
      control.visible = (p) => {
        try {
          return (
            !timeInfo(stateFor(p).root, p.style).active ||
            (control.key === "showScale" && p.style.treeLayout === "unrooted")
          );
        } catch {
          return true;
        }
      };
}

for (const t of treeTemplates)
  t.controls.push(
    {
      key: "treeDirection",
      label: "矩形树方向",
      type: "select",
      section: "树布局",
      options: [
        { value: "ltr", label: "从左向右" },
        { value: "rtl", label: "从右向左" },
      ],
      visible: (p) => p.style.treeLayout === "normal",
    },
    {
      key: "inwardTree",
      label: "环形向内生长",
      type: "boolean",
      section: "树布局",
      visible: (p) => p.style.treeLayout === "circle",
    },
    {
      key: "innerRadius",
      label: "向内布局叶端内半径",
      type: "number",
      min: 40,
      max: 1400,
      section: "树布局",
      visible: (p) =>
        p.style.treeLayout === "circle" && Boolean(p.style.inwardTree),
    },
  );

for (const t of treeTemplates) {
  t.defaultStyle = { ...branchStyleDefaults, ...t.defaultStyle };
  t.controls = t.controls.filter(
    (c) =>
      ![
        "showSupport",
        "supportSize",
        "supportColor",
        "showBranchLengths",
      ].includes(c.key),
  );
  t.controls.push(
    ...branchStyleControls,
    ...supportControls,
    ...treeLabelControls,
  );
}

for (const t of treeTemplates)
  t.controls.push({
    key: "showRoot",
    label: "显示重定根节点",
    type: "boolean",
    section: "树布局",
    visible: (p) => {
      try {
        return stateFor(p).root.id.startsWith("重定根_");
      } catch {
        return false;
      }
    },
  });

for (const t of treeTemplates) {
  for (const c of t.controls) {
    if (c.key.startsWith("branchLength") && !c.visible)
      c.visible = (p: import("../../core/types").Project) =>
        Boolean(p.style.showBranchLengths || p.style.showLabels);
    if (c.key === "branchLinkType")
      Object.assign(c, {
        optionsFor: (p: import("../../core/types").Project) =>
          c.options!.filter((o) =>
            p.style.treeLayout === "unrooted"
              ? ["linear", "bezierX", "bezierY"].includes(String(o.value))
              : p.style.treeLayout === "circle"
                ? o.value !== "rounded"
                : true,
          ),
      });
  }
}
