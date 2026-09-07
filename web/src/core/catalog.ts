/** First category appearance defines navigation order; insertion order preserves
 * the existing order within each category without mutating the registry. */
export function groupCatalogTemplates<T extends { category: string }>(templates: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const template of templates) {
    const group = groups.get(template.category);
    if (group) group.push(template);
    else groups.set(template.category, [template]);
  }
  return {
    categories: ["全部模板", ...groups.keys()],
    ordered: [...groups.values()].flat(),
  };
}
