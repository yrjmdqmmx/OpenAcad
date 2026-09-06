import type { TreeNode } from "./model";
import { visibleLeaves } from "./model";
export type LayoutKind = "normal" | "circle" | "unrooted";
export interface PositionedNode {
  node: TreeNode;
  parent?: string;
  x: number;
  y: number;
  angle: number;
  distance: number;
  depth: number;
  terminal: boolean;
}
export interface TreeGeometry {
  nodes: PositionedNode[];
  tips: PositionedNode[];
  kind: LayoutKind;
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
  left: number;
  top: number;
  treeWidth: number;
  treeHeight: number;
  trackStart: number;
  rowHeight: number;
  timeUnitScale: number;
  rtl: boolean;
  inward: boolean;
  tipRadius: number;
}
export function layoutTree(
  root: TreeNode,
  kind: LayoutKind,
  options: {
    width: number;
    height: number;
    treeWidth: number;
    trackWidth: number;
    labelWidth: number;
    useLength: boolean;
    rotation: number;
    angleRange: number;
    rowHeight: number;
    rtl?: boolean;
    inward?: boolean;
    innerRadius?: number;
    timeAges?: Record<string, number>;
    timeIntervals?: Record<string, [number, number]>;
    timeDomain?: [number, number];
    marginLeft?: number;
    marginRight?: number;
    marginTop?: number;
    marginBottom?: number;
  },
): TreeGeometry {
  const count = visibleLeaves(root).length;
  const marginLeft = Math.max(20, options.marginLeft ?? 55),
    top = Math.max(65, options.marginTop ?? 88),
    right = Math.max(25, options.marginRight ?? 35),
    bottom = Math.max(45, options.marginBottom ?? 75);
  const treeWidth = Math.max(120, options.treeWidth);
  const rowHeight = Math.max(16, options.rowHeight);
  const extra = options.labelWidth + options.trackWidth;
  const rtl = kind === "normal" && Boolean(options.rtl),
    inward = kind === "circle" && Boolean(options.inward);
  const left = marginLeft + (rtl ? extra : 0);
  const spanRadius = Math.max(90, treeWidth / 2);
  const innerRadius = inward
    ? Math.max(options.innerRadius ?? 120, extra + 40)
    : 0;
  const radius = spanRadius + innerRadius;
  const tipRadius = inward ? innerRadius : radius;
  const width =
    kind === "normal"
      ? Math.max(options.width, marginLeft + treeWidth + extra + right)
      : Math.max(
          options.width,
          2 * (radius + (inward ? 0 : extra)) + left + right + 70,
        );
  const height =
    kind === "normal"
      ? Math.max(options.height, top + count * rowHeight + bottom)
      : Math.max(
          options.height,
          2 * (radius + (inward ? 0 : extra)) + top + bottom + 70,
        );
  const cx = (width + left - right) / 2,
    cy = (height + top - bottom) / 2;
  const treeHeight = kind === "normal" ? height - top - bottom : 2 * radius;
  let index = 0;
  const out: PositionedNode[] = [];
  const recurse = (
    n: TreeNode,
    parent: string | undefined,
    depth: number,
    distance: number,
  ): PositionedNode => {
    const terminal = n.collapsed || !n.children.length;
    const p: PositionedNode = {
      node: n,
      parent,
      depth,
      distance: options.timeAges
        ? options.timeDomain![1] - options.timeAges[n.id]
        : distance,
      x: 0,
      y: 0,
      angle: 0,
      terminal,
    };
    out.push(p);
    if (terminal) {
      p.y = top + ((index + 0.5) * treeHeight) / count;
      p.angle =
        ((options.rotation + ((index + 0.5) * options.angleRange) / count) *
          Math.PI) /
        180;
      index++;
    } else {
      const children = n.children.map((c) =>
        recurse(
          c,
          n.id,
          depth + 1,
          distance + (options.useLength ? c.length : 1),
        ),
      );
      p.y = children.reduce((a, c) => a + c.y, 0) / children.length;
      p.angle = children.reduce((a, c) => a + c.angle, 0) / children.length;
    }
    return p;
  };
  recurse(root, undefined, 0, 0);
  const max = options.timeAges
    ? options.timeDomain![1] - options.timeDomain![0]
    : Math.max(...out.map((n) => n.distance)) || 1;
  let timeUnitScale =
    (kind === "normal"
      ? rtl
        ? -treeWidth
        : treeWidth
      : inward
        ? -spanRadius
        : radius) / max;
  for (const p of out) {
    if (kind === "normal")
      p.x = left + (rtl ? 1 - p.distance / max : p.distance / max) * treeWidth;
    else if (kind === "circle") {
      const r = inward
        ? innerRadius + (1 - p.distance / max) * spanRadius
        : (p.distance / max) * radius;
      p.x = cx + r * Math.cos(p.angle);
      p.y = cy + r * Math.sin(p.angle);
    }
  }
  if (kind === "unrooted") {
    const map = new Map(out.map((n) => [n.node.id, n]));
    const branch = (
      n: TreeNode,
      x: number,
      y: number,
      start: number,
      span: number,
    ) => {
      const p = map.get(n.id)!;
      p.x = x;
      p.y = y;
      p.angle = start + span / 2;
      if (p.terminal) return;
      const total = n.children.reduce((a, c) => a + visibleLeaves(c).length, 0);
      let cursor = start;
      for (const c of n.children) {
        const a = (span * visibleLeaves(c).length) / total;
        const angle = cursor + a / 2;
        const length = options.timeAges
          ? options.timeAges[n.id] - options.timeAges[c.id]
          : options.useLength
            ? c.length
            : 1;
        branch(
          c,
          x + length * Math.cos(angle),
          y + length * Math.sin(angle),
          cursor,
          a,
        );
        cursor += a;
      }
    };
    branch(root, 0, 0, (options.rotation * Math.PI) / 180, 2 * Math.PI);
    const bounds = out.flatMap((p) => [
      p,
      ...(options.timeAges && options.timeIntervals?.[p.node.id]
        ? options.timeIntervals[p.node.id].map((age) => ({
            x: p.x + (options.timeAges![p.node.id] - age) * Math.cos(p.angle),
            y: p.y + (options.timeAges![p.node.id] - age) * Math.sin(p.angle),
          }))
        : []),
    ]);
    const xs = bounds.map((n) => n.x),
      ys = bounds.map((n) => n.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const scale = (2 * radius) / Math.max(maxX - minX, maxY - minY, 1);
    timeUnitScale = scale;
    for (const p of out) {
      p.x = cx + (p.x - (minX + maxX) / 2) * scale;
      p.y = cy + (p.y - (minY + maxY) / 2) * scale;
    }
  }
  return {
    nodes: out,
    tips: out.filter((n) => n.terminal),
    kind,
    width,
    height,
    cx,
    cy,
    radius,
    left,
    top,
    treeWidth,
    treeHeight,
    trackStart: rtl ? marginLeft : left + treeWidth + options.labelWidth,
    rtl,
    inward,
    tipRadius,
    rowHeight: treeHeight / count,
    timeUnitScale,
  };
}
export function branchPath(
  p: PositionedNode,
  parent: PositionedNode,
  g: TreeGeometry,
) {
  if (g.kind === "normal") return `M${parent.x},${parent.y}V${p.y}H${p.x}`;
  if (g.kind === "unrooted") return `M${parent.x},${parent.y}L${p.x},${p.y}`;
  const r = Math.hypot(parent.x - g.cx, parent.y - g.cy);
  const x = g.cx + r * Math.cos(p.angle),
    y = g.cy + r * Math.sin(p.angle);
  const delta = p.angle - parent.angle;
  return `M${parent.x},${parent.y}A${r},${r} 0 ${Math.abs(delta) > Math.PI ? 1 : 0} ${delta >= 0 ? 1 : 0} ${x},${y}L${p.x},${p.y}`;
}
