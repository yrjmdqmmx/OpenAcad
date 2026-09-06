# SVG 标题裁片坐标修复

CI 的 WebKit 斜体测试曾比较出相同截图。原证据 `../font-webkit-matrix-before/` 的三张裁片只有画布左上边框与空白，没有标题，因此它不能证明字体或 CFF FontMatrix 未生效。最小 WebKit 页面以及实际编辑器的正确标题裁片均能显示倾斜，诊断见 `../font-webkit-crop-diagnosis/`。

修复仅涉及 `web/e2e/typography.spec.ts` 的截图坐标和检查：不再使用 WebKit 协议返回的 SVG text `locator.boundingBox()`；把 `getBBox()` 的四个角经 `getScreenCTM()` 映射为屏幕包围盒，再为三种状态使用相同固定裁片。这样包含文字的 x/y 定位及变换。额外解码每张实际 PNG，要求超过 100 个深色像素且横向墨迹覆盖超过裁片一半；浅色画布边框不算文字。各状态同时保存整幅 SVG 的屏幕截图，便于独立查看。

本机 Chromium、Firefox、WebKit 三项均通过，总耗时 10.6 秒。每个浏览器覆盖黑体/宋体 × 400/700 四个组合，逐状态等待实际字体面加载，开启斜体时像素改变，关闭后恢复原像素。每浏览器包含 12 张标题裁片、12 张整图和对应的字形墨迹计数；`summary.json` 汇总，`browser-report.json` 保留独立 Playwright 报告。没有跳过 WebKit，也没有放宽原像素变化断言。

本次未改动正式 8 个 OTF、368 个 WOFF2、字体 CSS 或字体生成器，没有重复全量字形检查或 16 案例网络测试。上述字体仍使用已经验证的 12° CFF FontMatrix 派生面；本机三浏览器结果不代替随后 Linux CI 的结果。
