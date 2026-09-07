import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { downloadBlob } from "../core/project";
import { buildKoInput, exportKo, fetchKoBatch, koRules, outputRows, parseKoFile, parseKoText, stats, statusNames, uniqueKos, type InputSheet, type KoResult } from "./ko";

export function KoConverter() {
  const [text, setText] = useState(""), [sheets, setSheets] = useState<InputSheet[]>([]), [sheetIndex, setSheetIndex] = useState(0), [header, setHeader] = useState(false), [column, setColumn] = useState(0), [sourceName, setSourceName] = useState("");
  const [results, setResults] = useState<Record<string, KoResult>>({}), [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState(""), [warnings, setWarnings] = useState<string[]>([]), [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null), controller = useRef<AbortController | null>(null), requestId = useRef(0);
  useEffect(() => () => { requestId.current++; controller.current?.abort(); }, []);
  const input = useMemo(() => sheets[sheetIndex] ? buildKoInput(sheets[sheetIndex], header, column) : null, [sheets, sheetIndex, header, column]);
  const summary = useMemo(() => input ? stats(input, results) : null, [input, results]);
  const rows = useMemo(() => input ? outputRows(input, results) : [], [input, results]);
  const deferredSearch = useDeferredValue(search.toLowerCase());
  const filtered = useMemo(() => rows.filter(row => (filter === "all" || row.status === filter) && (!deferredSearch || [row.sourceRow, row.ko, row.pathway?.id, row.pathway?.name, row.pathway?.classification, ...row.values].join(" ").toLowerCase().includes(deferredSearch))), [rows, filter, deferredSearch]);
  const pages = Math.max(1, Math.ceil(filtered.length / 50)), shownPage = Math.min(page, pages - 1);
  const frozen = busy || reading;
  function resetResults() { setResults({}); setProgress(""); setWarnings([]); setError(""); setFilter("all"); setSearch(""); setPage(0); }
  function accept(next: InputSheet[], name: string, hasHeader: boolean) {
    const first = Math.max(0, next.findIndex(s => s.rows.length));
    setSheets(next); setSheetIndex(first); setHeader(hasHeader);
    const koColumn = hasHeader ? next[first]?.rows[0]?.findIndex(c => /^(ko|ko编号|ko号|kegg[_ ]?ko)$/i.test(String(c).trim())) ?? -1 : 0;
    setColumn(Math.max(0, koColumn)); setSourceName(name); resetResults();
  }
  async function read(file: File) {
    setReading(true); setError("");
    try { accept(await parseKoFile(file), file.name, true); } catch (e) { setError((e as Error).message); } finally { setReading(false); }
  }
  async function sample() {
    setReading(true); setError("");
    try { const response = await fetch("/examples/bio/ko-example.tsv"); if (!response.ok) throw new Error("示例加载失败，请重试。"); accept(parseKoText(await response.text()), "模拟 KO 输入示例", true); } catch (e) { setError((e as Error).message); } finally { setReading(false); }
  }
  async function run(retry = false) {
    if (!input) return;
    const all = uniqueKos(input);
    if (all.length > 2000) { setError("一次最多查询 2000 个不同的有效 KO，请拆分表格。原始数据仍保留。"); return; }
    if (!input.rows.length) { setError("没有数据行，请检查“首行为列标题”设置。"); return; }
    const ids = retry ? all.filter(ko => !results[ko] || results[ko].status === "failed") : all;
    if (!ids.length) { setProgress("没有需要查询的有效 KO；空值和无效编号已保留，可直接导出结果。"); return; }
    const runId = ++requestId.current, aborter = new AbortController(); controller.current = aborter;
    setBusy(true); setError(""); setWarnings([]); if (!retry) setResults({});
    let failedBatches = 0, completed = 0;
    for (let i = 0; i < ids.length && !aborter.signal.aborted; i += 10) {
      const batch = ids.slice(i, i + 10), timeout = new AbortController();
      const stop = () => timeout.abort(); aborter.signal.addEventListener("abort", stop, { once: true });
      const timer = window.setTimeout(stop, 120_000);
      setProgress(`正在查询第 ${Math.floor(i / 10) + 1} / ${Math.ceil(ids.length / 10)} 批，共 ${ids.length} 个去重 KO。已完成的结果可随时筛选和导出。`);
      try {
        const response = await fetchKoBatch(batch, timeout.signal);
        if (requestId.current !== runId) return;
        const additions = Object.fromEntries(response.results.map(r => [r.ko, r]));
        setResults(previous => ({ ...previous, ...additions }));
        setWarnings(previous => [...new Set([...previous, ...response.warnings])]);
        failedBatches = response.results.every(r => r.status === "failed") ? failedBatches + 1 : 0;
      } catch (e) {
        if (requestId.current !== runId) return;
        const message = timeout.signal.aborted && !aborter.signal.aborted ? "本批次超过两分钟，请稍后重试。" : (e as Error).message;
        setResults(previous => ({ ...previous, ...Object.fromEntries(batch.map(ko => [ko, { ko, status: "failed", pathways: [], sourceUrl: "", fetchedAt: "", message } satisfies KoResult])) }));
        failedBatches++;
      } finally { clearTimeout(timer); aborter.signal.removeEventListener("abort", stop); }
      completed += batch.length;
      if (failedBatches >= 3) { setError("连续三批查询失败，已暂停后续请求。成功结果已保留，可重试失败及待查询项。"); break; }
    }
    if (requestId.current === runId) {
      setBusy(false); controller.current = null;
      setProgress(aborter.signal.aborted ? "查询已停止，已完成结果保留；可重试失败及待查询项。" : `本轮已处理 ${completed} / ${ids.length} 个去重 KO，请查看下方状态统计。`);
    }
  }
  function download(format: "csv" | "xlsx") {
    if (!input) return;
    try {
      const meta = [["输入来源", sourceName], ["工作表", sheets[sheetIndex]?.name ?? ""], ["KO列", input.columns[column]], ["导出范围", `当前筛选，共 ${filtered.length} 行；状态筛选：${statusNames[filter] ?? "全部"}；检索：${search || "无"}`], ["数据来源", "KEGG REST API https://rest.kegg.jp；每条对应关系和分类均记录实际获取时间；服务内存缓存最多6小时；没有内置完整数据库。"], ["导出时间", new Date().toISOString()], ["统计", JSON.stringify(summary)]];
      downloadBlob(exportKo(input, filtered, format, meta), `KO-pathway-${filter}.${format}`);
    } catch (e) { setError(`导出失败：${(e as Error).message}`); }
  }
  return <section className="bio-tool" aria-labelledby="ko-title">
    <header className="bio-tool-heading"><div><h1 id="ko-title">KO 转 pathway 信息表</h1><p>保留原表，展开一对多关系，逐项核对转换状态。</p></div><a href="#bio">全部生物信息学工具</a></header>
    <div className="bio-import" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!frozen && e.dataTransfer.files[0]) void read(e.dataTransfer.files[0]); }}><Upload size={24} aria-hidden="true" /><div><strong>导入 KO 表格</strong><p>CSV / TSV / Excel，最多 10 MB、10000 行、200 列。文件和原表字段留在本机。</p></div><button className="primary" disabled={frozen} onClick={() => fileInput.current?.click()}>选择表格文件</button><button disabled={frozen} onClick={() => void sample()}>打开模拟示例</button><input ref={fileInput} type="file" accept=".csv,.tsv,.xlsx,.xls" aria-label="KO 表格文件" hidden onChange={e => { if (e.target.files?.[0]) void read(e.target.files[0]); e.target.value = ""; }} /></div>
    <div className="ko-paste"><label htmlFor="ko-text">或粘贴 KO 列表 / 表格</label><textarea id="ko-text" placeholder={"K00001\nK00844\nko:K00001"} value={text} onChange={e => setText(e.target.value)} disabled={frozen} spellCheck={false} /><div className="bio-actions"><button disabled={frozen} onClick={() => { try { accept(parseKoText(text), "粘贴输入", false); } catch (e) { setError((e as Error).message); } }}>读取粘贴内容</button><span className="bio-caption">默认每行一个 KO，无表头；粘贴表格后可勾选列标题并选择 KO 列。</span></div></div>
    <p className="bio-caption">示例由 OpenAcad 编排，基因名称与备注为模拟数据；KO 对应关系在线查询 KEGG。<a href="/examples/bio/ko-example.tsv" download>下载 TSV 示例</a></p>
    <details className="bio-help"><summary>格式、数据来源与结果规则</summary><p>{koRules}</p><p>接受 K00001、ko:K00001，大小写统一；一个单元格可含多个 KO。原始行号含列标题所在行。仅转换为参考通路 map 编号，不推断物种或基因功能。</p><p>仅去重后的有效 KO 编号发送到 OpenAcad 查询服务及 KEGG，原表其他字段不发送。每批最多 10 个、一次最多 2000 个不同 KO；服务每秒最多 2 次上游请求，缓存最多 6 小时。查询失败与未匹配分别记录，已成功结果不丢失。</p><p><a href="https://www.kegg.jp/kegg/rest/" target="_blank" rel="noreferrer">KEGG API</a> 面向学术用户的学术用途；商业用途须遵循数据源授权。对应关系来自 KO 的 PATHWAY 字段，分类来自 pathway 的 CLASS 字段；以每条获取时间作为数据新鲜度记录。名称保留来源原文，缺失分类不猜测。</p><p>CSV / Excel 导出当前筛选结果。Excel 附“来源与规则”工作表；CSV 保留逐条来源与时间，并对潜在公式文本添加单引号以便安全打开。</p></details>
    {reading && <p role="status">正在本地读取表格…</p>}{error && <p role="alert" className="bio-error">{error}</p>}
    {!input ? <div className="bio-empty"><h2>从一个 KO 编号开始</h2><p>粘贴列表或打开模拟示例，选择 KO 所在列后开始转换。空值、无效编号和未匹配记录都会保留。</p></div> : <>
      <div className="bio-section-heading"><h2>输入预览</h2><span>{sourceName}</span></div>
      <div className="bio-toolbar"><label>工作表 <select aria-label="工作表" value={sheetIndex} disabled={frozen} onChange={e => { setSheetIndex(Number(e.target.value)); setColumn(0); resetResults(); }}>{sheets.map((s, i) => <option value={i} key={i}>{s.name}</option>)}</select></label><label className="bio-checkbox"><input type="checkbox" checked={header} disabled={frozen} onChange={e => { setHeader(e.target.checked); resetResults(); }} />首行为列标题</label><label>KO 所在列 <select aria-label="KO 所在列" value={column} disabled={frozen} onChange={e => { setColumn(Number(e.target.value)); resetResults(); }}>{input.columns.map((c, i) => <option key={i} value={i}>{i + 1}. {c}</option>)}</select></label></div>
      <div className="bio-table-scroll" tabIndex={0} aria-label="输入表格预览"><table><thead><tr><th>原始行号</th>{input.columns.map((c, i) => <th className={i === column ? "ko-column" : ""} key={i}>{c}</th>)}</tr></thead><tbody>{input.rows.slice(0, 5).map(row => <tr key={row.sourceRow}><td>{row.sourceRow}</td>{row.values.map((v, i) => <td className={i === column ? "ko-column" : ""} key={i}>{String(v ?? "") || "—"}</td>)}</tr>)}</tbody></table></div>
      <div className="bio-toolbar"><button className="primary" disabled={frozen} onClick={() => void run(false)}>开始转换</button>{busy ? <button onClick={() => controller.current?.abort()}>停止查询</button> : summary && (summary.failed > 0 || (Object.keys(results).length > 0 && summary.pending > 0)) && <button onClick={() => void run(true)}>重试失败及待查询项</button>}<span className="bio-caption">只查询所选列的有效 KO，输入预览显示前 5 行。</span></div>
      {progress && <p role="status" className="bio-progress">{progress}</p>}{warnings.map(w => <p className="bio-notice" key={w}>{w}</p>)}
      {summary && <dl className="ko-stats" aria-label="转换统计">{[["输入行", summary.rows], ["有效 KO（去重）", summary.valid], ["已匹配 KO", summary.matched], ["未匹配 KO", summary.unmatched], ["查询失败 KO", summary.failed], ["待查询 KO", summary.pending], ["空值行", summary.empty], ["无效项", summary.invalid]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
      <p className="bio-caption">有效、已匹配、未匹配、查询失败和待查询均按不同 KO 计数；无效项按每行去重后的无效编号计数。结果表按对应关系展开，因此行数可大于输入行数。此转换不是富集分析。</p>
      <div className="bio-section-heading"><h2>对应结果</h2><span>展开后 {rows.length} 行 · 筛选后 {filtered.length} 行</span></div>
      <div className="bio-toolbar"><label>匹配状态 <select aria-label="匹配状态" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="all">全部状态</option>{Object.entries(statusNames).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label><label className="ko-search">检索结果 <input aria-label="检索结果" type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="KO、pathway、名称或原表字段" /></label><button onClick={() => download("csv")}><Download size={15} />导出 CSV</button><button onClick={() => download("xlsx")}>导出 Excel</button></div>
      <div className="bio-table-scroll ko-result-scroll" tabIndex={0} aria-label="KO pathway 结果"><table><thead><tr><th>原始行号</th><th>KO 编号</th><th>pathway 编号</th><th>pathway 名称</th><th>分类</th><th>匹配状态</th><th>说明 / 获取时间</th>{input.columns.map((c, i) => <th key={i}>原表·{c}</th>)}</tr></thead><tbody>{filtered.slice(shownPage * 50, shownPage * 50 + 50).map((row, i) => <tr key={`${row.sourceRow}-${row.ko}-${row.pathway?.id}-${i}`}><td>{row.sourceRow}</td><td>{row.ko || "—"}</td><td>{row.pathway ? <a href={`https://www.kegg.jp/pathway/${row.pathway.id}`} target="_blank" rel="noreferrer">{row.pathway.id}</a> : "—"}</td><td>{row.pathway?.name || "—"}</td><td>{row.pathway?.classification || "—"}</td><td><span className={`ko-status is-${row.status}`}>{statusNames[row.status]}</span></td><td>{row.result?.message}{row.result?.fetchedAt && <a className="ko-source-time" href={row.result.sourceUrl} target="_blank" rel="noreferrer">KEGG · {new Date(row.result.fetchedAt).toLocaleString("zh-CN")}</a>}</td>{row.values.map((v, n) => <td key={n}>{String(v ?? "") || "—"}</td>)}</tr>)}</tbody></table>{!filtered.length && <p className="bio-empty-inline">没有符合筛选条件的结果。</p>}</div>
      <div className="bio-pagination"><button disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>上一页</button><span>第 {shownPage + 1} / {pages} 页 · 每页 50 行</span><button disabled={shownPage >= pages - 1} onClick={() => setPage(shownPage + 1)}>下一页</button></div>
    </>}
  </section>;
}
