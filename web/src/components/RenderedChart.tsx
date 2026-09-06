import {useRef} from 'react';
import type {Project,Template} from '../core/types';
import {ChartBoundary} from './ChartBoundary';
export function RenderedChart({project,template,thumbnail=false,onChange}:{project:Project;template:Template;thumbnail?:boolean;onChange?:(p:Project)=>void}){
  const svg=useRef<SVGSVGElement>(null);const dragging=useRef<string|null>(null);
  function move(e:React.PointerEvent<SVGSVGElement>){if(!dragging.current||!svg.current||!onChange)return;const p=svg.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const coord=p.matrixTransform(svg.current.getScreenCTM()?.inverse());onChange({...project,layers:project.layers.map(l=>l.id===dragging.current?{...l,settings:{...l.settings,x:Math.max(10,Math.min(project.style.width-10,coord.x)),y:Math.max(20,Math.min(project.style.height-10,coord.y))}}:l)});}
  return <ChartBoundary resetKey={JSON.stringify([project.dataset,project.style,project.analysis,project.layers])}><svg ref={svg} data-chart="true" className="chart-svg" xmlns="http://www.w3.org/2000/svg" width={project.style.width} height={project.style.height} viewBox={`0 0 ${project.style.width} ${project.style.height}`} role="img" aria-label={project.style.title||template.name} onPointerMove={move} onPointerUp={()=>dragging.current=null} onPointerCancel={()=>dragging.current=null}>
    <template.Renderer project={project} thumbnail={thumbnail} onLayoutChange={layout=>onChange?.({...project,layout})}/>
    {project.layers.filter(l=>l.type==='text'&&l.visible).map(l=><text key={l.id} x={Number(l.settings.x??120)} y={Number(l.settings.y??100)} fontFamily={project.style.fontFamily} fontSize={Number(l.settings.fontSize??18)} fill={String(l.settings.color??project.style.textColor)} style={{cursor:thumbnail?'default':'move',touchAction:'none'}} onPointerDown={e=>{if(!thumbnail){dragging.current=l.id;svg.current?.setPointerCapture(e.pointerId);}}}>{String(l.settings.text||l.name)}</text>)}
  </svg></ChartBoundary>;
}
