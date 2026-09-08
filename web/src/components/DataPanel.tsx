import { useEffect, useRef, useState } from "react";
import {
  Upload,
  ClipboardPaste,
  Plus,
  Trash2,
  Maximize2,
  Download,
  FileText,
  X,
} from "lucide-react";
import type {
  Project,
  Template,
  DataTable,
  Dataset,
  Issue,
} from "../core/types";
import { parseFile, parseText, exampleWorkbook } from "../core/data";
import { downloadBlob } from "../core/project";

export function DataPanel({
  project,
  template,
  commit,
  issues,
}: {
  project: Project;
  template: Template;
  commit: (p: Project) => void;
  issues: Issue[];
}) {
  const [active, setActive] = useState(0),
    [pasting, setPasting] = useState(false),
    [paste, setPaste] = useState(""),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(false),
    [scroll, setScroll] = useState(0),
    [fieldMap, setFieldMap] = useState<Record<string, string>>({}),
    [activeFile, setActiveFile] = useState(0);
  const [pending, setPending] = useState<Dataset | null>(null),
    [selected, setSelected] = useState<number[]>([0]);
  const input = useRef<HTMLInputElement>(null);
  const table = project.dataset.tables[active] || project.dataset.tables[0];
  useEffect(() => setFieldMap({}), [table?.id]);
  function setDataset(dataset: Dataset) {
    commit({ ...project, dataset });
    setError("");
  }
  function loadBuiltInExample(primary: boolean) {
    // Unedited built-in annotations describe the built-in samples only. Keeping
    // them on another dataset mislabels observations (and can block a matrix).
    // Preserve user-created or edited layers and let their normal validator run.
    const presets = template.exampleLayers || [];
    const retained = project.layers.filter(l => !presets.some(p => JSON.stringify(p) === JSON.stringify(l)));
    const layers = primary ? [...presets.filter(p=>!retained.some(l=>l.id===p.id)), ...retained] : retained;
    commit({...project, dataset:structuredClone(primary ? template.example : template.alternate), layers:structuredClone(layers)});
    setActive(0); setError('');
  }
  function updateTable(next: DataTable) {
    setDataset({
      ...project.dataset,
      tables: project.dataset.tables.map((t) => (t.id === next.id ? next : t)),
    });
  }
  function edit(row: number, col: number, value: string) {
    if (!table) return;
    const rows = table.rows.map((r, i) =>
      i === row
        ? table.columns.map((_, j) => (j === col ? value : (r[j] ?? "")))
        : r,
    );
    updateTable({ ...table, rows });
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      const datasets = await Promise.all(
        Array.from(files).map((f) =>
          parseFile(
            f,
            !!template.example.text || !!template.example.files?.length,
          ),
        ),
      );
      const joined = {
        tables: datasets.flatMap((d) => d.tables),
        files: datasets.flatMap((d) => d.files || []),
        text: datasets.length === 1 ? datasets[0].text : undefined,
        format: datasets[0].format,
      };
      setPending(joined);
      setSelected(joined.tables.map((_, i) => i));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    if (input.current) input.current.value = "";
  }
  function applyImport() {
    if (!pending) return;
    const tables = pending.tables.filter((_, i) => selected.includes(i));
    setDataset({ ...pending, tables });
    setPending(null);
    setActive(0);
  }
  const start = expanded ? Math.max(0, Math.floor(scroll / 34) - 5) : 0;
  const end = expanded ? start + 40 : Math.min(12, table?.rows.length || 0);
  const grid = table && (
    <div
      className="data-grid-scroll"
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
    >
      <table className="data-grid">
        <thead>
          <tr>
            <th>#</th>
            {table.columns.map((c, i) => (
              <th key={i}>
                <input
                  aria-label={`第 ${i + 1} 列名称`}
                  value={c}
                  onChange={(e) =>
                    updateTable({
                      ...table,
                      columns: table.columns.map((v, j) =>
                        j === i ? e.target.value : v,
                      ),
                    })
                  }
                />
                {expanded && (
                  <button
                    className="icon-button"
                    aria-label={`删除第 ${i + 1} 列`}
                    onClick={() =>
                      updateTable({
                        ...table,
                        columns: table.columns.filter((_, j) => j !== i),
                        rows: table.rows.map((r) =>
                          r.filter((_, j) => j !== i),
                        ),
                      })
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </th>
            ))}
            {expanded && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {start > 0 && (
            <tr aria-hidden="true" style={{ height: start * 34 }}>
              <td colSpan={table.columns.length + 2} />
            </tr>
          )}
          {table.rows.slice(start, end).map((row, i) => (
            <tr key={start + i}>
              <th>{start + i + 2}</th>
              {table.columns.map((_, j) => (
                <td
                  key={j}
                  className={
                    issues.some(
                      (x) =>
                        x.tableId === table.id &&
                        x.row === start + i + 2 &&
                        x.column === j + 1,
                    )
                      ? "cell-error"
                      : ""
                  }
                >
                  <input
                    aria-label={`${table.name}第 ${start + i + 2} 行第 ${j + 1} 列`}
                    value={row[j] ?? ""}
                    onChange={(e) => edit(start + i, j, e.target.value)}
                  />
                </td>
              ))}
              {expanded && (
                <td>
                  <button
                    className="icon-button"
                    title="删除此行"
                    onClick={() =>
                      updateTable({
                        ...table,
                        rows: table.rows.filter((_, k) => k !== start + i),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {expanded && end < table.rows.length && (
            <tr
              aria-hidden="true"
              style={{ height: (table.rows.length - end) * 34 }}
            >
              <td colSpan={table.columns.length + 2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="data-panel">
      <h3>数据来源</h3>
      {!!project.dataset.files?.length && (
        <label className="analysis-control">
          粘贴到文件
          <select
            value={activeFile}
            onChange={(e) => setActiveFile(+e.target.value)}
          >
            {project.dataset.files.map((f, i) => (
              <option key={f.id} value={i}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={
          template.formats.map((x) => "." + x.toLowerCase()).join(",") ||
          ".csv,.tsv,.xls,.xlsx"
        }
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <button className="wide" onClick={() => input.current?.click()}>
        <Upload size={16} />
        上传文件
      </button>
      <button className="wide" onClick={() => setPasting(!pasting)}>
        <ClipboardPaste size={16} />
        粘贴数据
      </button>
      <p className="hint">
        {template.formats.join("、").toUpperCase()}；每个文件最多 10 MB
      </p>
      {pasting && (
        <div className="paste-area">
          <label>
            {template.example.text || template.example.files?.length
              ? "粘贴所选专业文件的完整文本"
              : "第一行为列标题，支持逗号或制表符分隔"}
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"类别\t数值\n样本 A\t12"}
              rows={7}
            />
          </label>
          <button
            className="primary"
            onClick={() => {
              try {
                if (project.dataset.files?.length) {
                  setDataset({
                    ...project.dataset,
                    text: undefined,
                    files: project.dataset.files.map((f, i) =>
                      i === activeFile ? { ...f, text: paste } : f,
                    ),
                  });
                } else if (template.example.text) {
                  setDataset({ ...project.dataset, text: paste });
                } else {
                  const t = parseText(paste);
                  t.role = template.example.tables[active]?.role || "data";
                  setDataset({
                    ...project.dataset,
                    tables: project.dataset.tables.map((v, i) =>
                      i === active ? t : v,
                    ),
                  });
                }
                setPasting(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            应用数据
          </button>
        </div>
      )}
      {pending && (
        <div className="import-options">
          <h4>选择工作表和文件角色</h4>
          {pending.tables.map((t, i) => (
            <label key={t.id} className="check-row">
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, i]
                      : selected.filter((x) => x !== i),
                  )
                }
              />
              {t.name} · {t.rows.length} 行
            </label>
          ))}
          {pending.files?.map((f, i) => (
            <label key={f.id} className="analysis-control">
              {f.name} · 文件角色
              <select
                value={f.role}
                onChange={(e) =>
                  setPending({
                    ...pending,
                    files: pending.files!.map((v, j) =>
                      j === i ? { ...v, role: e.target.value } : v,
                    ),
                  })
                }
              >
                <option value={f.role}>{f.role}</option>
                {template.example.files?.map((x) => (
                  <option key={x.role} value={x.role}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="hint">
            导入后请明确选择每张数据表的角色。多文件和多工作表不会凭上传顺序推断分析用途。
          </p>
          <button
            className="primary"
            disabled={
              !selected.length && !pending.files?.length && !pending.text
            }
            onClick={applyImport}
          >
            导入所选内容
          </button>
          <button onClick={() => setPending(null)}>取消</button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <hr />
      <div className="section-heading">
        <h3>
          数据表{" "}
          {table && (
            <small>
              （{table.rows.length} 行 × {table.columns.length} 列）
            </small>
          )}
        </h3>
        <button
          className="icon-button"
          title="展开数据表"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      {project.dataset.tables.length > 1 && (
        <select
          aria-label="选择数据表"
          value={active}
          onChange={(e) => setActive(+e.target.value)}
        >
          {project.dataset.tables.map((t, i) => (
            <option key={t.id} value={i}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      {table && (
        <>
          <div className="role-row">
            <label>
              数据角色
              <select
                value={table.role}
                onChange={(e) =>
                  updateTable({ ...table, role: e.target.value })
                }
              >
                {Array.from(
                  new Map(
                    [...template.example.tables, ...project.dataset.tables].map(
                      (t) => [t.role, t.name],
                    ),
                  ).entries(),
                ).map(([role, name]) => (
                  <option key={role} value={role}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!expanded && grid}
          {table.rows.length > 12 && !expanded && (
            <button className="text-button" onClick={() => setExpanded(true)}>
              查看并编辑全部 {table.rows.length} 行
            </button>
          )}
          <div className="button-row">
            <button
              onClick={() =>
                updateTable({
                  ...table,
                  rows: [...table.rows, table.columns.map(() => "")],
                })
              }
            >
              <Plus size={14} />行
            </button>
            <button
              onClick={() =>
                updateTable({
                  ...table,
                  columns: [...table.columns, `数值 ${table.columns.length}`],
                  rows: table.rows.map((r) => [...r, ""]),
                })
              }
            >
              <Plus size={14} />列
            </button>
            <button
              onClick={() => {
                const t: DataTable = {
                  id: crypto.randomUUID(),
                  name: `数据表 ${project.dataset.tables.length + 1}`,
                  role: `table-${project.dataset.tables.length + 1}`,
                  columns: ["样本", "数值"],
                  rows: [["样本 A", 1]],
                };
                setDataset({
                  ...project.dataset,
                  tables: [...project.dataset.tables, t],
                });
                setActive(project.dataset.tables.length);
              }}
            >
              新增表
            </button>
            <button
              aria-label="删除当前数据表"
              onClick={() => {
                setDataset({
                  ...project.dataset,
                  tables: project.dataset.tables.filter(
                    (t) => t.id !== table.id,
                  ),
                });
                setActive(0);
              }}
            >
              <Trash2 size={14} />表
            </button>
          </div>
        </>
      )}
      {!project.dataset.files?.length && project.dataset.text !== undefined && (
        <label className="text-editor-label">
          <FileText size={16} />
          专业文本
          <textarea
            rows={12}
            value={project.dataset.text}
            onChange={(e) =>
              setDataset({ ...project.dataset, text: e.target.value })
            }
            spellCheck={false}
          />
        </label>
      )}
      {table && (
        <details>
          <summary>映射已有列到模板字段</summary>
          <p className="hint">
            选择原数据中的列，将它对应到模板字段。未映射的列保留。
          </p>
          {(
            template.example.tables.find((t) => t.role === table.role) ||
            template.example.tables[0]
          )?.columns.map((expected) => (
            <label className="analysis-control" key={expected}>
              {expected}
              <select
                value={fieldMap[expected] || ""}
                onChange={(e) =>
                  setFieldMap({ ...fieldMap, [expected]: e.target.value })
                }
              >
                <option value="">保留现有字段</option>
                {table.columns.map((c, i) => (
                  <option value={String(i)} key={i}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            onClick={() => {
              const entries = Object.entries(fieldMap).filter(
                ([, v]) => v !== "",
              );
              if (new Set(entries.map(([, v]) => v)).size !== entries.length) {
                setError("一个原数据列不能同时映射到多个字段。");
                return;
              }
              const columns = table.columns.map(
                (c, i) => entries.find(([, v]) => +v === i)?.[0] || c,
              );
              if (new Set(columns).size !== columns.length) {
                setError("映射后存在重复列名，请调整字段对应关系。");
                return;
              }
              commit({
                ...project,
                mapping: {
                  ...project.mapping,
                  ...Object.fromEntries(
                    entries.map(([k, v]) => [
                      `${table.id}:${k}`,
                      table.columns[+v],
                    ]),
                  ),
                },
                dataset: {
                  ...project.dataset,
                  tables: project.dataset.tables.map((t) =>
                    t.id === table.id ? { ...table, columns } : t,
                  ),
                },
              });
              setFieldMap({});
              setError("");
            }}
          >
            应用字段映射
          </button>
        </details>
      )}
      {project.dataset.files &&
        project.dataset.files.length > 0 &&
        project.dataset.files.map((f, i) => (
          <details key={f.id}>
            <summary>{f.name}</summary>
            <label>
              文件角色
              <select
                value={f.role}
                onChange={(e) =>
                  setDataset({
                    ...project.dataset,
                    files: project.dataset.files!.map((v, j) =>
                      i === j ? { ...v, role: e.target.value } : v,
                    ),
                  })
                }
              >
                <option value={f.role}>{f.name}</option>
                {template.example.files?.map((x) => (
                  <option key={x.role} value={x.role}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              rows={8}
              value={f.text}
              onChange={(e) =>
                setDataset({
                  ...project.dataset,
                  files: project.dataset.files!.map((v, j) =>
                    j === i ? { ...v, text: e.target.value } : v,
                  ),
                })
              }
            />
          </details>
        ))}
      <p className="hint">
        在表格中直接编辑，图表随有效数据更新。空白不会自动填补。
      </p>
      {issues.length > 0 && (
        <div className="issue-list" role="alert">
          <strong>请检查数据</strong>
          {issues.slice(0, 12).map((issue, i) => (
            <p key={i}>{issue.message}</p>
          ))}
          {issues.length > 12 && <p>另有 {issues.length - 12} 个问题。</p>}
        </div>
      )}
      <details>
        <summary>数据格式与字段说明</summary>
        <p className="help-copy">{template.inputHelp}</p>
      </details>
      <div className="button-stack">
        <button
          onClick={() => {
            loadBuiltInExample(true);
          }}
        >
          重新载入示例
        </button>
        <button
          onClick={() => {
            loadBuiltInExample(false);
          }}
        >
          试用另一组数据
        </button>
        <button
          onClick={() => {
            if (template.example.files?.length) {
              template.example.files.forEach((f) =>
                downloadBlob(
                  new Blob([f.text], { type: "text/plain" }),
                  f.name,
                ),
              );
            } else if (template.example.text) {
              downloadBlob(
                new Blob([template.example.text], { type: "text/plain" }),
                `示例.${template.example.format || "txt"}`,
              );
            } else
              downloadBlob(
                exampleWorkbook(template.example),
                `${template.name}-模拟数据.xlsx`,
              );
          }}
        >
          <Download size={14} />
          下载示例数据
        </button>
      </div>
      {expanded && (
        <div className="modal-backdrop">
          <section
            className="table-modal"
            role="dialog"
            aria-modal="true"
            aria-label="编辑数据表"
          >
            <header>
              <h2>{table?.name} · 数据编辑</h2>
              <button
                onClick={() => {
                  setExpanded(false);
                  setScroll(0);
                }}
              >
                <X size={18} />
                完成
              </button>
            </header>
            {grid}
            <footer>
              <button
                onClick={() =>
                  table &&
                  updateTable({
                    ...table,
                    rows: [...table.rows, table.columns.map(() => "")],
                  })
                }
              >
                <Plus size={16} />
                增加一行
              </button>
              <span>可编辑列标题；修改立即进入项目，支持撤销。</span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
