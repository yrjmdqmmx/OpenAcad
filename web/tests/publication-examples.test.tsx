import { expect, test } from 'vitest';
import inference from '../src/templates/scientific-inference.json';
import { studentTCdf } from '../src/templates/basic/math';
import { templates } from '../src/templates';
import { makeProject, encodeProject, decodeProject } from '../src/core/project';
import { makeDetailProject } from '../src/templates/detailExamples';
import { renderToStaticMarkup } from 'react-dom/server';

for (const [label, examples] of [['主示例', inference], ['替代示例', inference.alternate]] as const) {
test(`${label}火山图每个 P 值与保存的 8+8 个原始观测一致`, () => {
  const raw = examples.volcano.tables[1].rows;
  for (const [i, row] of raw.entries()) {
    const a = row.slice(1,9).map(Number), b = row.slice(9).map(Number);
    const mean = (a:number[]) => a.reduce((s,x)=>s+x,0)/a.length;
    const variance = (a:number[]) => a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1);
    const va=variance(a)/8, vb=variance(b)/8, df=(va+vb)**2/(va**2/7+vb**2/7);
    const t=(mean(b)-mean(a))/Math.sqrt(va+vb), p=2*(1-studentTCdf(Math.abs(t),df));
    expect(Number(examples.volcano.tables[0].rows[i][1])).toBeCloseTo(mean(b)-mean(a),12);
    expect(Number(examples.volcano.tables[0].rows[i][2])).toBeCloseTo(p,10);
  }
});

test(`${label}富集图计数、超几何概率与 BH 来自完整模拟集合`, () => {
  const tables=examples.enrichment.tables;
  const study=new Map(tables[2].rows.map(r=>[String(r[0]),String(r[1])]));
  expect(tables[1].rows).toHaveLength(6000);expect(study.size).toBe(180);
  for(const row of tables[0].rows){
    const members=tables[3].rows.filter(r=>r[1]===row[0]).map(r=>String(r[0]));
    const hits=members.filter(g=>study.has(g));
    expect(row[1]).toBe(`${hits.length}/${study.size}`);expect(row[4]).toBe(hits.length);
    expect(row[6]).toBe(members.length);expect(row[7]).toBe(hits.filter(g=>study.get(g)==='上调').length);
    expect(Number(row[7])+Number(row[8])).toBe(row[4]);
    // Independently sum the combinatorial probability mass in the upper tail.
    const logChoose=(n:number,k:number)=>Array.from({length:Math.min(k,n-k)},(_,i)=>Math.log(n-i)-Math.log(i+1)).reduce((s,x)=>s+x,0);
    let p=0;
    for(let k=hits.length;k<=Math.min(members.length,study.size);k++)
      p+=Math.exp(logChoose(members.length,k)+logChoose(tables[1].rows.length-members.length,study.size-k)-logChoose(tables[1].rows.length,study.size));
    const stored=Number(tables[4].rows.find(r=>r[0]===row[0])![1]);
    expect(Math.abs(p-stored)/stored).toBeLessThan(1e-9);
  }
  const tests=[...tables[4].rows].sort((a,b)=>Number(a[1])-Number(b[1]));let bound=1;
  for(let i=tests.length-1;i>=0;i--){bound=Math.min(bound,Number(tests[i][1])*tests.length/(i+1));expect(Number(tests[i][2])).toBeCloseTo(bound,13);}
});
}

test('切换备用示例仍具有标题所述检验的原始依据，并可保存重开',()=>{
  for(const id of ['volcano','enrichment-dot','enrichment-bar','enrichment-circle']){
    const t=templates.find(t=>t.id===id)!;
    const expected=id==='volcano'?inference.alternate.volcano:inference.alternate.enrichment;
    expect(t.alternate).toEqual(expected);expect(t.alternate).not.toEqual(t.example);
    const p=makeProject(t);p.dataset=structuredClone(t.alternate);
    expect(decodeProject(encodeProject(p),templates).dataset).toEqual(expected);
    expect(t.validate(p.dataset,p.style).filter(e=>e.severity==='error')).toHaveLength(0);
  }
});

test('新项目使用期刊图默认样式，旧项目重开不迁移样式，计算依据跟随项目',()=>{
  expect(templates).toHaveLength(56);
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
