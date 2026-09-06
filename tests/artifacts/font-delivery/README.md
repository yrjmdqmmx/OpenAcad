# 网页字体交付专项

网页按 unicode-range 使用原 OTF 派生的 WOFF2，每种46片，共92片；原 OTF 仅保留于 server/fonts，服务端未修改。文件名包含内容SHA，已有一年 immutable 缓存不会误用同名新字库。

## 覆盖与等价性

|字体|原/当前Unicode码点|变体序列|轮廓核对字形|常用分片字节|差异|
|---|---:|---:|---:|---:|---|
|Noto Sans SC|44810/44810|25|64682|356,620|0丢失、重叠、轮廓或metrics差异|
|Noto Serif CJK SC|44777/44777|25|64586|504,644|0丢失、重叠、轮廓或metrics差异|

校验包含原始 cmap、25个variation sequences、每个编码字形的水平/垂直metrics、行高与unitsPerEm，以及GSUB等保留字形的轮廓和metrics。92个CSS引用和文件SHA均核对；再次生成黑体Latin分片得到相同SHA和文件名。完整记录见 subset-verification.json、web/public/fonts/webfont-manifest.json。

## 实际浏览器

Chrome 152.0.7977.76，关闭网络缓存、80ms延迟、下载160KiB/s。四次操作均用FontFaceSet.load/check等待实际文字，再通过Chrome CSS.getPlatformFontsForNode验证实际SVG文本命中isCustomFont=true的Noto字体；其中𠮷为U+20BB7，原字体和对应稀有分片均覆盖。

两种字体共请求8个WOFF2：常用部分合计861,264字节，加两个稀有字分片合计1,401,580字节。完整OTF请求0，页面错误0。切换操作包含先前文本所需分片，因此各操作时间不是互相独立的字体冷首载基准；不能把后一次已预取的宋体𠮷耗时宣称冷加载。整个弱网运行还包括Vite开发模块冷下载，不能当作生产首屏速度。

普通中文和罕见字在实际SVG上均确认使用网页字体，没有以系统回退冒充成功。截图 rare-serif.png，四次操作和全部请求见 browser-report.json。

复现：在本地网页运行时从仓库根目录执行 `node scripts/verify-webfonts.mjs`；可设置 OPENACAD_BASE_URL 指向同源测试站点。脚本不提交统计/导出任务，不操作服务器。生成器与固定依赖见 scripts/build-webfonts.py / scripts/font-delivery-requirements.txt；来源和许可见 web/public/fonts/SOURCES.md。

配套导出/取消四项浏览器专项由另一子代理执行并已在新WOFF2/CSS下通过；本报告不把它们加入本四次字体命中计数。
