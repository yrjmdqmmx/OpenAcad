import type { ChartStyle, Issue } from "../../core/types";
import type { TreeNode } from "./model";
const visit = (n: TreeNode): TreeNode[] => [n, ...n.children.flatMap(visit)];
/** Read only documented numeric node-time metadata. Original text remains in the project dataset. */
export function parseTimeAnnotations(text: string): Partial<TreeNode> {
  const nodeMetadata = [...text.matchAll(/\[&([^\]]*)\]/g)]
    .map((m) => m[1])
    .join(",");
  const metadata = new Map<string, string>();
  for (const match of nodeMetadata.matchAll(
    /(?:^|[\s,&])([\w.%-]+)\s*=\s*(\{[^{}]*\}|"[^"]*"|'[^']*'|[^,\]\s]+)/g,
  ))
    metadata.set(match[1].toLowerCase(), match[2]);
  const out: Partial<TreeNode> = {};
  const annotations = Object.fromEntries(
    [...metadata]
      .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
      .map(([k, v]) => [k, Number(v)]),
  );
  if (Object.keys(annotations).length) out.annotationValues = annotations;
  const numeric = (keys: string[]) => {
    for (const key of keys)
      if (metadata.has(key)) {
        const raw = metadata
          .get(key)!
          .replace(/^["']|["']$/g, "")
          .trim();
        if (!raw) throw Error(`时间树注释 ${key} 不能为空。`);
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0)
          throw Error(`时间树注释 ${key} 必须是非负有限数字。`);
        return value;
      }
  };
  out.age = numeric(["height", "age"]);
  out.ageMean = numeric(["height_mean", "age_mean"]);
  out.ageMedian = numeric(["height_median", "age_median"]);
  const key = ["height_95%_hpd", "age_95%_hpd", "95%hpd", "95%"].find((k) =>
    metadata.has(k),
  );
  if (key) {
    const raw = metadata.get(key)!;
    if (!/^\{[^{}]*\}$/.test(raw))
      throw Error(`时间树 ${key} 需要 {下界,上界}。`);
    const parts = raw.slice(1, -1).split(",");
    if (parts.some((v) => !v.trim()))
      throw Error(`时间树 ${key} 的区间端点不能为空。`);
    const values = parts.map(Number);
    if (
      values.length !== 2 ||
      values.some((v) => !Number.isFinite(v) || v < 0) ||
      values[0] > values[1]
    )
      throw Error(`时间树 ${key} 下界/上界必须非负、有限且下界不大于上界。`);
    out.hpd = values as [number, number];
    out.timeSource = key.startsWith("95%") ? "MCMCTree" : "BEAST";
    out.hpdKind = key === "95%" ? "unspecified" : "hpd";
  }
  if (
    !out.timeSource &&
    (out.age !== undefined ||
      out.ageMean !== undefined ||
      out.ageMedian !== undefined)
  )
    out.timeSource = "BEAST / 节点年代注释";
  if (out.age !== undefined) out.ageSource = "file";
  const posterior = numeric(["posterior"]);
  if (posterior !== undefined) {
    if (posterior > 1) throw Error("BEAST posterior 必须在 0 到 1 之间。");
    out.posterior = posterior;
  }
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined),
  );
}
/** Existing time branch lengths establish relative ages; this is not an age-estimation procedure. */
export function completeTreeTimes(root: TreeNode) {
  const nodes = visit(root);
  if (!nodes.some((n) => n.timeSource || n.age !== undefined || n.hpd))
    return root;
  const missing = nodes.filter((n) => n.age === undefined);
  if (
    missing.length &&
    nodes.some((n) => n !== root && n.lengthSpecified === false)
  )
    throw Error(
      `时间节点“${missing[0].id}”缺少年代和时间分支长度，不能推导相对年代。`,
    );
  const distances = new Map<TreeNode, number>();
  const walk = (n: TreeNode, d: number) => {
    distances.set(n, d);
    n.children.forEach((c) => walk(c, d + c.length));
  };
  walk(root, 0);
  const explicit = nodes.filter(
    (n) => n.age !== undefined && n.ageSource !== "branchLength",
  );
  const origin =
    root.age ??
    (explicit.length
      ? Math.max(...explicit.map((n) => n.age! + distances.get(n)!))
      : Math.max(
          ...nodes
            .filter((n) => !n.children.length)
            .map((n) => distances.get(n)!),
        ));
  if (missing.length && explicit.length > 1) {
    const anchors = explicit.map((n) => n.age! + distances.get(n)!);
    if (
      Math.max(...anchors) - Math.min(...anchors) >
      1e-5 * Math.max(1, Math.abs(origin))
    )
      throw Error(
        "已有 height 与时间枝长的相对基准不一致，不能为缺失节点推导年代。请提供完整节点年代或一致的时间树。",
      );
  }
  for (const n of nodes)
    if (n.age === undefined) {
      if (n !== root && n.lengthSpecified === false)
        throw Error(
          `时间节点“${n.id}”缺少年代和时间分支长度，不能推导相对年代。`,
        );
      n.age = origin - distances.get(n)!;
      n.ageSource = "branchLength";
    }
  return root;
}
export function timeInfo(root: TreeNode, style: ChartStyle) {
  const nodes = visit(root),
    hasTime = nodes.some(
      (n) =>
        n.age !== undefined ||
        n.hpd ||
        n.ageMean !== undefined ||
        n.ageMedian !== undefined,
    ),
    method = String(style.nodeAgeSource || "height");
  const ages = Object.fromEntries(
    nodes.map((n) => [
      n.id,
      method === "mean"
        ? (n.ageMean ?? n.age ?? 0)
        : method === "median"
          ? (n.ageMedian ?? n.age ?? 0)
          : (n.age ?? 0),
    ]),
  );
  const factor = Number(style.hpdFactor ?? 1);
  const intervals = Object.fromEntries(
    nodes
      .filter((n) => n.hpd)
      .map((n) => [n.id, n.hpd!.map((v) => v * factor) as [number, number]]),
  );
  const active = hasTime && style.timeLayout !== "branch";
  const domain: [number, number] = [
    Math.min(
      0,
      ...Object.values(ages),
      ...Object.values(intervals).map((v) => v[0]),
    ),
    Math.max(
      1e-8,
      ...Object.values(ages),
      ...Object.values(intervals).map((v) => v[1]),
    ),
  ];
  return {
    hasTime,
    active,
    ages,
    intervals,
    domain,
    unit: String(style.timeUnit || "原树时间单位"),
  };
}
export function timeIssues(root: TreeNode, style: ChartStyle): Issue[] {
  const issues: Issue[] = [];
  const info = timeInfo(root, style);
  if (
    !Number.isFinite(Number(style.hpdFactor ?? 1)) ||
    Number(style.hpdFactor ?? 1) <= 0
  )
    issues.push({ message: "区间换算倍率必须是大于 0 的有限数字。" });
  for (const n of visit(root)) {
    for (const key of ["age", "ageMean", "ageMedian"] as const)
      if (n[key] !== undefined && (!Number.isFinite(n[key]) || n[key]! < 0))
        issues.push({ message: `节点“${n.id}”的年代必须是非负有限数字。` });
    if (
      n.hpd &&
      (n.hpd.length !== 2 ||
        n.hpd.some((v) => !Number.isFinite(v) || v < 0) ||
        n.hpd[0] > n.hpd[1])
    )
      issues.push({
        message: `节点“${n.id}”的 95% HPD 需要非负、有限且下界不大于上界。`,
      });
    if (info.active)
      for (const c of n.children)
        if (info.ages[c.id] > info.ages[n.id] + 1e-9)
          issues.push({
            message: `节点“${c.id}”的年代大于父节点“${n.id}”。请核对年代来源或切换原始枝长布局；不会自动改写已有年代估计。`,
          });
  }
  return issues;
}
export const timeExamples = {
  mcmctree:
    "#NEXUS\nBEGIN TREES;\nUTREE 模拟时间树 = ((拟南芥:4,油菜:4)十字花科[&95%HPD={3.1,4.8}]:6,(水稻:6,(玉米:3,小麦:3)禾本组[&95%HPD={2.4,3.7}]:3)禾本科[&95%HPD={5.1,7.2}]:4,(大豆:5,豌豆:5)豆科[&95%HPD={4.2,5.9}]:5)植物[&95%HPD={8.8,11.5}];\nEND;",
  beast:
    "#NEXUS\nBEGIN TREES;\nTRANSLATE 1 拟南芥,2 油菜,3 水稻,4 玉米,5 小麦,6 大豆,7 豌豆;\nTREE 模拟MCC = [&R] ((1[&height=0]:5,2[&height=1]:4)十字花科[&height=5,height_mean=5.2,height_median=5.1,height_95%_HPD={4.1,6.3},posterior=.98]:7,(3[&height=0]:8,(4[&height=0]:4,5[&height=0]:4)禾本组[&height=4,height_95%_HPD={3.2,5.1}]:4)禾本科[&height=8,height_95%_HPD={6.7,9.5}]:4,(6[&height=0]:6,7[&height=0]:6)豆科[&height=6,height_95%_HPD={5.3,7.4}]:6)植物[&height=12,height_mean=12.2,height_median=12.1,height_95%_HPD={10.5,13.6}];\nEND;",
};
