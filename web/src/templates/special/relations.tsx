import React, { useState } from "react";
import { symbolPath, symbolOptions } from "./symbols";
import { DraggableLabel } from "./interaction";
import { placeLabels, labelWidth } from "../../core/labelLayout";
import {
  forceCenter,
  forceX,
  forceY,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  hierarchy,
  pack,
} from "d3";
import type {
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

const vennExample = dataset(
  table(
    "sets",
    "基因集合模拟数据",
    "sets",
    ["处理甲", "处理乙", "处理丙"],
    [
      ["基因01", "基因02", "基因01"],
      ["基因02", "基因03", "基因04"],
      ["基因03", "基因04", "基因07"],
      ["基因05", "基因06", "基因08"],
      ["基因09", "基因09", "基因09"],
    ],
  ),
);
const vennAlternate = dataset(
  table(
    "sets",
    "四组模拟集合",
    "sets",
    ["队列A", "队列B", "队列C", "队列D"],
    [
      ["共同1", "共同1", "共同1", "共同1"],
      ["甲1", "乙1", "丙1", "丁1"],
      ["交集AB", "交集AB", "交集CD", "交集CD"],
      ["甲2", null, "乙丙", "乙丙"],
    ],
  ),
);
function setIssues(d: Dataset): Issue[] {
  const t = pick(d, "sets"),
    issues = tableShape(t, 2);
  if (t && t.columns.length > 5)
    issues.push(error("韦恩图支持 2～5 个集合，每列代表一个集合", t));
  return issues;
}
function Venn({ project: p, onLayoutChange }: RendererProps) {
  const issues = setIssues(p.dataset);
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const t = pick(p.dataset, "sets")!,
    { left, top, iw, ih } = dimensions(p),
    n = t.columns.length,
    pal = palette(p);
  const sets = t.columns.map(
    (_, j) =>
      new Set(t.rows.map((r) => String(r[j] ?? "").trim()).filter(Boolean)),
  );
  const members = new Map<string, number>();
  sets.forEach((s, i) =>
    s.forEach((x) => members.set(x, (members.get(x) || 0) | (1 << i))),
  );
  const regions = Array.from({ length: (1 << n) - 1 }, (_, i) => ({
    mask: i + 1,
    count: Array.from(members.values()).filter((m) => m === i + 1).length,
  }));
  const cx = left + iw * 0.32,
    cy = top + ih * 0.48,
    rx = Math.min(iw * 0.19, ih * 0.3) * value(p, "vennSize", 1),
    ry = n < 4 ? rx : rx * 0.63;
  const ring = n === 2 ? rx * 0.5 : rx * 0.62;
  const shapes = t.columns.map((name, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      name,
      i,
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring,
      angle: n < 4 ? 0 : (angle * 180) / Math.PI,
    };
  });
  const list = regions.filter(
      (r) => r.count > 0 || enabled(p, "showZero", false),
    ),
    listX = left + iw * 0.64,
    listH = Math.max(16, Math.min(24, ih / (list.length + 2)));
  return (
    <Frame project={p}>
      <g>
        {shapes.map((s) => (
          <g key={s.name}>
            <ellipse
              cx={s.x}
              cy={s.y}
              rx={rx}
              ry={ry}
              transform={`rotate(${s.angle},${s.x},${s.y})`}
              fill={pal[s.i % pal.length]}
              fillOpacity={value(p, "setOpacity", 0.35)}
              stroke={pal[s.i % pal.length]}
              strokeWidth={value(p, "setStroke", 2)}
            />
            {enabled(p, "showLabels") && (
              <DraggableLabel
                project={p}
                onLayoutChange={onLayoutChange}
                labelId={`venn-${s.name}`}
                x={cx + (s.x - cx) * 2.8}
                y={cy + (s.y - cy) * 2.8}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="bold"
                fontSize={value(p, "fontSize", 13)}
              >
                {s.name}（{sets[s.i].size}）
              </DraggableLabel>
            )}
          </g>
        ))}
        {n <= 3 && regions.filter(r=>r.count>0||enabled(p,"showZero",false)).map(region => {
          // Select the deepest point within this exact geometric membership.
          // A grid avoids hand-coded locations and works for both 2/3 circles.
          let best = {x:cx,y:cy,clearance:-Infinity};
          for(let xx=cx-rx*1.7;xx<=cx+rx*1.7;xx+=rx/24) for(let yy=cy-rx*1.7;yy<=cy+rx*1.7;yy+=rx/24) {
            const distances=shapes.map(s=>Math.hypot(xx-s.x,yy-s.y));
            const mask=distances.reduce((m,d,i)=>d<rx?m|(1<<i):m,0);
            const clearance=Math.min(...distances.map(d=>Math.abs(d-rx)));
            if(mask===region.mask&&clearance>best.clearance)best={x:xx,y:yy,clearance};
          }
          return best.clearance>0?<text key={region.mask} data-region-count={region.mask} x={best.x} y={best.y} textAnchor="middle" dominantBaseline="middle" fontWeight="700" fontSize={13}>{region.count}</text>:null;
        })}
        <text x={cx} y={top + ih - 4} textAnchor="middle" fontSize={p.style.publicationVersion ? 14 : 11}>
          {n<=3?"轮廓示意；区域数字为精确互斥计数":"轮廓示意；复杂交集建议使用 UpSet"}
        </text>
        <text x={listX} y={top} fontSize={13} fontWeight="bold">
          互斥区域（不重复计数）
        </text>
        {list.map((r, i) => {
          const names = t.columns.filter((_, j) => r.mask & (1 << j));
          return (
            <g
              key={r.mask}
              transform={`translate(${listX},${top + 24 + i * listH})`}
            >
              <rect
                width={Math.max(
                  1,
                  (r.count / Math.max(...list.map((x) => x.count), 1)) *
                    iw *
                    0.14,
                )}
                height={listH * 0.65}
                y={-listH * 0.45}
                fill={pal[names.length % pal.length]}
                opacity={0.25}
              />
              <text x={0} fontSize={Math.min(11, listH * 0.7)}>
                {names.join("∩")}
              </text>
              <text
                x={iw * 0.32}
                textAnchor="end"
                fontWeight="bold"
                fontSize={Math.min(12, listH * 0.75)}
              >
                {r.count}
              </text>
              <title>{`仅属于 ${names.join("、")} 的元素：${
                Array.from(members.entries())
                  .filter(([, mask]) => mask === r.mask)
                  .map(([x]) => x)
                  .join("、") || "无"
              }`}</title>
            </g>
          );
        })}
        {enabled(p, "showLegend") && (
          <text x={listX} y={top + ih + 25} fontSize={p.style.publicationVersion ? 14 : 11}>
            并集 {members.size} 项；集合内重复元素自动去重
          </text>
        )}
      </g>
    </Frame>
  );
}

