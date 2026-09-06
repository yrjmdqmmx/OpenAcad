import React from "react";
import type { ChartStyle, Control } from "../../core/types";
import type { PositionedNode, TreeGeometry } from "./geometry";
import { stateFor, walk, type TreeNode } from "./model";
import { useSvgDragPosition } from "../basic/shared";

// Behavioural reference: https://1996xjm.github.io/tvbot/user_interface/attribute_main/branches.html
// Paths are original OpenAcad geometry; the reference specifies styles, not control points.
export type BranchLinkType = "rectangular" | "rounded" | "linear" | "elliptical" | "bezierX" | "bezierY";
export const branchLinkOptions = [
  { value: "rectangular", label: "直角分支" },
  { value: "rounded", label: "圆角直角分支" },
  { value: "linear", label: "直线分支" },
  { value: "elliptical", label: "椭圆分支" },
  { value: "bezierX", label: "横向贝塞尔曲线" },
  { value: "bezierY", label: "纵向贝塞尔曲线" },
];
const finite = (v: unknown, fallback: number) =>
  typeof v !== "boolean" && v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
const bound = (v: unknown, fallback: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, finite(v, fallback)));
const field = (key: string, label: string, type: Control["type"], extra: Partial<Control> = {}): Control =>
  ({ key, label, type, section: "分支线型", ...extra });
export const branchStyleControls: Control[] = [
  field("branchLinkType", "分支连接样式", "select", { options: branchLinkOptions,
    help: "圆角样式适用于矩形树；无根树使用直线或两种贝塞尔曲线。切换布局时不适用样式使用该布局默认连接。" }),
  field("branchLineCap", "分支端点形状", "select", { options: [
    { value: "butt", label: "平头" }, { value: "round", label: "圆头" }, { value: "square", label: "方头" },
  ] }),
  field("branchOpacity", "分支透明度", "number", { min: 0, max: 1, step: 0.05 }),
];
export function branchStyleForLayout(value: unknown, kind: TreeGeometry["kind"]): BranchLinkType {
  let type = branchLinkOptions.some(o => o.value === value) ? value as BranchLinkType : kind === "unrooted" ? "linear" : "rectangular";
  if (kind === "unrooted" && !["linear", "bezierX", "bezierY"].includes(type)) type = "linear";
  if (kind === "circle" && type === "rounded") type = "rectangular";
  return type;
}
export function advancedBranchPath(p: PositionedNode, parent: PositionedNode, g: TreeGeometry, style: Partial<ChartStyle>): string {
  const type = branchStyleForLayout(style.branchLinkType, g.kind);
  const { x: x0, y: y0 } = parent, { x: x1, y: y1 } = p;
  const start = `M${x0},${y0}`, end = `${x1},${y1}`;
  if (type === "linear") return `${start}L${end}`;
  if (type === "bezierX") {
    const mid = (x0 + x1) / 2;
    return `${start}C${mid},${y0} ${mid},${y1} ${end}`;
  }
  if (type === "bezierY") {
    const mid = (y0 + y1) / 2;
    return `${start}C${x0},${mid} ${x1},${mid} ${end}`;
  }
  if (type === "elliptical") {
    const dx = x1 - x0, dy = y1 - y0;
    if (Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9) return `${start}L${end}`;
    return `${start}A${Math.abs(dx)},${Math.abs(dy)} 0 0 ${dx * dy < 0 ? 1 : 0} ${end}`;
  }
  if (g.kind === "circle") {
    const r = Math.hypot(x0 - g.cx, y0 - g.cy);
    if (r < 1e-9) return `${start}L${end}`;
    const x = g.cx + r * Math.cos(p.angle), y = g.cy + r * Math.sin(p.angle);
    const delta = p.angle - parent.angle;
    return `${start}A${r},${r} 0 ${Math.abs(delta) > Math.PI ? 1 : 0} ${delta >= 0 ? 1 : 0} ${x},${y}L${end}`;
  }
  if (type === "rounded") {
    const dx = x1 - x0, dy = y1 - y0;
    const r = Math.min(10, Math.abs(dx) / 2, Math.abs(dy) / 2);
    if (r < 1e-9) return `${start}L${end}`;
    return `${start}V${y1 - Math.sign(dy) * r}Q${x0},${y1} ${x0 + Math.sign(dx) * r},${y1}H${x1}`;
  }
  return `${start}V${y1}H${x1}`;
}

const supportField = (key: string, label: string, type: Control["type"], extra: Partial<Control> = {}) =>
  field(key, label, type, { section: "支持度", ...extra });
