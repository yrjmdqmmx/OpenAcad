import { ArrowRight, Dna, Network } from "lucide-react";
import { Ab1Viewer } from "./Ab1Viewer";
import { KoConverter } from "./KoConverter";
import "./bio.css";

export default function BioTools({ tool }: { tool?: string }) {
  return <main className="bio-page">
    <div hidden={tool === "ab1" || tool === "ko"}>
      <header className="bio-tool-heading"><div><h1>生物信息学工具</h1><p>查看测序信号，整理通路对应关系，让数据处理有据可查。</p></div></header>
      <div className="bio-tool-list">
        <article><Dna size={34} aria-hidden="true" /><div><h2>AB1 测序文件查看器</h2><p>本地解析真实 AB1 文件，联动查看序列、四色峰图与质量值。定位与缩放后导出峰图，或保存 FASTA。</p><span>本地解析 · 真实样例 · SVG / PNG / FASTA</span></div><a className="button primary" href="#bio/ab1">打开查看器 <ArrowRight size={17} /></a></article>
        <article><Network size={34} aria-hidden="true" /><div><h2>KO 转 pathway 信息表</h2><p>粘贴列表或导入表格，选择 KO 列，保留原始字段与逐项状态。一对多展开，失败可重试。</p><span>KEGG 来源 · 批量转换 · CSV / Excel</span></div><a className="button primary" href="#bio/ko">打开转换器 <ArrowRight size={17} /></a></article>
      </div>
      <p className="bio-caption">AB1 与表格文件在本机读取；KO 在线转换只发送有效 KO 编号。KO 与 pathway 的对应关系转换不属于富集分析。工具数据在当前页面会话内保留，刷新前请导出所需结果。</p>
    </div>
    <div hidden={tool !== "ab1"}><Ab1Viewer /></div>
    <div hidden={tool !== "ko"}><KoConverter /></div>
  </main>;
}
