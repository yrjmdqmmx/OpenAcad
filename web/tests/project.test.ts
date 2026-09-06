import {describe,it,expect} from 'vitest';
import {templates} from '../src/templates';import {makeProject,encodeProject,decodeProject,inputHash} from '../src/core/project';
import {parseText} from '../src/core/data';
describe('项目与解析契约',()=>{
  for(const t of templates)it(`${t.id} 项目完整往返`,()=>{const p=makeProject(t);p.layers=[{id:'note',type:'text',name:'说明',visible:true,settings:{text:'中文注释',x:120,y:88}}];p.layout={legend:{x:10,y:20}};expect(decodeProject(encodeProject(p),templates)).toMatchObject({...p,updatedAt:expect.any(String)});});
  it('样式不改变输入摘要，数据与参数会改变',async()=>{const p=makeProject(templates[0]);const a=await inputHash(p.dataset,'pca',{seed:1});p.style.title='新图题';expect(await inputHash(p.dataset,'pca',{seed:1})).toBe(a);p.dataset.tables[0].rows[0][1]=999;expect(await inputHash(p.dataset,'pca',{seed:1})).not.toBe(a);});
  it('拒绝未知项目版本和坏文件',()=>{expect(()=>decodeProject('{',templates)).toThrow('JSON');expect(()=>decodeProject('{"schemaVersion":8}',templates)).toThrow('版本');});
  it('粘贴保留带逗号和换行的引号内容',()=>{const t=parseText('类别,数值\n"样本,A",12\n"两\n行",14');expect(t.rows).toEqual([['样本,A','12'],['两\n行','14']]);});
});
