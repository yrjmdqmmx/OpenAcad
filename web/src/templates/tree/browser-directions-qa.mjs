import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const treeDir = new URL("./evidence/", import.meta.url);
const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }),
  context = await browser.newContext({
    viewport: { width: 1720, height: 1100 },
    acceptDownloads: true,
  }),
  page = await context.newPage(),
  reopen = await context.newPage(),
  results = [];
const must = (condition, message) => {
  if (!condition) throw Error(message);
};
const clean = (s) => s.replace(/basic[a-zA-Z0-9]+/g, "basicID");
const chart = (page) => page.locator(".figure-paper svg[data-chart]").first();
const download = async (page, button, path) => {
  const waiting = page.waitForEvent("download", { timeout: 110000 });
  await page.getByRole("button", { name: button, exact: true }).click();
  const dl = await waiting;
  await dl.saveAs(path);
  return dl;
};
const exportAll = async (page, dir, name) => {
  const artifacts = [];
  for (const format of ["svg", "png", "pdf", "eps"]) {
    await page.getByRole("button", { name: "导出图片", exact: true }).click();
    await page
      .getByRole("combobox", { name: "图片格式", exact: true })
      .selectOption(format);
    if (format === "png")
      await page
        .getByRole("combobox", { name: "分辨率", exact: true })
        .selectOption("150");
    const file = new URL(name + "." + format, dir).pathname;
    await download(page, "下载图片", file);
    const bytes = await fs.readFile(file);
    must(bytes.length > 1000, "文件过小");
    if (format === "png")
      must(
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        "PNG签名",
      );
    if (format === "pdf")
      must(bytes.toString("utf8", 0, 5) === "%PDF-", "PDF签名");
    if (format === "eps")
      must(bytes.toString("utf8", 0, 4) === "%!PS", "EPS签名");
    if (format === "svg") {
      must(!/NaN|Infinity/.test(bytes.toString()), "SVG有限几何");
      const opened = await context.newPage();
      await opened.goto("file://" + file);
      await opened.locator("svg").first().waitFor();
      must((await opened.locator("svg").count()) > 0, "SVG无法重开");
      await opened.close();
    }
    artifacts.push({ format, bytes: bytes.length, file });
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  return artifacts;
};


try{
 for(const layout of ['normal','circle']){
  await page.goto('http://127.0.0.1:5178/#editor/tree-'+layout);await page.locator('.tree-panel').waitFor();await page.locator('.tree-panel summary').filter({hasText:'树文件与文本'}).click();await page.getByRole('button',{name:'试用 BEAST 时间树',exact:true}).click();await page.locator('[data-part="node-hpd"]').first().waitFor();
  await page.getByRole('combobox',{name:'树注释类型',exact:true}).selectOption('heatmap');await page.getByRole('button',{name:'添加可试用的图层',exact:true}).click();const before=await chart(page).innerHTML();
  if(layout==='normal')await page.getByRole('combobox',{name:'矩形树方向',exact:true}).selectOption('rtl');else{await page.getByRole('switch',{name:'环形向内生长',exact:true}).click();await page.getByRole('spinbutton',{name:'向内布局叶端内半径',exact:true}).fill('350');}must(await chart(page).innerHTML()!==before,'方向未改变图形');
  await page.getByRole('combobox',{name:'分支连接样式',exact:true}).selectOption(layout==='normal'?'rounded':'bezierX');await page.getByRole('switch',{name:'显示节点年代',exact:true}).click();await page.getByRole('spinbutton',{name:'年代文字换算倍率',exact:true}).fill('100');await page.getByRole('spinbutton',{name:'年代文字小数位',exact:true}).fill('1');must(await page.locator('[data-part="node-age"]').first().textContent()==='1200.0','年代换算未生效');
  await page.getByRole('combobox',{name:'可信区间显示方式',exact:true}).selectOption('text');must(await page.locator('[data-part="node-hpd"]').first().evaluate(el=>el.tagName)==='text','区间文本未生效');await page.getByRole('spinbutton',{name:'区间换算倍率（对齐原树单位）',exact:true}).fill('2');must((await page.locator('[data-part="node-hpd"]').first().textContent()).includes('27.2'),'区间换算未生效');await page.getByRole('spinbutton',{name:'区间文字横向偏移',exact:true}).fill('15');await page.getByRole('spinbutton',{name:'区间文字纵向偏移',exact:true}).fill('-20');
  const saved=new URL('direction-'+layout+'.openacad.json',treeDir).pathname;await download(page,'保存项目',saved);await reopen.goto('http://127.0.0.1:5178/');await reopen.locator('input[type=file]').first().setInputFiles(saved);await chart(reopen).waitFor();must(await chart(reopen).innerHTML()===await chart(page).innerHTML(),'方向+时间文字重开不一致');const artifacts=await exportAll(page,treeDir,'direction-'+layout);await page.screenshot({path:new URL('direction-'+layout+'-screen.png',treeDir).pathname});results.push({case:layout,passed:true,artifacts});console.log(layout+': passed');
 }
}catch(e){results.push({case:'fatal',passed:false,error:String(e)});console.error(e)}finally{await fs.writeFile(new URL('browser-directions.json',treeDir),JSON.stringify(results,null,2));await browser.close()}if(results.some(r=>!r.passed))process.exitCode=1;
