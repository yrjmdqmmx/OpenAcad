import type { DataTable, Project, Template } from "../core/types";
import { makeProject } from "../core/project";
import { exampleWorkbook } from "../core/data";

/** Keep only inputs consumed by the example's active mode. Native files and
 * raw correlation observations in the registry are separate, alternate examples. */
export function makeDetailProject(template: Template): Project {
  const project = makeProject(template);
  // These new examples carry the actual observations/memberships used in their
  // tests. Keep that audit trail in projects, while the guide shows plot inputs.
  if (template.id !== 'volcano' && !template.id.startsWith('enrichment-'))
    project.dataset.tables = project.dataset.tables.filter((table) => !table.role.startsWith("raw-"));
  if (project.dataset.tables.length && template.id !== "magnetic-correlation") project.dataset = { tables: project.dataset.tables };
  return project;
}

export function detailExampleDownload(template: Template, project: Project) {
  if (project.dataset.tables.length) {
    return { name: `${template.name}-示例数据.xlsx`, blob: exampleWorkbook({...project.dataset, tables:project.dataset.tables.filter(t=>!t.role.startsWith('raw-'))}) };
  }
  const extension = project.dataset.format === "newick" ? "nwk" : project.dataset.format || "txt";
  return {
    name: `${template.name}-示例.${extension}`,
    blob: new Blob([project.dataset.text || ""], { type: "text/plain;charset=utf-8" }),
  };
}

export interface FieldDescription {
  requirement: string;
  format: string;
  meaning: string;
}
const field = (format: string, meaning: string, requirement = "必填"): FieldDescription => ({ requirement, format, meaning });
const number = (meaning: string, requirement = "必填") => field("有限数字，不带单位文字", meaning, requirement);
const text = (meaning: string, requirement = "必填") => field("非空文本", meaning, requirement);
const position = (meaning: string) => field("正整数，从 1 开始，包含端点", meaning);
const uniqueId = (meaning: string) => field("非空且不重复的文本标识", meaning);

