import React from "react";
import { timeInfo } from "./time";
import { TimeOverlay } from "./TimeOverlay";
import {
  advancedBranchPath,
  SupportLabels,
  BranchLengthLabels,
} from "./branch-style";
import * as d3 from "d3";
import type { ChartStyle, Layer, RendererProps } from "../../core/types";
import { legendRows } from "../basic/shared";
import { boxSummary } from "../basic/math";
import { labelWidth } from "../../core/labelLayout";
import { stateFor, leaves, walk } from "./model";
import {
  branchPath,
  layoutTree,
  type LayoutKind,
  type PositionedNode,
  type TreeGeometry,
} from "./geometry";
import {
  defaultLayerSettings,
  layerRows,
  specFor,
  validateLayer,
} from "./layers";
const num = (n: unknown, f = 0) => (Number.isFinite(Number(n)) ? Number(n) : f);
const color = (s: ChartStyle, i: number) =>
  s.palette[i % s.palette.length] || "#087f8c";
const unique = (a: string[]) => [...new Set(a)];
const rowFor = (layer: Layer, id: string) =>
  layerRows(layer).filter((r) => r.nodeID === id);
const setting = (l: Layer) => ({ ...defaultLayerSettings, ...l.settings });
function valueLabelSpace(layer: Layer) {
  const s = setting(layer);
  if (!s.showValues || !["bar", "category-bar", "lollipop", "category-lollipop"].includes(specFor(layer.type)?.type || "")) return 0;
  return Math.max(0, ...layerRows(layer).map(r => labelWidth(String(r["数值"] ?? ""), num(s.fontSize,12)))) + 8;
}
const font = (s: ChartStyle) => ({
  fontFamily: s.fontFamily,
  fontSize: s.fontSize,
  fill: s.textColor,
});
function Pie({
  rows,
  radius,
  style,
  series,
}: {
  rows: ReturnType<typeof layerRows>;
  radius: number;
  style: ChartStyle;
  series?: string[];
}) {
  const arcs = d3
    .pie<(typeof rows)[number]>()
    .value((r) => num(r["数值"]))
    .sort(null)(rows);
  const draw = d3
    .arc<d3.PieArcDatum<(typeof rows)[number]>>()
    .innerRadius(0)
    .outerRadius(radius);
  return (
    <>
      {arcs.map((a, i) => (
        <path
          key={i}
          d={draw(a) || ""}
          fill={color(
            style,
            series ? series.indexOf(String(a.data["系列"])) : i,
          )}
          stroke="white"
          strokeWidth=".5"
        />
      ))}
    </>
  );
}
function SymbolGlyph({
  shape,
  size,
  color: fill,
}: {
  shape: string;
  size: number;
  color: string;
}) {
  const type =
    shape === "方"
      ? d3.symbolSquare
      : shape === "三角"
        ? d3.symbolTriangle
        : shape === "星"
          ? d3.symbolStar
          : d3.symbolCircle;
  return (
    <path d={d3.symbol(type, Math.PI * size * size)() || ""} fill={fill} />
  );
}
function BoxGlyph({
  values,
  scale,
  height,
  fill,
}: {
  values: number[];
  scale: d3.ScaleLinear<number, number>;
  height: number;
  fill: string;
}) {
  const b = boxSummary(values);
  return (
    <g data-glyph="box">
      <line x1={scale(b.low)} x2={scale(b.high)} stroke={fill} />
      {[b.low, b.high].map((v, i) => (
        <line
          key={i}
          x1={scale(v)}
          x2={scale(v)}
          y1={-height / 4}
          y2={height / 4}
          stroke={fill}
        />
      ))}
      <rect
        x={scale(b.q1)}
        y={-height / 2}
        width={Math.max(0.5, scale(b.q3) - scale(b.q1))}
        height={height}
        fill={fill}
        fillOpacity=".2"
        stroke={fill}
      />
      <line
        x1={scale(b.median)}
        x2={scale(b.median)}
        y1={-height / 2}
        y2={height / 2}
        stroke={fill}
      />
      {b.outliers.map((v, i) => (
        <circle key={i} cx={scale(v)} r="2" fill={fill} />
      ))}
    </g>
  );
}
function TrackGlyph({
  layer,
  tip,
  g,
  offset,
  style,
}: {
  layer: Layer;
  tip: PositionedNode;
  g: TreeGeometry;
  offset: number;
  style: ChartStyle;
}) {
  const spec = specFor(layer.type)!;
  const s = setting(layer),
    rows = rowFor(layer, tip.node.id),
    all = layerRows(layer);
  if (!rows.length) return null;
  const w = num(s.width, 84),
    h =
      g.kind === "circle" && !["box", "category-box"].includes(spec.type)
        ? (((g.inward
            ? g.tipRadius - num(style.labelWidth, 120) - offset - w / 2
            : g.radius + num(style.labelWidth, 120) + offset) *
            num(style.angleRange, 360) *
            Math.PI) /
            180 /
            g.tips.length) *
          0.84
        : Math.min(32, g.rowHeight * 0.68);
  const cols = unique(
    all.map((r) =>
      String(r["列"] || r["系列"] || r["分类"] || r["基序"] || ""),
    ),
  );
  const categoryColor = (r: Record<string, unknown>) =>
    color(
      style,
      cols.indexOf(String(r["分类"] || r["系列"] || r["基序"] || "")),
    );
  const values = all.map((r) => num(r["数值"]));
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const value = d3
    .scaleLinear()
    .domain([min, max])
    .range([3, w - 3]);
  const radial = g.kind === "circle";
  const baseRadius = g.inward
    ? g.tipRadius - num(style.labelWidth, 120) - offset - w
    : g.radius + num(style.labelWidth, 120) + offset;
  const transform =
    g.kind === "normal"
      ? `translate(${g.trackStart + offset},${tip.y})`
      : g.kind === "circle"
        ? `translate(${g.cx},${g.cy}) rotate(${(tip.angle * 180) / Math.PI}) translate(${baseRadius},0)`
        : `translate(${tip.x + Math.cos(tip.angle) * (num(style.labelWidth, 120) + offset)},${tip.y + Math.sin(tip.angle) * (num(style.labelWidth, 120) + offset)}) rotate(${(tip.angle * 180) / Math.PI})`;
  const rectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke?: string,
  ) =>
    radial ? (
      <path
        d={
          d3.arc()({
            innerRadius: baseRadius + x,
            outerRadius: baseRadius + x + width,
            startAngle: Math.PI / 2 + y / baseRadius,
            endAngle: Math.PI / 2 + (y + height) / baseRadius,
          }) || ""
        }
        transform={`translate(${-baseRadius},0)`}
        fill={fill}
        stroke={stroke}
      />
    ) : (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
      />
    );
  let content: React.ReactNode;
  const r = rows[0];
  if (spec.type === "leaf-pie")
    content = (
      <g transform={`translate(${w / 2},0)`}>
        <Pie
          rows={rows}
          radius={Math.min(h / 2, w / 2, num(s.pointSize, 5) * 1.8) - 1}
          style={style}
          series={unique(all.map((r) => String(r["系列"])))}
        />
      </g>
    );
  else if (["bar", "category-bar"].includes(spec.type)) {
    const v = value(num(r["数值"])),
      zero = value(0);
    content = rectangle(
      Math.min(v, zero),
      -h / 2,
      Math.max(0.5, Math.abs(v - zero)),
      h,
      spec.type === "bar" ? String(s.color) : categoryColor(r),
    );
  } else if (["lollipop", "category-lollipop"].includes(spec.type)) {
    const c = spec.type === "lollipop" ? String(s.color) : categoryColor(r);
    content = (
      <>
        <line
          x1={value(0)}
          x2={value(num(r["数值"]))}
          stroke={c}
          strokeWidth={num(s.lineWidth)}
        />
        <circle
          cx={value(num(r["数值"]))}
          r={Math.min(num(s.pointSize), h / 2)}
          fill={c}
        />
      </>
    );
  } else if (spec.type === "stacked-bar") {
    const sums = new Map<string, number>();
    for (const row of all)
      sums.set(
        String(row.nodeID),
        (sums.get(String(row.nodeID)) || 0) + num(row["数值"]),
      );
    const denominator = s.normalize
      ? sums.get(tip.node.id) || 1
      : Math.max(...sums.values(), 1);
    let cursor = 0;
    content = rows.map((row, i) => {
      const width = (num(row["数值"]) / denominator) * w;
      const x = cursor;
      cursor += width;
      return (
        <g key={i}>{rectangle(x, -h / 2, width, h, categoryColor(row))}</g>
      );
    });
  } else if (spec.type === "box")
    content = (
      <BoxGlyph
        values={rows.map((r) => num(r["数值"]))}
        scale={value}
        height={h * 0.8}
        fill={String(s.color)}
      />
    );
  else if (spec.type === "category-box") {
    const groups = unique(rows.map((r) => String(r["分类"])));
    content = groups.map((c, i) => (
      <g
        key={c}
        transform={`translate(0,${-h / 2 + ((i + 0.5) * h) / groups.length})`}
      >
        <BoxGlyph
          values={rows
            .filter((r) => r["分类"] === c)
            .map((r) => num(r["数值"]))}
          scale={value}
          height={(h / groups.length) * 0.7}
          fill={color(style, i)}
        />
      </g>
    ));
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
    const width = w / cols.length;
    const heat = d3
      .scaleSequential(d3.interpolateRgb("#f2f6f7", String(s.color)))
      .domain([Math.min(...values), Math.max(...values) || 1]);
    content = rows.map((row, i) => {
      const x = cols.indexOf(String(row["列"])) * width,
        cx = x + width / 2,
        v = num(row["数值"]);
      return (
        <g key={i}>
          {spec.type === "heatmap" ? (
            rectangle(x, -h / 2, width - num(s.cellPadding), h, heat(v))
          ) : spec.type === "binary1" ? (
            rectangle(
              x + 1,
              -h / 2,
              width - 2,
              h,
              v ? String(s.color) : "none",
              String(s.color),
            )
          ) : spec.type === "binary2" ? (
            v ? (
              <circle
                cx={cx}
                r={Math.min(h, width) * 0.32}
                fill={String(s.color)}
              />
            ) : (
              <path
                d={`M${cx - 3},-3L${cx + 3},3M${cx - 3},3L${cx + 3},-3`}
                stroke={String(s.color)}
              />
            )
          ) : spec.type === "bubble" ? (
            <circle
              cx={cx}
              r={Math.sqrt(Math.max(0, v) / max) * Math.min(h, width) * 0.45}
              fill={String(s.color)}
            />
          ) : (
            <text
              x={cx}
              dy=".32em"
              textAnchor="middle"
              fontSize={num(s.fontSize)}
              fill={
                spec.type === "category-text-matrix"
                  ? color(
                      style,
                      unique(all.map((r) => String(r["分类"]))).indexOf(
                        String(row["分类"]),
                      ),
                    )
                  : String(s.color)
              }
            >
              {String(row["文字"])}
            </text>
          )}
        </g>
      );
    });
  } else if (["motif", "recombination"].includes(spec.type)) {
    const length = Math.max(...rows.map((r) => num(r["序列长度"])), 1);
    content = (
      <>
        <line x1="0" x2={w} stroke="#a7b2ba" />
        {rows.map((row, i) => (
          <g key={i}>
            {rectangle(
              ((num(row["起点"]) - 1) / length) * w,
              -h * 0.28,
              ((num(row["终点"]) - num(row["起点"]) + 1) / length) * w,
              h * 0.56,
              spec.type === "motif"
                ? categoryColor(row)
                : String(row["颜色"] || s.color),
            )}
            {Boolean(s.showValues) && (
              <text
                x={((num(row["起点"]) + num(row["终点"])) / 2 / length) * w}
                y={-h * 0.4}
                textAnchor="middle"
                fontSize={num(s.fontSize)}
              >
                {String(spec.type === "motif" ? row["基序"] : row["起点"])}
              </text>
            )}
          </g>
        ))}
      </>
    );
  }
  return (
    <g
      data-tree-layer={spec.type}
      data-node-id={tip.node.id}
      transform={transform}
      opacity={num(s.opacity, 0.9)}
      strokeWidth={num(s.lineWidth)}
    >
      {content}
      {Boolean(s.showValues) &&
        ["bar", "category-bar", "lollipop", "category-lollipop"].includes(
          spec.type,
        ) && (
          <text
            x={w + 3}
            dy=".32em"
            fontSize={num(s.fontSize)}
            fill={String(s.color)}
          >
            {r["数值"]}
          </text>
        )}
    </g>
  );
}
export function TreeRenderer({ project, onLayoutChange }: RendererProps) {
  let state;
  try {
    state = stateFor(project);
  } catch (e) {
    return (
      <svg
        data-chart="true"
        xmlns="http://www.w3.org/2000/svg"
        width="900"
        height="200"
        viewBox="0 0 900 200"
      >
        <text x="25" y="60" fill="#9e3535">
          {e instanceof Error ? e.message : "树文本无法解析。"}
        </text>
      </svg>
    );
  }
  const root = state.root,
    s = project.style;
  const legend = treeLegend(project);
  const legendPositions = legendRows(
    s,
    legend.map((e) => e.label),
  );
  const legendHeight =
    s.showLegend && legendPositions.length ? legendPositions.at(-1)!.y + 35 : 0;
  const kind = (s.treeLayout ||
    project.templateId.replace("tree-", "")) as LayoutKind;
  const visible = project.layers.filter(
    (l) =>
      l.visible &&
      specFor(l.type) &&
      (kind !== "unrooted" || specFor(l.type)!.unrooted),
  );
  const valid = visible.filter((l) => validateLayer(l, root).length === 0);
  const invalid = visible.filter((l) => validateLayer(l, root).length > 0);
  const tracks = valid.filter((l) => specFor(l.type)!.track);
  let trackWidth = 0;
  const offsets = new Map<string, number>();
  for (const l of tracks) {
    const a = setting(l);
    trackWidth += num(a.gap);
    offsets.set(l.id, trackWidth);
    trackWidth += num(a.width) + valueLabelSpace(l);
  }
  const timing = timeInfo(root, s);
  const g = layoutTree(root, kind, {
    width: s.width,
    height: s.height,
    treeWidth: num(s.treeWidth, 370),
    trackWidth,
    labelWidth: num(s.labelWidth, 125),
    useLength: s.useBranchLength !== false,
    rtl: s.treeDirection === "rtl",
    inward: Boolean(s.inwardTree),
    innerRadius: num(s.innerRadius, 120),
    ...(timing.active
      ? {
          timeAges: timing.ages,
          timeDomain: timing.domain,
          timeIntervals: timing.intervals,
        }
      : {}),
    rotation: num(s.treeRotation, -90),
    angleRange: num(s.angleRange, 360),
    rowHeight: num(s.leafSpacing, 26),
    marginLeft: s.marginLeft,
    marginRight: s.marginRight,
    marginTop: s.marginTop,
    marginBottom: s.marginBottom + legendHeight,
  });
  const map = new Map(g.nodes.map((p) => [p.node.id, p]));
  const allNodes = walk(root);
  const branchColors = new Map<string, string>();
  for (const l of valid.filter((l) => specFor(l.type)!.type === "branch-color"))
    for (const r of layerRows(l)) {
      const node = allNodes.find((n) => n.id === r.nodeID);
      if (node)
        for (const n of l.settings.inherit ? walk(node) : [node])
          branchColors.set(n.id, String(r["颜色"] || s.palette[0]));
    }
  const select = (id: string) =>
    onLayoutChange?.({
      ...project.layout,
      treeState: { ...state, selected: id },
    });
  const getLayer = (type: string, id: string) =>
    valid
      .filter((l) => specFor(l.type)!.type === type)
      .flatMap((l) => rowFor(l, id));
  return (
    <svg
      data-chart="true"
      xmlns="http://www.w3.org/2000/svg"
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={s.title}
      style={{ fontFamily: s.fontFamily }}
    >
      <title>{s.title}</title>
      {!s.transparent && (
        <rect width={g.width} height={g.height} fill={s.background} />
      )}
      <text
        x={g.width / 2}
        y="35"
        textAnchor="middle"
        fontSize={s.titleSize}
        fontWeight="700"
        fill={s.textColor}
      >
        {s.title}
      </text>
      <text
        x={g.width / 2}
        y="58"
        textAnchor="middle"
        fontSize="12"
        fill={s.textColor}
        opacity=".65"
      >
        {s.subtitle}
      </text>
      <TimeOverlay
        g={g}
        info={timing}
        style={{
          ...s,
          marginBottom:
            s.marginBottom +
            legendHeight +
            (valid.some((l) => specFor(l.type)!.type === "geologic") ? 55 : 0),
        }}
      />
      <g
        data-part="branches"
        fill="none"
        strokeLinecap={(s.branchLineCap || "round") as "round"}
      >
        {g.nodes
          .filter((p) => p.parent)
          .map((p) => (
            <path
              key={p.node.id}
              data-node-id={p.node.id}
              d={advancedBranchPath(p, map.get(p.parent!)!, g, s)}
              stroke={
                branchColors.get(p.node.id) ||
                String(s.branchColor || "#536875")
              }
              strokeWidth={
                state.selected === p.node.id
                  ? num(s.lineWidth, 1.5) + 2
                  : num(s.lineWidth, 1.5)
              }
              opacity={num(s.branchOpacity, 1) * s.opacity}
              onClick={() => select(p.node.id)}
              style={{ cursor: "pointer" }}
            />
          ))}
      </g>
      <SupportLabels
        g={g}
        style={s}
        layout={project.layout}
        onLayoutChange={onLayoutChange}
      />
      <BranchLengthLabels
        g={g}
        style={{
          ...s,
          showBranchLengths: Boolean(s.showBranchLengths || s.showLabels),
        }}
        layout={project.layout}
        onLayoutChange={onLayoutChange}
      />
      {g.nodes.map((p) => (
        <g
          key={p.node.id}
          data-part="tree-node"
          data-node-id={p.node.id}
          transform={`translate(${p.x},${p.y})`}
          onClick={() => select(p.node.id)}
          style={{ cursor: "pointer" }}
        >
          <circle
            r={Math.max(2, num(s.nodeSize, 3))}
            fill={
              state.selected === p.node.id
                ? "#eb8972"
                : String(s.nodeColor || "#087f8c")
            }
            opacity={
              s.showNodes === false ||
              (!p.parent &&
                p.node.id.startsWith("重定根_") &&
                s.showRoot === false)
                ? 0
                : 1
            }
          />
          {p.node.collapsed && (
            <>
              <path d="M0,-7L18,0L0,7Z" fill="#a3c6c9" />
              <text x="22" dy=".32em" fontSize="10">
                {leaves(p.node).length} 叶
              </text>
            </>
          )}
          {getLayer("node-symbol", p.node.id).map((r, i) => (
            <g key={i} data-tree-layer="node-symbol">
              <SymbolGlyph
                shape={String(r["形状"])}
                size={num(r["大小"], 5)}
                color={String(r["颜色"] || s.palette[0])}
              />
            </g>
          ))}
          {valid
            .filter(
              (l) =>
                specFor(l.type)!.type === "branch-pie" &&
                rowFor(l, p.node.id).length,
            )
            .map((l) => (
              <g
                data-tree-layer="branch-pie"
                key={l.id}
                opacity={num(l.settings.opacity, 0.9)}
              >
                <Pie
                  rows={rowFor(l, p.node.id)}
                  radius={num(l.settings.pointSize, 8) * 1.8}
                  style={s}
                  series={unique(layerRows(l).map((r) => String(r["系列"])))}
                />
              </g>
            ))}
        </g>
      ))}
      {s.alignLabels !== false && kind !== "unrooted" && (
        <g
          data-part="leaf-guides"
          stroke="#a6b4bc"
          strokeWidth=".7"
          strokeDasharray="2 3"
        >
          {g.tips.map((p) => (
            <line
              key={p.node.id}
              x1={p.x}
              y1={p.y}
              x2={
                kind === "normal"
                  ? g.left + (g.rtl ? 0 : g.treeWidth)
                  : g.cx + g.tipRadius * Math.cos(p.angle)
              }
              y2={
                kind === "normal" ? p.y : g.cy + g.tipRadius * Math.sin(p.angle)
              }
            />
          ))}
        </g>
      )}
      {g.tips.map((p) => {
        let label = p.node.name || p.node.id;
        const rename = getLayer("rename", p.node.id);
        if (rename.length) label = String(rename.at(-1)!.文字);
        label += getLayer("append", p.node.id)
          .map((r) => String(r.文字))
          .join("");
        const superscript = getLayer("superscript", p.node.id)
          .map((r) => String(r.文字))
          .join("");
        const colors = getLayer("label-color", p.node.id);
        const fonts = getLayer("label-font", p.node.id);
        const bg = getLayer("label-background", p.node.id);
        const size = fonts.length
          ? num(fonts.at(-1)!.字号, s.fontSize)
          : s.fontSize;
        const family = fonts.length ? String(fonts.at(-1)!.字体) : s.fontFamily;
        const fill = colors.length
          ? String(colors.at(-1)!.颜色 || s.palette[0])
          : s.textColor;
        const italics = getLayer("italic", p.node.id).map((r) =>
          String(r.文字),
        );
        const chunks = italics.length
          ? label.split(
              new RegExp(
                "(" +
                  italics
                    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                    .join("|") +
                  ")",
                "g",
              ),
            )
          : [label];
        const angle = (p.angle * 180) / Math.PI;
        const flip = kind !== "normal" && Math.cos(p.angle) < 0;
        const x =
          kind === "normal"
            ? s.alignLabels === false
              ? p.x + (g.rtl ? -10 : 10)
              : g.left + (g.rtl ? -10 : g.treeWidth + 10)
            : kind === "circle" && s.alignLabels !== false
              ? g.cx + (g.tipRadius + (g.inward ? -10 : 10)) * Math.cos(p.angle)
              : p.x + Math.cos(p.angle) * (g.inward ? -10 : 10);
        const y =
          kind === "normal"
            ? p.y
            : kind === "circle" && s.alignLabels !== false
              ? g.cy + (g.tipRadius + (g.inward ? -10 : 10)) * Math.sin(p.angle)
              : p.y + Math.sin(p.angle) * (g.inward ? -10 : 10);
        return (
          <g
            key={p.node.id}
            data-part="leaf-label"
            data-node-id={p.node.id}
            transform={`translate(${x},${y}) rotate(${kind === "normal" ? num(s.labelRotation) : angle + (flip ? 180 : 0)})`}
            onClick={() => select(p.node.id)}
          >
            {Boolean(bg.length) && (
              <rect
                x={
                  g.rtl || (g.inward ? !flip : flip)
                    ? -num(s.labelWidth, 125) + 12
                    : -3
                }
                y={-size * 0.75}
                width={Math.min(
                  num(s.labelWidth, 125) - 12,
                  label.length * size,
                )}
                height={size * 1.35}
                fill={String(bg.at(-1)!.颜色)}
                opacity=".35"
              />
            )}
            <text
              textAnchor={
                kind === "normal"
                  ? g.rtl
                    ? "end"
                    : "start"
                  : g.inward
                    ? flip
                      ? "start"
                      : "end"
                    : flip
                      ? "end"
                      : "start"
              }
              dy=".32em"
              fontSize={size}
              fill={fill}
              fontFamily={family}
            >
              {chunks.map((t, i) => (
                <tspan
                  key={i}
                  fontStyle={italics.includes(t) ? "italic" : "normal"}
                >
                  {t}
                </tspan>
              ))}
              {superscript && (
                <tspan baselineShift="super" fontSize=".72em">
                  {superscript}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
      {valid
        .filter((l) => specFor(l.type)!.type === "branch-text")
        .flatMap((l) =>
          layerRows(l).map((r, i) => {
            const p = map.get(String(r.nodeID));
            if (!p) return null;
            const parent = p.parent ? map.get(p.parent) : p;
            return (
              <text
                data-tree-layer="branch-text"
                opacity={num(l.settings.opacity, 0.9)}
                key={l.id + i}
                x={(p.x + parent!.x) / 2 + 4}
                y={(p.y + parent!.y) / 2 - 5}
                fontSize={num(l.settings.fontSize, 12)}
                fill={String(l.settings.color || s.textColor)}
              >
                {r.文字}
              </text>
            );
          }),
        )}
      {valid
        .filter((l) => specFor(l.type)!.type === "node-link")
        .flatMap((l) =>
          layerRows(l).map((r, i) => {
            const a = map.get(String(r.nodeID)),
              b = map.get(String(r["目标节点"]));
            if (!a || !b) return null;
            return (
              <path
                data-tree-layer="node-link"
                key={l.id + i}
                d={
                  kind === "normal"
                    ? `M${a.x},${a.y}Q${Math.max(a.x, b.x) + 40},${(a.y + b.y) / 2} ${b.x},${b.y}`
                    : `M${a.x},${a.y}Q${g.cx},${g.cy} ${b.x},${b.y}`
                }
                fill="none"
                stroke={String(l.settings.color || "#eb8972")}
                strokeWidth={num(r["数值"], 1) * num(l.settings.lineWidth, 1)}
                opacity={num(l.settings.opacity, 0.6)}
              />
            );
          }),
        )}
      {tracks.map((l) => (
        <g key={l.id} data-layer-id={l.id}>
          {g.tips.map((p) => (
            <TrackGlyph
              key={p.node.id}
              layer={l}
              tip={p}
              g={g}
              offset={offsets.get(l.id)!}
              style={s}
            />
          ))}
          {Boolean(l.settings.showTitle ?? true) && (
            <text
              x={
                kind === "normal"
                  ? g.trackStart +
                    offsets.get(l.id)! +
                    num(l.settings.width, 84) / 2
                  : g.cx
              }
              y={
                kind === "normal"
                  ? g.top + 5
                  : g.inward
                    ? g.cy -
                      (g.tipRadius -
                        num(s.labelWidth, 125) -
                        offsets.get(l.id)! -
                        num(l.settings.width, 84)) -
                      12
                    : g.cy -
                      g.radius -
                      num(s.labelWidth, 125) -
                      offsets.get(l.id)! -
                      12
              }
              textAnchor="middle"
              fontSize={num(l.settings.fontSize, 12)}
              fill={String(l.settings.color || s.textColor)}
            >
              {String(l.settings.title || l.name)}
            </text>
          )}
        </g>
      ))}
      {valid
        .filter((l) => specFor(l.type)!.type === "geologic")
        .map((l) => {
          const rows = layerRows(l),
            min = Math.min(...rows.map((r) => num(r["起点"]))),
            max = Math.max(...rows.map((r) => num(r["终点"])));
          const scale = d3
            .scaleLinear()
            .domain([min, max])
            .range([g.left, g.width - 45]);
          return (
            <g
              data-tree-layer="geologic"
              key={l.id}
              transform={`translate(0,${g.height - legendHeight - 46})`}
            >
              {rows.map((r, i) => (
                <g key={i}>
                  <rect
                    x={scale(num(r["起点"]))}
                    width={scale(num(r["终点"])) - scale(num(r["起点"]))}
                    height="20"
                    fill={String(r["颜色"] || color(s, i))}
                  />
                  <text
                    x={(scale(num(r["起点"])) + scale(num(r["终点"]))) / 2}
                    y="14"
                    fontSize="11"
                    textAnchor="middle"
                    fill="white"
                  >
                    {r["文字"]}
                  </text>
                  <text
                    x={scale(num(r["起点"]))}
                    y="35"
                    fontSize="10"
                    fill={s.textColor}
                  >
                    {r["起点"]}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      {s.showLegend && legend.length > 0 && (
        <g
          data-part="tree-legend"
          transform={`translate(35,${g.height - legendHeight + 10})`}
        >
          {legendPositions.map((entry, i) => (
            <g key={i} transform={`translate(${entry.x},${entry.y})`}>
              <rect
                width="12"
                height="12"
                y="-10"
                rx="2"
                fill={legend[i].color}
              />
              <text x="18" fontSize={s.fontSize} fill={s.textColor}>
                {entry.label}
              </text>
            </g>
          ))}
        </g>
      )}
      {invalid.length > 0 && (
        <text x="20" y={g.height - 15} fontSize="12" fill="#ac3c3c">
          {invalid.length} 个图层数据有误，已暂停绘制，请在树图层面板查看。
        </text>
      )}
      {Boolean(s.showScale) && (!timing.active || kind === "unrooted") && (
        <g
          transform={`translate(${g.left},${g.height - legendHeight - (valid.some((l) => specFor(l.type)!.type === "geologic") ? 75 : 25)})`}
        >
          <path d="M0,-4V0H70V-4" fill="none" stroke={s.textColor} />
          <text
            x="35"
            y="-9"
            textAnchor="middle"
            fontSize="10"
            fill={s.textColor}
          >
            {timing.active
              ? (70 / g.timeUnitScale).toPrecision(2) + " " + timing.unit
              : s.useBranchLength === false
                ? "拓扑布局"
                : (
                    (Math.max(...g.nodes.map((n) => n.distance)) * 70) /
                    g.treeWidth
                  ).toPrecision(2) + " 分支长度"}
          </text>
        </g>
      )}
    </svg>
  );
}

function treeLegend(project: RendererProps["project"]) {
  const result: { label: string; color: string }[] = [];
  for (const l of project.layers.filter((l) => l.visible && specFor(l.type))) {
    const rows = layerRows(l);
    const key = rows.some((r) => r["系列"])
      ? "系列"
      : rows.some((r) => r["分类"])
        ? "分类"
        : rows.some((r) => r["基序"])
          ? "基序"
          : "";
    if (!key) continue;
    const groups = unique(rows.map((r) => String(r[key])));
    groups.forEach((group, i) =>
      result.push({
        label: l.name + " · " + group,
        color: String(
          rows.find((r) => r[key] === group)?.["颜色"] ||
            color(project.style, i),
        ),
      }),
    );
  }
  return result;
}
export function requiredTreeCanvas(project: RendererProps["project"]): {
  width: number;
  height: number;
} {
  try {
    const root = stateFor(project).root,
      s = project.style;
    const legendPositions = legendRows(
      s,
      treeLegend(project).map((e) => e.label),
    );
    const legendHeight =
      s.showLegend && legendPositions.length
        ? legendPositions.at(-1)!.y + 35
        : 0;
    const kind = (s.treeLayout ||
      project.templateId.replace("tree-", "")) as LayoutKind;
    const tracks = project.layers.filter(
      (l) =>
        l.visible &&
        specFor(l.type)?.track &&
        (kind !== "unrooted" || specFor(l.type)!.unrooted) &&
        validateLayer(l, root).length === 0,
    );
    const trackWidth = tracks.reduce(
      (a, l) => a + num(l.settings.width, 84) + num(l.settings.gap, 12) + valueLabelSpace(l),
      0,
    );
    const g = layoutTree(root, kind, {
      width: s.width,
      height: s.height,
      treeWidth: num(s.treeWidth, 370),
      trackWidth,
      labelWidth: num(s.labelWidth, 125),
      useLength: s.useBranchLength !== false,
      rtl: s.treeDirection === "rtl",
      inward: Boolean(s.inwardTree),
      innerRadius: num(s.innerRadius, 120),
      rotation: num(s.treeRotation, -90),
      angleRange: num(s.angleRange, 360),
      rowHeight: num(s.leafSpacing, 26),
      marginLeft: s.marginLeft,
      marginRight: s.marginRight,
      marginTop: s.marginTop,
      marginBottom: s.marginBottom + legendHeight,
    });
    return { width: g.width, height: g.height };
  } catch {
    return { width: project.style.width, height: project.style.height };
  }
}
