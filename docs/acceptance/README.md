# OpenAcad 逐模板验收索引

更新时间：2026-09-06T15:00:48.479785+00:00。本目录对应 **55 个可编辑模板、52 个去重源站入口**。这是本地交付证据索引，正式域名、服务器发布与回滚另见部署文档。

- [逐模板表格](templates.csv)：适合筛选模板、来源、四种图片文件和条件项。
- [完整结构记录](templates.json)：每项检查的方法、报告选择路径、原始中文错误、文件 SHA、条件分支和源站一对多映射。
- [公开简要页面](../../web/public/acceptance/index.html)：部署路径 `/acceptance/index.html`，提供中文检索及相同 JSON/CSV 下载。

## 最终运行结果及解释

主浏览器套件：**82 通过，0 失败，194 按配置跳过，0 重试不稳定**。55 个模板均在 Chromium 实际显示、下载项目、下载 SVG 并重新打开 SVG；3 个通用工作流另在 Chromium、Firefox、WebKit 和 390px 手机配置各运行一次。5 项排序分析使用真实后端，8 项验证实际图片导出（桌面与手机各四格式），1 项检查排序图分组/已有坐标模式/项目恢复，1 项检查样式响应时间。194 个跳过项表示按场景只在指定配置运行，不能说55图均完成四浏览器逐项验收。原报告：[browser-results.json](../../tests/artifacts/browser-results.json)。

默认样式审计记录 **2371 项**，其中 **2367 项**改变服务器端 React SVG 序列化，另 **4 项**依赖特定数据或布局。它不是2371次浏览器操作，也不证明任意参数组合。每个模板的真实浏览器样式覆盖单独列出。主任务最终单元测试反馈为311项通过；本索引把具体断言位置与运行报告分开引用。

另外完成 **110 次实际 Chrome 注错**：每个模板一次缺数据，一次非法数字、缺必填列、集合数超限或非法 Newick 分支长度；55×2全部显示中文错误。具体破坏位置及界面错误原文已内嵌 JSON 的 `invalidData`。这是逐模板有界输入检查，不是穷举所有错误。

图片导出 **165/165** 文件经过真实 Redis/RQ/Inkscape 转换，使用 Pillow/Poppler/Ghostscript 独立打开。每个模板分别列SVG、PNG、PDF、EPS文件；当前输入SHA不一致项为 **0**。SHA不一致只说明当前SVG与导出使用的版本不同，不能把旧文件套在新输入上声明完成；最终应为0。EPS透明效果可能按背景栅格化，详见各文件diagnostics；不能把“EPS可打开”写成“所有EPS均为全矢量”。[导出报告](../../tests/artifacts/export-matrix.json)。

## 数据替换、样式和项目的证据层次

- 特殊22模板：Chrome实际替代数据、撤销、中文标题、项目下载及同ID重开；专项覆盖矩阵注释、聚类树、圈轨道、断轴、网络属性/拖动、Venn拖动、共线性拖序和分类色。另有8次真实统计服务计算。[特殊图证据说明](../special-capability-gaps.md)。
- 基础25模板：每模板两套数据的SSR几何变化、缺必填字段与项目往返；柱图有纹理、系列覆盖、轴设置及标签拖动的独立浏览器与四格式文件，误差柱有真实P值/字母标注及拖动。不能把同内核代表浏览器场景算作25图每个控件都已实际点击。
- 排序5模板：实际替换另一组数据、重新提交服务、输出变化、过期结果提示、保存含provenance的项目；已有坐标模式及注释另外有单测。
- 树3布局：原树/第二组树/拓扑保存有逐布局单测；浏览器逐层共71个适用组合（矩形29、圈形29、无根13）检查替代图层数据、隐藏和项目重开。无根16个布局不适用项见[树图层研究](../research/tree-layers.json)，不算成功执行。三图层组合另有实际四格式导出。

项目文件为 `.openacad.json`，图片格式是SVG/PNG/PDF/EPS。默认逐图测试实际下载项目并检查输入数据/分析结果；部分临时下载没有独立留档，索引明确将 `template-cases.json` 标为测试输入夹具，而非伪称下载证据。[项目往返断言](../../web/tests/project.test.ts)。

