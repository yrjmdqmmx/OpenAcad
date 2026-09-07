import * as XLSX from "xlsx";
import type { Cell } from "../core/types";

export type InputSheet = { name: string; rows: Cell[][] };
export type KoInput = { columns: string[]; rows: { sourceRow: number; values: Cell[]; tokens: string[] }[] };
export type Pathway = { id: string; name: string; classification?: string; classSourceUrl?: string; classFetchedAt?: string };
export type KoResult = { ko: string; status: "matched" | "unmatched" | "failed"; pathways: Pathway[]; fetchedAt: string; sourceUrl: string; message: string };
export type OutputRow = { sourceRow: number; values: Cell[]; ko: string; status: string; pathway?: Pathway; result?: KoResult };
export const statusNames: Record<string, string> = { matched: "已匹配", unmatched: "未匹配", failed: "查询失败", invalid: "编号无效", empty: "空值", pending: "待查询" };
export const validKo = (s: string) => /^K\d{5}$/.test(s);
export const normalizeKo = (s: string) => s.trim().replace(/^ko:/i, "").toUpperCase();
export const koRules = "原表每行保留；同一单元格按空白、分号、逗号、竖线分隔并去重；跨行重复KO只查询一次但分别输出；一条原始行×一个KO×一个pathway一行，pathway内去重；空值、无效、未匹配、失败均保留。此转换不是富集分析。";

