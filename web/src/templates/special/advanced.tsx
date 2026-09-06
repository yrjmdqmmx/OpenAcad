import React, { useState } from "react";
import type { Project, Layer, DataTable, Issue } from "../../core/types";
import { parseFile, parseText } from "../../core/data";
import {
  dataset,
  table,
  palette,
  error,
  rowIssue,
  numericCell,
  required,
  uniqueIds,
  dimensions,
} from "./shared";
export const matrixIds = [
  "heatmap",
  "circle-heatmap",
  "binary-dot",
  "binary-rect",
  "bubble-matrix",
  "correlation",
  "double-correlation",
  "mantel",
];
export function matrixAxes(p: Project) {
  const raw = p.style.inputMode === "raw";
  const result = p.analysis?.result?.data as
    | {
        rowLabels?: string[];
        columnLabels?: string[];
        environmentCorrelation?: {
          rowLabels: string[];
          columnLabels: string[];
        };
      }
    | undefined;
  const data = result?.environmentCorrelation ?? result;
  if (raw && data?.rowLabels && data?.columnLabels)
    return { rows: data.rowLabels, columns: data.columnLabels };
  const t =
    p.dataset.tables.find((t) => ["matrix", "correlation"].includes(t.role)) ??
    p.dataset.tables[0];
  return {
    rows: t?.rows.map((r) => String(r[0])) ?? [],
    columns: t?.columns.slice(1) ?? [],
  };
}
export function annotationLayers(p: Project, axis: "row" | "column") {
  return p.layers.filter(
    (l) => l.visible && l.type.startsWith(`matrix-${axis}-`),
  );
}
export function annotationSize(p: Project, axis: "row" | "column") {
  return annotationLayers(p, axis).reduce(
    (sum, l) =>
      sum + Math.max(10, Math.min(80, Number(l.settings.size) || 22)) + 4,
    0,
  );
}
export function geneBreaks(p: Project, cluster: string) {
  return p.layers
    .filter((l) => l.visible && l.type === "gene-break")
    .flatMap((l) =>
      (l.data?.tables[0]?.rows ?? [])
        .filter((r) => r[0] === "*" || r[0] === cluster)
        .map((r) => ({ start: Number(r[1]), end: Number(r[2]) })),
    )
    .sort((a, b) => a.start - b.start);
}
export function extraTracks(p: Project) {
  return p.layers.filter((l) => l.visible && l.type === "genome-track");
}
export function specialProjectIssues(p: Project): Issue[] {
  const issues: Issue[] = [],
    axes = matrixAxes(p);
  for (const l of p.layers.filter((l) => l.visible)) {
    const t = l.data?.tables[0];
    if (l.type.startsWith("matrix-")) {
      if (!t) {
        issues.push(error(`“${l.name}”缺少注释表`));
        continue;
      }
      issues.push(...required(t, ["标签", "值"]), ...uniqueIds(t));
      t.rows.forEach((r, i) => {
        const ids = l.type.includes("-row-") ? axes.rows : axes.columns;
        if (!ids.includes(String(r[0])))
          issues.push(rowIssue(t, i, 0, "注释标签未出现在当前矩阵轴中"));
        if (l.type.endsWith("-bar")) numericCell(t, i, 1, issues);
        else if (!String(r[1] ?? "").trim())
          issues.push(rowIssue(t, i, 1, "注释值不能为空"));
      });
    }
    if (l.type === "gene-break") {
      if (!t) {
        issues.push(error(`“${l.name}”缺少断轴区间`));
        continue;
      }
      const genes = p.dataset.tables.find((t) => t.role === "genes");
      issues.push(...required(t, ["cluster", "start", "end"]));
      t.rows.forEach((r, i) => {
        for (const j of [1, 2])
          numericCell(t, i, j, issues, { min: 1, integer: true });
        if (Number(r[2]) <= Number(r[1]))
          issues.push(rowIssue(t, i, 2, "断轴终点必须大于起点"));
        if (genes) {
          const at = (k: string) => genes.columns.indexOf(k);
          if (
            r[0] !== "*" &&
            !genes.rows.some((g) => g[at("cluster")] === r[0])
          )
            issues.push(rowIssue(t, i, 0, "簇名称不存在，可用 * 指定全部簇"));
          if (
            genes.rows.some(
              (g) =>
                (r[0] === "*" || g[at("cluster")] === r[0]) &&
                Number(g[at("start")]) < Number(r[2]) &&
                Number(g[at("end")]) > Number(r[1]),
            )
          )
            issues.push(
              rowIssue(t, i, 1, "断轴区间与基因重叠；请只压缩基因间隔"),
            );
        }
        if (
          t.rows
            .slice(0, i)
            .some(
              (a) =>
                (a[0] === r[0] || a[0] === "*" || r[0] === "*") &&
                Number(a[1]) < Number(r[2]) &&
                Number(a[2]) > Number(r[1]),
            )
        )
          issues.push(rowIssue(t, i, 1, "断轴区间与前面的区间重叠"));
      });
    }
    if (l.type === "genome-track") {
      if (!t) {
        issues.push(error(`“${l.name}”缺少区间数据`));
        continue;
      }
      issues.push(...required(t, ["chromosome", "start", "end", "value"]));
      const raw = p.analysis?.result?.data as
        | { sequences?: { name: string; length: number }[] }
        | undefined;
      const chr = p.dataset.tables.find((t) => t.role === "chromosomes");
      const lengths = new Map<string, number>(
        p.style.genomeInput === "fasta" && raw?.sequences
          ? raw.sequences.map((c) => [c.name, c.length])
          : (chr?.rows.map((r) => [String(r[0]), Number(r[1])]) ?? []),
      );
      t.rows.forEach((r, i) => {
        if (!lengths.has(String(r[0])))
          issues.push(rowIssue(t, i, 0, "染色体名称不存在"));
        for (const j of [1, 2])
          numericCell(t, i, j, issues, { min: 1, integer: true });
        numericCell(t, i, 3, issues);
        if (Number(r[2]) < Number(r[1]))
          issues.push(rowIssue(t, i, 2, "终点不能小于起点"));
        if (Number(r[2]) > (lengths.get(String(r[0])) ?? Infinity))
          issues.push(rowIssue(t, i, 2, "超出染色体长度"));
      });
    }
  }
  const box = dimensions(p);
  if (matrixIds.includes(p.templateId)) {
    if (
      box.w -
        box.left -
        box.right -
        (p.templateId === "mantel" ? 175 : 0) -
        annotationSize(p, "row") <
        70 ||
      box.h - box.top - box.bottom - annotationSize(p, "column") < 90
    )
      issues.push(error("画布扣除边距与注释后空间不足，请增大画布或减小边距"));
    if (
      annotationSize(p, "row") > box.iw * 0.55 ||
      annotationSize(p, "column") > box.ih * 0.5
    )
      issues.push(error("注释占用空间过多，请增大画布或减小注释宽度"));
    if (
      p.templateId === "circle-heatmap" &&
      annotationSize(p, "row") > Math.min(box.iw, box.ih) * 0.22
    )
      issues.push(error("圈形行注释过宽，请增大画布或减少轨道宽度"));
  }
  if (
    p.templateId === "genome-circos" &&
    extraTracks(p).reduce(
      (sum, l) => sum + Number(l.settings.size || 22) + 6,
      0,
    ) +
      2 * Number(p.style.trackWidth || 28) +
      Number(p.style.chromosomeWidth || 18) +
      55 >
      Math.min(box.iw, box.ih) * 0.4
  )
    issues.push(
      error("动态轨道超过当前圆环可用空间，请减少轨道宽度或增大画布"),
    );
  return issues;
}
export function SpecialPanel({
  project: p,
  commit,
}: {
  project: Project;
  commit: (p: Project) => void;
}) {
  const matrix = matrixIds.includes(p.templateId),
    gene = p.templateId === "gene-cluster",
    genome = p.templateId === "genome-circos";
  const [kind, setKind] = useState("matrix-row-color"),
    [errorText, setError] = useState("");
  if (!matrix && !gene && !genome) return null;
  const options = matrix
    ? [
        ["matrix-row-color", "行分类色带"],
        ["matrix-row-bar", "行数值条形"],
        ["matrix-row-text", "行文字注释"],
        ["matrix-column-color", "列分类色带"],
        ["matrix-column-bar", "列数值条形"],
        ["matrix-column-text", "列文字注释"],
      ]
    : gene
      ? [["gene-break", "基因簇断轴区间"]]
      : [["genome-track", "自定义数值轨道"]];
  const active = options.some((o) => o[0] === kind) ? kind : options[0][0];
  const owned = (l: Layer) =>
    l.type.startsWith("matrix-") ||
    ["gene-break", "genome-track"].includes(l.type);
  const update = (id: string, fn: (l: Layer) => Layer) =>
    commit({ ...p, layers: p.layers.map((l) => (l.id === id ? fn(l) : l)) });
  const axes = matrixAxes(p);
  function add() {
    const id = crypto.randomUUID();
    let t: DataTable;
    if (matrix) {
      const labels = active.includes("-row-") ? axes.rows : axes.columns;
      t = table(
        id,
        "注释数据",
        "annotation",
        ["标签", "值"],
        labels.map((n, i) => [
          n,
          active.endsWith("-bar")
            ? i + 1
            : active.endsWith("-text")
              ? `注释 ${i + 1}`
              : `分组 ${(i % 2) + 1}`,
        ]),
      );
    } else if (gene) {
      const g = p.dataset.tables.find((t) => t.role === "genes")!,
        a = (k: string) => g.columns.indexOf(k),
        name = String(g.rows[0][a("cluster")]);
      const rows = g.rows
        .filter((r) => r[a("cluster")] === name)
        .sort((x, y) => Number(x[a("start")]) - Number(y[a("start")]));
      let start = 1,
        end = 2;
      for (let i = 1; i < rows.length; i++)
        if (Number(rows[i][a("start")]) - Number(rows[i - 1][a("end")]) > 2) {
          start = Number(rows[i - 1][a("end")]) + 1;
          end = Number(rows[i][a("start")]) - 1;
          break;
        }
      t = table(
        id,
        "断轴区间",
        "gene-break",
        ["cluster", "start", "end"],
        [[name, start, end]],
      );
    } else {
      const raw = p.analysis?.result?.data as
        | {
            sequences?: {
              name: string;
              gcContent: { start: number; end: number; value: number | null }[];
            }[];
          }
        | undefined;
      const source =
        p.style.genomeInput === "fasta" && raw?.sequences
          ? table(
              id,
              "真实GC窗口",
              "tracks",
              ["chromosome", "start", "end", "value", "type"],
              raw.sequences.flatMap((c) =>
                c.gcContent
                  .filter((w) => w.value !== null)
                  .map((w) => [c.name, w.start, w.end, w.value!, "gc-content"]),
              ),
            )
          : p.dataset.tables.find((t) => t.role === "tracks");
      t = source
        ? table(
            id,
            "自定义轨道数据",
            "genome-track",
            ["chromosome", "start", "end", "value"],
            source.rows
              .filter((r) => r[4] !== "gc-skew")
              .map((r) => r.slice(0, 4)),
          )
        : table(
            id,
            "自定义轨道数据",
            "genome-track",
            ["chromosome", "start", "end", "value"],
            [],
          );
    }
    commit({
      ...p,
      layers: [
        ...p.layers,
        {
          id,
          type: active,
          name: options.find((o) => o[0] === active)![1],
          visible: true,
          data: dataset(t),
          settings: {
            size: 22,
            color: "#397e99",
            negativeColor: "#d2786c",
            kind: "bar",
            pointSize: 3,
          },
        },
      ],
    });
  }
  return (
    <section className="special-panel">
      <h3>{matrix ? "行列注释" : gene ? "断轴配置" : "动态轨道"}</h3>
      <p className="hint">数据、顺序、显示状态与设置都随项目保存。</p>
      <select
        aria-label="专有图层类型"
        value={active}
        onChange={(e) => setKind(e.target.value)}
      >
        {options.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <button className="wide" onClick={add}>
        添加{gene ? "断轴" : genome ? "轨道" : "注释"}
      </button>
      {errorText && <p className="error">{errorText}</p>}
      {p.layers.filter(owned).map((l) => {
        const t = l.data?.tables[0];
        return (
          <details open key={l.id}>
            <summary>{l.name}</summary>
            <label>
              名称
              <input
                value={l.name}
                onChange={(e) =>
                  update(l.id, (l) => ({ ...l, name: e.target.value }))
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={l.visible}
                onChange={(e) =>
                  update(l.id, (l) => ({ ...l, visible: e.target.checked }))
                }
              />
              显示
            </label>
            {l.type !== "gene-break" && (
              <>
                <label>
                  轨道宽度
                  <input
                    type="number"
                    min={10}
                    max={80}
                    value={Number(l.settings.size) || 22}
                    onChange={(e) =>
                      update(l.id, (l) => ({
                        ...l,
                        settings: {
                          ...l.settings,
                          size: Math.max(10, Math.min(80, +e.target.value)),
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  颜色
                  <input
                    type="color"
                    value={String(l.settings.color || "#397e99")}
                    onChange={(e) =>
                      update(l.id, (l) => ({
                        ...l,
                        settings: { ...l.settings, color: e.target.value },
                      }))
                    }
                  />
                </label>
              </>
            )}
            {l.type === "genome-track" && (
              <label>
                轨道图形
                <select
                  value={String(l.settings.kind || "bar")}
                  onChange={(e) =>
                    update(l.id, (l) => ({
                      ...l,
                      settings: { ...l.settings, kind: e.target.value },
                    }))
                  }
                >
                  {[
                    ["bar", "柱形"],
                    ["line", "折线"],
                    ["point", "散点"],
                    ["heatmap", "色带"],
                  ].map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              上传本层数据
              <input
                type="file"
                accept=".csv,.tsv,.xls,.xlsx"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const d = await parseFile(f);
                    if (!d.tables[0]) throw new Error("文件没有表格");
                    update(l.id, (l) => ({
                      ...l,
                      data: dataset({ ...d.tables[0], role: l.type, id: l.id }),
                    }));
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </label>
            {t && (
              <>
                <textarea
                  aria-label={`${l.name}数据`}
                  rows={5}
                  value={[t.columns, ...t.rows]
                    .map((r) => r.join("\t"))
                    .join("\n")}
                  onChange={(e) => {
                    try {
                      const parsed = parseText(e.target.value, "\t");
                      update(l.id, (l) => ({
                        ...l,
                        data: dataset({
                          ...parsed,
                          id: l.id,
                          name: l.name,
                          role: l.type,
                        }),
                      }));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
                <p className="hint">
                  第一行是列标题，用制表符分隔；名称必须匹配基础数据。
                </p>
              </>
            )}
            <div className="button-row">
              <button
                onClick={() => {
                  const layers = [...p.layers],
                    i = layers.findIndex((x) => x.id === l.id);
                  if (i > 0) {
                    [layers[i - 1], layers[i]] = [layers[i], layers[i - 1]];
                    commit({ ...p, layers });
                  }
                }}
              >
                上移
              </button>
              <button
                onClick={() => {
                  const layers = [...p.layers],
                    i = layers.findIndex((x) => x.id === l.id);
                  if (i < layers.length - 1) {
                    [layers[i + 1], layers[i]] = [layers[i], layers[i + 1]];
                    commit({ ...p, layers });
                  }
                }}
              >
                下移
              </button>
              <button
                onClick={() =>
                  commit({
                    ...p,
                    layers: p.layers.filter((x) => x.id !== l.id),
                  })
                }
              >
                删除
              </button>
            </div>
          </details>
        );
      })}
      {specialProjectIssues(p).map((i, n) => (
        <p key={n} className="error">
          {i.message}
        </p>
      ))}
    </section>
  );
}
export function MatrixAnnotations({
  project: p,
  rows,
  columns,
  x,
  y,
  width,
  height,
}: {
  project: Project;
  rows: string[];
  columns: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const pal = palette(p);
  return (
    <g data-special-layer="matrix-annotations">
      {(["row", "column"] as const).flatMap((axis) => {
        let offset = 4;
        return annotationLayers(p, axis).map((l) => {
          const size = Math.max(
              10,
              Math.min(80, Number(l.settings.size) || 22),
            ),
            at = offset;
          offset += size + 4;
          const t = l.data?.tables[0],
            lookup = new Map(t?.rows.map((r) => [String(r[0]), r[1]]) ?? []),
            names = axis === "row" ? rows : columns,
            categories = Array.from(
              new Set(t?.rows.map((r) => String(r[1])) ?? []),
            ),
            values =
              t?.rows.map((r) => Number(r[1])).filter(Number.isFinite) ?? [],
            max = Math.max(...values.map(Math.abs), 1e-9);
          return (
            <g key={l.id}>
              {names.map((name, i) => {
                const v = lookup.get(name);
                if (v === undefined) return null;
                const bx =
                    axis === "row"
                      ? x - at - size
                      : x + (i * width) / names.length,
                  by =
                    axis === "row"
                      ? y + (i * height) / names.length
                      : y - at - size,
                  bw = axis === "row" ? size : width / names.length,
                  bh = axis === "row" ? height / names.length : size,
                  color = l.type.endsWith("-color")
                    ? pal[categories.indexOf(String(v)) % pal.length]
                    : String(l.settings.color || "#397e99");
                return (
                  <g key={name}>
                    <title>{`${l.name}：${name} = ${v}`}</title>
                    {l.type.endsWith("-text") ? (
                      <text
                        x={bx + bw / 2}
                        y={by + bh / 2}
                        dominantBaseline="middle"
                        textAnchor="middle"
                        fontSize={Math.min(10, size * 0.6)}
                        transform={
                          axis === "column"
                            ? `rotate(-90,${bx + bw / 2},${by + bh / 2})`
                            : undefined
                        }
                      >
                        {String(v)}
                      </text>
                    ) : l.type.endsWith("-bar") ? (
                      <rect
                        x={
                          axis === "row"
                            ? bx +
                              bw / 2 -
                              (Number(v) < 0
                                ? ((Math.abs(Number(v)) / max) * bw) / 2
                                : 0)
                            : bx + bw * 0.12
                        }
                        y={
                          axis === "row"
                            ? by + bh * 0.12
                            : by +
                              bh / 2 -
                              (Number(v) > 0 ? ((Number(v) / max) * bh) / 2 : 0)
                        }
                        width={
                          axis === "row"
                            ? ((Math.abs(Number(v)) / max) * bw) / 2
                            : bw * 0.76
                        }
                        height={
                          axis === "row"
                            ? bh * 0.76
                            : ((Math.abs(Number(v)) / max) * bh) / 2
                        }
                        fill={
                          Number(v) < 0
                            ? String(l.settings.negativeColor || "#d2786c")
                            : color
                        }
                      />
                    ) : (
                      <rect
                        x={bx}
                        y={by}
                        width={Math.max(1, bw - 1)}
                        height={Math.max(1, bh - 1)}
                        fill={color}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          );
        });
      })}
    </g>
  );
}
export function CircleAnnotations({
  project: p,
  rows,
  columns,
  cx,
  cy,
  inner,
  outer,
  start,
  sweep,
}: {
  project: Project;
  rows: string[];
  columns: string[];
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  start: number;
  sweep: number;
}) {
  const pal = palette(p),
    point = (r: number, a: number) => [
      cx + r * Math.cos(a),
      cy + r * Math.sin(a),
    ],
    arc = (r0: number, r1: number, a: number, b: number) =>
      `M${point(r1, a)} A${r1},${r1} 0 ${b - a > Math.PI ? 1 : 0},1 ${point(r1, b)} L${point(r0, b)} A${r0},${r0} 0 ${b - a > Math.PI ? 1 : 0},0 ${point(r0, a)} Z`;
  return (
    <g data-special-layer="circle-annotations">
      {(["row", "column"] as const).flatMap((axis) => {
        let offset = 0;
        const layers = annotationLayers(p, axis);
        return layers.map((l, li) => {
          const t = l.data?.tables[0],
            lookup = new Map(t?.rows.map((r) => [String(r[0]), r[1]]) ?? []),
            cats = Array.from(new Set(t?.rows.map((r) => String(r[1])) ?? [])),
            size = Math.max(10, Math.min(80, Number(l.settings.size) || 22)),
            at = offset;
          offset += size + 4;
          const max = Math.max(
            ...(t?.rows
              .map((r) => Math.abs(Number(r[1])))
              .filter(Number.isFinite) ?? []),
            1e-9,
          );
          return (axis === "row" ? rows : columns).map((n, i) => {
            const v = lookup.get(n);
            if (v === undefined) return null;
            const a =
                axis === "row"
                  ? start + (i * sweep) / rows.length
                  : start +
                    sweep +
                    0.04 +
                    li *
                      Math.max(
                        0.04,
                        (2 * Math.PI - sweep - 0.12) /
                          (layers.length *
                            (p.analysis?.method === "cluster" &&
                            p.analysis.result
                              ? 2
                              : 1)),
                      ),
              b =
                axis === "row"
                  ? start + ((i + 1) * sweep) / rows.length
                  : a +
                    Math.max(
                      0.035,
                      (2 * Math.PI - sweep - 0.12) /
                        (layers.length *
                          (p.analysis?.method === "cluster" && p.analysis.result
                            ? 2
                            : 1)),
                    ) -
                    0.02,
              r0 =
                axis === "row"
                  ? outer + 5 + at
                  : inner + (i * (outer - inner)) / columns.length,
              r1 =
                axis === "row"
                  ? r0 + size
                  : inner + ((i + 1) * (outer - inner)) / columns.length;
            const color = l.type.endsWith("-color")
                ? pal[cats.indexOf(String(v)) % pal.length]
                : String(l.settings.color || "#397e99"),
              radius = l.type.endsWith("-bar")
                ? r0 + ((r1 - r0) * Math.abs(Number(v))) / max
                : r1;
            return (
              <g key={`${l.id}-${n}`}>
                <title>{`${l.name}；${n} = ${v}`}</title>
                {l.type.endsWith("-text") ? (
                  <text
                    x={point((r0 + r1) / 2, (a + b) / 2)[0]}
                    y={point((r0 + r1) / 2, (a + b) / 2)[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
                  >
                    {String(v)}
                  </text>
                ) : (
                  <path
                    d={arc(
                      r0,
                      Math.max(r0 + 0.1, radius),
                      a + 0.003,
                      b - 0.003,
                    )}
                    fill={
                      Number(v) < 0
                        ? String(l.settings.negativeColor || "#d2786c")
                        : color
                    }
                  />
                )}
              </g>
            );
          });
        });
      })}
    </g>
  );
}
export function AnnotationLegend({
  project: p,
  x,
  y,
  width,
}: {
  project: Project;
  x: number;
  y: number;
  width: number;
}) {
  if (!p.style.showLegend) return null;
  const items = p.layers
    .filter((l) => l.visible && l.type.startsWith("matrix-"))
    .flatMap((l) => {
      const t = l.data?.tables[0];
      if (!t) return [];
      if (l.type.endsWith("-color"))
        return Array.from(new Set(t.rows.map((r) => String(r[1])))).map(
          (name, i) => ({
            name: `${l.name}：${name}`,
            color: palette(p)[i % palette(p).length],
          }),
        );
      const numbers = t.rows.map((r) => Number(r[1])).filter(Number.isFinite);
      return [
        {
          name: l.type.endsWith("-bar")
            ? `${l.name}：${Math.min(...numbers)}～${Math.max(...numbers)}`
            : l.name,
          color: String(l.settings.color || "#397e99"),
        },
      ];
    });
  const count = Math.max(1, Math.floor(width / 160));
  return (
    <g data-special-layer="annotation-legend">
      {items.map((item, i) => (
        <g
          key={i}
          transform={`translate(${x + (i % count) * (width / count)},${y + Math.floor(i / count) * 16})`}
        >
          <rect y={-7} width={8} height={8} fill={item.color} />
          <text x={13} fontSize={9}>
            {item.name}
          </text>
        </g>
      ))}
    </g>
  );
}
