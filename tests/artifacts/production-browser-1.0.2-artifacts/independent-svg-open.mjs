import { createRequire } from "node:module";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
const [repo,out]=process.argv.slice(2), req=createRequire(repo+"/web/package.json"), {chromium}=req("@playwright/test");
const browser=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
const report={version:browser.version(),files:[]};
try { for(const device of ["chromium","mobile"]) {
const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:1});
const page=await context.newPage(), errors=[],requests=[];
page.on("pageerror", e=>errors.push(e.message));
await page.route(/https?:/,route=>{requests.push(route.request().url());return route.abort();});
const source=`live-exports/${device}-chinese-serif.svg`,preview=`independent-previews/${device}-chinese-serif-svg.png`;
await page.goto(pathToFileURL(out+"/"+source).href,{waitUntil:"load"});
const structure=await page.locator("svg").first().evaluate(el=>({width:el.width.baseVal.value,height:el.height.baseVal.value,viewBox:el.getAttribute("viewBox"),textElements:el.querySelectorAll("text").length,paths:el.querySelectorAll("path").length,embeddedImages:el.querySelectorAll("image").length,label:el.getAttribute("aria-label")}));
await page.screenshot({path:out+"/"+preview});
report.files.push({source,preview,...structure,pageErrors:errors,externalRequests:requests.length});
await context.close();
}} finally {await browser.close();}
await fs.writeFile(out+"/independent-previews/svg-open.json",JSON.stringify(report,null,2)+"\n");
