import React from "react";
import * as d3 from "d3";
import type { ChartStyle } from "../../core/types";
import type { TreeGeometry } from "./geometry";
import type { timeInfo } from "./time";
const number = (v: unknown, d: number) =>
  Number.isFinite(Number(v)) ? Number(v) : d;
/** HPD are imported posterior intervals; no new interval is estimated here. */
export function TimeOverlay({
  g,
  info,
  style: s,
}: {
  g: TreeGeometry;
  info: ReturnType<typeof timeInfo>;
  style: ChartStyle;
}) {
  if (!info.hasTime) return null;
  const c = String(s.hpdColor || "#447eaf"),
    thickness = number(s.hpdWidth, 7),
    opacity = number(s.hpdOpacity, 0.35),
    ageColor = String(s.ageColor || s.textColor),
    size = number(s.ageFontSize, 10);
  const point = (p: TreeGeometry["nodes"][number], age: number) => {
    const shift = (info.ages[p.node.id] - age) * g.timeUnitScale;
    return {
      x: p.x + shift * (g.kind === "normal" ? 1 : Math.cos(p.angle)),
      y: p.y + shift * (g.kind === "normal" ? 0 : Math.sin(p.angle)),
    };
  };
  const scale = d3
    .scaleLinear()
    .domain([info.domain[1], info.domain[0]])
    .range([
      g.left + (g.rtl ? g.treeWidth : 0),
      g.left + (g.rtl ? 0 : Math.min(g.treeWidth, g.width - g.left - 40)),
    ]);
  return (
    <g data-part="time-tree">
      {info.active &&
        s.showHPD !== false &&
        g.nodes
          .filter((p) => p.node.hpd)
          .map((p) => {
            const interval = info.intervals[p.node.id];
            const a = point(p, interval[0]),
              b = point(p, interval[1]);
            if (s.hpdType === "text")
              return (
                <text
                  data-part="node-hpd"
                  data-node-id={p.node.id}
                  key={p.node.id}
                  x={p.x + number(s.hpdTextX, 5)}
                  y={p.y + number(s.hpdTextY, -24)}
                  fill={String(s.hpdTextColor || c)}
                  fontSize={number(s.hpdTextSize, 10)}
                  fontWeight={s.hpdTextBold ? 700 : 400}
                >{`[${interval.map((v) => Number(v.toPrecision(5))).join(", ")}]`}</text>
              );
            return (
              <g
                data-part="node-hpd"
                data-node-id={p.node.id}
                key={p.node.id}
                stroke={c}
                opacity={opacity}
                strokeWidth={thickness}
              >
                <title>{`${p.node.name || p.node.id} · 95% ${p.node.hpdKind === "unspecified" ? "可信区间（原文件未注明类型）" : "HPD"} [${p.node.hpd!.join(", ")}] · ${info.unit}`}</title>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeLinecap="butt"
                />
                {s.hpdCaps !== false &&
                  [a, b].map((v, i) => {
                    const dx =
                        (g.kind === "normal" ? 0 : Math.sin(p.angle)) *
                        thickness,
                      dy =
                        (g.kind === "normal" ? 1 : -Math.cos(p.angle)) *
                        thickness;
                    return (
                      <line
                        key={i}
                        x1={v.x - dx}
                        y1={v.y - dy}
                        x2={v.x + dx}
                        y2={v.y + dy}
                        strokeWidth="1.5"
                      />
                    );
                  })}
              </g>
            );
          })}
      {Boolean(s.showNodeAges) &&
        g.nodes
          .filter((p) => p.node.children.length || s.showLeafAges)
          .map((p) => (
            <text
              data-part="node-age"
              data-node-id={p.node.id}
              key={p.node.id}
              x={p.x + number(s.ageX, 5)}
              y={p.y + number(s.ageY, 20)}
              textAnchor={String(s.ageAnchor || "start") as "start"}
              fontWeight={s.ageBold ? 700 : 400}
              fill={ageColor}
              fontSize={size}
            >
              {(info.ages[p.node.id] * number(s.ageFactor, 1)).toFixed(
                Math.max(0, Math.min(10, number(s.ageDecimals, 2))),
              )}
            </text>
          ))}
      {Boolean(s.showPosterior) &&
        g.nodes
          .filter((p) => p.node.posterior !== undefined)
          .map((p) => (
            <text
              data-part="node-posterior"
              key={p.node.id}
              x={p.x + 5}
              y={p.y - 16}
              fill={ageColor}
              fontSize={size}
            >{`后验 ${p.node.posterior}`}</text>
          ))}
      {info.active && g.kind !== "unrooted" && s.showTimeAxis !== false && (
        <g
          data-part="time-axis"
          transform={`translate(0,${g.height - number(s.marginBottom, 64) + 23})`}
          fill={ageColor}
          stroke={ageColor}
        >
          <line x1={scale.range()[0]} x2={scale.range()[1]} />
          {scale.ticks(5).map((v) => (
            <g key={v} transform={`translate(${scale(v)},0)`}>
              <line y2="5" />
              <text y="17" textAnchor="middle" stroke="none" fontSize={size}>
                {Number(v.toPrecision(5))}
              </text>
            </g>
          ))}
          <text
            x={scale.range()[1]}
            y="34"
            textAnchor={g.rtl ? "start" : "end"}
            stroke="none"
            fontSize={size}
          >{`距基准时点的年代（${info.unit}）`}</text>
        </g>
      )}
    </g>
  );
}
