import React, { useState } from "react";
import { extraTracks, specialProjectIssues, specialLayerTable } from "./advanced";
import { ticks } from "d3";
import type {
  DataTable,
  Dataset,
  Issue,
  Project,
  RendererProps,
  Template,
} from "../../core/types";
import {
  bool,
  col,
  createTemplate,
  dataset,
  dimensions,
  enabled,
  error,
  fmt,
  Frame,
  Invalid,
  num,
  numericCell,
  opt,
  palette,
  pick,
  required,
  rowIssue,
  table,
  tableShape,
  text,
  uniqueIds,
  value,
} from "./shared";
import { parseFasta } from "./biology";
const columns = ["chromosome", "start", "end", "value", "type"];
const circosExample = dataset(
  table(
    "chromosomes",
    "模拟染色体",
    "chromosomes",
    ["id", "length"],
    [
      ["染色体甲", 12000],
      ["染色体乙", 9000],
      ["染色体丙", 7000],
    ],
  ),
  table(
    "tracks",
    "模拟区间轨道",
    "tracks",
    columns,
    ["染色体甲", "染色体乙", "染色体丙"].flatMap((chr, ci) =>
      Array.from({ length: [12, 9, 7][ci] }, (_, i) => [
        [
          chr,
          i * 1000 + 1,
          (i + 1) * 1000,
          35 + ((i * 17 + ci * 7) % 34),
          "gc-content",
        ],
        [chr, i * 1000 + 1, (i + 1) * 1000, Math.sin(i + ci) * 0.6, "gc-skew"],
      ]).flat(),
    ),
  ),
  table(
    "annotations",
    "模拟基因注释",
    "annotations",
    ["chromosome", "start", "end", "name", "strand"],
    [
      ["染色体甲", 1000, 2300, "基因甲", "+"],
      ["染色体乙", 3900, 5800, "基因乙", "-"],
      ["染色体丙", 2000, 3000, "基因丙", "+"],
    ],
  ),
  table(
    "genome-links",
    "模拟区间关联",
    "genome-links",
    [
      "source",
      "sourceStart",
      "sourceEnd",
      "target",
      "targetStart",
      "targetEnd",
      "value",
    ],
    [
      ["染色体甲", 1500, 2500, "染色体乙", 4500, 5600, 3],
      ["染色体乙", 1500, 2500, "染色体丙", 3300, 4200, 2],
      ["染色体甲", 8500, 9500, "染色体丙", 1500, 2300, 1],
    ],
  ),
);
const circosAlternate = dataset(
  table(
    "chromosomes",
    "另一组模拟染色体",
    "chromosomes",
    ["id", "length"],
    [
      ["片段A", 8000],
      ["片段B", 14000],
    ],
  ),
  table(
    "tracks",
    "替换区间轨道",
    "tracks",
    columns,
    ["片段A", "片段B"].flatMap((chr, ci) =>
      Array.from({ length: ci ? 14 : 8 }, (_, i) => [
        [chr, i * 1000 + 1, (i + 1) * 1000, 30 + ((i * 13) % 40), "gc-content"],
        [chr, i * 1000 + 1, (i + 1) * 1000, Math.cos(i) * 0.4, "gc-skew"],
      ]).flat(),
    ),
  ),
  table(
    "annotations",
    "替换注释",
    "annotations",
    ["chromosome", "start", "end", "name", "strand"],
    [
      ["片段A", 500, 1500, "新基因1", "-"],
      ["片段B", 6000, 8500, "新基因2", "+"],
    ],
  ),
  table(
    "genome-links",
    "替换关联",
    "genome-links",
    [
      "source",
      "sourceStart",
      "sourceEnd",
      "target",
      "targetStart",
      "targetEnd",
      "value",
    ],
    [["片段A", 2500, 4500, "片段B", 5000, 7600, 5]],
  ),
);
const fastaExample =
  ">模拟片段甲\n" +
  Array.from(
    { length: 1800 },
    (_, i) => "ACGTGCGCATAT"[(i * 7 + Math.floor(i / 75)) % 12],
  ).join("") +
  "\n>模拟片段乙\n" +
  Array.from(
    { length: 1300 },
    (_, i) => "GCGCATATTT"[(i * 3 + Math.floor(i / 40)) % 10],
  ).join("");
const fastaAlternate =
  ">替换片段\n" +
  Array.from(
    { length: 2100 },
    (_, i) => "AGCGCTAT"[(i + Math.floor(i / 130)) % 8],
  ).join("");
function coordinateIssues(
  t: DataTable,
  lengths: Map<string, number>,
  chr = "chromosome",
  start = "start",
  end = "end",
): Issue[] {
  const issues: Issue[] = [];
  const c = t.columns.indexOf(chr),
    s = t.columns.indexOf(start),
    e = t.columns.indexOf(end);
  t.rows.forEach((r, i) => {
    const length = lengths.get(String(r[c]));
    if (length === undefined)
      issues.push(rowIssue(t, i, c, "未在 chromosomes 中找到该染色体"));
    numericCell(t, i, s, issues, { min: 1, integer: true });
    numericCell(t, i, e, issues, { min: 1, integer: true });
    if (Number(r[e]) < Number(r[s]))
      issues.push(rowIssue(t, i, e, "终点不能小于起点"));
    if (length !== undefined && Number(r[e]) > length)
      issues.push(rowIssue(t, i, e, `超出染色体长度 ${length}`));
  });
  return issues;
}
const fastaText = (d: Dataset) =>
  d.files
    ?.filter(
      (f) => f.role === "fasta" || ["fasta", "fa", "fna"].includes(f.format),
    )
    .map((f) => f.text)
    .join("\n") ||
  d.text ||
  "";
