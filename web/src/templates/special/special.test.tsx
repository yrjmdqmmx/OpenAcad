import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {specialTemplates} from './index';
import {makeProject,encodeProject,decodeProject} from '../../core/project';
const render=(p:ReturnType<typeof makeProject>)=>renderToStaticMarkup(React.createElement(specialTemplates.find(t=>t.id===p.templateId)!.Renderer,{project:p}));
describe('矩阵与关系模板的实际交付契约',()=>{
 for(const t of specialTemplates)it(`${t.id}：两组数据、SVG、项目重开`,()=>{
  const p=makeProject(t);expect(t.validate(p.dataset,p.style)).toEqual([]);const first=render(p);
  expect(first).toContain('xmlns="http://www.w3.org/2000/svg"');expect(first).toContain(`data-chart="${t.id}"`);expect(first).not.toMatch(/NaN|Infinity|请修正数据/);
  p.dataset=structuredClone(t.alternate);expect(t.validate(p.dataset,p.style)).toEqual([]);const second=render(p);expect(second).not.toEqual(first);expect(second).not.toMatch(/NaN|Infinity|请修正数据/);
  p.style.title='重新打开后可继续编辑';p.layout={nodePositions:{甲:{x:100,y:120}}};const reopened=decodeProject(encodeProject(p),specialTemplates);expect(reopened.dataset).toEqual(p.dataset);expect(reopened.layout).toEqual(p.layout);expect(render(reopened)).toContain('重新打开后可继续编辑');
 });
 it('逐单元格错误包括表、行、列',()=>{for(const id of ['heatmap','binary-dot','bubble-matrix','correlation']){const t=specialTemplates.find(t=>t.id===id)!;const p=makeProject(t);p.dataset.tables[0].rows[0][1]='不是数字';expect(t.validate(p.dataset,p.style)).toEqual(expect.arrayContaining([expect.objectContaining({tableId:p.dataset.tables[0].id,row:2,column:2,message:expect.stringContaining('不是有限数字')})]));}});
 it('图形控件修改几何或颜色，网络箭头保留方向',()=>{for(const [id,key,val] of [['heatmap','cellGap',10],['circle-heatmap','sweepAngle',180],['bubble-matrix','bubbleScale',.3],['packing','groupPacking',false],['sankey','nodeWidth',40],['network','directedEdges',true],['map','projection','orthographic']] as const){const p=makeProject(specialTemplates.find(t=>t.id===id)!);const before=render(p);p.style[key]=val;expect(render(p)).not.toEqual(before);if(id==='network')expect(render(p)).toContain('marker-end="url(#network-arrow-');}});
 it('拒绝悬空边、流向环路与越界坐标',()=>{const network=specialTemplates.find(t=>t.id==='network')!;let d=structuredClone(network.example);d.tables[1].rows[0][1]='不存在的节点';expect(network.validate(d).some(i=>i.message.includes('不存在'))).toBe(true);const flow=specialTemplates.find(t=>t.id==='sankey')!;d=structuredClone(flow.example);d.tables[0].rows.push(['居民','太阳能',1]);expect(flow.validate(d).some(i=>i.message.includes('环路'))).toBe(true);const map=specialTemplates.find(t=>t.id==='map')!;d=structuredClone(map.example);d.tables[0].rows[0][1]=190;expect(map.validate(d)).toEqual(expect.arrayContaining([expect.objectContaining({row:2,column:2})]));});
 it('相关性只用原始角色计算，偏 Mantel 要求独立控制矩阵',()=>{const t=specialTemplates.find(t=>t.id==='correlation')!;expect(t.prepareAnalysis!('correlation',t.example,{}).data.tables).toEqual([expect.objectContaining({id:'raw-environment',role:'matrix'})]);const m=specialTemplates.find(t=>t.id==='mantel')!;const d={tables:m.example.tables.filter(t=>t.role!=='raw-control')};expect(()=>m.prepareAnalysis!('mantel.partial',d,{})).toThrow('独立');});
 it('原始模式不把模拟系数冒充计算结果；真实 Mantel 读取服务结果',()=>{const t=specialTemplates.find(t=>t.id==='mantel')!;const p=makeProject(t);p.style.inputMode='raw';expect(render(p)).toContain('请在分析面板执行真实计算');p.analysis={method:'mantel',params:{},inputHash:'test',result:{data:{environmentCorrelation:{r:[[1,.23],[.23,1]],p:[[0,.13],[.13,0]],rowLabels:['温度','水分'],columnLabels:['温度','水分']},edges:[{source:'raw-community',target:'温度',r:.78,p:.02}]}}};const svg=render(p);expect(svg).toContain('0.78');expect(svg).toContain('原始群落丰度');expect(svg).not.toContain('请在分析面板执行真实计算');});
});
