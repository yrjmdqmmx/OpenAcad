import React from "react";
import { format as d3format } from "d3";
import type {
  ChartStyle,
  Control,
  Dataset,
  Issue,
  RendererProps,
  Template,
} from "../../core/types";
import {
  barControls,
  boolControl,
  commonControls,
  defaults,
  errorControls,
  getTable,
  geometry,
  numericScale,
  symbolNames,
  lineControls,
  numberControl,
  optionalNumeric,
  records,
  selectControl,
  table,
  unique,
  validateColumns,
} from "./shared";
import {
  collectData,
  BarRenderer,
  DistributionRenderer,
  DumbbellRenderer,
  LineRenderer,
  PieRenderer,
  RadarRenderer,
  ScatterRenderer,
  UpSetRenderer,
} from "./renderers";
export {
  boxSummary,
  mean,
  sampleSd,
  quantile,
  gaussianKde,
  silvermanBandwidth,
  scottBandwidth,
  kdeBandwidth,
  kdeDomain,
  errorAmount,
  studentT975,
  studentTCdf,
} from "./math";
export { collectData } from "./renderers";
import {
  prepareBasicAnalysis,
  groupAnalysisMethods,
  regressionMethods,
} from "./analysis";
export { prepareBasicAnalysis } from "./analysis";
const names = ["对照", "处理甲", "处理乙", "处理丙"];
const values = [24, 39, 31, 48];
const basic = table(
  ["类别", "数值"],
  names.map((n, i) => [n, values[i]]),
);
const basicAlt = table(
  ["类别", "数值"],
  ["春季", "夏季", "秋季", "冬季"].map((n, i) => [n, [32, 18, 45, 28][i]]),
);
const categorized = table(
  ["类别", "数值", "分组"],
  ["指标甲", "指标乙", "指标丙", "指标丁", "指标戊", "指标己"].map((n, i) => [
    n,
    14 + i * 7,
    i < 3 ? "实验组" : "验证组",
  ]),
);
const grouped = (alternate = false) =>
  table(
    ["类别", "数值", "分组"],
    names.flatMap((n, i) =>
      ["实验一", "实验二"].map((g, j) => [
        n,
        (alternate ? 18 : 12) + i * 8 + j * 11 + (alternate ? i * j * 3 : 0),
        g,
      ]),
    ),
  );
const groupedStacked = (alternate = false) =>
  table(
    ["类别", "数值", "分组", "大组"],
    ["第一批", "第二批"].flatMap((batch, k) =>
      names
        .slice(0, 3)
        .flatMap((n, i) =>
          ["组分甲", "组分乙", "组分丙"].map((group, j) => [
            n,
            12 + i * 3 + j * 5 + k * 8 + (alternate ? j * k * 5 + 7 : 0),
            group,
            batch,
          ]),
        ),
    ),
  );
const repeated = (alternate = false, grouped = false) =>
  table(
    grouped ? ["类别", "数值", "分组", "样本"] : ["类别", "数值", "样本"],
    names.slice(0, 3).flatMap((n, i) =>
      (grouped ? ["实验一", "实验二"] : ["数据"]).flatMap((g, j) =>
        Array.from({ length: 12 }, (_, k) => {
          const v = +(
            15 +
            i * 8 +
            j * 5 +
            Math.sin(k * 1.7 + i) * (alternate ? 5 : 3) +
            (k % 3) * 1.1 +
            (alternate ? 5 - i * 2 : 0)
          ).toFixed(3);
          return grouped ? [n, v, g, `样本${k + 1}`] : [n, v, `样本${k + 1}`];
        }),
      ),
    ),
  );
const lines = (alternate = false, error = false) =>
  table(
    error ? ["类别", "数值", "分组", "样本"] : ["类别", "数值", "分组"],
    ["处理甲", "处理乙"].flatMap((g, j) =>
      Array.from({ length: 6 }, (_, i) =>
        error
          ? Array.from({ length: 5 }, (_, k) => [
              String(i * 2),
              +(
                10 +
                i * (j ? 2 : 4) +
                j * 5 +
                Math.sin(k * 2 + i) * 2 +
                (alternate ? Math.sin(i) * 5 + 3 : 0)
              ).toFixed(3),
              g,
              `样本${k + 1}`,
            ])
          : [
              [
                String(i * 2),
                10 +
                  i * (j ? 2 : 4) +
                  j * 5 +
                  (alternate ? Math.sin(i) * 5 + 3 : 0),
                g,
              ],
            ],
      ).flat(),
    ),
  );
const scatters = (alternate = false, grouped = false) =>
  table(
    grouped
      ? ["名称", "横坐标", "纵坐标", "分组", "大小"]
      : ["名称", "横坐标", "纵坐标", "大小"],
    Array.from({ length: 24 }, (_, i) => {
      const row = [
        `样本${i + 1}`,
        +(i / 2 + 1).toFixed(2),
        +(
          i * 0.8 +
          Math.sin(i * 1.8) * (alternate ? 5 : 3) +
          (alternate ? 9 : 4)
        ).toFixed(2),
      ];
      return grouped
        ? [...row, i % 2 ? "试验组" : "对照组", 1 + (i % 4)]
        : [...row, 1 + (i % 4)];
    }),
  );
