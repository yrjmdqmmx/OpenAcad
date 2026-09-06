# 最终字体交付：真实粗体与明确披露的派生斜体

网页和服务端使用八个对应字体面：两种 Noto CJK 字体 × 400/700 × 正体/斜体。正体为固定官方 Regular/Bold；斜体为 OpenAcad 从同源 OTF 制作的 12° Oblique 派生面，PostScript 名有 `OpenAcad` 前缀，不冒充官方 Italic。原版权和 OFL 1.1 保留。派生器没有安装全局字体，也没有逐字改写原始轮廓程序。

`scripts/build-oblique-fonts.py` 通过 CFF FontMatrix 执行右倾，逐一验证四面各 65,535 个原始字形程序、完整 cmap/UVS、hmtx/vmtx 不变。固定字体版本、原始及派生 SHA、方法和验证结果见 `server/fonts/oblique-derivation.json`。CFF 按固定 fontTools 的八位有效数字保存矩阵；序列化的 shear 元素为 `0.00021255656`。浏览器与服务端使用完全相同的序列化矩阵。

`subset-verification.json` 记录八面共 368 个 WOFF2 分片的完整验证：每个黑体面 44,810 个 Unicode 码点，每个宋体面 44,777 个，各 25 个 variation sequence 均保留；共检查 517,072 个按字体面计数的保留字形，轮廓、metrics、覆盖、重复范围均无不一致。

`font-metadata-verification.json` 对同一批 368 个固定 SHA 追加检查有效 CFF 顶层矩阵、CID FD 无额外覆盖矩阵、OS/2/head 斜体标志、post/CFF 角度、真实字重和精确 PostScript 身份。该补充检查不重复已经完成的逐字形验证；每片 SHA 均与前一项一致。可复现为 `scripts/build-webfonts.py --check-metadata --workers 4`；完整验证使用 `--check --workers 4`。

`browser-report.json` 为最终真实 Chrome 的 16 个案例：两字体 × 两字重 × 正体/斜体 × 常用中文/罕见字 `𠮷`。实际 SVG 字重与风格、FontFaceSet 加载和 CDP 实际字形平台字体均通过；八种精确 PostScript 名全部命中，没有系统字体替代。粗体与正体、斜体与正体截图均有实际变化。16 张 PNG 与相应 SVG 均保留。

网络设置为缓存关闭、80 ms 延迟、160 KiB/s 下载；整个运行 76.218 秒，含开发服务器页面脚本和顺序切换。共请求 22 个 WOFF2、4,413,008 字节，没有整份 OTF 请求，没有页面错误。各案例不是独立冷启动，不能把单个切换时间外推为网站冷加载指标。

`typography-browser.json` 是独立编辑器回归：1 项通过，含四个字体/字重组合的关闭、开启、关闭共 12 个状态，实际测试耗时 4.1 秒。每个状态先等当前完整 font descriptor 和文本所需的 style/weight 字体面 loaded，再比较同一固定屏幕裁片；开启斜体像素变化，关闭后精确恢复。测试源为 `web/e2e/typography.spec.ts`，没有只检查 SVG 属性或把字体尚未加载的合成倾斜算为成功。

服务端另有独立 Inkscape/FreeType 的四个斜体面实际 SVG、PNG、PDF 验证，以及两个复杂编辑器场景的保存重开和四格式下载。其证据由对应验收记录索引；本目录的浏览器字体命中不替代图片文件独立打开验证。早期 `font-italic-before` / `font-italic-after` 记录保留作为发现问题与中间修复的历史证据，最终实现使用这里记录的真实派生字体面。
