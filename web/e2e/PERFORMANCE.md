# 样式预览响应时间

`performance.spec.ts` 对 10 个常规模拟模板各执行 3 次真实 `locator.fill()` 标题输入，共 30 次。每次输入前只等待初始 SVG、字体和两帧初始化；不丢弃首个样本、不重试慢样本。

产品计时从页面捕获实际 `input` 事件开始。`MutationObserver` 确认可见 SVG `text` 已包含本次唯一标题，随后连续等待两次 `requestAnimationFrame`，跨过一次浏览器渲染机会。单次 rAF 在绘制之前，不足以作为结束时刻。全部时间使用同一页面的 `performance.now()`，不混合 Node 和浏览器时钟。该方法是跨帧呈现延迟估计，不声称测到了屏幕光学或合成器完成时间。

报告保留输入→DOM 更新、后续等待帧、输入→跨帧完成三个时段。旧口径 Node 自动化填入→标题断言总耗时单独记录为 `automationUntilTitleMilliseconds`；另保留包含结果读取的 `automationTotalMilliseconds`。定位、滚动、协议往返会影响这两项，不能拿来代替产品预览延迟。

目标保持 **300ms**。既检查 30 次合并的最近秩 p95，也检查各模板 3 次样本的 p95（此时等于最大值），并列出所有超标样本。未完成/错误测量不计作成功。大数据量、在线统计和文件导出不属于该标题样式测试的测量范围。

本地专项运行使用独立 JSON、附件目录及 list 输出，不覆盖总浏览器报告：

```sh
cd web
OPENACAD_PERFORMANCE_REPORT=../tests/artifacts/performance-local/style-performance.json \
PLAYWRIGHT_JSON_OUTPUT_FILE=../tests/artifacts/performance-local/playwright-results.json \
OPENACAD_CHROMIUM_BINARY='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
npx playwright test e2e/performance.spec.ts --project=chromium --workers=1 \
  --reporter=list,json --output=../tests/artifacts/performance-local/test-results
```

Linux CI 可省略本机 Chrome 路径，使用已安装的 Playwright Chromium。常规套件默认写 `tests/artifacts/style-performance.json`；新报告以 `schemaVersion: 2` 和 `measurement` 标识新口径，不能与旧自动化总耗时直接混为同一指标。
