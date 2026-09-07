import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadBlob } from "../core/project";
import { fasta, parseAb1, type Ab1, type Base } from "./abif";

const bases: Base[] = ["A", "C", "G", "T"];
export const baseColors: Record<Base, string> = { A: "#16834a", C: "#2168ca", G: "#303a43", T: "#d94044" };
const color = (base: string) => baseColors[base as Base] ?? "#8651ab";
const limit = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function TracePlot({ data, start, count, selected, onSelect, onPan, svgRef }: {
  data: Ab1; start: number; count: number; selected: number; onSelect: (index: number) => void;
  onPan: (delta: number) => void; svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const wrapper = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => { const observer = new ResizeObserver(([e]) => setWidth(Math.max(250, e.contentRect.width))); if (wrapper.current) observer.observe(wrapper.current); return () => observer.disconnect(); }, []);
  const end = Math.min(data.sequence.length, start + count), locations = data.locations!;
  const model = useMemo(() => {
    if (!data.traces || !locations) return null;
    const low = start > 0 ? (locations[start - 1] + locations[start]) / 2 : Math.max(0, locations[start] - 10);
    const high = end < locations.length ? (locations[end - 1] + locations[end]) / 2 : Math.min(data.traces.A.length - 1, locations[end - 1] + 10);
    const x = (v: number) => 38 + (v - low) / Math.max(1, high - low) * (width - 52);
    let peak = 1;
    for (const b of bases) for (let i = Math.floor(low); i <= Math.ceil(high); i++) peak = Math.max(peak, data.traces[b][i] ?? 0);
    const paths = bases.map(b => ({ base: b, path: Array.from({ length: Math.max(0, Math.ceil(high) - Math.floor(low) + 1) }, (_, j) => { const i = Math.floor(low) + j; return `${j ? "L" : "M"}${x(i).toFixed(2)},${(214 - (data.traces![b][i] ?? 0) / peak * 150).toFixed(2)}`; }).join(" ") }));
    const qmax = Math.max(60, ...(data.qualities?.slice(start, end) ?? []));
    return { low, high, x, peak, paths, qmax };
  }, [data, locations, start, end, width]);
  if (!model) return <p className="bio-notice">此文件仍可查看序列；缺少可靠的峰图或位置字段，峰图联动不可用。</p>;
  const indices = Array.from({ length: end - start }, (_, i) => start + i);
  const step = Math.max(1, Math.ceil(count * 30 / width));
  return <div ref={wrapper} className="ab1-plot" data-testid="ab1-plot">
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={width} height={350} viewBox={`0 0 ${width} 350`} role="img" aria-label={`测序峰图，碱基 ${start + 1} 至 ${end}`} style={{ maxWidth: "100%", display: "block", touchAction: "pan-y pinch-zoom", fontFamily: "Noto Sans SC, sans-serif", userSelect: "none" }}
      onPointerDown={e => { if (e.isPrimary) drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; }}
      onPointerMove={e => { const d = drag.current; if (d && Math.abs(e.clientX - d.x) > 8 && Math.abs(e.clientX - d.x) > Math.abs(e.clientY - d.y) * 1.3) e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; }}
      onPointerUp={e => {
        const d = drag.current; drag.current = null; if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 12) { onPan(Math.round(-dx / width * count)); return; }
        const bounds = e.currentTarget.getBoundingClientRect(), at = (e.clientX - bounds.left) * width / bounds.width;
        let closest = start;
        for (const i of indices) if (Math.abs(model.x(locations[i]) - at) < Math.abs(model.x(locations[closest]) - at)) closest = i;
        onSelect(closest);
      }}>
      <title>{data.filename} · 碱基 {start + 1}–{end}</title>
      <desc>按 FWO_ 的 {data.channelOrder} 顺序映射 DATA9–12，PLOC 为文件内原始采样索引。质量值与同组碱基对应。</desc>
      <rect width={width} height={350} fill="white" />
      <text x={14} y={20} fontSize={12} fill="#314b55">碱基 {start + 1}–{end} · 峰高（相对荧光强度）</text>
      {bases.map((b, i) => <text key={b} x={width - 105 + i * 25} y={39} fontSize={13} fill={color(b)} fontWeight={700}>{b}</text>)}
      {[0, 0.5, 1].map(f => <g key={f}><line x1={38} x2={width - 14} y1={214 - f * 150} y2={214 - f * 150} stroke="#e1e9ed" /><text x={33} y={218 - f * 150} textAnchor="end" fontSize={10} fill="#596b76">{Math.round(f * model.peak)}</text></g>)}
      {model.paths.map(p => <path data-channel={p.base} key={p.base} d={p.path} fill="none" stroke={color(p.base)} strokeWidth={1.2} />)}
      {indices.filter((i, n) => i === selected || (n % step === 0 && (selected < start || selected >= end || Math.abs(model.x(locations[i]) - model.x(locations[selected])) > 23))).map(i => <g key={i}><text x={model.x(locations[i])} y={56} textAnchor="middle" fontSize={12} fontWeight={600} fill={color(data.sequence[i])}>{data.sequence[i]}</text><text x={model.x(locations[i])} y={232} textAnchor="middle" fontSize={10} fill="#596b76">{i + 1}</text></g>)}
      <text x={14} y={253} fontSize={12} fill="#314b55">质量值 Q（PCON{data.callSet}）</text>
      {data.qualities ? <>
        {[0, 20, 40].filter(q => q <= model.qmax).map(q => <g key={q}><line x1={38} x2={width - 14} y1={330 - q / model.qmax * 64} y2={330 - q / model.qmax * 64} stroke="#e1e9ed" strokeDasharray="3 3" /><text x={33} y={334 - q / model.qmax * 64} textAnchor="end" fontSize={10} fill="#596b76">{q}</text></g>)}
        {indices.map(i => <rect key={i} data-quality-index={i + 1} x={model.x(locations[i]) - 2} y={330 - data.qualities![i] / model.qmax * 64} width={Math.max(1, Math.min(6, width / count / 2))} height={data.qualities![i] / model.qmax * 64} fill={data.qualities![i] >= 20 ? "#16834a" : "#b37624"}><title>{i + 1} {data.sequence[i]}：Q{data.qualities![i]}</title></rect>)}
      </> : <text x={38} y={295} fill="#86551d" fontSize={13}>文件未提供可靠质量值</text>}
      {selected >= start && selected < end && <line data-testid="selected-peak" x1={model.x(locations[selected])} x2={model.x(locations[selected])} y1={42} y2={336} stroke="#8651ab" strokeWidth={1.5} strokeDasharray="4 3" />}
    </svg>
  </div>;
}

