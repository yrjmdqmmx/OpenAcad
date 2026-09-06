import { useState } from "react";
import type { Project, Issue } from "../../core/types";
import { parseText } from "../../core/data";
export type SampleAnnotation = { group: string; label?: string };
export function sampleAnnotations(project: Project) {
  return (project.layout.sampleAnnotations || {}) as Record<
    string,
    SampleAnnotation
  >;
}
export function ordinationIssues(project: Project): Issue[] {
  if (!["pca", "pcoa", "nmds", "cca", "rda"].includes(project.templateId))
    return [];
  const ids = new Set(project.dataset.tables[0]?.rows.map((r) => String(r[0])));
  return Object.keys(sampleAnnotations(project))
    .filter((id) => !ids.has(id))
    .map((id) => ({
      message: `样本注释“${id}”在当前数据中不存在，请删除或重新匹配。`,
    }));
}
export function OrdinationPanel({
  project,
  commit,
}: {
  project: Project;
  commit: (p: Project) => void;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const annotations = sampleAnnotations(project);
  const ids = project.dataset.tables[0]?.rows.map((r) => String(r[0])) || [];
  const set = (id: string, value: SampleAnnotation) =>
    commit({
      ...project,
      layout: {
        ...project.layout,
        sampleAnnotations: { ...annotations, [id]: value },
      },
    });
  return (
    <div className="data-panel">
      <h3>样本分组与标签</h3>
      <p className="hint">
        根据样本编号匹配。分组仅控制图形配色与标签，不会改变计算结果。修改数据后需要重新核对编号。
      </p>
      <details>
        <summary>粘贴分组表</summary>
        <label>
          样本编号、组别、可选显示标签
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"样本\t组别\t显示标签\n样本01\t对照\t对照一"}
          />
        </label>
        <button
          onClick={() => {
            try {
              const t = parseText(text);
              if (t.columns.length < 2)
                throw new Error("分组表至少需要样本编号与组别两列。");
              const next: Record<string, SampleAnnotation> = {};
              for (const [i, row] of t.rows.entries()) {
                const id = String(row[0] ?? "").trim(),
                  group = String(row[1] ?? "").trim();
                if (!ids.includes(id))
                  throw new Error(`第 ${i + 2} 行样本“${id}”不在当前矩阵中。`);
                if (next[id])
                  throw new Error(`第 ${i + 2} 行样本“${id}”重复。`);
                if (!group) throw new Error(`第 ${i + 2} 行组别不能为空。`);
                next[id] = { group, label: row[2] ? String(row[2]) : id };
              }
              commit({
                ...project,
                layout: { ...project.layout, sampleAnnotations: next },
              });
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          应用分组表
        </button>
      </details>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="result-table-scroll">
        <table>
          <thead>
            <tr>
              <th>样本编号</th>
              <th>组别</th>
              <th>显示标签</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => (
              <tr key={id}>
                <th>{id}</th>
                <td>
                  <input
                    aria-label={`${id}组别`}
                    value={annotations[id]?.group || ""}
                    onChange={(e) =>
                      set(id, { ...annotations[id], group: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`${id}显示标签`}
                    value={annotations[id]?.label ?? id}
                    onChange={(e) =>
                      set(id, {
                        ...annotations[id],
                        group: annotations[id]?.group || "",
                        label: e.target.value,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() =>
          commit({
            ...project,
            layout: { ...project.layout, sampleAnnotations: {} },
          })
        }
      >
        清除分组与自定义标签
      </button>
    </div>
  );
}
