import React from "react";
import * as d3 from "d3";
import type { RendererProps, ChartStyle } from "../../core/types";
import {
  Axes,
  ChartFrame,
  ValueLabel,
  PointGlyph,
  patternFill,
  seriesStyle,
  symbolType,
  numericScale,
  color,
  effective,
  format,
  linearDomain,
  num,
  records,
  sortCategories,
  unique,
  wrap,
} from "./shared";
import {
  histogramBins,
  boxSummary,
  errorAmount,
  extent,
  gaussianKde,
  jitter,
  mean,
  sampleSd,
  kdeBandwidth,
  kdeDomain,
} from "./math";
type Item = {
  category: string;
  group: string;
  value: number;
  values: number[];
  error: number;
  n: number;
};
export function collectData(props: RendererProps, error = false): Item[] {
  const rows = records(props.project.dataset),
    s = effective(props.project);
  const groups = new Map<string, Item>();
  rows.forEach((r) => {
    const category =
        (r["大组"] ? String(r["大组"]) + " · " : "") +
        String(r["类别"] ?? r["横坐标"] ?? ""),
      group = String(r["分组"] ?? r["系列"] ?? "数据");
    const k = JSON.stringify([category, group]);
    const old = groups.get(k);
    if (error && s.errorInput === "summary") {
      groups.set(k, {
        category,
        group,
        value: num(r["数值"]),
        values: [],
        n: num(r["样本量"]),
        error: errorAmount(
          num(r["标准差"]),
          num(r["样本量"]),
          String(s.errorType),
        ),
      });
      return;
    }
    if (old) old.values.push(num(r["数值"]));
    else
      groups.set(k, {
        category,
        group,
        value: 0,
        values: [num(r["数值"])],
        n: 1,
        error: 0,
      });
  });
  return [...groups.values()].map((v) =>
    v.values.length
      ? {
          ...v,
          n: v.values.length,
          value: error ? mean(v.values) : v.values.reduce((a, b) => a + b, 0),
          error: error
            ? errorAmount(
                sampleSd(v.values),
                v.values.length,
                String(s.errorType),
              )
            : 0,
        }
      : v,
  );
}
export function BarRenderer({
  kind,
  ...props
}: RendererProps & {
  kind: string;
}) {
  const s = effective(props.project),
    isError = kind.includes("error"),
    isPoint = kind === "scatter-error",
    isLollipop = kind.startsWith("lollipop"),
    isStacked = kind.includes("stacked"),
    isGrouped = kind.includes("grouped") || kind.endsWith("category"),
    isCombo = kind === "bar-line";
  const data = collectData(props, isError),
    groups = unique(data.map((d) => d.group));
  let categories = sortCategories(
    unique(data.map((d) => d.category)),
    data.reduce(
      (m, d) => m.set(d.category, (m.get(d.category) || 0) + d.value),
      new Map<string, number>(),
    ),
    s,
  );
  if (kind === "bar-grouped-stacked") {
    const batches = unique(data.map((d) => d.category.split(" · ")[0]));
    categories = batches.flatMap((batch) =>
      categories.filter((c) => c.startsWith(batch + " · ")),
    );
  }
  const groupColors = isGrouped || groups.length > 1;
  const legend = isCombo
    ? [String(s.barLegend || "柱数值"), String(s.lineLegend || "折线数值")]
    : groupColors
      ? groups
      : categories;
  return (
    <ChartFrame {...props} legend={legend} labels={categories}>
      {(g, style) => {
        const horizontal = style.orientation === "horizontal" && !isCombo;
        const stackedPositions = new Map<Item, [number, number]>();
        categories.forEach((c) => {
          const items = data.filter((d) => d.category === c);
          const total = items.reduce((a, d) => a + Math.max(0, d.value), 0);
          let pos = 0,
            neg = 0;
          items.forEach((d) => {
            const v =
              isStacked && style.normalize
                ? (d.value / (total || 1)) * 100
                : d.value;
            if (v >= 0) {
              stackedPositions.set(d, [pos, pos + v]);
              pos += v;
            } else {
              stackedPositions.set(d, [neg, neg + v]);
              neg += v;
            }
          });
        });
        const vals = isStacked
          ? [...stackedPositions.values()].flat()
          : data.flatMap((d) => [d.value - d.error, d.value + d.error, ...(isError && style.showPoints ? d.values : [])]);
        const domain = linearDomain(vals, style, horizontal ? "x" : "y", true);
        const vscale = numericScale(
          vals,
          style,
          horizontal ? "x" : "y",
          horizontal ? [0, g.w] : [g.h, 0],
          true,
        );
        const cat = d3
          .scaleBand<string>()
          .domain(categories)
          .range(horizontal ? [0, g.h] : [0, g.w])
          .padding(num(style.barPadding, 0.25));
        const inner = d3
          .scaleBand<string>()
          .domain(groups)
          .range([0, cat.bandwidth()])
          .padding(0.1);
        const x = horizontal ? vscale : cat,
          y = horizontal ? cat : vscale;
        const rows = records(props.project.dataset),
          right = isCombo
            ? d3
                .scaleLinear()
                .domain(
                  extent(
                    rows.map((r) => num(r["折线数值"])),
                    true,
                  ),
                )
                .nice()
                .range([g.h, 0])
            : undefined;
        const curve = curveFor(String(style.curve));
        const labelNodes: React.ReactNode[] = [];
        return (
          <>
            <Axes
              g={g}
              s={{ ...style, _shortGroupTicks: kind === "bar-grouped-stacked" && Boolean(style.showGroupHeaders) }}
              x={x as any}
              y={y as any}
              rightY={right as any}
            />
            {kind === "bar-grouped-stacked" &&
              Boolean(style.showGroupHeaders) && (
                <g
                  data-part="stack-groups"
                  transform={`translate(${g.left},${g.top})`}
                >
                  {unique(categories.map((c) => c.split(" · ")[0])).map(
                    (batch, i) => {
                      const cs = categories.filter((c) =>
                          c.startsWith(batch + " · "),
                        ),
                        start = cat(cs[0]) || 0,
                        end = (cat(cs.at(-1)!) || 0) + cat.bandwidth(),
                        middle = (start + end) / 2;
                      return (
                        <g key={batch}>
                          <text
                            transform={
                              horizontal
                                ? `translate(${-g.left + 15},${middle}) rotate(-90)`
                                : undefined
                            }
                            x={horizontal ? 0 : middle}
                            y={horizontal ? 0 : -13}
                            textAnchor="middle"
                            fontSize={num(style.groupHeaderSize, 13)}
                            fill={String(
                              style.groupHeaderColor || style.textColor,
                            )}
                            fontWeight="600"
                          >
                            {batch}
                          </text>
                          {horizontal ? (
                            <line
                              x1="0"
                              x2={g.w}
                              y1={end + 3}
                              y2={end + 3}
                              stroke={String(
                                style.groupHeaderColor || style.textColor,
                              )}
                              opacity=".2"
                              strokeDasharray="3 4"
                            />
                          ) : (
                            <line
                              x1={end + 3}
                              x2={end + 3}
                              y1="0"
                              y2={g.h}
                              stroke={String(
                                style.groupHeaderColor || style.textColor,
                              )}
                              opacity=".2"
                              strokeDasharray="3 4"
                            />
                          )}
                        </g>
                      );
                    },
                  )}
                </g>
              )}
            <g
              data-part="marks"
              clipPath={`url(#${style._clipId})`}
              transform={`translate(${g.left},${g.top})`}
            >
              {isStacked &&
                Boolean(style.connectStacks) &&
                categories.slice(1).flatMap((category, ci) =>
                  groups.map((group, gi) => {
                    const before = categories[ci];
                    if (
                      kind === "bar-grouped-stacked" &&
                      !style.connectAcrossGroups &&
                      before.split(" · ")[0] !== category.split(" · ")[0]
                    )
                      return null;
                    const a = data.find(
                        (d) => d.category === before && d.group === group,
                      ),
                      b = data.find(
                        (d) => d.category === category && d.group === group,
                      );
                    if (!a || !b) return null;
                    const av = stackedPositions.get(a)!,
                      bv = stackedPositions.get(b)!,
                      at = (cat(before) || 0) + cat.bandwidth(),
                      bt = cat(category) || 0;
                    const point = (c: number, v: number) =>
                      horizontal ? [vscale(v), c] : [c, vscale(v)];
                    return (
                      <polygon
                        data-part="stack-connection"
                        key={category + group}
                        points={[
                          point(at, av[0]),
                          point(at, av[1]),
                          point(bt, bv[1]),
                          point(bt, bv[0]),
                        ]
                          .map((p) => p.join(","))
                          .join(" ")}
                        fill={color(style, gi)}
                        opacity={num(style.connectionOpacity, 0.22)}
                      />
                    );
                  }),
                )}
              {data.map((d, i) => {
                const pair = isStacked
                  ? stackedPositions.get(d)!
                  : [0, d.value];
                const baseline =
                  style[horizontal ? "xScale" : "yScale"] &&
                  style[horizontal ? "xScale" : "yScale"] !== "linear"
                    ? vscale.domain()[0]
                    : 0;
                const a = vscale(pair[0] === 0 ? baseline : pair[0]),
                  b = vscale(pair[1]);
                const offset =
                    (cat(d.category) || 0) +
                    (isGrouped && !isStacked ? inner(d.group) || 0 : 0),
                  bw =
                    isGrouped && !isStacked
                      ? inner.bandwidth()
                      : cat.bandwidth(),
                  center = offset + bw / 2;
                const ss = seriesStyle(
                    style,
                    groupColors ? d.group : d.category,
                  ),
                  ci = isCombo ? 0 : groupColors ? groups.indexOf(d.group) : i,
                  fill = color(style, ci),
                  paint = patternFill(style, ci),
                  r = num(ss.pointSize, 5);
                const stroke = String(ss.strokeColor || fill);
                return (
                  <g key={i} data-value={d.value} data-category={d.category}>
                    <title>{`${d.category} ${d.group}：${format(d.value)}${isError ? `，${style.errorType}=${format(d.error)}` : ""}`}</title>
                    {isLollipop ? (
                      <>
                        <line
                          x1={horizontal ? vscale(baseline) : center}
                          x2={horizontal ? b : center}
                          y1={horizontal ? center : vscale(baseline)}
                          y2={horizontal ? center : b}
                          stroke={fill}
                          strokeWidth={ss.lineWidth}
                          strokeDasharray={ss.dashed ? "5 4" : undefined}
                        />
                        <PointGlyph
                          x={horizontal ? b : center}
                          y={horizontal ? center : b}
                          r={
                            ss.sizeByValue
                              ? Math.max(
                                  3,
                                  Math.sqrt(
                                    Math.abs(d.value) /
                                      Math.max(
                                        ...data.map((v) => Math.abs(v.value)),
                                        1,
                                      ),
                                  ) *
                                    r *
                                    2,
                                )
                              : r
                          }
                          shape={ss.pointShape}
                          fill={fill}
                          opacity={ss.opacity}
                        />
                      </>
                    ) : isPoint ? (
                      <PointGlyph
                        x={horizontal ? b : center}
                        y={horizontal ? center : b}
                        r={r}
                        shape={ss.pointShape}
                        fill={fill}
                        opacity={ss.opacity}
                      />
                    ) : (
                      <rect
                        x={horizontal ? Math.min(a, b) : offset}
                        y={horizontal ? offset : Math.min(a, b)}
                        width={horizontal ? Math.abs(a - b) : bw}
                        height={horizontal ? bw : Math.abs(a - b)}
                        rx={num(ss.cornerRadius)}
                        fill={paint}
                        opacity={ss.opacity}
                        stroke={stroke}
                        strokeWidth={num(ss.strokeWidth)}
                      />
                    )}{" "}
                    {isError &&
                      Number.isFinite(d.error) &&
                      d.error > 0 &&
                      (() => {
                        const e1 = vscale(
                            style.singleSide ? d.value : d.value - d.error,
                          ),
                          e2 = vscale(d.value + d.error),
                          cap = num(style.errorCap, 5);
                        return horizontal ? (
                          <g
                            stroke={style.textColor}
                            strokeWidth={ss.lineWidth}
                          >
                            <line x1={e1} x2={e2} y1={center} y2={center} />
                            <line
                              x1={e1}
                              x2={e1}
                              y1={center - cap}
                              y2={center + cap}
                            />
                            <line
                              x1={e2}
                              x2={e2}
                              y1={center - cap}
                              y2={center + cap}
                            />
                          </g>
                        ) : (
                          <g
                            stroke={style.textColor}
                            strokeWidth={ss.lineWidth}
                          >
                            <line x1={center} x2={center} y1={e1} y2={e2} />
                            <line
                              x1={center - cap}
                              x2={center + cap}
                              y1={e1}
                              y2={e1}
                            />
                            <line
                              x1={center - cap}
                              x2={center + cap}
                              y1={e2}
                              y2={e2}
                            />
                          </g>
                        );
                      })()}
                    {isError &&
                      Boolean(style.showPoints) &&
                      d.values.map((v, j) => (
                        <circle
                          key={j}
                          cx={
                            horizontal
                              ? vscale(v)
                              : center + jitter(j, i) * bw * 0.6
                          }
                          cy={
                            horizontal
                              ? center + jitter(j, i) * bw * 0.6
                              : vscale(v)
                          }
                          r={Math.max(2, r * 0.55)}
                          fill={style.textColor}
                          opacity=".5"
                        />
                      ))}
                    {style.showLabels &&
                      (labelNodes.push(
                        <ValueLabel
                          key={d.category + ":" + d.group}
                          {...props}
                          id={"bar:" + d.category + ":" + d.group}
                          x={horizontal ? (isStacked ? b : vscale(d.value + (isError ? (d.value < 0 ? -d.error : d.error) : 0))) + (d.value < 0 ? -7 : 7) : center}
                          y={horizontal ? center : (isStacked ? b : vscale(d.value + (isError ? (d.value < 0 ? -d.error : d.error) : 0))) + (d.value < 0 ? 18 : -8)}
                          anchor={
                            horizontal
                              ? d.value < 0
                                ? "end"
                                : "start"
                              : "middle"
                          }
                          style={ss}
                        >
                          {format(
                            isStacked && style.normalize
                              ? pair[1] - pair[0]
                              : d.value,
                          )}
                          {isStacked && style.normalize ? "%" : ""}
                        </ValueLabel>,
                      ),
                      null)}
                  </g>
                );
              })}
              {right && (
                <>
                  <path
                    d={
                      d3
                        .line<Record<string, any>>()
                        .x(
                          (r) =>
                            (cat(String(r["类别"])) || 0) + cat.bandwidth() / 2,
                        )
                        .y((r) => right(num(r["折线数值"])))
                        .curve(curve)(rows) || ""
                    }
                    fill="none"
                    stroke={color(style, 1)}
                    strokeWidth={style.lineWidth}
                    strokeDasharray={style.dashed ? "6 4" : undefined}
                  />
                  {Boolean(style.showPoints) &&
                    rows.map((r, i) => (
                      <circle
                        key={i}
                        cx={(cat(String(r["类别"])) || 0) + cat.bandwidth() / 2}
                        cy={right(num(r["折线数值"]))}
                        r={style.pointSize}
                        fill={color(style, 1)}
                      />
                    ))}
                </>
              )}
            </g>
            <g
              data-part="value-labels"
              transform={`translate(${g.left},${g.top})`}
            >
              {labelNodes}
            </g>
          </>
        );
      }}
    </ChartFrame>
  );
}
export function LineRenderer({
  error = false,
  ...props
}: RendererProps & { error?: boolean }) {
  const data = collectData(props, error),
    s = effective(props.project),
    groups = unique(data.map((d) => d.group)),
    cats = sortCategories(
      unique(data.map((d) => d.category)),
      new Map(data.map((d) => [d.category, d.value])),
      s,
    );
  return (
    <ChartFrame {...props} legend={groups} labels={cats}>
      {(g, style) => {
        const labelNodes: React.ReactNode[] = [];
        const numeric = style.xScaleType === "linear",
          xb = d3.scalePoint().domain(cats).range([0, g.w]).padding(0.3),
          xl = numericScale(
            data.map((d) => num(d.category)),
            style,
            "x",
            [0, g.w],
          ),
          xx = (c: string) => (numeric ? xl(Number(c)) : xb(c) || 0),
          y = numericScale(
            data.flatMap((d) => [d.value - d.error, d.value + d.error]),
            style,
            "y",
            [g.h, 0],
          );
        return (
          <>
            <Axes g={g} s={style} x={(numeric ? xl : xb) as any} y={y} />
            <g
              data-part="marks"
              clipPath={`url(#${style._clipId})`}
              transform={`translate(${g.left},${g.top})`}
            >
              {groups.map((group, i) => {
                const ss = seriesStyle(style, group);
                let a = data.filter((d) => d.group === group);
                if (numeric)
                  a = [...a].sort((p, q) => num(p.category) - num(q.category));
                const curve = curveFor(String(ss.curve));
                const path = d3
                  .line<Item>()
                  .x((d) => xx(d.category))
                  .y((d) => y(d.value))
                  .curve(curve);
                return (
                  <g key={group}>
                    {Boolean(ss.fillArea) && (
                      <path
                        data-part="line-area"
                        d={
                          d3
                            .area<Item>()
                            .x((d) => xx(d.category))
                            .y0(
                              y(
                                style.yScale && style.yScale !== "linear"
                                  ? y.domain()[0]
                                  : Math.max(0, y.domain()[0]),
                              ),
                            )
                            .y1((d) => y(d.value))
                            .curve(curve)(a) || ""
                        }
                        fill={patternFill(style, i)}
                        opacity={num(ss.areaOpacity, 0.2)}
                      />
                    )}
                    <path
                      d={path(a) || ""}
                      fill="none"
                      stroke={color(style, i)}
                      strokeWidth={ss.lineWidth}
                      opacity={ss.opacity}
                      strokeDasharray={ss.dashed ? "6 4" : undefined}
                    />
                    {a.map((d, j) => (
                      <g
                        key={j}
                        transform={`translate(${xx(d.category)},${y(d.value)})`}
                      >
                        <title>
                          {group + " · " + d.category + "：" + format(d.value)}
                        </title>
                        {error && d.error > 0 && (
                          <g
                            stroke={String(ss.errorColor || color(style, i))}
                            strokeWidth={num(ss.errorWidth, ss.lineWidth)}
                          >
                            <line
                              y1={
                                ss.singleSide
                                  ? 0
                                  : y(d.value - d.error) - y(d.value)
                              }
                              y2={y(d.value + d.error) - y(d.value)}
                            />
                            {[-1, 1]
                              .filter((v) => !ss.singleSide || v > 0)
                              .map((v) => (
                                <line
                                  key={v}
                                  x1={-num(ss.errorCap, 5)}
                                  x2={num(ss.errorCap, 5)}
                                  y1={y(d.value + v * d.error) - y(d.value)}
                                  y2={y(d.value + v * d.error) - y(d.value)}
                                />
                              ))}
                          </g>
                        )}
                        {Boolean(ss.showPoints) && (
                          <PointGlyph
                            r={ss.pointSize}
                            shape={ss.pointShape}
                            fill={color(style, i)}
                            opacity={ss.opacity}
                          />
                        )}{" "}
                        {style.showLabels &&
                          (labelNodes.push(
                            <g
                              key={group + ":" + d.category}
                              transform={`translate(${xx(d.category)},${y(d.value)})`}
                            >
                              <ValueLabel
                                {...props}
                                id={"line:" + group + ":" + d.category}
                                x={0}
                                y={-12}
                                style={ss}
                              >
                                {format(d.value)}
                              </ValueLabel>
                            </g>,
                          ),
                          null)}
                      </g>
                    ))}
                  </g>
                );
              })}
            </g>
            <g
              data-part="value-labels"
              transform={`translate(${g.left},${g.top})`}
            >
              {labelNodes}
            </g>
          </>
        );
      }}
    </ChartFrame>
  );
}
export function curveFor(type: string): d3.CurveFactory {
  return (
    (
      {
        linear: d3.curveLinear,
        smooth: d3.curveMonotoneX,
        step: d3.curveStepAfter,
        basis: d3.curveBasis,
        cardinal: d3.curveCardinal,
        catmull: d3.curveCatmullRom,
        natural: d3.curveNatural,
        stepBefore: d3.curveStepBefore,
        stepCenter: d3.curveStep,
      } as Record<string, d3.CurveFactory>
    )[type] || d3.curveLinear
  );
}
export function ScatterRenderer(props: RendererProps) {
  const a = records(props.project.dataset),
    groups = unique(a.map((r) => String(r["分组"] || "数据")));
  const result = props.project.analysis?.result as
    | {
        data?: {
          series?: {
            name: string;
            curve: {
              x: number;
              y: number;
              lower?: number;
              upper?: number;
            }[];
          }[];
        };
      }
    | undefined;
  const series = result?.data?.series || [];
  const curves = series.flatMap((v) => v.curve);
  return (
    <ChartFrame {...props} legend={groups}>
      {(g, s) => {
        const labelNodes: React.ReactNode[] = [];
        const x = numericScale(
          a.map((r) => num(r["横坐标"])),
          s,
          "x",
          [0, g.w],
        );
        const y = numericScale(
          [
            ...a.map((r) => num(r["纵坐标"])),
            ...curves.flatMap((v) =>
              [v.y, v.lower, v.upper].filter(
                (x): x is number => typeof x === "number" && Number.isFinite(x),
              ),
            ),
          ],
          s,
          "y",
          [g.h, 0],
        );
        return (
          <>
            <Axes g={g} s={s} x={x as any} y={y as any} />
            <g
              data-part="marks"
              clipPath={`url(#${s._clipId})`}
              transform={`translate(${g.left},${g.top})`}
            >
              {series.map((series, i) => (
                <g data-part="regression" key={series.name}>
                  {s.showConfidence !== false && (
                    <path
                      d={
                        d3
                          .area<{
                            x: number;
                            y: number;
                            lower?: number;
                            upper?: number;
                          }>()
                          .defined(
                            (v) =>
                              Number.isFinite(v.lower) &&
                              Number.isFinite(v.upper),
                          )
                          .x((v) => x(v.x))
                          .y0((v) => y(v.lower!))
                          .y1((v) => y(v.upper!))(series.curve) || ""
                      }
                      fill={color(s, Math.max(0, groups.indexOf(series.name)))}
                      fillOpacity={0.16}
                    />
                  )}
                  <path
                    d={
                      d3
                        .line<{
                          x: number;
                          y: number;
                        }>()
                        .defined(
                          (v) => Number.isFinite(v.x) && Number.isFinite(v.y),
                        )
                        .x((v) => x(v.x))
                        .y((v) => y(v.y))(series.curve) || ""
                    }
                    fill="none"
                    stroke={color(s, Math.max(0, groups.indexOf(series.name)))}
                    strokeWidth={s.lineWidth}
                  />
                </g>
              ))}
              {a.map((r, i) => {
                const v = String(r["分组"] || "数据"),
                  ss = seriesStyle(s, v),
                  symbol = symbolType(ss.pointShape),
                  size =
                    s.sizeByValue && r["大小"] != null
                      ? Math.sqrt(Math.max(0, num(r["大小"]))) * ss.pointSize
                      : ss.pointSize;
                return (
                  <g
                    key={i}
                    transform={`translate(${x(num(r["横坐标"]))},${y(num(r["纵坐标"]))})`}
                  >
                    <path
                      d={
                        d3
                          .symbol()
                          .type(symbol)
                          .size(Math.PI * size * size)() || ""
                      }
                      fill={color(s, groups.indexOf(v))}
                      opacity={ss.opacity}
                      stroke={String(ss.strokeColor || "none")}
                      strokeWidth={num(ss.strokeWidth)}
                    />
                    <title>{`${r["名称"] || i + 1}：(${r["横坐标"]}, ${r["纵坐标"]})`}</title>
                    {s.showLabels &&
                      (labelNodes.push(
                        <g
                          key={i}
                          transform={`translate(${x(num(r["横坐标"]))},${y(num(r["纵坐标"]))})`}
                        >
                          <ValueLabel
                            {...props}
                            id={"scatter:" + String(r["名称"] || i + 1)}
                            x={size + 4}
                            y={-5}
                            anchor="start"
                            style={ss}
                          >
                            {String(r["名称"] || i + 1)}
                          </ValueLabel>
                        </g>,
                      ),
                      null)}
                  </g>
                );
              })}
            </g>
            <g
              data-part="value-labels"
              transform={`translate(${g.left},${g.top})`}
            >
              {labelNodes}
            </g>
          </>
        );
      }}
    </ChartFrame>
  );
}
export function PieRenderer({
  rose = false,
  ...props
}: RendererProps & {
  rose?: boolean;
}) {
  const a = records(props.project.dataset),
    names = a.map((r) => String(r["类别"]));
  return (
    <ChartFrame {...props} legend={names}>
      {(g, s) => {
        const radius = Math.max(
            30,
            Math.min(g.w, g.h) / 2 - (s.showLabels ? 35 : 10),
          ),
          inner = radius * num(s.innerRadius, 0.35),
          total = a.reduce((v, r) => v + num(r["数值"]), 0);
        const pie = d3
          .pie<Record<string, any>>()
          .value((r) => (rose ? 1 : num(r["数值"])))
          .sort((a, b) =>
            s.sort === "input"
              ? 0
              : (s.sort === "ascending" ? 1 : -1) *
                (num(a["数值"]) - num(b["数值"])),
          )
          .startAngle((num(s.startAngle) * Math.PI) / 180)
          .endAngle(((num(s.startAngle) + 360) * Math.PI) / 180)
          .padAngle(num(s.slicePadding, 0.015));
        const slices = pie(a),
          max = Math.max(...a.map((r) => num(r["数值"])), 1);
        const radial = (v: number) => Math.sqrt(inner * inner + (radius * radius - inner * inner) * v / max);
        return (
          <g
            data-part="marks"
            transform={`translate(${g.left + g.w / 2},${g.top + g.h / 2})`}
          >
            {rose &&
              s.showGrid &&
              d3.ticks(0, max, 4).map((v) => (
                <g key={v}>
                  <circle
                    r={radial(v)}
                    fill="none"
                    stroke={s.textColor}
                    opacity=".15"
                  />
                  <text
                    y={-radial(v) - 3}
                    textAnchor="middle"
                    fill={s.textColor}
                    fontSize={11}
                  >
                    {format(v)}
                  </text>
                </g>
              ))}
            {slices.map((d, i) => {
              const ss = seriesStyle(s, String(d.data["类别"]));
              const rr = rose ? radial(num(d.data["数值"])) : radius;
              const arc = d3
                .arc<d3.PieArcDatum<Record<string, any>>>()
                .innerRadius(inner)
                .outerRadius(rr)
                .cornerRadius(num(ss.cornerRadius));
              const labelArc = d3
                .arc<d3.PieArcDatum<Record<string, any>>>()
                .innerRadius(rr + 15)
                .outerRadius(rr + 15);
              const [x, y] = labelArc.centroid(d);
              const polar = (angle: number, r: number) => [
                Math.sin(angle) * r,
                -Math.cos(angle) * r,
              ];
              const mid = (d.startAngle + d.endAngle) / 2,
                aa = polar(mid, inner),
                bb = polar(d.startAngle, (inner + rr) / 2),
                cc = polar(mid, rr),
                dd = polar(d.endAngle, (inner + rr) / 2);
              const rosePath =
                s.roseShape === "diamond"
                  ? `M${aa}L${bb}L${cc}L${dd}Z`
                  : s.roseShape === "flower"
                    ? `M${aa}C${polar(d.startAngle, rr * 0.9)},${polar(d.startAngle, rr)},${cc}C${polar(d.endAngle, rr)},${polar(d.endAngle, rr * 0.9)},${aa}Z`
                    : arc(d) || "";
              return (
                <g key={i}>
                  <path
                    d={rose ? rosePath : arc(d) || ""}
                    fill={patternFill(s, names.indexOf(String(d.data["类别"])))}
                    opacity={ss.opacity}
                    stroke={String(ss.strokeColor || s.background)}
                    strokeWidth={num(ss.strokeWidth, 1)}
                  />
                  <title>{`${d.data["类别"]}：${d.data["数值"]}（${format((num(d.data["数值"]) / (total || 1)) * 100)}%）`}</title>
                  {s.showLabels && (
                    <ValueLabel
                      {...props}
                      id={"pie:" + String(d.data["类别"])}
                      x={x}
                      y={y}
                      anchor={
                        Math.abs(x) < 5 ? "middle" : x > 0 ? "start" : "end"
                      }
                      style={ss}
                    >
                      {s.percentLabels && !rose
                        ? format((num(d.data["数值"]) / total) * 100) + "%"
                        : String(d.data["类别"])}
                    </ValueLabel>
                  )}
                </g>
              );
            })}
          </g>
        );
      }}
    </ChartFrame>
  );
}
export function RadarRenderer(props: RendererProps) {
  const a = records(props.project.dataset),
    cats = unique(a.map((r) => String(r["类别"]))),
    groups = unique(a.map((r) => String(r["分组"] || "数据")));
  return (
    <ChartFrame {...props} legend={groups}>
      {(g, s) => {
        const radius = Math.max(30, Math.min(g.w, g.h) / 2 - 42),
          r = d3
            .scaleLinear()
            .domain([
              typeof s.yMin === "number" ? s.yMin : 0,
              typeof s.yMax === "number"
                ? s.yMax
                : Math.max(...a.map((v) => num(v["数值"]))) * 1.1,
            ])
            .range([0, radius]);
        const angle = (i: number) =>
            (i / cats.length) * 2 * Math.PI +
            (num(s.startAngle, -90) * Math.PI) / 180,
          point = (i: number, v: number) => [
            Math.cos(angle(i)) * v,
            Math.sin(angle(i)) * v,
          ];
        return (
          <g
            data-part="marks"
            transform={`translate(${g.left + g.w / 2},${g.top + g.h / 2})`}
          >
            {s.showGrid &&
              r.ticks(num(s.radarTickCount, 5)).map((v) => (
                <g key={v}>
                  {s.radarGrid === "circle" ? (
                    <circle
                      r={r(v)}
                      fill="none"
                      stroke={s.textColor}
                      opacity=".15"
                    />
                  ) : (
                    <polygon
                      points={cats
                        .map((_, i) => point(i, r(v)).join(","))
                        .join(" ")}
                      fill="none"
                      stroke={s.textColor}
                      opacity=".15"
                    />
                  )}
                  <text y={-r(v) - 2} x="4" fill={s.textColor} fontSize="10">
                    {format(v)}
                  </text>
                </g>
              ))}
            {cats.map((c, i) => {
              const [x, y] = point(i, radius + 19),
                [xx, yy] = point(i, radius);
              return (
                <g key={c}>
                  <line x2={xx} y2={yy} stroke={s.textColor} opacity=".2" />
                  <text
                    x={x}
                    y={y}
                    textAnchor={
                      Math.abs(x) < 5 ? "middle" : x > 0 ? "start" : "end"
                    }
                    dy=".32em"
                    fill={s.textColor}
                  >
                    {wrap(c, 75, s.fontSize).map((t, j) => (
                      <tspan x={x} dy={j ? s.fontSize * 1.2 : 0} key={j}>
                        {t}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
            {groups.map((group, i) => {
              const ss = seriesStyle(s, group),
                vals = cats.map((c) =>
                  num(
                    a.find(
                      (v) =>
                        String(v["类别"]) === c &&
                        String(v["分组"] || "数据") === group,
                    )?.["数值"],
                  ),
                );
              return (
                <g key={group}>
                  <polygon
                    points={vals
                      .map((v, j) => point(j, r(v)).join(","))
                      .join(" ")}
                    fill={patternFill(s, i)}
                    fillOpacity={num(ss.areaOpacity, 0.14)}
                    stroke={color(s, i)}
                    strokeWidth={ss.lineWidth}
                    opacity={ss.opacity}
                    strokeDasharray={ss.dashed ? "6 4" : undefined}
                  />
                  {vals.map((v, j) => {
                    const [x, y] = point(j, r(v));
                    return (
                      <g key={j}>
                        {ss.showPoints !== false && (
                          <PointGlyph
                            x={x}
                            y={y}
                            r={ss.pointSize}
                            shape={ss.pointShape}
                            fill={color(s, i)}
                            opacity={ss.opacity}
                          />
                        )}{" "}
                        {s.showLabels && (
                          <ValueLabel
                            {...props}
                            id={"radar:" + group + ":" + cats[j]}
                            x={x + 5}
                            y={y - 5}
                            style={ss}
                          >
                            {format(v)}
                          </ValueLabel>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      }}
    </ChartFrame>
  );
}
export function DumbbellRenderer(props: RendererProps) {
  const a = records(props.project.dataset),
    cats = sortCategories(
      a.map((r) => String(r["类别"])),
      new Map(
        a.map((r) => [String(r["类别"]), num(r["终点"]) - num(r["起点"])]),
      ),
      effective(props.project),
    ),
    names = [
      String(effective(props.project).startLabel || "起点"),
      String(effective(props.project).endLabel || "终点"),
    ];
  return (
    <ChartFrame {...props} legend={names}>
      {(g, s) => {
        const x = numericScale(
            a.flatMap((r) => [num(r["起点"]), num(r["终点"])]),
            s,
            "x",
            [0, g.w],
          ),
          y = d3.scaleBand().domain(cats).range([0, g.h]).padding(0.4),
          labelNodes: React.ReactNode[] = [];
        return (
          <>
            <Axes g={g} s={s} x={x} y={y as any} />
            <g
              data-part="marks"
              clipPath={`url(#${s._clipId})`}
              transform={`translate(${g.left},${g.top})`}
            >
              {a.map((r, i) => {
                const cy = (y(String(r["类别"])) || 0) + y.bandwidth() / 2;
                return (
                  <g key={i}>
                    <line
                      x1={x(num(r["起点"]))}
                      x2={x(num(r["终点"]))}
                      y1={cy}
                      y2={cy}
                      stroke={String(s.connectorColor || "#9aaabb")}
                      strokeWidth={s.lineWidth}
                      strokeDasharray={s.dashed ? "6 4" : undefined}
                    />
                    {["起点", "终点"].map((v, j) => {
                      const ss = seriesStyle(s, names[j]);
                      return (
                        <g key={v}>
                          <PointGlyph
                            x={x(num(r[v]))}
                            y={cy}
                            r={ss.pointSize}
                            shape={ss.pointShape}
                            fill={color(s, j)}
                            opacity={ss.opacity}
                          />
                          {s.showLabels &&
                            (labelNodes.push(
                              <ValueLabel
                                key={i + ":" + v}
                                {...props}
                                id={"dumbbell:" + r["类别"] + ":" + v}
                                x={x(num(r[v]))}
                                y={cy + (j ? -10 : 20)}
                                style={ss}
                              >
                                {format(num(r[v]))}
                              </ValueLabel>,
                            ),
                            null)}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
            <g
              data-part="value-labels"
              transform={`translate(${g.left},${g.top})`}
            >
              {labelNodes}
            </g>
          </>
        );
      }}
    </ChartFrame>
  );
}
export function DistributionRenderer({
  kind,
  ...props
}: RendererProps & {
  kind: string;
}) {
  const s = effective(props.project),
    rows = records(props.project.dataset);
  const groupNames = unique(rows.map((r) => String(r["分组"] || "数据")));
  const cats = unique(rows.map((r) => String(r["类别"])));
  const sets = cats
    .flatMap((category) =>
      groupNames.map((group) => ({
        category,
        group,
        values: rows
          .filter(
            (r) =>
              String(r["类别"]) === category &&
              String(r["分组"] || "数据") === group,
          )
          .map((r) => num(r["数值"])),
      })),
    )
    .filter((d) => d.values.length);
  const horizontal =
    ["ridgeline", "raincloud"].includes(kind) || s.orientation === "horizontal";
  return (
    <ChartFrame
      {...props}
      legend={groupNames.length > 1 ? groupNames : cats}
      labels={horizontal ? [] : cats}
    >
      {(g, style) => {
        const axisValues = rows.map((r) => num(r["数值"]));
        if (
          !kind.startsWith("box") &&
          style.distribution !== "histogram" &&
          style.trim === false
        )
          for (const entry of sets)
            axisValues.push(...kdeDomain(entry.values, false));
        const numeric = numericScale(
          axisValues,
          style,
          horizontal ? "x" : "y",
          horizontal ? [0, g.w] : [g.h, 0],
        );
        const cat = d3
          .scaleBand()
          .domain(cats)
          .range(horizontal ? [0, g.h] : [0, g.w])
          .padding(num(style.barPadding, 0.3));
        const band = d3
          .scaleBand()
          .domain(groupNames)
          .range([0, cat.bandwidth()])
          .padding(0.15);
        return (
          <>
            <Axes
              g={g}
              s={style}
              x={(horizontal ? numeric : cat) as any}
              y={(horizontal ? cat : numeric) as any}
            />
            <g
              data-part="marks"
              clipPath={`url(#${style._clipId})`}
              transform={`translate(${g.left},${g.top})`}
            >
              {sets.map((d, i) => {
                const ss = seriesStyle(
                  style,
                  groupNames.length > 1 ? d.group : d.category,
                );
                const bw = band.bandwidth(),
                  center =
                    (cat(d.category) || 0) + (band(d.group) || 0) + bw / 2,
                  summary = boxSummary(d.values),
                  fill = color(
                    style,
                    groupNames.length > 1
                      ? groupNames.indexOf(d.group)
                      : cats.indexOf(d.category),
                  );
                const coord = (v: number, off = 0) =>
                  horizontal
                    ? [numeric(v), center + off]
                    : [center + off, numeric(v)];
                const drawLine = (a: number, b: number, offset = 0) => (
                  <line
                    x1={coord(a, offset)[0]}
                    y1={coord(a, offset)[1]}
                    x2={coord(b, offset)[0]}
                    y2={coord(b, offset)[1]}
                    stroke={style.textColor}
                    strokeWidth={ss.lineWidth}
                  />
                );
                const isBox = kind === "box" || kind === "box-grouped",
                  wantBox = isBox || Boolean(style.showBox);
                let points: {
                  x: number;
                  density: number;
                }[] = [];
                if (!isBox) {
                  const domain: [number, number] = [
                    numeric.domain()[0],
                    numeric.domain().at(-1)!,
                  ];
                  if (style.distribution === "histogram") {
                    const bins = histogramBins(
                      d.values,
                      extent(d.values),
                      Math.max(3, num(style.binCount, 14)),
                    );
                    points = bins.flatMap((bin) => [
                      { x: bin.start, density: bin.count },
                      { x: bin.end, density: bin.count },
                    ]);
                  } else {
                    const domain = kdeDomain(d.values, style.trim !== false);
                    points = gaussianKde(
                      d.values,
                      kdeBandwidth(
                        d.values,
                        String(style.kdeBandwidth || "scott"),
                        num(style.bandwidthMultiplier, 1),
                      ),
                      domain,
                      num(style.kdePoints, 512),
                    );
                  }
                }
                const densityScale = d3
                  .scaleLinear()
                  .domain([0, Math.max(...points.map((p) => p.density), 1e-12)])
                  .range([0, kind === "ridgeline" ? bw * 1.1 : bw * 0.4]);
                const area = d3
                  .area<{
                    x: number;
                    density: number;
                  }>()
                  .curve(
                    style.distribution === "histogram"
                      ? d3.curveLinear
                      : d3.curveBasis,
                  );
                if (horizontal)
                  area
                    .x((p) => numeric(p.x))
                    .y0((p) =>
                      kind === "violin"
                        ? center + densityScale(p.density)
                        : center,
                    )
                    .y1((p) => center - densityScale(p.density));
                else
                  area
                    .y((p) => numeric(p.x))
                    .x0((p) => center - densityScale(p.density))
                    .x1((p) => center + densityScale(p.density));
                const boxW = Math.min(
                    bw * (isBox ? 0.55 : 0.16),
                    num(style.boxWidth, isBox ? 42 : 14),
                  ),
                  offset = kind === "raincloud" ? bw * 0.25 : 0;
                const [bx, by] = coord(summary.q3, offset);
                return (
                  <g key={i} data-category={d.category} data-group={d.group}>
                    <title>{`${d.category} ${d.group}：n=${d.values.length}，中位数=${format(summary.median)}，Q1=${format(summary.q1)}，Q3=${format(summary.q3)}`}</title>
                    {points.length > 0 && (
                      <path
                        d={area(points) || ""}
                        fill={patternFill(
                          style,
                          groupNames.length > 1
                            ? groupNames.indexOf(d.group)
                            : cats.indexOf(d.category),
                        )}
                        opacity={ss.opacity}
                        stroke={fill}
                        strokeWidth={ss.lineWidth}
                      />
                    )}{" "}
                    {wantBox && (
                      <g>
                        {drawLine(summary.low, summary.high, offset)}
                        <rect
                          x={horizontal ? numeric(summary.q1) : bx - boxW / 2}
                          y={horizontal ? by - boxW / 2 : numeric(summary.q3)}
                          width={
                            horizontal
                              ? numeric(summary.q3) - numeric(summary.q1)
                              : boxW
                          }
                          height={
                            horizontal
                              ? boxW
                              : numeric(summary.q1) - numeric(summary.q3)
                          }
                          fill={
                            isBox
                              ? patternFill(
                                  style,
                                  groupNames.length > 1
                                    ? groupNames.indexOf(d.group)
                                    : cats.indexOf(d.category),
                                )
                              : style.background
                          }
                          fillOpacity={isBox ? ss.opacity : 0.8}
                          stroke={style.textColor}
                          strokeWidth={ss.lineWidth}
                        />
                        {[summary.low, summary.median, summary.high].map(
                          (v) => (
                            <line
                              key={v}
                              x1={coord(v, offset - boxW / 2)[0]}
                              y1={coord(v, offset - boxW / 2)[1]}
                              x2={coord(v, offset + boxW / 2)[0]}
                              y2={coord(v, offset + boxW / 2)[1]}
                              stroke={style.textColor}
                              strokeWidth={ss.lineWidth}
                            />
                          ),
                        )}
                      </g>
                    )}
                    {Boolean(style.showPoints) &&
                      d.values.map((v, j) => {
                        const off =
                          kind === "raincloud"
                            ? bw * 0.42 + jitter(j, i) * bw * 0.16
                            : jitter(j, i) * bw * 0.65;
                        const [x, y] = coord(v, off);
                        return (
                          <circle
                            key={j}
                            cx={x}
                            cy={y}
                            r={Math.max(1, num(ss.pointSize, 3))}
                            fill={style.textColor}
                            opacity=".48"
                          />
                        );
                      })}
                    {isBox &&
                      !Boolean(style.showPoints) &&
                      summary.outliers.map((v, j) => {
                        const [x, y] = coord(v);
                        return (
                          <circle
                            key={j}
                            cx={x}
                            cy={y}
                            r={ss.pointSize}
                            fill="none"
                            stroke={fill}
                          />
                        );
                      })}
                    {style.showLabels && (
                      <text
                        x={horizontal ? numeric(summary.median) : center}
                        y={
                          horizontal
                            ? center - bw * 0.5
                            : numeric(summary.high) - 10
                        }
                        textAnchor="middle"
                        fill={style.textColor}
                      >
                        {format(summary.median)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </>
        );
      }}
    </ChartFrame>
  );
}
export function UpSetRenderer(props: RendererProps) {
  const rows = records(props.project.dataset),
    s = effective(props.project);
  let sets = unique(rows.map((r) => String(r["集合"])));
  const members = unique(rows.map((r) => String(r["成员"]))),
    setMembers = new Map(
      sets.map((set) => [
        set,
        new Set(
          rows.filter((r) => r["集合"] === set).map((r) => String(r["成员"])),
        ),
      ]),
    );
  if (s.setSort && s.setSort !== "input")
    sets = [...sets].sort(
      (a, b) =>
        (s.setSort === "ascending" ? 1 : -1) *
        (setMembers.get(a)!.size - setMembers.get(b)!.size),
    );
  const combos = new Map<string, { sets: string[]; members: string[] }>();
  for (const member of members) {
    const matches = sets.filter((set) => setMembers.get(set)!.has(member)),
      key = JSON.stringify(matches);
    if (!combos.has(key)) combos.set(key, { sets: matches, members: [] });
    combos.get(key)!.members.push(member);
  }
  if (s.showEmpty)
    for (let mask = 1; mask < 2 ** sets.length; mask++) {
      const keys = sets.filter((_, i) => mask & (1 << i)),
        key = JSON.stringify(keys);
      if (!combos.has(key)) combos.set(key, { sets: keys, members: [] });
    }
  let all = [...combos.values()].filter(
    (c) =>
      c.members.length >= num(s.minIntersection, 0) &&
      c.sets.length >= num(s.minDegree, 1) &&
      c.sets.length <= num(s.maxDegree, sets.length),
  );
  all.sort((a, b) =>
    s.sort === "ascending"
      ? a.members.length - b.members.length
      : s.sort === "degreeAscending"
        ? a.sets.length - b.sets.length
        : s.sort === "degreeDescending"
          ? b.sets.length - a.sets.length
          : s.sort === "input"
            ? 0
            : b.members.length - a.members.length,
  );
  const shown = all.slice(0, num(s.maxIntersections, 40));
  return (
    <ChartFrame {...props} legend={sets}>
      {(g, style) => {
        const rowGap = Math.max(
            16,
            Math.min(
              num(style.setRowSpacing, 28),
              (g.h - 105) / (sets.length || 1),
            ),
          ),
          lowerH = sets.length * rowGap + 38,
          barH = Math.max(70, g.h - lowerH),
          left =
            style.showSetSizes === false ? 90 : num(style.setSizeWidth, 185),
          mainX = left + 26,
          w = Math.max(80, g.w - mainX),
          x = d3
            .scaleBand()
            .domain(shown.map((_, i) => String(i)))
            .range([mainX, mainX + w])
            .padding(num(style.barPadding, 0.25)),
          y = d3
            .scaleLinear()
            .domain([0, Math.max(...shown.map((v) => v.members.length), 1)])
            .nice()
            .range([barH, 0]),
          size = d3
            .scaleLinear()
            .domain([
              0,
              Math.max(...[...setMembers.values()].map((v) => v.size), 1),
            ])
            .range([0, Math.max(30, left - 85)]);
        return (
          <g data-part="marks" transform={`translate(${g.left},${g.top})`}>
            {y.ticks(4).filter(Number.isInteger).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <text
                  x={mainX - 8}
                  dy=".3em"
                  textAnchor="end"
                  fill={style.textColor}
                >
                  {v}
                </text>
                {style.showGrid && (
                  <line
                    x1={mainX}
                    x2={g.w}
                    stroke={style.textColor}
                    opacity=".12"
                  />
                )}
              </g>
            ))}
            {shown.map((v, i) => {
              const xx = x(String(i)) || 0,
                cx = xx + x.bandwidth() / 2,
                yy = v.sets.map((k) => sets.indexOf(k) * rowGap + barH + 30),
                fill = style.colorByDegree
                  ? color(style, v.sets.length - 1)
                  : String(style.intersectionColor || color(style, 0));
              return (
                <g
                  key={i}
                  data-intersection={v.sets.join("|")}
                  data-count={v.members.length}
                >
                  <rect
                    x={xx}
                    y={y(v.members.length)}
                    width={x.bandwidth()}
                    height={barH - y(v.members.length)}
                    fill={fill}
                    opacity={style.opacity}
                  />
                  <title>{`${v.sets.join(" ∩ ")} 的独有交集：${v.members.length} 个成员${v.members.length ? "（" + v.members.join("、") + "）" : ""}`}</title>
                  {style.showLabels && (
                    <text
                      x={cx}
                      y={y(v.members.length) - 6}
                      textAnchor="middle"
                      fill={style.textColor}
                    >
                      {v.members.length}
                    </text>
                  )}
                  <line
                    x1={cx}
                    x2={cx}
                    y1={Math.min(...yy)}
                    y2={Math.max(...yy)}
                    stroke={fill}
                    strokeWidth={style.lineWidth}
                  />
                  {sets.map((name, j) => (
                    <circle
                      key={name}
                      cx={cx}
                      cy={barH + 30 + j * rowGap}
                      r={Math.min(style.pointSize, x.bandwidth() / 2)}
                      fill={
                        v.sets.includes(name)
                          ? fill
                          : String(style.inactiveColor || "#e5e9ed")
                      }
                    />
                  ))}
                </g>
              );
            })}
            {sets.map((name, j) => (
              <g
                key={name}
                data-set={name}
                data-size={setMembers.get(name)!.size}
                transform={`translate(0,${barH + 30 + j * rowGap})`}
              >
                <text x="0" dy=".3em" fill={style.textColor}>
                  {wrap(name, 75, style.fontSize)[0]}
                </text>
                {style.showSetSizes !== false && (
                  <>
                    <rect
                      x="82"
                      y={-rowGap * 0.28}
                      width={size(setMembers.get(name)!.size)}
                      height={rowGap * 0.56}
                      fill={color(style, j)}
                      opacity={style.opacity}
                    />
                    {style.showLabels && (
                      <text
                        x={82 + size(setMembers.get(name)!.size) + 4}
                        dy=".3em"
                        fill={style.textColor}
                      >
                        {setMembers.get(name)!.size}
                      </text>
                    )}
                  </>
                )}
              </g>
            ))}
            <text
              x={mainX + w / 2}
              y="-32"
              textAnchor="middle"
              fill={style.textColor}
            >
              独有交集数量
              {all.length > shown.length
                ? "（显示前 " + shown.length + " / " + all.length + " 项）"
                : ""}
            </text>
            {style.showSetSizes !== false && (
              <text x="82" y={barH + 10} fontSize="11" fill={style.textColor}>
                集合大小
              </text>
            )}
          </g>
        );
      }}
    </ChartFrame>
  );
}
