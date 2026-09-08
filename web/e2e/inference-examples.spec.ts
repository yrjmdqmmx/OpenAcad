import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('替代推断示例的方法注记、原始依据、项目重开与 SVG 一致', async ({page}, info) => {
  test.skip(info.project.name !== 'chromium', '数据与方法的一致性专项');
  test.setTimeout(120000);
  const inference=JSON.parse(await readFile(new URL('../src/templates/scientific-inference.json',import.meta.url),'utf8'));
  async function save(){
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'保存项目',exact:true}).click();
    return JSON.parse(await readFile((await(await pending).path())!,'utf8'));
  }
  for(const id of ['volcano','enrichment-dot','enrichment-bar','enrichment-circle']){
    await page.goto('/#editor/'+id);
    await page.getByRole('button',{name:'试用另一组数据',exact:true}).click();
    const p=await save(), expected=id==='volcano'?inference.alternate.volcano:inference.alternate.enrichment;
    expect(p.dataset).toEqual(expected);
    expect(p.style.subtitle).toContain(id==='volcano'?'每组 n = 8':'背景 N = 6000，输入 n = 180');
    await page.goto('/#catalog');
    await page.locator('input[type=file]').first().setInputFiles({name:id+'-alternate.openacad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
    const reopened=await save();
    for(const key of ['dataset','style','layers','layout','analysis'])
      expect(JSON.stringify(reopened[key])===JSON.stringify(p[key]),id+' '+key).toBe(true);
    await page.getByRole('button',{name:'导出图片',exact:true}).click();
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'下载图片',exact:true}).click();
    const downloaded=await pending,source=await readFile((await downloaded.path())!,'utf8');
    const contents=await page.evaluate(source=>{
      const document=new DOMParser().parseFromString(source,'image/svg+xml');
      for(const span of document.querySelectorAll('tspan[data-scientific-script]')){
        const kind=span.getAttribute('data-scientific-script');
        if(span.getAttribute('baseline-shift')!==kind)throw new Error('Scientific script lost its baseline');
        const digits=kind==='sub'?'₀₁₂₃₄₅₆₇₈₉':'⁰¹²³⁴⁵⁶⁷⁸⁹';
        span.textContent=(span.textContent||'').replace(/[0-9]/g,d=>digits[Number(d)]);
      }
      return {error:!!document.querySelector('parsererror'),text:[...document.querySelectorAll('text')].map(e=>e.textContent).join('')};
    },source);
    expect(contents.error).toBe(false);expect(contents.text).toContain(p.style.subtitle);
    await downloaded.saveAs(info.outputPath(id+'-alternate.svg'));
    await page.getByRole('button',{name:'关闭',exact:true}).click();
  }
});
