import type { Project } from "./types";
import { inputHash } from "./project";

export const isOrdination = (p: Project) => ["pca", "pcoa", "nmds", "cca", "rda"].includes(p.templateId);
export function ordinationExportIssue(p: Project): string | undefined {
  if (!isOrdination(p)) return;
  const scores = p.style.ordinationInput === "scores"
    ? p.dataset.tables[0]?.rows.map(r => r.slice(1).map(Number))
    : (p.analysis?.result?.data as { scores?: number[][] } | undefined)?.scores;
  if (!scores?.length) return "尚无有效分析结果，请先在分析面板运行计算。";
  const a = Number(p.style.axisOne ?? 1) - 1, b = Number(p.style.axisTwo ?? 2) - 1;
  if (a === b || scores.some(row => !Number.isFinite(row[a]) || !Number.isFinite(row[b])))
    return "请选择两个不同的有效坐标轴后再导出。";
}
export async function assertExportReady(p: Project) {
  const issue = ordinationExportIssue(p);
  if (issue) throw new Error(issue);
  if (isOrdination(p) && p.style.ordinationInput !== "scores") {
    const a = p.analysis!;
    if (await inputHash(p.dataset, a.method, a.params) !== a.inputHash)
      throw new Error("数据或参数已变化，请重新计算分析结果后再导出。");
  }
}
