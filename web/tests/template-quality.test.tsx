import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeProject, inputHash, encodeProject, decodeProject, palettes } from '../src/core/project';
import { applyPalette, labelControl, changeChartStyle, paletteVisible } from '../src/core/chartControls';
import { assertExportReady } from '../src/core/exportReadiness';
import { templates } from '../src/templates';
import { placeLabels } from '../src/core/labelLayout';
const byId = (id: string) => templates.find(t => t.id === id)!;
const svg = (id: string, style?: Record<string, unknown>) => {
  const t = byId(id), p = makeProject(t); Object.assign(p.style, style);
  return renderToStaticMarkup(<t.Renderer project={p} />);
};
describe('review P1 regressions', () => {
  for (const id of ['heatmap','circle-heatmap','bubble-matrix','correlation','double-correlation','volcano','enrichment-dot','enrichment-bar'])
    it(`${id} palette changes actual marks and survives project roundtrip`, () => {
      const t=byId(id), p=makeProject(t), before=svg(id);
      p.style=applyPalette(p,palettes.灰阶);
      expect(renderToStaticMarkup(<t.Renderer project={p}/>)).not.toBe(before);
      expect(decodeProject(encodeProject(p),templates).style).toEqual(p.style);
    });
  it('matrix labels have a separate name from values, trees expose no unused palette',()=>{
    expect(labelControl(byId('heatmap')).label).toBe('显示行列标签');
    expect(byId('heatmap').controls.find(c=>c.key==='showValues')?.label).toBe('显示单元格数值');
    expect(paletteVisible(makeProject(byId('tree-circle')))).toBe(false);
  });
  it('rejects stale ordination exports, accepts recomputed results and supplied coordinates',async()=>{
    const p=makeProject(byId('pca')); await expect(assertExportReady(p)).resolves.toBeUndefined();
    p.dataset.tables[0].rows[0][1]=18.5;
    await expect(assertExportReady(p)).rejects.toThrow('重新计算');
    p.analysis!.inputHash=await inputHash(p.dataset,p.analysis!.method,p.analysis!.params);
    await expect(assertExportReady(p)).resolves.toBeUndefined();
    p.analysis=undefined; await expect(assertExportReady(p)).rejects.toThrow('尚无有效');
    p.style.ordinationInput='scores'; await expect(assertExportReady(p)).resolves.toBeUndefined();
    p.style.axisTwo=1;await expect(assertExportReady(p)).rejects.toThrow('不同');
  });
  it('swaps titles and units with orientation without changing stored data',()=>{
    const p=makeProject(byId('bar-grouped'));p.style.xTitle='处理浓度 (µM)';p.style.yTitle='酶活性 (U/mL)';
    const next=changeChartStyle(p,'orientation','horizontal');
    expect(next.style.xTitle).toBe('酶活性 (U/mL)');expect(next.style.yTitle).toBe('处理浓度 (µM)');
    expect(next.dataset).toBe(p.dataset);expect(changeChartStyle(next,'orientation','vertical').style).toEqual(p.style);
  });
  it('places coincident labels apart without moving anchors',()=>{
    const labels=[{id:'a',x:50,y:60,text:'物种丙',size:14},{id:'b',x:50,y:60,text:'物种丁',size:14}];
    const at=placeLabels(labels,400,300);expect(at.a).not.toEqual(at.b);expect(labels[0].x).toBe(50);
    expect(at).toEqual(placeLabels(labels,400,300));
  });
});

describe('review P2 scientific defaults',()=>{
  it('keeps simulated provenance inside all standalone figures',()=>{
    for(const t of templates) expect(svg(t.id)).toMatch(/模拟/);
  });
  it('error definitions follow the chosen estimator and actual sample counts',()=>{
    for(const id of ['bar-error','bar-grouped-error','scatter-error','line-error']) {
      expect(svg(id,{errorType:'se'})).toContain('均值 ± SE');
      expect(svg(id,{errorType:'ci'})).toContain('95% t 置信区间');
      expect(svg(id)).toContain(id==='line-error'?'n = 6':'n = 18');
    }
  });
  it('uses distinct domain and short repeated motif inputs',()=>{
    const a=byId('protein-domains').example.tables[1],b=byId('protein-motifs').example.tables[1];
    expect(a).not.toEqual(b);
    expect(b.rows.every(r=>Number(r[3])-Number(r[2])<=24)).toBe(true);
  });
  it('ships independent groups and computed, converged ordination results',()=>{
    for(const t of templates.filter(t=>t.familyId==='ordination')){
      const p=makeProject(t);expect(p.dataset.tables[0].rows).toHaveLength(18);
      expect(new Set(Object.values(p.layout.sampleAnnotations as Record<string,{group:string}>).map(a=>a.group)).size).toBe(3);
      expect(p.analysis?.result?.provenance).toBeTruthy();
    }
  });
  it('tree annotation presets roundtrip with their colour categories and numeric data',()=>{
    for(const id of ['tree-normal','tree-circle','tree-unrooted']) {
      const p=makeProject(byId(id)), loaded=decodeProject(encodeProject(p),templates);
      expect(p.layers.length).toBe(id==='tree-unrooted'?1:3);expect(loaded.layers).toEqual(p.layers);
      const grouping=p.layers.find(l=>l.type==='tree:label-background')!.data!.tables[0];
      const column=grouping.columns.indexOf('分类');
      for(const group of new Set(grouping.rows.map(r=>String(r[column])))) expect(svg(id)).toContain(group);
    }
  });
});
