# 标题预览性能调查（2026-09-07）

基于 2794ea6；主代理随后仅修改 App.tsx 的项目状态保留和编辑器 key。本调查未改图表算法，300ms 目标不变。仅覆盖常规模拟数据的标题编辑，不外推所有样式、数据重布局或统计任务。

## 结果

Chrome 152.0.7977.76 / macOS，测量页施加 4 倍 CPU 减速。使用实际 input → SVG 文字更新 → 连续两次动画帧，全部主计时来自同页面 performance.now。每组 10 模板 × 3 次；各模板 3 次的最近秩 p95 等于最大值。

|App 修复后运行|p95 ms|最大 ms|最慢模板|最慢输入→DOM ms|最慢后续帧 ms|有效样本|
|---|---:|---:|---|---:|---:|---:|
|after-app-dev-idle|83.2|84.1|line|70.0|14.1|30/30|
|after-app-prod-idle|29.7|32.5|map|24.2|8.3|30/30|
|after-app-dev-concurrent|86.0|90.6|line|75.8|14.8|30/30|
|after-app-prod-concurrent|28.3|33.4|map|24.2|9.2|30/30|

生产对照复用主代理实际 dist，通过 5180 的 Vite preview 访问；开发模式通过 5178。并发运行保留 2 workers，另一个 worker 执行现有三个 workflow 场景（数据编辑/错误/撤销/项目往返，SVG 下载，页面导航），每组四项测试全部通过。并发对照没有证明此前 Linux 存在或不存在 CPU 争用，只证明这组本机负载下通过。

## 已确认的成本与修正

- App 原来每次接收 Editor 项目变更都会 setState，再次渲染整个 Editor；初始化 key 由 example 变为项目 ID 还会重挂载。主代理改为 ref 保留最近项目，并以显式打开/模板变化驱动挂载。静态代码可确认冗余，本次没有将初始化 remount 作为 timeout 实测原因。
- 原开发构建 CPU 采样（App 修改前完成）中，三个 line 更新的 Inspector inclusive 约 50.2ms、DataPanel 33.7ms、Editor 28.3ms；jsxDEV self 133.8ms。inclusive 项有嵌套，不能相加作为总耗时。
- 三个默认树更新中 Inspector inclusive 36.6ms，TreePanel 15.5ms，stateFor/parseTree 13.4ms，requiredTreeCanvas 1.5ms。逐控件 visible 会反复解析树和构建时间信息；当前样例最主要成本仍是控件及 JSX 渲染。没有为追求分数更改树几何。
- 原动态监听诊断基线最大 line 133.0ms（输入→DOM 68.1ms，后续帧 64.9ms），默认树最大 83.3ms；它与正式验收监听位置不同，只用于诊断。

## 测量错误更正

最初把 TypeScript 测试复制到 /tmp，未保留 web/package.json 的 ESM 语义。Playwright 将 Node performance 导入转为 CJS 别名，导致序列化到浏览器的回调抛出 `_nodePerf_hooks is not defined`。该错误造成未记录 inputAt 的超时，不能作为产品延迟或 remount 的证据。补充临时 package.json 的 type=module 后，正式 input 监听完成全部 120 次。原失败文件仍保留在 cpu4-style-performance.json / after-app，after-app-diagnostic 保留同类异常；它们均不计入通过样本。

## Linux 原失败分段

已读取 `../performance-linux-2794ea6.json`，对应 CI 34043637129 / 源码 2794ea6 / Chromium 153.0.8010.12。30/30 完成测量，合并 p95 369.5ms，共三次超过 300ms：

|模板/样本|输入→DOM ms|DOM→第一帧 ms|第一→第二帧 ms|总延迟 ms|
|---|---:|---:|---:|---:|
|pca/1|184.4|1.4|190.7|376.5|
|map/2|199.4|3.3|166.8|369.5|
|box/3|140.1|2.8|166.2|309.1|

最慢项是 PCA、地图和箱线图；默认树最大 196.2ms，并不是这次失败的集中来源。三个超标样本在输入→DOM 和第一帧后的第二段都有较长耗时，与已经确认的 App 回传造成第二轮渲染、以及本机采样的控件/JSX 成本一致。该 JSON 没有 Linux CPU trace，不能单独量化其中 CPU 争用、调度、开发构建开销各占多少。其 30 次测量正常完成，不存在本调查 /tmp ESM 配置错误。

## 限界

修正 App、改用实际 dist 后，仍须在 Linux 保持原 300ms 阈值和 2 workers 复验。本机通过不是 Linux 发布门已通过的证明。双 requestAnimationFrame 表示跨过渲染机会，并非物理屏幕或合成器完成时间。

原始证据：comparison.json、各 after-app-*/style-performance.json 与 playwright.json、cpu4-*.cpuprofile 及 *-summary.json。
