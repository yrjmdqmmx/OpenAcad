import { describe, expect, it } from "vitest";
import { groupCatalogTemplates } from "./catalog";
import { templates } from "../templates";

describe("模板库分类顺序", () => {
  it("按分类首次出现分组，保留组内次序且不修改传入的注册顺序", () => {
    const source = Object.freeze([
      { id: "b1", category: "比较" }, { id: "s1", category: "关联" },
      { id: "b2", category: "比较" }, { id: "t1", category: "树图" },
      { id: "s2", category: "关联" },
    ]);
    const result = groupCatalogTemplates(source);
    expect(result.categories).toEqual(["全部模板", "比较", "关联", "树图"]);
    expect(result.ordered.map(t => t.id)).toEqual(["b1", "b2", "s1", "s2", "t1"]);
    expect(source.map(t => t.id)).toEqual(["b1", "s1", "b2", "t1", "s2"]);
  });
  it("完整覆盖当前注册模板，每个分类只有一段，组内与原注册顺序一致", () => {
    const result = groupCatalogTemplates(templates);
    expect(new Set(result.ordered.map(t => t.id)).size).toBe(templates.length);
    expect(result.ordered).toHaveLength(templates.length);
    let offset = 0;
    for (const category of result.categories.slice(1)) {
      const original = templates.filter(t => t.category === category);
      expect(result.ordered.slice(offset, offset + original.length)).toEqual(original);
      offset += original.length;
    }
  });
  it("空列表仍保留全部模板入口", () => {
    expect(groupCatalogTemplates([])).toEqual({categories: ["全部模板"], ordered: []});
  });
});