export const supportControls: Control[] = [
  supportField("showSupport", "显示支持度", "boolean"),
  supportField("supportSource", "支持度数据来源", "select", { options: [
    { value: "support", label: "支持度（support）" }, { value: "posterior", label: "后验概率（posterior）" }, { value: "variable", label: "自定义节点变量" },
  ], help: "只显示文件中真实存在的值；缺失值不转换为零。后验概率 0–1 若画百分比圆点，请把缩放倍数设为 100。" }),
  supportField("supportVariable", "节点变量名", "text", { help: "例如节点注释 [&bootstrap=95] 中的 bootstrap；不区分大小写。", visible: p => p.style.supportSource === "variable" }),
  supportField("supportType", "支持度显示形式", "select", { options: [ { value: "text", label: "数值文字" }, { value: "circle", label: "阈值圆点" } ], help: "圆点按缩放后的百分值：≤70 不显示，(70,90] 灰色，>90 黑色。" }),
  supportField("supportFrom", "文字最小值（留空不限）", "number"),
  supportField("supportTo", "文字最大值（留空不限）", "number"),
  supportField("supportFactor", "支持度缩放倍数", "number", { min: 0.000001, max: 1000000, step: 0.1, help: "先乘倍数，再按阈值筛选，最后按小数位显示。" }),
  supportField("supportDecimals", "支持度保留小数位", "number", { min: 0, max: 10, step: 1 }),
  supportField("supportCircleSize", "支持度圆点半径", "number", { min: 1, max: 20 }),
  supportField("supportSize", "支持度字号", "number", { min: 6, max: 40 }),
  supportField("supportColor", "支持度文字颜色", "color"),
  supportField("supportAnchor", "支持度文字对齐", "select", { options: [ { value: "start", label: "左对齐" }, { value: "middle", label: "居中" }, { value: "end", label: "右对齐" } ] }),
  supportField("supportBold", "支持度文字加粗", "boolean"),
  supportField("supportItalic", "支持度文字斜体", "boolean"),
  supportField("supportX", "支持度水平偏移", "number", { min: -300, max: 300 }),
  supportField("supportY", "支持度垂直偏移", "number", { min: -300, max: 300 }),
].map(control => ({ ...control, visible: project => {
  try {
    const hasValues = walk(stateFor(project).root).some(node =>
      Number.isFinite(node.support) || Number.isFinite(node.posterior) ||
      Object.values((node as TreeNode & { annotationValues?: Record<string, number> }).annotationValues || {}).some(Number.isFinite));
    if (!hasValues || (control.key !== "showSupport" && project.style.showSupport === false)) return false;
    const circle = project.style.supportType === "circle";
    if (control.key === "supportCircleSize" && !circle) return false;
    if (circle && ["supportFrom", "supportTo", "supportDecimals", "supportSize", "supportColor", "supportAnchor", "supportBold", "supportItalic"].includes(control.key)) return false;
    return control.visible?.(project) ?? true;
  } catch { return false; }
} }));
export const branchStyleDefaults = { branchLinkType: "rectangular", branchLineCap: "round", branchOpacity: 1,
  supportSource: "support", supportVariable: "", supportType: "text", supportFactor: 1, supportDecimals: 2,
  supportCircleSize: 4, supportSize: 10, supportColor: "#536875", supportAnchor: "start", supportBold: false,
  supportItalic: false, supportX: 5, supportY: -6 };

export interface SupportMark { value: number; text: string; type: "text" | "circle"; fill: string; radius: number }
export function supportMark(node: TreeNode, style: Partial<ChartStyle>): SupportMark | null {
  if (style.showSupport === false) return null;
  const annotations = (node as TreeNode & { annotationValues?: Record<string, number> }).annotationValues;
  const raw = style.supportSource === "posterior" ? node.posterior : style.supportSource === "variable"
    ? annotations?.[String(style.supportVariable || "").toLowerCase()] ?? annotations?.[String(style.supportVariable || "")] : node.support;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const value = raw * finite(style.supportFactor, 1);
  if (!Number.isFinite(value)) return null;
  const type = style.supportType === "circle" ? "circle" : "text";
  if (type === "circle" && value <= 70) return null;
  if (type === "text" && (value < finite(style.supportFrom, -Infinity) || value > finite(style.supportTo, Infinity))) return null;
  const decimals = Math.round(bound(style.supportDecimals, 2, 0, 10));
  return { value, text: value.toFixed(decimals), type,
    fill: type === "circle" ? value > 90 ? "#000000" : "#808080" : String(style.supportColor || style.textColor || "#536875"),
    radius: bound(style.supportCircleSize, 4, 1, 20) };
}
type Layout = Record<string, unknown>;
type Position = { x: number; y: number };
interface LabelProps { g: TreeGeometry; style: Partial<ChartStyle>; layout: Layout; onLayoutChange?: (layout: Layout) => void }

