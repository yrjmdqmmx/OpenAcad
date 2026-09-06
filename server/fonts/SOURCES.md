中文字体来自 notofonts/noto-cjk 官方仓库，SIL OFL 1.1，见 OFL.txt。以下四份原始 OTF 加上四份 OpenAcad 派生 Oblique OTF 同时作为服务端字体和网页 WOFF2 分片的源文件；SHA-256 见 manifest.json。网页分片字节与 OTF 不同，其覆盖、字形和 metrics 逐字校验。

- 黑体版本 2.004：[Regular 400](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf)、[Bold 700](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf)。
- 宋体版本 2.003：[Regular 400](https://github.com/notofonts/noto-cjk/blob/Serif2.003/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf)、[Bold 700](https://github.com/notofonts/noto-cjk/blob/Serif2.003/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Bold.otf)。

容器字体配置屏蔽 apt 的旧 CJK TTC，使用这八份完整 OTF。400 与 700 均有真实字体面；导出加粗应由 fontconfig 选中 `*-Bold.otf`，不再依靠 Regular 的合成粗体。新增 Bold 的内嵌版本、OS/2 `usWeightClass=700` 和 PostScript 名称均已核对；原两份 Regular 字节未变。不同字重不是同一轮廓，网页各字重应与各自对应的 OTF 比较，不把 Bold 与 Regular 的正常差异当作不一致。

四份派生面由 `scripts/build-oblique-fonts.py` 可复现生成，方法为 CFF 顶层 FontMatrix 的 12° 右倾（不是逐字改写）：

- `OpenAcadNotoSansCJKsc-Oblique.otf` / `OpenAcadNotoSansCJKsc-BoldOblique.otf`
- `OpenAcadNotoSerifCJKsc-Oblique.otf` / `OpenAcadNotoSerifCJKsc-BoldOblique.otf`

它们不是官方 Noto Italic：PostScript/全名字样有 OpenAcad 前缀与 Oblique 标识；家族保留兼容名称以匹配已有项目，斜体与字重的 metadata 真实声明。每面 65,535 个原始字形程序、cmap/UVS、hmtx/vmtx 不变；固定变换矩阵、`post.italicAngle=-12`、斜体位及 caret slope 单独记录。来源、原始及派生 SHA 和全量验证见 [oblique-derivation.json](oblique-derivation.json)。上游版权与 OFL 许可保留，派生字体仍使用 OFL 1.1。没有安装用户全局字体。

网页对应四个 italic WOFF2 面保留相同 CFF 矩阵；独立 FreeType/Inkscape 验证确实使用四个命名派生面，SVG 轮廓与 PNG 像素相对正体改变，PDF 嵌入对应 Oblique/BoldOblique 字体。不要只据 `font-style=italic` 属性或 fontconfig 候选结果推定渲染成功。
