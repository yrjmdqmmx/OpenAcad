# 网页中文斜体专项

原 `font-synthesis: weight` 禁止合成倾斜。修复前宋体 400 标题的 `font-style` 从 normal 改为 italic，但同一固定屏幕裁片的三次 PNG（关闭、开启、关闭）SHA 完全相同；原证据保留在 `../font-italic-before/`。

现改为 `font-synthesis: weight style`，没有新增或修改任何字体文件。`web/e2e/typography.spec.ts` 用真实标题斜体开关，逐个检查黑体/宋体 × 400/700：同一带边距的固定裁片在开启斜体时发生像素变化，关闭后恢复完全相同截图。字体通过实际文本的 `document.fonts.load/check` 后再截图，不只检查 SVG 属性。它证明浏览器倾斜合成有效，不宣称存在独立 Italic 面或与其他排版引擎像素一致。

本地真实 Chrome：1 项通过，包含 4 个字体/字重组合和 12 张截图；测试本身耗时 2.5 秒。`browser-report.json` 为独立 Playwright 报告，`italic-pixel-report.json` 记录截图 SHA。其他浏览器将由统一 CI 执行；此记录没有把本地 Chrome 结果称为全浏览器验收。

复现：在 `web/` 执行 `npx playwright test e2e/typography.spec.ts --project=chromium --workers=1 --reporter=list,json`；设置 `PLAYWRIGHT_JSON_OUTPUT_FILE` 与 `--output` 可隔离报告目录。此次测试未运行全套，也没有修改统计或导出算法。
