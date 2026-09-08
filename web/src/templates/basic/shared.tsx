import React from "react";
import { FigureHeading, headingMetrics } from '../../core/FigureHeading';
import { Statistics, statisticsHeight } from "./Statistics";
import * as d3 from "d3";
import type {
  ChartStyle,
  Control,
  DataTable,
  Dataset,
  Issue,
  Project,
  RendererProps,
} from "../../core/types";
export const defaults: Partial<ChartStyle> = {
  width: 960,
  height: 640,
  background: "#ffffff",
  transparent: false,
  marginTop: 82,
  marginRight: 48,
  marginBottom: 105,
  marginLeft: 95,
  title: "科研数据图",
  subtitle: "模拟数据 · 用于演示",
  fontFamily: "Noto Sans SC",
  fontSize: 14,
  titleSize: 24,
  textColor: "#263445",
  palette: ["#087f8c", "#eb8972", "#587ab8", "#b78bc1", "#b9ac62", "#76b7bc"],
  opacity: 0.9,
  showLegend: true,
  showGrid: true,
  showLabels: false,
  xTitle: "",
  yTitle: "数值",
  pointSize: 5,
  lineWidth: 2,
  orientation: "vertical",
  sort: "input",
  barPadding: 0.25,
  axisRotation: 0,
  curve: "linear",
  errorType: "sd",
  errorInput: "raw",
  showPoints: true,
  showBox: true,
  distribution: "kde",
  bandwidthMultiplier: 1,
  normalize: false,
};
export function effective(project: Project): ChartStyle {
  return { ...defaults, ...project.style } as ChartStyle;
}
export const numberControl = (
  key: string,
  label: string,
  min = 0,
  max = 100,
  step = 1,
): Control => ({
  key,
  label,
  type: "number",
  min,
  max,
  step,
  section: "图形细节",
});
export const boolControl = (key: string, label: string): Control => ({
  key,
  label,
  type: "boolean",
  section: "图形细节",
});
export const selectControl = (
  key: string,
  label: string,
  options: [string, string][],
): Control => ({
  key,
  label,
  type: "select",
  options: options.map(([value, label]) => ({ value, label })),
  section: "图形细节",
});
export const commonControls: Control[] = [
  numberControl("axisRotation", "类别刻度旋转（度）", -90, 90, 5),
  selectControl("sort", "类别排序", [
    ["input", "数据顺序"],
    ["ascending", "数值升序"],
    ["descending", "数值降序"],
  ]),
];
export const barControls: Control[] = [
  selectControl("orientation", "绘图方向", [
    ["vertical", "纵向"],
    ["horizontal", "横向"],
  ]),
  numberControl("barPadding", "柱间距比例", 0, 0.8, 0.05),
  numberControl("cornerRadius", "柱角半径", 0, 30),
  numberControl("strokeWidth", "图形描边宽度", 0, 8, 0.5),
  {
    key: "strokeColor",
    label: "图形描边颜色",
    type: "color",
    section: "图形细节",
  },
];
export const lineControls: Control[] = [
  selectControl("curve", "线形", [
    ["linear", "直线"],
    ["smooth", "平滑曲线"],
    ["step", "阶梯线"],
  ]),
  boolControl("dashed", "虚线"),
  boolControl("showPoints", "显示节点"),
  numberControl("pointSize", "节点半径", 1, 20),
];
export const errorControls: Control[] = [
  selectControl("errorInput", "数据含义", [
    ["raw", "原始重复观测"],
    ["summary", "已汇总均值＋标准差＋样本量"],
  ]),
  selectControl("errorType", "误差表示", [
    ["sd", "样本标准差 SD"],
    ["se", "标准误 SE"],
    ["ci", "均值的 95% t 置信区间"],
  ]),
  boolControl("singleSide", "只显示正向误差"),
  numberControl("errorCap", "误差端帽半宽", 0, 20),
  boolControl("showPoints", "显示原始观测"),
];
export function table(
  columns: string[],
  rows: (string | number | null)[][],
  name = "示例数据",
  role = "data",
): Dataset {
  return { tables: [{ id: "data", name, role, columns, rows }] };
}
export function getTable(ds: Dataset, role = "data") {
  return ds.tables.find((t) => t.role === role) || ds.tables[0];
}
export function records(ds: Dataset): Record<string, string | number | null>[] {
  const t = getTable(ds);
  return t
    ? t.rows.map((row) =>
        Object.fromEntries(t.columns.map((c, i) => [c, row[i] ?? null])),
      )
    : [];
}
export function validateColumns(
  ds: Dataset,
  required: string[],
  numeric: string[],
  options: {
    positive?: string[];
    nonnegative?: string[];
    minRows?: number;
  } = {},
): Issue[] {
  const t = getTable(ds);
  if (!t) return [{ message: "请添加一张数据表。" }];
  const issues: Issue[] = [];
  required.forEach((c) => {
    if (!t.columns.includes(c))
      issues.push({
        tableId: t.id,
        message: `缺少必填列“${c}”。请按示例表头命名。`,
      });
  });
  const duplicates = t.columns.filter((x, i) => t.columns.indexOf(x) !== i);
  if (duplicates.length)
    issues.push({
      tableId: t.id,
      message: `列名重复：${[...new Set(duplicates)].join("、")}。`,
    });
  if (t.rows.length < (options.minRows ?? 1))
    issues.push({
      tableId: t.id,
      message: `至少需要 ${options.minRows ?? 1} 行数据。`,
    });
  t.rows.forEach((r, i) => {
    required.forEach((c) => {
      const j = t.columns.indexOf(c);
      if (j < 0) return;
      const v = r[j];
      if (v === null || v === undefined || String(v).trim() === "")
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: j + 1,
          message: `第 ${i + 2} 行“${c}”为空，请填写${numeric.includes(c) ? "数字" : "内容"}。`,
        });
      else if (numeric.includes(c) && !Number.isFinite(Number(v)))
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: j + 1,
          message: `第 ${i + 2} 行“${c}”的“${v}”不是有限数字。请删除单位或其他文字。`,
        });
      else if (options.positive?.includes(c) && Number(v) <= 0)
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: j + 1,
          message: `第 ${i + 2} 行“${c}”必须大于 0。`,
        });
      else if (options.nonnegative?.includes(c) && Number(v) < 0)
        issues.push({
          tableId: t.id,
          row: i + 2,
          column: j + 1,
          message: `第 ${i + 2} 行“${c}”不能小于 0。`,
        });
    });
  });
  return issues;
}
export function optionalNumeric(
  t: DataTable | undefined,
  names: string[],
): Issue[] {
  if (!t) return [];
  return names.flatMap((c) => {
    const j = t.columns.indexOf(c);
    return j < 0
      ? []
      : t.rows.flatMap((r, i) =>
          r[j] !== null && r[j] !== "" && !Number.isFinite(Number(r[j]))
            ? [
                {
                  tableId: t.id,
                  row: i + 2,
                  column: j + 1,
                  message: `第 ${i + 2} 行“${c}”必须是数字。`,
                },
              ]
            : [],
        );
  });
}
export function color(style: ChartStyle, i: number) {
  const names = (style._seriesNames || []) as string[];
  const override = (
    style.seriesStyles as Record<string, Partial<ChartStyle>> | undefined
  )?.[names[i]];
  return String(
    override?.color ||
      style.palette?.[i % (style.palette.length || 1)] ||
      "#087f8c",
  );
}
export function unique(a: string[]) {
  return [...new Set(a)];
}
export function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
export function textWidth(t: string, size: number) {
  return [...t].reduce(
    (a, c) => a + (/[\u2e80-\u9fff]/.test(c) ? size : size * 0.58),
    0,
  );
}
export function wrap(t: string, max: number, size: number): string[] {
  const chars = [...String(t)];
  const lines: string[] = [];
  let line = "";
  for (const c of chars) {
    if (line && textWidth(line + c, size) > max) {
      lines.push(line);
      line = c;
    } else line += c;
  }
  if (line) lines.push(line);
  return lines;
}
export function format(n: number) {
  return Math.abs(n) >= 1e5 || (n !== 0 && Math.abs(n) < 0.001)
    ? d3.format(".2~e")(n)
    : d3.format(".4~g")(n);
}
export function legendRows(style: ChartStyle, items: string[]) {
  let x = 0,
    row = 0;
  const max = style.width - 70;
  const h =
    Math.max(
      style.fontSize,
      ...items.map((label) =>
        num(seriesStyle(style, label).legendSize, style.fontSize),
      ),
    ) + 10;
  return items.map((label, i) => {
    const ss = seriesStyle(style, label),
      w = Math.min(
        max,
        textWidth(
          String(ss.legendLabel || label),
          num(ss.legendSize, style.fontSize),
        ) + 42,
      );
    if (x && x + w > max) {
      row++;
      x = 0;
    }
    const entry = { label, i, x, y: row * h, h };
    x += w;
    return entry;
  });
}
export function geometry(
  style: ChartStyle,
  legend: string[] = [],
  labels: string[] = [],
) {
  const rows = legendRows(style, style.showLegend ? legend : []);
  const lh = rows.length
    ? rows[rows.length - 1].y + rows[rows.length - 1].h + 6
    : 0;
  const labelH = labels.length
    ? Math.max(...labels.map((x) => wrap(x, 85, style.fontSize).length)) *
      style.fontSize *
      1.3
    : 0;
  const left =
      Math.max(62, num(style.marginLeft, 95),
        style.publicationVersion && style.orientation === 'horizontal'
          ? Math.min(style.width * .35, 65 + Math.max(0, ...labels.map(v=>textWidth(v,style.fontSize)))) : 0) +
      ((style._layers || []) as import("../../core/types").Layer[])
        .filter(
          (l) =>
            l.visible &&
            l.type === "basic:category-band" &&
            l.settings.axis === "y",
        )
        .reduce(
          (n, l) => n + num(l.settings.width, 24) + num(l.settings.gap, 8),
          0,
        ),
    right = Math.max(
      24,
      num(style.marginRight, 48),
      style.showRightTitle ? num(style.rightTitleWidth, 30) + 30 : 0,
    );
  const bandLayers = (
      (style._layers || []) as import("../../core/types").Layer[]
    ).filter((l) => l.visible && l.type === "basic:category-band"),
    bandBottom = bandLayers
      .filter((l) => l.settings.axis === "x")
      .reduce(
        (n, l) => n + num(l.settings.width, 24) + num(l.settings.gap, 8) + 4,
        0,
      );
  const titleHeight =
    wrap(style.title, style.width - 70, style.titleSize).length *
      style.titleSize *
      1.25 +
    (style.subtitle
      ? wrap(style.subtitle, style.width - 70, Math.min(style.fontSize, 12))
          .length *
          16 +
        12
      : 0) +
    12;
  const top = Math.max(68, num(style.marginTop, 82), style.publicationVersion ? headingMetrics(style).height : titleHeight),
    bottom =
      Math.max(num(style.marginBottom, 90), labelH + 48) + lh + bandBottom;
  return {
    left,
    right,
    top,
    bottom,
    w: Math.max(80, style.width - left - right),
    h: Math.max(80, style.height - top - bottom),
    legendH: lh,
  };
}

