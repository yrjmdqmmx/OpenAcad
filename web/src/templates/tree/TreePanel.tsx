import React, { useEffect, useState } from "react";
import { timeExamples, timeInfo, timeIssues } from "./time";
import type { Dataset, Layer, Project } from "../../core/types";
import { parseFile, parseText } from "../../core/data";
import {
  parseTree,
  stateFor,
  sourceText,
  walk,
  modifyTree,
  writeNewick,
  type TreeNode,
  type TreeState,
} from "./model";
import {
  importMemeLayer,
  defaultLayerSettings,
  layerControls,
  layerExample,
  specFor,
  treeLayerSpecs,
  validateLayer,
} from "./layers";
const tsv = (data?: Dataset) =>
  data?.tables[0]
    ? [data.tables[0].columns, ...data.tables[0].rows]
        .map((row) => row.map((v) => String(v ?? "")).join("\t"))
        .join("\n")
    : "";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败，请检查数据。";
function LayerEditor({
  layer,
  root,
  onChange,
  onDelete,
  onMove,
  index,
  last,
}: {
  layer: Layer;
  root: TreeNode;
  onChange: (layer: Layer) => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
  index: number;
  last: boolean;
}) {
  const spec = specFor(layer.type)!;
  const [draft, setDraft] = useState(tsv(layer.data)),
    [error, setError] = useState("");
  useEffect(() => setDraft(tsv(layer.data)), [layer.data]);
  const issues = validateLayer(layer, root);
  const settings = { ...defaultLayerSettings, ...layer.settings };
  const controlKeys = spec.track
    ? [
        "width",
        "gap",
        "opacity",
        "fontSize",
        "title",
        "showTitle",
        ...(["leaf-pie", "lollipop", "category-lollipop"].includes(spec.type)
          ? ["pointSize"]
          : []),
        ...([
          "bar",
          "lollipop",
          "box",
          "heatmap",
          "binary1",
          "binary2",
          "bubble",
          "text-matrix",
        ].includes(spec.type)
          ? ["color"]
          : []),
        ...([
          "lollipop",
          "category-lollipop",
          "box",
          "category-box",
          "binary1",
          "binary2",
        ].includes(spec.type)
          ? ["lineWidth"]
          : []),
        ...([
          "bar",
          "category-bar",
          "lollipop",
          "category-lollipop",
          "motif",
          "recombination",
        ].includes(spec.type)
          ? ["showValues"]
          : []),
      ]
    : spec.type === "branch-text"
      ? ["fontSize", "color", "opacity"]
      : spec.type === "node-link"
        ? ["color", "lineWidth", "opacity"]
        : spec.type === "branch-pie"
          ? ["pointSize", "opacity"]
          : [];
  const controls = layerControls.filter((c) => controlKeys.includes(c.key));
  function apply(data: Dataset) {
    const next = { ...layer, data };
    const errors = validateLayer(next, root);
    if (errors.length) {
      setError(errors.map((e) => e.message).join("\n"));
      return;
    }
    onChange(next);
    setError("");
  }
  return (
    <details className="layer-item" open>
      <summary>{layer.name}</summary>
      <div className="button-row">
        <button onClick={() => onChange({ ...layer, visible: !layer.visible })}>
          {layer.visible ? "隐藏" : "显示"}
        </button>
        <button disabled={!index} onClick={() => onMove(-1)}>
          上移
        </button>
        <button disabled={last} onClick={() => onMove(1)}>
          下移
        </button>
        <button onClick={onDelete}>删除</button>
      </div>
      <p className="hint">{spec.help}</p>
      <label>
        图层名称
        <input
          value={layer.name}
          onChange={(e) => onChange({ ...layer, name: e.target.value })}
        />
      </label>
      <label>
        注释数据（制表符或英文逗号分隔）
        <textarea
          aria-label={layer.name + "数据"}
          rows={6}
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="button-row">
        <button
          onClick={() => {
            try {
              apply({ tables: [{ ...parseText(draft), role: "annotation" }] });
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          应用数据
        </button>
        <button onClick={() => apply(layerExample(spec.type, root))}>
          示例数据
        </button>
        <button onClick={() => apply(layerExample(spec.type, root, true))}>
          另一组示例
        </button>
      </div>
      <label>
        上传图层 CSV / TSV / Excel
        <input
          type="file"
          accept=".csv,.tsv,.xls,.xlsx"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f)
              try {
                const data = await parseFile(f);
                apply({ tables: [{ ...data.tables[0], role: "annotation" }] });
              } catch (err) {
                setError(message(err));
              }
            e.target.value = "";
          }}
        />
      </label>
      {spec.type === "motif" && (
        <label>
          导入原始 MEME 扫描位点 XML
          <input
            type="file"
            accept=".xml"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f)
                try {
                  apply(importMemeLayer(await f.text()));
                } catch (err) {
                  setError(message(err));
                }
              e.target.value = "";
            }}
          />
        </label>
      )}
      {(error || issues.length > 0) && (
        <p role="alert" style={{ color: "#a73535", whiteSpace: "pre-wrap" }}>
          {error || issues.map((i) => i.message).join("\n")}
        </p>
      )}
      <div className="two-fields">
        {controls.map((c) => (
          <label key={c.key}>
            {c.label}
            {c.type === "boolean" ? (
              <input
                type="checkbox"
                checked={Boolean(settings[c.key as keyof typeof settings])}
                onChange={(e) =>
                  onChange({
                    ...layer,
                    settings: { ...settings, [c.key]: e.target.checked },
                  })
                }
              />
            ) : (
              <input
                type={
                  c.type === "number"
                    ? "number"
                    : c.type === "color"
                      ? "color"
                      : "text"
                }
                min={c.min}
                max={c.max}
                step={c.step}
                value={String(settings[c.key as keyof typeof settings] ?? "")}
                onChange={(e) =>
                  onChange({
                    ...layer,
                    settings: {
                      ...settings,
                      [c.key]:
                        c.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    },
                  })
                }
              />
            )}
          </label>
        ))}
      </div>
      {spec.type === "stacked-bar" && (
        <label>
          <input
            type="checkbox"
            checked={Boolean(settings.normalize)}
            onChange={(e) =>
              onChange({
                ...layer,
                settings: { ...settings, normalize: e.target.checked },
              })
            }
          />
          转换为 100% 堆叠
        </label>
      )}
      {spec.type === "branch-color" && (
        <label>
          <input
            type="checkbox"
            checked={Boolean(settings.inherit)}
            onChange={(e) =>
              onChange({
                ...layer,
                settings: { ...settings, inherit: e.target.checked },
              })
            }
          />
          颜色继承到整个子树
        </label>
      )}
    </details>
  );
}
function TimeNodeEditor({
  node,
  apply,
}: {
  node: TreeNode;
  apply: (patch: Partial<TreeNode>) => void;
}) {
  const values = () => ({
    age: String(node.age ?? ""),
    ageMean: String(node.ageMean ?? ""),
    ageMedian: String(node.ageMedian ?? ""),
    low: String(node.hpd?.[0] ?? ""),
    high: String(node.hpd?.[1] ?? ""),
    posterior: String(node.posterior ?? ""),
  });
  const [draft, setDraft] = useState(values),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(values());
    setError("");
  }, [node]);
  const labels = {
    age: "节点年代",
    ageMean: "文件平均年代",
    ageMedian: "文件中位年代",
    low: "95% 区间下界",
    high: "95% 区间上界",
    posterior: "后验概率",
  };
  return (
    <fieldset>
      <legend>已有时间结果 · {node.id}</legend>
      <p className="hint">
        {node.timeSource || "手动"}；
        {node.ageSource === "branchLength"
          ? "年代由已有时间枝长映射至相对基准 0"
          : node.ageSource === "manual"
            ? "手动编辑年代"
            : "读取文件年代"}
        。区间类型：
        {node.hpdKind === "unspecified" ? "原文件未注明" : "95% HPD"}
        。更改不重新估计后验分布。
      </p>
      <div className="two-fields">
        {Object.entries(labels).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              type="number"
              min="0"
              step="any"
              value={draft[key as keyof typeof draft]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button
        onClick={() => {
          try {
            const patch: Partial<TreeNode> = {};
            for (const key of [
              "age",
              "ageMean",
              "ageMedian",
              "posterior",
            ] as const) {
              if (draft[key].trim() === "") {
                patch[key] = undefined;
                continue;
              }
              const value = Number(draft[key]);
              if (
                !Number.isFinite(value) ||
                value < 0 ||
                (key === "posterior" && value > 1)
              )
                throw Error(
                  labels[key] +
                    "必须是合法非负数字" +
                    (key === "posterior" ? "，且不大于 1" : "") +
                    "。",
                );
              patch[key] = value;
            }
            if (draft.low.trim() === "" && draft.high.trim() === "")
              patch.hpd = undefined;
            else {
              if (!draft.low.trim() || !draft.high.trim())
                throw Error("95% 区间上下界必须同时填写。");
              const low = Number(draft.low),
                high = Number(draft.high);
              if (
                !Number.isFinite(low) ||
                !Number.isFinite(high) ||
                low < 0 ||
                low > high
              )
                throw Error("95% 区间必须非负、有限且下界不大于上界。");
              patch.hpd = [low, high];
              patch.hpdKind = node.hpdKind || "hpd";
            }
            if (patch.age === undefined)
              throw Error("节点年代不能为空；请填写已有年代。");
            apply(patch);
            setError("");
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        应用时间结果
      </button>
      {error && (
        <p role="alert" style={{ color: "#a73535" }}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
export function TreePanel({
  project,
  commit,
}: {
  project: Project;
  commit: (project: Project) => void;
}) {
  const [draft, setDraft] = useState(sourceText(project.dataset)),
    [error, setError] = useState(""),
    [kind, setKind] = useState("leaf-pie"),
    [rootOffset, setRootOffset] = useState(0.5);
  const source = sourceText(project.dataset);
  useEffect(() => setDraft(source), [source]);
  let state: TreeState | undefined;
  try {
    state = stateFor(project);
  } catch {}
  const root = state?.root;
  const timing = root ? timeInfo(root, project.style) : undefined;
  const all = root ? walk(root) : [];
  const selected = all.find((n) => n.id === state?.selected) || all[0];
  const layout = String(
    project.style.treeLayout || project.templateId.replace("tree-", ""),
  );
  const available = treeLayerSpecs.filter(
    (spec) => layout !== "unrooted" || spec.unrooted,
  );
  const actualKind = available.some((s) => s.type === kind)
    ? kind
    : available[0].type;
  const treeLayers = project.layers.filter((l) => specFor(l.type));
  function applyTree(text: string, format = "") {
    try {
      const root = parseTree(text, format);
      commit({
        ...project,
        dataset: { tables: [], text, format: format || "newick" },
        layout: { ...project.layout, treeState: { source: text, root } },
        analysis: undefined,
      });
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  function edit(
    operation: Parameters<typeof modifyTree>[2],
    patch: Parameters<typeof modifyTree>[3] = {},
  ) {
    if (!state || !selected) return;
    try {
      const root = modifyTree(state.root, selected.id, operation, patch);
      if (patch.age !== undefined || patch.hpd !== undefined) {
        const issue = timeIssues(root, project.style).find(
          (i) => i.severity !== "warning",
        );
        if (issue) throw Error(issue.message);
      }
      commit({
        ...project,
        layout: {
          ...project.layout,
          treeState: {
            ...state,
            root,
            selected:
              operation === "delete"
                ? root.id
                : operation === "reroot"
                  ? root.id
                  : selected.id,
          },
        },
      });
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  function updateLayer(layer: Layer) {
    commit({
      ...project,
      layers: project.layers.map((l) => (l.id === layer.id ? layer : l)),
    });
  }
  function reorder(id: string, delta: number) {
    const a = [...project.layers],
      i = a.findIndex((l) => l.id === id),
      j = i + delta;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    commit({ ...project, layers: a });
  }
  return (
    <div className="tree-panel">
      <h3>树工作台</h3>
      <p className="hint">
        结构编辑和所有注释会随项目保存，可使用编辑器撤销/重做。点击画布节点可同步选中。
      </p>
      <details>
        <summary>树文件与文本</summary>
        <label>
          Newick / Nexus / phyloXML
          <textarea
            aria-label="树文本"
            rows={7}
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button onClick={() => applyTree(draft)}>应用树文本</button>
        <div className="button-row">
          <button onClick={() => applyTree(timeExamples.mcmctree, "nexus")}>
            试用 MCMCTree 时间树
          </button>
          <button onClick={() => applyTree(timeExamples.beast, "nexus")}>
            试用 BEAST 时间树
          </button>
        </div>
        <p className="hint">
          时间树示例为自行生成的模拟结果。不会执行建树或时间推断；保留来源提供的时间单位和
          95% 区间。
        </p>
        <label>
          上传树文件
          <input
            type="file"
            accept=".nwk,.newick,.tree,.treefile,.nex,.nexus,.xml"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f)
                try {
                  applyTree(await f.text(), f.name.split(".").at(-1));
                } catch (err) {
                  setError(message(err));
                }
              e.target.value = "";
            }}
          />
        </label>
        {root && (
          <button
            onClick={() => {
              const blob = new Blob([writeNewick(root)], {
                type: "text/plain;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "OpenAcad-编辑后的树.nwk";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            下载当前 Newick
          </button>
        )}
      </details>
      {error && (
        <p role="alert" style={{ color: "#a73535" }}>
          {error}
        </p>
      )}
      {root && selected && (
        <>
          <details open>
            <summary>节点与拓扑编辑</summary>
            <label>
              节点（nodeID）
              <select
                aria-label="选择树节点"
                value={selected.id}
                onChange={(e) =>
                  commit({
                    ...project,
                    layout: {
                      ...project.layout,
                      treeState: { ...state, selected: e.target.value },
                    },
                  })
                }
              >
                {all.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.children.length ? "分支" : "叶"} · {n.id}
                    {n.collapsed ? "（已折叠）" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              内部节点 ID 在注释中同样可用。修改显示名称不会改变匹配 ID。
            </p>
            <label>
              节点名称
              <input
                key={selected.id + "name"}
                defaultValue={selected.name}
                onBlur={(e) => {
                  if (e.target.value !== selected.name)
                    edit("update", { name: e.target.value });
                }}
              />
            </label>
            <div className="two-fields">
              <label>
                分支长度
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={timing?.active}
                  title={
                    timing?.active
                      ? "当前按节点年代布局；可切换原始枝长后编辑枝长。"
                      : undefined
                  }
                  value={selected.length}
                  onChange={(e) =>
                    edit("update", { length: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                支持度
                <input
                  type="number"
                  step="0.1"
                  value={selected.support ?? ""}
                  onChange={(e) =>
                    edit("update", {
                      support:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            {timing?.hasTime && (
              <>
                <TimeNodeEditor
                  node={selected}
                  apply={(patch) => edit("update", patch)}
                />
                <p className="hint">
                  按已有年代布局时，节点位置由年代决定，枝长编辑与换根可切换“原始枝长”后进行。平均/中位缺项会明确沿用原树年代；叶节点常没有该摘要。
                </p>
              </>
            )}
            <label>
              换根位置（距选中节点的分支比例）
              <input
                aria-label="换根分支比例"
                type="number"
                min="0"
                max="1"
                step=".05"
                value={rootOffset}
                onChange={(e) =>
                  setRootOffset(
                    Math.max(0, Math.min(1, Number(e.target.value))),
                  )
                }
              />
            </label>
            <div className="button-row">
              <button
                disabled={!selected.children.length}
                onClick={() => edit(selected.collapsed ? "expand" : "fold")}
              >
                {selected.collapsed ? "展开子树" : "折叠子树"}
              </button>
              <button
                disabled={selected.children.length < 2}
                onClick={() => edit("reverse")}
              >
                反转子节点顺序
              </button>
              <button
                disabled={selected.id === root.id || timing?.active}
                onClick={() => edit("reroot", { offset: rootOffset })}
              >
                在选定分支位置换根
              </button>
              <button
                disabled={selected.id === root.id}
                onClick={() => edit("delete")}
              >
                删除此子树
              </button>
            </div>
            {selected.children.length > 1 && (
              <div className="button-row">
                <button onClick={() => edit("sort", { sort: "length" })}>
                  按枝长升序
                </button>
                <button
                  onClick={() =>
                    edit("sort", { sort: "length", descending: true })
                  }
                >
                  按枝长降序
                </button>
                <button
                  onClick={() =>
                    edit("sort", { sort: "leafCount", descending: true })
                  }
                >
                  按叶数降序
                </button>
              </div>
            )}
            {selected.children.length > 1 && (
              <>
                <div className="button-row">
                  <button onClick={() => edit("sort", { sort: "name" })}>
                    按叶名整理子树
                  </button>
                  <button onClick={() => edit("sort", { sort: "leafCount" })}>
                    按叶数整理子树
                  </button>
                </div>
                <p className="hint">
                  直属子节点顺序：调整仅改变排列，不改变连接或分支长度。
                </p>
                {selected.children.map((child, i) => (
                  <div className="button-row" key={child.id}>
                    <span>{child.name || child.id}</span>
                    <button
                      aria-label={child.id + "上移"}
                      disabled={i === 0}
                      onClick={() => {
                        const order = selected.children.map((n) => n.id);
                        [order[i - 1], order[i]] = [order[i], order[i - 1]];
                        edit("reorder", { order });
                      }}
                    >
                      上移
                    </button>
                    <button
                      aria-label={child.id + "下移"}
                      disabled={i === selected.children.length - 1}
                      onClick={() => {
                        const order = selected.children.map((n) => n.id);
                        [order[i + 1], order[i]] = [order[i], order[i + 1]];
                        edit("reorder", { order });
                      }}
                    >
                      下移
                    </button>
                  </div>
                ))}
              </>
            )}
          </details>
          <h3>树注释图层</h3>
          <p className="hint">
            {layout === "unrooted"
              ? "无根布局支持 13 种注释；切换布局时其他图层保留数据并暂停绘制。"
              : "矩形与环形布局各支持 29 种注释。多层会自动扩大画布，避免压缩和裁切。"}
          </p>
          <label>
            注释类型
            <select
              aria-label="树注释类型"
              value={actualKind}
              onChange={(e) => setKind(e.target.value)}
            >
              {available.map((spec) => (
                <option key={spec.type} value={spec.type}>
                  {spec.label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">{specFor(actualKind)!.help}</p>
          <button
            className="wide"
            onClick={() => {
              const spec = specFor(actualKind)!;
              commit({
                ...project,
                layers: [
                  ...project.layers,
                  {
                    id: crypto.randomUUID(),
                    type: "tree:" + spec.type,
                    name: spec.label,
                    visible: true,
                    settings: { ...defaultLayerSettings, title: spec.label },
                    data: layerExample(spec.type, root),
                  },
                ],
              });
            }}
          >
            添加可试用的图层
          </button>
          {treeLayers.map((layer, i) => (
            <LayerEditor
              key={layer.id}
              layer={layer}
              root={root}
              index={i}
              last={i === treeLayers.length - 1}
              onChange={updateLayer}
              onDelete={() =>
                commit({
                  ...project,
                  layers: project.layers.filter((l) => l.id !== layer.id),
                })
              }
              onMove={(d) => reorder(layer.id, d)}
            />
          ))}
          {!treeLayers.length && (
            <p className="empty-note">
              选择上方类型并添加图层，即可试用当前树的配套模拟注释数据。
            </p>
          )}
        </>
      )}
    </div>
  );
}