const packingExample = dataset(
  table(
    "items",
    "丰度模拟数据",
    "items",
    ["name", "value", "group"],
    [
      ["细菌甲", 18, "土壤"],
      ["细菌乙", 32, "土壤"],
      ["细菌丙", 11, "土壤"],
      ["真菌甲", 27, "叶片"],
      ["真菌乙", 14, "叶片"],
      ["真菌丙", 9, "叶片"],
      ["古菌甲", 7, "水体"],
    ],
  ),
);
const packingAlternate = dataset(
  table(
    "items",
    "替换丰度",
    "items",
    ["name", "value", "group"],
    [
      ["蛋白A", 60, "胞质"],
      ["蛋白B", 15, "胞质"],
      ["蛋白C", 35, "细胞核"],
      ["蛋白D", 22, "细胞核"],
    ],
  ),
);
function packingIssues(d: Dataset): Issue[] {
  const t = pick(d, "items"),
    issues = tableShape(t, 3);
  if (!t) return issues;
  issues.push(...required(t, ["name", "value", "group"]));
  if (issues.length) return issues;
  issues.push(...uniqueIds(t, t.columns.indexOf("name")));
  t.rows.forEach((r, i) => {
    numericCell(t, i, t.columns.indexOf("value"), issues, { min: 0 });
    if (!String(r[t.columns.indexOf("group")] ?? "").trim())
      issues.push(rowIssue(t, i, t.columns.indexOf("group"), "分组不能为空"));
  });
  if (!t.rows.some((r) => Number(r[t.columns.indexOf("value")]) > 0))
    issues.push(error("至少需要一个大于 0 的数值", t));
  return issues;
}
type PackNode = {
  name: string;
  value?: number;
  group?: string;
  children?: PackNode[];
};
function Packing({ project: p }: RendererProps) {
  const issues = packingIssues(p.dataset);
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const t = pick(p.dataset, "items")!,
    { left, top, iw, ih } = dimensions(p),
    pal = palette(p),
    name = t.columns.indexOf("name"),
    v = t.columns.indexOf("value"),
    g = t.columns.indexOf("group");
  let items: PackNode[] = t.rows
    .filter((r) => Number(r[v]) > 0)
    .map((r) => ({
      name: String(r[name]),
      value: Number(r[v]),
      group: String(r[g]),
    }));
  const groups = Array.from(new Set(items.map((x) => x.group!)));
  if (text(p, "packingSort", "value") === "name")
    items = items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const nested = enabled(p, "groupPacking", true);
  const data: PackNode = {
    name: "全部",
    children: nested
      ? groups.map((group) => ({
          name: group,
          group,
          children: items.filter((x) => x.group === group),
        }))
      : items,
  };
  const root = hierarchy(data).sum((d) => d.value ?? 0);
  if (text(p, "packingSort", "value") === "value")
    root.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const layout = pack<PackNode>()
    .size([iw, ih])
    .padding(value(p, "packingGap", 5))(root);
  return (
    <Frame project={p}>
      <g transform={`translate(${left},${top})`}>
        {nested &&
          layout
            .descendants()
            .filter((n) => n.depth === 1)
            .map((n) => (
              <circle
                key={n.data.name}
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={pal[groups.indexOf(n.data.name) % pal.length]}
                fillOpacity={0.07}
                stroke={pal[groups.indexOf(n.data.name) % pal.length]}
                strokeWidth={enabled(p, "showGroupOutline", true) ? 1.5 : 0}
              />
            ))}
        {layout.leaves().map((n) => (
          <g key={n.data.name}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={pal[groups.indexOf(n.data.group!) % pal.length]}
              stroke={text(p, "circleStrokeColor", "#ffffff")}
              strokeWidth={value(p, "circleStroke", 1.5)}
            >
              <title>{`${n.data.name}；${n.data.group}；${n.value}`}</title>
            </circle>
            {enabled(p, "showLabels") && n.r > 15 && (
              <text
                x={n.x}
                y={n.y + (enabled(p, "showValues", true) ? -4 : 4)}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={Math.min(value(p, "fontSize", 13), n.r * 0.33)}
              >
                {n.data.name}
              </text>
            )}
            {enabled(p, "showValues", true) && n.r > 12 && (
              <text
                x={n.x}
                y={n.y + 13}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={Math.min(12, n.r * 0.3)}
              >
                {fmt(n.value ?? 0)}
              </text>
            )}
          </g>
        ))}
      </g>
      {enabled(p, "showLegend") &&
        groups.map((group, i) => (
          <g
            key={group}
            transform={`translate(${left + i * 130},${top + ih + 30})`}
          >
            <circle r={5} fill={pal[i % pal.length]} />
            <text x={12} y={4} fontSize={p.style.publicationVersion ? 14 : 11}>
              {group}
            </text>
          </g>
        ))}
    </Frame>
  );
}

