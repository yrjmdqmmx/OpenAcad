import { parseTimeAnnotations, completeTreeTimes } from "./time";
import type { Dataset, Project } from "../../core/types";
export interface TreeNode {
  id: string;
  name: string;
  length: number;
  lengthSpecified?: boolean;
  support?: number;
  annotationValues?: Record<string, number>;
  age?: number;
  ageMean?: number;
  ageMedian?: number;
  hpd?: [number, number];
  hpdKind?: "hpd" | "unspecified";
  posterior?: number;
  timeSource?: string;
  ageSource?: "file" | "branchLength" | "manual";
  children: TreeNode[];
  collapsed?: boolean;
}
export interface TreeState {
  source: string;
  root: TreeNode;
  selected?: string;
}
export const walk = (root: TreeNode): TreeNode[] => [
  root,
  ...root.children.flatMap(walk),
];
export const leaves = (root: TreeNode): TreeNode[] =>
  root.children.length ? root.children.flatMap(leaves) : [root];
export const visibleLeaves = (root: TreeNode): TreeNode[] =>
  root.collapsed || !root.children.length
    ? [root]
    : root.children.flatMap(visibleLeaves);
export function sourceText(dataset: Dataset) {
  return (
    dataset.text ||
    dataset.files?.find(
      (f) =>
        ["tree", "newick", "nexus", "phyloxml"].includes(f.role) ||
        /\.(nwk|newick|tree|treefile|nex|nexus|xml)$/i.test(f.name),
    )?.text ||
    ""
  );
}
function assignIds(root: TreeNode) {
  let i = 0;
  const ids = new Set<string>();
  const leafNames = new Set<string>();
  for (const node of walk(root)) {
    if (!node.children.length) {
      if (!node.name.trim()) throw Error("叶节点名称不能为空。");
      if (leafNames.has(node.name))
        throw Error(
          `叶名称“${node.name}”重复，注释无法唯一匹配。请给每个叶节点不同名称。`,
        );
      leafNames.add(node.name);
    }
    let id = node.id || node.name || `内部节点${++i}`;
    while (ids.has(id)) id = `${id}_${++i}`;
    ids.add(id);
    node.id = id;
  }
  if (leaves(root).length < 2) throw Error("树至少需要两个叶节点。");
  return root;
}
/** Newick recursive-descent parser: quoted labels, comments, scientific branch lengths. */
export function parseNewick(text: string): TreeNode {
  let i = 0;
  const input = text.replace(/^\uFEFF/, "").trim();
  function fail(message: string): never {
    throw Error(`Newick 第 ${i + 1} 个字符：${message}`);
  }
  function skip() {
    while (i < input.length) {
      if (/\s/.test(input[i])) {
        i++;
        continue;
      }
      if (input[i] === "[") {
        let depth = 1;
        i++;
        while (i < input.length && depth) {
          if (input[i] === "[") depth++;
          if (input[i] === "]") depth--;
          i++;
        }
        if (depth) fail("注释缺少 ]。");
        continue;
      }
      break;
    }
  }
  function label() {
    skip();
    if (input[i] === "'") {
      i++;
      let out = "";
      while (i < input.length) {
        if (input[i] === "'") {
          i++;
          if (input[i] === "'") {
            out += "'";
            i++;
          } else return out;
        } else out += input[i++];
      }
      fail("引号名称没有结束。");
    }
    const start = i;
    while (i < input.length && !/[,:;()\[\]\s]/.test(input[i])) i++;
    return input.slice(start, i);
  }
  function node(): TreeNode {
    skip();
    const children: TreeNode[] = [];
    if (input[i] === "(") {
      i++;
      children.push(node());
      skip();
      while (input[i] === ",") {
        i++;
        children.push(node());
        skip();
      }
      if (input[i] !== ")") fail("子树缺少右括号 )。");
      i++;
    }
    const tailStart = i;
    const name = label();
    skip();
    const nodeAnnotations = input.slice(tailStart, i);
    let length = 1;
    let lengthSpecified = false;
    if (input[i] === ":") {
      lengthSpecified = true;
      i++;
      skip();
      const start = i;
      while (i < input.length && !/[,;)\[\]\s]/.test(input[i])) i++;
      const raw = input.slice(start, i);
      length = Number(raw);
      if (!raw || !Number.isFinite(length) || length < 0)
        fail(`分支长度“${raw}”必须是非负有限数字。`);
    }
    skip();
    const supportTag = input
      .slice(tailStart, i)
      .match(/\[(?:&support=|&&NHX:B=)([\d.eE+-]+)\]/);
    const annotations = parseTimeAnnotations(nodeAnnotations);
    const multiSupport =
      children.length && /^[-+\d.eE]+\/[-+\d.eE/]+$/.test(name)
        ? name.split("/").map(Number)
        : [];
    if (multiSupport.length && multiSupport.every(Number.isFinite))
      annotations.annotationValues = {
        ...annotations.annotationValues,
        ...Object.fromEntries(
          multiSupport.map((v, i) => ["support" + (i + 1), v]),
        ),
      };
    const support =
      children.length && name !== "" && Number.isFinite(Number(name))
        ? Number(name)
        : supportTag
          ? Number(supportTag[1])
          : (annotations.annotationValues?.support ?? multiSupport[0]);
    return {
      ...annotations,
      id: "",
      name,
      length,
      lengthSpecified,
      children,
      ...(support === undefined ? {} : { support }),
    };
  }
  if (!input) fail("请填写树文本。");
  const root = node();
  skip();
  if (input[i] !== ";") fail("树必须以分号 ; 结束。");
  i++;
  skip();
  if (i < input.length) fail("树结束后仍有其他内容；请一次导入一棵树。");
  root.length = 0;
  return completeTreeTimes(assignIds(root));
}
function splitQuoted(text: string, delimiter: string) {
  const parts: string[] = [];
  let start = 0,
    quoted = false,
    brackets = 0;
  for (let i = 0; i < text.length; i++) {
    if (!quoted && text[i] === "[") brackets++;
    if (!quoted && text[i] === "]") brackets--;
    if (text[i] === "'") {
      if (quoted && text[i + 1] === "'") {
        i++;
        continue;
      }
      quoted = !quoted;
    }
    if (!quoted && !brackets && text[i] === delimiter) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}
export function parseNexus(text: string): TreeNode {
  const block = text.match(/begin\s+trees\s*;([\s\S]*?)end\s*;/i)?.[1];
  if (!block) throw Error("Nexus 缺少 BEGIN TREES; … END; 区块。");
  const statements = splitQuoted(block, ";");
  const treeStatement = statements.find((s) =>
    /^\s*(?:\[[^\]]*\]\s*)*(?:tree|utree)\s/i.test(s),
  );
  if (!treeStatement)
    throw Error("Nexus 树区块没有可读取的 TREE 名称 = Newick;。");
  const equals = treeStatement.indexOf("=");
  if (equals < 0) throw Error("Nexus TREE 语句缺少 =。");
  const root = parseNewick(treeStatement.slice(equals + 1) + ";");
  const translate = statements
    .find((s) => /^\s*translate\s/i.test(s))
    ?.replace(/^\s*translate\s/i, "");
  if (translate) {
    const map = new Map<string, string>();
    for (const row of splitQuoted(translate, ",")) {
      const pair = row.trim().match(/^(\S+)\s+([\s\S]+)$/);
      if (!pair)
        throw Error("Nexus TRANSLATE 需使用“编号 名称”，用英文逗号分隔。");
      map.set(
        pair[1],
        pair[2]
          .trim()
          .replace(/^'(.*)'$/s, "$1")
          .replace(/''/g, "'"),
      );
    }
    for (const n of walk(root)) {
      if (!n.children.length) {
        if (!map.has(n.name))
          throw Error(`Nexus TRANSLATE 缺少叶编号“${n.name}”。`);
        n.name = map.get(n.name)!;
        n.id = "";
      }
    }
  }
  return assignIds(root);
}
type XmlNode = {
  tag: string;
  text: string;
  children: XmlNode[];
  attributes?: Record<string, string>;
};
const decode = (s: string) =>
  s.replace(/&(?:#(x[\da-f]+|\d+)|(amp|lt|gt|quot|apos));/gi, (_, n, e) =>
    n
      ? String.fromCodePoint(
          n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n),
        )
      : (
          { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<
            string,
            string
          >
        )[e],
  );
/** Deliberately no DTD or network entity resolution; only ordinary XML element content is used. */
export function parsePhyloXml(text: string): TreeNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw Error("phyloXML 不接受 DTD 或外部实体，请导出普通 phyloXML。");
  const root: XmlNode = { tag: "document", text: "", children: [] };
  const stack = [root];
  const tokens =
    text.match(
      /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+/g,
    ) || [];
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      stack.at(-1)!.text += token.slice(9, -3);
      continue;
    }
    if (token.startsWith("</")) {
      const tag = token.slice(2, -1).trim().split(":").at(-1);
      if (stack.length === 1 || stack.at(-1)!.tag !== tag)
        throw Error(`phyloXML 元素闭合不匹配：${token}`);
      stack.pop();
    } else if (token.startsWith("<")) {
      const name = token.match(/^<\s*([^\s/>]+)/)?.[1];
      if (!name) throw Error("phyloXML 标签无效。");
      const attributes = Object.fromEntries(
        [...token.matchAll(/([\w:.-]+)\s*=\s*(['"])([\s\S]*?)\2/g)].map((m) => [
          m[1].split(":").at(-1)!,
          decode(m[3]),
        ]),
      );
      const n: XmlNode = {
        tag: name.split(":").at(-1)!,
        text: "",
        children: [],
        attributes,
      };
      stack.at(-1)!.children.push(n);
      if (!/\/\s*>$/.test(token)) stack.push(n);
    } else stack.at(-1)!.text += decode(token);
  }
  if (stack.length !== 1) throw Error("phyloXML 存在未闭合元素。");
  const find = (n: XmlNode, tag: string): XmlNode | undefined =>
    n.tag === tag ? n : n.children.map((c) => find(c, tag)).find(Boolean);
  const phylo = find(root, "phylogeny");
  if (!phylo) throw Error("phyloXML 缺少 phylogeny 元素。");
  const clade = phylo.children.find((c) => c.tag === "clade");
  if (!clade) throw Error("phyloXML 缺少根 clade。");
  const convert = (n: XmlNode): TreeNode => {
    const val = (tag: string) =>
      n.children.find((c) => c.tag === tag)?.text.trim();
    const children = n.children.filter((c) => c.tag === "clade").map(convert);
    const taxonomy = n.children.find((c) => c.tag === "taxonomy");
    const name =
      val("name") ||
      taxonomy?.children
        .find((c) => ["scientific_name", "common_name"].includes(c.tag))
        ?.text.trim() ||
      "";
    const raw = val("branch_length") ?? n.attributes?.branch_length,
      length = raw === undefined ? 1 : Number(raw),
      support = val("confidence");
    if (!Number.isFinite(length) || length < 0)
      throw Error(`节点“${name}”的 branch_length 必须是非负有限数字。`);
    if (support !== undefined && !Number.isFinite(Number(support)))
      throw Error(`节点“${name}”的 confidence 必须是数字。`);
    return {
      id: val("id") || "",
      name,
      length,
      children,
      ...(support === undefined ? {} : { support: Number(support) }),
    };
  };
  const result = convert(clade);
  result.length = 0;
  return assignIds(result);
}
export function parseTree(text: string, format = ""): TreeNode {
  return /phyloxml|xml/i.test(format) || /^\s*</.test(text)
    ? parsePhyloXml(text)
    : /nex/i.test(format) || /^\s*#NEXUS/i.test(text)
      ? parseNexus(text)
      : parseNewick(text);
}
export function stateFor(project: Project): TreeState {
  const source = sourceText(project.dataset);
  const stored = project.layout.treeState as TreeState | undefined;
  return stored && stored.source === source
    ? stored
    : { source, root: parseTree(source, project.dataset.format) };
}
export function modifyTree(
  root: TreeNode,
  id: string,
  operation:
    | "fold"
    | "expand"
    | "reverse"
    | "delete"
    | "update"
    | "reroot"
    | "reorder"
    | "sort",
  patch: Partial<TreeNode> & {
    offset?: number;
    order?: string[];
    sort?: "name" | "leafCount" | "length";
    descending?: boolean;
  } = {},
): TreeNode {
  const originalInternal = new Set(
    walk(root)
      .filter((n) => n.children.length)
      .map((n) => n.id),
  );
  const copy = structuredClone(root);
  const node = walk(copy).find((n) => n.id === id);
  if (!node) throw Error(`找不到节点“${id}”。`);
  if (operation === "reroot") {
    if (id === copy.id) return copy;
    const edges = new Map<
      string,
      { node: TreeNode; neighbors: { id: string; length: number }[] }
    >(walk(copy).map((n) => [n.id, { node: n, neighbors: [] }]));
    for (const n of walk(copy))
      for (const c of n.children) {
        edges.get(n.id)!.neighbors.push({ id: c.id, length: c.length });
        edges.get(c.id)!.neighbors.push({ id: n.id, length: c.length });
      }
    const parent = walk(copy).find((n) => n.children.some((c) => c.id === id))!;
    const length = node.length;
    const orient = (at: string, from: string, len: number): TreeNode => {
      const entry = edges.get(at)!;
      return {
        ...entry.node,
        length: len,
        collapsed: false,
        children: entry.neighbors
          .filter((n) => n.id !== from)
          .map((n) => orient(n.id, at, n.length)),
      };
    };
    const offset = Math.max(0, Math.min(1, patch.offset ?? 0.5));
    let newId = `重定根_${id}`,
      suffix = 1;
    while (edges.has(newId)) newId = `重定根_${id}_${suffix++}`;
    return {
      id: newId,
      name: "重定根",
      length: 0,
      children: [
        orient(id, parent.id, length * offset),
        orient(parent.id, id, length * (1 - offset)),
      ],
    };
  }
  if (operation === "reorder") {
    const order = patch.order || [];
    if (
      order.length !== node.children.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !node.children.some((c) => c.id === id))
    )
      throw Error("子节点顺序必须包含每个直属子节点且不能重复。");
    node.children = order.map((id) => node.children.find((n) => n.id === id)!);
  } else if (operation === "sort") {
    const sort = (n: TreeNode) => {
      n.children.forEach(sort);
      n.children.sort(
        (a, b) =>
          (patch.descending ? -1 : 1) *
          (patch.sort === "leafCount"
            ? leaves(a).length - leaves(b).length
            : patch.sort === "length"
              ? a.length - b.length
              : leaves(a)
                  .map((v) => v.name)
                  .sort()[0]
                  .localeCompare(
                    leaves(b)
                      .map((v) => v.name)
                      .sort()[0],
                    "zh-CN",
                  )),
      );
    };
    sort(node);
  } else if (operation === "delete") {
    if (id === copy.id) throw Error("不能删除根节点。");
    const parent = walk(copy).find((n) => n.children.some((c) => c.id === id))!;
    parent.children = parent.children.filter((c) => c.id !== id);
    const prune = (n: TreeNode) => {
      for (const c of n.children) prune(c);
      n.children = n.children.filter(
        (c) => !originalInternal.has(c.id) || c.children.length > 0,
      );
    };
    prune(copy);
    if (leaves(copy).length < 2)
      throw Error("删除后不足两个叶节点，操作已取消。");
  } else if (operation === "reverse") node.children.reverse();
  else if (operation === "fold") node.collapsed = true;
  else if (operation === "expand") node.collapsed = false;
  else {
    if (
      patch.length !== undefined &&
      (!Number.isFinite(patch.length) || patch.length < 0)
    )
      throw Error("分支长度必须是非负有限数字。");
    if (patch.support !== undefined && !Number.isFinite(patch.support))
      throw Error("支持度必须是有限数字。");
    if (patch.name !== undefined && !node.children.length) {
      if (!patch.name.trim()) throw Error("叶名称不能为空。");
      if (
        walk(copy).some(
          (n) => n.id !== id && !n.children.length && n.name === patch.name,
        )
      )
        throw Error("叶名称重复，请使用不同名称。");
    }
    for (const key of ["age", "ageMean", "ageMedian"] as const)
      if (
        patch[key] !== undefined &&
        (!Number.isFinite(patch[key]) || patch[key]! < 0)
      )
        throw Error("节点年代必须是非负有限数字。");
    if (
      patch.hpd &&
      (patch.hpd.length !== 2 ||
        patch.hpd.some((v) => !Number.isFinite(v) || v < 0) ||
        patch.hpd[0] > patch.hpd[1])
    )
      throw Error("95% HPD 下界/上界必须非负且下界不大于上界。");
    if (patch.age !== undefined) patch.ageSource = "manual";
    if (patch.length !== undefined) patch.lengthSpecified = true;
    Object.assign(node, { ...patch, id: node.id, children: node.children });
  }
  return copy;
}
export function writeNewick(root: TreeNode): string {
  const quote = (s: string) =>
    /[,():;\s'\[\]]/.test(s) ? "'" + s.replace(/'/g, "''") + "'" : s;
  const timeMetadata = (n: TreeNode) => {
    const values: string[] = [];
    if (n.age !== undefined) values.push("height=" + n.age);
    if (n.ageMean !== undefined) values.push("height_mean=" + n.ageMean);
    if (n.ageMedian !== undefined) values.push("height_median=" + n.ageMedian);
    if (n.hpd)
      values.push(
        (n.hpdKind === "unspecified" ? "95%" : "height_95%_HPD") +
          "={" +
          n.hpd.join(",") +
          "}",
      );
    if (n.posterior !== undefined) values.push("posterior=" + n.posterior);
    for (const [key, value] of Object.entries(n.annotationValues || {}))
      if (
        ![
          "height",
          "height_mean",
          "height_median",
          "posterior",
          "age",
          "age_mean",
          "age_median",
        ].includes(key) &&
        /^[\w.%-]+$/.test(key) &&
        Number.isFinite(value)
      )
        values.push(key + "=" + value);
    return values.length ? "[&" + values.join(",") + "]" : "";
  };
  const visit = (n: TreeNode, isRoot = false): string =>
    (n.children.length
      ? "(" + n.children.map((c) => visit(c)).join(",") + ")"
      : "") +
    quote(
      n.children.length &&
        n.support !== undefined &&
        Number.isFinite(Number(n.name))
        ? String(n.support)
        : n.name || String(n.support ?? ""),
    ) +
    (n.support !== undefined && n.name && !Number.isFinite(Number(n.name))
      ? "[&support=" + n.support + "]"
      : "") +
    timeMetadata(n) +
    (isRoot ? "" : ":" + n.length);
  return visit(root, true) + ";";
}
