import React from 'react';
import {describe, it, expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {makeProject, inputHash, encodeProject, decodeProject} from '../../core/project';
import {magneticTemplates, magneticInput, parseMagneticTrack, prepareMagneticAnalysis, MAGNETIC_PARAMS, magneticResult, parseFaults} from './index';

const template = magneticTemplates[0];
describe('磁异常相关成像模板', () => {
  it('bundles a reproducible algorithm result tied to the exact example dataset and parameters', async () => {
    const p=makeProject(template), analysis=p.analysis!;
    expect(analysis.inputHash).toBe(await inputHash(p.dataset,analysis.method,analysis.params));
    const result=magneticResult(analysis.result)!;
    expect(result.xs).toHaveLength(78);
    expect(result.zs).toHaveLength(23);
    expect(result.correlation.flat()).toHaveLength(1794);
    expect(Math.min(...result.correlation.flat().filter((v):v is number=>v!==null))).toBeLessThan(-.7);
    expect(analysis.result?.provenance).toBeTruthy();
  });
  it('round-trips all three inputs, calculated matrix and visual controls', () => {
    const p=makeProject(template);
    p.style.magnetic_faults='A:55; B:201';
    p.style.magnetic_reverse=true;
    const roundTrip=decodeProject(encodeProject(p),magneticTemplates);
    expect(roundTrip.dataset).toEqual(p.dataset);
    expect(roundTrip.analysis).toEqual(p.analysis);
    expect(roundTrip.style.magnetic_faults).toBe('A:55; B:201');
    expect(roundTrip.style.magnetic_reverse).toBe(true);
  });
  it('requires three roles and valid numeric data; never substitutes the demo inputs', () => {
    const data=structuredClone(template.example);
    expect(magneticInput(data).curve).toHaveLength(781);
    data.files=[];
    expect(()=>magneticInput(data)).toThrow('测线位置 JSON');
    const malformed=structuredClone(template.example);
    malformed.tables[0].rows[2][1]='';
    expect(()=>magneticInput(malformed)).toThrow('mag_nT');
    const duplicate=structuredClone(template.example);
    duplicate.tables[0].rows[2][0]=duplicate.tables[0].rows[1][0];
    expect(()=>magneticInput(duplicate)).toThrow('严格递增');
  });
  it('supports original keyed JSON and explicit multi-line selection without passing UI fields to Python', () => {
    const poly=[[114,22],[117,19]], json=JSON.stringify({OBS93:{poly},OBS2001:{poly:[[110,20],[113,17]]}});
    expect(()=>parseMagneticTrack(json)).toThrow('多条测线');
    expect(parseMagneticTrack(json,'OBS2001').name).toBe('OBS2001');
    expect(()=>parseMagneticTrack(JSON.stringify({OBS93:{poly}}),'missing')).toThrow('没有测线');
    const data=structuredClone(template.example); data.files![0].text=json;
    expect(template.validate(data)).toEqual([]);
    const prepared=prepareMagneticAnalysis('magnetic-correlation',data,{...MAGNETIC_PARAMS,line_name:'OBS2001'});
    expect((prepared.data.track as {name:string}).name).toBe('OBS2001');
    expect(prepared.params).not.toHaveProperty('line_name');
    expect(()=>parseMagneticTrack('{"OBS93":{"poly":[[200,25],[120,30]]}}')).toThrow('超出范围');
  });
  it('renders editable vector cells, curves and labels rather than a rasterized reference image', () => {
    const p=makeProject(template), svg=renderToStaticMarkup(<template.Renderer project={p}/>);
    expect(svg.match(/data-magnetic-cell=/g)).toHaveLength(1794);
    expect(svg.match(/data-magnetic="station"/g)).toHaveLength(15);
    expect(svg).toContain('data-magnetic="curve"');
    expect(svg).toContain('data-magnetic="bathy"');
    expect(svg).toContain('data-magnetic="basement"');
    expect(svg).toContain('data-magnetic="moho"');
    expect(svg).toContain('>F1</text>');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('data:image');
  });
  it('applies visual controls without changing computation inputs or magnetic observations', () => {
    const p=makeProject(template), initial=prepareMagneticAnalysis('magnetic-correlation',p.dataset,p.analysis!.params);
    const original=renderToStaticMarkup(<template.Renderer project={p}/>);
    p.style.magnetic_reverse=true;p.style.magnetic_faults='X:80';p.style.magnetic_n_sta=4;
    p.style.magnetic_show_moho=false;p.style.magnetic_curve_color='#df1234';
    const changed=renderToStaticMarkup(<template.Renderer project={p}/>);
    expect(changed).not.toEqual(original);
    expect(changed.match(/data-magnetic="station"/g)).toHaveLength(4);
    expect(changed).toContain('>X</text>');
    expect(changed).toContain('stroke="#df1234"');
    expect(changed).not.toContain('data-magnetic="moho"');
    expect(prepareMagneticAnalysis('magnetic-correlation',p.dataset,p.analysis!.params)).toEqual(initial);
    expect(parseFaults('F1:50; F2:110')).toEqual([{name:'F1',x:50},{name:'F2',x:110}]);
  });
  it('shows pending calculation with no manufactured heatmap when no result exists', () => {
    const p=makeProject(template); delete p.analysis;
    const svg=renderToStaticMarkup(<template.Renderer project={p}/>);
    expect(svg).toContain('data-magnetic="pending"');
    expect(svg).not.toContain('data-magnetic-cell');
  });
});
