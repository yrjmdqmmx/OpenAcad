import { useId, useMemo } from "react";
import { extent, format, scaleBand, scaleLinear } from "d3";
import type { Cell, Project, Template } from "../core/types";
import { makeProject } from "../core/project";

const teal = "#087f8c";
const copper = "#c0804f";
const ink = "#314b55";
const axis = "#a9bcbe";
const grid = "#dce6e5";
const numberLabel = format(".3~g");
const svgStyle = { fontFamily: '"Noto Sans SC", sans-serif', fontSize: 14, color: ink };

function finiteNumber(value: Cell | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function paddedDomain(values: number[]): [number, number] {
  const [minimum = 0, maximum = 0] = extent(values);
  const padding = (maximum - minimum || Math.abs(maximum) || 1) * 0.1;
  return [minimum - padding, maximum + padding];
}

type Preview = { template: Template; project: Project };

function PcaPreview({ template, project }: Preview) {
  const result = project.analysis?.result?.data as {
    scores?: number[][];
    rowLabels?: string[];
    explainedRatio?: number[];
  } | undefined;
  const scores = result?.scores;
  const ratios = result?.explainedRatio;
  if (!scores?.length || !ratios || ratios.length < 2 ||
    !scores.every((row) => Number.isFinite(row[0]) && Number.isFinite(row[1])) ||
    !Number.isFinite(ratios[0]) || !Number.isFinite(ratios[1])) return null;

  const x = scaleLinear().domain(paddedDomain(scores.map((row) => row[0]))).range([62, 378]);
  const y = scaleLinear().domain(paddedDomain(scores.map((row) => row[1]))).range([280, 54]);
  const xLabel = `PC 1 (${(ratios[0] * 100).toFixed(2)}%)`;
  const yLabel = `PC 2 (${(ratios[1] * 100).toFixed(2)}%)`;
  return (
    <svg className="chart-svg" width={400} height={360} viewBox="0 0 400 360" role="img" aria-label={template.name} style={svgStyle}>
      <title>{template.name}：{scores.length} 个模拟样本的主成分得分</title>
      <desc>读取 OpenAcad 模板中由真实 PCA 算法计算的模拟示例结果。横轴 {xLabel}，纵轴 {yLabel}。圆点对应原始样本得分，未额外划分样本组。</desc>
      <text x={220} y={24} textAnchor="middle" fill={ink} fontSize={16} fontWeight={600}>{template.name}</text>
      {x.ticks(5).map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={x(tick)} x2={x(tick)} y1={54} y2={280} stroke={grid} />
          <text x={x(tick)} y={302} textAnchor="middle" fill={ink}>{numberLabel(tick)}</text>
        </g>
      ))}
      {y.ticks(4).map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={62} x2={378} y1={y(tick)} y2={y(tick)} stroke={grid} />
          <text x={51} y={y(tick)} dy=".35em" textAnchor="end" fill={ink}>{numberLabel(tick)}</text>
        </g>
      ))}
      <path d="M62 54V280H378" fill="none" stroke={axis} />
      <line x1={x(0)} x2={x(0)} y1={54} y2={280} stroke={axis} strokeDasharray="4 4" />
      <line x1={62} x2={378} y1={y(0)} y2={y(0)} stroke={axis} strokeDasharray="4 4" />
      {scores.map((score, index) => (
        <circle key={result?.rowLabels?.[index] ?? index} cx={x(score[0])} cy={y(score[1])} r={5.5} fill={teal} stroke="#f1f6f5" strokeWidth={1.5}>
          <title>{result?.rowLabels?.[index] ?? `样本 ${index + 1}`}：PC 1 = {score[0].toFixed(3)}，PC 2 = {score[1].toFixed(3)}</title>
        </circle>
      ))}
      <text x={220} y={325} textAnchor="middle" fill={ink}>{xLabel}</text>
      <text transform="translate(19 167) rotate(-90)" textAnchor="middle" fill={ink}>{yLabel}</text>
      <g transform="translate(163 346)">
        <circle r={4.5} fill={teal} />
        <text x={12} dy=".35em" fill={ink}>样本（{scores.length}）</text>
      </g>
    </svg>
  );
}

