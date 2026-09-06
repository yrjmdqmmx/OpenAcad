import React from 'react';
import type { ChartStyle, Control, DataTable, Dataset, Issue, Project, RendererProps, Template } from '../../core/types';

export const colors = ['#237c83','#e59347','#6375bd','#b75673','#70a077','#9d78ad','#ccbd65','#4c94b3'];
export const simulated = {kind:'simulated' as const, label:'OpenAcad 自行生成的中文模拟数据；仅用于演示，不代表研究结果',license:'CC0-1.0'};
export const table = (id:string,name:string,role:string,columns:string[],rows:DataTable['rows']):DataTable => ({id,name,role,columns,rows});
export const dataset = (...tables:DataTable[]):Dataset => ({tables});
export const opt = (key:string,label:string,options:[string,string][],section='图形'):Control => ({key,label,type:'select',options:options.map(([value,label])=>({value,label})),section});
export const num = (key:string,label:string,min=0,max=100,step=1,section='图形'):Control => ({key,label,type:'number',min,max,step,section});
export const bool = (key:string,label:string,section='图形'):Control => ({key,label,type:'boolean',section});
export const col = (key:string,label:string,section='图形'):Control => ({key,label,type:'color',section});
export const value = (p:Project,key:string,fallback:number) => Number.isFinite(Number(p.style[key])) ? Number(p.style[key]) : fallback;
export const text = (p:Project,key:string,fallback:string) => typeof p.style[key]==='string' ? String(p.style[key]) : fallback;
export const enabled = (p:Project,key:string,fallback=true) => p.style[key]===undefined ? fallback : Boolean(p.style[key]);
export const palette = (p:Project) => Array.isArray(p.style.palette)&&p.style.palette.length ? p.style.palette : colors;
export const fmt = (x:number,digits=2) => Number.isFinite(x) ? Number(x.toFixed(digits)).toLocaleString('zh-CN',{maximumFractionDigits:digits}) : '—';
export const pick = (d:Dataset,role:string,index=0) => d.tables.find(t=>t.role===role) ?? d.tables[index];
export const error = (message:string,t?:DataTable,row?:number,column?:number):Issue => ({message,tableId:t?.id,row,column,severity:'error'});
export const rowIssue = (t:DataTable,r:number,c:number,message:string) => error(`“${t.name}”第 ${r+2} 行、“${t.columns[c]??`第 ${c+1} 列`}”：${message}`,t,r+2,c+1);
export function numericCell(t:DataTable,r:number,c:number,issues:Issue[],opts:{min?:number;max?:number;integer?:boolean}={}) {
 const x=t.rows[r]?.[c];
 if(x===null||x===undefined||String(x).trim()===''){issues.push(rowIssue(t,r,c,'不能为空，请填写数字'));return false;}
 const n=Number(x);
 if(!Number.isFinite(n)){issues.push(rowIssue(t,r,c,`“${x}”不是有限数字`));return false;}
 if(opts.min!==undefined&&n<opts.min)issues.push(rowIssue(t,r,c,`数值不能小于 ${opts.min}`));
 if(opts.max!==undefined&&n>opts.max)issues.push(rowIssue(t,r,c,`数值不能大于 ${opts.max}`));
 if(opts.integer&&!Number.isInteger(n))issues.push(rowIssue(t,r,c,'需要整数'));
 return true;
}
export function tableShape(t:DataTable|undefined,minColumns=2,minRows=1):Issue[]{
 if(!t)return[error('缺少数据表，请先载入示例或添加数据表')];
 const issues:Issue[]=[];
 if(t.columns.length<minColumns)issues.push(error(`“${t.name}”至少需要 ${minColumns} 列，当前只有 ${t.columns.length} 列`,t));
 if(t.rows.length<minRows)issues.push(error(`“${t.name}”至少需要 ${minRows} 行数据`,t));
 const seen=new Set<string>();
 t.columns.forEach((c,i)=>{if(!c.trim())issues.push(error(`“${t.name}”第 ${i+1} 列缺少列名`,t,1,i+1));else if(seen.has(c))issues.push(error(`“${t.name}”存在重复列名“${c}”`,t,1,i+1));seen.add(c);});
 t.rows.forEach((r,i)=>{if(r.length!==t.columns.length)issues.push(error(`“${t.name}”第 ${i+2} 行应有 ${t.columns.length} 个单元格，实际为 ${r.length} 个`,t,i+2));});
 return issues;
}
export function uniqueIds(t:DataTable,c=0):Issue[]{const issues:Issue[]=[];const ids=new Set<string>();t.rows.forEach((r,i)=>{const id=String(r[c]??'').trim();if(!id)issues.push(rowIssue(t,i,c,'标识不能为空'));else if(ids.has(id))issues.push(rowIssue(t,i,c,`标识“${id}”重复`));ids.add(id);});return issues;}
export function required(t:DataTable,fields:string[]):Issue[]{return fields.filter(k=>!t.columns.includes(k)).map(k=>error(`“${t.name}”缺少必填列“${k}”`,t));}
export function matrixIssues(d:Dataset,role='matrix',binary=false):Issue[]{
 const t=pick(d,role);const issues=tableShape(t);if(!t)return issues;
 issues.push(...uniqueIds(t));t.rows.forEach((r,i)=>t.columns.slice(1).forEach((_,j)=>{numericCell(t,i,j+1,issues);if(binary&&![0,1].includes(Number(r[j+1])))issues.push(rowIssue(t,i,j+1,'二值矩阵只能填写 0 或 1'));}));
 if(t.rows.length*t.columns.length>30000)issues.push(error('矩阵超过 30,000 个单元格，请先筛选特征再绘图',t));return issues;
}
export function dimensions(p:Project){const s=p.style;const w=Math.max(320,Number(s.width)||900),h=Math.max(280,Number(s.height)||650);const left=Math.max(24,Number(s.marginLeft)||90),right=Math.max(16,Number(s.marginRight)||44),top=Math.max(70,Number(s.marginTop)||88),bottom=Math.max(50,Number(s.marginBottom)||78);return{w,h,left,right,top,bottom,iw:Math.max(80,w-left-right),ih:Math.max(80,h-top-bottom)};}
export const baseStyle:Partial<ChartStyle>={width:960,height:680,marginTop:92,marginRight:52,marginBottom:86,marginLeft:130,background:'#ffffff',fontFamily:'Noto Sans SC, sans-serif',fontSize:13,titleSize:24,textColor:'#243947',palette:colors,opacity:1,showLegend:true,showLabels:true,showGrid:true};
export function Frame({project,children}:RendererProps&{children:React.ReactNode}){const {w,h}=dimensions(project);const s=project.style;return <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={w} height={h} viewBox={`0 0 ${w} ${h}`} data-chart={project.templateId} role="img" aria-label={s.title||'科研图表'} style={{fontFamily:s.fontFamily||'Noto Sans SC, sans-serif',fontSize:s.fontSize||13,color:s.textColor||'#243947'}}>
 {!s.transparent&&<rect width={w} height={h} fill={s.background||'#ffffff'}/>}
 <text x={w/2} y={35} textAnchor="middle" fontSize={s.titleSize||24} fill={s.textColor||'#243947'} fontWeight={650}>{s.title}</text>
 {s.subtitle&&<text x={w/2} y={58} textAnchor="middle" fontSize={Math.max(10,(s.fontSize||13)-1)} fill={s.textColor||'#243947'}>{s.subtitle}</text>}
 <g fill={s.textColor||'#243947'} opacity={s.opacity??1}>{children}</g>
 </svg>}