function methodCaption(p: import("../../core/types").Project) {
  const error = p.templateId.includes("error");
  if (!error && !["box", "box-grouped", "violin", "raincloud", "ridgeline"].includes(p.templateId)) return "";
  const rows = records(p.dataset);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = JSON.stringify([r["类别"], r["分组"]]);
    counts.set(key, error && p.style.errorInput === "summary" ? Number(r["样本量"]) : (counts.get(key) || 0) + 1);
  }
  const ns = [...counts.values()];
  if (!ns.length) return "";
  const n = Math.min(...ns) === Math.max(...ns) ? `各组 n = ${ns[0]}` : `各组 n = ${Math.min(...ns)}–${Math.max(...ns)}（不等样本量）`;
  const type = String(p.style.errorType || "sd");
  return error ? `均值 ± ${{sd:"SD",se:"SE",ci:"95% t 置信区间"}[type] || type}；${n}` : n;
}

export function ChartFrame({
  project,
  legend = [],
  labels = [],
  children,
  onLayoutChange,
}: RendererProps & {
  legend?: string[];
  labels?: string[];
  children: (g: ReturnType<typeof geometry>, s: ChartStyle) => React.ReactNode;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const caption = methodCaption(project);
  const s = {
      ...effective(project),
      subtitle: [effective(project).subtitle, caption].filter(Boolean).join(" · "),
      _layers: project.layers,
      _chartId: "basic" + id,
      _clipId: "basic" + id + "-clip",
      _seriesNames: legend.length ? legend : labels,
      marginLeft: project.style.publicationVersion && ["raincloud", "ridgeline"].includes(project.templateId)
        ? Math.max(num(effective(project).marginLeft, 95), Math.min(project.style.width * .35, 65 + Math.max(0, ...records(project.dataset).map(r => textWidth(String(r["类别"] || ""), project.style.fontSize)))))
        : effective(project).marginLeft,
      marginTop:
        num(effective(project).marginTop, 82) +
        (["raincloud", "ridgeline"].includes(project.templateId) ||
        project.style.orientation === "horizontal"
          ? 0
          : statisticsHeight(project)),
      marginRight:
        num(effective(project).marginRight, 48) +
        (["raincloud", "ridgeline"].includes(project.templateId) ||
        project.style.orientation === "horizontal"
          ? statisticsHeight(project)
          : 0),
    } as ChartStyle,
    g = geometry(s, legend, labels);
  const titleLines = wrap(s.title, s.width - 70, s.titleSize);
  const entries = legendRows(s, legend);
  const saved = project.layout?.legend as
    | {
        x: number;
        y: number;
      }
    | undefined;
  const lx = saved?.x ?? 35,
    ly =
      saved?.y ??
      s.height -
        g.legendH +
        Math.max(
          s.fontSize,
          ...entries.map((v) =>
            num(seriesStyle(s, v.label).legendSize, s.fontSize),
          ),
        ) +
        3;
  const legendDrag = useSvgDragPosition(
    { x: lx, y: ly },
    onLayoutChange
      ? (position) => onLayoutChange({ ...project.layout, legend: position })
      : undefined,
    (position) => ({
      x: Math.max(8, Math.min(s.width - 80, position.x)),
      y: Math.max(30, Math.min(s.height - 15, position.y)),
    }),
  );
  return (
    <svg
      data-chart="true"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={s.width}
      height={s.height}
      viewBox={`0 0 ${s.width} ${s.height}`}
      role="img"
      aria-label={s.title || "科研图表"}
      style={{
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        color: s.textColor,
        overflow: "visible",
      }}
    >
      <title>{s.title}</title>
      <defs>
        {Array.from(
          { length: Math.max(legend.length, labels.length, s.palette.length) },
          (_, i) => {
            const ss = seriesStyle(
                s,
                ((s._seriesNames || []) as string[])[i] || "",
              ),
              kind = String(ss.pattern || "none");
            if (kind === "none") return null;
            return (
              <pattern
                key={i}
                id={String(s._chartId) + "-pattern-" + i}
                width={num(ss.patternSpacing, 8)}
                height={num(ss.patternSpacing, 8)}
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(${kind === "diagonal" ? 45 : 0})`}
              >
                <rect
                  width="100%"
                  height="100%"
                  fill={color(s, i)}
                  fillOpacity={num(ss.patternBackgroundOpacity, 0.2)}
                />
                {kind === "dots" ? (
                  <circle
                    cx="3"
                    cy="3"
                    r={num(ss.patternWidth, 1.5)}
                    fill={color(s, i)}
                  />
                ) : (
                  <>
                    <line
                      x1="0"
                      y1="0"
                      x2={num(ss.patternSpacing, 8)}
                      y2="0"
                      stroke={color(s, i)}
                      strokeWidth={num(ss.patternWidth, 1.5)}
                    />
                    {["grid", "crosshatch"].includes(kind) && (
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2={num(ss.patternSpacing, 8)}
                        stroke={color(s, i)}
                        strokeWidth={num(ss.patternWidth, 1.5)}
                      />
                    )}
                  </>
                )}
              </pattern>
            );
          },
        )}
      </defs>
      <defs>
        <marker
          id={String(s._chartId) + "-arrow"}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={num(s.arrowSize, 7)}
          markerHeight={num(s.arrowSize, 7)}
          orient="auto-start-reverse"
        >
          <path d="M0,0L10,5L0,10Z" fill={String(s.axisColor || s.textColor)} />
        </marker>
      </defs>
      {!s.transparent && (
        <rect width={s.width} height={s.height} fill={s.background} />
      )}
      {Boolean(s.titleBackground) && (
        <rect
          x={25}
          y={7}
          width={s.width - 50}
          height={titleLines.length * s.titleSize * 1.25 + 8}
          rx="5"
          fill={String(s.titleBackground)}
        />
      )}
      {s.publicationVersion ? <FigureHeading style={s} /> : <><text
        x={s.width / 2}
        y={s.titleSize + 10}
        textAnchor="middle"
        fontSize={s.titleSize}
        fontWeight={s.titleBold === false ? "400" : "700"}
        fontStyle={s.titleItalic ? "italic" : "normal"}
        fill={String(s.titleColor || s.textColor)}
      >
        {titleLines.map((t, i) => (
          <tspan key={i} x={s.width / 2} dy={i ? s.titleSize * 1.25 : 0}>
            {t}
          </tspan>
        ))}
      </text>
      {s.subtitle && (
        <text
          x={s.width / 2}
          y={
            s.titleSize + 10 + (titleLines.length - 1) * s.titleSize * 1.25 + 20
          }
          textAnchor="middle"
          fill={s.textColor}
          opacity=".65"
          fontSize={Math.min(s.fontSize, 12)}
        >
          {wrap(s.subtitle, s.width - 70, Math.min(s.fontSize, 12)).map(
            (line, i) => (
              <tspan key={i} x={s.width / 2} dy={i ? 16 : 0}>
                {line}
              </tspan>
            ),
          )}
        </text>
      )}
      </>}
      {children(g, s)}
      <Statistics
        project={project}
        onLayoutChange={onLayoutChange}
        g={g}
        s={s}
      />
      {Boolean(s.showRightTitle) && (
        <g
          transform={`translate(${g.left + g.w + num(s.rightTitleWidth, 30) / 2 + 8},${g.top + g.h / 2}) rotate(90)`}
        >
          <rect
            x={-g.h / 2}
            y={-num(s.rightTitleWidth, 30) / 2}
            width={g.h}
            height={num(s.rightTitleWidth, 30)}
            fill={String(s.rightTitleBackground || "#edf2f5")}
          />
          <text
            textAnchor="middle"
            dy=".32em"
            fill={String(s.rightTitleColor || s.textColor)}
            fontSize={num(s.rightTitleSize, s.fontSize)}
          >
            <RichText text={String(s.rightTitleText || "")} />
          </text>
        </g>
      )}
      {s.showLegend && legend.length > 0 && (
        <g
          data-part="legend"
          transform={`translate(${legendDrag.position.x},${legendDrag.position.y})`}
          {...legendDrag.events}
          style={{ cursor: onLayoutChange ? "move" : "default" }}
        >
          {Boolean(s.legendBackground) && (
            <rect
              x="-10"
              y={
                -Math.max(
                  s.fontSize,
                  ...entries.map((v) =>
                    num(seriesStyle(s, v.label).legendSize, s.fontSize),
                  ),
                ) - 5
              }
              width={s.width - 70}
              height={g.legendH}
              rx="4"
              fill={String(s.legendBackground)}
            />
          )}{" "}
          {entries.map((v) => {
            const ss = seriesStyle(s, v.label);
            return (
              <g key={v.label} transform={`translate(${v.x},${v.y})`}>
                {ss.legendShape === "line" ? (
                  <line
                    x1="0"
                    x2="14"
                    y1="-5"
                    y2="-5"
                    stroke={color(s, v.i)}
                    strokeWidth={ss.lineWidth}
                  />
                ) : (
                  <PointGlyph
                    x={6}
                    y={-5}
                    r={5}
                    shape={ss.legendShape || (s.pointShape === 'group' ? ['circle','square','triangle','diamond','cross'][v.i % 5] : "square")}
                    fill={color(s, v.i)}
                    opacity={ss.opacity}
                  />
                )}
                <text
                  x="19"
                  fill={String(ss.legendColor || s.textColor)}
                  fontSize={num(ss.legendSize, s.fontSize)}
                  fontFamily={String(ss.legendFont || s.fontFamily)}
                >
                  {String(ss.legendLabel || v.label)}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
type Scale = {
  (v: any): number | undefined;
  ticks?: (n: number) => number[];
  domain: () => any[];
  bandwidth?: () => number;
};
export function Axes({
  g,
  s,
  x,
  y,
  rightY,
}: {
  g: ReturnType<typeof geometry>;
  s: ChartStyle;
  x: Scale;
  y: Scale;
  horizontal?: boolean;
  rightY?: Scale;
}) {
  const custom = (scale: Scale, key: string) => {
    const raw = String(s[key] || "").trim();
    return raw
      ? raw.split(",").map((v) => (scale.ticks ? Number(v.trim()) : v.trim()))
      : scale.ticks
        ? scale.ticks(num(s.tickCount, 6))
        : scale.domain();
  };
  const xt = custom(x, "xTicks"),
    yt = custom(y, "yTicks"),
    xp = (v: any) => (x(v) ?? 0) + (x.bandwidth?.() ?? 0) / 2,
    yp = (v: any) => (y(v) ?? 0) + (y.bandwidth?.() ?? 0) / 2;
  const top = s.xAxisPosition === "top",
    right = s.yAxisPosition === "right";
  const axisY = (top ? 0 : g.h) + num(s.xAxisOffset),
    axisX = (right ? g.w : 0) + num(s.yAxisOffset),
    rot = num(s.axisRotation),
    yrot = num(s.yAxisRotation),
    tick = num(s.tickLength, 5),
    tc = String(s.axisColor || s.textColor),
    gridOpacity = num(s.gridOpacity, 0.1);
  const valueText = (v: any, key: string) => {
    if (typeof v !== "number") return s._shortGroupTicks ? String(v).split(" · ").slice(1).join(" · ") || String(v) : String(v);
    const spec = String(s[key] || "");
    try {
      return spec ? d3.format(spec)(v) : format(v);
    } catch {
      return format(v);
    }
  };
  const localText = (axis: "x" | "y") => ({
    fontSize: num(s[axis + "TickFontSize"], s.fontSize),
    fill: String(s[axis + "TickColor"] || s.textColor),
    fontWeight: s[axis + "TickBold"] ? "700" : "400",
    fontStyle: s[axis + "TickItalic"] ? "italic" : "normal",
  });
  return (
    <>
      <PlotClip g={g} s={s} x={x} y={y} />
      <g
        data-part="axes"
        transform={`translate(${g.left},${g.top})`}
        fill={s.textColor}
        strokeWidth={num(s.axisLineWidth, 1)}
      >
        {s.showXAxis !== false && (
          <line
            x1="0"
            x2={g.w}
            y1={axisY}
            y2={axisY}
            stroke={tc}
            opacity=".6"
            markerEnd={s.xArrow ? `url(#${s._chartId}-arrow)` : undefined}
          />
        )}
        {s.showYAxis !== false && (
          <line
            x1={axisX}
            x2={axisX}
            y1="0"
            y2={g.h}
            stroke={tc}
            opacity=".6"
            markerStart={s.yArrow ? `url(#${s._chartId}-arrow)` : undefined}
          />
        )}
        {xt
          .filter((v) => Number.isFinite(xp(v)))
          .map((v: any, i: number) => (
            <g key={i} transform={`translate(${xp(v)},0)`}>
              {s.showGrid && x.ticks && (
                <line
                  y2={g.h}
                  stroke={String(s.gridColor || tc)}
                  opacity={gridOpacity}
                />
              )}
              {s.showXAxis !== false && (
                <g transform={`translate(0,${axisY})`}>
                  <line y2={top ? -tick : tick} stroke={tc} />
                  <text
                    y={top ? -12 : 20}
                    textAnchor={rot ? "end" : "middle"}
                    transform={
                      rot ? `rotate(${rot},0,${top ? -12 : 20})` : undefined
                    }
                    {...localText("x")}
                  >
                    {typeof v === "number"
                      ? valueText(v, "xTickFormat")
                      : wrap(
                          valueText(v, "xTickFormat"),
                          Math.max(38, (x.bandwidth?.() ?? 80) - 5),
                          num(s.xTickFontSize, s.fontSize),
                        ).map((t, j) => (
                          <tspan key={j} x="0" dy={j ? s.fontSize * 1.25 : 0}>
                            {t}
                          </tspan>
                        ))}
                  </text>
                </g>
              )}
            </g>
          ))}
        {yt
          .filter((v) => Number.isFinite(yp(v)))
          .map((v: any, i: number) => (
            <g key={i} transform={`translate(0,${yp(v)})`}>
              {s.showGrid && y.ticks && (
                <line
                  x2={g.w}
                  stroke={String(s.gridColor || tc)}
                  opacity={gridOpacity}
                />
              )}
              {s.showYAxis !== false && (
                <g transform={`translate(${axisX},0)`}>
                  <line x2={right ? tick : -tick} stroke={tc} />
                  <text
                    x={right ? 10 : -10}
                    dy=".32em"
                    textAnchor={right ? "start" : "end"}
                    transform={
                      yrot ? `rotate(${yrot},${right ? 10 : -10},0)` : undefined
                    }
                    {...localText("y")}
                  >
                    {typeof v !== 'number' && s.publicationVersion ? wrap(valueText(v,'yTickFormat'), Math.max(30,g.left-55), num(s.yTickFontSize,s.fontSize)).map((line,k,lines)=><tspan x={right ? 10 : -10} dy={k ? s.fontSize*1.2 : -(lines.length-1)*s.fontSize*.6} key={k}>{line}</tspan>) : typeof v === "number"
                      ? valueText(v, "yTickFormat")
                      : valueText(v,"yTickFormat").length > 11
                        ? valueText(v,"yTickFormat").slice(0, 10) + "…"
                        : valueText(v,"yTickFormat")}
                  </text>
                </g>
              )}
            </g>
          ))}
        {s.xTitle && (
          <text
            x={g.w / 2}
            y={
              top
                ? -num(s.xLabelOffset, 43)
                : g.h +
                  num(s.xLabelOffset, Math.max(54, g.bottom - g.legendH - 15))
            }
            textAnchor="middle"
            fontSize={num(s.axisTitleSize, s.fontSize)}
            fontWeight={s.axisTitleBold ? "700" : "400"}
            fontStyle={s.axisTitleItalic ? "italic" : "normal"}
          >
            <RichText text={s.xTitle} />
          </text>
        )}
        {s.yTitle && (
          <text
            transform={`translate(${right ? g.w + num(s.yLabelOffset, 52) : -num(s.yLabelOffset, Math.max(48, g.left - 22))},${g.h / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={num(s.axisTitleSize, s.fontSize)}
            fontWeight={s.axisTitleBold ? "700" : "400"}
            fontStyle={s.axisTitleItalic ? "italic" : "normal"}
          >
            <RichText text={s.yTitle} />
          </text>
        )}
        {rightY && (
          <g transform={`translate(${g.w},0)`}>
            <line y2={g.h} stroke={tc} opacity=".4" />
            {rightY.ticks?.(5).map((v) => (
              <text
                key={v}
                x="9"
                y={rightY(v)}
                dy=".32em"
                fontSize={s.fontSize}
              >
                {format(v)}
              </text>
            ))}
            <text
              transform={`translate(52,${g.h / 2}) rotate(90)`}
              textAnchor="middle"
            >
              {String(s.rightYTitle || "折线数值")}
            </text>
          </g>
        )}
        <CategoryBands g={g} s={s} x={x} y={y} />
        {(x as NumericScale)._break && (
          <path
            d={`M${(x as NumericScale)._break![0] - 2},${axisY - 5}l4,10l5,-10l4,10`}
            fill="none"
            stroke={tc}
            strokeWidth="1.5"
          />
        )}
        {(y as NumericScale)._break && (
          <path
            d={`M${axisX - 5},${(y as NumericScale)._break![0] - 2}l10,4l-10,5l10,4`}
            fill="none"
            stroke={tc}
            strokeWidth="1.5"
          />
        )}
      </g>
    </>
  );
}
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(<su[pb]>.*?<\/su[pb]>)/g)
        .filter(Boolean)
        .map((v, i) =>
          v.startsWith("<sup>") ? (
            <tspan key={i} baselineShift="super" fontSize=".8em">
              {v.slice(5, -6)}
            </tspan>
          ) : v.startsWith("<sub>") ? (
            <tspan key={i} baselineShift="sub" fontSize=".8em">
              {v.slice(5, -6)}
            </tspan>
          ) : (
            <tspan key={i}>{v}</tspan>
          ),
        )}
    </>
  );
}
export function linearDomain(
  values: number[],
  s: ChartStyle,
  axis: "x" | "y",
  zero = false,
): [number, number] {
  let lo = Math.min(...values),
    hi = Math.max(...values);
  if (!values.length) {
    lo = 0;
    hi = 1;
  }
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  } else {
    const pad = (hi - lo) * 0.08;
    if (!zero || lo < 0) lo -= pad;
    hi += pad;
  }
  return [
    typeof s[axis + "Min"] === "number" ? (s[axis + "Min"] as number) : lo,
    typeof s[axis + "Max"] === "number" ? (s[axis + "Max"] as number) : hi,
  ];
}
export function sortCategories(
  categories: string[],
  values: Map<string, number>,
  style: ChartStyle,
) {
  const explicit = String(style.categoryOrder || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => categories.includes(x));
  if (explicit.length) return unique([...explicit, ...categories]);
  return style.sort === "input"
    ? categories
    : [...categories].sort(
        (a, b) =>
          (style.sort === "ascending" ? 1 : -1) *
          ((values.get(a) || 0) - (values.get(b) || 0)),
      );
}

export type NumericScale = d3.ScaleLinear<number, number> & {
  _break?: [number, number];
  _omitted?: [number, number];
};
export function numericScale(
  values: number[],
  style: ChartStyle,
  axis: "x" | "y",
  range: [number, number],
  zero = false,
): NumericScale {
  const mode = String(style[axis + "Scale"] || "linear"),
    log = mode !== "linear";
  let domain = linearDomain(values, style, axis, zero && !log);
  if (log) {
    const positive = values.filter((v) => v > 0);
    const lo = Math.min(...positive),
      hi = Math.max(...positive);
    domain = [
      typeof style[axis + "Min"] === "number"
        ? Number(style[axis + "Min"])
        : lo === hi
          ? lo / 2
          : lo * 0.8,
      typeof style[axis + "Max"] === "number"
        ? Number(style[axis + "Max"])
        : hi * 1.2,
    ];
    if (!domain.every((v) => v > 0 && Number.isFinite(v))) domain = [0.1, 1];
  }
  const scale = (log
    ? d3.scaleLog().base(mode === "log2" ? 2 : 10)
    : d3.scaleLinear()
  )
    .domain(domain)
    .range(range) as unknown as NumericScale;
  const a = num(style[axis + "BreakStart"]),
    b = num(style[axis + "BreakEnd"]);
  if (style[axis + "Break"] && domain[0] < a && a < b && b < domain[1]) {
    const transform = (v: number) => (log ? Math.log(v) : v);
    const before = transform(a) - transform(domain[0]),
      after = transform(domain[1]) - transform(b),
      sign = range[1] > range[0] ? 1 : -1,
      gap = num(style[axis + "BreakGap"], 16),
      available = Math.abs(range[1] - range[0]) - gap,
      edge = range[0] + (sign * available * before) / (before + after);
    scale
      .domain([domain[0], a, b, domain[1]])
      .range([range[0], edge, edge + sign * gap, range[1]]);
    scale._break = [
      Math.min(edge, edge + sign * gap),
      Math.max(edge, edge + sign * gap),
    ];
    scale._omitted = [a, b];
    const ticks = scale.ticks.bind(scale);
    scale.ticks = (n?: number) => ticks(n).filter((v) => v <= a || v >= b);
  }
  return scale;
}
export function seriesStyle(style: ChartStyle, name: string): ChartStyle {
  const overrides = style.seriesStyles as
    | Record<string, Partial<ChartStyle>>
    | undefined;
  return { ...style, ...overrides?.[name] } as ChartStyle;
}
export const symbolNames: [string, string][] = [
  ["circle", "圆形"],
  ["square", "方形"],
  ["triangle", "三角形"],
  ["diamond", "菱形"],
  ["cross", "十字"],
  ["star", "星形"],
  ["wye", "Y 形"],
];
export function symbolType(name: unknown) {
  return (
    {
      name: d3.symbolCircle,
      circle: d3.symbolCircle,
      square: d3.symbolSquare,
      triangle: d3.symbolTriangle,
      diamond: d3.symbolDiamond,
      cross: d3.symbolCross,
      star: d3.symbolStar,
      wye: d3.symbolWye,
    }[String(name)] || d3.symbolCircle
  );
}
export function PointGlyph({
  x = 0,
  y = 0,
  r,
  shape,
  fill,
  opacity = 1,
  stroke = "none",
  strokeWidth = 0,
}: {
  x?: number;
  y?: number;
  r: number;
  shape: unknown;
  fill: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <path
      transform={`translate(${x},${y})`}
      d={d3.symbol(symbolType(shape), Math.PI * r * r)() || ""}
      fill={fill}
      opacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}
export function patternFill(style: ChartStyle, index: number) {
  const names = (style._seriesNames || []) as string[];
  const ss = seriesStyle(style, names[index] || "");
  return ss.pattern && ss.pattern !== "none"
    ? `url(#${style._chartId}-pattern-${index})`
    : color(style, index);
}
export function PlotClip({
  g,
  s,
  x,
  y,
}: {
  g: ReturnType<typeof geometry>;
  s: ChartStyle;
  x: NumericScale | Scale;
  y: NumericScale | Scale;
}) {
  const split = (size: number, gap?: [number, number]) =>
    gap
      ? [
          [0, Math.max(0, gap[0])],
          [Math.min(size, gap[1]), size],
        ]
      : [[0, size]];
  const xx = split(g.w, (x as NumericScale)._break),
    yy = split(g.h, (y as NumericScale)._break);
  return (
    <defs>
      <clipPath id={String(s._clipId)}>
        {xx.flatMap(([a, b], i) =>
          yy.map(([c, d], j) => (
            <rect
              key={i + "-" + j}
              x={a}
              y={c}
              width={Math.max(0, b - a)}
              height={Math.max(0, d - c)}
            />
          )),
        )}
      </clipPath>
    </defs>
  );
}
/** Local preview during a gesture; one completed drag is exactly one project history entry. */
export function useSvgDragPosition(
  position: { x: number; y: number },
  commit?: (position: { x: number; y: number }) => void,
  clamp = (p: { x: number; y: number }) => p,
) {
  const [preview, setPreview] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const gesture = React.useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    start: { x: number; y: number };
    next: { x: number; y: number };
  } | null>(null);
  const pointer = (e: React.PointerEvent<SVGGraphicsElement>) => {
    const parent = e.currentTarget
      .parentElement as unknown as SVGGraphicsElement;
    const ctm = parent?.getScreenCTM?.();
    return ctm
      ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      : null;
  };
  const events = {
    onPointerDown: (e: React.PointerEvent<SVGGraphicsElement>) => {
      if (!commit || e.button !== 0) return;
      const p = pointer(e);
      if (!p) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = {
        pointerId: e.pointerId,
        offsetX: position.x - p.x,
        offsetY: position.y - p.y,
        start: position,
        next: position,
      };
      setPreview(position);
    },
    onPointerMove: (e: React.PointerEvent<SVGGraphicsElement>) => {
      const drag = gesture.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const p = pointer(e);
      if (!p) return;
      drag.next = clamp({ x: p.x + drag.offsetX, y: p.y + drag.offsetY });
      setPreview(drag.next);
    },
    onPointerUp: (e: React.PointerEvent<SVGGraphicsElement>) => {
      const drag = gesture.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      gesture.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      if (
        Math.hypot(drag.next.x - drag.start.x, drag.next.y - drag.start.y) > 0.1
      )
        commit?.(drag.next);
      setPreview(null);
    },
    onPointerCancel: () => {
      gesture.current = null;
      setPreview(null);
    },
  };
  return { position: preview || position, events };
}
export function ValueLabel({
  project,
  onLayoutChange,
  id,
  x,
  y,
  children,
  style,
  anchor = "middle",
}: RendererProps & {
  id: string;
  x: number;
  y: number;
  children: React.ReactNode;
  style: ChartStyle;
  anchor?: "start" | "middle" | "end";
}) {
  const labels = (project.layout.labels || {}) as Record<
    string,
    { x: number; y: number }
  >;
  const drag = useSvgDragPosition(
      labels[id] || { x, y },
      onLayoutChange
        ? (at) =>
            onLayoutChange({
              ...project.layout,
              labels: { ...labels, [id]: at },
            })
        : undefined,
    ),
    at = drag.position;
  return (
    <text
      data-label-id={id}
      stroke="none"
      x={at.x}
      y={at.y}
      textAnchor={anchor}
      fill={String(style.labelColor || style.textColor)}
      fontSize={num(style.labelSize, style.fontSize)}
      fontFamily={String(style.labelFont || style.fontFamily)}
      fontWeight={style.labelBold ? "700" : "400"}
      fontStyle={style.labelItalic ? "italic" : "normal"}
      transform={
        style.labelRotation
          ? `rotate(${num(style.labelRotation)},${at.x},${at.y})`
          : undefined
      }
      style={{
        cursor: onLayoutChange ? "move" : "default",
        touchAction: "none",
      }}
      {...drag.events}
    >
      {children}
    </text>
  );
}

function CategoryBands({
  g,
  s,
  x,
  y,
}: {
  g: ReturnType<typeof geometry>;
  s: ChartStyle;
  x: Scale;
  y: Scale;
}) {
  const layers = (
    (s._layers || []) as import("../../core/types").Layer[]
  ).filter((l) => l.visible && l.type === "basic:category-band");
  let bottom = 52,
    left = -g.left + 8;
  return (
    <g data-part="category-bands">
      {layers.map((l) => {
        const table = l.data?.tables[0];
        if (!table) return null;
        const horizontal = l.settings.axis !== "y",
          scale = horizontal ? x : y;
        if (scale.ticks) return null;
        const width = num(l.settings.width, 24),
          gap = num(l.settings.gap, 8),
          offset = horizontal ? bottom : left;
        if (horizontal) bottom += width + gap;
        else left += width + gap;
        const bw =
          scale.bandwidth?.() ||
          ((horizontal ? g.w : g.h) / scale.domain().length) * 0.9;
        return (
          <g key={l.id} data-layer-id={l.id}>
            {table.rows.map((r, i) => {
              const at = scale(String(r[0]));
              if (at === undefined) return null;
              const pos = at + (scale.bandwidth ? 0 : -bw / 2),
                fill = String(r[1] || color(s, i)),
                label = String(r[2] || "");
              return (
                <g key={i}>
                  <rect
                    x={horizontal ? pos : offset}
                    y={horizontal ? g.h + offset : pos}
                    width={horizontal ? bw : width}
                    height={horizontal ? width : bw}
                    fill={fill}
                    opacity={num(l.settings.opacity, 0.85)}
                  />
                  {label && (
                    <text
                      transform={
                        horizontal
                          ? undefined
                          : `translate(${offset + width / 2},${pos + bw / 2}) rotate(-90)`
                      }
                      x={horizontal ? pos + bw / 2 : 0}
                      y={horizontal ? g.h + offset + width / 2 : 0}
                      dy=".32em"
                      textAnchor="middle"
                      fill={String(l.settings.textColor || "#ffffff")}
                      fontSize={num(l.settings.fontSize, 11)}
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
            <text
              x={horizontal ? -8 : offset + width / 2}
              y={horizontal ? g.h + offset + width / 2 : -10}
              fill={s.textColor}
              fontSize="11"
              textAnchor={horizontal ? "end" : "middle"}
            >
              {l.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