function BarPreview({ template, project }: Preview) {
  const table = project.dataset.tables.find((item) => item.role === "data") ?? project.dataset.tables[0];
  if (!table) return null;
  const categoryIndex = table.columns.indexOf("类别");
  const valueIndex = table.columns.indexOf("数值");
  const groupIndex = table.columns.indexOf("分组");
  if ([categoryIndex, valueIndex, groupIndex].some((index) => index < 0)) return null;
  const values = table.rows.map((row) => ({
    category: String(row[categoryIndex] ?? ""),
    group: String(row[groupIndex] ?? ""),
    value: finiteNumber(row[valueIndex]),
  }));
  if (!values.length || values.some((row) => row.value === undefined)) return null;
  const categories = [...new Set(values.map((row) => row.category))];
  const groups = [...new Set(values.map((row) => row.group))];
  const x = scaleBand().domain(categories).range([34, 232]).padding(0.24);
  const inner = scaleBand().domain(groups).range([0, x.bandwidth()]).padding(0.15);
  const [minimum = 0, maximum = 0] = extent(values.map((row) => row.value!));
  const y = scaleLinear().domain([Math.min(0, minimum), Math.max(0, maximum) || 1]).nice(3).range([120, 49]);
  const colors = [teal, copper];
  return (
    <svg className="chart-svg" width={240} height={174} viewBox="0 0 240 174" role="img" aria-label={template.name} style={svgStyle}>
      <title>{template.name}：模板原始模拟数据</title>
      <desc>按原始类别并列展示各实验系列，柱高对应模板中的数值，纵轴从零开始。类别为 {categories.join("、")}；实验系列为 {groups.join("、")}。</desc>
      <text x={120} y={18} textAnchor="middle" fill={ink} fontSize={15} fontWeight={600}>{template.name}</text>
      {groups.map((group, index) => (
        <g key={group} transform={`translate(${51 + index * 91} 36)`}>
          <rect x={0} y={-9} width={9} height={9} fill={colors[index % colors.length]} />
          <text x={14} fill={ink} fontSize={13}>{group}</text>
        </g>
      ))}
      {y.ticks(3).map((tick) => (
        <g key={tick}>
          <line x1={34} x2={232} y1={y(tick)} y2={y(tick)} stroke={grid} />
          <text x={27} y={y(tick)} dy=".35em" textAnchor="end" fill={ink} fontSize={13}>{numberLabel(tick)}</text>
        </g>
      ))}
      <path d="M34 49V120H232" fill="none" stroke={axis} />
      {values.map((row, index) => (
        <rect key={`${row.category}-${row.group}-${index}`} x={x(row.category)! + inner(row.group)!} y={Math.min(y(row.value!), y(0))} width={inner.bandwidth()} height={Math.abs(y(row.value!) - y(0))} fill={colors[groups.indexOf(row.group) % colors.length]}>
          <title>{row.category} · {row.group}：{row.value}</title>
        </rect>
      ))}
      {categories.map((category) => (
        <text key={category} x={x(category)! + x.bandwidth() / 2} y={141} textAnchor="middle" fill={ink} fontSize={13}>{category}</text>
      ))}
      <text x={34} y={164} fill={ink} fontSize={13}>纵轴：{table.columns[valueIndex]}</text>
    </svg>
  );
}