const flowExample = dataset(
  table(
    "links",
    "能量流模拟数据",
    "links",
    ["source", "target", "value"],
    [
      ["太阳能", "电力", 45],
      ["风能", "电力", 32],
      ["天然气", "热力", 38],
      ["电力", "工业", 40],
      ["电力", "居民", 37],
      ["热力", "工业", 22],
      ["热力", "居民", 16],
    ],
  ),
);
const flowAlternate = dataset(
  table(
    "links",
    "另一组流量",
    "links",
    ["source", "target", "value"],
    [
      ["样本库", "通过质控", 70],
      ["样本库", "未通过", 30],
      ["通过质控", "分析甲", 45],
      ["通过质控", "分析乙", 25],
    ],
  ),
);
export function flowIssues(d: Dataset): Issue[] {
  const t = pick(d, "links"),
    issues = tableShape(t, 3);
  if (!t) return issues;
  issues.push(...required(t, ["source", "target", "value"]));
  if (issues.length) return issues;
  const s = t.columns.indexOf("source"),
    e = t.columns.indexOf("target"),
    v = t.columns.indexOf("value");
  const adj = new Map<string, string[]>();
  t.rows.forEach((r, i) => {
    const a = String(r[s] ?? "").trim(),
      b = String(r[e] ?? "").trim();
    if (!a) issues.push(rowIssue(t, i, s, "来源不能为空"));
    if (!b) issues.push(rowIssue(t, i, e, "去向不能为空"));
    if (a === b) issues.push(rowIssue(t, i, e, "来源和去向不能是同一节点"));
    numericCell(t, i, v, issues, { min: 0 });
    adj.set(a, [...(adj.get(a) ?? []), b]);
  });
  const visiting = new Set<string>(),
    done = new Set<string>();
  let cycle = "";
  const visit = (a: string) => {
    if (visiting.has(a)) {
      cycle = a;
      return;
    }
    if (done.has(a) || cycle) return;
    visiting.add(a);
    for (const b of adj.get(a) ?? []) visit(b);
    visiting.delete(a);
    done.add(a);
  };
  for (const a of adj.keys()) visit(a);
  if (cycle)
    issues.push(
      error(
        `流向包含环路（经过“${cycle}”）；桑基图需要从来源到终点的无环方向`,
        t,
      ),
    );
  if (!t.rows.some((r) => Number(r[v]) > 0))
    issues.push(error("至少需要一条大于 0 的流量", t));
  if (adj.size > 100)
    issues.push(error("桑基图最多支持 100 个来源节点，请先合并或筛选", t));
  return issues;
}
function Sankey({ project: p }: RendererProps) {
  const issues = flowIssues(p.dataset);
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const t = pick(p.dataset, "links")!,
    { left, top, iw, ih } = dimensions(p),
    pal = palette(p),
    s = t.columns.indexOf("source"),
    e = t.columns.indexOf("target"),
    v = t.columns.indexOf("value");
  const links = t.rows
    .filter((r) => Number(r[v]) > 0)
    .map((r) => ({
      source: String(r[s]),
      target: String(r[e]),
      value: Number(r[v]),
    }));
  const names = Array.from(new Set(links.flatMap((l) => [l.source, l.target])));
  const depth = new Map<string, number>(names.map((n) => [n, 0]));
  for (let k = 0; k < names.length; k++)
    links.forEach((l) =>
      depth.set(
        l.target,
        Math.max(depth.get(l.target)!, depth.get(l.source)! + 1),
      ),
    );
  const maxDepth = Math.max(...depth.values(), 1),
    align = text(p, "flowAlign", "justify");
  if (align === "justify")
    names
      .filter((n) => !links.some((l) => l.source === n))
      .forEach((n) => depth.set(n, maxDepth));
  if (align === "right") {
    const remain = new Map(names.map((n) => [n, 0]));
    for (let k = 0; k < names.length; k++)
      links
        .slice()
        .reverse()
        .forEach((l) =>
          remain.set(
            l.source,
            Math.max(remain.get(l.source)!, remain.get(l.target)! + 1),
          ),
        );
    names.forEach((n) => depth.set(n, maxDepth - remain.get(n)!));
  }
  const amounts = new Map(
    names.map((n) => [
      n,
      Math.max(
        links.filter((l) => l.source === n).reduce((a, l) => a + l.value, 0),
        links.filter((l) => l.target === n).reduce((a, l) => a + l.value, 0),
      ),
    ]),
  );
  const byDepth = Array.from({ length: maxDepth + 1 }, (_, i) =>
    names.filter((n) => depth.get(n) === i),
  );
  if (text(p, "flowSort", "input") === "value")
    byDepth.forEach((a) => a.sort((x, y) => amounts.get(y)! - amounts.get(x)!));
  const gap = value(p, "nodeGap", 18),
    nodeWidth = value(p, "nodeWidth", 18);
  const scale = Math.min(
    ...byDepth
      .filter((a) => a.length)
      .map(
        (a) =>
          Math.max(20, ih - gap * (a.length - 1)) /
          a.reduce((sum, n) => sum + amounts.get(n)!, 0),
      ),
  );
  const pos = new Map<string, { x: number; y: number; h: number }>();
  byDepth.forEach((a, i) => {
    let y =
      (ih -
        a.reduce((sum, n) => sum + amounts.get(n)! * scale, 0) -
        gap * (a.length - 1)) /
      2;
    a.forEach((n) => {
      pos.set(n, {
        x: left + (i * (iw - nodeWidth)) / maxDepth,
        y: top + y,
        h: amounts.get(n)! * scale,
      });
      y += amounts.get(n)! * scale + gap;
    });
  });
  const src = new Map(names.map((n) => [n, 0])),
    dst = new Map(names.map((n) => [n, 0]));
  return (
    <Frame project={p}>
      <defs>
        {links.map((l, i) => (
          <linearGradient
            key={i}
            id={`flow-gradient-${p.id}-${i}`}
            x1="0%"
            x2="100%"
          >
            <stop
              offset="0%"
              stopColor={pal[names.indexOf(l.source) % pal.length]}
            />
            <stop
              offset="100%"
              stopColor={pal[names.indexOf(l.target) % pal.length]}
            />
          </linearGradient>
        ))}
      </defs>
      {links.map((l, i) => {
        const a = pos.get(l.source)!,
          b = pos.get(l.target)!,
          thickness = l.value * scale,
          y0 = a.y + src.get(l.source)! + thickness / 2,
          y1 = b.y + dst.get(l.target)! + thickness / 2;
        src.set(l.source, src.get(l.source)! + thickness);
        dst.set(l.target, dst.get(l.target)! + thickness);
        const x0 = a.x + nodeWidth,
          x1 = b.x,
          c = (x1 - x0) * value(p, "flowCurvature", 0.5),
          mode = text(p, "flowColor", "source");
        return (
          <path
            key={i}
            d={`M${x0},${y0} C${x0 + c},${y0} ${x1 - c},${y1} ${x1},${y1}`}
            stroke={
              mode === "gradient"
                ? `url(#flow-gradient-${p.id}-${i})`
                : mode === "target"
                  ? pal[names.indexOf(l.target) % pal.length]
                  : mode === "gray"
                    ? "#9cabb1"
                    : pal[names.indexOf(l.source) % pal.length]
            }
            strokeWidth={Math.max(0.4, thickness)}
            strokeOpacity={value(p, "flowOpacity", 0.35)}
            fill="none"
          >
            <title>{`${l.source} → ${l.target}：${fmt(l.value)}`}</title>
          </path>
        );
      })}
      {names.map((n, i) => {
        const a = pos.get(n)!;
        return (
          <g key={n}>
            <rect
              x={a.x}
              y={a.y}
              width={nodeWidth}
              height={a.h}
              rx={value(p, "nodeRadius", 2)}
              fill={pal[i % pal.length]}
            />
            {(enabled(p, "showLabels") || enabled(p,"showValues",true)) && (
              <text
                x={a.x + (depth.get(n) === maxDepth ? -7 : nodeWidth + 7)}
                y={a.y + a.h / 2}
                dominantBaseline="middle"
                textAnchor={depth.get(n) === maxDepth ? "end" : "start"}
                fontSize={value(p, "fontSize", 13)}
              >
                {enabled(p,"showLabels") ? n : ""}
                {enabled(p, "showValues", true)
                  ? ` ${fmt(amounts.get(n)!)}`
                  : ""}
              </text>
            )}
          </g>
        );
      })}
      {enabled(p, "showLegend") && (
        <text x={left} y={top + ih + 32} fontSize={p.style.publicationVersion ? 14 : 11}>
          流带宽度与流量成正比 · 节点数 {names.length} · 连线数 {links.length}
        </text>
      )}
    </Frame>
  );
}

