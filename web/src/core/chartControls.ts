import type { ChartStyle, Control, Project, Template } from "./types";

const matrices = ["heatmap", "circle-heatmap", "binary-dot", "binary-rect", "bubble-matrix", "correlation", "double-correlation", "mantel"];
export function labelControl(template: Template): Control {
  const id = template.id;
  const label = matrices.includes(id) ? "显示行列标签"
    : id.startsWith("enrichment-") ? "显示条目名称"
    : id === "packing" ? "显示项目名称"
    : id === "network" || id === "sankey" ? "显示节点名称"
    : id === "volcano" ? "显示基因标签"
    : id === "map" ? "显示采样点名称"
    : template.familyId === "ordination" ? "显示样本标签"
    : id.startsWith("tree-") ? "显示分支长度数值"
    : "显示数值";
  return { key: "showLabels", label, type: "boolean", section: "配色与图形",
    // Tree renderers support the legacy showLabels field, but expose just one
    // control for its modern equivalent below.
    visible: () => !id.startsWith("tree-") && id !== "magnetic-correlation" };
}

export function hasContinuousPalette(p: Project) {
  return matrices.includes(p.templateId) && !["binary-dot", "binary-rect"].includes(p.templateId)
    && !(p.templateId === "bubble-matrix" && p.style.bubbleColorMode && p.style.bubbleColorMode !== "continuous");
}
export function paletteVisible(p: Project) {
  // Tree annotations have their own palette controls; the canvas palette is
  // not a reliable consumer when annotation rows carry explicit colours.
  return !p.templateId.startsWith("tree-") && p.templateId !== "magnetic-correlation";
}
export function seriesPaletteVisible(p: Project) {
  return paletteVisible(p) && !hasContinuousPalette(p)
    && p.templateId !== "volcano"
    && (!p.templateId.startsWith("enrichment-") || p.templateId === "enrichment-circle" || Boolean(p.style.showEnrichClass));
}
export function applyPalette(p: Project, palette: string[]): ChartStyle {
  const s = { ...p.style, palette: [...palette] };
  if (hasContinuousPalette(p)) Object.assign(s, {
    lowColor: palette[0], midColor: palette[Math.floor(palette.length / 2)], highColor: palette.at(-1),
  });
  if (p.templateId === "volcano") Object.assign(s, {
    downColor: palette[0], upColor: palette[1], neutralColor: palette.at(-1),
  });
  if (p.templateId.startsWith("enrichment-")) Object.assign(s, {
    lowQColor: palette[0], highQColor: palette.at(-1),
  });
  return s;
}

export function changeChartStyle(p: Project, key: string, value: unknown): Project {
  const style = { ...p.style, [key]: value };
  if (key === "orientation" && value !== p.style.orientation) {
    // Titles refer to physical axes in schema v1. Swap them together with
    // their units on a direction change; old saved figures remain unchanged.
    style.xTitle = p.style.yTitle;
    style.yTitle = p.style.xTitle;
  }
  if (key === "showBranchLengths") style.showLabels = false;
  return { ...p, style };
}
