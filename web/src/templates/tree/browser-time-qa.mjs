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

try {
 for(const layout of ['normal','circle','unrooted']){
  await page.goto('http://127.0.0.1:5178/#editor/tree-'+layout);await page.locator('.tree-panel').waitFor();await page.locator('.tree-panel summary').filter({hasText:'树文件与文本'}).click();
  await page.getByRole('button',{name:'试用 MCMCTree 时间树',exact:true}).click();await page.locator('[data-part="node-hpd"]').first().waitFor();must(await page.locator('[data-part="node-hpd"]').count()===5,'MCMCTree五节点区间');const first=await chart(page).innerHTML();
  await page.getByRole('button',{name:'试用 BEAST 时间树',exact:true}).click();must(await chart(page).innerHTML()!==first,'替换已有时间树未改变几何');await page.getByRole('combobox',{name:'选择树节点',exact:true}).selectOption('十字花科');
  const node=page.locator('[data-part="tree-node"][data-node-id="十字花科"]'),before=await node.getAttribute('transform');await page.getByRole('spinbutton',{name:'节点年代',exact:true}).fill('5.5');await page.getByRole('spinbutton',{name:'95% 区间下界',exact:true}).fill('4.4');await page.getByRole('spinbutton',{name:'95% 区间上界',exact:true}).fill('6.8');await page.getByRole('button',{name:'应用时间结果',exact:true}).click();const after=await node.getAttribute('transform');must(after!==before,'年龄编辑未移动节点');await page.getByRole('button',{name:'撤销',exact:true}).click();must(await node.getAttribute('transform')===before,'撤销未恢复年代');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'节点年代',exact:true})).toHaveValue('5.5');must(await node.getAttribute('transform')===after,'重做未恢复年代');
  await page.getByRole('spinbutton',{name:'95% 区间下界',exact:true}).fill('9');await page.getByRole('button',{name:'应用时间结果',exact:true}).click();must((await page.locator('[role="alert"]').allTextContents()).join('').includes('下界不大于上界'),'无效区间缺明确提示');must(await node.getAttribute('transform')===after,'无效区间破坏上次有效结果');await page.getByRole('spinbutton',{name:'95% 区间下界',exact:true}).fill('4.4');await page.getByRole('button',{name:'应用时间结果',exact:true}).click();
  await page.getByRole('switch',{name:'显示 95% 可信区间',exact:true}).click();must(await page.locator('[data-part="node-hpd"]').count()===0,'区间隐藏无效');await page.getByRole('switch',{name:'显示 95% 可信区间',exact:true}).click();
  await page.getByRole('spinbutton',{name:'可信区间条带厚度',exact:true}).fill('11');await page.getByLabel('可信区间颜色',{exact:true}).fill('#aa4567');await page.getByRole('switch',{name:'显示节点年代',exact:true}).click();await page.getByRole('switch',{name:'显示后验概率',exact:true}).click();await page.getByRole('textbox',{name:'原始时间单位',exact:true}).fill('模拟时间单位');await page.getByRole('combobox',{name:'字体',exact:true}).selectOption('Noto Serif CJK SC');
  const saved=new URL('time-'+layout+'.openacad.json',treeDir).pathname;await download(page,'保存项目',saved);const stored=JSON.parse(await fs.readFile(saved));must(stored.layout.treeState.root.children[0].age===5.5,'项目遗失年代');await reopen.goto('http://127.0.0.1:5178/');await reopen.locator('input[type=file]').first().setInputFiles(saved);await chart(reopen).waitFor();must(await chart(reopen).innerHTML()===await chart(page).innerHTML(),'时间树项目恢复不一致');
  const artifacts=await exportAll(page,treeDir,'time-'+layout);await page.screenshot({path:new URL('time-'+layout+'-screen.png',treeDir).pathname});results.push({case:layout,passed:true,ageBefore:before,ageAfter:after,artifacts});console.log(layout+': passed');
 }
} catch(e){results.push({case:'fatal',passed:false,error:String(e)});console.error(e);}finally{await fs.writeFile(new URL('browser-time.json',treeDir),JSON.stringify(results,null,2));await browser.close();}if(results.some(r=>!r.passed))process.exitCode=1;