const roles: Record<string, { description: string; fields: Record<string, FieldDescription> }> = {
  items: { description: "每行一个条目，数值决定圆面积，分组决定颜色与包围圆。", fields: {
    name: uniqueId("圆的名称与文字标签。"), value: field("非负数字", "决定圆面积；0 不占面积。"), group: text("决定分组包围圆、颜色和图例。"),
  } },
  links: { description: "每行一条流向，节点由来源与去向自动生成。", fields: {
    source: text("流带的来源节点；相同名称指同一节点。"), target: text("流带的去向节点；不能与 source 相同或构成有向环。"), value: field("非负数字", "流量，决定流带宽度；0 流量不显示。"),
  } },
  nodes: { description: "节点清单；边表使用这里的 id 建立连接。", fields: {
    id: uniqueId("节点的连接标识，供边表引用。"), label: text("图中显示的节点名称，可与 id 不同。"), group: text("节点颜色与分类图例。", "可选"), size: field("正数", "启用数据大小模式时映射节点大小。", "可选"),
  } },
  edges: { description: "每行一条关系，source 与 target 都要在节点表中找到。", fields: {
    source: text("起始节点的 id。"), target: text("目标节点的 id。"), weight: field("非负数字", "开启加权边时映射线宽。", "可选"),
  } },
  coordinates: { description: "每行一个采样点，以经纬度定位，不提供地址解析。", fields: {
    id: uniqueId("采样点名称与标签。"), longitude: field("−180～180 的数字，单位为度", "经度，正数向东、负数向西。"), latitude: field("−90～90 的数字，单位为度", "纬度，正数向北、负数向南。"), group: text("点的分类颜色与图例。", "可选"), value: field("非负数字", "启用大小映射时决定点大小。", "可选"),
  } },
  sequences: { description: "每行一条蛋白序列；区间表引用这里的 id，不能超过其长度。", fields: {
    id: uniqueId("蛋白序列标识与行标签。"), length: field("正整数，单位为氨基酸", "完整蛋白长度，决定序列横线及区间边界。"),
  } },
  segments: { description: "每行一个已计算的结构域或基序区间，sequence 与序列长度表关联。", fields: {
    sequence: text("必须匹配 sequences 表中的 id，决定所在蛋白行。"), name: text("片段显示名称。"), start: position("片段起点；不得大于 end。"), end: position("片段终点；不得超过对应序列的 length。"), category: text("片段颜色与图例分类。"), significance: field("非负 E 值或 P 值，可留空", "已有检验结果用于筛选；空白表示未提供，仅在默认阈值 1 时显示，不视为显著。"),
  } },
  chromosomes: { description: "每行一条染色体，其他工作表中的染色体名称必须引用这里的 id。", fields: {
    id: uniqueId("染色体标识与图中标签。"), length: field("正整数，单位为碱基", "染色体长度或明确给定的绘图范围，限制所有引用区间。"),
  } },
  tracks: { description: "每行一个染色体区间的轨道值；同一轨道类型共享数值解释。", fields: {
    chromosome: text("引用 chromosomes 表的 id。"), start: position("轨道区间起点。"), end: position("轨道区间终点；不超过染色体长度。"), value: field("范围取决于 type", "gc-content 填 0～100；gc-skew 填 −1～1；value 填有限数字。"), type: field("gc-content、gc-skew 或 value", "选择 GC 含量、GC 偏斜或普通数值轨道。"),
  } },
  annotations: { description: "可选基因注释表；每行一个区间，定位到对应染色体。", fields: {
    chromosome: text("引用 chromosomes 表的 id。"), start: position("注释区间起点。"), end: position("注释区间终点，不超过染色体长度。"), name: text("注释标签。"), strand: field("+ 或 -", "区间链方向；负链也保持 start ≤ end。"),
  } },
  "genome-links": { description: "可选区间关联表；每行连接两个染色体区间。", fields: {
    source: text("来源染色体 id。"), sourceStart: position("来源区间起点。"), sourceEnd: position("来源区间终点。"), target: text("目标染色体 id。"), targetStart: position("目标区间起点。"), targetEnd: position("目标区间终点。"), value: field("非负数字", "关联权重，供连接显示使用。"),
  } },
  "synteny-genes": { description: "每行一个基因的坐标；配对表通过基因 id 引用这里的区间。", fields: {
    chromosome: text("引用 chromosomes 表中的 id。"), id: uniqueId("基因标识，供配对表引用。"), start: position("基因起点。"), end: position("基因终点，满足 start ≤ end 且不超过染色体范围。"),
  } },
  "synteny-links": { description: "每行一对已计算的共线性基因，不从坐标自行预测共线性。", fields: {
    source: text("来源基因 id，引用基因坐标表。"), target: text("目标基因 id，引用基因坐标表。"), block: text("共线性区块名称，区分配对所属区块。"), evalue: field("非负数字，可留空", "已有配对检验结果参与筛选；空白表示未提供，仅在默认阈值 1 时显示。"),
  } },
  mantel: { description: "每行一项已有 Mantel 结果；target 必须匹配上方矩阵的环境变量名。", fields: {
    source: text("群落名称，决定矩阵外连线起点。"), target: text("环境变量名称，必须出现在系数矩阵中。"), r: field("−1～1 的数字", "Mantel 系数，绝对值映射线宽，符号可用虚线表示。"), p: field("0～1 的数字", "Mantel P 值，决定显著性线色。"),
  } },
};

export function sheetDescription(template: Template, table: DataTable): string {
  if (table.role === "magnetic-curve") return "磁异常曲线 CSV：每行一个观测点。示例为参照用户例图形状制作的模拟数据，非原始观测。";
  if (table.role === "magnetic-profile") return "海底和基底 CSV：沿同一测线的海底海拔与基底深度；距离按输入保留，不自动拉伸。";
  if (table.role.startsWith('raw-')) return '计算依据：保留生成示例结果的模拟原始输入或检验明细；当前结果输入模式不随本表编辑重新计算。';
  if (table.role === "data") return template.id === "upset"
    ? "长表：一行记录一个成员属于哪个集合；同一成员可在多行引用不同集合。"
    : "第一行是列名，下方每行一条记录。列顺序可按字段映射调整，含义须与列名一致。";
  if (table.role === "sets") return "宽表：每列一个集合，每格一个成员；各列独立，同行成员不表示配对。";
  if (table.role === "correlation") return "上图的相关系数矩阵；第一列为行变量，后续列名为列变量。";
  if (table.role === "pvalues") return "可选显著性矩阵；每格 P 值对应系数表同一行列，缺少本表时不显示显著性星号。";
  if (["pca", "pcoa", "nmds", "cca", "rda"].includes(template.id)) {
    return table.role === "environment"
      ? "环境因子工作表；通过首列样本 ID 与响应表匹配，样本集合必须相同。"
      : "原始样本矩阵；一行一个样本，首列为唯一标识，其余为参与计算的数值特征。";
  }
  if (table.role === "matrix") return "数值宽表；第一列为唯一行名，其余每列一个特征，每格对应上图中的一个交叉位置。";
  if (table.role === "genes") return template.id === "volcano"
    ? "已完成的差异分析结果表；每行一个基因或其他差异条目。"
    : "每行一个基因的簇归属、区间与链方向；全部坐标从 1 开始并包含末端。";
  if (table.role === "enrichment") return "已计算的富集结果表；一行一个条目。各字段直接用于绘图，不执行富集检验。";
  return roles[table.role]?.description || "";
}