export function Invalid({project,issues}:RendererProps&{issues:Issue[]}){const {left,top}=dimensions(project);return <Frame project={project}><g transform={`translate(${left},${top})`}><text fill="#ba364a" fontWeight="bold">请修正数据后绘图</text>{issues.slice(0,8).map((i,k)=><text key={k} y={30+k*24} fontSize={12}>{i.message.slice(0,85)}</text>)}</g></Frame>}
export function categoryLegend(p:Project,names:string[],x:number,y:number){const pal=palette(p);return enabled(p,'showLegend')?<g transform={`translate(${x},${y})`}>{names.map((name,i)=><g key={name} transform={`translate(${(i%4)*165},${Math.floor(i/4)*21})`}><rect width={10} height={10} rx={2} y={-8} fill={pal[i%pal.length]}/><text x={16} fontSize={11}>{name}</text></g>)}</g>:null;}
export function createTemplate(id:string,name:string,category:string,description:string,example:Dataset,alternate:Dataset,Renderer:Template['Renderer'],extra:Partial<Template>={}):Template{return{id,familyId:id,variant:'基础',version:1,name,category,description,tags:[name,category],sourceUrls:[],status:'available',controls:[],example,alternate,inputHelp:'使用示例表的列名组织数据。第一行为列名，支持表格填写、粘贴，以及 CSV、TSV、Excel 上传。',tutorial:['载入示例，查看列名和数据角色。','在数据面板填写或上传自己的数据，先修正具体单元格错误。','调整右侧图形选项并查看预览。','下载项目以继续编辑；下载 SVG、PNG 或 PDF 用于分享。'],limitations:[],formats:['csv','tsv','xls','xlsx'],exampleSource:simulated,validate:d=>tableShape(d.tables[0]),Renderer,...extra,defaultStyle:{...baseStyle,title:name,...extra.defaultStyle}};}