export function Ab1Viewer() {
  const [data, setData] = useState<Ab1 | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [start, setStart] = useState(0), [count, setCount] = useState(() => window.innerWidth < 600 ? 30 : 80), [selected, setSelected] = useState(0), [position, setPosition] = useState("1");
  const fileInput = useRef<HTMLInputElement>(null), svgRef = useRef<SVGSVGElement>(null), generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function read(file: File) {
    const id = ++generation.current; setBusy(true); setError(""); setNotice("");
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("AB1 文件超过 20 MB，请选择单条 Sanger 测序文件。");
      const parsed = parseAb1(await file.arrayBuffer(), file.name);
      if (generation.current !== id) return;
      setData(parsed); setStart(0); setSelected(0); setPosition("1");
    } catch (e) { if (generation.current === id) setError((e as Error).message); }
    finally { if (generation.current === id) setBusy(false); }
  }
  async function sample() {
    setBusy(true); setError("");
    try { const res = await fetch("/examples/bio/3730.ab1"); if (!res.ok) throw new Error("真实样例文件加载失败，请重试或导入自己的 AB1 文件。"); await read(new File([await res.arrayBuffer()], "3730.ab1")); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  const end = data ? Math.min(data.sequence.length, start + count) : 0;
  function pan(delta: number) { if (data) setStart(s => limit(s + delta, 0, Math.max(0, data.sequence.length - count))); }
  function select(index: number) { setSelected(index); setPosition(String(index + 1)); }
  function locate() {
    if (!data) return;
    const n = Number(position);
    if (!Number.isInteger(n) || n < 1 || n > data.sequence.length) { setError(`请输入 1 至 ${data.sequence.length} 之间的整数碱基位置。`); return; }
    setError(""); select(n - 1); setStart(limit(n - 1 - Math.floor(count / 2), 0, Math.max(0, data.sequence.length - count)));
  }
  async function exportPlot(format: "svg" | "png") {
    if (!svgRef.current || !data) return;
    setError("");
    try {
      await document.fonts.ready;
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const filename = `${data.filename.replace(/\.ab1$/i, "")}-${start + 1}-${end}.${format}`;
      if (format === "svg") { downloadBlob(blob, filename); return; }
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image(); img.src = url; await img.decode();
        const canvas = document.createElement("canvas"); canvas.width = Math.ceil(img.width * 2); canvas.height = img.height * 2;
        const context = canvas.getContext("2d"); if (!context) throw new Error("浏览器不支持 PNG 画布导出。");
        context.scale(2, 2); context.drawImage(img, 0, 0);
        const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG 导出失败，请尝试 SVG。")), "image/png"));
        downloadBlob(png, filename);
      } finally { URL.revokeObjectURL(url); }
    } catch (e) { setError((e as Error).message); }
  }
  return <section className="bio-tool" aria-labelledby="ab1-title">
    <header className="bio-tool-heading"><div><h1 id="ab1-title">AB1 测序文件查看器</h1><p>从碱基到峰图，逐位核对测序结果。文件在浏览器本地解析，不上传。</p></div><a href="#bio">全部生物信息学工具</a></header>
    <div className="bio-import" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && e.dataTransfer.files[0]) void read(e.dataTransfer.files[0]); }}>
      <Upload size={24} aria-hidden="true" /><div><strong>导入 .ab1 文件</strong><p>拖放文件到这里，或从本机选择。支持 ABIF 1.x，单文件不超过 20 MB。</p></div>
      <button className="primary" onClick={() => fileInput.current?.click()} disabled={busy}>选择 AB1 文件</button><button onClick={() => void sample()} disabled={busy}>打开真实样例</button>
      <input ref={fileInput} aria-label="AB1 文件" type="file" accept=".ab1" hidden onChange={e => { if (e.target.files?.[0]) void read(e.target.files[0]); e.target.value = ""; }} />
    </div>
    <p className="bio-caption">真实样例：Biopython 公开测试数据 3730.ab1，非模拟峰图。<a href="/examples/bio/3730.ab1" download>下载 AB1 样例</a> · <a href="https://github.com/biopython/biopython/blob/ae8435837a47e26b5b3456a5bbd06d24870e464a/Tests/Abi/3730.ab1" target="_blank" rel="noreferrer">查看来源</a></p>
    {busy && <p role="status">正在本地读取并解析测序文件…</p>}{error && <p role="alert" className="bio-error">{error}{data && " 上一个成功导入的文件仍保留在下方。"}</p>}{notice && <p role="status">{notice}</p>}
    {!data ? <div className="bio-empty"><h2>先打开一条测序记录</h2><p>导入后显示样本信息、碱基序列、四色峰图和质量值。可定位、缩放，导出 FASTA 或当前区域的 SVG / PNG。</p></div> : <>
      <div className="bio-section-heading"><h2>{data.filename}</h2><span>{data.sequence.length.toLocaleString()} 个碱基 · ABIF {(data.version / 100).toFixed(2)} · PBAS{data.callSet}</span></div>
      <dl className="ab1-metadata">{data.metadata.map(m => <div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}<div><dt>通道顺序</dt><dd>{data.channelOrder || "缺失"}</dd></div></dl>
      {data.warnings.map(w => <p className="bio-notice" key={w}>{w}</p>)}
      <div className="bio-toolbar">
        <label>每屏碱基 <select aria-label="每屏碱基" value={count} onChange={e => { const n = Number(e.target.value); setCount(n); setStart(s => Math.min(s, Math.max(0, data.sequence.length - n))); }}>{[20, 30, 50, 80, 120, 200].map(n => <option key={n} value={n}>{n} 个</option>)}</select></label>
        <button onClick={() => pan(-Math.max(1, Math.floor(count / 2)))} disabled={start === 0} aria-label="向前移动峰图"><ChevronLeft size={16} />向前</button><button onClick={() => pan(Math.max(1, Math.floor(count / 2)))} disabled={end === data.sequence.length} aria-label="向后移动峰图">向后<ChevronRight size={16} /></button>
        <form onSubmit={e => { e.preventDefault(); locate(); }}><label>定位碱基 <input aria-label="定位碱基" type="number" min={1} max={data.sequence.length} value={position} onChange={e => setPosition(e.target.value)} /></label><button type="submit">定位</button></form>
        {data.traces && data.locations && <><button onClick={() => void exportPlot("svg")}><Download size={15} />区域 SVG</button><button onClick={() => void exportPlot("png")}>区域 PNG</button></>}
      </div>
      {data.traces && data.locations ? <TracePlot data={data} start={start} count={count} selected={selected} onSelect={select} onPan={pan} svgRef={svgRef} /> : <p className="bio-notice">峰图无法可靠对应碱基，序列及可用质量值仍可查看。</p>}
      <label className="ab1-position-slider">查看区域：{start + 1}–{end}<input aria-label="横向移动查看区域" type="range" min={0} max={Math.max(0, data.sequence.length - count)} value={start} onChange={e => setStart(Number(e.target.value))} /></label>
      <p className="bio-caption">横向拖动峰图或移动滑块平移；点击峰图、质量柱或下方碱基联动查看。稠密视图省略部分文字标签，原始峰值不抽样。</p>
      <div className="ab1-selection" role="status" data-testid="ab1-selection"><strong style={{ color: color(data.sequence[selected]) }}>第 {selected + 1} 位 · {data.sequence[selected]}</strong><span>质量值：{data.qualities ? `Q${data.qualities[selected]}` : "缺失"}</span><span>采样索引：{data.locations?.[selected] ?? "缺失"}（从 0 开始）</span>{data.traces && data.locations && bases.map(b => <span key={b} style={{ color: color(b) }}>{b}：{data.traces![b][data.locations![selected]]}</span>)}</div>
      <div className="ab1-sequence" aria-label="当前区域碱基序列">{data.sequence.slice(start, end).split("").map((b, n) => <button key={start + n} aria-label={`碱基 ${start + n + 1} ${b}`} aria-pressed={selected === start + n} title={`位置 ${start + n + 1}，${data.qualities ? `Q${data.qualities[start + n]}` : "质量缺失"}`} style={{ color: color(b) }} onClick={() => select(start + n)}>{b}</button>)}</div>
      <div className="bio-section-heading"><h2>完整序列</h2><div className="bio-actions"><button onClick={async () => { try { await navigator.clipboard.writeText(data.sequence); setNotice("已复制完整碱基序列。"); } catch { setError("无法访问剪贴板，请选中下方序列复制，或导出 FASTA。"); } }}><Copy size={15} />复制序列</button><button onClick={() => downloadBlob(new Blob([fasta(data)], { type: "text/plain;charset=utf-8" }), data.filename.replace(/\.ab1$/i, ".fasta"))}><Download size={15} />导出 FASTA</button></div></div>
      <textarea className="ab1-full-sequence" aria-label="完整碱基序列" readOnly value={data.sequence} spellCheck={false} />
      <p className="bio-caption">碱基编号从 1 开始；保留 N/R/Y 等 IUPAC 模糊碱基。质量读取文件 PCON，Q20 为常用参考线，不代表此工具重新判定了序列质量。SVG 保留文字，PNG 固化当前浏览器字体。</p>
    </>}
  </section>;
}