function sheetRows(book: XLSX.WorkBook): InputSheet[] {
  return book.SheetNames.map(name => {
    const sheet = book.Sheets[name], ref = sheet["!ref"];
    if (!ref) return { name, rows: [] };
    const range = XLSX.utils.decode_range(ref);
    if (range.e.r >= 10001 || range.e.c >= 200) throw new Error("表格超过上限：最多 10000 行数据、200 列。请先拆分表格。");
    return { name, rows: XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: true, range: 0 }) as Cell[][] };
  });
}
export function parseKoText(text: string): InputSheet[] {
  if (!text.trim()) throw new Error("请先粘贴 KO 列表或带列标题的表格。");
  if (text.length > 10 * 1024 * 1024) throw new Error("粘贴内容超过 10 MB，请拆分。");
  return sheetRows(XLSX.read(text, { type: "string", raw: true, FS: text.includes("\t") ? "\t" : "," }));
}
export async function parseKoFile(file: File): Promise<InputSheet[]> {
  if (!/\.(csv|tsv|xlsx|xls)$/i.test(file.name)) throw new Error("不支持的表格格式，请导入 CSV、TSV、XLS 或 XLSX 文件。");
  if (file.size > 10 * 1024 * 1024) throw new Error("表格超过 10 MB，请拆分后导入。");
  try {
    const sheets = /\.(csv|tsv)$/i.test(file.name) ? parseKoText(await file.text()) : sheetRows(XLSX.read(await file.arrayBuffer(), { type: "array", raw: true, codepage: 65001 }));
    if (!sheets.some(s => s.rows.length)) throw new Error("文件中没有可读取的数据。");
    return sheets;
  } catch (e) { throw new Error(`表格读取失败：${(e as Error).message} 请检查文件是否损坏或加密。`); }
}
export function buildKoInput(sheet: InputSheet, header: boolean, column: number): KoInput {
  const width = Math.max(1, ...sheet.rows.map(r => r.length));
  const columns = Array.from({ length: width }, (_, i) => header ? String(sheet.rows[0]?.[i] || `列 ${i + 1}`) : `列 ${i + 1}`);
  return { columns, rows: sheet.rows.slice(header ? 1 : 0).map((values, i) => {
    const raw = String(values[column] ?? "").trim();
    return { sourceRow: i + (header ? 2 : 1), values: columns.map((_, index) => values[index] ?? ""), tokens: raw ? [...new Set(raw.split(/[\s;,；，|]+/).filter(Boolean).map(normalizeKo))] : [] };
  }) };
}
export function uniqueKos(input: KoInput) { return [...new Set(input.rows.flatMap(r => r.tokens.filter(validKo)))]; }
export function outputRows(input: KoInput, results: Record<string, KoResult>): OutputRow[] {
  return input.rows.flatMap(row => (row.tokens.length ? row.tokens : [""]).flatMap(ko => {
    const base = { sourceRow: row.sourceRow, values: row.values, ko };
    if (!ko) return [{ ...base, status: "empty" }];
    if (!validKo(ko)) return [{ ...base, status: "invalid" }];
    const result = results[ko];
    if (!result) return [{ ...base, status: "pending" }];
    if (result.status !== "matched") return [{ ...base, status: result.status, result }];
    const paths = [...new Map(result.pathways.map(p => [p.id, p])).values()].sort((a, b) => a.id.localeCompare(b.id));
    return paths.map(pathway => ({ ...base, status: "matched", pathway, result }));
  }));
}
export function stats(input: KoInput, results: Record<string, KoResult>) {
  const unique = uniqueKos(input);
  return { rows: input.rows.length, valid: unique.length, matched: unique.filter(k => results[k]?.status === "matched").length, unmatched: unique.filter(k => results[k]?.status === "unmatched").length, failed: unique.filter(k => results[k]?.status === "failed").length, pending: unique.filter(k => !results[k]).length, empty: input.rows.filter(r => !r.tokens.length).length, invalid: input.rows.reduce((n, r) => n + r.tokens.filter(k => !validKo(k)).length, 0) };
}
export function exportRows(input: KoInput, rows: OutputRow[]) {
  return [["原始行号", "KO编号", "pathway编号", "pathway名称", "分类", "匹配状态", "说明", "对应关系来源", "对应关系获取时间", "分类来源", "分类获取时间", ...input.columns.map((c, i) => `原表[${i + 1}]·${c}`)], ...rows.map(row => [row.sourceRow, row.ko, row.pathway?.id ?? "", row.pathway?.name ?? "", row.pathway?.classification ?? "", statusNames[row.status], row.result?.message ?? "", row.result?.sourceUrl ?? "", row.result?.fetchedAt ?? "", row.pathway?.classSourceUrl ?? "", row.pathway?.classFetchedAt ?? "", ...row.values])];
}
export function exportKo(input: KoInput, rows: OutputRow[], format: "csv" | "xlsx", metadata: string[][]) {
  const cells = exportRows(input, rows);
  if (format === "csv") {
    // CSV formulas are escaped on export; original values remain intact in state/XLSX.
    const safe = cells.map(row => row.map(v => typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? "'" + v : v));
    return new Blob(["\uFEFF", XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(safe))], { type: "text/csv;charset=utf-8" });
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(cells), "对应结果");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["项目", "说明"], ...metadata, ["展开与去重", koRules], ["统计口径", "输入按原表行；有效、已匹配、未匹配、失败和待查询按去重后的有效KO。"], ["CSV说明", "CSV的潜在公式文本添加单引号，Excel文件保留原始单元格值。"]]), "来源与规则");
  return new Blob([XLSX.write(book, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function fetchKoBatch(ids: string[], signal: AbortSignal): Promise<{ results: KoResult[]; warnings: string[] }> {
  let response: Response;
  try { response = await fetch("/api/bio/ko-pathways", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }), signal }); }
  catch { throw new Error(signal.aborted ? "本批次查询已停止，已完成结果仍保留。" : "无法连接 KO 查询服务，请检查网络或本地生物信息学服务后重试。"); }
  if (!response.ok) throw new Error(`KO 查询服务暂不可用（HTTP ${response.status}），已完成结果仍保留。`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error("查询服务返回格式异常，请重试。");
  const checked: KoResult[] = ids.map(ko => {
    const r = data.results.find((item: KoResult) => item.ko === ko);
    if (!r || !["matched", "unmatched", "failed"].includes(r.status) || !Array.isArray(r.pathways) || (r.status === "matched" && (!r.pathways.length || r.pathways.some((p: Pathway) => !/^map\d{5}$/.test(p.id) || !p.name)))) return { ko, status: "failed", pathways: [], fetchedAt: "", sourceUrl: "", message: "本批次未返回完整记录，请重试。" };
    return r;
  });
  return { results: checked, warnings: Array.isArray(data.warnings) ? data.warnings : [] };
}