## 1.0冻结后树功能专项

以下专项独立于保留的82项总浏览器套件；**案例数、布局组合数与图片文件数分开记录**，不把截图或下载数量加到82项测试上。完整记录见 JSON 顶层 `supplementalTreeEvidence`，三树模板也有各自的 `treeSupplementalEvidence`。

|专项|浏览器案例|实际文件|证据|
|---|---|---|---|
|已有时间树|3布局、3案例通过|12份SVG/PNG/PDF/EPS及3个可编辑项目|[时间树报告](../../web/src/templates/tree/evidence/browser-time.json)|
|生长方向|矩形RTL、环形向内，共2案例通过|8份四格式图片及2个项目|[方向报告](../../web/src/templates/tree/evidence/browser-directions.json)|
|分支/支持度|14个布局×路径组合＋1个支持度综合案例，共15通过|16份SVG，另48份PNG/PDF/EPS独立打开；综合案例前后SVG不算两个测试|[浏览器报告](../../web/src/templates/tree/evidence/branch-styles/browser-report.json)、[导出报告](../../server/tests/artifacts/tree-branch-export-matrix.json)|
|动态分支菜单|同一项目切换3布局|当前有效路径选项为6/5/3；无额外图片计数|[菜单记录](../../web/src/templates/tree/evidence/browser-dynamic-options.json)|

三个默认树SVG在1.0功能冻结后由主任务专门刷新，对应9份PNG/PDF/EPS也已与当前源SHA同步；这次刷新单独标注，不把它追记为较早总套件的一部分。已有时间树编辑使用用户已有年代、后验摘要与可信区间；不运行BEAST/MCMCTree，也不从单树估计分歧时间或收敛。[树工作台验收与边界](../../web/src/templates/tree/ACCEPTANCE.md)。

## 四个默认未变的条件项

|模板/控件|为什么默认未变|专项证据|
|---|---|---|
|sankey / flowAlign|默认各路径层数相同；增加短路径终点后对齐改变几何|special.test.tsx：流对齐、类别透明度与普通数值轨道上限使用相应输入|
|synteny / syntenyInput|默认原文件和标准化表表达同一生物数据；等价结果是预期|browser-interactions.json 的 synteny-native；原格式及另一组原文件实际显示|
|synteny / chromosomeSort|默认数据已按名称排序；反转后名称排序改变几何|special.test.tsx 对应排序测试；browser-coverage.json 拖序重开|
|tree-normal / marginRight|默认画布尚有余量；密集8图层时触发真实画布扩展|tree.test.tsx：右边距+100断言SVG宽度+100|

## 重建索引

先确保 Node 和 `web/node_modules` 可用，再从任意目录运行：

```sh
python3 /你的仓库路径/OpenAcad/docs/acceptance/build_index.py --unit-passed 311
```

脚本通过自身位置找到仓库，用 Vite 只读加载当前模板注册表，读取仓库内测试报告和 [逐模板注错原始记录](invalid-input-browser.json)。它不会重新执行测试、请求统计服务或覆盖SVG；总报告缺失/不完整时标记待刷新。新增模板不应继承旧模板的成功记录。先完成测试，再重建索引。

## 来源与文件版本

`sourceUrls`保留注册模板的全部来源链接；`sourceEntrances`只统计52个ChiPlot入口，自然地理数据许可证链接不计为图表入口。圆点二值对应 `binary_plot.html`，方格二值对应 `binary_plot2.html`；富集点/柱同源入口，三树布局同源tvBOT入口。JSON顶层 `sourceMapping` 保留52→55映射。

每份输入报告在 `sourceManifests` 中记录SHA，图片记录输出SHA与源SVG SHA。若重跑浏览器生成新SVG，必须同步刷新导出矩阵再刷新索引；只改文字/UUID也不应静默当作同字节来源。索引不修改研究生成器、原站事实或生产发布状态。
