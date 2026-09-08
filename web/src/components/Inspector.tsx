import { useState } from "react";
import type { Project, Template, Control } from "../core/types";
import { defaults, palettes } from "../core/project";
import { applyPalette, changeChartStyle, labelControl, paletteVisible, seriesPaletteVisible } from "../core/chartControls";
const common: Control[] = [
  {
    key: "width",
    label: "宽度（像素）",
    type: "number",
    min: 240,
    max: 12000,
    section: "画布",
  },
  {
    key: "height",
    label: "高度（像素）",
    type: "number",
    min: 240,
    max: 12000,
    section: "画布",
  },
  { key: "background", label: "背景颜色", type: "color", section: "画布" },
  { key: "transparent", label: "透明背景", type: "boolean", section: "画布" },
  ...["Top", "Right", "Bottom", "Left"].map((x, i) => ({
    key: "margin" + x,
    label: ["上边距", "右边距", "下边距", "左边距"][i],
    type: "number" as const,
    min: 0,
    max: 1500,
    section: "画布",
  })),
  { key: "title", label: "标题", type: "text", section: "标题与文字" },
  { key: "subtitle", label: "副标题", type: "text", section: "标题与文字" },
  {
    key: "fontFamily",
    label: "字体",
    type: "select",
    options: [
      { value: "Noto Sans SC", label: "思源黑体" },
      { value: "Noto Serif CJK SC", label: "思源宋体" },
    ],
    section: "标题与文字",
  },
  {
    key: "fontSize",
    label: "正文字号",
    type: "number",
    min: 6,
    max: 100,
    section: "标题与文字",
  },
  {
    key: "titleSize",
    label: "标题字号",
    type: "number",
    min: 8,
    max: 150,
    section: "标题与文字",
  },
  { key: "textColor", label: "文字颜色", type: "color", section: "标题与文字" },
  {
    key: "showLegend",
    label: "显示图例",
    type: "boolean",
    section: "配色与图形",
  },
  {
    key: "showLabels",
    label: "显示数值",
    type: "boolean",
    section: "配色与图形",
  },
  {
    key: "opacity",
    label: "透明度",
    type: "number",
    min: 0.05,
    max: 1,
    step: 0.05,
    section: "配色与图形",
  },
];
export function Inspector({
  project,
  template,
  commit,
}: {
  project: Project;
  template: Template;
  commit: (p: Project) => void;
}) {
  const [unit, setUnit] = useState("px");
  const set = (key: string, value: unknown) =>
    commit(changeChartStyle(project, key, value));
  const controls = Array.from(
    new Map([...common, labelControl(template), ...template.controls].map((c) => [c.key, c])).values(),
  ).filter((c) => !c.visible || c.visible(project)).map(c =>
    project.templateId.startsWith("tree-") && ["width", "height"].includes(c.key)
      ? { ...c, label: `最小${c.key === "width" ? "宽度" : "高度"}（像素）`, help: "内容超出时画布自动扩展；实际导出尺寸见图区下方。" }
      : c,
  );
  const optionValue = (c: Control) => {
    const options = c.optionsFor?.(project) ?? c.options ?? [];
    const current = String(project.style[c.key] ?? options[0]?.value ?? "");
    return c.optionsFor && !options.some(o => o.value === current) ? options[0]?.value ?? "" : current;
  };
  const order = ["标题与文字", "配色与图形", "图形", "图表设置", "树布局", "坐标与得分"];
  const sections = Array.from(new Set(controls.map(c => c.section || "图表设置"))).sort((a,b) => {
    const rank = (s: string) => order.includes(s) ? order.indexOf(s) : s === "画布" ? 100 : 50;
    return rank(a) - rank(b);
  });
  return (
    <div className="inspector">
      {sections.map((section) => (
        <details open={!["画布", "坐标与文字", "坐标范围", "坐标断轴", "统计标注"].includes(section)} key={section} data-control-section={section}>
          <summary>{section}</summary>
          {section === "画布" && (
      <label className="control-row">
        <span>画布尺寸单位</span>
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="px">像素</option>
          <option value="mm">毫米</option>
        </select>
      </label>
          )}
          {controls
            .filter((c) => (c.section || "图表设置") === section)
            .map((c) => (
              <label
                className={`control-row ${c.type === "text" ? "text-control" : ""}`}
                key={c.key}
                data-control-key={c.key}
              >
                <span>
                  {unit === "mm" && ["width", "height"].includes(c.key)
                    ? c.label.replace("像素", "毫米")
                    : c.label}
                  {c.help && <small>{c.help}</small>}
                </span>
                {c.type === "boolean" ? (
                  <input
                    type="checkbox"
                    role="switch"
                    checked={c.key === "showBranchLengths" ? Boolean(project.style.showBranchLengths || project.style.showLabels) : !!project.style[c.key]}
                    onChange={(e) => set(c.key, e.target.checked)}
                  />
                ) : c.type === "select" ? (
                  <select
                    aria-label={c.label}
                    value={optionValue(c)}
                    onChange={(e) => set(c.key, e.target.value)}
                  >
                    {(c.optionsFor?.(project) ?? c.options)?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={c.label}
                    type={c.type}
                    value={
                      unit === "mm" && ["width", "height"].includes(c.key)
                        ? Number(
                            (
                              (Number(project.style[c.key]) * 25.4) /
                              96
                            ).toFixed(2),
                          )
                        : String(project.style[c.key] ?? "")
                    }
                    min={
                      unit === "mm" &&
                      ["width", "height"].includes(c.key) &&
                      c.min !== undefined
                        ? (c.min * 25.4) / 96
                        : c.min
                    }
                    max={
                      unit === "mm" &&
                      ["width", "height"].includes(c.key) &&
                      c.max !== undefined
                        ? (c.max * 25.4) / 96
                        : c.max
                    }
                    step={c.step ?? 1}
                    onChange={(e) => {
                      if (c.type === "number") {
                        if (e.target.value === "") {
                          set(c.key, undefined);
                          return;
                        }
                        const v =
                          unit === "mm" && ["width", "height"].includes(c.key)
                            ? (+e.target.value * 96) / 25.4
                            : +e.target.value;
                        if (
                          Number.isFinite(v) &&
                          v >= (c.min ?? -Infinity) &&
                          v <= (c.max ?? Infinity)
                        )
                          set(c.key, v);
                      } else set(c.key, e.target.value);
                    }}
                  />
                )}
              </label>
            ))}
          {section === "配色与图形" && paletteVisible(project) && (
            <>
              <label className="control-row">
                <span>配色方案</span>
                <select
                  aria-label="配色方案"
                  value=""
                  onChange={(e) =>
                    commit({ ...project, style: applyPalette(project, palettes[e.target.value as keyof typeof palettes]) })
                  }
                >
                  <option value="" disabled>
                    选择配色
                  </option>
                  {Object.keys(palettes).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              {seriesPaletteVisible(project) && <div className="swatches">
                {project.style.palette.map((color, i) => (
                  <input
                    key={i}
                    type="color"
                    aria-label={`系列 ${i + 1} 颜色`}
                    value={color}
                    onChange={(e) =>
                      set(
                        "palette",
                        project.style.palette.map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      )
                    }
                  />
                ))}
              </div>}
            </>
          )}
        </details>
      ))}
      <button
        className="wide reset-style"
        onClick={() =>
          commit({
            ...project,
            style: {
              ...structuredClone(defaults),
              ...structuredClone(template.defaultStyle),
            },
          })
        }
      >
        恢复模板默认样式
      </button>
      <p className="hint">恢复样式会保留当前数据，可用撤销恢复。副标题中的模拟来源可在替换为自己的数据后修改。</p>
    </div>
  );
}
