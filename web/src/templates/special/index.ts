import { matrixTemplates } from "./matrix";
import { relationTemplates } from "./relations";
import { mapTemplates } from "./map";
import { differentialTemplates } from "./differential";
import { biologyTemplates } from "./biology";
import { genomicsTemplates } from "./genomics";
export const specialTemplates = [
  ...matrixTemplates,
  ...relationTemplates,
  ...mapTemplates,
  ...differentialTemplates,
  ...biologyTemplates,
  ...genomicsTemplates,
];

export { SpecialPanel, specialProjectIssues } from "./advanced";

for (const template of specialTemplates) {
  template.controls = template.controls.map((c) => {
    const visible =
      c.key === "showDendrogram"
        ? (p: import("../../core/types").Project) =>
            p.analysis?.method === "cluster" && !!p.analysis.result
        : c.key === "blankZero"
          ? (p: import("../../core/types").Project) =>
              p.dataset.tables.some(
                (t) =>
                  ["matrix", "correlation"].includes(t.role) &&
                  t.rows.some((r) => r.slice(1).some((v) => Number(v) === 0)),
              )
          : c.key === "homologyOpacity"
            ? (p: import("../../core/types").Project) =>
                Boolean(p.style.connectCategories)
            : c.key === "trackValueMax"
              ? (p: import("../../core/types").Project) =>
                  p.dataset.tables.some(
                    (t) =>
                      t.role === "tracks" &&
                      t.rows.some(
                        (r) => r[t.columns.indexOf("type")] === "value",
                      ),
                  )
              : c.key === "breakGap"
                ? (p: import("../../core/types").Project) =>
                    p.layers.some((l) => l.type === "gene-break" && l.visible)
                : c.key === "showZero"
                  ? (p: import("../../core/types").Project) => {
                      const t = p.dataset.tables[0];
                      if (!t) return false;
                      const members = new Map<string, number>();
                      t.columns.forEach((_, i) =>
                        t.rows.forEach((r) => {
                          if (r[i] !== null && String(r[i] ?? "").trim())
                            members.set(
                              String(r[i]),
                              (members.get(String(r[i])) ?? 0) | (1 << i),
                            );
                        }),
                      );
                      return (
                        new Set(members.values()).size <
                        (1 << t.columns.length) - 1
                      );
                    }
                  : undefined;
    return visible ? { ...c, visible } : c;
  });
}
