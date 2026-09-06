# 中文字体来源

Noto Sans CJK SC 与 Noto Serif CJK SC 的 Regular 400、Bold 700 来自 notofonts/noto-cjk 官方仓库，使用 SIL Open Font License 1.1，保留 [OFL.txt](OFL.txt)。四份原始 OTF 保存在源码 `server/fonts/`，并基于它们另生成四份明确标注 OpenAcad 来源的 Oblique 派生面。服务端使用这八份 OTF；网页使用由对应字重与字形风格生成的 WOFF2 子集，不下载整份 OTF。

- 黑体 2.004：[Regular](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf)、[Bold](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf)。
- 宋体 2.003：[Regular](https://github.com/notofonts/noto-cjk/blob/Serif2.003/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf)、[Bold](https://github.com/notofonts/noto-cjk/blob/Serif2.003/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Bold.otf)。

|原始字体|版本|SHA-256|
|---|---|---|
|NotoSansCJKsc-Regular.otf|2.004|`2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b`|
|NotoSerifCJKsc-Regular.otf|2.003|`2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca`|
|NotoSansCJKsc-Bold.otf|2.004|`b5f0d1a190a7f9b43c310a8850630af12553df32c4c050543f9059732d9b4c0a`|
|NotoSerifCJKsc-Bold.otf|2.003|`8af07d4b6c2e82bcc72a30e066eaf295f11b9424f4aad2eaa9fe0e9c3b38fc73`|

每种字体的每个字重和正体/斜体组合分别划分 46 个互不重叠的 `unicode-range` 子集，总计 368 片：拉丁/希腊与组合符号、本站常用文字、其余字符。浏览器只加载文字、字重和正体/斜体实际命中的部分；各面常用分片字节数见清单。罕见字符仍有对应分片，不以仅保留常用汉字缩减原支持范围。每个黑体字重原有 44,810、每个宋体字重原有 44,777 个 Unicode 码点及各 25 个 variation sequence 均保留；原字体本来不含的 Unicode 字符仍需系统字体回退。

生成时按每个字重逐字符检查水平/垂直 metrics 和保留字形的轮廓（含排版替代字形），并保留行高、字体单位与真实 `usWeightClass`。家庭名仍为 `Noto Sans SC` / `Noto Serif CJK SC`，CSS分别声明真实 Regular 400 和 Bold 700，不将 Regular 宣称为可变字体或以描边模拟粗体。字节压缩和子集划分改变文件 SHA，但不改变相应字重已核对的字形与 metrics。

上游没有独立 Italic 面。OpenAcad 用 `scripts/build-oblique-fonts.py` 从这四个固定原始 OTF 派生 12° 右倾的 Oblique 面：CFF 顶层 `FontMatrix=[0.001,0,0.00021255656,0.001,0,0]` 执行倾斜，原 65,535 个字形程序、cmap/UVS、水平/垂直字宽不变；设置对应斜体标志、倾斜角度、光标斜率与命名。PostScript 名称为 `OpenAcadNotoSansCJKsc-Oblique`、`OpenAcadNotoSansCJKsc-BoldOblique`、`OpenAcadNotoSerifCJKsc-Oblique`、`OpenAcadNotoSerifCJKsc-BoldOblique`。这是明确标注的几何派生设计，不是官方 Noto Italic。派生文件仍遵循 OFL 1.1，原版权与许可保留。

CSS 为相同的兼容家庭名声明真实 `font-style: italic`、`font-weight: 400/700` 面；浏览器与服务端均使用相同 12° 派生字形，不依靠各引擎不同的倾斜合成。每个 WOFF2 均校验有效 CFF 顶层矩阵、CID FD 未出现额外矩阵、OS/2/head 斜体标志、固定角度及 OpenAcad PostScript 身份；只比较未变的 glyph pen 轮廓不足以验证 CFF 变换，因此保留浏览器与 Inkscape 的实际像素/转曲证据。源码 `server/fonts/oblique-derivation.json` 记录逐源 SHA 与派生 SHA、全部字形程序和 metrics 检查。

完整分片、原始字节数、校验结果与 SHA 见 [webfont-manifest.json](webfont-manifest.json)。WOFF2 文件名含内容 SHA，适用于不可变缓存。生成与检查脚本为源码 `scripts/build-webfonts.py`；固定工具为 fontTools 4.64.0、Brotli 1.2.0：

```sh
python3 -m venv /tmp/openacad-webfonts
/tmp/openacad-webfonts/bin/pip install -r scripts/font-delivery-requirements.txt
/tmp/openacad-webfonts/bin/python scripts/build-oblique-fonts.py --workers 4
/tmp/openacad-webfonts/bin/python scripts/build-webfonts.py --workers 4
/tmp/openacad-webfonts/bin/python scripts/build-webfonts.py --check
```

从源码仓库根目录运行。Oblique 派生器生成四份单独 OTF 及 SHA 清单；网页生成器只修改 WOFF2、字体 CSS 与清单。两者均不修改四份上游原始 OTF，不安装全局字体。源码文字变化后可重新生成常用分片，完整覆盖验证仍必须通过。

普通 SVG 不自动嵌入网页字体 CSS；需避免接收方缺字体时，使用 SVG 文字转曲或已嵌入字体的 PDF。服务端导出使用上述四份原始 OTF 与四份已披露派生 OTF。

实现依据：[fontTools 子集说明](https://fonttools.readthedocs.io/en/latest/subset/index.html)、[CSS unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range)。
