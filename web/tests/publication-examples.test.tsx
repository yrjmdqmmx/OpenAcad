import { expect, test } from 'vitest';
import inference from '../src/templates/scientific-inference.json';
import { studentTCdf } from '../src/templates/basic/math';
import { templates } from '../src/templates';
import { makeProject, encodeProject, decodeProject } from '../src/core/project';
import { makeDetailProject } from '../src/templates/detailExamples';
import { renderToStaticMarkup } from 'react-dom/server';

test('火山图每个 P 值与保存的 8+8 个原始观测一致', () => {
  const raw = inference.volcano.tables[1].rows;
  for (const [i, row] of raw.entries()) {
    const a = row.slice(1,9).map(Number), b = row.slice(9).map(Number);
    const mean = (a:number[]) => a.reduce((s,x)=>s+x,0)/a.length;
    const variance = (a:number[]) => a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1);
    const va=variance(a)/8, vb=variance(b)/8, df=(va+vb)**2/(va**2/7+vb**2/7);
    const t=(mean(b)-mean(a))/Math.sqrt(va+vb), p=2*(1-studentTCdf(Math.abs(t),df));
    expect(Number(inference.volcano.tables[0].rows[i][1])).toBeCloseTo(mean(b)-mean(a),12);
    expect(Number(inference.volcano.tables[0].rows[i][2])).toBeCloseTo(p,10);
  }
});

test('富集图命中数、分母和方向计数来自完整模拟集合，BH 包括全部通路', () => {
  const tables=inference.enrichment.tables;
  const study=new Map(tables[2].rows.map(r=>[String(r[0]),String(r[1])]));
  expect(tables[1].rows).toHaveLength(6000);expect(study.size).toBe(180);
  for(const row of tables[0].rows){
    const members=tables[3].rows.filter(r=>r[1]===row[0]).map(r=>String(r[0]));
    const hits=members.filter(g=>study.has(g));
    expect(row[1]).toBe(`${hits.length}/${study.size}`);expect(row[4]).toBe(hits.length);
    expect(row[6]).toBe(members.length);expect(row[7]).toBe(hits.filter(g=>study.get(g)==='上调').length);
    expect(Number(row[7])+Number(row[8])).toBe(row[4]);
  }
  const tests=[...tables[4].rows].sort((a,b)=>Number(a[1])-Number(b[1]));let bound=1;
  for(let i=tests.length-1;i>=0;i--){bound=Math.min(bound,Number(tests[i][1])*tests.length/(i+1));expect(Number(tests[i][2])).toBeCloseTo(bound,13);}
});

test('新项目使用期刊图默认样式，旧项目重开不迁移样式，计算依据跟随项目',()=>{
  expect(templates).toHaveLength(55);
  for(const t of templates){
    const p=makeProject(t);expect(p.style.publicationVersion).toBe(1);
    delete p.style.publicationVersion;p.style.fontSize=13;p.style.palette=['#112233'];
    const back=decodeProject(encodeProject(p),templates);
    expect(back.style.publicationVersion).toBeUndefined();expect(back.style.fontSize).toBe(13);expect(back.style.palette).toEqual(['#112233']);
  }
  for(const id of ['volcano','enrichment-dot','enrichment-bar','enrichment-circle']){
    const p=makeDetailProject(templates.find(t=>t.id===id)!);
    expect(p.dataset.tables.some(t=>t.role.startsWith('raw-'))).toBe(true);
    expect(decodeProject(encodeProject(p),templates).dataset).toEqual(p.dataset);
  }
});

test('模拟片段不伪造检验值，缺失检验值不会通过主动显著性筛选',()=>{
  for(const id of ['protein-domains','protein-motifs','synteny']){
    const t=templates.find(t=>t.id===id)!,p=makeProject(t),synteny=id==='synteny';
    const table=p.dataset.tables.find(t=>t.role===(synteny?'synteny-links':'segments'))!;
    const col=table.columns.indexOf(synteny?'evalue':'significance');
    expect(table.rows.every(r=>r[col]==='')).toBe(true);
    expect(t.validate(p.dataset,p.style).filter(e=>e.severity==='error')).toHaveLength(0);
    expect(renderToStaticMarkup(<t.Renderer project={p}/>)).toContain('值未提供</title>');
    table.rows[0][col]=.02;
    p.style[synteny?'syntenyEvalue':'segmentThreshold']=.05;
    const rendered=renderToStaticMarkup(<t.Renderer project={p}/>);
    expect(rendered).toContain('=0.02</title>');
    expect(rendered).not.toContain('值未提供</title>');
    expect(decodeProject(encodeProject(p),templates).dataset).toEqual(p.dataset);
  }
});
