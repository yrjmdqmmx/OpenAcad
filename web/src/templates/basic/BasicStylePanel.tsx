import React, { useState } from "react";
import type { ChartStyle, Project } from "../../core/types";
import { comparisonsFor } from "./Statistics";
import { records, unique, seriesStyle, symbolNames } from "./shared";
export function basicSeriesNames(project: Project) {
  const rows = records(project.dataset);
  if (project.templateId === "dumbbell")
    return [
      String(project.style.startLabel || "起点"),
      String(project.style.endLabel || "终点"),
    ];
  if (project.templateId === "bar-line") return ["柱数值", "折线数值"];
  if (rows.some((r) => r["分组"]))
    return unique(rows.map((r) => String(r["分组"])));
  if (
    ["scatter", "scatter-grouped", "line", "line-error", "radar"].includes(
      project.templateId,
    )
  )
    return ["数据"];
  return unique(rows.map((r) => String(r["类别"] || r["集合"] || "数据")));
}
export function BasicStylePanel({
  project,
  commit,
}: {
  project: Project;
  commit: (p: Project) => void;
}) {
  const names = basicSeriesNames(project),
    [selected, setSelected] = useState(""),
    name = names.includes(selected) ? selected : names[0] || "数据",
    ss = seriesStyle(project.style, name);
  const groups = (project.style.seriesStyles || {}) as Record<
    string,
    Partial<ChartStyle>
  >;
  function patch(key: string, value: unknown) {
    commit({
      ...project,
      style: {
        ...project.style,
        seriesStyles: { ...groups, [name]: { ...groups[name], [key]: value } },
      },
    });
  }
  const radar = project.templateId === "radar",
    dumbbell = project.templateId === "dumbbell";
  const lines = ["line", "line-error"].includes(project.templateId),
    scatter = project.templateId.startsWith("scatter"),
    bars =
      project.templateId.startsWith("bar") &&
      !["bar-line"].includes(project.templateId),
    dist = ["box", "box-grouped", "violin", "raincloud", "ridgeline"].includes(
      project.templateId,
    ),
    pies = ["pie", "rose"].includes(project.templateId),
    points =
      lines ||
      scatter ||
      radar ||
      dumbbell ||
      project.templateId.startsWith("lollipop");
  const fields: [string, string, string, number?, number?, number?][] = [
    ["color", "颜色", "color"],
    ...((bars ||
      lines ||
      scatter ||
      dist ||
      pies ||
      radar ||
      dumbbell ||
      project.templateId.startsWith("lollipop")) &&
    project.templateId !== "bar-line"
      ? ([["opacity", "透明度", "number", 0, 1, 0.05]] as [
          string,
          string,
          string,
          number?,
          number?,
          number?,
        ][])
      : []),
    ...(points
      ? ([
          ["pointSize", "点半径", "number", 1, 20, 1],
          ...(!scatter && !dumbbell
            ? [["lineWidth", "线宽", "number", 0.5, 10, 0.5]]
            : []),
        ] as [string, string, string, number?, number?, number?][])
      : []),
    ...(bars
      ? ([
          ["cornerRadius", "柱角半径", "number", 0, 30, 1],
          ["strokeWidth", "描边宽度", "number", 0, 8, 0.5],
        ] as [string, string, string, number?, number?, number?][])
      : []),
    ...(dist
      ? ([
          ["lineWidth", "线宽", "number", 0.5, 10, 0.5],
          ...(project.style.showPoints || project.templateId.startsWith("box")
            ? [["pointSize", "观测点半径", "number", 1, 20, 1]]
            : []),
        ] as [string, string, string, number?, number?, number?][])
      : []),
  ];
  const annotations = comparisonsFor(project),
    labelControls =
      [
        "line",
        "line-error",
        "scatter",
        "scatter-grouped",
        "pie",
        "rose",
        "radar",
        "dumbbell",
      ].includes(project.templateId) ||
      bars ||
      project.templateId.startsWith("lollipop");
  return (
    <div className="basic-style-panel">
      {(dist || project.templateId.includes("error")) && (
        <p className="hint">
          描述统计与分布轮廓为本地即时预览；在“分析”面板由 NumPy/SciPy
          服务复核后，才能获得带方法版本的计算结果。
        </p>
      )}
      <details>
        <summary>逐系列样式</summary>
        <p className="hint">
          选择数据系列后覆盖局部样式，其他系列保留整体设置。没有覆盖的项跟随整体样式。
        </p>
        <label>
          数据系列
          <select
            aria-label="局部样式系列"
            value={name}
            onChange={(e) => setSelected(e.target.value)}
          >
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="two-fields">
          {fields
            .filter(
              ([key]) =>
                key !== "pointSize" ||
                !(lines || radar) ||
                ss.showPoints !== false,
            )
            .map(([key, label, type, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  type={type}
                  min={min}
                  max={max}
                  step={step}
                  value={String(
                    key === "color"
                      ? groups[name]?.color ||
                          project.style.palette[
                            names.indexOf(name) % project.style.palette.length
                          ]
                      : (ss[key] ?? 0),
                  )}
                  onChange={(e) =>
                    patch(
                      key,
                      type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              </label>
            ))}
        </div>
        {points && (!(lines || radar) || ss.showPoints !== false) && (
          <label>
            点形状
            <select
              value={String(ss.pointShape || "circle")}
              onChange={(e) => patch("pointShape", e.target.value)}
            >
              {symbolNames.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(lines || radar) && (
          <>
            <label>
              <input
                type="checkbox"
                checked={Boolean(ss.dashed)}
                onChange={(e) => patch("dashed", e.target.checked)}
              />
              虚线
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(ss.showPoints)}
                onChange={(e) => patch("showPoints", e.target.checked)}
              />
              显示节点
            </label>
          </>
        )}
        {lines && (
          <>
            <label>
              局部曲线
              <select
                value={String(ss.curve || "linear")}
                onChange={(e) => patch("curve", e.target.value)}
              >
                {[
                  ["linear", "直线"],
                  ["smooth", "单调平滑"],
                  ["step", "后阶梯"],
                  ["stepBefore", "前阶梯"],
                  ["stepCenter", "中阶梯"],
                  ["basis", "B 样条"],
                  ["cardinal", "Cardinal 样条"],
                  ["catmull", "Catmull–Rom"],
                  ["natural", "自然样条"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(ss.fillArea)}
                onChange={(e) => patch("fillArea", e.target.checked)}
              />
              填充此系列线下区域
            </label>
          </>
        )}
        {(radar || (lines && Boolean(ss.fillArea))) && (
          <label>
            面积透明度
            <input
              type="number"
              min="0"
              max="1"
              step=".05"
              value={Number(ss.areaOpacity || 0.2)}
              onChange={(e) => patch("areaOpacity", Number(e.target.value))}
            />
          </label>
        )}
        {(bars || pies || dist || radar || (lines && Boolean(ss.fillArea))) && (
          <label>
            填充纹理
            <select
              value={String(ss.pattern || "none")}
              onChange={(e) => patch("pattern", e.target.value)}
            >
              {[
                ["none", "纯色"],
                ["diagonal", "斜线"],
                ["horizontal", "横线"],
                ["dots", "圆点"],
                ["grid", "网格"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {Boolean(ss.pattern && ss.pattern !== "none") && (
          <div className="two-fields">
            <label>
              纹理间距
              <input
                type="number"
                min="3"
                max="30"
                value={Number(ss.patternSpacing || 8)}
                onChange={(e) =>
                  patch("patternSpacing", Number(e.target.value))
                }
              />
            </label>
            <label>
              纹理线宽
              <input
                type="number"
                min=".5"
                max="5"
                step=".5"
                value={Number(ss.patternWidth || 1.5)}
                onChange={(e) => patch("patternWidth", Number(e.target.value))}
              />
            </label>
          </div>
        )}
        <button
          onClick={() => {
            const next = { ...groups };
            delete next[name];
            commit({
              ...project,
              style: { ...project.style, seriesStyles: next },
            });
          }}
        >
          清除此系列覆盖
        </button>
      </details>
      {labelControls && project.style.showLabels && (
        <details>
          <summary>标签文字与位置</summary>
          <p className="hint">
            柱、折线、散点和饼图启用数值标签后，可在画布中直接拖动标签。移动位置随项目保存。
          </p>
          {[
            ["labelSize", "标签字号", "number"],
            ["labelColor", "标签颜色", "color"],
            ["labelRotation", "标签旋转", "number"],
          ].map(([key, label, type]) => (
            <label key={key}>
              {label}
              <input
                type={type}
                value={String(
                  ss[key] ??
                    (key === "labelColor"
                      ? project.style.textColor
                      : key === "labelSize"
                        ? project.style.fontSize
                        : 0),
                )}
                onChange={(e) =>
                  patch(
                    key,
                    type === "number" ? Number(e.target.value) : e.target.value,
                  )
                }
              />
            </label>
          ))}
          <label>
            标签字体
            <select
              value={String(ss.labelFont || project.style.fontFamily)}
              onChange={(e) => patch("labelFont", e.target.value)}
            >
              <option value="Noto Sans SC">思源黑体</option>
              <option value="Noto Serif CJK SC">思源宋体</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(ss.labelBold)}
              onChange={(e) => patch("labelBold", e.target.checked)}
            />
            标签粗体
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(ss.labelItalic)}
              onChange={(e) => patch("labelItalic", e.target.checked)}
            />
            标签斜体
          </label>
          <button
            onClick={() =>
              commit({ ...project, layout: { ...project.layout, labels: {} } })
            }
          >
            重置所有拖动位置
          </button>
        </details>
      )}
      {records(project.dataset).some((r) => r["类别"]) &&
        !["pie", "rose", "radar"].includes(project.templateId) &&
        !(lines && project.style.xScaleType === "linear") && (
          <details>
            <summary>分类色带图层</summary>
            <p className="hint">
              每个类别按名称匹配色块与文字，可更改颜色、内容并隐藏图层。
            </p>
            <button
              onClick={() => {
                const categories = unique(
                  records(project.dataset).map(
                    (r) =>
                      (project.templateId === "bar-grouped-stacked"
                        ? String(r["大组"]) + " · "
                        : "") + String(r["类别"]),
                  ),
                );
                const axis =
                  ["raincloud", "ridgeline", "dumbbell"].includes(
                    project.templateId,
                  ) || project.style.orientation === "horizontal"
                    ? "y"
                    : "x";
                commit({
                  ...project,
                  layers: [
                    ...project.layers,
                    {
                      id: crypto.randomUUID(),
                      type: "basic:category-band",
                      name: "类别注释",
                      visible: true,
                      settings: {
                        axis,
                        width: 24,
                        gap: 8,
                        opacity: 0.85,
                        fontSize: 11,
                      },
                      data: {
                        tables: [
                          {
                            id: "bands",
                            role: "annotation",
                            name: "类别色带",
                            columns: ["类别", "颜色", "文字"],
                            rows: categories.map((c, i) => [
                              c,
                              project.style.palette[
                                i % project.style.palette.length
                              ],
                              c,
                            ]),
                          },
                        ],
                      },
                    },
                  ],
                });
              }}
            >
              添加分类色带
            </button>
            {project.layers
              .filter((l) => l.type === "basic:category-band")
              .map((layer) => (
                <div className="layer-item" key={layer.id}>
                  <label>
                    图层名称
                    <input
                      value={layer.name}
                      onChange={(e) =>
                        commit({
                          ...project,
                          layers: project.layers.map((l) =>
                            l.id === layer.id
                              ? { ...l, name: e.target.value }
                              : l,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={(e) =>
                        commit({
                          ...project,
                          layers: project.layers.map((l) =>
                            l.id === layer.id
                              ? { ...l, visible: e.target.checked }
                              : l,
                          ),
                        })
                      }
                    />
                    显示色带
                  </label>
                  <div className="two-fields">
                    {[
                      ["width", "色带宽度", 6, 80, 1],
                      ["gap", "图层间距", 0, 50, 1],
                      ["opacity", "色带透明度", 0, 1, 0.05],
                      ["fontSize", "色带字号", 6, 30, 1],
                    ].map(([key, label, min, max, step]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min={Number(min)}
                          max={Number(max)}
                          step={Number(step)}
                          value={Number(layer.settings[String(key)])}
                          onChange={(e) =>
                            commit({
                              ...project,
                              layers: project.layers.map((l) =>
                                l.id === layer.id
                                  ? {
                                      ...l,
                                      settings: {
                                        ...l.settings,
                                        [String(key)]: Number(e.target.value),
                                      },
                                    }
                                  : l,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {layer.data!.tables[0].rows.map((row, i) => (
                    <div className="two-fields" key={i}>
                      <label>
                        {String(row[0])}
                        <input
                          type="color"
                          value={String(row[1])}
                          onChange={(e) => {
                            const data = structuredClone(layer.data!);
                            data.tables[0].rows[i][1] = e.target.value;
                            commit({
                              ...project,
                              layers: project.layers.map((l) =>
                                l.id === layer.id ? { ...l, data } : l,
                              ),
                            });
                          }}
                        />
                      </label>
                      <label>
                        色带文字
                        <input
                          value={String(row[2])}
                          onChange={(e) => {
                            const data = structuredClone(layer.data!);
                            data.tables[0].rows[i][2] = e.target.value;
                            commit({
                              ...project,
                              layers: project.layers.map((l) =>
                                l.id === layer.id ? { ...l, data } : l,
                              ),
                            });
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      commit({
                        ...project,
                        layers: project.layers.filter((l) => l.id !== layer.id),
                      })
                    }
                  >
                    删除色带
                  </button>
                </div>
              ))}
          </details>
        )}
      {project.style.showLegend && (
        <details>
          <summary>图例格式</summary>
          <label>
            图例文字
            <input
              value={String(groups[name]?.legendLabel ?? name)}
              onChange={(e) => patch("legendLabel", e.target.value)}
            />
          </label>
          <label>
            图例字号
            <input
              type="number"
              min="6"
              max="60"
              value={Number(ss.legendSize || project.style.fontSize)}
              onChange={(e) => patch("legendSize", Number(e.target.value))}
            />
          </label>
          <label>
            图例字体
            <select
              value={String(ss.legendFont || project.style.fontFamily)}
              onChange={(e) => patch("legendFont", e.target.value)}
            >
              <option value="Noto Sans SC">思源黑体</option>
              <option value="Noto Serif CJK SC">思源宋体</option>
            </select>
          </label>
          <label>
            图例文字颜色
            <input
              type="color"
              value={String(ss.legendColor || project.style.textColor)}
              onChange={(e) => patch("legendColor", e.target.value)}
            />
          </label>
          <label>
            图例符号
            <select
              value={String(ss.legendShape || "square")}
              onChange={(e) => patch("legendShape", e.target.value)}
            >
              {[...symbolNames, ["line", "线段"]].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            图例底色
            <input
              type="color"
              value={String(project.style.legendBackground || "#ffffff")}
              onChange={(e) =>
                commit({
                  ...project,
                  style: { ...project.style, legendBackground: e.target.value },
                })
              }
            />
          </label>
          <p className="hint">图例可在画布中拖动。可在“配色与图形”关闭图例。</p>
        </details>
      )}
      {annotations.length > 0 && (
        <details open>
          <summary>真实统计结果标注</summary>
          <p className="hint">
            使用当前计算返回的 P
            值。可拖动括号或字母，自定义位置随项目保存。切换数据后旧结果失效；不会用模拟
            P 值代替计算。
          </p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(project.style.showStatistics)}
              onChange={(e) =>
                commit({
                  ...project,
                  style: { ...project.style, showStatistics: e.target.checked },
                })
              }
            />
            绘制组间比较括号
          </label>
          <label>
            显示内容
            <select
              value={String(project.style.statLabel || "stars")}
              onChange={(e) =>
                commit({
                  ...project,
                  style: { ...project.style, statLabel: e.target.value },
                })
              }
            >
              <option value="stars">显著性星号</option>
              <option value="p">P 值</option>
              <option
                value="letters"
                disabled={
                  annotations.length <
                  (new Set(annotations.flatMap((a) => [a.left, a.right])).size *
                    (new Set(annotations.flatMap((a) => [a.left, a.right]))
                      .size -
                      1)) /
                    2
                }
              >
                紧凑字母分组（需要全部两两比较）
              </option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={project.style.statAdjusted !== false}
              onChange={(e) =>
                commit({
                  ...project,
                  style: { ...project.style, statAdjusted: e.target.checked },
                })
              }
            />
            使用校正 P 值
          </label>
          <label>
            显著性水平
            <input
              type="number"
              min=".0001"
              max=".5"
              step=".01"
              value={Number(project.style.statAlpha || 0.05)}
              onChange={(e) =>
                commit({
                  ...project,
                  style: {
                    ...project.style,
                    statAlpha: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <p className="hint">
            默认显示前 6
            项，可选择要标注的比较；较多比较需要增加画布高度。字母分组使用全部比较；共享字母表示未检出差异，不代表已证明相同。
          </p>
          {annotations.map((a, i) => (
            <label key={i}>
              <input
                type="checkbox"
                checked={(
                  (project.style.statComparisons as number[] | undefined) ||
                  annotations.slice(0, 6).map((_, i) => i)
                ).includes(i)}
                onChange={(e) => {
                  const selected =
                    (project.style.statComparisons as number[] | undefined) ||
                    annotations.slice(0, 6).map((_, i) => i);
                  commit({
                    ...project,
                    style: {
                      ...project.style,
                      statComparisons: e.target.checked
                        ? [...selected, i]
                        : selected.filter((v) => v !== i),
                    },
                  });
                }}
              />
              {a.left} ↔ {a.right}
            </label>
          ))}
          <button
            onClick={() =>
              commit({
                ...project,
                layout: { ...project.layout, statistics: {} },
              })
            }
          >
            重置统计标注位置
          </button>
          <label>
            标注颜色
            <input
              type="color"
              value={String(project.style.statColor || project.style.textColor)}
              onChange={(e) =>
                commit({
                  ...project,
                  style: { ...project.style, statColor: e.target.value },
                })
              }
            />
          </label>
          <label>
            标注字号
            <input
              type="number"
              min="6"
              max="40"
              value={Number(project.style.statSize || project.style.fontSize)}
              onChange={(e) =>
                commit({
                  ...project,
                  style: { ...project.style, statSize: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            括号间距
            <input
              type="number"
              min="14"
              max="60"
              value={Number(project.style.statSpacing || 22)}
              onChange={(e) =>
                commit({
                  ...project,
                  style: {
                    ...project.style,
                    statSpacing: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </details>
      )}
    </div>
  );
}
