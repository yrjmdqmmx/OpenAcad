import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, mkdirSync } from "node:fs";
import { templates } from "../src/templates";
import { makeProject } from "../src/core/project";
import type { Control } from "../src/core/types";
const common: Control[] = [
  { key: "title", label: "标题", type: "text" },
  { key: "subtitle", label: "副标题", type: "text" },
  { key: "width", label: "宽度", type: "number", min: 600, max: 1400 },
  { key: "height", label: "高度", type: "number", min: 450, max: 1200 },
  { key: "fontSize", label: "字号", type: "number", min: 10, max: 30 },
  { key: "titleSize", label: "标题字号", type: "number", min: 12, max: 40 },
  { key: "showLabels", label: "显示数值", type: "boolean" },
  { key: "showLegend", label: "图例", type: "boolean" },
  { key: "opacity", label: "透明度", type: "number", min: 0.1, max: 0.8 },
  { key: "background", label: "背景", type: "color" },
  { key: "textColor", label: "文字颜色", type: "color" },
  ...["Top", "Right", "Bottom", "Left"].map((k) => ({
    key: "margin" + k,
    label: "边距" + k,
    type: "number" as const,
    min: 20,
    max: 140,
  })),
];
test("保存每个声明控件的实际 SVG 变化证据，条件控件另行验收", () => {
  const records = [];
  mkdirSync("../tests/artifacts", { recursive: true });
  writeFileSync(
    "../tests/artifacts/template-cases.json",
    JSON.stringify(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        project: { ...makeProject(t), id: `openacad-acceptance-${t.id}` },
        alternate: t.alternate,
      })),
      null,
      2,
    ),
  );
  for (const t of templates) {
    const p = makeProject(t),
      base = renderToStaticMarkup(<t.Renderer project={p} />);
    expect(base).not.toMatch(/NaN|Infinity/);
    const cs = Array.from(
      new Map([...common, ...t.controls].map((c) => [c.key, c])).values(),
    );
    for (const c of cs) {
      if (c.visible && !c.visible(p)) continue;
      const prepared = structuredClone(p);
      if (/^[xy]Break$/.test(c.key)) {
        const axis = c.key[0];
        Object.assign(prepared.style, {
          [axis + "Min"]: 0,
          [axis + "Max"]: 100,
          [axis + "BreakStart"]: 30,
          [axis + "BreakEnd"]: 40,
          [axis + "Break"]: false,
        });
      }
      const reference = renderToStaticMarkup(<t.Renderer project={prepared} />);
      const initial = prepared.style[c.key];
      const candidates =
        c.type === "boolean"
          ? [!initial]
          : c.type === "select"
            ? (c.options || []).map((o) => o.value).filter((v) => v !== initial)
            : c.type === "color"
              ? ["#d42178"]
              : c.type === "text"
                ? /TickFormat$/.test(c.key)
                  ? [".2f", ".2e"]
                  : ["审计文字"]
                : [c.min ?? 1, c.max ?? Number(initial || 1) * 1.5 + 1];
      let changed = false,
        error = "";
      for (const value of candidates) {
        try {
          const next = renderToStaticMarkup(
            <t.Renderer
              project={{
                ...prepared,
                style: { ...prepared.style, [c.key]: value },
              }}
            />,
          );
          if (next !== reference) {
            changed = true;
            break;
          }
        } catch (e) {
          error = (e as Error).message;
        }
      }
      records.push({
        id: t.id,
        key: c.key,
        label: c.label,
        changedFromExample: changed,
        error,
      });
    }
  }
  mkdirSync("../tests/artifacts", { recursive: true });
  writeFileSync(
    "../tests/artifacts/control-audit.json",
    JSON.stringify(
      {
        note: "未变化可能需要数据、布局或其他开关条件；必须补条件验收或移除不适用控件，不能据此直接声称失败或通过。",
        records,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      total: records.length,
      changed: records.filter((r) => r.changedFromExample).length,
      conditional: records.filter((r) => !r.changedFromExample).length,
    }),
  );
}, 30000);
