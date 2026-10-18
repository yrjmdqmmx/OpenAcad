import { useEffect, useRef, useState } from "react";
import type { Project, Template } from "../core/types";
import { csv, parseText } from "../core/data";
import { downloadBlob } from "../core/project";
import { parseMagneticTrack } from "../templates/magnetic";
import { AnalysisPanel } from "./AnalysisPanel";
import "../styles/magnetic.css";

const inputs = [
  { role: "magnetic-curve", label: "磁异常曲线数据", ext: ".csv", columns: ["dist_km", "mag_nT"], help: "dist_km：距离（km）；mag_nT：磁异常（nT）。" },
  { role: "magnetic-profile", label: "海底和基底数据", ext: ".csv", columns: ["s_km", "bathy_m", "basement_km"], help: "s_km：距离（km）；bathy_m：海底海拔（m，水下为负）；basement_km：基底深度（km，向下为正）。" },
  { role: "magnetic-track", label: "测线位置", ext: ".json", columns: [], help: '格式：{"OBS93":{"poly":[[经度,纬度],[经度,纬度]]}}。CSV 距离从 JSON 首点向末点递增。' },
];
function source(p: Project, role: string) {
  if (role === "magnetic-track") return p.dataset.files?.find(f => f.role === role)?.text || "";
  const table = p.dataset.tables.find(t => t.role === role);
  return table ? csv(table) : "";
}

export function MagneticDataPanel({ project, template, commit, stale }: {
  project: Project; template: Template; commit: (p: Project) => void; stale: boolean;
}) {
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const latest = useRef(project);
  latest.current = project;
  useEffect(() => { setDrafts(Object.fromEntries(inputs.map(i => [i.role, source(project, i.role)]))); }, [project.dataset]);
  function apply(role: string, text: string, filename: string, uploaded = false) {
    try {
      const input = inputs.find(i => i.role === role)!;
      const now = latest.current;
      const freshUpload = uploaded && now.layout.magneticInputMode !== "uploaded";
      const dataset = freshUpload ? { tables: [], files: [] } : structuredClone(now.dataset);
      if (role === "magnetic-track") {
        // Validate syntax/coordinates before accepting a replacement. Selection
        // of one line from a multi-line file happens in the analysis parameters.
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !Array.isArray(parsed.poly)) {
          const names = Object.keys(parsed).filter(name => parsed[name] && typeof parsed[name] === "object" && Array.isArray(parsed[name].poly));
          if (!names.length) parseMagneticTrack(text);
          else names.forEach(name => parseMagneticTrack(text, name));
        } else parseMagneticTrack(text);
        dataset.files = [...(dataset.files || []).filter(f => f.role !== role), { id: role, name: filename, role, format: "json", text }];
      } else {
        const table = parseText(text.replace(/^\uFEFF/, ""), ",");
        if (new Set(table.columns).size !== table.columns.length) throw new Error("CSV 列名不能重复。");
        for (const name of input.columns) if (!table.columns.includes(name)) throw new Error(`${input.label}缺少列：${name}。`);
        if (table.rows.length < 2 || table.rows.length > 10000) throw new Error("每份 CSV 需要 2～10000 行数据。");
        const rows = table.rows.map((row, index) => input.columns.map(name => {
          const value = row[table.columns.indexOf(name)];
          if (value === null || String(value).trim() === "" || !Number.isFinite(Number(value))) throw new Error(`${filename} 第 ${index + 2} 行 ${name} 必须是有限数字。`);
          return Number(value);
        }));
        dataset.tables = [...dataset.tables.filter(t => t.role !== role), { id: role, name: filename, role, columns: input.columns, rows }];
      }
      const next: Project = { ...now, dataset,
        ...(freshUpload && now.name.endsWith(" · 模拟数据") ? { name: now.name.replace(/ · 模拟数据$/, "") } : {}),
        ...(freshUpload ? { style: { ...now.style, magnetic_line_label: "", magnetic_start_label: "起点", magnetic_end_label: "终点", magnetic_show_stations: false, magnetic_show_faults: false, magnetic_show_moho: false,
          subtitle: "用户输入 · 棱柱正演与窗口相关 · 相关系数不代表存在概率" } } : {}),
        layout: { ...now.layout, ...(uploaded ? { magneticInputMode: "uploaded" } : {}) },
        analysis: { method: "magnetic-correlation", params: now.analysis?.params || template.analysisMethods?.[0]?.params || {}, inputHash: "" } };
      latest.current = next;
      commit(next);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }
  async function upload(role: string, file?: File) {
    if (!file) return;
    const input = inputs.find(i => i.role === role)!;
    if (!file.name.toLowerCase().endsWith(input.ext)) { setError(`请上传 ${input.ext} 文件。`); return; }
    if (file.size > 2_000_000) { setError("单份文件不能超过 2 MB。"); return; }
    try { apply(role, await file.text(), file.name, true); } catch (e) { setError((e as Error).message); }
  }
  const ready = inputs.every(i => source(project, i.role));
  return <div className="magnetic-input-panel">
    <h3>上传三份文件生成剖面图</h3>
    <p className="help-copy">两份 CSV 和一份 JSON，共同描述一条测线。距离需同起点、同方向，不自动拉伸或改写基底深度。</p>
    {project.layout.magneticInputMode !== "uploaded" && <p className="notice">当前为参照例图形状制作的模拟数据。首次上传会清空三份示例输入，并关闭示例站位、断裂和莫霍面；可在右侧按自己的资料重新设置。</p>}
    {inputs.map(input => <section key={input.role} className="magnetic-file-input">
      <label className="analysis-control">{input.label} {input.ext}<input aria-label={`上传${input.label}`} type="file" accept={input.ext} onChange={e => { void upload(input.role, e.target.files?.[0]); e.target.value = ""; }} /></label>
      <p className="hint">{input.help}</p>
      <p role="status">{input.role === "magnetic-track"
        ? project.dataset.files?.find(f => f.role === input.role)?.name || "尚未上传"
        : (() => { const t = project.dataset.tables.find(t => t.role === input.role); return t ? `${t.name} · ${t.rows.length} 行` : "尚未上传"; })()}</p>
      <details><summary>查看或编辑{input.label}</summary>
        <textarea aria-label={`${input.label}内容`} value={drafts[input.role] || ""} rows={6} style={{ width: "100%", boxSizing: "border-box" }} onChange={e => setDrafts({ ...drafts, [input.role]: e.target.value })} />
        <button onClick={() => apply(input.role, drafts[input.role] || "", `${input.role}${input.ext}`)}>应用{input.label}</button>
        <button disabled={!source(project, input.role)} onClick={() => downloadBlob(new Blob([source(project, input.role)], { type: "text/plain;charset=utf-8" }), `${input.role}${input.ext}`)}>下载当前文件</button>
      </details>
    </section>)}
    {error && <p className="error" role="alert">{error} 当前数据未替换。</p>}
    {!ready ? <p className="notice">请补齐两份 CSV 和一份测线 JSON 后开始计算。</p> : <AnalysisPanel project={project} template={template} commit={commit} stale={stale} />}
  </div>;
}
