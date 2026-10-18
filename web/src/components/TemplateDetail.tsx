import { useMemo, useState } from "react";
import { ArrowRight, Download, Maximize2 } from "lucide-react";
import type { DataTable, Project, Template } from "../core/types";
import { downloadBlob, saveProject } from "../core/project";
import { RenderedChart } from "./RenderedChart";
import { templateGuide } from "../templates/detailGuides";
import { describeField, detailExampleDownload, makeDetailProject, sheetDescription, spreadsheetColumn } from "../templates/detailExamples";
import { csv } from "../core/data";
import "../styles/template-detail.css";

function ExampleSheet({ template, table, index, count }: { template: Template; table: DataTable; index: number; count: number }) {
  const title = `示例工作表 ${index + 1}：${table.name}`;
  return (
    <article className="example-sheet" aria-label={title} data-sheet-role={table.role}>
      <div className="example-sheet-heading">
        <h3>{count > 1 ? `工作表 ${index + 1} · ` : ""}{table.name}</h3>
        <span>{table.rows.length} 行 × {table.columns.length} 列</span>
      </div>
      <p>{sheetDescription(template, table)}</p>
      <div className="example-grid-scroll" role="region" aria-label={`${table.name}完整示例数据，可滚动`} tabIndex={0}>
        <table className="example-grid" aria-label={title}>
          <thead>
            <tr className="sheet-letters" aria-hidden="true"><th />{table.columns.map((_, i) => <th key={i}>{spreadsheetColumn(i)}</th>)}</tr>
            <tr><th className="sheet-row-number" aria-label="表头行">1</th>{table.columns.map((column, i) => <th scope="col" key={i}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row" className="sheet-row-number">{rowIndex + 2}</th>
                {table.columns.map((_, columnIndex) => <td key={columnIndex} className={typeof row[columnIndex] === "number" ? "numeric-cell" : undefined}>{String(row[columnIndex] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sheet-footnote">表内可横向、纵向滚动查看完整数据；进入编辑器后可修改。{count > 1 && `导入后，将这张表的“数据角色”设为“${table.name}”（${table.role}）。`}</p>
      <dl className="example-fields" aria-label={`${table.name}字段说明`}>
        {table.columns.map((column, i) => {
          const info = describeField(template, table, column);
          return <div className="example-field" key={i}>
            <dt><span className="field-column-letter">{spreadsheetColumn(i)}</span><strong>{column}</strong><span className={info.requirement === "必填" ? "field-required" : "field-optional"}>{info.requirement}</span></dt>
            <dd><p>{info.meaning}</p><span>{info.format}</span></dd>
          </div>;
        })}
      </dl>
    </article>
  );
}

export function TemplateDetail({ template, onStart }: { template: Template; onStart: (project: Project) => void }) {
  const project = useMemo(() => makeDetailProject(template), [template]);
  const [zoomedTemplate, setZoomedTemplate] = useState<string | null>(null);
  const zoomed = zoomedTemplate === template.id;
  const guide = templateGuide(template);
  const tables = project.dataset.tables.filter(t=>!t.role.startsWith('raw-'));
  const hasCalculationInputs = project.dataset.tables.some(t=>t.role.startsWith('raw-'));
  const tree = template.id.startsWith("tree-");
  const magnetic = template.id === "magnetic-correlation";
  const download = () => {
    const file = detailExampleDownload(template, project);
    downloadBlob(file.blob, file.name);
  };
  return (
    <main className="detail-page template-detail">
      <a className="breadcrumb" href="#catalog">模板库</a>
      <section className="chart-introduction" aria-labelledby="chart-introduction-heading">
        <h2 id="chart-introduction-heading" className="detail-section-title">图表介绍</h2>
        <h1>{template.name}</h1>
        <p className="detail-description">{template.description}</p>
        <figure className="detail-example-figure">
          <div className={`detail-figure-scroll${zoomed ? " is-zoomed" : ""}`} role="region" aria-label="完整示例图，放大后可横向滚动" tabIndex={0}>
            <RenderedChart project={project} template={template} />
          </div>
          <figcaption><span>模拟数据示例 · 与下方示例数据一致{project.analysis?.result ? "；展示该矩阵已有的计算结果" : ""}</span><button aria-pressed={zoomed} onClick={() => setZoomedTemplate(zoomed ? null : template.id)}><Maximize2 size={14} aria-hidden="true" />{zoomed ? "适应宽度" : "放大查看"}</button></figcaption>
        </figure>
        <dl className="chart-reading">
          <div><dt>坐标与图形</dt><dd>{guide.axes}</dd></div>
          <div><dt>颜色与图例</dt><dd>{guide.color}</dd></div>
        </dl>
      </section>
      <section className="chart-usage" aria-labelledby="chart-usage-heading">
        <h2 id="chart-usage-heading" className="detail-section-title">如何使用</h2>
        <h3>按示例准备数据</h3>
        <p className="detail-preparation">{guide.prepare}</p>
        <div className="detail-example-actions">
          {magnetic ? <>
            {project.dataset.tables.map(table => <button key={table.id} onClick={() => downloadBlob(new Blob([csv(table)], { type: "text/csv;charset=utf-8" }), `${table.role}.csv`)}><Download size={16} aria-hidden="true" />下载{table.role === "magnetic-curve" ? "磁异常曲线" : "海底和基底"} CSV</button>)}
            <button onClick={() => downloadBlob(new Blob([project.dataset.files?.find(f => f.role === "magnetic-track")?.text || ""], { type: "application/json" }), "magnetic-track.json")}><Download size={16} aria-hidden="true" />下载测线位置 JSON</button>
            <button onClick={() => saveProject(project)}>下载可编辑示例项目</button>
          </> : <button onClick={download}><Download size={16} aria-hidden="true" />下载示例数据</button>}
          {!!project.layers.length && <button onClick={() => saveProject(project)}>下载含注释的示例项目</button>}
          {hasCalculationInputs && <button onClick={() => saveProject(project)}>下载含计算依据的示例项目</button>}
          <button className="primary" onClick={() => onStart(structuredClone(project))}>用示例开始 <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <p className="detail-download-note">{magnetic ? "分别下载两份 CSV 和一份 JSON，进入编辑器后上传这三份文件即可运行。示例项目同时保留输入、参数和已经计算的成像结果。" : tables.length ? `下载 Excel 文件，包含以下${tables.length > 1 ? ` ${tables.length} 张` : ""}工作表和全部数据行。` : "Newick 下载包含树结构；选择“下载含注释的示例项目”可同时保留图中的全部注释与样式。"}</p>
        {magnetic && <article className="example-source-text"><h3>测线位置 JSON</h3><pre tabIndex={0}><code>{project.dataset.files?.find(f => f.role === "magnetic-track")?.text}</code></pre></article>}
        {hasCalculationInputs && <p className="detail-download-note">示例项目额外保留生成结果的模拟原始观测或集合成员。当前模板读取结果表绘图；替换数据时请提供自己的检验结果，并同步修改方法说明。</p>}
        {tables.map((table, index) => <ExampleSheet key={table.id} template={template} table={table} index={index} count={tables.length} />)}
        {project.dataset.text && <article className="example-source-text">
          <h3>{tree ? "Newick 树文本" : "原格式示例"}</h3>
          <pre tabIndex={0} aria-label="完整示例树文本"><code>{project.dataset.text}</code></pre>
          <dl className="example-fields">
            <div className="example-field"><dt><strong>名称</strong><span className="field-required">叶名称必填</span></dt><dd><p>例如“拟南芥”“水稻”对应叶端标签；“十字花科”等括号后的名称为内部节点。注释表用这些名称作为 nodeID。</p></dd></div>
            <div className="example-field"><dt><strong>:枝长</strong><span className="field-optional">可选数值</span></dt><dd><p>例如“拟南芥:0.22”表示该分支长度为 0.22；上图按枝长排布。没有枝长时可关闭“按真实分支长度布局”。</p></dd></div>
            <div className="example-field"><dt><strong>( ) , ;</strong><span className="field-required">结构必需</span></dt><dd><p>括号包含同一分支下的子节点，逗号分隔同级节点，整棵树以分号结束。保持括号成对，不用 Excel 单元格代替嵌套树结构。</p></dd></div>
          </dl>
        </article>}
        {guide.special && <div className="detail-special-input"><h3>{tree ? "其他树格式与注释" : "其他输入方式"}</h3><p>{guide.special}</p></div>}
        <div className="detail-workflow">
          <h3>从示例到自己的图</h3>
          <ol>
            <li><strong>导入自己的数据</strong><p>{magnetic ? "点击“用示例开始”，在三个独立上传入口依次选择磁异常曲线 CSV、海底和基底 CSV、测线位置 JSON。首次上传会清空示例输入；补齐三份文件后确认计算参数。也可展开每份文件直接编辑内容并应用。" : tree
              ? "点击“用示例开始”，在树工作台粘贴树文本或上传树文件，确认叶名、拓扑和枝长。需要注释时，在所选图层中导入以 nodeID 对应节点的表格。"
              : `点击“用示例开始”，在“数据”面板上传 CSV、TSV 或 Excel；第一行为列名，数值格不混入单位。${tables.length > 1 ? "多表建议使用一个 Excel 文件分别保存，勾选所需工作表后点击“导入所选内容”，逐表设置上述数据角色。" : "也可粘贴带列名的表格，点击“应用数据”；列名不同时用字段映射对应。"}按行列提示修正无效数据后查看画布。`}</p></li>
            {guide.analysis && <li><strong>计算并检查结果</strong><p>{guide.analysis}</p></li>}
            <li><strong>调整图形与样式</strong><p>{guide.style} 然后设置画布尺寸、标题、字体和配色，使用撤销、重做比较效果。</p></li>
            <li><strong>保存可继续编辑的项目</strong><p>点击“保存项目”，下载 .openacad.json 文件，保留数据、样式、图层、布局和已有分析结果。下次用“打开项目”恢复；图片文件不能代替项目文件。</p></li>
            <li><strong>导出图片</strong><p>{magnetic ? "计算完成后点击“导出图片”，选择 PNG、PDF 或 SVG。SVG 保留可编辑文字、曲线和热图色块；PNG/PDF 由导出服务生成。" : "点击“导出图片”，选择 SVG、PNG、PDF 或 EPS，确认尺寸、文字和背景。SVG 可保留文字或转曲；PNG、PDF、EPS 使用导出服务。"}导出后打开文件检查标签与边界。</p></li>
          </ol>
        </div>
        {!!template.limitations.length && <div className="detail-limitations"><h3>绘图时留意</h3><ul>{template.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        <a className="detail-help-link" href={`#help/${template.id}`}>查看完整中文帮助 <ArrowRight size={15} aria-hidden="true" /></a>
      </section>
    </main>
  );
}
