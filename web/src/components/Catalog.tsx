import { useMemo, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import type { Template, Project } from "../core/types";
import { makeProject } from "../core/project";
import { RenderedChart } from "./RenderedChart";
export function TemplatePreview({ template }: { template: Template }) {
  const p = useMemo(() => {
    const p = makeProject(template);
    return p;
  }, [template]);
  return <RenderedChart project={p} template={template} thumbnail />;
}
export function Catalog({
  templates,
  onStart,
}: {
  templates: Template[];
  onStart: (p: Project) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部模板");
  const categories = [
    "全部模板",
    ...Array.from(new Set(templates.map((t) => t.category))),
  ];
  const shown = templates.filter(
    (t) =>
      (category === "全部模板" || t.category === category) &&
      `${t.name} ${t.description} ${t.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <main className="catalog-page">
      <div className="catalog-intro">
        <h1>选择一种图，开始探索数据。</h1>
        <p>使用示例开始，替换数据，保存可继续编辑的项目。</p>
        <label className="search">
          <Search size={20} />
          <input
            aria-label="搜索图表"
            placeholder="搜索图表名称或用途"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button onClick={() => setQuery("")}>清除</button>}
        </label>
      </div>
      <div className="catalog-layout">
        <aside className="category-rail">
          {categories.map((c) => (
            <button
              className={c === category ? "active" : ""}
              key={c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </aside>
        <div className="template-grid">
          {shown.map((t) => (
            <article className="template-card" key={t.id}>
              <a
                className="template-preview"
                href={`#template/${t.id}`}
                aria-label={`查看${t.name}详情`}
              >
                <TemplatePreview template={t} />
              </a>
              <div className="template-caption">
                <a href={`#template/${t.id}`}>
                  <h2>{t.name}</h2>
                </a>
                <p>{t.description}</p>
                <button
                  className="text-button"
                  onClick={() => onStart(makeProject(t))}
                >
                  用示例开始 <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
          {!shown.length && (
            <p className="empty-note">
              没有找到匹配的模板。试试“分组”“相关”或“分布”。
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
