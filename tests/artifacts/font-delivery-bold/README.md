# 真实 Regular/Bold 字体专项（1.0.2）

修复原因：只有 Regular OTF 时，浏览器/PDF 的合成粗体与 SVG 转曲、PNG、EPS 不一致。现在为黑体和宋体各提供真实400/700字体面；不通过描边模拟Bold。既有1.0.1字体记录保留，不把仅验证family命中当作700字重通过。

## 来源与字重

Sans 为官方 Sans2.004，Serif 为 Serif2.003。两个新增 Bold 原OTF的name版本、PostScriptName-Bold和OS/2 usWeightClass=700均核对；两Regular原文件未改变。SHA与许可在 server/fonts/manifest.json、server/fonts/SOURCES.md。没有向用户全局安装字体。

## 逐字校验

|字体面|码点|UVS|轮廓字形数|常用分片字节|结果|
|---|---:|---:|---:|---:|---|
|Noto Sans SC / 400|44810|25|64682|356,620|完整覆盖、0重叠、0轮廓/metrics差异|
|Noto Serif CJK SC / 400|44777|25|64586|504,644|完整覆盖、0重叠、0轮廓/metrics差异|
|Noto Sans SC / 700|44810|25|64682|363,868|完整覆盖、0重叠、0轮廓/metrics差异|
|Noto Serif CJK SC / 700|44777|25|64586|518,944|完整覆盖、0重叠、0轮廓/metrics差异|

每个真实字体面46片，总计184片；各片OS/2字重与CSS声明一致。hmtx、vmtx、行高和unitsPerEm与对应字重OTF匹配。184个CSS引用及文件SHA核对通过；保留的原有92份Regular WOFF2字节没有改变。证据 subset-verification.json 和 web/public/fonts/webfont-manifest.json。

## 实际浏览器

Chrome 152.0.7977.76，网络缓存关闭、80ms延迟/160KiB每秒，8个场景全部通过：两家庭 × 400/700 × 常用中文/𠮷。通过真实“标题粗体”开关改变项目样式，检查实际SVG computed fontWeight，再按该SVG的完整computed字体描述与文字调用FontFaceSet.load/check。Chrome CSS.getPlatformFontsForNode明确返回Regular或Bold的PostScript名称，禁止只检查family或系统回退。

|家庭|控件字重|文字|实际PostScript面|
|---|---:|---|---|
|Noto Sans SC|400|中文科研图表|NotoSansCJKsc-Regular|
|Noto Sans SC|400|𠮷|NotoSansCJKsc-Regular|
|Noto Sans SC|700|中文科研图表|NotoSansCJKsc-Bold|
|Noto Sans SC|700|𠮷|NotoSansCJKsc-Bold|
|Noto Serif CJK SC|400|中文科研图表|NotoSerifCJKsc-Regular|
|Noto Serif CJK SC|400|𠮷|NotoSerifCJKsc-Regular|
|Noto Serif CJK SC|700|中文科研图表|NotoSerifCJKsc-Bold|
|Noto Serif CJK SC|700|𠮷|NotoSerifCJKsc-Bold|

本次共14个WOFF2请求、2,552,468字节；完整OTF请求0、页面错误0。切换family/weight时前一文字可能提前请求对应稀有分片，单次操作时间不是互相独立的冷首载；总运行还包含Vite开发模块下载。

每对400/700实际标题截图SHA均不同，已人工查看宋体常用标题截图确认笔画变粗。八份实际SVG和对应标题PNG在本目录。旧版只检查CustomFont family，无法证明真实Bold；本版必须校验具体PostScriptName后缀和SVG字重。

复现：本地网页运行后，仓库根目录执行 `node scripts/verify-webfonts.mjs`。默认报告目录为 tests/artifacts/font-delivery-bold，可用 OPENACAD_FONT_REPORT_DIR覆盖。字体生成及全量校验使用 scripts/build-webfonts.py / scripts/font-delivery-requirements.txt。

## 导出证据边界

后端独立同事已用四份冻结OTF完成真实Inkscape复核，具名Bold PDF、不同400/700 SVG路径和PNG笔画墨量均通过；具体原始记录见 tests/artifacts/font-weight-export。258个既有SVG的三格式重导出由另一专项负责，结果另存 tests/artifacts/font-bold-refresh，不与本8个浏览器字体场景混算。