function circosIssues(d: Dataset, raw = false): Issue[] {
  if (raw) {
    try {
      parseFasta(fastaText(d));
      return [];
    } catch (e) {
      return [error((e as Error).message)];
    }
  }
  const chr = d.tables.find((t) => t.role === "chromosomes"),
    tracks = d.tables.find((t) => t.role === "tracks");
  const issues = tableShape(chr);
  if (!chr) return issues;
  issues.push(...required(chr, ["id", "length"]));
  if (issues.length) return issues;
  issues.push(...uniqueIds(chr));
  chr.rows.forEach((_, i) =>
    numericCell(chr, i, chr.columns.indexOf("length"), issues, {
      min: 1,
      integer: true,
    }),
  );
  const lengths = new Map(
    chr.rows.map((r) => [
      String(r[chr.columns.indexOf("id")]),
      Number(r[chr.columns.indexOf("length")]),
    ]),
  );
  if (tracks) {
    issues.push(...tableShape(tracks, 5), ...required(tracks, columns));
    if (columns.every((k) => tracks.columns.includes(k))) {
      issues.push(...coordinateIssues(tracks, lengths));
      tracks.rows.forEach((r, i) => {
        numericCell(tracks, i, tracks.columns.indexOf("value"), issues);
        const type = String(r[tracks.columns.indexOf("type")]);
        if (!["gc-content", "gc-skew", "value"].includes(type))
          issues.push(
            rowIssue(
              tracks,
              i,
              tracks.columns.indexOf("type"),
              "类型只能为 gc-content、gc-skew 或 value",
            ),
          );
        if (type === "gc-content")
          numericCell(tracks, i, tracks.columns.indexOf("value"), issues, {
            min: 0,
            max: 100,
          });
        if (type === "gc-skew")
          numericCell(tracks, i, tracks.columns.indexOf("value"), issues, {
            min: -1,
            max: 1,
          });
      });
    }
  }
  const ann = d.tables.find((t) => t.role === "annotations");
  if (ann) {
    issues.push(
      ...required(ann, ["chromosome", "start", "end", "name", "strand"]),
    );
    if (
      ["chromosome", "start", "end", "name", "strand"].every((k) =>
        ann.columns.includes(k),
      )
    ) {
      issues.push(...coordinateIssues(ann, lengths));
      ann.rows.forEach((r, i) => {
        if (!["+", "-"].includes(String(r[ann.columns.indexOf("strand")])))
          issues.push(
            rowIssue(
              ann,
              i,
              ann.columns.indexOf("strand"),
              "方向只能为 + 或 -",
            ),
          );
      });
    }
  }
  const links = d.tables.find((t) => t.role === "genome-links");
  if (links) {
    const cols = [
      "source",
      "sourceStart",
      "sourceEnd",
      "target",
      "targetStart",
      "targetEnd",
      "value",
    ];
    issues.push(...required(links, cols));
    if (cols.every((k) => links.columns.includes(k))) {
      issues.push(
        ...coordinateIssues(
          links,
          lengths,
          "source",
          "sourceStart",
          "sourceEnd",
        ),
        ...coordinateIssues(
          links,
          lengths,
          "target",
          "targetStart",
          "targetEnd",
        ),
      );
      links.rows.forEach((_, i) =>
        numericCell(links, i, links.columns.indexOf("value"), issues, {
          min: 0,
        }),
      );
    }
  }
  return issues;
}
function point(cx: number, cy: number, r: number, a: number) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function sector(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a: number,
  b: number,
) {
  const p = (r: number, x: number) => point(cx, cy, r, x).join(",");
  return `M${p(r1, a)} A${r1},${r1} 0 ${b - a > Math.PI ? 1 : 0},1 ${p(r1, b)} L${p(r0, b)} A${r0},${r0} 0 ${b - a > Math.PI ? 1 : 0},0 ${p(r0, a)} Z`;
}
function resolvedCircos(p: Project): Dataset | null {
  if (text(p, "genomeInput", "table") !== "fasta") return p.dataset;
  const data =
    p.analysis?.method === "gc"
      ? (p.analysis.result?.data as
          | {
              sequences: {
                name: string;
                length: number;
                gcContent: {
                  start: number;
                  end: number;
                  value: number | null;
                }[];
                gcSkew: { start: number; end: number; value: number | null }[];
              }[];
            }
          | undefined)
      : undefined;
  if (!data?.sequences) return null;
  return dataset(
    table(
      "chromosomes",
      "真实 FASTA 序列长度",
      "chromosomes",
      ["id", "length"],
      data.sequences.map((s) => [s.name, s.length]),
    ),
    table(
      "tracks",
      "真实 GC 窗口计算",
      "tracks",
      columns,
      data.sequences.flatMap((s) => [
        ...s.gcContent
          .filter((v) => v.value !== null)
          .map((v) => [s.name, v.start, v.end, v.value!, "gc-content"]),
        ...s.gcSkew
          .filter((v) => v.value !== null)
          .map((v) => [s.name, v.start, v.end, v.value!, "gc-skew"]),
      ]),
    ),
  );
}
function Circos({ project: p }: RendererProps) {
  const issues = circosIssues(
    p.dataset,
    text(p, "genomeInput", "table") === "fasta",
  );
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const layerIssues = specialProjectIssues(p);
  if (layerIssues.length) return <Invalid project={p} issues={layerIssues} />;
  const d = resolvedCircos(p);
  if (!d)
    return (
      <Frame project={p}>
        <text
          x={dimensions(p).w / 2}
          y={dimensions(p).h / 2}
          textAnchor="middle"
        >
          请在分析面板执行 GC 含量与偏斜的真实计算。
        </text>
      </Frame>
    );
  const chr = d.tables.find((t) => t.role === "chromosomes")!,
    tracks = d.tables.find((t) => t.role === "tracks"),
    annotations = d.tables.find((t) => t.role === "annotations"),
    links = d.tables.find((t) => t.role === "genome-links"),
    get = (t: DataTable, r: DataTable["rows"][number], k: string) =>
      r[t.columns.indexOf(k)];
  const chrs = chr.rows.map((r) => ({
      id: String(get(chr, r, "id")),
      length: Number(get(chr, r, "length")),
    })),
    { left, top, iw, ih } = dimensions(p),
    cx = left + iw / 2,
    cy = top + ih / 2,
    R = Math.min(iw, ih) * 0.4,
    total = chrs.reduce((a, c) => a + c.length, 0),
    gap = Math.min(0.4, (value(p, "chromosomeGap", 5) * Math.PI) / 180),
    available = 2 * Math.PI - gap * chrs.length,
    pal = palette(p),
    ring = value(p, "chromosomeWidth", 18),
    trackWidth = value(p, "trackWidth", 28);
  let next = (value(p, "genomeStartAngle", -90) * Math.PI) / 180;
  const arcs = chrs.map((c) => {
    const a = next,
      b = a + (c.length / total) * available;
    next = b + gap;
    return { ...c, a, b };
  });
  const byId = new Map(arcs.map((c) => [c.id, c])),
    angle = (id: string, position: number) => {
      const c = byId.get(id)!;
      return c.a + ((position - 1) / c.length) * (c.b - c.a);
    };
  const customTracks = extraTracks(p);
  const centerRadius = Math.max(
    20,
    R -
      ring -
      2 * trackWidth -
      35 -
      customTracks.reduce(
        (sum, l) => sum + Number(l.settings.size || 22) + 6,
        0,
      ),
  );
  return (
    <Frame project={p}>
      {arcs.map((c, i) => (
        <g key={c.id}>
          <path
            d={sector(cx, cy, R - ring, R, c.a, c.b)}
            fill={pal[i % pal.length]}
          >
            <title>{`${c.id}：${c.length} bp`}</title>
          </path>
          {enabled(p, "showLabels") && (
            <text
              x={point(cx, cy, R + 24, (c.a + c.b) / 2)[0]}
              y={point(cx, cy, R + 24, (c.a + c.b) / 2)[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
            >
              {c.id}
            </text>
          )}
          {enabled(p, "genomeTicks", true) &&
            ticks(0, c.length, 3)
              .filter((v) => v < c.length)
              .map((v) => {
                const a = angle(c.id, v + 1),
                  q = point(cx, cy, R + 7, a),
                  r = point(cx, cy, R, a);
                return (
                  <g key={v}>
                    <line
                      x1={q[0]}
                      y1={q[1]}
                      x2={r[0]}
                      y2={r[1]}
                      stroke={p.style.textColor}
                    />
                    <text
                      x={point(cx, cy, R + 13, a)[0]}
                      y={point(cx, cy, R + 13, a)[1]}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={8}
                    >
                      {v >= 1000 ? `${fmt(v / 1000, 1)}k` : v}
                    </text>
                  </g>
                );
              })}
        </g>
      ))}
      {tracks?.rows.map((r, i) => {
        const id = String(get(tracks, r, "chromosome")),
          a = angle(id, Number(get(tracks, r, "start"))),
          b = angle(id, Number(get(tracks, r, "end")) + 1),
          v = Number(get(tracks, r, "value")),
          type = String(get(tracks, r, "type"));
        if (
          (type === "gc-content" && !enabled(p, "showGCContent", true)) ||
          (type === "gc-skew" && !enabled(p, "showGCSkew", true))
        )
          return null;
        const index = type === "gc-skew" ? 1 : 0,
          outer = R - ring - 7 - index * (trackWidth + 7),
          baseline =
            type === "gc-skew" ? outer - trackWidth / 2 : outer - trackWidth,
          delta =
            type === "gc-skew"
              ? (v * trackWidth) / 2
              : type === "gc-content"
                ? (v / 100) * trackWidth
                : Math.max(
                    -1,
                    Math.min(1, v / value(p, "trackValueMax", 100)),
                  ) * trackWidth,
          ra = baseline,
          rb = baseline + delta;
        return (
          <path
            key={i}
            d={sector(
              cx,
              cy,
              Math.min(ra, rb),
              Math.max(ra, rb) || 0.001,
              a,
              b,
            )}
            fill={
              type === "gc-skew"
                ? v >= 0
                  ? text(p, "skewPositive", "#9772aa")
                  : text(p, "skewNegative", "#69a36f")
                : text(p, "gcColor", "#3b9aa0")
            }
            strokeWidth={0}
          >
            <title>{`${id}:${get(tracks, r, "start")}–${get(tracks, r, "end")}；${type}=${fmt(v, 4)}`}</title>
          </path>
        );
      })}
      <g data-special-layer="dynamic-genome-tracks">
        {customTracks.map((l, li) => {
          const t = specialLayerTable(l)!,
            size = Number(l.settings.size || 22),
            outer =
              R -
              ring -
              7 -
              2 * (trackWidth + 7) -
              customTracks
                .slice(0, li)
                .reduce((sum, t) => sum + Number(t.settings.size || 22) + 6, 0),
            inner = outer - size,
            values = t.rows.map((r) => Number(r[3])),
            min = Math.min(0, ...values),
            max = Math.max(0, ...values),
            radius = (v: number) =>
              inner + ((v - min) / (max - min || 1)) * size,
            baseline = radius(0),
            kind = String(l.settings.kind || "bar"),
            color = String(l.settings.color || "#397e99");
          return (
            <g key={l.id}>
              <title>{`${l.name}`}</title>
              {kind === "line"
                ? arcs.map((c) => {
                    const rows = t.rows
                      .filter((r) => r[0] === c.id)
                      .sort((a, b) => Number(a[1]) - Number(b[1]));
                    return (
                      <path
                        key={c.id}
                        d={rows
                          .map(
                            (r, i) =>
                              `${i ? "L" : "M"}${point(cx, cy, radius(Number(r[3])), angle(c.id, (Number(r[1]) + Number(r[2])) / 2))}`,
                          )
                          .join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    );
                  })
                : t.rows.map((r, i) => {
                    const v = Number(r[3]),
                      a = angle(String(r[0]), Number(r[1])),
                      b = angle(String(r[0]), Number(r[2]) + 1),
                      rr = radius(v),
                      pos = point(cx, cy, rr, (a + b) / 2);
                    return (
                      <g key={i}>
                        <title>{`${l.name}；${r[0]}:${r[1]}–${r[2]}；${r[3]}`}</title>
                        {kind === "point" ? (
                          <circle
                            cx={pos[0]}
                            cy={pos[1]}
                            r={Number(l.settings.pointSize) || 3}
                            fill={color}
                          />
                        ) : (
                          <path
                            d={sector(
                              cx,
                              cy,
                              kind === "heatmap"
                                ? inner
                                : Math.min(baseline, rr),
                              kind === "heatmap"
                                ? outer
                                : Math.max(baseline, rr) + 0.05,
                              a,
                              b,
                            )}
                            fill={
                              v < 0
                                ? String(l.settings.negativeColor || "#d2786c")
                                : color
                            }
                            opacity={
                              kind === "heatmap"
                                ? 0.15 + (0.85 * (v - min)) / (max - min || 1)
                                : 1
                            }
                          />
                        )}
                      </g>
                    );
                  })}
            </g>
          );
        })}
      </g>
      {enabled(p, "showGenomeLinks", true) &&
        links?.rows.map((r, i) => {
          const source = String(get(links, r, "source")),
            target = String(get(links, r, "target")),
            a = angle(
              source,
              (Number(get(links, r, "sourceStart")) +
                Number(get(links, r, "sourceEnd"))) /
                2,
            ),
            b = angle(
              target,
              (Number(get(links, r, "targetStart")) +
                Number(get(links, r, "targetEnd"))) /
                2,
            ),
            start = point(cx, cy, centerRadius, a),
            end = point(cx, cy, centerRadius, b);
          return (
            <path
              key={i}
              d={`M${start} Q${cx},${cy} ${end}`}
              stroke={pal[arcs.findIndex((c) => c.id === source) % pal.length]}
              fill="none"
              strokeWidth={Math.max(
                0.5,
                Number(get(links, r, "value")) * value(p, "genomeLinkWidth", 2),
              )}
              opacity={value(p, "genomeLinkOpacity", 0.45)}
            >
              <title>{`${source} → ${target}；数值 ${get(links, r, "value")}`}</title>
            </path>
          );
        })}
      {enabled(p, "showAnnotations", true) &&
        annotations?.rows.map((r, i) => {
          const id = String(get(annotations, r, "chromosome")),
            a = angle(id, Number(get(annotations, r, "start"))),
            b = angle(id, Number(get(annotations, r, "end")) + 1),
            negative = get(annotations, r, "strand") === "-",
            r0 = centerRadius + 8;
          return (
            <g key={i}>
              <path
                d={sector(cx, cy, r0, r0 + 7, a, b)}
                fill={
                  negative
                    ? text(p, "minusColor", "#e49950")
                    : text(p, "plusColor", "#659bbd")
                }
              />
              <title>{`${get(annotations, r, "name")}；${id}:${get(annotations, r, "start")}–${get(annotations, r, "end")}；${negative ? "-" : "+"}`}</title>
            </g>
          );
        })}
      {enabled(p, "showLegend") &&
        customTracks.map((l, i) => (
          <g
            key={l.id}
            transform={`translate(${left + i * 150},${top + ih + 54})`}
          >
            <circle r={4} fill={String(l.settings.color || "#397e99")} />
            <text
              x={10}
              y={3}
              fontSize={9}
            >{`附加轨道 ${i + 1}：${l.name}`}</text>
          </g>
        ))}
      {enabled(p, "showLegend") && (
        <text x={cx} y={top + ih + 35} textAnchor="middle" fontSize={11}>
          外圈：序列长度；内轨道：GC 含量、GC 偏斜；中心：用户提供的区间关联
        </text>
      )}
    </Frame>
  );
}

const gffExample =
  "染色体A\tA1\t100\t600\n染色体A\tA2\t1200\t2000\n染色体A\tA3\t2800\t3400\n染色体B\tB1\t300\t900\n染色体B\tB2\t1700\t2300\n染色体B\tB3\t3300\t4000\n染色体C\tC1\t100\t700\n染色体C\tC2\t1700\t2500";
const collinearExample =
  "## Alignment 0: score=120 e_value=1e-12 N=3 染色体A&染色体B plus\n 0- 0: A1 B1 1e-6\n 0- 1: A2 B2 1e-8\n 0- 2: A3 B3 1e-9\n## Alignment 1: score=90 e_value=1e-10 N=2 染色体B&染色体C minus\n 1- 0: B1 C2 1e-7\n 1- 1: B2 C1 1e-8";
const gffAlternate =
  "片段甲\t甲1\t200\t800\n片段甲\t甲2\t1300\t2100\n片段乙\t乙1\t1500\t2300\n片段乙\t乙2\t400\t950";
const collinearAlternate =
  "## Alignment 0: score=88 e_value=1e-8 N=2 片段甲&片段乙 minus\n 0- 0: 甲1 乙1 1e-7\n 0- 1: 甲2 乙2 1e-8";
export function parseMcScanX(gff: string, collinearity: string): Dataset {
  const genes: DataTable["rows"] = [],
    ids = new Set<string>();
  gff.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.startsWith("#")) return;
    const r = line.trim().split(/\s+/);
    if (r.length !== 4)
      throw new Error(
        `MCScanX GFF 第 ${i + 1} 行：必须为 chromosome、gene、start、end 四列；此格式不是 9 列 GFF3`,
      );
    if (ids.has(r[1]))
      throw new Error(`MCScanX GFF 第 ${i + 1} 行：基因名“${r[1]}”重复`);
    ids.add(r[1]);
    genes.push([r[0], r[1], Number(r[2]), Number(r[3])]);
  });
  const links: DataTable["rows"] = [];
  let block = "";
  collinearity.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const header = line.match(/^##\s*Alignment\s+(\d+)/);
    if (header) {
      block = `区块${header[1]}`;
      return;
    }
    if (line.startsWith("#")) return;
    const m = line.match(/^\s*\d+\s*-\s*\d+\s*:\s*(\S+)\s+(\S+)\s+(\S+)/);
    if (!m)
      throw new Error(
        `MCScanX collinearity 第 ${i + 1} 行：无法识别“区块-序号: 基因1 基因2 E值”`,
      );
    if (!block)
      throw new Error(
        `MCScanX collinearity 第 ${i + 1} 行：前面缺少 ## Alignment 区块标题`,
      );
    links.push([m[1], m[2], block, Number(m[3])]);
  });
  if (!genes.length || !links.length)
    throw new Error("MCScanX 需要非空 GFF 基因表和 collinearity 共线性对");
  const lengths = new Map<string, number>();
  genes.forEach((r) =>
    lengths.set(
      String(r[0]),
      Math.max(lengths.get(String(r[0])) ?? 0, Number(r[3])),
    ),
  );
  return dataset(
    table(
      "chromosomes",
      "染色体绘图范围（最大基因终点）",
      "chromosomes",
      ["id", "length"],
      [...lengths.entries()],
    ),
    table(
      "synteny-genes",
      "MCScanX 基因坐标",
      "synteny-genes",
      ["chromosome", "id", "start", "end"],
      genes,
    ),
    table(
      "synteny-links",
      "MCScanX 共线性配对",
      "synteny-links",
      ["source", "target", "block", "evalue"],
      links,
    ),
  );
}
const syntenyExample = parseMcScanX(gffExample, collinearExample),
  syntenyAlternate = parseMcScanX(gffAlternate, collinearAlternate);
