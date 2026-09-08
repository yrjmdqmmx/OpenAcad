import { useState } from "react";
import { useScreenshotCarousel } from "./useScreenshotCarousel";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import "../styles/tuyan-carousel.css";

const site = "https://www.paperbanana.asia/";
const caseSource = (id: string) => `${site}leaderboard/cases/${id}`;
const slides = [
  { id: "biological", title: "生物机制与信号通路", image: "/images/tuyan-slide-biological.png", source: caseSource("scientific-gen-02-biological-pathway"), note: "官网生成结果截图 · Qwen Image 3.0 Pro", alt: "图研官网真实生成结果截图：细胞膜至细胞核信号传导机制图" },
  { id: "method", title: "科研方法流程", image: "/images/tuyan-slide-method.png", source: caseSource("scientific-gen-01-method-flow"), note: "官网生成结果截图 · Qwen Image 3.0 Pro", alt: "图研官网真实生成结果截图：样本处理、数据集划分与模型评估流程" },
  { id: "architecture", title: "模型架构与信息流", image: "/images/tuyan-slide-architecture.png", source: caseSource("scientific-gen-03-model-architecture"), note: "官网生成结果截图 · Qwen Image 3.0 Pro", alt: "图研官网真实生成结果截图：多模态模型架构与信息流" },
  { id: "leaderboard", title: "图研模型排行榜", image: "/images/tuyan-slide-leaderboard.png", source: `${site}leaderboard`, note: "官网综合榜单局部 · 2026 年 9 月 7 日", alt: "图研官网排行榜实际截图，展示模型排名和科研图示评测指标" },
  { id: "workspace", title: "在工作台选择参考模板", image: "/images/tuyan-slide-workspace.png", source: site, note: "官网工作台截图 · 图中模板为论文参考图库", alt: "图研官网工作台精选模板库实际截图，展示六类论文参考图与套用入口；参考图不是生成结果" },
];

export function TuyanCarousel() {
  const { active, setActive, move, rotating, visible, root, rootHandlers, viewportHandlers } = useScreenshotCarousel(slides.length);
  const [failed, setFailed] = useState<string[]>([]);
  const current = slides[active];

  return (
    <section
      ref={root}
      className="tuyan-carousel"
      role="region"
      aria-roledescription="轮播"
      aria-label="图研官网实景"
      {...rootHandlers}
    >
      <div className="tuyan-carousel-heading">
        <span>图研 · 官网实景</span>
      </div>
      <div
        className="tuyan-carousel-viewport"
        {...viewportHandlers}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className={`tuyan-slide${active === index ? " is-current" : ""}`} role="group" aria-roledescription="幻灯片" aria-label={`${index + 1} / ${slides.length}：${slide.title}`} aria-hidden={index !== active} inert={index !== active}>
            <a href={slide.image} target="_blank" rel="noopener noreferrer" aria-label={`查看${slide.title}截图大图（新窗口）`} draggable={false}>
              {failed.includes(slide.id) ? <span className="tuyan-image-fallback">截图暂时无法加载<br />请使用下方图片来源链接 <ArrowUpRight size={16} aria-hidden="true" /></span> : <img src={slide.image} alt={slide.alt} loading={visible ? "eager" : "lazy"} decoding="async" draggable={false} onError={() => setFailed((ids) => ids.includes(slide.id) ? ids : [...ids, slide.id])} />}
            </a>
          </div>
        ))}
      </div>
      <div className="tuyan-carousel-caption" aria-live={rotating ? "off" : "polite"} aria-atomic="true">
        <strong>{current.title}</strong>
        <div><span>{current.note}</span><a href={current.image} target="_blank" rel="noopener noreferrer">查看大图 <ArrowUpRight size={12} aria-hidden="true" /></a><a href={current.source} target="_blank" rel="noopener noreferrer">图片来源 <ArrowUpRight size={12} aria-hidden="true" /></a></div>
      </div>
      <div className="tuyan-carousel-controls">
        <button type="button" aria-label="上一张图研截图" onClick={() => move(-1)}><ChevronLeft size={19} aria-hidden="true" /></button>
        <div className="tuyan-carousel-dots" aria-label="选择图研截图">
          {slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`查看第 ${index + 1} 张：${slide.title}`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)}><span /></button>)}
        </div>
        <span className="tuyan-carousel-count" aria-hidden="true">{active + 1} / {slides.length}</span>
        <button type="button" aria-label="下一张图研截图" onClick={() => move(1)}><ChevronRight size={19} aria-hidden="true" /></button>
      </div>
    </section>
  );
}