const networkExample = dataset(
  table(
    "nodes",
    "节点模拟数据",
    "nodes",
    ["id", "label", "group", "size"],
    [
      ["n1", "研究主题A", "主题", 22],
      ["n2", "研究主题B", "主题", 18],
      ["n3", "方法甲", "方法", 13],
      ["n4", "方法乙", "方法", 15],
      ["n5", "数据集甲", "数据", 11],
      ["n6", "数据集乙", "数据", 16],
    ],
  ),
  table(
    "edges",
    "关系模拟数据",
    "edges",
    ["source", "target", "weight"],
    [
      ["n1", "n3", 3],
      ["n1", "n4", 1],
      ["n2", "n4", 2],
      ["n3", "n5", 4],
      ["n4", "n6", 3],
      ["n2", "n6", 1],
      ["n1", "n2", 2],
    ],
  ),
);
const networkAlternate = dataset(
  table(
    "nodes",
    "第二组节点",
    "nodes",
    ["id", "label", "group", "size"],
    [
      ["a", "中心课题", "课题", 24],
      ["b", "实验一", "实验", 12],
      ["c", "实验二", "实验", 18],
      ["d", "实验三", "实验", 10],
    ],
  ),
  table(
    "edges",
    "第二组关系",
    "edges",
    ["source", "target", "weight"],
    [
      ["a", "b", 2],
      ["a", "c", 5],
      ["a", "d", 1],
    ],
  ),
);
function networkIssues(d: Dataset, style?: Project["style"]): Issue[] {
  const nodes = pick(d, "nodes"),
    edges = d.tables.find((t) => t.role === "edges");
  let issues = tableShape(nodes, 2);
  if (!nodes) return issues;
  if (style?.nodeShapeMode === "column" && !nodes.columns.includes("shape"))
    issues.push(
      error("节点形状选择了读取 shape 列，但节点表缺少“shape”列", nodes),
    );
  issues.push(
    ...required(nodes, ["id", "label"]),
    ...uniqueIds(nodes, Math.max(0, nodes.columns.indexOf("id"))),
  );
  if (!edges)
    return [
      ...issues,
      error("缺少角色 edges 的边表，需要 source、target 和可选 weight 列"),
    ];
  issues.push(
    ...tableShape(edges, 2),
    ...required(edges, ["source", "target"]),
  );
  if (issues.length) return issues;
  const ids = new Set(
    nodes.rows.map((r) => String(r[nodes.columns.indexOf("id")])),
  );
  edges.rows.forEach((r, i) => {
    for (const c of ["source", "target"]) {
      const j = edges.columns.indexOf(c);
      if (!ids.has(String(r[j])))
        issues.push(rowIssue(edges, i, j, `节点“${r[j]}”未在节点表 id 列定义`));
    }
    if (edges.columns.includes("weight"))
      numericCell(edges, i, edges.columns.indexOf("weight"), issues, {
        min: 0,
      });
  });
  if (nodes.columns.includes("size"))
    nodes.rows.forEach((_, i) =>
      numericCell(nodes, i, nodes.columns.indexOf("size"), issues, { min: 1 }),
    );
  if (nodes.columns.includes("shape"))
    nodes.rows.forEach((r, i) => {
      if (
        !symbolOptions.some(
          (o) => o[0] === String(r[nodes.columns.indexOf("shape")]),
        )
      )
        issues.push(
          rowIssue(
            nodes,
            i,
            nodes.columns.indexOf("shape"),
            "节点形状须为 circle/cross/diamond/square/star/triangle/wye",
          ),
        );
    });
  if (nodes.rows.length > 300)
    issues.push(error("交互网络图最多支持 300 个节点，请先筛选", nodes));
  return issues;
}
type NetNode = {
  id: string;
  label: string;
  group: string;
  size: number;
  shape: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};
