import React from "react";
import * as d3 from "d3";
import type { ChartStyle, Project, RendererProps } from "../../core/types";
import { numericScale, sortCategories, useSvgDragPosition } from "./shared";
import { collectData } from "./renderers";
export type Comparison = {
  left: string;
  right: string;
  p: number;
  adjustedP: number;
};
export function comparisonsFor(project: Project): Comparison[] {
  return (
    (project.analysis?.result?.data as { comparisons?: Comparison[] })
      ?.comparisons || []
  );
}
/** Insert-and-absorb compact letter display; every significant pair is separated. */
export function compactLetters(
  comparisons: Comparison[],
  adjusted = true,
  alpha = 0.05,
): Record<string, string> {
  const names = [...new Set(comparisons.flatMap((c) => [c.left, c.right]))];
  if (comparisons.length < (names.length * (names.length - 1)) / 2)
    throw Error("字母分组需要完整的全部两两比较结果。");
  let columns = [new Set(names)];
  for (const p of comparisons) {
    if ((adjusted ? p.adjustedP : p.p) >= alpha) continue;
    columns = columns.flatMap((col) =>
      col.has(p.left) && col.has(p.right)
        ? [
            new Set([...col].filter((v) => v !== p.left)),
            new Set([...col].filter((v) => v !== p.right)),
          ]
        : [col],
    );
    columns = columns.filter(
      (col, i, all) =>
        col.size > 0 &&
        !all.some(
          (other, j) =>
            j !== i &&
            [...col].every((v) => other.has(v)) &&
            (other.size > col.size || j < i),
        ),
    );
  }
  const out = Object.fromEntries(names.map((n) => [n, ""]));
  columns.forEach((col, i) =>
    col.forEach(
      (n) =>
        (out[n] += i < 26 ? String.fromCharCode(97 + i) : "[" + (i + 1) + "]"),
    ),
  );
  return out;
}
export function selectedComparisons(project: Project) {
  const all = comparisonsFor(project),
    selected = project.style.statComparisons as number[] | undefined;
  return selected
    ? all.filter((_, i) => selected.includes(i))
    : all.slice(0, 6);
}
export function statisticsHeight(project: Project) {
  return project.style.showStatistics
    ? project.style.statLabel === "letters"
      ? 38
      : selectedComparisons(project).length *
          Number(project.style.statSpacing || 22) +
        14
    : 0;
}
function MovableStatistic({
  project,
  onLayoutChange,
  id,
  children,
}: RendererProps & { id: string; children: React.ReactNode }) {
  const locations = (project.layout.statistics || {}) as Record<
    string,
    { x: number; y: number }
  >;
  const drag = useSvgDragPosition(
    locations[id] || { x: 0, y: 0 },
    onLayoutChange
      ? (at) =>
          onLayoutChange({
            ...project.layout,
            statistics: { ...locations, [id]: at },
          })
      : undefined,
  );
  return (
    <g
      data-statistic-id={id}
      transform={`translate(${drag.position.x},${drag.position.y})`}
      {...drag.events}
      style={{
        cursor: onLayoutChange ? "move" : "default",
        touchAction: "none",
      }}
    >
      {children}
    </g>
  );
}
export function Statistics({
  project,
  onLayoutChange,
  g,
  s,
}: RendererProps & {
  g: { left: number; top: number; w: number; h: number };
  s: ChartStyle;
}) {
  if (!s.showStatistics) return null;
  const all = comparisonsFor(project);
  if (!all.length) return null;
  const table = project.dataset.tables[0],
    rows = table.rows.map((r) =>
      Object.fromEntries(table.columns.map((c, i) => [c, r[i]])),
    );
  let cats = [...new Set(rows.map((r) => String(r["类别"])))];
  const groups = [...new Set(rows.map((r) => String(r["分组"] || "数据")))];
  const horizontal =
    ["raincloud", "ridgeline"].includes(project.templateId) ||
    s.orientation === "horizontal";
  const dist = [
      "box",
      "box-grouped",
      "violin",
      "raincloud",
      "ridgeline",
    ].includes(project.templateId),
    line = project.templateId === "line-error";
  if (!dist) {
    const data = collectData({ project }, true);
    cats = sortCategories(
      cats,
      data.reduce(
        (map, d) =>
          map.set(
            d.category,
            line ? d.value : (map.get(d.category) || 0) + d.value,
          ),
        new Map<string, number>(),
      ),
      s,
    );
  }
  const band = d3
    .scaleBand()
    .domain(cats)
    .range([0, horizontal ? g.h : g.w])
    .padding(Number(s.barPadding ?? (dist ? 0.3 : 0.25)));
  const inner = d3
    .scaleBand()
    .domain(groups)
    .range([0, band.bandwidth()])
    .padding(dist ? 0.15 : 0.1);
  const point = d3.scalePoint().domain(cats).range([0, g.w]).padding(0.3),
    continuous = numericScale(cats.map(Number), s, "x", [0, g.w]);
  const centers = new Map<string, number>();
  for (const row of rows) {
    const c = String(row["类别"]),
      group = String(row["分组"] || "数据"),
      label = c + (row["分组"] ? " · " + group : "");
    const center = line
      ? s.xScaleType === "linear"
        ? continuous(Number(c))
        : point(c)!
      : (band(c) || 0) +
        (groups.length > 1
          ? (inner(group) || 0) + inner.bandwidth() / 2
          : band.bandwidth() / 2);
    centers.set(label, center);
  }
  const spacing = Number(s.statSpacing || 22),
    height = statisticsHeight(project),
    ink = String(s.statColor || s.textColor);
  const draw = (p: number) =>
    s.statLabel === "p"
      ? (s.statAdjusted !== false ? "校正 P=" : "P=") + d3.format(".3g")(p)
      : p < 0.0001
        ? "****"
        : p < 0.001
          ? "***"
          : p < 0.01
            ? "**"
            : p < Number(s.statAlpha || 0.05)
              ? "*"
              : "不显著";
  if (s.statLabel === "letters") {
    let letters: Record<string, string>;
    try {
      letters = compactLetters(
        all,
        s.statAdjusted !== false,
        Number(s.statAlpha || 0.05),
      );
    } catch (e) {
      return (
        <text x={g.left} y={g.top - 10} fill="#ac3c3c">
          {(e as Error).message}
        </text>
      );
    }
    return (
      <g data-part="statistics" transform={`translate(${g.left},${g.top})`}>
        {Object.entries(letters)
          .filter(([name]) => centers.has(name))
          .map(([name, label]) => (
            <MovableStatistic
              key={name}
              project={project}
              onLayoutChange={onLayoutChange}
              id={"letters:" + name}
            >
              <text
                x={horizontal ? g.w + 12 : centers.get(name)}
                y={horizontal ? centers.get(name) : -12}
                textAnchor={horizontal ? "start" : "middle"}
                fontSize={Number(s.statSize || s.fontSize)}
                fill={ink}
              >
                {label}
              </text>
            </MovableStatistic>
          ))}
      </g>
    );
  }
  return (
    <g
      data-part="statistics"
      transform={`translate(${g.left},${g.top})`}
      fontSize={Number(s.statSize || s.fontSize)}
      fill={ink}
    >
      {selectedComparisons(project).map((p, i) => {
        let a = centers.get(p.left),
          b = centers.get(p.right);
        if (a === undefined || b === undefined) return null;
        const at = -height + spacing * (i + 1),
          side = g.w + (i + 1) * spacing,
          same = Math.abs(a - b) < 0.1;
        // Coincident series at the same X use a labelled comparison to preserve group identity.
        if (same) {
          a -= 8;
          b += 8;
        }
        return (
          <MovableStatistic
            key={p.left + "|" + p.right}
            project={project}
            onLayoutChange={onLayoutChange}
            id={p.left + "|" + p.right}
          >
            <path
              d={
                horizontal
                  ? `M${side - 5},${a}H${side}V${b}H${side - 5}`
                  : `M${a},${at + 5}V${at}H${b}V${at + 5}`
              }
              fill="none"
              stroke={ink}
            />
            {horizontal ? (
              <text
                transform={`translate(${side + 5},${(a + b) / 2}) rotate(90)`}
                textAnchor="middle"
              >
                {draw(s.statAdjusted !== false ? p.adjustedP : p.p)}
              </text>
            ) : (
              <text x={(a + b) / 2} y={at - 4} textAnchor="middle">
                {same ? p.left + " ↔ " + p.right + "：" : ""}
                {draw(s.statAdjusted !== false ? p.adjustedP : p.p)}
              </text>
            )}
          </MovableStatistic>
        );
      })}
    </g>
  );
}
