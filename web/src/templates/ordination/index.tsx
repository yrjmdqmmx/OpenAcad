import * as d3 from "d3";
import { placeLabels } from "../../core/labelLayout";
import type {
  Template,
  Project,
  RendererProps,
  Dataset,
  Issue,
  AnalysisState,
} from "../../core/types";
import {
  ChartFrame,
  Axes,
  color,
  linearDomain,
  num,
  PointGlyph,
  ValueLabel,
  symbolNames,
} from "../basic/shared";
import { sampleAnnotations } from "./annotations";
export { OrdinationPanel, ordinationIssues } from "./annotations";
import inputs from "./example-inputs.json";
import references from "./reference-results.json";
const refs = references as Record<
  string,
  { example: AnalysisState; alternate: AnalysisState }
>;
function validate(dataset: Dataset): Issue[] {
  const issues: Issue[] = [];
  if (!dataset.tables.length) return [{ message: "请上传样本与特征矩阵。" }];
  for (const t of dataset.tables) {
    if (t.rows.length < 3)
      issues.push({ tableId: t.id, message: `“${t.name}”至少需要 3 个样本。` });
    const ids = new Set<string>();
    t.rows.forEach((row, i) => {
      if (!String(row[0] ?? "").trim() || ids.has(String(row[0])))
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: 1,
          message: `“${t.name}”第 ${i + 2} 行样本编号为空或重复。`,
        });
      ids.add(String(row[0]));
      for (let j = 1; j < t.columns.length; j++) {
        if (
          row[j] === null ||
          row[j] === "" ||
          !Number.isFinite(Number(row[j]))
        )
          issues.push({
            tableId: t.id,
            row: i + 2,
            column: j + 1,
            message: `“${t.name}”第 ${i + 2} 行“${t.columns[j]}”需要有限数字，不能留空。`,
          });
      }
    });
  }
  return issues;
}
function Ordination({ project, ...props }: RendererProps) {
  const s = project.style;
  const existing = s.ordinationInput === "scores";
  const table = project.dataset.tables[0];
  const result = existing
    ? {
        data: {
          scores: table?.rows.map((r) => r.slice(1).map(Number)),
          rowLabels: table?.rows.map((r) => String(r[0])),
        },
      }
    : project.analysis?.result;
  const data = result?.data as
    | {
        scores?: number[][];
        rowLabels?: string[];
        loadings?: number[][];
        columnLabels?: string[];
        environmentVectors?: number[][];
        environmentLabels?: string[];
        explainedRatio?: number[];
        stress?: number;
        converged?: boolean;
      }
    | undefined;
  const a = Math.max(0, num(s.axisOne, 1) - 1),
    b = Math.max(0, num(s.axisTwo, 2) - 1);
  const scores = data?.scores || [];
  const axisCount = scores[0]?.length || 0;
  const labels = data?.rowLabels || [];
  const ready = axisCount > Math.max(a, b) && a !== b;
  const prefix = project.templateId.toUpperCase();
  const annotation = sampleAnnotations(project);
  const groups = Array.from(
    new Set(labels.map((id) => annotation[id]?.group || "样本")),
  );
  const axisLabel = (i: number) =>
    existing
      ? table?.columns[i + 1] || `坐标 ${i + 1}`
      : `${prefix === "PCA" ? "PC" : prefix === "PCOA" ? "PCo" : prefix === "NMDS" ? "NMDS" : prefix} ${i + 1}${data?.explainedRatio?.[i] !== undefined ? ` (${(data.explainedRatio[i] * 100).toFixed(2)}%)` : ""}`;
  const renderProject = {
    ...project,
    style: {
      ...s,
      xTitle: s.xTitle || axisLabel(a),
      yTitle: s.yTitle || axisLabel(b),
    },
  };
  const vectors = [
    ...(s.showLoadings && data?.loadings
      ? data.loadings.map((v, i) => ({
          v,
          label: data.columnLabels?.[i] || `变量 ${i + 1}`,
          kind: 1,
        }))
      : []),
    ...(s.showEnvironment && data?.environmentVectors
      ? data.environmentVectors.map((v, i) => ({
          v,
          label: data.environmentLabels?.[i] || `环境 ${i + 1}`,
          kind: 2,
        }))
      : []),
  ];
  return (
    <ChartFrame
      project={renderProject}
      legend={
        s.showLegend
          ? [
              ...groups,
              ...(vectors.some((v) => v.kind === 1) ? ["变量载荷"] : []),
              ...(vectors.some((v) => v.kind === 2) ? ["环境因子"] : []),
            ]
          : []
      }
      {...props}
    >
      {(g, style) => {
        if (!ready)
          return (
            <g>
              <text
                x={s.width / 2}
                y={s.height / 2 - 12}
                textAnchor="middle"
                fill={s.textColor}
                fontSize="20"
              >
                {scores.length
                  ? "请选择两个不同的有效坐标轴"
                  : "准备好数据后，开始真实分析"}
              </text>
              <text
                x={s.width / 2}
                y={s.height / 2 + 20}
                textAnchor="middle"
                fill={s.textColor}
                fontSize="14"
              >
                {scores.length
                  ? "有效维度不足时不会补造第二个坐标轴。"
                  : "左侧“分析”面板可选择方法与参数。"}
              </text>
            </g>
          );
        const scale = num(s.vectorScale, 1);
        const xs = [
            ...scores.map((v) => v[a]),
            ...vectors.map((v) => v.v[a] * scale),
          ],
          ys = [
            ...scores.map((v) => v[b]),
            ...vectors.map((v) => v.v[b] * scale),
          ];
        const x = d3
          .scaleLinear()
          .domain(linearDomain(xs, style, "x"))
          .range([0, g.w]);
        const y = d3
          .scaleLinear()
          .domain(linearDomain(ys, style, "y"))
          .range([g.h, 0]);
        const samplePoints = scores.map((v, i) => ({ id: "sample-" + labels[i], x: x(v[a]), y: y(v[b]), text: annotation[labels[i]]?.label ?? labels[i], size: num(style.labelSize, style.fontSize) }));
        const vectorPoints = vectors.map(({v, label}, i) => ({ id: "vector-" + i, x: x(v[a] * scale), y: y(v[b] * scale), text: label, size: style.fontSize }));
        const positions = placeLabels([...vectorPoints, ...(style.showLabels ? samplePoints : [])], g.w, g.h, samplePoints);
        const savedLabels = (project.layout.labels || {}) as Record<string, {x:number; y:number}>;
        for (const point of [...samplePoints, ...vectorPoints]) {
          const saved = savedLabels[point.id];
          if (saved) positions[point.id] = point.id.startsWith("sample-") ? {x:point.x+saved.x,y:point.y+saved.y} : saved;
        }
        return (
          <>
            <Axes g={g} s={style} x={x} y={y} />
            <g transform={`translate(${g.left},${g.top})`}>
              <line
                x1={x(0)}
                x2={x(0)}
                y2={g.h}
                stroke={style.textColor}
                opacity=".2"
                strokeDasharray="4 4"
              />
              <line
                y1={y(0)}
                y2={y(0)}
                x2={g.w}
                stroke={style.textColor}
                opacity=".2"
                strokeDasharray="4 4"
              />
              {scores.map((v, i) => (
                <g
                  key={i}
                  data-sample={labels[i]}
                  transform={`translate(${x(v[a])},${y(v[b])})`}
                >
                  <PointGlyph
                    r={style.pointSize}
                    shape={style.pointShape}
                    fill={color(
                      style,
                      groups.indexOf(annotation[labels[i]]?.group || "样本"),
                    )}
                    opacity={style.opacity}
                    stroke="white"
                    strokeWidth={1}
                  />
                  <title>{`${labels[i]}：${v[a].toFixed(5)}，${v[b].toFixed(5)}`}</title>
                  {style.showLabels && Math.hypot(positions["sample-" + labels[i]].x - x(v[a]), positions["sample-" + labels[i]].y - y(v[b])) > 22 &&
                    <line x1={0} y1={0} x2={positions["sample-" + labels[i]].x - x(v[a])} y2={positions["sample-" + labels[i]].y - y(v[b]) - 4} stroke={style.textColor} opacity={.3} />}
                  {style.showLabels && (
                    <ValueLabel
                      {...props}
                      project={project}
                      id={"sample-" + labels[i]}
                      x={positions["sample-" + labels[i]].x - x(v[a])}
                      y={positions["sample-" + labels[i]].y - y(v[b])}
                      style={style}
                      anchor="start"
                    >
                      {annotation[labels[i]]?.label ?? labels[i]}
                    </ValueLabel>
                  )}
                </g>
              ))}
              {vectors.map(({ v, label, kind }, i) => {
                const vx = x(v[a] * scale),
                  vy = y(v[b] * scale),
                  ox = x(0),
                  oy = y(0),
                  angle = Math.atan2(vy - oy, vx - ox);
                return (
                  <g
                    key={i}
                    stroke={color(
                      style,
                      groups.length +
                        (kind === 2 && vectors.some((v) => v.kind === 1)
                          ? 1
                          : 0),
                    )}
                    fill={color(
                      style,
                      groups.length +
                        (kind === 2 && vectors.some((v) => v.kind === 1)
                          ? 1
                          : 0),
                    )}
                  >
                    <line
                      x1={ox}
                      y1={oy}
                      x2={vx}
                      y2={vy}
                      strokeWidth={style.lineWidth}
                    />
                    <path
                      d={`M${vx - 8 * Math.cos(angle - 0.4)},${vy - 8 * Math.sin(angle - 0.4)}L${vx},${vy}L${vx - 8 * Math.cos(angle + 0.4)},${vy - 8 * Math.sin(angle + 0.4)}`}
                      fill="none"
                      strokeWidth={style.lineWidth}
                    />
                    <line x1={vx} y1={vy} x2={positions["vector-" + i].x} y2={positions["vector-" + i].y - 4} opacity={.4} />
                    <ValueLabel {...props} project={project} id={"vector-" + i}
                      x={positions["vector-" + i].x} y={positions["vector-" + i].y}
                      style={{ ...style, labelColor: color(style, groups.length + (kind === 2 && vectors.some(v => v.kind === 1) ? 1 : 0)) }} anchor="start">
                      {label}
                    </ValueLabel>
                  </g>
                );
              })}
            </g>
            {data?.stress !== undefined && (
              <text
                x={style.width - g.right}
                y={g.top - 12}
                textAnchor="end"
                fill={style.textColor}
              >
                Stress = {data.stress.toFixed(4)} ·{" "}
                {data.converged ? "已收敛" : "未收敛"}
              </text>
            )}
          </>
        );
      }}
    </ChartFrame>
  );
}
const names = {
  pca: [
    "主成分分析 PCA",
    "用正交主成分概括多变量差异，查看样本得分、变量载荷和解释率。",
  ],
  pcoa: [
    "主坐标分析 PCoA",
    "从所选样本距离构建坐标，保留非欧氏距离产生的负特征值诊断。",
  ],
  nmds: [
    "非度量多维尺度 NMDS",
    "保持生态距离的排序关系，显示真实迭代结果与 stress。",
  ],
  cca: [
    "典范对应分析 CCA",
    "用环境变量解释非负物种组成，显示样本、物种和环境箭头。",
  ],
  rda: [
    "冗余分析 RDA",
    "用环境变量约束多变量响应，区分总惯量和约束惯量解释率。",
  ],
};
export const ordinationTemplates: Template[] = Object.entries(names).map(
  ([id, [name, description]]) => {
    const input = inputs[id as keyof typeof inputs];
    return {
      id,
      familyId: "ordination",
      variant: id,
      version: 1,
      name,
      description,
      category: "排序与多变量",
      tags: [id, "统计", "样本", "多变量"],
      sourceUrls: [
        `https://www.chiplot.online/${["cca", "rda"].includes(id) ? id.toUpperCase() : id}.html`,
      ],
      status: "available",
      formats: ["csv", "tsv", "xls", "xlsx"],
      defaultStyle: {
        ordinationInput: "raw",
        pointShape: "circle",
        title: name,
        subtitle: "模拟样本数据 · 结果由固定统计环境计算",
        width: 960,
        height: 680,
        marginRight: 95,
        pointSize: 6,
        showLabels: true,
        showLoadings: id === "pca",
        showEnvironment: ["cca", "rda"].includes(id),
        axisOne: 1,
        axisTwo: 2,
        vectorScale: 1,
      },
      controls: [
        {
          key: "ordinationInput",
          label: "输入内容",
          type: "select",
          options: [
            { value: "raw", label: "原始矩阵，执行统计" },
            { value: "scores", label: "已有坐标，直接绘图" },
          ],
          section: "数据与坐标",
        },
        {
          key: "pointShape",
          label: "样本点形状",
          type: "select",
          options: symbolNames.map(([value, label]) => ({ value, label })),
          section: "坐标与得分",
        },
        {
          key: "labelSize",
          label: "标签字号",
          type: "number",
          min: 6,
          max: 50,
          section: "坐标与得分",
        },
        {
          key: "labelItalic",
          label: "标签斜体",
          type: "boolean",
          section: "坐标与得分",
        },
        {
          key: "xTitle",
          label: "横轴标题",
          type: "text",
          section: "坐标与得分",
        },
        {
          key: "yTitle",
          label: "纵轴标题",
          type: "text",
          section: "坐标与得分",
        },
        {
          key: "axisOne",
          label: "横轴维度",
          type: "number",
          min: 1,
          max: 20,
          section: "坐标与得分",
        },
        {
          key: "axisTwo",
          label: "纵轴维度",
          type: "number",
          min: 1,
          max: 20,
          section: "坐标与得分",
        },
        {
          key: "pointSize",
          label: "样本点半径",
          type: "number",
          min: 1,
          max: 20,
          section: "坐标与得分",
        },
        {
          key: "showGrid",
          label: "网格线",
          type: "boolean",
          section: "坐标与得分",
        },
        {
          key: "showLoadings",
          label: "显示变量载荷",
          type: "boolean",
          section: "坐标与得分",
          visible: () => ["pca", "cca", "rda"].includes(id),
        },
        {
          key: "showEnvironment",
          label: "显示环境箭头",
          type: "boolean",
          section: "坐标与得分",
          visible: () => ["cca", "rda"].includes(id),
        },
        {
          key: "vectorScale",
          label: "箭头显示倍数",
          type: "number",
          min: 0.05,
          max: 20,
          step: 0.05,
          section: "坐标与得分",
          visible: () => ["pca", "cca", "rda"].includes(id),
        },
      ],
      example: input.example.dataset,
      alternate: input.alternate.dataset,
      exampleAnalysis: refs[id]?.example,
      inputHelp:
        "已有坐标模式下，首列是样本编号，其余列是已计算的坐标；不会把这些值当作本站计算结果。原始矩阵模式下，首列为唯一的样本编号，其余列为数值特征。不能缺失或混入单位。CCA/RDA 需要另一个环境因子表，明确选择响应与环境角色；两表样本 ID 集合必须一致。CCA 响应必须非负，且不能有全零行列。",
      tutorial: [
        "先使用已计算的模拟示例查看布局；示例结果记录真实计算方法与版本。",
        "替换样本矩阵，多表分析确认响应/环境角色与样本编号。",
        "打开分析面板，选择预处理、距离和参数，点击开始计算。",
        "检查诊断、解释率或 stress；选择有效坐标轴、调整点和箭头样式。",
        "保存项目可保留已有结果；改样式不重复计算，改数据后需重新计算。",
      ],
      limitations: [
        "未收敛的 NMDS 结果会明确标注；不能把 stress 当作解释率。",
        "二维图要求至少两个有效坐标轴，不以零补造缺失轴。",
        "箭头显示倍数只影响图形，不改变统计载荷。",
      ],
      exampleSource: {
        kind: "simulated",
        label:
          "OpenAcad 使用固定随机种子生成的 12 个模拟样本；参考结果由项目固定 Python/R 环境真实计算。",
        license: "CC0-1.0",
      },
      validate,
      Renderer: Ordination,
      analysisMethods: [
        { method: id, label: name, description, params: input.example.params },
      ],
      prepareAnalysis: (_method, dataset, params) => ({
        data: { tables: dataset.tables },
        params,
      }),
    };
  },
);