export function describeField(template: Template, table: DataTable, column: string): FieldDescription {
  if (template.id === "magnetic-correlation") {
    const meanings: Record<string, string> = {
      dist_km: "磁异常观测点到测线起点的距离（km），严格递增。",
      mag_nT: "观测磁异常（nT），允许正负值。",
      s_km: "剖面点到同一测线起点的距离（km），严格递增。",
      bathy_m: "海底海拔（m），海平面以下为负值；绘图转为向下正深度。",
      basement_km: "磁性基底深度（km），向下为正，应位于海底之下。",
    };
    if (meanings[column]) return number(meanings[column]);
  }
  if (table.role === 'raw-expression') return column === 'id' ? uniqueId('关联结果表的模拟基因。') : number('此独立模拟样本的 log₂ 表达量，供复核 Welch 检验。');
  if (table.role === 'raw-universe') return uniqueId('检验背景中的模拟基因；所有行共同定义背景集合。');
  if (table.role === 'raw-study') return column === 'gene' ? uniqueId('模拟输入基因，必须属于背景集合。') : text('模拟指定的方向，用于核对圈图上下调计数。');
  if (table.role === 'raw-membership') return text(column === 'gene' ? '模拟通路成员，引用背景基因。' : '虚构 SIM 通路标识，引用结果表 ID。');
  if (table.role === 'raw-tests') return column === 'term' ? uniqueId('结果表 ID。') : field('0～1 的数字', column === 'Pvalue' ? '实际超几何检验的单侧 P 值。' : '对全部八个通路进行 BH 校正的 Q 值。');
  const index = table.columns.indexOf(column);
  if (table.role === "data") {
    const optional = ["名称", "样本", "大小"].includes(column) ? "可选" : "必填";
    const repeated = ["bar-error", "bar-grouped-error", "scatter-error", "line-error", "box", "box-grouped", "violin", "raincloud", "ridgeline"].includes(template.id);
    const dataFields: Record<string, FieldDescription> = {
      类别: text(template.id === "radar" ? "辐射轴上的指标名称。" : template.id.startsWith("line") ? "横轴的时间、剂量或类别；选数值轴时须可解析为数字。" : "类别轴或扇区的名称；相同名称归为同一类。"),
      数值: number(repeated ? "一次原始观测，用于组内分布或均值与误差计算。" : template.id === "bar-line" ? "柱子的高度，读取左侧数值轴。" : template.id.includes("stacked") ? "一个组分的量，决定柱中对应堆叠段的长度。" : template.id.startsWith("lollipop") ? "决定细线终端的数值位置。" : template.id === "line" ? "该横轴位置的测量值，决定折线节点的纵坐标。" : template.id === "radar" ? "该指标的径向数值，决定轮廓点离中心的距离。" : "决定对应类别或分组柱从零线伸出的长度。"),
      分组: text(template.id === "radar" ? "比较对象名称，同组各指标连成一条轮廓。" : template.id.includes("stacked") ? "柱内组分，对应堆叠色块与图例。" : "实验系列或类别类型，对应颜色与图例。"),
      大组: text("批次或队列；与类别一起确定一根堆叠柱。"),
      折线数值: number("同一类别的第二项指标，读取右侧数值轴。"),
      名称: text("点的标识；开启标签时显示，不参与坐标计算。", optional),
      横坐标: number("点在横轴上的位置。"), 纵坐标: number("点在纵轴上的位置。"),
      大小: field("非负数字", "启用“大小”列映射后影响点大小；默认不启用。", optional),
      样本: text("重复观测编号，方便追溯；本示例按类别或类别 × 分组汇总，不用它自动配对。", optional),
      起点: number("同一条目的第一个端点，例如处理前。"), 终点: number("同一条目的第二个端点，例如处理后；与起点使用相同单位。"),
      集合: text("集合名称；相同名称的成员组成同一个集合。"), 成员: text("成员标识，相同名称视为同一个元素。"),
    };
    if (["pie", "rose"].includes(template.id) && column === "数值") return field("非负数字，整列总和大于零", template.id === "pie" ? "占整列总和的比例决定扇区角度。" : "决定等角扇区的径向长度。" );
    if (dataFields[column]) return dataFields[column];
  }
  if (table.role === "sets") return field("成员标识；允许空白补齐", `“${column}”集合的成员；重复值去重，空白忽略，和其他列同行的值不需要配对。`);
  if (["matrix", "response", "environment", "correlation", "pvalues"].includes(table.role)) {
    if (index === 0) return uniqueId(table.role === "correlation" || table.role === "pvalues" ? "行变量名称，与图的行标签对应；P 值表需与系数表顺序一致。" : "样本或行名称；多表分析按这个标识匹配。" );
    if (table.role === "correlation") return field("−1～1 的相关系数", `行变量与“${column}”的相关性，映射该交叉格的颜色。`);
    if (table.role === "pvalues") return field("0～1 的 P 值", `行变量与“${column}”相关系数的显著性，决定星号与筛选。`);
    if (template.id.startsWith("binary-")) return field("数字 0 或 1，不留空", `“${column}”特征的缺失或存在状态。`);
    if (["pca", "pcoa", "nmds", "cca", "rda"].includes(template.id)) return field(template.id === "cca" && table.role === "response" ? "非负数字，不留空" : "有限数字，不留空", table.role === "environment" ? `环境因子“${column}”参与约束分析，对应环境箭头。` : `特征“${column}”参与样本坐标计算；本列不是图上的坐标轴。`);
    return number(`行名称与“${column}”交叉处的值，映射为格色${template.id === "bubble-matrix" ? "及气泡面积" : ""}。`);
  }
  if (table.role === "genes") {
    const fields: Record<string, FieldDescription> = template.id === "volcano" ? {
      id: uniqueId("每个点的条目标识，供标签显示。"), log2FC: number("横坐标；正负表示相对变化方向。"), pvalue: field("大于 0 且不超过 1", "纵坐标使用 −log10(P)，并与显著性阈值共同分类。"),
    } : {
      cluster: text("基因簇名称，决定所在行。"), id: uniqueId("基因标识与标签。"), start: position("基因区间起点；不大于 end。"), end: position("基因区间终点。"), strand: field("+ 或 -", "箭头方向，不通过倒写坐标表达负链。"), category: text("功能分类，对应箭头颜色和图例。"),
    };
    const result = fields[column];
    if (result) return result;
  }
  if (table.role === "enrichment") {
    const circle = template.id === "enrichment-circle";
    const fields: Record<string, FieldDescription> = {
      ID: uniqueId("条目标识；圈图可用作扇区标签。"),
      GeneRatio: field("0～1 的小数，或分母大于零的分式", "如 12/180；默认气泡图和条形图用作横轴。圈图保留该比例供条目信息读取。"),
      Description: text("条目名称，用于行标签或扇区说明。"),
      Qvalue: field("0～1 的数字", "调整后的显著性结果，映射连续色并参与排序。"),
      Count: field("非负整数", circle ? "命中数，必须等于 Up + Down。" : "气泡大小；也可选为横轴指标。"),
      Class: text("条目分类，圈图外环或开启的分类色带与图例使用。", circle ? "必填" : "可选"),
      Background: field("正整数，且不小于 Count", circle ? "背景数量，决定内圈径向柱长。" : "供富集圈图使用；当前图形不映射此列。", circle ? "必填" : "本图不需要"),
      Up: field("非负整数", circle ? "上调数量，与 Down 共同决定上下调环比例。" : "供富集圈图使用；当前图形不映射此列。", circle ? "必填" : "本图不需要"),
      Down: field("非负整数", circle ? "下调数量，与 Up 之和必须等于 Count。" : "供富集圈图使用；当前图形不映射此列。", circle ? "必填" : "本图不需要"),
    };
    if (fields[column]) return fields[column];
  }
  const result = roles[table.role]?.fields[column];
  if (!result) throw new Error(`“${template.id}/${table.role}/${column}”缺少字段说明。`);
  return result;
}

export function spreadsheetColumn(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}