function HeatmapPreview({ template, project }: Preview) {
  const gradientId = useId().replace(/:/g, "");
  const table = project.dataset.tables.find((item) => item.role === "matrix") ?? project.dataset.tables[0];
  if (!table || !table.rows.length || table.columns.length < 2) return null;
  const columns = table.columns.slice(1);
  const rows = table.rows.map((row) => ({
    label: String(row[0] ?? ""),
    values: row.slice(1).map(finiteNumber),
  }));
  if (rows.some((row) => row.values.length !== columns.length || row.values.some((value) => value === undefined))) return null;
  const [minimum = 0, maximum = 0] = extent(rows.flatMap((row) => row.values as number[]));
  const middle = (minimum + maximum) / 2;
  const color = scaleLinear<string>().domain([minimum, middle, maximum]).range([teal, "#f8f3e9", copper]);
  const left = 58, top = 48, width = 170, height = 80;
  const isPathway = columns.every((column) => column.startsWith("代谢通路"));
  const cellWidth = width / columns.length;
  const cellHeight = height / rows.length;
  return (
    <svg className="chart-svg" width={240} height={174} viewBox="0 0 240 174" role="img" aria-label={template.name} style={svgStyle}>
      <title>{template.name}：模板原始模拟矩阵</title>
      <desc>完整展示 {rows.length} 个样本与 {columns.length} 个特征的模拟数值。青绿表示较低值，铜色表示较高值；色标范围为 {numberLabel(minimum)} 至 {numberLabel(maximum)}，未额外标准化或聚类。</desc>
      <defs>
        <linearGradient id={gradientId}>
          <stop offset="0%" stopColor={teal} />
          <stop offset="50%" stopColor="#f8f3e9" />
          <stop offset="100%" stopColor={copper} />
        </linearGradient>
      </defs>
      <text x={120} y={17} textAnchor="middle" fill={ink} fontSize={15} fontWeight={600}>{isPathway ? "代谢通路热图" : template.name}</text>
      {columns.map((column, index) => (
        <text key={column} x={left + (index + 0.5) * cellWidth} y={38} textAnchor="middle" fill={ink} fontSize={13}>
          <title>{column}</title>{isPathway ? column.slice(4) : column}
        </text>
      ))}
      {rows.map((row, rowIndex) => (
        <g key={row.label}>
          <text x={left - 8} y={top + (rowIndex + 0.5) * cellHeight} dy=".35em" textAnchor="end" fill={ink} fontSize={13}>{row.label}</text>
          {row.values.map((value, columnIndex) => (
            <rect key={columnIndex} x={left + columnIndex * cellWidth} y={top + rowIndex * cellHeight} width={cellWidth} height={cellHeight} fill={color(value!)} stroke="#f1f6f5" strokeWidth={1}>
              <title>{row.label} · {columns[columnIndex]}：{value}</title>
            </rect>
          ))}
        </g>
      ))}
      <rect x={left} y={145} width={width} height={7} fill={`url(#${gradientId})`} />
      {[minimum, middle, maximum].map((value, index) => (
        <text key={index} x={left + index * width / 2} y={169} textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"} fill={ink} fontSize={13}>{numberLabel(value)}</text>
      ))}
    </svg>
  );
}

export function ResearchPlate({ templates }: { templates: Template[] }) {
  const previews = useMemo(() => ["pca", "bar-grouped", "heatmap"].flatMap((id) => {
    const template = templates.find((item) => item.id === id);
    return template ? [{ template, project: makeProject(template) }] : [];
  }), [templates]);
  return (
    <figure className="research-figure">
      <div className="research-figure-plots">
        {previews.map((preview) => (
          <a key={preview.template.id} className={`research-plot research-plot-${preview.template.id}`} href={`#template/${preview.template.id}`} aria-label={`查看${preview.template.name}模板`}>
            {preview.template.id === "pca" ? <PcaPreview {...preview} /> : preview.template.id === "bar-grouped" ? <BarPreview {...preview} /> : <HeatmapPreview {...preview} />}
          </a>
        ))}
      </div>
      <figcaption>科研绘图 · 模拟数据示例</figcaption>
    </figure>
  );
}
