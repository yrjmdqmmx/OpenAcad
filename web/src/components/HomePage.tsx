import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Template } from "../core/types";
import { ResearchPlate } from "./ResearchPlate";
import { TuyanCarousel } from "./TuyanCarousel";
import "../styles/home.css";

export function HomePage({ templates }: { templates: Template[] }) {
  return (
    <>
      <main className="platform-home">
        <section className="platform-intro" aria-labelledby="platform-title">
          <div className="platform-intro-copy">
            <p className="platform-audience">面向科研与学术工作的综合平台</p>
            <h1 id="platform-title">专注研究，<br /><span>从容表达。</span></h1>
            <p className="platform-lead">
              从科研绘图出发，<br />逐步汇集更多学术工具与服务。
            </p>
            <div className="platform-actions">
              <a className="button primary" href="#catalog">进入科研绘图 <ArrowRight size={18} aria-hidden="true" /></a>
              <a className="platform-text-link" href="#projects">继续本机项目 <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </div>
          <ResearchPlate templates={templates} />
        </section>
        <section className="drawing-workflow" aria-labelledby="drawing-title">
          <div className="drawing-heading">
            <h2 id="drawing-title">让数据得到清晰表达。</h2>
            <p>科研绘图，从选择模板到保存与导出。</p>
          </div>
          <div className="drawing-steps">
            <article>
              <span className="drawing-step-number" aria-hidden="true">01</span>
              <h3>选择适合数据的图</h3>
              <p>{templates.length} 个可编辑模板，覆盖基础图表、专业图表、排序分析与树图。</p>
              <a className="platform-text-link" href="#catalog">浏览全部模板 <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
            <article>
              <span className="drawing-step-number" aria-hidden="true">02</span>
              <h3>分析与表达一起完成</h3>
              <p>编辑数据，调整图层与样式；按需运行真实统计分析。</p>
              <a className="platform-text-link" href="#help">查看绘图帮助 <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
            <article>
              <span className="drawing-step-number" aria-hidden="true">03</span>
              <h3>让每一步都能继续</h3>
              <p>保存可编辑项目，导出 SVG、PNG、PDF 或 EPS。</p>
              <a className="platform-text-link" href="#projects">打开本机项目 <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
          </div>
        </section>
        <section className="tuyan-feature" aria-labelledby="tuyan-title">
          <div className="tuyan-feature-copy">
            <div className="tuyan-brand">
              <img className="tuyan-logo" src="/images/tuyan-logo.svg" alt="图研 Tuyan Logo" width="64" height="64" loading="lazy" />
              <h2 id="tuyan-title">图研 Tuyan</h2>
            </div>
            <p className="tuyan-editorial-title">让方法与思路，<br />也有清晰的图示。</p>
            <p className="tuyan-description">将论文方法与图注转化为方法框架图、流程图和机制示意图，支持参考图辅助生成与文字指令精修。</p>
            <a className="platform-text-link" href="https://www.paperbanana.asia/" target="_blank" rel="noopener noreferrer" aria-describedby="tuyan-destination">访问图研 Tuyan <ArrowUpRight size={18} aria-hidden="true" /></a>
            <p id="tuyan-destination">www.paperbanana.asia · 在新窗口访问图研官网</p>
          </div>
          <TuyanCarousel />
        </section>
        <section className="platform-bio" aria-labelledby="bio-home-title">
          <div><h2 id="bio-home-title">生物信息学，实用工具。</h2><p>查看真实测序峰图，整理 KO 与 pathway 的对应关系。</p></div>
          <div className="platform-bio-links"><a className="platform-text-link" href="#bio/ab1">AB1 测序文件查看器 <ArrowRight size={16} /></a><a className="platform-text-link" href="#bio/ko">KO 转 pathway 信息表 <ArrowRight size={16} /></a></div>
        </section>
        <section className="platform-upcoming" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title">更多学术工具与服务，将逐步在这里相遇。</h2>
          <p>我们从科研绘图开始，持续拓展学术工作的更多可能。</p>
        </section>
      </main>
      <footer className="platform-footer"><span>OpenAcad 开放学术</span><p>面向科研，让工具回归实用。</p></footer>
    </>
  );
}