/** Node-relative offsets retain alignment after tree rotation, resizing, and project reopening. */
export function DraggableTreeLabel({ node, style, layout, onLayoutChange, storageKey, offset, children, part }:
  Omit<LabelProps, "g"> & { node: PositionedNode; storageKey: string; offset: Position; children: React.ReactNode; part: string }) {
  const offsets = (layout[storageKey] || {}) as Record<string, Position>;
  const saved = offsets[node.node.id];
  const position = { x: node.x + offset.x + finite(saved?.x, 0), y: node.y + offset.y + finite(saved?.y, 0) };
  const drag = useSvgDragPosition(position, onLayoutChange ? next => onLayoutChange({ ...layout,
    [storageKey]: { ...offsets, [node.node.id]: { x: next.x - node.x - offset.x, y: next.y - node.y - offset.y } },
  }) : undefined);
  return <g data-part={part} data-node-id={node.node.id} transform={`translate(${drag.position.x},${drag.position.y})`}
    fontFamily={String(style.fontFamily || "Noto Sans SC")} {...drag.events}
    onClick={e => e.stopPropagation()} style={{ cursor: onLayoutChange ? "move" : "default", touchAction: "none" }}>{children}</g>;
}
export function SupportLabels(props: LabelProps) {
  const { g, style } = props;
  const anchor = ["start", "middle", "end"].includes(String(style.supportAnchor)) ? style.supportAnchor as "start" | "middle" | "end" : "start";
  return <g data-part="tree-supports">{g.nodes.map(node => {
    const mark = supportMark(node.node, style);
    if (!mark) return null;
    return <DraggableTreeLabel key={node.node.id} {...props} node={node} storageKey="treeSupportOffsets"
      offset={{ x: finite(style.supportX, 5), y: finite(style.supportY, -6) }} part="tree-support-label">
      <title>{`节点 ${node.node.id}；${style.supportSource === "posterior" ? "后验概率" : style.supportSource === "variable" ? String(style.supportVariable) : "支持度"}：${mark.value}`}</title>
      {mark.type === "circle" ? <circle r={mark.radius} fill={mark.fill} /> : <text fontSize={bound(style.supportSize, 10, 6, 40)}
        textAnchor={anchor} fill={mark.fill} fontWeight={style.supportBold ? "700" : "400"} fontStyle={style.supportItalic ? "italic" : "normal"}>{mark.text}</text>}
    </DraggableTreeLabel>;
  })}</g>;
}

export const treeLabelControls: Control[] = [
  field("showBranchLengths", "显示分支长度数值", "boolean", { section: "分支长度文字" }),
  field("branchLengthFactor", "分支长度显示倍数", "number", { section: "分支长度文字", min: 0.000001, max: 1000000 }),
  field("branchLengthDecimals", "分支长度小数位", "number", { section: "分支长度文字", min: 0, max: 10, step: 1 }),
  field("branchLengthSize", "分支长度字号", "number", { section: "分支长度文字", min: 6, max: 40 }),
  field("branchLengthColor", "分支长度文字颜色", "color", { section: "分支长度文字" }),
  field("branchLengthBold", "分支长度加粗", "boolean", { section: "分支长度文字" }),
  field("branchLengthX", "分支长度水平偏移", "number", { section: "分支长度文字", min: -300, max: 300 }),
  field("branchLengthY", "分支长度垂直偏移", "number", { section: "分支长度文字", min: -300, max: 300 }),
];
export function BranchLengthLabels(props: LabelProps) {
  const { g, style } = props;
  if (!style.showBranchLengths) return null;
  return <g data-part="tree-branch-lengths">{g.nodes.filter(n => n.parent && n.node.lengthSpecified !== false).map(node =>
    <DraggableTreeLabel key={node.node.id} {...props} node={node} storageKey="treeLengthOffsets"
      offset={{ x: finite(style.branchLengthX, 5), y: finite(style.branchLengthY, 12) }} part="tree-branch-length-label">
      <text fontSize={bound(style.branchLengthSize, 9, 6, 40)} fill={String(style.branchLengthColor || style.textColor || "#536875")}
        fontWeight={style.branchLengthBold ? "700" : "400"}>{(node.node.length * finite(style.branchLengthFactor, 1)).toFixed(Math.round(bound(style.branchLengthDecimals, 3, 0, 10)))}</text>
    </DraggableTreeLabel>)}</g>;
}
