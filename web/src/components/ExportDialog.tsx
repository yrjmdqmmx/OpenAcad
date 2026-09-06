import {useState,useRef} from 'react';
import {X,Download} from 'lucide-react';
import type {Project} from '../core/types';
import {downloadBlob} from '../core/project';
import {createJob,waitJob,cancelJob} from '../core/api';
export function ExportDialog({project,getSVG,onClose}:{project:Project;getSVG:()=>SVGSVGElement|null;onClose:()=>void}){
  const [format,setFormat]=useState('svg'),[dpi,setDpi]=useState(300),[outline,setOutline]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const task=useRef<{id:string;token:string;abort:AbortController}|null>(null);
  const width=project.style.width,height=project.style.height;
  async function exportImage(){setBusy(true);setError('');try{await document.fonts.ready;const node=getSVG();if(!node)throw new Error('当前图表没有有效预览，请先修正数据。');const svg=node.cloneNode(true) as SVGSVGElement;svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
    const bounds=node.getBBox();if(bounds.x<-1||bounds.y<-1||bounds.x+bounds.width>width+1||bounds.y+bounds.height>height+1)throw new Error(`图形或文字超出画布。请增加边距或将画布至少调整到 ${Math.ceil(Math.max(width,bounds.x+bounds.width+20))} × ${Math.ceil(Math.max(height,bounds.y+bounds.height+20))} 像素后导出。`);
    const content=new XMLSerializer().serializeToString(svg);
    if(format==='svg'&&!outline){downloadBlob(new Blob([content],{type:'image/svg+xml'}),`${project.name}.svg`);setMessage('SVG 已下载。请在目标编辑软件中使用 Noto Sans CJK / Noto Sans SC 字体。');}
    else{setMessage('正在准备导出…');const job=await createJob({kind:'export',method:'render',data:{svg:content},params:{format,dpi,outline,filename:project.name,background:project.style.transparent?'transparent':project.style.background}});const abort=new AbortController();task.current={...job,abort};const result=await waitJob(job.id,job.token,abort.signal,s=>setMessage(s==='queued'?'导出排队中…':'正在生成文件…'));const artifact=result.artifact as {contentBase64:string;filename:string;mimeType:string};if(!artifact?.contentBase64)throw new Error('导出服务没有返回文件，请重试。');const bytes=Uint8Array.from(atob(artifact.contentBase64),c=>c.charCodeAt(0));downloadBlob(new Blob([bytes],{type:artifact.mimeType}),artifact.filename);setMessage('图片已下载。'+((result.diagnostics||[]) as {message:string}[]).map(d=>d.message).join(' '));}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);task.current=null;}}
  return <div className="modal-backdrop"><section className="export-dialog" role="dialog" aria-modal="true" aria-label="导出图片"><header><h2>导出图片</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label="关闭"><X/></button></header><p>图片用于投稿与分享；继续编辑请另存项目文件。</p><label>图片格式<select value={format} disabled={busy} onChange={e=>setFormat(e.target.value)}><option value="svg">SVG · 矢量图片</option><option value="png">PNG · 位图</option><option value="pdf">PDF · 矢量文档</option><option value="eps">EPS · 投稿格式</option></select></label>
    {format==='png'&&<label>分辨率<select value={dpi} onChange={e=>setDpi(+e.target.value)}>{[150,300,600].map(n=><option key={n} value={n}>{n} DPI</option>)}</select></label>}
    {format!=='png'&&<label className="check-row"><input type="checkbox" checked={outline} onChange={e=>setOutline(e.target.checked)}/>文字转为路径（避免接收方字体缺失）</label>}
    <div className="export-size"><strong>{format==='png'?`${Math.round(width*dpi/96)} × ${Math.round(height*dpi/96)} 像素`:`${width} × ${height} 像素`}</strong><span>物理尺寸 {(width/96*25.4).toFixed(1)} × {(height/96*25.4).toFixed(1)} mm</span></div>
    {format==='eps'&&<p className="notice">EPS 不支持透明背景与半透明对象；使用白色背景，透明效果将按服务说明处理。</p>}
    {(format!=='svg'||outline)&&<p className="hint">此格式使用香港服务器转换图片；临时文件最多保留一小时。</p>}
    {message&&<p role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
    <button className="primary wide" disabled={busy} onClick={exportImage}><Download size={16}/>{busy?'正在生成…':'下载图片'}</button>{busy&&<button className="wide" onClick={async()=>{if(task.current){await cancelJob(task.current.id,task.current.token);task.current.abort.abort();}}}>取消导出</button>}
  </section></div>;
}
