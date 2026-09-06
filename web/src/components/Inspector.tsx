import {useState} from 'react';
import type {Project,Template,Control} from '../core/types';
import {defaults,palettes} from '../core/project';
const common:Control[]=[
  {key:'width',label:'宽度（像素）',type:'number',min:240,max:12000,section:'画布'}, {key:'height',label:'高度（像素）',type:'number',min:240,max:12000,section:'画布'},
  {key:'background',label:'背景颜色',type:'color',section:'画布'},{key:'transparent',label:'透明背景',type:'boolean',section:'画布'},
  ...['Top','Right','Bottom','Left'].map((x,i)=>({key:'margin'+x,label:['上边距','右边距','下边距','左边距'][i],type:'number' as const,min:0,max:1500,section:'画布'})),
  {key:'title',label:'标题',type:'text',section:'标题与文字'},{key:'subtitle',label:'副标题',type:'text',section:'标题与文字'},
  {key:'fontFamily',label:'字体',type:'select',options:[{value:'Noto Sans SC',label:'思源黑体'},{value:'Noto Serif CJK SC',label:'思源宋体'}],section:'标题与文字'},
  {key:'fontSize',label:'正文字号',type:'number',min:6,max:100,section:'标题与文字'},{key:'titleSize',label:'标题字号',type:'number',min:8,max:150,section:'标题与文字'},
  {key:'textColor',label:'文字颜色',type:'color',section:'标题与文字'},
  {key:'showLegend',label:'显示图例',type:'boolean',section:'配色与图形'},{key:'showLabels',label:'显示数值',type:'boolean',section:'配色与图形'},
  {key:'opacity',label:'透明度',type:'number',min:0.05,max:1,step:0.05,section:'配色与图形'},
];
export function Inspector({project,template,commit}:{project:Project;template:Template;commit:(p:Project)=>void}){
  const [unit,setUnit]=useState('px');
  const set=(key:string,value:unknown)=>commit({...project,style:{...project.style,[key]:value}});
  const controls=Array.from(new Map([...common,...template.controls].map(c=>[c.key,c])).values()).filter(c=>!c.visible||c.visible(project));
  const sections=Array.from(new Set(controls.map(c=>c.section||'图表设置')));
  return <div className="inspector"><label className="control-row"><span>画布尺寸单位</span><select value={unit} onChange={e=>setUnit(e.target.value)}><option value="px">像素</option><option value="mm">毫米</option></select></label>{sections.map(section=><details open key={section}><summary>{section}</summary>{controls.filter(c=>(c.section||'图表设置')===section).map(c=><label className={`control-row ${c.type==='text'?'text-control':''}`} key={c.key}><span>{unit==='mm'&&['width','height'].includes(c.key)?c.label.replace('像素','毫米'):c.label}{c.help&&<small>{c.help}</small>}</span>{c.type==='boolean'?<input type="checkbox" role="switch" checked={!!project.style[c.key]} onChange={e=>set(c.key,e.target.checked)}/>:c.type==='select'?<select value={String(project.style[c.key]??c.options?.[0]?.value??'')} onChange={e=>set(c.key,e.target.value)}>{c.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input aria-label={c.label} type={c.type} value={unit==='mm'&&['width','height'].includes(c.key)?Number((Number(project.style[c.key])*25.4/96).toFixed(2)):String(project.style[c.key]??'')} min={unit==='mm'&&['width','height'].includes(c.key)&&c.min!==undefined?c.min*25.4/96:c.min} max={unit==='mm'&&['width','height'].includes(c.key)&&c.max!==undefined?c.max*25.4/96:c.max} step={c.step??1} onChange={e=>{if(c.type==='number'){if(e.target.value===''){set(c.key,undefined);return;}const v=unit==='mm'&&['width','height'].includes(c.key)?+e.target.value*96/25.4:+e.target.value;if(Number.isFinite(v)&&v>=(c.min??-Infinity)&&v<=(c.max??Infinity))set(c.key,v);}else set(c.key,e.target.value);}}/>}</label>)}{section==='配色与图形'&&<><label className="control-row"><span>配色方案</span><select aria-label="配色方案" value="" onChange={e=>set('palette',palettes[e.target.value as keyof typeof palettes])}><option value="" disabled>选择配色</option>{Object.keys(palettes).map(p=><option key={p}>{p}</option>)}</select></label><div className="swatches">{project.style.palette.map((color,i)=><input key={i} type="color" aria-label={`系列 ${i+1} 颜色`} value={color} onChange={e=>set('palette',project.style.palette.map((v,j)=>j===i?e.target.value:v))}/>)}</div></>}</details>)}<button className="wide reset-style" onClick={()=>commit({...project,style:{...structuredClone(defaults),...structuredClone(template.defaultStyle)}})}>恢复模板默认样式</button><p className="hint">恢复样式会保留当前数据，可用撤销恢复。</p></div>;
}
