import { describe, expect, it, vi, afterEach } from "vitest";
import * as XLSX from "xlsx";
import { buildKoInput, outputRows, stats, parseKoText, parseKoFile, exportKo, fetchKoBatch, type KoResult } from "./ko";
const known: Record<string, KoResult> = {
  K00001: { ko: "K00001", status: "matched", pathways: [{ id: "map00010", name: "Glycolysis / Gluconeogenesis" }, { id: "map00620", name: "Pyruvate metabolism" }, { id: "map00010", name: "Glycolysis / Gluconeogenesis" }], sourceUrl: "https://rest.kegg.jp/get/ko:K00001", fetchedAt: "2026-09-07T00:00:00Z", message: "" },
  K99999: { ko: "K99999", status: "unmatched", pathways: [], sourceUrl: "https://rest.kegg.jp/get/ko:K99999", fetchedAt: "2026-09-07T00:00:00Z", message: "未收录" },
  K00844: { ko: "K00844", status: "failed", pathways: [], sourceUrl: "", fetchedAt: "", message: "网络失败" },
};
const sheet = { name: "模拟输入", rows: [["gene", "KO", "note"], ["a", "ko:k00001;K00001", "first"], ["b", "K00001|K99999", "dup"], ["c", "BAD", "invalid"], ["d", "", "empty"], ["e", "K00844", "failed"], ["f", "K00002", "pending"]] };
afterEach(() => vi.unstubAllGlobals());
describe("KO 表格转换规则", () => {
  it("原行保留、同格去重、跨行保留、一对多展开且pathway去重", () => {
    const input = buildKoInput(sheet, true, 1), rows = outputRows(input, known);
    expect(rows).toHaveLength(9);
    expect(rows.filter(r => r.ko === "K00001").map(r => r.sourceRow)).toEqual([2, 2, 3, 3]);
    expect(rows[0].values).toEqual(sheet.rows[1]);
    expect(rows.map(r => r.status)).toEqual(["matched", "matched", "matched", "matched", "unmatched", "invalid", "empty", "failed", "pending"]);
    expect(stats(input, known)).toEqual({ rows: 6, valid: 4, matched: 1, unmatched: 1, failed: 1, pending: 1, empty: 1, invalid: 1 });
  });
  it("CSV引号、中文和中间空行保留；纯列表不吞首行", () => {
    const input = buildKoInput(parseKoText('gene,KO,note\na,K00001,"含逗号,备注"\n,,\nb,K99999,x')[0], true, 1);
    expect(input.rows[0].values[2]).toBe("含逗号,备注"); expect(input.rows[1].tokens).toEqual([]);
    expect(buildKoInput(parseKoText("K00001\nK00844\n")[0], false, 0).rows.map(r => r.tokens[0])).toEqual(["K00001", "K00844"]);
  });
  it("Excel导入支持多工作表和KO列选择，不丢原始数字", async () => {
    const b = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet([["备注"], ["请看数据页"]]), "说明"); XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet([["n", "KO"], [42, "K00001"]]), "数据");
    const bytes = XLSX.write(b, { type: "array", bookType: "xlsx" });
    const f = { name: "input.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes } as File;
    const sheets = await parseKoFile(f); expect(sheets.map(s => s.name)).toEqual(["说明", "数据"]); expect(buildKoInput(sheets[1], true, 1).rows[0].values[0]).toBe(42);
  });
  it("Excel和CSV导出保留原行、来源、筛选结果与规则", async () => {
    const input = buildKoInput(sheet, true, 1), rows = outputRows(input, known).filter(r => r.status === "matched");
    const bytes = await exportKo(input, rows, "xlsx", [["输入来源", "模拟数据"]]).arrayBuffer(); const b = XLSX.read(bytes, { type: "array" });
    expect(b.SheetNames).toEqual(["对应结果", "来源与规则"]); const exported = XLSX.utils.sheet_to_json(b.Sheets["对应结果"], { header: 1 }); expect(exported).toHaveLength(5);
    const csv = await exportKo(input, rows, "csv", []).text(); expect(csv).toContain("原表[2]·KO"); expect(csv).toContain("https://rest.kegg.jp/get/ko:K00001");
  });
  it("请求只含KO编号；部分缺失或错误响应不会伪装成未匹配", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [known.K00001], warnings: [] }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    const r = await fetchKoBatch(["K00001", "K00844"], new AbortController().signal);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ ids: ["K00001", "K00844"] }); expect(r.results[1].status).toBe("failed");
  });
  it("断网提供中文错误", async () => { vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))); await expect(fetchKoBatch(["K00001"], new AbortController().signal)).rejects.toThrow(/无法连接/); });
  it("格式限制和空输入提供中文错误", async () => { expect(() => parseKoText(" ")).toThrow(/粘贴/); await expect(parseKoFile({ name: "a.ab1", size: 20 } as File)).rejects.toThrow(/格式/); });
});
