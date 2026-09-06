import { useState } from "react";
import { Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { Project, Template, Layer } from "../core/types";
export function LayersPanel({
  project,
  template,
  commit,
}: {
  project: Project;
  template: Template;
  commit: (p: Project) => void;
}) {
  const [kind, setKind] = useState("text");
  const kinds = [
    {
      type: "text",
      label: "自由文字",
      help: "在画布中拖动文字，位置会随项目保存。",
    },
    ...(template.layerTypes || []),
  ];
  const chosen = kinds.find((k) => k.type === kind) || kinds[0];
  function update(id: string, patch: Partial<Layer>) {
    commit({
      ...project,
      layers: project.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }
  function reorder(i: number, delta: number) {
    const layers = [...project.layers];
    const j = i + delta;
    if (j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    commit({ ...project, layers });
  }
  return (
    <div className="layers-panel">
      <h3>图层</h3>
      <p className="hint">图层数据和位置包含在项目文件中。</p>
      <select
        aria-label="图层类型"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        {kinds.map((k) => (
          <option key={k.type} value={k.type}>
            {k.label}
          </option>
        ))}
      </select>
      <p className="hint">{chosen.help}</p>
      <button
        className="wide"
        onClick={() =>
          commit({
            ...project,
            layers: [
              ...project.layers,
              {
                id: crypto.randomUUID(),
                type: kind,
                name: chosen.label,
                visible: true,
                settings: {
                  text: "文字注释",
                  x: 150,
                  y: 110,
                  fontSize: 18,
                  color: project.style.textColor,
                },
                data:
                  "example" in chosen
                    ? structuredClone(chosen.example)
                    : undefined,
              },
            ],
          })
        }
      >
        <Plus size={15} />
        添加图层
      </button>
      {project.layers.map((l, i) => (
        <details className="layer-item" open key={l.id}>
          <summary>
            <span>{l.name}</span>
            <button
              className="icon-button"
              title={l.visible ? "隐藏" : "显示"}
              onClick={(e) => {
                e.preventDefault();
                update(l.id, { visible: !l.visible });
              }}
            >
              {l.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </summary>
          <label>
            图层名称
            <input
              value={l.name}
              onChange={(e) => update(l.id, { name: e.target.value })}
            />
          </label>
          {l.type === "text" && (
            <>
              <label>
                文字内容
                <input
                  value={String(l.settings.text || "")}
                  onChange={(e) =>
                    update(l.id, {
                      settings: { ...l.settings, text: e.target.value },
                    })
                  }
                />
              </label>
              <div className="two-fields">
                {[
                  ["x", "横坐标"],
                  ["y", "纵坐标"],
                  ["fontSize", "字号"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      value={Number(l.settings[key] || 0)}
                      onChange={(e) =>
                        update(l.id, {
                          settings: { ...l.settings, [key]: +e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  颜色
                  <input
                    type="color"
                    value={String(l.settings.color || "#172b3a")}
                    onChange={(e) =>
                      update(l.id, {
                        settings: { ...l.settings, color: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            </>
          )}
          <div className="button-row">
            <button title="上移" disabled={!i} onClick={() => reorder(i, -1)}>
              <ArrowUp size={14} />
            </button>
            <button
              title="下移"
              disabled={i === project.layers.length - 1}
              onClick={() => reorder(i, 1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              title="删除图层"
              onClick={() =>
                commit({
                  ...project,
                  layers: project.layers.filter((x) => x.id !== l.id),
                })
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        </details>
      ))}
      {!project.layers.length && (
        <p className="empty-note">
          还没有额外图层。图表的基础系列在右侧属性面板编辑。
        </p>
      )}
    </div>
  );
}