function resolveSynteny(d: Dataset, raw: boolean) {
  if (!raw) return d;
  if (d.files?.length) {
    const gff = d.files.find((f) => f.role === "gff"),
      collinearity = d.files.find((f) => f.role === "collinearity");
    if (!gff || !collinearity)
      throw new Error("MCScanX 原格式需要独立的 gff 与 collinearity 两文件");
    return parseMcScanX(gff.text, collinearity.text);
  }
  const source = d.text ?? "",
    parts = source.split("# OPENACAD COLLINEARITY");
  if (parts.length !== 2)
    throw new Error(
      "专业文本需以 # OPENACAD COLLINEARITY 分隔四列 GFF 与共线性文件；也可以分别上传两文件",
    );
  return parseMcScanX(parts[0].replace("# OPENACAD GFF", ""), parts[1]);
}
function syntenyIssues(d: Dataset, raw = false): Issue[] {
  let data: Dataset;
  try {
    data = resolveSynteny(d, raw);
  } catch (e) {
    return [error((e as Error).message)];
  }
  const chr = data.tables.find((t) => t.role === "chromosomes"),
    genes = data.tables.find((t) => t.role === "synteny-genes"),
    links = data.tables.find((t) => t.role === "synteny-links");
  const issues = [
    ...tableShape(chr),
    ...tableShape(genes, 4),
    ...tableShape(links, 4),
  ];
  if (!chr || !genes || !links) return issues;
  issues.push(
    ...required(chr, ["id", "length"]),
    ...required(genes, ["chromosome", "id", "start", "end"]),
    ...required(links, ["source", "target", "block", "evalue"]),
  );
  if (issues.length) return issues;
  issues.push(
    ...uniqueIds(chr),
    ...uniqueIds(genes, genes.columns.indexOf("id")),
  );
  chr.rows.forEach((_, i) =>
    numericCell(chr, i, chr.columns.indexOf("length"), issues, {
      min: 1,
      integer: true,
    }),
  );
  const lengths = new Map(
    chr.rows.map((r) => [
      String(r[chr.columns.indexOf("id")]),
      Number(r[chr.columns.indexOf("length")]),
    ]),
  );
  issues.push(...coordinateIssues(genes, lengths));
  const ids = new Set(
    genes.rows.map((r) => String(r[genes.columns.indexOf("id")])),
  );
  links.rows.forEach((r, i) => {
    for (const k of ["source", "target"])
      if (!ids.has(String(r[links.columns.indexOf(k)])))
        issues.push(
          rowIssue(
            links,
            i,
            links.columns.indexOf(k),
            `找不到基因“${r[links.columns.indexOf(k)]}”`,
          ),
        );
    numericCell(links, i, links.columns.indexOf("evalue"), issues, { min: 0 });
  });
  return issues;
}
function Synteny({ project: p, onLayoutChange }: RendererProps) {
  const [drag, setDrag] = useState<{ id: string; x: number } | null>(null);
  const raw = text(p, "syntenyInput", "table") === "native",
    issues = syntenyIssues(p.dataset, raw);
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const d = resolveSynteny(p.dataset, raw),
    chr = d.tables.find((t) => t.role === "chromosomes")!,
    gt = d.tables.find((t) => t.role === "synteny-genes")!,
    lt = d.tables.find((t) => t.role === "synteny-links")!,
    at = (t: DataTable, r: DataTable["rows"][number], k: string) =>
      r[t.columns.indexOf(k)],
    chrs = chr.rows.map((r) => ({
      id: String(at(chr, r, "id")),
      length: Number(at(chr, r, "length")),
    }));
  if (text(p, "chromosomeSort", "input") === "name")
    chrs.sort((a, b) => a.id.localeCompare(b.id, "zh-CN"));
  else if (Array.isArray(p.layout.chromosomeOrder)) {
    const order = p.layout.chromosomeOrder as string[];
    chrs.sort((a, b) => {
      const rank = (id: string) =>
        order.includes(id)
          ? order.indexOf(id)
          : order.length + chr.rows.findIndex((r) => r[0] === id);
      return rank(a.id) - rank(b.id);
    });
  }
  const { left, top, iw, ih } = dimensions(p),
    pal = palette(p),
    maxLength = Math.max(...chrs.map((c) => c.length)),
    width = value(p, "syntenyChromosomeWidth", 15),
    x = (id: string) =>
      left + ((chrs.findIndex((c) => c.id === id) + 0.5) * iw) / chrs.length,
    y = (id: string, pos: number) => {
      const i = chrs.findIndex((c) => c.id === id),
        length = chrs[i].length;
      return (
        top +
        ((enabled(p, "flipAlternate", false) && i % 2 ? length - pos : pos) /
          (enabled(p, "syntenyAlign", true) ? maxLength : length)) *
          ih
      );
    };
  const genes = new Map(
    gt.rows.map((r) => [
      String(at(gt, r, "id")),
      {
        id: String(at(gt, r, "id")),
        chr: String(at(gt, r, "chromosome")),
        start: Number(at(gt, r, "start")),
        end: Number(at(gt, r, "end")),
      },
    ]),
  );
  const links = lt.rows.filter(
      (r) => Number(at(lt, r, "evalue")) <= value(p, "syntenyEvalue", 1),
    ),
    blocks = Array.from(new Set(links.map((r) => String(at(lt, r, "block")))));
  const pointerX = (e: React.PointerEvent<SVGGElement>) => {
    const svg = e.currentTarget.ownerSVGElement!,
      pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse()).x;
  };
  return (
    <Frame project={p}>
      {drag && (
        <line
          data-synteny-drop-guide="true"
          x1={drag.x}
          x2={drag.x}
          y1={top - 30}
          y2={top + ih}
          stroke="#237c83"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      )}
      {links.map((r, i) => {
        const a = genes.get(String(at(lt, r, "source")))!,
          b = genes.get(String(at(lt, r, "target")))!;
        const x0 = x(a.chr),
          x1 = x(b.chr),
          y0 = y(a.chr, (a.start + a.end) / 2),
          y1 = y(b.chr, (b.start + b.end) / 2),
          color = pal[blocks.indexOf(String(at(lt, r, "block"))) % pal.length],
          mode = text(p, "syntenyLinkShape", "ribbon");
        const path =
          mode === "ribbon"
            ? `M${x0},${y(a.chr, a.start)} C${(x0 + x1) / 2},${y(a.chr, a.start)} ${(x0 + x1) / 2},${y(b.chr, b.start)} ${x1},${y(b.chr, b.start)} L${x1},${y(b.chr, b.end)} C${(x0 + x1) / 2},${y(b.chr, b.end)} ${(x0 + x1) / 2},${y(a.chr, a.end)} ${x0},${y(a.chr, a.end)} Z`
            : `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`;
        return (
          <path
            key={i}
            d={path}
            fill={mode === "ribbon" ? color : "none"}
            stroke={mode === "line" ? color : "none"}
            strokeWidth={value(p, "syntenyLineWidth", 2)}
            opacity={value(p, "syntenyLinkOpacity", 0.3)}
          >
            <title>{`${a.id} ↔ ${b.id}；${at(lt, r, "block")}；E=${at(lt, r, "evalue")}`}</title>
          </path>
        );
      })}
      {chrs.map((c, i) => (
        <g
          key={c.id}
          data-drag-chromosome={c.id}
          style={{
            cursor:
              onLayoutChange && text(p, "chromosomeSort", "input") === "input"
                ? "grab"
                : "default",
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            if (
              !onLayoutChange ||
              text(p, "chromosomeSort", "input") !== "input"
            )
              return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ id: c.id, x: pointerX(e) });
          }}
          onPointerMove={(e) => {
            if (drag?.id === c.id) setDrag({ id: c.id, x: pointerX(e) });
          }}
          onPointerUp={(e) => {
            if (drag?.id !== c.id) return;
            const target = Math.max(
              0,
              Math.min(
                chrs.length - 1,
                Math.floor(((pointerX(e) - left) / iw) * chrs.length),
              ),
            );
            const order = chrs.map((c) => c.id).filter((id) => id !== c.id);
            order.splice(target, 0, c.id);
            onLayoutChange?.({ ...p.layout, chromosomeOrder: order });
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
        >
          <rect
            x={x(c.id) - width / 2}
            y={top}
            width={width}
            height={
              (c.length /
                (enabled(p, "syntenyAlign", true) ? maxLength : c.length)) *
              ih
            }
            rx={width / 2}
            fill={text(p, "chromosomeColor", "#dce5e8")}
            stroke={pal[i % pal.length]}
          />
          <text x={x(c.id)} y={top - 15} textAnchor="middle" fontWeight="bold">
            {c.id}
          </text>
          {enabled(p, "genomeTicks", true) &&
            ticks(0, c.length, 4).map((n) => (
              <text
                key={n}
                x={x(c.id) + width + 4}
                y={y(c.id, n) + 4}
                fontSize={9}
              >
                {n >= 1000 ? `${fmt(n / 1000, 1)}k` : n}
              </text>
            ))}
        </g>
      ))}
      {[...genes.values()].map((g) => (
        <g key={g.id}>
          <rect
            x={x(g.chr) - width / 2 - 2}
            y={Math.min(y(g.chr, g.start), y(g.chr, g.end))}
            width={width + 4}
            height={Math.max(2, Math.abs(y(g.chr, g.end) - y(g.chr, g.start)))}
            fill={pal[chrs.findIndex((c) => c.id === g.chr) % pal.length]}
            opacity={0.85}
          />
          {enabled(p, "showLabels") && (
            <text
              x={x(g.chr) - width / 2 - 9}
              y={y(g.chr, (g.start + g.end) / 2) + 4}
              textAnchor="end"
              fontSize={10}
            >
              {g.id}
            </text>
          )}
        </g>
      ))}
      {enabled(p, "showLegend") &&
        blocks.map((b, i) => (
          <g
            key={b}
            transform={`translate(${left + i * 140},${top + ih + 33})`}
          >
            <rect width={12} height={9} y={-8} fill={pal[i % pal.length]} />
            <text x={20} fontSize={11}>
              {b}
            </text>
          </g>
        ))}
    </Frame>
  );
}
export const genomicsTemplates: Template[] = [
  createTemplate(
    "genome-circos",
    "基因组圈图",
    "生物信息",
    "整合染色体、区间注释、关联与 GC 轨道；可从 FASTA 真实计算 GC 含量和偏斜。",
    { ...circosExample, text: fastaExample, format: "fasta" },
    { ...circosAlternate, text: fastaAlternate, format: "fasta" },
    Circos,
    {
      validate: (d, s) => circosIssues(d, s?.genomeInput === "fasta"),
      formats: ["csv", "tsv", "xls", "xlsx", "fasta", "fa", "fna"],
      defaultStyle: { marginLeft: 85, marginRight: 85, marginBottom: 80 },
      controls: [
        opt(
          "genomeInput",
          "数据模式",
          [
            ["table", "已有区间结果绘图"],
            ["fasta", "FASTA 真实 GC 分析"],
          ],
          "数据",
        ),
        num("chromosomeGap", "染色体间隔角度", 0, 15, 0.5),
        num("chromosomeWidth", "染色体环宽", 5, 35),
        num("trackWidth", "轨道高度", 8, 42),
        num("genomeStartAngle", "起始角", -180, 180),
        bool("genomeTicks", "显示坐标刻度"),
        bool("showGCContent", "显示 GC 含量"),
        bool("showGCSkew", "显示 GC 偏斜"),
        col("gcColor", "GC 含量颜色"),
        col("skewPositive", "正偏斜颜色"),
        col("skewNegative", "负偏斜颜色"),
        num("trackValueMax", "普通数值轨道上限", 1, 100000),
        bool("showAnnotations", "显示基因注释"),
        col("plusColor", "正链颜色"),
        col("minusColor", "负链颜色"),
        bool("showGenomeLinks", "显示区间关联"),
        num("genomeLinkWidth", "关联线宽倍率", 0.2, 8, 0.2),
        num("genomeLinkOpacity", "关联透明度", 0.05, 0.95, 0.05),
      ],
      analysisMethods: [
        {
          method: "gc",
          label: "GC 含量与偏斜",
          description:
            "从 FASTA 执行窗口计算：GC%=100(G+C)/(A+C+G+T)，偏斜=(G−C)/(G+C)；模糊碱基不计入分母。",
          params: { contentWindow: 200, skewWindow: 200 },
        },
      ],
      prepareAnalysis: (_method, d, params) => ({
        data: { sequences: fastaText(d) },
        params,
      }),
      inputHelp:
        "已有结果：chromosomes 表 id/length；tracks 表 chromosome/start/end/value/type，type 为 gc-content（0～100）、gc-skew（−1～1）或 value。annotations 可选：chromosome/start/end/name/strand；genome-links 可选：source/sourceStart/sourceEnd/target/targetStart/targetEnd/value。坐标均为 1-based inclusive。FASTA 模式读取专业文本并执行真实服务；未执行前不会用示例轨道代替。",
      limitations: [
        "输入区间关联及注释不代表本网站进行了序列比对或基因预测。GC 分母为 0 的窗口留空，不填成 0。",
      ],
      sourceUrls: ["https://www.chiplot.online/circos.html"],
    },
  ),
  createTemplate(
    "synteny",
    "MCScanX 共线性图",
    "生物信息",
    "从基因坐标与已计算的共线性配对生成染色体带状关联。",
    {
      ...syntenyExample,
      text:
        "# OPENACAD GFF\n" +
        gffExample +
        "\n# OPENACAD COLLINEARITY\n" +
        collinearExample,
      format: "collinearity",
    },
    {
      ...syntenyAlternate,
      text:
        "# OPENACAD GFF\n" +
        gffAlternate +
        "\n# OPENACAD COLLINEARITY\n" +
        collinearAlternate,
      format: "collinearity",
    },
    Synteny,
    {
      validate: (d, s) => syntenyIssues(d, s?.syntenyInput === "native"),
      formats: ["csv", "tsv", "xls", "xlsx", "gff", "collinearity"],
      controls: [
        opt(
          "syntenyInput",
          "输入模式",
          [
            ["table", "标准化表格"],
            ["native", "MCScanX 原格式"],
          ],
          "数据",
        ),
        opt("chromosomeSort", "染色体排列", [
          ["input", "数据或手动顺序"],
          ["name", "名称升序"],
        ]),
        num("syntenyChromosomeWidth", "染色体宽度", 5, 38),
        col("chromosomeColor", "染色体背景色"),
        bool("syntenyAlign", "统一坐标比例"),
        bool("flipAlternate", "翻转第 2、4…条染色体"),
        opt("syntenyLinkShape", "共线性连接", [
          ["ribbon", "按基因区间宽度的带状"],
          ["line", "中心线"],
        ]),
        num("syntenyLineWidth", "中心线宽", 0.5, 8, 0.5),
        num("syntenyLinkOpacity", "关联透明度", 0.05, 0.85, 0.05),
        num("syntenyEvalue", "E 值筛选上限", 0, 1, 0.001),
        bool("genomeTicks", "显示坐标刻度"),
      ],
      inputHelp:
        "标准化三表：chromosomes（id/length）；synteny-genes（chromosome/id/start/end）；synteny-links（source/target/block/evalue）。在“数据或手动顺序”模式下可横向拖动染色体调整排列，顺序保存进项目。原格式是 MCScanX 四列 GFF（染色体 基因 起点 终点）及 .collinearity。不是通用 9 列 GFF3；导入原格式时染色体绘图范围取基因最大终点，可在标准化表格中换成真实染色体长度。",
      limitations: [
        "不运行 MCScanX 共线性搜索；只展示用户已得到的区块和基因配对。原格式的最大基因终点不是完整染色体长度。",
      ],
      sourceUrls: ["https://www.chiplot.online/McScanX_synteny_plot.html"],
    },
  ),
];

for (const t of genomicsTemplates) {
  for (const d of [t.example, t.alternate]) {
    if (t.id === "genome-circos") {
      d.files = [
        {
          id: "fasta",
          name: "模拟DNA.fasta",
          role: "fasta",
          format: "fasta",
          text: d.text!,
        },
      ];
    } else {
      const parts = d.text!.split("# OPENACAD COLLINEARITY");
      d.files = [
        {
          id: "gff",
          name: "模拟基因.gff",
          role: "gff",
          format: "gff",
          text: parts[0].replace("# OPENACAD GFF", "").trim(),
        },
        {
          id: "collinearity",
          name: "模拟共线性.collinearity",
          role: "collinearity",
          format: "collinearity",
          text: parts[1].trim(),
        },
      ];
    }
    delete d.text;
    delete d.format;
  }
}