function errorValidate(
  ds: Dataset,
  style?: ChartStyle,
  group = false,
): Issue[] {
  const summary = style?.errorInput === "summary";
  const req = [
    "类别",
    "数值",
    ...(group ? ["分组"] : []),
    ...(summary ? ["标准差", "样本量"] : []),
  ];
  const issues = validateColumns(
    ds,
    req,
    ["数值", ...(summary ? ["标准差", "样本量"] : [])],
    { nonnegative: summary ? ["标准差"] : [] },
  );
  if (issues.length) return issues;
  const t = getTable(ds)!;
  if (summary) {
    t.rows.forEach((r, i) => {
      const j = t.columns.indexOf("样本量"),
        n = Number(r[j]);
      if (!Number.isInteger(n) || n < 2)
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: j + 1,
          message: `第 ${i + 2} 行“样本量”必须是至少 2 的整数，用于计算标准误或 t 区间。`,
        });
    });
  } else {
    const counts = new Map<string, number>();
    records(ds).forEach((r) => {
      const k = String(r["类别"]) + (group ? " / " + r["分组"] : "");
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    counts.forEach((n, k) => {
      if (n < 2)
        issues.push({
          tableId: t.id,
          message: `“${k}”只有 ${n} 个观测；误差图至少需要 2 个重复观测。`,
        });
    });
  }
  return issues;
}
function distributionValidate(ds: Dataset, group = false) {
  const issue = validateColumns(
    ds,
    ["类别", "数值", ...(group ? ["分组"] : [])],
    ["数值"],
  );
  if (issue.length) return issue;
  const t = getTable(ds)!;
  const counts = new Map<string, number>();
  records(ds).forEach((r) => {
    const k = String(r["类别"]) + (group ? " / " + r["分组"] : "");
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  counts.forEach((n, k) => {
    if (n < 2)
      issue.push({
        tableId: t.id,
        message: `“${k}”只有 ${n} 个观测。分布图至少需要 2 个观测。`,
      });
  });
  return issue;
}
type Recipe = {
  id: string;
  name: string;
  familyId: string;
  category: string;
  path: string;
  description: string;
  columns: string[];
  numeric: string[];
  example: Dataset;
  alternate?: Dataset;
  controls?: Control[];
  style?: Partial<ChartStyle>;
  renderer: React.ComponentType<RendererProps>;
  validate?: Template["validate"];
  limitations?: string[];
  help?: string;
};
function recipe(r: Recipe): Template {
  return {
    id: r.id,
    familyId: r.familyId,
    variant: r.id,
    version: 1,
    name: r.name,
    category: r.category,
    description: r.description,
    tags: [r.category, r.name, "可编辑", "模拟数据"],
    sourceUrls: ["https://www.chiplot.online/" + r.path + ".html"],
    status: "available",
    defaultStyle: { ...defaults, title: r.name, ...r.style },
    controls: r.controls || [],
    example: r.example,
    alternate: r.alternate || basicAlt,
    inputHelp:
      r.help ||
      `必填列：${r.columns.join("、")}。${r.numeric.length ? "其中 " + r.numeric.join("、") + " 必须是有限数字。" : ""}使用 UTF-8 CSV、TSV 或 Excel 第一张工作表，也可直接编辑表格。所有示例均为自行生成的模拟数据。`,
    tutorial: [
      "先使用示例预览图形，或下载示例数据查看列格式。",
      "将自己的数据按列名填写；错误提示会定位到具体行和列。",
      "调整右侧样式，查看画布中的实时变化。",
      "保存项目保留数据和样式；图片下载用于论文排版，二者用途不同。",
    ],
    limitations: r.limitations || [],
    formats: ["csv", "tsv", "xls", "xlsx"],
    exampleSource: {
      kind: "simulated",
      label: "OpenAcad 自行生成的中文模拟科研数据",
      license: "CC0-1.0",
    },
    validate: r.validate || ((ds) => validateColumns(ds, r.columns, r.numeric)),
    Renderer: r.renderer,
  };
}
const bar =
  (kind: string): React.ComponentType<RendererProps> =>
  (props) =>
    React.createElement(BarRenderer, { ...props, kind });
const dist =
  (kind: string): React.ComponentType<RendererProps> =>
  (props) =>
    React.createElement(DistributionRenderer, { ...props, kind });
const baseBarControls = [...barControls, ...commonControls];
const shapeControl = selectControl("pointShape", "点形状", [
  ["circle", "圆形"],
  ["square", "正方形"],
  ["triangle", "三角形"],
]);
const distributionControls = [
  ...barControls.filter((c) => ["orientation", "barPadding"].includes(c.key)),
  boolControl("showPoints", "显示原始观测"),
  boolControl("showBox", "叠加箱线图"),
  numberControl("boxWidth", "箱体宽度", 4, 65),
  selectControl("distribution", "分布估计方法", [
    ["kde", "高斯核密度（默认 Scott）"],
    ["histogram", "等宽分箱频数"],
  ]),
  selectControl("kdeBandwidth", "核密度带宽规则", [
    ["scott", "Scott（SciPy 默认）"],
    ["silverman", "Silverman（SciPy 定义）"],
  ]),
  numberControl("kdePoints", "核密度网格点数", 32, 2048),
  numberControl("bandwidthMultiplier", "核密度带宽倍率", 0.1, 4, 0.1),
  numberControl("binCount", "分箱数量", 3, 80),
  boolControl("trim", "截断到观测范围"),
];
export const basicTemplates: Template[] = [
  recipe({
    id: "bar",
    name: "柱状图",
    familyId: "bar",
    category: "柱形与比较",
    path: "bar_plot",
    description: "用柱长比较不同类别的数值，支持正负值与横向排布。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: basic,
    alternate: basicAlt,
    controls: baseBarControls,
    renderer: bar("bar"),
  }),
  recipe({
    id: "bar-category",
    name: "分类柱状图",
    familyId: "bar",
    category: "柱形与比较",
    path: "bar_plot_width_category",
    description: "通过类别颜色区分条目所属分组，并按数值排序。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: categorized,
    alternate: grouped(true),
    controls: baseBarControls,
    style: { orientation: "horizontal" },
    renderer: bar("bar-category"),
  }),
  recipe({
    id: "bar-grouped",
    name: "分组柱状图",
    familyId: "bar",
    category: "柱形与比较",
    path: "group_bar_plot",
    description: "在每个类别中并列比较多个实验系列。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: grouped(),
    alternate: grouped(true),
    controls: baseBarControls,
    renderer: bar("bar-grouped"),
  }),
  recipe({
    id: "bar-error",
    name: "误差柱状图",
    familyId: "error",
    category: "重复实验与误差",
    path: "bar_plot_errorBar",
    description: "从真实重复观测计算均值与 SD、SE 或 95% t 区间。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: repeated(),
    alternate: repeated(true),
    controls: [...baseBarControls, ...errorControls],
    renderer: bar("bar-error"),
    validate: (ds, s) => errorValidate(ds, s),
    help: "原始模式：类别、数值，每一行是一个重复观测。汇总模式：类别、数值（均值）、标准差、样本量；标准差必须是样本 SD。至少 2 个重复或样本量≥2。95% 区间采用 Student t 分位数，SD、SE 与置信区间严格区分。",
  }),
  recipe({
    id: "bar-grouped-error",
    name: "分组误差柱状图",
    familyId: "error",
    category: "重复实验与误差",
    path: "group_error_bar_plot",
    description: "比较多个实验组的均值及不确定性，保留真实重复数据。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: repeated(false, true),
    alternate: repeated(true, true),
    controls: [...baseBarControls, ...errorControls],
    renderer: bar("bar-grouped-error"),
    validate: (ds, s) => errorValidate(ds, s, true),
    help: "原始模式必填“类别、数值、分组”，可另加样本 ID。每个类别×分组至少 2 个重复。汇总模式另需“标准差、样本量”，数值列解释为均值。",
  }),
  recipe({
    id: "scatter-error",
    name: "散点误差图",
    familyId: "error",
    category: "重复实验与误差",
    path: "scatter_plot_errorBar",
    description: "用均值点和误差线展示各类重复实验，避免柱形的面积干扰。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: repeated(),
    alternate: repeated(true),
    controls: [
      ...baseBarControls.filter(
        (c) => !["cornerRadius", "strokeWidth", "strokeColor"].includes(c.key),
      ),
      ...errorControls,
    ],
    renderer: bar("scatter-error"),
    validate: (ds, s) => errorValidate(ds, s),
  }),
  recipe({
    id: "bar-stacked",
    name: "堆叠柱状图",
    familyId: "stack",
    category: "组成与比例",
    path: "stackedbar_plot",
    description: "比较总量及组成部分，支持实际数值和 100% 组成。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: grouped(),
    alternate: grouped(true),
    controls: [
      ...baseBarControls,
      boolControl("normalize", "转换为 100% 堆叠"),
    ],
    renderer: bar("bar-stacked"),
    validate: (ds, s) =>
      validateColumns(ds, ["类别", "数值", "分组"], ["数值"], {
        nonnegative: s?.normalize ? ["数值"] : [],
      }),
  }),
  recipe({
    id: "bar-grouped-stacked",
    name: "分组堆叠柱状图",
    familyId: "stack",
    category: "组成与比例",
    path: "group_stackedbar_plot",
    description: "在多个大组内比较类别组成，每个柱由多个组分堆叠。",
    columns: ["类别", "数值", "分组", "大组"],
    numeric: ["数值"],
    example: groupedStacked(),
    alternate: groupedStacked(true),
    controls: [
      ...baseBarControls,
      boolControl("normalize", "转换为 100% 堆叠"),
    ],
    renderer: bar("bar-grouped-stacked"),
    validate: (ds, s) =>
      validateColumns(ds, ["类别", "数值", "分组", "大组"], ["数值"], {
        nonnegative: s?.normalize ? ["数值"] : [],
      }),
    help: "必填：大组、类别、分组、数值。大组表示批次或队列，类别表示柱，分组表示柱内的组成部分。每个大组×类别分别堆叠；100% 模式各柱总和归一为 100。",
  }),
  recipe({
    id: "bar-line",
    name: "柱状图与折线组合",
    familyId: "bar-line",
    category: "柱形与比较",
    path: "bar_with_line_plot",
    description: "使用左轴柱值和右轴折线值比较两种不同量纲的指标。",
    columns: ["类别", "数值", "折线数值"],
    numeric: ["数值", "折线数值"],
    example: table(
      ["类别", "数值", "折线数值"],
      names.map((n, i) => [n, values[i], [0.21, 0.37, 0.28, 0.54][i]]),
    ),
    alternate: table(
      ["类别", "数值", "折线数值"],
      names.map((n, i) => [
        n,
        [50, 35, 23, 42][i],
        [0.11, 0.22, 0.49, 0.35][i],
      ]),
    ),
    controls: [
      ...baseBarControls.filter((c) => c.key !== "orientation"),
      ...lineControls,
      {
        key: "rightYTitle",
        label: "右轴标题",
        type: "text",
        section: "坐标与文字",
      },
    ],
    style: { marginRight: 100 },
    renderer: bar("bar-line"),
    limitations: [
      "ChiPlot 原入口当前为 404；本模板为 OpenAcad 自行设计的真实双轴实现，不声称已核实原站全部控制。",
    ],
  }),
  recipe({
    id: "lollipop",
    name: "棒棒糖图",
    familyId: "lollipop",
    category: "柱形与比较",
    path: "lollipop_plot",
    description: "以细线和端点表示数值大小，适合紧凑的排名比较。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: basic,
    alternate: basicAlt,
    controls: [
      ...baseBarControls.filter(
        (c) => !["cornerRadius", "strokeWidth", "strokeColor"].includes(c.key),
      ),
      boolControl("sizeByValue", "端点大小映射数值"),
      boolControl("dashed", "连接杆使用虚线"),
    ],
    renderer: bar("lollipop"),
  }),
  recipe({
    id: "lollipop-category",
    name: "分类棒棒糖图",
    familyId: "lollipop",
    category: "柱形与比较",
    path: "lollipop_plot_with_category",
    description: "为排名条目添加类别配色，突出各类贡献。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: categorized,
    alternate: grouped(true),
    controls: [
      ...baseBarControls.filter(
        (c) => !["cornerRadius", "strokeWidth", "strokeColor"].includes(c.key),
      ),
      boolControl("sizeByValue", "端点大小映射数值"),
      boolControl("dashed", "连接杆使用虚线"),
    ],
    style: { orientation: "horizontal" },
    renderer: bar("lollipop-category"),
  }),
  recipe({
    id: "line",
    name: "折线图与分组折线图",
    familyId: "line",
    category: "趋势与变化",
    path: "group_line_plot",
    description: "展示一个或多个系列随时间、剂量或类别的变化。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: lines(),
    alternate: lines(true),
    controls: [
      ...lineControls,
      selectControl("xScaleType", "横轴类型", [
        ["category", "等距类别"],
        ["linear", "连续数值"],
      ]),
    ],
    style: { xTitle: "时间", showPoints: true },
    renderer: (props) => React.createElement(LineRenderer, props),
    validate: (ds, s) =>
      validateColumns(
        ds,
        ["类别", "数值", "分组"],
        s?.xScaleType === "linear" ? ["类别", "数值"] : ["数值"],
      ),
  }),
  recipe({
    id: "line-error",
    name: "分组误差折线图",
    familyId: "line-error",
    category: "重复实验与误差",
    path: "group_error_line_plot",
    description: "连接每个时间点的观测均值，并显示实际计算的误差范围。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: lines(false, true),
    alternate: lines(true, true),
    controls: [
      ...lineControls,
      ...errorControls.filter((c) => c.key !== "showPoints"),
      selectControl("xScaleType", "横轴类型", [
        ["category", "等距类别"],
        ["linear", "连续数值"],
      ]),
    ],
    renderer: (props) =>
      React.createElement(LineRenderer, { ...props, error: true }),
    validate: (ds, s) => errorValidate(ds, s, true),
  }),
  recipe({
    id: "box",
    name: "箱线图",
    familyId: "distribution",
    category: "分布与差异",
    path: "box_plot",
    description: "使用 R-7 四分位数、1.5 IQR 观测须端与离群点描述分布。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: repeated(),
    alternate: repeated(true),
    controls: [
      ...barControls.filter((c) =>
        ["orientation", "barPadding"].includes(c.key),
      ),
      boolControl("showPoints", "显示所有原始观测"),
      numberControl("boxWidth", "箱体宽度", 4, 65),
    ],
    renderer: dist("box"),
    validate: (ds) => distributionValidate(ds),
    style: { pointSize: 3 },
  }),
  recipe({
    id: "box-grouped",
    name: "分组箱线图",
    familyId: "distribution",
    category: "分布与差异",
    path: "group_box_plot",
    description: "在各类别内并列比较多个实验组的观测分布。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: repeated(false, true),
    alternate: repeated(true, true),
    controls: [
      ...barControls.filter((c) =>
        ["orientation", "barPadding"].includes(c.key),
      ),
      boolControl("showPoints", "显示所有原始观测"),
      numberControl("boxWidth", "箱体宽度", 4, 65),
    ],
    renderer: dist("box-grouped"),
    validate: (ds) => distributionValidate(ds, true),
    style: { pointSize: 3 },
  }),
  recipe({
    id: "violin",
    name: "小提琴图",
    familyId: "distribution",
    category: "分布与差异",
    path: "violin_plot",
    description: "显示真实观测的高斯核密度或分箱曲线，可叠加箱图与散点。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: repeated(),
    alternate: repeated(true),
    controls: distributionControls,
    renderer: dist("violin"),
    validate: (ds) => distributionValidate(ds),
    style: { pointSize: 2, opacity: 0.55 },
    help: "每行一个观测，必填“类别、数值”，分组可选。默认采用与 SciPy Gaussian KDE 等价的即时预览，Scott 带宽、512 个网格点；也可选择精确等宽分箱频数。核密度与频数是不同估计，方法和带宽参数保存在项目中。",
  }),
  recipe({
    id: "raincloud",
    name: "云雨图",
    familyId: "distribution",
    category: "分布与差异",
    path: "raincloud_plot",
    description: "在同一横轴上组合半密度、原始观测和箱图。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: repeated(),
    alternate: repeated(true),
    controls: distributionControls.filter((c) => c.key !== "orientation"),
    renderer: dist("raincloud"),
    validate: (ds) => distributionValidate(ds),
    style: {
      pointSize: 2,
      opacity: 0.55,
      orientation: "horizontal",
      yTitle: "",
      xTitle: "数值",
    },
  }),
  recipe({
    id: "ridgeline",
    name: "峰峦图",
    familyId: "distribution",
    category: "分布与差异",
    path: "ridgelinePlot",
    description: "将多个类别的真实观测分布叠放成峰峦，比较分布位置和形状。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: repeated(),
    alternate: repeated(true),
    controls: distributionControls.filter((c) => c.key !== "orientation"),
    renderer: dist("ridgeline"),
    validate: (ds) => distributionValidate(ds),
    style: {
      pointSize: 2,
      opacity: 0.65,
      orientation: "horizontal",
      showBox: false,
      showPoints: false,
      yTitle: "",
      xTitle: "数值",
    },
  }),
  recipe({
    id: "upset",
    name: "UpSet 集合交集图",
    familyId: "set",
    category: "集合与关系",
    path: "upset_plot",
    description: "对集合成员去重后计算独有交集，并用矩阵和柱图显示数量。",
    columns: ["集合", "成员"],
    numeric: [],
    example: table(
      ["集合", "成员"],
      [
        ["实验甲", "基因一"],
        ["实验甲", "基因二"],
        ["实验甲", "基因三"],
        ["实验乙", "基因二"],
        ["实验乙", "基因三"],
        ["实验乙", "基因四"],
        ["实验丙", "基因三"],
        ["实验丙", "基因五"],
      ],
    ),
    alternate: table(
      ["集合", "成员"],
      [
        ["实验甲", "基因一"],
        ["实验甲", "基因二"],
        ["实验乙", "基因二"],
        ["实验丙", "基因二"],
        ["实验丙", "基因三"],
        ["实验丙", "基因四"],
      ],
    ),
    controls: [
      selectControl("sort", "交集数量排序", [
        ["ascending", "升序"],
        ["descending", "降序"],
      ]),
    ],
    renderer: UpSetRenderer,
    style: { showLabels: true, pointSize: 5, yTitle: "" },
    validate: (ds) => {
      const a = validateColumns(ds, ["集合", "成员"], []);
      if (unique(records(ds).map((r) => String(r["集合"]))).length > 12)
        a.push({
          message: "首版最多显示 12 个集合，请减少集合数量以保持矩阵可读。",
        });
      return a;
    },
    limitations: ["首版最多 12 个集合；只绘制实际非空的独有交集。"],
  }),
  recipe({
    id: "rose",
    name: "玫瑰图",
    familyId: "polar",
    category: "组成与比例",
    path: "rosePlot",
    description: "以相等角度和不同半径表示各类别数值。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: basic,
    alternate: basicAlt,
    controls: [
      selectControl("roseShape", "扇区形状", [
        ["arc", "玫瑰扇形"],
        ["diamond", "菱形"],
        ["flower", "花瓣"],
      ]),
      numberControl("innerRadius", "内半径比例", 0, 0.8, 0.05),
      numberControl("slicePadding", "扇区间隔（弧度）", 0, 0.2, 0.01),
      numberControl("startAngle", "起始角度", -180, 180, 5),
    ],
    renderer: (props) =>
      React.createElement(PieRenderer, { ...props, rose: true }),
    validate: (ds) =>
      validateColumns(ds, ["类别", "数值"], ["数值"], {
        nonnegative: ["数值"],
      }),
    style: { innerRadius: 0.1, yTitle: "" },
  }),
  recipe({
    id: "pie",
    name: "饼图与环图",
    familyId: "pie",
    category: "组成与比例",
    path: "piePlot",
    description: "展示非负数值的组成比例，支持实心饼图与空心环图。",
    columns: ["类别", "数值"],
    numeric: ["数值"],
    example: basic,
    alternate: basicAlt,
    controls: [
      numberControl("innerRadius", "内半径比例（0 为饼图）", 0, 0.85, 0.05),
      numberControl("slicePadding", "扇区间隔（弧度）", 0, 0.2, 0.01),
      numberControl("startAngle", "起始角度", -180, 180, 5),
      boolControl("percentLabels", "显示百分比标签"),
      ...commonControls.filter((c) => c.key === "sort"),
    ],
    renderer: PieRenderer,
    validate: (ds) => {
      const a = validateColumns(ds, ["类别", "数值"], ["数值"], {
        nonnegative: ["数值"],
      });
      if (
        !a.length &&
        records(ds).reduce((x, r) => x + Number(r["数值"]), 0) <= 0
      )
        a.push({ message: "饼图总和必须大于 0，不能全部为 0。" });
      return a;
    },
    style: { innerRadius: 0.5, yTitle: "" },
  }),
  recipe({
    id: "radar",
    name: "雷达图",
    familyId: "polar",
    category: "多维比较",
    path: "radarPlot",
    description: "在共同尺度下比较多个对象的多维指标。",
    columns: ["类别", "数值", "分组"],
    numeric: ["数值"],
    example: grouped(),
    alternate: grouped(true),
    controls: [numberControl("areaOpacity", "雷达面积透明度", 0, 1, 0.05)],
    renderer: RadarRenderer,
    validate: (ds) => {
      const issues = validateColumns(ds, ["类别", "数值", "分组"], ["数值"], {
        nonnegative: ["数值"],
      });
      const a = records(ds),
        cats = unique(a.map((r) => String(r["类别"]))),
        groups = unique(a.map((r) => String(r["分组"])));
      if (cats.length < 3)
        issues.push({ message: "雷达图至少需要 3 个不同类别。" });
      for (const g of groups)
        for (const c of cats) {
          const n = a.filter((r) => r["类别"] === c && r["分组"] === g).length;
          if (n !== 1)
            issues.push({
              message: `分组“${g}”的类别“${c}”需要且只能有一行，目前为 ${n} 行。`,
            });
        }
      return issues;
    },
    style: { yTitle: "" },
  }),
  recipe({
    id: "dumbbell",
    name: "哑铃图",
    familyId: "dumbbell",
    category: "柱形与比较",
    path: "dumbbell_plot",
    description: "连接同一条目的两个数值，突出前后差异及变化方向。",
    columns: ["类别", "起点", "终点"],
    numeric: ["起点", "终点"],
    example: table(
      ["类别", "起点", "终点"],
      names.map((n, i) => [n, values[i], [31, 28, 45, 55][i]]),
    ),
    alternate: table(
      ["类别", "起点", "终点"],
      names.map((n, i) => [n, [22, 43, 17, 34][i], [41, 29, 36, 28][i]]),
    ),
    controls: [
      { key: "startLabel", label: "起点图例名称", type: "text" },
      { key: "endLabel", label: "终点图例名称", type: "text" },
      { key: "connectorColor", label: "连接线颜色", type: "color" },
    ],
    renderer: DumbbellRenderer,
    style: { yTitle: "", xTitle: "数值" },
  }),
  recipe({
    id: "scatter",
    name: "散点图",
    familyId: "scatter",
    category: "关联与散点",
    path: "scatter_plot",
    description: "展示两个连续变量之间的关系，支持标注和大小映射。",
    columns: ["横坐标", "纵坐标"],
    numeric: ["横坐标", "纵坐标"],
    example: scatters(),
    alternate: scatters(true),
    controls: [
      shapeControl,
      boolControl("sizeByValue", "使用“大小”列映射点大小"),
      boolControl("showConfidence", "显示回归置信带"),
    ],
    renderer: ScatterRenderer,
    validate: (ds) => [
      ...validateColumns(ds, ["横坐标", "纵坐标"], ["横坐标", "纵坐标"]),
      ...optionalNumeric(getTable(ds), ["大小"]),
    ],
    style: { xTitle: "解释变量", yTitle: "响应变量" },
  }),
  recipe({
    id: "scatter-grouped",
    name: "分组散点图",
    familyId: "scatter",
    category: "关联与散点",
    path: "group_scatter_plot",
    description: "在二维散点中用颜色区分不同实验组。",
    columns: ["横坐标", "纵坐标", "分组"],
    numeric: ["横坐标", "纵坐标"],
    example: scatters(false, true),
    alternate: scatters(true, true),
    controls: [
      shapeControl,
      boolControl("sizeByValue", "使用“大小”列映射点大小"),
      boolControl("showConfidence", "显示回归置信带"),
    ],
    renderer: ScatterRenderer,
    validate: (ds) => [
      ...validateColumns(
        ds,
        ["横坐标", "纵坐标", "分组"],
        ["横坐标", "纵坐标"],
      ),
      ...optionalNumeric(getTable(ds), ["大小"]),
    ],
    style: { xTitle: "解释变量", yTitle: "响应变量" },
  }),
];
for (const template of basicTemplates) {
  if (
    [
      "bar-error",
      "bar-grouped-error",
      "scatter-error",
      "line-error",
      "box",
      "box-grouped",
      "violin",
      "raincloud",
      "ridgeline",
    ].includes(template.id)
  ) {
    template.analysisMethods = groupAnalysisMethods;
    template.prepareAnalysis = prepareBasicAnalysis;
  }
  if (template.id === "scatter" || template.id === "scatter-grouped") {
    template.analysisMethods = regressionMethods;
    template.prepareAnalysis = prepareBasicAnalysis;
  }
}
const fontControl: Control = {
  key: "fontFamily",
  label: "字体",
  type: "select",
  section: "标题与文字",
  options: [
    { value: "Noto Sans SC", label: "思源黑体" },
    { value: "Noto Serif CJK SC", label: "思源宋体" },
  ],
};
const axisControls: Control[] = [
  {
    key: "xTitle",
    label: "横轴标题（支持 <sup> 上标与 <sub> 下标）",
    type: "text",
    section: "坐标与文字",
  },
  { key: "yTitle", label: "纵轴标题", type: "text", section: "坐标与文字" },
  {
    key: "showGrid",
    label: "显示数值轴网格",
    type: "boolean",
    section: "坐标与文字",
  },
  ...["x", "y"].flatMap((axis) => [
    {
      key: axis + "Min",
      label: (axis === "x" ? "横" : "纵") + "轴最小值（仅数值轴）",
      type: "number" as const,
      section: "坐标范围",
      help: "留空则根据数据自动计算；类别轴不使用数值范围。",
    },
    {
      key: axis + "Max",
      label: (axis === "x" ? "横" : "纵") + "轴最大值（仅数值轴）",
      type: "number" as const,
      section: "坐标范围",
    },
    {
      key: axis + "Ticks",
      label: (axis === "x" ? "横" : "纵") + "轴自定义刻度",
      type: "text" as const,
      section: "刻度与网格",
      help: "英文逗号分隔；数值轴填写数字，类别轴填写现有类别。",
    },
    {
      key: axis + "TickFormat",
      label: (axis === "x" ? "横" : "纵") + "轴数值格式",
      type: "text" as const,
      section: "刻度与网格",
      help: "例如 .2f（两位小数）、.2e（科学计数）、.0%（百分比）；留空自动。",
    },
    {
      ...numberControl(
        axis + "TickFontSize",
        (axis === "x" ? "横" : "纵") + "轴刻度字号",
        6,
        50,
      ),
      section: "刻度与网格",
    },
    {
      key: axis + "TickColor",
      label: (axis === "x" ? "横" : "纵") + "轴刻度颜色",
      type: "color" as const,
      section: "刻度与网格",
    },
    {
      ...boolControl(
        axis + "TickBold",
        (axis === "x" ? "横" : "纵") + "轴刻度粗体",
      ),
      section: "刻度与网格",
    },
    {
      ...boolControl(
        axis + "TickItalic",
        (axis === "x" ? "横" : "纵") + "轴刻度斜体",
      ),
      section: "刻度与网格",
    },
  ]),
  {
    ...selectControl("xAxisPosition", "横轴位置", [
      ["bottom", "底部"],
      ["top", "顶部"],
    ]),
    section: "坐标与文字",
  },
  {
    ...selectControl("yAxisPosition", "纵轴位置", [
      ["left", "左侧"],
      ["right", "右侧"],
    ]),
    section: "坐标与文字",
  },
  {
    ...numberControl("axisRotation", "横轴刻度旋转", -90, 90, 5),
    section: "刻度与网格",
  },
  {
    ...numberControl("yAxisRotation", "纵轴刻度旋转", -90, 90, 5),
    section: "刻度与网格",
  },
  {
    ...numberControl("tickCount", "自动数值刻度数量", 2, 15),
    section: "刻度与网格",
  },
  {
    ...numberControl("tickLength", "刻度线长度", 0, 20),
    section: "刻度与网格",
  },
  {
    ...numberControl("gridOpacity", "网格透明度", 0, 1, 0.05),
    section: "刻度与网格",
  },
  { key: "gridColor", label: "网格颜色", type: "color", section: "刻度与网格" },
  {
    ...numberControl("axisLineWidth", "坐标线宽", 0.5, 8, 0.5),
    section: "坐标与文字",
  },
  {
    key: "axisColor",
    label: "坐标线颜色",
    type: "color",
    section: "坐标与文字",
  },
  { ...boolControl("showXAxis", "显示横轴"), section: "坐标与文字" },
  { ...boolControl("showYAxis", "显示纵轴"), section: "坐标与文字" },
  {
    ...numberControl("xAxisOffset", "横轴整体偏移", -100, 100),
    section: "坐标与文字",
  },
  {
    ...numberControl("yAxisOffset", "纵轴整体偏移", -100, 100),
    section: "坐标与文字",
  },
  {
    ...numberControl("xLabelOffset", "横轴标题距离", 20, 150),
    section: "坐标与文字",
  },
  {
    ...numberControl("yLabelOffset", "纵轴标题距离", 20, 150),
    section: "坐标与文字",
  },
  {
    ...numberControl("axisTitleSize", "坐标标题字号", 6, 50),
    section: "坐标与文字",
  },
  { ...boolControl("axisTitleBold", "坐标标题粗体"), section: "坐标与文字" },
  { ...boolControl("axisTitleItalic", "坐标标题斜体"), section: "坐标与文字" },
];
for (const t of basicTemplates) {
  t.controls.push(
    fontControl,
    {
      key: "titleBackground",
      label: "标题底色",
      type: "color",
      section: "标题与文字",
    },
    {
      key: "titleColor",
      label: "标题颜色",
      type: "color",
      section: "标题与文字",
    },
    { ...boolControl("titleBold", "标题粗体"), section: "标题与文字" },
    { ...boolControl("titleItalic", "标题斜体"), section: "标题与文字" },
  );
  if (!["pie", "rose", "radar", "upset"].includes(t.id))
    t.controls.push(
      ...axisControls,
      {
        ...boolControl("showRightTitle", "显示右侧标题条"),
        section: "侧边标题",
      },
      {
        key: "rightTitleText",
        label: "右侧标题文字",
        type: "text",
        section: "侧边标题",
      },
      {
        ...numberControl("rightTitleWidth", "右侧标题条宽度", 20, 80),
        section: "侧边标题",
      },
      {
        ...numberControl("rightTitleSize", "右侧标题字号", 8, 40),
        section: "侧边标题",
      },
      {
        key: "rightTitleBackground",
        label: "右侧标题背景",
        type: "color",
        section: "侧边标题",
      },
    );
  if (
    [
      "line",
      "line-error",
      "scatter",
      "scatter-grouped",
      "lollipop",
      "lollipop-category",
      "dumbbell",
      "box",
      "box-grouped",
      "violin",
      "raincloud",
      "ridgeline",
      "radar",
      "upset",
      "scatter-error",
    ].includes(t.id)
  )
    t.controls.push(numberControl("pointSize", "点的半径", 1, 20));
  if (
    ![
      "pie",
      "rose",
      "bar",
      "bar-grouped",
      "bar-category",
      "bar-stacked",
      "bar-grouped-stacked",
    ].includes(t.id)
  )
    t.controls.push(numberControl("lineWidth", "线条宽度", 0.5, 10, 0.5));
  if (t.id === "radar")
    t.controls.push(
      { ...numberControl("yMax", "指标最大值", 1, 1e8), section: "坐标范围" },
      boolControl("showGrid", "显示雷达网格"),
    );
  const oldValidate = t.validate;
  t.validate = (dataset, style) => {
    const issues = oldValidate(dataset, style);
    if (
      ["violin", "raincloud", "ridgeline"].includes(t.id) &&
      style?.distribution !== "histogram" &&
      !issues.length
    ) {
      const grouped = new Map<string, number[]>();
      for (const r of records(dataset)) {
        const key = String(r["类别"]) + " / " + String(r["分组"] || "数据");
        grouped.set(key, [...(grouped.get(key) || []), Number(r["数值"])]);
      }
      for (const [key, values] of grouped)
        if (Math.max(...values) === Math.min(...values))
          issues.push({
            message: `“${key}”的观测全部相同，无法估计核密度带宽。请切换分箱方法或使用箱线图。`,
          });
    }
    if (style) {
      for (const axis of ["x", "y"]) {
        const a = style[axis + "Min"],
          b = style[axis + "Max"];
        if (typeof a === "number" && typeof b === "number" && a >= b)
          issues.push({
            message: `${axis === "x" ? "横" : "纵"}轴最小值必须小于最大值。`,
          });
        const fmt = String(style[axis + "TickFormat"] || "");
        if (fmt) {
          try {
            d3format(fmt);
          } catch {
            issues.push({
              message: `${axis === "x" ? "横" : "纵"}轴数值格式无效，请使用 .2f、.2e 等 D3 数值格式。`,
            });
          }
        }
        const ticks = String(style[axis + "Ticks"] || "");
        if (ticks.includes("，"))
          issues.push({
            message: "自定义刻度请使用英文逗号分隔，例如 0,10,20。",
          });
      }
    }
    return issues;
  };
  t.controls = Array.from(new Map(t.controls.map((c) => [c.key, c])).values());
  t.defaultStyle = {
    ...t.defaultStyle,
    titleBold: true,
    showXAxis: true,
    showYAxis: true,
    xTickFontSize: 14,
    yTickFontSize: 14,
    tickCount: 6,
    tickLength: 5,
    gridOpacity: 0.1,
    axisLineWidth: 1,
    axisTitleSize: 14,
  };
}

export function isNumericAxis(
  project: import("../../core/types").Project,
  axis: "x" | "y",
) {
  const id = project.templateId;
  if (["scatter", "scatter-grouped"].includes(id)) return true;
  if (id === "dumbbell") return axis === "x";
  if (["line", "line-error"].includes(id))
    return axis === "y" || project.style.xScaleType === "linear";
  if (["pie", "rose", "radar", "upset"].includes(id)) return false;
  const horizontal =
    ["raincloud", "ridgeline"].includes(id) ||
    project.style.orientation === "horizontal";
  return axis === (horizontal ? "x" : "y");
}
for (const t of basicTemplates) {
  if (!["pie", "rose", "radar", "upset"].includes(t.id))
    for (const axis of ["x", "y"] as const)
      t.controls.push(
        {
          key: axis + "Scale",
          label: (axis === "x" ? "横" : "纵") + "轴尺度",
          type: "select",
          section: "坐标范围",
          options: [
            { value: "linear", label: "线性" },
            { value: "log2", label: "log2 对数" },
            { value: "log10", label: "log10 对数" },
          ],
          visible: (p) => isNumericAxis(p, axis),
        },
        {
          ...boolControl(
            axis + "Break",
            (axis === "x" ? "横" : "纵") + "轴省略区间",
          ),
          section: "坐标断轴",
          visible: (p) => isNumericAxis(p, axis),
        },
        ...[
          ["BreakStart", "省略起点"],
          ["BreakEnd", "省略终点"],
          ["BreakGap", "断轴间隔像素"],
        ].map(([key, label]) => ({
          ...numberControl(
            axis + key,
            (axis === "x" ? "横" : "纵") + "轴" + label,
            0,
            1e12,
          ),
          section: "坐标断轴",
          visible: (p: import("../../core/types").Project) =>
            isNumericAxis(p, axis) && Boolean(p.style[axis + "Break"]),
        })),
      );
  if (
    [
      "bar",
      "bar-category",
      "bar-grouped",
      "bar-error",
      "bar-grouped-error",
      "bar-stacked",
      "bar-grouped-stacked",
      "bar-line",
      "pie",
      "rose",
      "line",
      "line-error",
    ].includes(t.id)
  )
    t.controls.push(
      {
        ...selectControl("pattern", "填充纹理", [
          ["none", "纯色"],
          ["diagonal", "斜线"],
          ["horizontal", "横线"],
          ["dots", "圆点"],
          ["grid", "网格"],
        ]),
        section: "配色与图形",
      },
      {
        ...numberControl("patternSpacing", "纹理间距", 3, 30),
        section: "配色与图形",
        visible: (p) => Boolean(p.style.pattern && p.style.pattern !== "none"),
      },
      {
        ...numberControl("patternWidth", "纹理线宽/点半径", 0.5, 5, 0.5),
        section: "配色与图形",
        visible: (p) => Boolean(p.style.pattern && p.style.pattern !== "none"),
      },
    );
  if (["line", "line-error", "bar-line"].includes(t.id)) {
    const control = t.controls.find((c) => c.key === "curve");
    if (control)
      control.options = [
        ["linear", "直线"],
        ["smooth", "单调平滑"],
        ["step", "后阶梯"],
        ["stepBefore", "前阶梯"],
        ["stepCenter", "中阶梯"],
        ["basis", "B 样条"],
        ["cardinal", "Cardinal 样条"],
        ["catmull", "Catmull–Rom"],
        ["natural", "自然样条"],
      ].map(([value, label]) => ({ value, label }));
    if (t.id !== "bar-line")
      t.controls.push(boolControl("fillArea", "填充折线下方区域"), {
        ...numberControl("areaOpacity", "面积透明度", 0, 1, 0.05),
        visible: (p) => Boolean(p.style.fillArea),
      });
  }
  if (
    [
      "line",
      "line-error",
      "scatter",
      "scatter-grouped",
      "scatter-error",
      "lollipop",
      "lollipop-category",
    ].includes(t.id)
  ) {
    const shapes: [string, string][] = [
      ["circle", "圆形"],
      ["square", "方形"],
      ["triangle", "三角形"],
      ["diamond", "菱形"],
      ["cross", "十字"],
      ["star", "星形"],
      ["wye", "Y 形"],
    ];
    const c = t.controls.find((c) => c.key === "pointShape");
    if (c) c.options = shapes.map(([value, label]) => ({ value, label }));
    else t.controls.push(selectControl("pointShape", "点的形状", shapes));
  }
  for (const c of t.controls) {
    const axis = c.key[0] as "x" | "y";
    if (/^[xy](Min|Max|TickFormat)$/.test(c.key))
      c.visible = (p) => isNumericAxis(p, axis);
    if (c.key === "xLabelOffset") c.visible = (p) => Boolean(p.style.xTitle);
    if (c.key === "yLabelOffset") c.visible = (p) => Boolean(p.style.yTitle);
    if (c.key.startsWith("rightTitle") && c.key !== "showRightTitle")
      c.visible = (p) => Boolean(p.style.showRightTitle);
    if (
      c.key === "showConfidence" ||
      (c.key === "lineWidth" && t.familyId === "scatter")
    )
      c.visible = (p) => Boolean(p.analysis?.result);
    if (c.key === "percentLabels") c.visible = (p) => p.style.showLabels;
    if (c.key === "binCount")
      c.visible = (p) => p.style.distribution === "histogram";
    if (c.key === "bandwidthMultiplier")
      c.visible = (p) => p.style.distribution !== "histogram";
    if (c.key === "boxWidth")
      c.visible = (p) =>
        p.templateId.startsWith("box") || Boolean(p.style.showBox);
    if (
      c.key === "pointSize" &&
      ["box", "box-grouped", "violin", "raincloud", "ridgeline"].includes(t.id)
    )
      c.visible = (p) =>
        Boolean(p.style.showPoints) || p.templateId.startsWith("box");
  }
  t.defaultStyle = {
    ...t.defaultStyle,
    xScale: "linear",
    yScale: "linear",
    xBreak: false,
    yBreak: false,
    xBreakStart: 10,
    xBreakEnd: 20,
    yBreakStart: 10,
    yBreakEnd: 20,
    pattern: "none",
    patternSpacing: 8,
    patternWidth: 1.5,
    pointShape: "circle",
    fillArea: false,
  };
  const previous = t.validate;
  t.validate = (dataset, style) => {
    const issues = previous(dataset, style);
    if (!style) return issues;
    const p = { templateId: t.id, style } as import("../../core/types").Project;
    for (const axis of ["x", "y"] as const) {
      if (!isNumericAxis(p, axis)) continue;
      if (style[axis + "Scale"] && style[axis + "Scale"] !== "linear") {
        const column =
          t.familyId === "scatter"
            ? axis === "x"
              ? "横坐标"
              : "纵坐标"
            : axis === "x" && t.familyId === "line"
              ? "类别"
              : "数值";
        const vals =
          t.id === "dumbbell"
            ? records(dataset).flatMap((r) => [
                Number(r["起点"]),
                Number(r["终点"]),
              ])
            : records(dataset).map((r) => Number(r[column]));
        if (vals.some((v) => v <= 0))
          issues.push({
            message: `${axis === "x" ? "横" : "纵"}轴对数尺度要求所有值大于 0。`,
          });
        if (
          typeof style[axis + "Min"] === "number" &&
          Number(style[axis + "Min"]) <= 0
        )
          issues.push({ message: "对数轴最小值必须大于 0。" });
      }
      if (
        style[axis + "Break"] &&
        Number(style[axis + "BreakStart"]) >= Number(style[axis + "BreakEnd"])
      )
        issues.push({ message: "断轴省略起点必须小于终点。" });
    }
    return issues;
  };
}
export { BasicStylePanel } from "./BasicStylePanel";

const upset = basicTemplates.find((t) => t.id === "upset")!;
upset.controls = upset.controls.filter((c) => c.key !== "sort");
upset.controls.push(
  selectControl("sort", "交集排序", [
    ["descending", "数量降序"],
    ["ascending", "数量升序"],
    ["degreeAscending", "集合数升序"],
    ["degreeDescending", "集合数降序"],
    ["input", "首次出现顺序"],
  ]),
  selectControl("setSort", "集合排序", [
    ["input", "数据顺序"],
    ["descending", "集合大小降序"],
    ["ascending", "集合大小升序"],
  ]),
  boolControl("showSetSizes", "显示集合大小子图"),
  boolControl("showEmpty", "显示空交集"),
  boolControl("showGrid", "显示交集网格"),
  boolControl("colorByDegree", "按交集集合数量配色"),
  numberControl("minIntersection", "最少交集成员数", 0, 1e6),
  numberControl("minDegree", "最少参与集合数", 1, 12),
  numberControl("maxDegree", "最多参与集合数", 1, 12),
  numberControl("maxIntersections", "最多显示交集项", 1, 4095),
  {
    ...numberControl("setSizeWidth", "集合大小子图宽度", 120, 400),
    visible: (p) => p.style.showSetSizes !== false,
  },
  { ...numberControl("setRowSpacing", "集合行间距", 16, 60) },
  {
    key: "intersectionColor",
    label: "交集主色",
    type: "color",
    visible: (p) => !p.style.colorByDegree,
  },
  { key: "inactiveColor", label: "未参与集合颜色", type: "color" },
);
upset.defaultStyle = {
  ...upset.defaultStyle,
  showSetSizes: true,
  showEmpty: false,
  maxIntersections: 40,
  setSort: "input",
  sort: "descending",
  minDegree: 1,
  maxDegree: 12,
};
upset.limitations = [
  "最多 12 个集合；可显示非空或全部独有交集。默认显示排序后的前 40 项，可调整数量、成员数和集合数筛选。",
];

for (const id of [
  "bar",
  "bar-error",
  "scatter-error",
  "lollipop",
  "box",
  "violin",
  "raincloud",
  "ridgeline",
])
  basicTemplates.find((t) => t.id === id)!.defaultStyle.showLegend = false;

for (const t of basicTemplates.filter(
  (t) => !["pie", "rose", "radar", "upset"].includes(t.id),
))
  t.controls.push(
    { ...boolControl("xArrow", "横轴端点箭头"), section: "坐标与文字" },
    { ...boolControl("yArrow", "纵轴端点箭头"), section: "坐标与文字" },
    {
      ...numberControl("arrowSize", "坐标箭头大小", 3, 16),
      section: "坐标与文字",
      visible: (p) => Boolean(p.style.xArrow || p.style.yArrow),
    },
  );

for (const t of basicTemplates) {
  const previous = t.validate;
  t.validate = (data, style) => {
    const issues = previous(data, style);
    if (style) {
      const names = records(data).map((r) => String(r["类别"] || ""));
      const g = geometry(
        style,
        style.showLegend
          ? unique(
              records(data).map((r) => String(r["分组"] || r["类别"] || "")),
            ).filter(Boolean)
          : [],
        names,
      );
      if (
        g.left + g.w + g.right > style.width + 0.1 ||
        g.top + g.h + g.bottom > style.height + 0.1
      )
        issues.push({
          message:
            "画布不足以容纳当前边距、字号与文字。请增加宽度/高度，或减小字号及边距。",
        });
      if (t.id === "upset" && style.width < 520)
        issues.push({
          message:
            "UpSet 的集合大小和交集子图需要至少 520 像素宽度。请增加画布宽度。",
        });
    }
    return issues;
  };
}

for (const t of basicTemplates.filter(
  (t) => t.id === "bar-stacked" || t.id === "bar-grouped-stacked",
)) {
  t.controls.push(boolControl("connectStacks", "连接相邻柱的同一组分"), {
    ...numberControl("connectionOpacity", "组分连接带透明度", 0, 1, 0.05),
    visible: (p) => Boolean(p.style.connectStacks),
  });
  if (t.id === "bar-grouped-stacked") {
    t.controls.push(
      {
        ...boolControl("connectAcrossGroups", "允许连接不同大组"),
        visible: (p) => Boolean(p.style.connectStacks),
      },
      boolControl("showGroupHeaders", "显示大组标题与分隔线"),
      {
        ...numberControl("groupHeaderSize", "大组标题字号", 8, 30),
        visible: (p) => Boolean(p.style.showGroupHeaders),
      },
      {
        key: "groupHeaderColor",
        label: "大组标题颜色",
        type: "color",
        visible: (p) => Boolean(p.style.showGroupHeaders),
      },
    );
    t.defaultStyle.showGroupHeaders = true;
    t.defaultStyle.marginTop = 104;
  }
}

const radarTemplate = basicTemplates.find((t) => t.id === "radar")!;
radarTemplate.controls.push(
  numberControl("startAngle", "雷达起始角度", -360, 360),
  selectControl("radarGrid", "雷达网格形状", [
    ["polygon", "多边形"],
    ["circle", "同心圆"],
  ]),
  numberControl("radarTickCount", "雷达刻度数量", 2, 12),
  boolControl("showPoints", "显示节点"),
  selectControl("pointShape", "点形状", symbolNames),
  selectControl("pattern", "区域填充纹理", [
    ["none", "纯色"],
    ["diagonal", "斜线"],
    ["horizontal", "横线"],
    ["dots", "圆点"],
    ["grid", "网格"],
  ]),
);
radarTemplate.defaultStyle = {
  ...radarTemplate.defaultStyle,
  startAngle: -90,
  radarGrid: "polygon",
  radarTickCount: 5,
};
const dumbbellTemplate = basicTemplates.find((t) => t.id === "dumbbell")!;
dumbbellTemplate.controls.push(
  selectControl("pointShape", "端点形状", symbolNames),
  boolControl("dashed", "虚线连接"),
  selectControl("sort", "按差值排序", [
    ["input", "数据顺序"],
    ["ascending", "差值升序"],
    ["descending", "差值降序"],
  ]),
);
for (const t of basicTemplates) {
  for (const c of t.controls) {
    if (["line", "line-error"].includes(t.id) && c.key === "pattern")
      c.visible = (p) => Boolean(p.style.fillArea);
    if (
      ["line", "line-error", "bar-line", "radar"].includes(t.id) &&
      ["pointSize", "pointShape"].includes(c.key)
    )
      c.visible = (p) => p.style.showPoints !== false;
  }
  t.controls = Array.from(new Map(t.controls.map((c) => [c.key, c])).values());
}

for (const t of basicTemplates) {
  const previous = t.validate;
  t.validate = (dataset, style) => {
    const issues = previous(dataset, style);
    if (!style || issues.length) return issues;
    const p = {
      templateId: t.id,
      style,
      dataset,
    } as import("../../core/types").Project;
    const rows = records(dataset);
    for (const axis of ["x", "y"] as const) {
      if (!isNumericAxis(p, axis)) continue;
      let values: number[];
      if (t.familyId === "scatter")
        values = rows.map((r) => Number(r[axis === "x" ? "横坐标" : "纵坐标"]));
      else if (t.id === "dumbbell")
        values = rows.flatMap((r) => [Number(r["起点"]), Number(r["终点"])]);
      else if (t.familyId === "line" && axis === "x")
        values = rows.map((r) => Number(r["类别"]));
      else if (t.id.includes("error"))
        values = collectData({ project: p }, true).flatMap((d) => [
          style.singleSide ? d.value : d.value - d.error,
          d.value + d.error,
        ]);
      else if (t.id.includes("stacked")) {
        const grouped = collectData({ project: p });
        values = unique(grouped.map((d) => d.category))
          .flatMap((c) => {
            const items = grouped.filter((d) => d.category === c);
            return style.normalize
              ? [100]
              : [
                  items
                    .filter((d) => d.value >= 0)
                    .reduce((s, d) => s + d.value, 0),
                  items
                    .filter((d) => d.value < 0)
                    .reduce((s, d) => s + d.value, 0),
                ];
          })
          .filter((v) => v !== 0);
      } else values = rows.map((r) => Number(r["数值"]));
      if (
        style[axis + "Scale"] &&
        style[axis + "Scale"] !== "linear" &&
        values.some((v) => v <= 0)
      )
        issues.push({
          message: `${axis === "x" ? "横" : "纵"}轴对数尺度要求实际绘制范围全部大于 0；当前误差区间或数据包含非正值。请选择线性轴或调整误差表示。`,
        });
      const mode = String(style[axis + "Scale"] || "linear");
      if (
        mode !== "linear" &&
        typeof style[axis + "Max"] === "number" &&
        Number(style[axis + "Max"]) <= 0
      )
        issues.push({ message: "对数轴最大值必须大于 0。" });
      if (style[axis + "Break"]) {
        const scale = numericScale(
          values,
          style,
          axis,
          [0, 400],
          t.familyId === "bar" || t.familyId === "lollipop",
        );
        if (!scale._break)
          issues.push({
            message: `${axis === "x" ? "横" : "纵"}轴省略区间必须严格位于当前数值范围内，请调整省略起点/终点或坐标范围。`,
          });
        if (
          Number(style[axis + "BreakGap"] || 16) <= 0 ||
          Number(style[axis + "BreakGap"] || 16) >= 200
        )
          issues.push({
            message: "断轴间隔请设置为大于 0 且小于 200 的像素值。",
          });
      }
      const ticks = String(style[axis + "Ticks"] || "").trim();
      if (
        ticks &&
        ticks
          .split(",")
          .some((v) => v.trim() === "" || !Number.isFinite(Number(v)))
      )
        issues.push({
          message: `${axis === "x" ? "横" : "纵"}轴自定义刻度应为英文逗号分隔的有限数字。`,
        });
    }
    return issues;
  };
}

for (const t of basicTemplates.filter((t) =>
  ["violin", "raincloud", "ridgeline"].includes(t.id),
)) {
  t.defaultStyle = {
    ...t.defaultStyle,
    kdeBandwidth: "scott",
    kdePoints: 512,
    trim: true,
  };
  for (const c of t.controls)
    if (["kdeBandwidth", "kdePoints", "trim"].includes(c.key))
      c.visible = (p) => p.style.distribution !== "histogram";
  t.analysisMethods = [
    ...(t.analysisMethods || []),
    {
      method: "density",
      label: "核密度服务复核",
      description:
        "用 NumPy/SciPy 重新计算各组 Gaussian KDE。请使用与预览相同的 Scott/Silverman 规则、网格点数、截断与倍率；前端即时预览并不表示已执行服务计算。",
      params: {
        bandwidth: "scott",
        points: 512,
        trim: true,
        bins: 30,
        bandwidthMultiplier: 1,
      },
    },
  ];
  t.inputHelp +=
    " 图中的分布轮廓是即时预览：默认 Scott、512 点；分析面板可用相同参数由 SciPy 复核并保存带版本信息的结果。";
}
for (const t of basicTemplates.filter(
  (t) =>
    t.id.includes("error") ||
    ["box", "box-grouped", "violin", "raincloud", "ridgeline"].includes(t.id),
))
  t.tutorial.splice(
    2,
    0,
    "均值、SD、SE、分位数和误差区间为本地等价即时预览，尚不代表服务计算；在分析面板执行 NumPy/SciPy 描述统计可复核原始数据并保留方法版本。",
  );