function Network({ project: p, onLayoutChange }: RendererProps) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const issues = networkIssues(p.dataset, p.style);
  if (issues.length) return <Invalid project={p} issues={issues} />;
  const nt = pick(p.dataset, "nodes")!,
    et = p.dataset.tables.find((t) => t.role === "edges")!,
    { left, top, iw, ih } = dimensions(p),
    pal = palette(p),
    at = (
      t: typeof nt,
      r: (string | number | null)[],
      key: string,
      fallback: unknown,
    ) => (t.columns.includes(key) ? r[t.columns.indexOf(key)] : fallback);
  const nodes: NetNode[] = nt.rows.map((r) => ({
    id: String(at(nt, r, "id", "")),
    label: String(at(nt, r, "label", "")),
    group: String(at(nt, r, "group", "未分组")),
    size: Number(at(nt, r, "size", 12)),
    shape: String(at(nt, r, "shape", "circle")),
  }));
  const links = et.rows.map((r) => ({
    source: String(at(et, r, "source", "")),
    target: String(at(et, r, "target", "")),
    weight: Number(at(et, r, "weight", 1)),
    label: String(at(et, r, "label", at(et, r, "id", ""))),
    group: String(at(et, r, "group", "未分组")),
  }));
  const groups = Array.from(new Set(nodes.map((n) => n.group)));
  const layout = text(p, "networkLayout", "force");
  if (layout === "circle")
    nodes.forEach((n, i) => {
      n.x =
        iw / 2 +
        Math.cos((i * 2 * Math.PI) / nodes.length - Math.PI / 2) *
          Math.min(iw, ih) *
          0.36;
      n.y =
        ih / 2 +
        Math.sin((i * 2 * Math.PI) / nodes.length - Math.PI / 2) *
          Math.min(iw, ih) *
          0.36;
    });
  else {
    forceSimulation<NetNode>(nodes)
      .force(
        "link",
        forceLink<NetNode, (typeof links)[number]>(links)
          .id((d) => d.id)
          .distance(value(p, "linkDistance", 100)),
      )
      .force("charge", forceManyBody().strength(-value(p, "repulsion", 160)))
      .force("center", forceCenter(iw / 2, ih / 2))
      .force('module-x', p.style.publicationVersion ? forceX<NetNode>(n=>iw*(.22+.56*(groups.indexOf(n.group)%2))).strength(.14) : null)
      .force('module-y', p.style.publicationVersion ? forceY<NetNode>(n=>ih*(.2+.6*Math.floor(groups.indexOf(n.group)/2)/Math.max(1,Math.ceil(groups.length/2)-1))).strength(.14) : null)
      .force(
        "collision",
        forceCollide<NetNode>().radius((n) => n.size + 14),
      )
      .stop()
      .tick(180);
  }
  const arrowId = `network-arrow-${p.id.replace(/[^a-z0-9]/gi, "")}`;
  const saved = p.layout?.nodePositions as
    | Record<string, { x: number; y: number }>
    | undefined;
  const index = new Map(nodes.map((n) => [n.id, n]));
  const nodeSize = (n: NetNode) =>
    text(p, "nodeSizeMode", "data") === "degree"
      ? 5 +
        Math.sqrt(
          et.rows.filter((r) =>
            [
              String(r[et.columns.indexOf("source")]),
              String(r[et.columns.indexOf("target")]),
            ].includes(n.id),
          ).length,
        ) *
          value(p, "nodeScale", 5)
      : Math.sqrt(n.size) * value(p, "nodeScale", 5);
  nodes.forEach((n) => {
    const chosen = drag?.id === n.id ? drag : saved?.[n.id];
    if (chosen) {
      n.x = chosen.x;
      n.y = chosen.y;
    }
    const r = nodeSize(n),
      hasLoop = et.rows.some(
        (row) =>
          row[et.columns.indexOf("source")] === n.id &&
          row[et.columns.indexOf("target")] === n.id,
      );
    n.x = Math.max(r + 20, Math.min(iw - r - 20, n.x ?? iw / 2));
    n.y = Math.max(
      r * (hasLoop ? 3.8 : 1) + 10,
      Math.min(ih - r - 28, n.y ?? ih / 2),
    );
  });
  const nodeColor = (n: NetNode) => pal[groups.indexOf(n.group) % pal.length];
  const labelPositions = placeLabels(nodes.map(n => ({ id:n.id, x:n.x!, y:n.y!+nodeSize(n)+12, text:n.label, size:value(p,"fontSize",13) })), iw, ih, nodes.map(n=>({x:n.x!,y:n.y!})));
  const edgeGroups = Array.from(new Set(links.map((l) => l.group)));
  const nodeShape = (n: NetNode) =>
    text(p, "nodeShapeMode", "uniform") === "column"
      ? n.shape
      : text(p, "nodeShapeMode", "uniform") === "group"
        ? symbolOptions[groups.indexOf(n.group) % symbolOptions.length][0]
        : text(p, "nodeShape", "circle");
  const endpoint = (n: unknown) =>
    typeof n === "string" ? index.get(n)! : (n as NetNode);
  const edgeColor = (l: (typeof links)[number]) =>
    text(p, "edgeColorMode", "uniform") === "source"
      ? nodeColor(endpoint(l.source))
      : text(p, "edgeColorMode", "uniform") === "target"
        ? nodeColor(endpoint(l.target))
        : text(p, "edgeColorMode", "uniform") === "group"
          ? pal[edgeGroups.indexOf(l.group) % pal.length]
          : text(p, "edgeColor", "#9aadb0");
  const locate = (e: React.PointerEvent<SVGGElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x - left, y: q.y - top };
  };
  return (
    <Frame project={p}>
      <defs>
        {links.map((l, i) => (
          <marker
            key={i}
            id={`${arrowId}-${i}`}
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={4}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill={edgeColor(l)} />
          </marker>
        ))}
      </defs>
      <g transform={`translate(${left},${top})`}>
        {links.map((l, i) => {
          const a =
              typeof l.source === "string"
                ? index.get(l.source)!
                : (l.source as unknown as NetNode),
            b =
              typeof l.target === "string"
                ? index.get(l.target)!
                : (l.target as unknown as NetNode);
          const self = a.id === b.id,
            loop = nodeSize(a) * 2.2;
          const curvature = text(p, "networkLinkShape", "straight") === "arc";
          const dx = b.x! - a.x!,
            dy = b.y! - a.y!,
            len = Math.hypot(dx, dy) || 1,
            offset = enabled(p, "directedEdges", false) ? nodeSize(b) + 6 : 0,
            ex = b.x! - (dx / len) * offset,
            ey = b.y! - (dy / len) * offset;
          return (
            <g key={i} data-network-edge={i}>
              <path
                markerEnd={
                  enabled(p, "directedEdges", false)
                    ? `url(#${arrowId}-${i})`
                    : undefined
                }
                d={
                  self
                    ? `M${a.x! + nodeSize(a) * 0.6},${a.y! - nodeSize(a) * 0.6} C${a.x! + loop},${a.y! - loop * 2} ${a.x! - loop},${a.y! - loop * 2} ${a.x! - nodeSize(a) * 0.6},${a.y! - nodeSize(a) * 0.6}`
                    : curvature
                      ? `M${a.x},${a.y} Q${((a.x ?? 0) + (b.x ?? 0)) / 2 + 20},${((a.y ?? 0) + (b.y ?? 0)) / 2 - 20} ${ex},${ey}`
                      : `M${a.x},${a.y} L${ex},${ey}`
                }
                stroke={edgeColor(l)}
                strokeWidth={
                  enabled(p, "weightedEdges", true)
                    ? Math.max(
                        0.5,
                        Math.sqrt(l.weight) * value(p, "edgeWidth", 1.5),
                      )
                    : value(p, "edgeWidth", 1.5)
                }
                fill="none"
                opacity={0.7}
              >
                <title>{`${a.label}—${b.label}；权重 ${l.weight}`}</title>
              </path>
              {enabled(p, "showEdgeLabels", false) && (
                <text
                  x={self ? a.x : (a.x! + b.x!) / 2 + (curvature ? 10 : 0)}
                  y={
                    self
                      ? a.y! - loop * 1.7
                      : (a.y! + b.y!) / 2 - (curvature ? 15 : 5)
                  }
                  fontSize={value(p, "edgeLabelSize", 11)}
                  textAnchor="middle"
                  fill={text(p, "edgeLabelColor", "#40555b")}
                >
                  {l.label || fmt(l.weight)}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            style={{ cursor: onLayoutChange ? "grab" : "default" }}
            onPointerDown={(e) => {
              if (!onLayoutChange) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ id: n.id, ...locate(e) });
            }}
            onPointerMove={(e) => {
              if (drag?.id === n.id) setDrag({ id: n.id, ...locate(e) });
            }}
            onPointerUp={(e) => {
              if (drag?.id === n.id) {
                onLayoutChange?.({
                  ...p.layout,
                  nodePositions: { ...saved, [n.id]: locate(e) },
                });
                setDrag(null);
              }
            }}
          >
            <title>{`${n.label}（${n.id}）；分组：${n.group}`}</title>
            <path
              d={symbolPath(nodeShape(n), nodeSize(n))}
              fill={pal[groups.indexOf(n.group) % pal.length]}
              fillOpacity={value(p, "nodeOpacity", 1)}
              stroke={text(p, "nodeStrokeColor", "#ffffff")}
              strokeWidth={value(p, "nodeStrokeWidth", 2)}
            />
          </g>
        ))}
      </g>
      {enabled(p, "showLabels") &&
        nodes.map((n) => (
          <DraggableLabel
            key={n.id}
            project={p}
            onLayoutChange={onLayoutChange}
            labelId={`network-${n.id}`}
            x={left + labelPositions[n.id].x + labelWidth(n.label,value(p,"fontSize",13))/2}
            y={top + labelPositions[n.id].y}
            textAnchor="middle"
            fontSize={value(p, "fontSize", 13)}
          >
            {n.label}
          </DraggableLabel>
        ))}
      {enabled(p, "showLegend") &&
        groups.map((g, i) => (
          <g
            key={g}
            transform={`translate(${left + i * 140},${top + ih + 30})`}
          >
            <path d={symbolPath(nodeShape(nodes.find(n=>n.group===g)!),5)} fill={pal[i % pal.length]} />
            <text x={12} y={4} fontSize={p.style.publicationVersion ? 14 : 11}>
              {g}
            </text>
          </g>
        ))}
      {enabled(p, "showLegend") &&
        text(p, "edgeColorMode", "uniform") === "group" &&
        edgeGroups.map((g, i) => (
          <g
            key={g}
            transform={`translate(${left + i * 140},${top + ih + 50})`}
          >
            <path d="M0,0L15,0" stroke={pal[i % pal.length]} strokeWidth={2} />
            <text x={20} y={4} fontSize={p.style.publicationVersion ? 13 : 10}>
              边：{g}
            </text>
          </g>
        ))}
    </Frame>
  );
}

