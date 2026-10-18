import React, {useId} from 'react';
import {ticks} from 'd3';
import type {RendererProps} from '../../core/types';
import {Frame, Invalid, dimensions, enabled, text, value} from '../special/shared';
import {magneticInput, magneticResult, mohoAt, parseFaults, MAGNETIC_PARAMS} from './model';

const segment = (stops: number[][], t: number) => {
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, av] = stops[i - 1], [b, bv] = stops[i]; return av + (bv - av) * (t - a) / (b - a);
  }
  return stops[stops.length - 1][1];
};
/** Matplotlib's segmented jet palette, retained to match the supplied program. */
export function jetColor(t: number) {
  t = Math.max(0, Math.min(1, t));
  const r = segment([[0,0],[.35,0],[.66,1],[.89,1],[1,.5]], t);
  const g = segment([[0,0],[.125,0],[.375,1],[.64,1],[.91,0],[1,0]], t);
  const b = segment([[0,.5],[.11,1],[.34,1],[.65,0],[1,0]], t);
  return `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`;
}
const path = (points: [number, number][]) => points.map(([x,y],i) => `${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
const numberLabel = (n: number) => Number(n.toFixed(3)).toString();

export function MagneticRenderer({project}: RendererProps) {
  const uid = useId().replace(/[^\w-]/g, '');
  let input;
  try { input = magneticInput(project.dataset, project.analysis?.params); }
  catch (error) { return <Invalid project={project} issues={[{message:error instanceof Error?error.message:String(error)}]}/>; }
  const s = project.style, d = dimensions(project);
  const result = magneticResult(project.analysis?.method === 'magnetic-correlation' ? project.analysis.result : undefined);
  const calculation = {...MAGNETIC_PARAMS, ...project.analysis?.params, ...result?.params};
  const axisLen = Math.max(1, Number(calculation.axis_len) || 390);
  const depthMax = Math.max(1, value(project,'magnetic_zmax',26));
  const yMin = value(project,'yMin',-300), yMax = Math.max(yMin + 1,value(project,'yMax',200));
  const ratio = Math.max(.5,value(project,'magnetic_panel_ratio',2.2));
  const gap = value(project,'magnetic_panel_gap',38);
  const plotWidth = Math.max(80,d.iw-80), upperHeight = Math.max(60,(d.ih-gap)/(1+ratio));
  const lowerTop = d.top+upperHeight+gap, lowerHeight = Math.max(100,d.ih-upperHeight-gap);
  const reversed = enabled(project,'magnetic_reverse',false);
  const X = (x:number) => d.left + (reversed?1-x/axisLen:x/axisLen)*plotWidth;
  const Y = (y:number) => d.top + (yMax-y)/(yMax-yMin)*upperHeight;
  const Z = (z:number) => lowerTop + z/depthMax*lowerHeight;
  const colorMin = value(project,'magnetic_vmin',-.4), colorMax = Math.max(colorMin+.001,value(project,'magnetic_vmax',.6));
  const lineWidth = value(project,'lineWidth',1.8);
  const curveColor = text(project,'magnetic_curve_color','#111111'), bathyColor = text(project,'magnetic_bathy_color','#1565c0');
  const baseColor = text(project,'magnetic_basement_color','#111111'), mohoColor = text(project,'magnetic_moho_color','#111111');
  const faultColor = text(project,'magnetic_fault_color','#333333');
  const axisColor = text(project,'axisColor','#111111'), gridColor = text(project,'gridColor','#777777');
  const font = s.fontSize||17;
  const mohoNW = value(project,'magnetic_moho_nw',26), mohoSE = value(project,'magnetic_moho_se',12);
  const mohoMid = value(project,'magnetic_moho_mid',220), mohoWidth = value(project,'magnetic_moho_width',40);
  const moho = (x:number) => mohoAt(x,mohoNW,mohoSE,mohoMid,mohoWidth);
  const profile = input.profile.map(row => {
    return {x:row.s_km,bathy:-row.bathy_m/1000,base:row.basement_km};
  });
  const faultsText = text(project,'magnetic_faults','F1:50; F2:110; F3:210; F4:300');
  const faults = parseFaults(faultsText);
  const faultInvalid = faults.length !== faultsText.split(/[;,，；\n]+/).filter(part=>part.trim()).length;
  const xTicks = ticks(0,axisLen,value(project,'magnetic_x_ticks',8));
  const magTicks = ticks(yMin,yMax,value(project,'magnetic_y_ticks',5));
  const zTicks = ticks(0,depthMax,value(project,'magnetic_depth_ticks',6));
  const cbX = d.left+plotWidth+20, cbWidth = 23;
  const stations = Math.min(100,Math.max(0,Math.floor(value(project,'magnetic_n_sta',15))));
  const stationSize = value(project,'magnetic_station_size',7);
  const showBathy=enabled(project,'magnetic_show_bathy'), showBase=enabled(project,'magnetic_show_basement'), showMoho=enabled(project,'magnetic_show_moho');
  const legend = [
    ...(showBathy ? [{name:text(project,'magnetic_bathy_label','海底'),color:bathyColor,dash:undefined}] : []),
    ...(showBase ? [{name:text(project,'magnetic_basement_label','磁性基底'),color:baseColor,dash:undefined}] : []),
    ...(showMoho ? [{name:text(project,'magnetic_moho_label','莫霍面（参数化）'),color:mohoColor,dash:'7 4'}] : []),
  ];
  return <Frame project={project}>
    <defs>
      <clipPath id={`${uid}-upper`}><rect x={d.left} y={d.top} width={plotWidth} height={upperHeight}/></clipPath>
      <clipPath id={`${uid}-lower`}><rect x={d.left} y={lowerTop} width={plotWidth} height={lowerHeight}/></clipPath>
      <linearGradient id={`${uid}-jet`} x1="0" y1="0" x2="0" y2="1">
        {Array.from({length:129},(_,i)=><stop key={i} offset={`${i/128*100}%`} stopColor={jetColor(1-i/128)}/>)}
      </linearGradient>
    </defs>
    {enabled(project,'showGrid') && <g stroke={gridColor} strokeWidth={.7} opacity={value(project,'gridOpacity',.14)}>
      {xTicks.map(x=><line key={`x${x}`} x1={X(x)} x2={X(x)} y1={d.top} y2={d.top+upperHeight}/>)}
      {magTicks.map(y=><line key={`y${y}`} x1={d.left} x2={d.left+plotWidth} y1={Y(y)} y2={Y(y)}/>)}
    </g>}
    <g clipPath={`url(#${uid}-upper)`}>
      {yMin<=0&&yMax>=0&&<line x1={d.left} x2={d.left+plotWidth} y1={Y(0)} y2={Y(0)} stroke={axisColor} strokeWidth={.75} opacity={.45}/>}
      <path data-magnetic="curve" d={path(input.curve.map(row=>[X(row.dist_km),Y(row.mag_nT)]))} fill="none" stroke={curveColor} strokeWidth={lineWidth}/>
    </g>
    {enabled(project,'showLabels')&&<text x={d.left+13} y={d.top+font*1.9} fontWeight={700} fontSize={font*1.2}>{text(project,'magnetic_line_label',input.track.name)||input.track.name}</text>}
    {enabled(project,'magnetic_show_stations')&&Array.from({length:stations},(_,i)=>{
      const x=X(stations>1?axisLen*i/(stations-1):axisLen/2), y=d.top+stationSize*.5;
      return <path data-magnetic="station" key={i} d={`M${x},${y-stationSize} L${x-stationSize*.9},${y+stationSize*.7} L${x+stationSize*.9},${y+stationSize*.7} Z`} fill={curveColor}/>;
    })}
    <g clipPath={`url(#${uid}-lower)`}>
      {result ? <g data-magnetic="correlation" shapeRendering="crispEdges">
        {result.zs.flatMap((z,iz)=>result.xs.map((x,ix)=>{
          const v=result.correlation[iz][ix];
          if(v===null)return null;
          const dx=Number(calculation.scan_dx)||5, dz=Number(calculation.scan_dz)||1;
          const x0=ix? (result.xs[ix-1]+x)/2:x-dx/2, x1=ix<result.xs.length-1?(x+result.xs[ix+1])/2:x+dx/2;
          const z0=iz?(result.zs[iz-1]+z)/2:z-dz/2, z1=iz<result.zs.length-1?(z+result.zs[iz+1])/2:z+dz/2;
          return <rect data-magnetic-cell={`${ix},${iz}`} key={`${ix},${iz}`} x={Math.min(X(x0),X(x1))} y={Z(z0)} width={Math.abs(X(x1)-X(x0))} height={Z(z1)-Z(z0)} fill={jetColor((v-colorMin)/(colorMax-colorMin))}><title>{`距离 ${numberLabel(x)} km · 深度 ${numberLabel(z)} km · r=${v.toFixed(4)}`}</title></rect>;
        }))}
      </g> : <g data-magnetic="pending"><rect x={d.left} y={lowerTop} width={plotWidth} height={lowerHeight} fill="#f5f7f9"/><text x={d.left+plotWidth/2} y={lowerTop+lowerHeight/2} textAnchor="middle" fill="#586774" fontSize={font}>上传三份文件后运行相关成像，生成真实计算结果</text></g>}
      {enabled(project,'magnetic_show_faults')&&faults.map(f=><line data-magnetic="fault" key={f.name+f.x} x1={X(f.x)} x2={X(f.x)} y1={lowerTop} y2={lowerTop+lowerHeight} stroke={faultColor} strokeWidth={value(project,'magnetic_fault_width',1)} strokeDasharray="5 4" opacity={.65}/>)}
      {showBathy&&<path data-magnetic="bathy" d={path(profile.map(p=>[X(p.x),Z(p.bathy)]))} fill="none" stroke={bathyColor} strokeWidth={value(project,'magnetic_bathy_width',2.1)}/>}
      {showBase&&<path data-magnetic="basement" d={path(profile.map(p=>[X(p.x),Z(p.base)]))} fill="none" stroke={baseColor} strokeWidth={value(project,'magnetic_basement_width',2.3)}/>}
      {showMoho&&<path data-magnetic="moho" d={path(Array.from({length:401},(_,i)=>[X(axisLen*i/400),Z(moho(axisLen*i/400))]))} fill="none" stroke={mohoColor} strokeWidth={value(project,'magnetic_moho_width_px',1.8)} strokeDasharray="7 4"/>}
    </g>
    {enabled(project,'showLabels')&&<g fontSize={font}>
      <text x={d.left+13} y={lowerTop+font*1.9}>{reversed?text(project,'magnetic_end_label','SE'):text(project,'magnetic_start_label','NW')}</text>
      <text x={d.left+plotWidth-13} y={lowerTop+font*1.9} textAnchor="end">{reversed?text(project,'magnetic_start_label','NW'):text(project,'magnetic_end_label','SE')}</text>
      {enabled(project,'magnetic_show_faults')&&faults.filter(f=>f.x>=0&&f.x<=axisLen).map(f=><text key={f.name+f.x} x={X(f.x)} y={lowerTop+font*.95} textAnchor="middle" fontWeight={700} stroke={s.background||'#ffffff'} strokeWidth={6} paintOrder="stroke">{f.name}</text>)}
    </g>}
    <g stroke={axisColor} strokeWidth={1.25} fill="none">
      <rect x={d.left} y={d.top} width={plotWidth} height={upperHeight}/><rect x={d.left} y={lowerTop} width={plotWidth} height={lowerHeight}/>
      {xTicks.map(x=><g key={x}><line x1={X(x)} x2={X(x)} y1={d.top+upperHeight} y2={d.top+upperHeight+5}/><line x1={X(x)} x2={X(x)} y1={lowerTop+lowerHeight} y2={lowerTop+lowerHeight+6}/></g>)}
      {magTicks.map(y=><line key={y} x1={d.left-6} x2={d.left} y1={Y(y)} y2={Y(y)}/>)}
      {zTicks.map(z=><line key={z} x1={d.left-6} x2={d.left} y1={Z(z)} y2={Z(z)}/>)}
    </g>
    <g fontSize={font}>
      {xTicks.map(x=><text key={x} x={X(x)} y={lowerTop+lowerHeight+font+12} textAnchor="middle">{numberLabel(x)}</text>)}
      {magTicks.map(y=><text key={y} x={d.left-10} y={Y(y)+font*.32} textAnchor="end">{numberLabel(y)}</text>)}
      {zTicks.map(z=><text key={z} x={d.left-10} y={Z(z)+font*.32} textAnchor="end">{numberLabel(z)}</text>)}
      <text x={d.left+plotWidth/2} y={lowerTop+lowerHeight+font*2.8+12} textAnchor="middle">{s.xTitle||'距离/km'}</text>
      <text transform={`translate(${d.left-61},${d.top+upperHeight/2}) rotate(-90)`} textAnchor="middle">{s.yTitle||'ΔT/nT'}</text>
      <text transform={`translate(${d.left-61},${lowerTop+lowerHeight/2}) rotate(-90)`} textAnchor="middle">{text(project,'magnetic_depth_label','深度/km')}</text>
    </g>
    {result&&enabled(project,'magnetic_show_colorbar')&&<g data-magnetic="colorbar">
      <rect x={cbX} y={lowerTop} width={cbWidth} height={lowerHeight} fill={`url(#${uid}-jet)`}/>
      <rect x={cbX} y={lowerTop} width={cbWidth} height={lowerHeight} fill="none" stroke={axisColor} strokeWidth={1.1}/>
      {ticks(colorMin,colorMax,5).map(v=>{const y=lowerTop+(colorMax-v)/(colorMax-colorMin)*lowerHeight;return <g key={v}><line x1={cbX+cbWidth} x2={cbX+cbWidth+5} y1={y} y2={y} stroke={axisColor}/><text x={cbX+cbWidth+9} y={y+font*.32} fontSize={font*.9}>{numberLabel(v)}</text></g>;})}
      <text transform={`translate(${cbX+cbWidth+65},${lowerTop+lowerHeight/2}) rotate(-90)`} textAnchor="middle" fontSize={font}>{text(project,'magnetic_colorbar_label','相关系数')}</text>
    </g>}
    {enabled(project,'showLegend')&&legend.length>0&&<g data-magnetic="legend" transform={`translate(${d.left+10},${lowerTop+lowerHeight-legend.length*(font+7)-13})`}>
      <rect width={Math.max(...legend.map(l=>l.name.length))*font+65} height={legend.length*(font+7)+10} fill={s.background||'#fff'} opacity={.88} stroke="#777" strokeWidth={.6} rx={2}/>
      {legend.map((l,i)=><g key={l.name} transform={`translate(9,${(i+1)*(font+7)-4})`}><line x1={0} x2={32} y1={-font*.3} y2={-font*.3} stroke={l.color} strokeWidth={2.2} strokeDasharray={l.dash}/><text x={42} fontSize={font*.85}>{l.name}</text></g>)}
    </g>}
    {faultInvalid&&<text x={d.left} y={lowerTop-10} fill="#b42318" fontSize={font*.8}>断裂格式有误；请使用 F1:50; F2:110（距离/km）</text>}
  </Frame>;
}
