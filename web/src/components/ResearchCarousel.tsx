import { useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useScreenshotCarousel } from "./useScreenshotCarousel";
import "../styles/research-carousel.css";

const slides = [
  { id: "bar-grouped", name: "分组柱状图", label: "组间比较", shortLabel: "柱状图", description: "从数据表到图形，调整每一处表达。" },
  { id: "heatmap", name: "数值热图", label: "数值热图", shortLabel: "热图", description: "用色彩展示矩阵，保留每一个数值。" },
  { id: "volcano", name: "差异表达火山图", label: "差异表达", shortLabel: "火山图", description: "设定阈值与标注，清晰呈现差异分布。" },
  { id: "sankey", name: "桑基流向图", label: "流向关系", shortLabel: "桑基图", description: "让来源、去向与数量关系一目了然。" },
  { id: "tree-circle", name: "环形进化树", label: "树图注释", shortLabel: "进化树", description: "为树结构叠加柱状、热图与叶名注释。" },
];

export function ResearchCarousel() {
  const { active, setActive, move, rotating, root, rootHandlers, viewportHandlers } = useScreenshotCarousel(slides.length);
  const [failed, setFailed] = useState<string[]>([]);
  const current = slides[active];
  return (
    <section ref={root} className="research-carousel" role="region" aria-roledescription="轮播" aria-label="科研绘图工作台实景" {...rootHandlers}>
      <div className="research-carousel-heading"><span>科研绘图 · 工作台实景</span><span>模拟数据示例</span></div>
      <div className="research-carousel-viewport" {...viewportHandlers}>
        {slides.map((slide, index) => (
          <div key={slide.id} className={`research-slide${index === active ? " is-current" : ""}`} role="group" aria-roledescription="幻灯片" aria-label={`${index + 1} / ${slides.length}：${slide.name}`} aria-hidden={index !== active} inert={index !== active}>
            <a href={`/images/research/${slide.id}.jpg`} target="_blank" rel="noopener noreferrer" aria-label={`查看${slide.name}工作台截图大图（新窗口）`} draggable={false}>
              {failed.includes(slide.id) ? <span className="research-image-fallback">截图暂时无法加载，请从下方进入模板。</span> : <img src={`/images/research/${slide.id}.jpg`} alt={`OpenAcad ${slide.name}真实工作台截图，使用自带模拟数据`} width="1710" height="838" decoding="async" fetchPriority={index === 0 ? "high" : "low"} draggable={false} onError={() => setFailed((ids) => ids.includes(slide.id) ? ids : [...ids, slide.id])} />}
            </a>
          </div>
        ))}
      </div>
      <div className="research-carousel-caption" aria-live={rotating ? "off" : "polite"} aria-atomic="true">
        <div><strong>{current.name}</strong><p>{current.description}</p></div>
        <a href={`#template/${current.id}`}>试用此模板 <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <div className="research-carousel-controls">
        <button type="button" aria-label="上一张科研绘图截图" onClick={() => move(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <div className="research-carousel-tabs" aria-label="选择科研绘图截图">
          {slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`查看第 ${index + 1} 张：${slide.name}`} aria-current={index === active ? "true" : undefined} onClick={() => setActive(index)}><span className="research-tab-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="research-tab-label">{slide.label}</span><span className="research-tab-short">{slide.shortLabel}</span></button>)}
        </div>
        <button type="button" aria-label="下一张科研绘图截图" onClick={() => move(1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="research-carousel-footer"><span className="research-carousel-count">{active + 1} / {slides.length}</span><a href={`/images/research/${current.id}.jpg`} target="_blank" rel="noopener noreferrer">查看大图 <ArrowUpRight size={13} aria-hidden="true" /></a></div>
    </section>
  );
}