export const relationTemplates: Template[] = [
  createTemplate(
    "venn",
    "韦恩集合交集图",
    "集合与关系",
    "导入 2～5 组元素，计算真实去重集合及互斥交集计数。",
    vennExample,
    vennAlternate,
    Venn,
    {
      validate: setIssues,
      controls: [
        num("vennSize", "集合轮廓大小", 0.5, 1.25, 0.05),
        num("setOpacity", "集合透明度", 0.1, 0.8, 0.05),
        num("setStroke", "轮廓线宽", 0, 5, 0.5),
        bool("showZero", "显示零计数区域"),
      ],
      inputHelp:
        "角色 sets：2～5 列，每列标题是唯一集合名，每个单元格是一个元素标识。不同长度集合可用空白补齐；空白忽略，重复元素自动去重。右侧显示只属于指定集合组合的互斥交集。可拖动集合标签避让，位置会保存进项目并用于图片导出。",
      limitations: [
        "集合轮廓为示意，面积不代表数量；精确交集全部在右侧计数表展示，避免在多集合轮廓中误标不存在的区域。",
      ],
      sourceUrls: ["https://www.chiplot.online/vennPlot.html"],
    },
  ),
  createTemplate(
    "packing",
    "分组圆堆砌图",
    "集合与关系",
    "按数值面积生成圆堆砌，支持分组包围圆和数值标注。",
    packingExample,
    packingAlternate,
    Packing,
    {
      validate: packingIssues,
      controls: [
        bool("groupPacking", "按分组包围"),
        bool("showGroupOutline", "显示分组轮廓"),
        num("packingGap", "圆间距", 0, 24),
        num("circleStroke", "描边宽度", 0, 8, 0.5),
        col("circleStrokeColor", "描边颜色"),
        bool("showValues", "显示数值"),
        opt("packingSort", "布局排序", [
          ["value", "数值降序"],
          ["name", "名称升序"],
        ]),
      ],
      inputHelp:
        "角色 items：name 是唯一名称，value 为非负数，group 为分组名。圆面积映射 value；值为 0 的项目不占面积。",
      sourceUrls: ["https://www.chiplot.online/packing_bubble_plot.html"],
    },
  ),
  createTemplate(
    "sankey",
    "桑基流向图",
    "集合与关系",
    "用流带宽度表达来源、流向和数量，真实计算节点及流带布局。",
    flowExample,
    flowAlternate,
    Sankey,
    {
      validate: flowIssues,
      defaultStyle: { title: "桑基流向图", marginLeft: 40, marginRight: 40 },
      controls: [
        num("nodeWidth", "节点宽度", 5, 50),
        num("nodeGap", "节点间距", 2, 60),
        num("nodeRadius", "节点圆角", 0, 12),
        num("flowOpacity", "流带透明度", 0.05, 1, 0.05),
        num("flowCurvature", "曲线弯曲程度", 0, 1, 0.05),
        opt("flowAlign", "节点对齐", [
          ["justify", "终点右对齐"],
          ["left", "按来源层级"],
          ["right", "按终点层级"],
        ]),
        opt("flowColor", "流带颜色", [
          ["source", "跟随来源"],
          ["target", "跟随目标"],
          ["gradient", "来源到目标渐变"],
          ["gray", "统一灰色"],
        ]),
        opt("flowSort", "同层排序", [
          ["input", "数据顺序"],
          ["value", "流量降序"],
        ]),
        bool("showValues", "节点显示流量"),
      ],
      inputHelp:
        "角色 links：source、target 为非空节点名称，value 为非负流量；节点自动生成。禁止来源等于去向，禁止有向环；多个同名流向记录分别显示，0 流量不显示。",
      limitations: [
        "仅支持有向无环流；可包含流入流出不等的中间节点，节点高度采用二者较大者。",
      ],
      sourceUrls: ["https://www.chiplot.online/sankey_plot.html"],
    },
  ),
  createTemplate(
    "network",
    "动态关系网络图",
    "集合与关系",
    "输入节点与边，按力导向或圆形布局展示网络，支持拖动节点并保存位置。",
    networkExample,
    networkAlternate,
    Network,
    {
      validate: networkIssues,
      controls: [
        opt("networkLayout", "布局", [
          ["force", "力导向"],
          ["circle", "圆形"],
        ]),
        num("linkDistance", "连线目标距离", 30, 250),
        num("repulsion", "节点排斥强度", 10, 700, 10),
        opt("nodeShape", "节点形状", symbolOptions),
        opt("nodeShapeMode", "节点形状依据", [
          ["uniform", "统一形状"],
          ["group", "按节点分组"],
          ["column", "读取 shape 列"],
        ]),
        num("nodeOpacity", "节点填充透明度", 0.1, 1, 0.05),
        col("nodeStrokeColor", "节点描边颜色"),
        num("nodeStrokeWidth", "节点描边宽度", 0, 6, 0.5),
        opt("nodeSizeMode", "节点大小依据", [
          ["data", "size 列"],
          ["degree", "连接数量"],
        ]),
        num("nodeScale", "节点大小倍率", 1, 9, 0.5),
        opt("networkLinkShape", "连线形状", [
          ["straight", "直线"],
          ["arc", "曲线"],
        ]),
        bool("directedEdges", "显示方向箭头"),
        bool("weightedEdges", "按权重调整线宽"),
        num("edgeWidth", "线宽倍率", 0.5, 6, 0.5),
        opt("edgeColorMode", "连线配色", [
          ["uniform", "统一颜色"],
          ["source", "来源分组颜色"],
          ["target", "目标分组颜色"],
          ["group", "边的 group 分类"],
        ]),
        col("edgeColor", "连线颜色"),
        bool("showEdgeLabels", "显示边标签"),
        num("edgeLabelSize", "边标签字号", 7, 26),
        col("edgeLabelColor", "边标签颜色"),
      ],
      inputHelp:
        "角色 nodes 节点表：id（唯一）、label（标签），可选 group、size（正数）、shape（circle/cross/diamond/square/star/triangle/wye）。角色 edges 边表：source、target 必须匹配节点 id，可选 weight（非负）、group（边分类）、label（边标签）、id（缺少 label 时用作标签）。没有 label/id 时边标签显示权重。选择按分组或 shape 列可给不同节点设置不同符号；可拖动节点，位置保存在项目文件。",
      limitations: [
        "显示用户提供的网络，不执行共现网络推断。最多 300 个节点；方向箭头使用 source → target；自环使用可见回环，箭头指向 target。",
      ],
      sourceUrls: ["https://www.chiplot.online/network_plot.html"],
    },
  ),
];
