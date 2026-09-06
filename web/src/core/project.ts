import type { Project, Template, ChartStyle, Dataset } from "./types";

export const palettes = {
  青绿与珊瑚: [
    "#087f8c",
    "#eb8972",
    "#7c91bd",
    "#dbc16b",
    "#89b5a4",
    "#be88a5",
  ],
  色觉友好: [
    "#0072B2",
    "#E69F00",
    "#009E73",
    "#CC79A7",
    "#56B4E9",
    "#D55E00",
    "#F0E442",
    "#333333",
  ],
  冷暖连续: [
    "#2166ac",
    "#67a9cf",
    "#d1e5f0",
    "#f7f7f7",
    "#fddbc7",
    "#ef8a62",
    "#b2182b",
  ],
  灰阶: ["#252525", "#525252", "#737373", "#969696", "#bdbdbd", "#d9d9d9"],
};
export const defaults: ChartStyle = {
  width: 960,
  height: 680,
  background: "#ffffff",
  transparent: false,
  marginTop: 80,
  marginRight: 60,
  marginBottom: 85,
  marginLeft: 90,
  title: "",
  subtitle: "",
  fontFamily: "Noto Sans SC",
  fontSize: 14,
  titleSize: 22,
  textColor: "#172b3a",
  palette: palettes["青绿与珊瑚"],
  opacity: 1,
  showLegend: true,
  showGrid: true,
  showLabels: false,
  xTitle: "",
  yTitle: "",
  pointSize: 5,
  lineWidth: 2,
  orientation: "vertical",
  sort: "original",
};
export function makeProject(t: Template): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: `${t.name} · 模拟数据`,
    templateId: t.id,
    templateVersion: t.version,
    createdAt: now,
    updatedAt: now,
    dataset: structuredClone(t.example),
    mapping: {},
    style: { ...structuredClone(defaults), ...structuredClone(t.defaultStyle) },
    layers: [],
    layout: {},
    ...(t.exampleAnalysis
      ? { analysis: structuredClone(t.exampleAnalysis) }
      : {}),
  };
}
export function encodeProject(project: Project) {
  return JSON.stringify(
    { ...project, updatedAt: new Date().toISOString() },
    null,
    2,
  );
}
export function decodeProject(text: string, templates: Template[]): Project {
  if (text.length > 25_000_000)
    throw new Error("项目文件超过 25 MB，请拆分数据后重试。");
  let p: Project;
  try {
    p = JSON.parse(text);
  } catch {
    throw new Error("项目文件不是有效的 JSON，请打开 .openacad.json 文件。");
  }
  if (p?.schemaVersion !== 1)
    throw new Error("不支持此项目版本，请使用生成该文件的版本打开。");
  const t = templates.find((t) => t.id === p.templateId);
  if (!t) throw new Error(`当前版本尚未提供项目所需模板“${p.templateId}”。`);
  if (p.templateVersion > t.version)
    throw new Error("项目使用较新的模板版本，请更新网站后再打开。");
  if (
    typeof p.name !== "string" ||
    !p.dataset ||
    !Array.isArray(p.dataset.tables) ||
    !p.style ||
    !Array.isArray(p.layers) ||
    typeof p.layout !== "object"
  )
    throw new Error("项目缺少名称、数据、样式或图层，请确认文件完整。");
  const width = Number(p.style.width),
    height = Number(p.style.height);
  if (
    !Number.isFinite(width) ||
    width < 240 ||
    width > 12000 ||
    !Number.isFinite(height) ||
    height < 240 ||
    height > 12000
  )
    throw new Error("项目画布宽高必须在 240～12000 像素之间。");
  if (p.dataset.tables.length > 30 || p.layers.length > 100)
    throw new Error("项目表格或图层数量超出当前版本限制。");
  for (const table of p.dataset.tables) {
    if (
      !Array.isArray(table.columns) ||
      !Array.isArray(table.rows) ||
      table.columns.length > 500 ||
      table.rows.length > 100000
    )
      throw new Error("项目中的表格结构无效，或超过 500 列 / 100000 行限制。");
    if (
      table.columns.some((x) => typeof x !== "string") ||
      table.rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.some(
            (v) => v !== null && typeof v !== "string" && typeof v !== "number",
          ),
      )
    )
      throw new Error("项目单元格只允许文字、数值或空白。");
  }
  if (
    !Array.isArray(p.style.palette) ||
    p.style.palette.length === 0 ||
    p.style.palette.some(
      (c) => typeof c !== "string" || !/^#[0-9a-f]{3,8}$/i.test(c),
    )
  )
    throw new Error("项目配色格式无效。");
  return {
    ...p,
    id: p.id || crypto.randomUUID(),
    mapping: p.mapping || {},
    style: { ...structuredClone(defaults), ...p.style },
  };
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function saveProject(p: Project) {
  downloadBlob(
    new Blob([encodeProject(p)], { type: "application/json" }),
    `${p.name.replace(/[\\/:*?"<>|]/g, "_")}.openacad.json`,
  );
}
export async function inputHash(
  dataset: Dataset,
  method: string,
  params: Record<string, unknown>,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ dataset, method, params }),
  );
  const sum = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(sum), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
