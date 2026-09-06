# 中文字体来源

Noto Sans CJK SC Regular 与 Noto Serif CJK SC Regular 来自 notofonts/noto-cjk 官方仓库，使用 SIL Open Font License 1.1，保留 [OFL.txt](OFL.txt)。原始 OTF 保存在源码 `server/fonts/`，服务端继续使用这些原文件；网页使用由它们生成的 WOFF2 子集，不再下载整份 OTF。

- https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf
- https://github.com/notofonts/noto-cjk/blob/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf

|原始字体|版本|SHA-256|
|---|---|---|
|NotoSansCJKsc-Regular.otf|2.004|`2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b`|
|NotoSerifCJKsc-Regular.otf|2.003|`2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca`|

每个字体分为 46 个互不重叠的 `unicode-range` 字体面：拉丁/希腊与组合符号、本站常用文字、其余字符。浏览器只加载实际文字命中的部分；常用部分黑体 356,620 字节、宋体 504,644 字节。罕见字符仍有对应分片，不以仅保留常用汉字缩减原支持范围。黑体原有 44,810、宋体原有 44,777 个 Unicode 码点及各 25 个 variation sequence 均保留；原字体本来不含的 Unicode 字符仍需系统字体回退。

生成时逐字符检查水平/垂直 metrics，核对两字体分别 64,682 / 64,586 个保留字形的轮廓（含排版替代字形），并保留行高与字体单位。家庭名仍为 `Noto Sans SC` / `Noto Serif CJK SC`，面为 Regular 400；粗体沿用浏览器合成，不假称可变字体。字节压缩和子集划分改变文件 SHA，但不改变已核对的字形与 metrics。

完整分片、原始字节数、校验结果与 SHA 见 [webfont-manifest.json](webfont-manifest.json)。WOFF2 文件名含内容 SHA，适用于不可变缓存。生成与检查脚本为源码 `scripts/build-webfonts.py`；固定工具为 fontTools 4.64.0、Brotli 1.2.0：

```sh
python3 -m venv /tmp/openacad-webfonts
/tmp/openacad-webfonts/bin/pip install -r scripts/font-delivery-requirements.txt
/tmp/openacad-webfonts/bin/python scripts/build-webfonts.py --workers 4
/tmp/openacad-webfonts/bin/python scripts/build-webfonts.py --check
```

从源码仓库根目录运行。生成器只修改网页 WOFF2、字体 CSS 与清单，不修改原 OTF 或服务端。源码文字变化后可重新生成常用分片，完整覆盖验证仍必须通过。

普通 SVG 不自动嵌入网页字体 CSS；需避免接收方缺字体时，使用 SVG 文字转曲或已嵌入字体的 PDF。服务端导出仍使用上述固定原始 OTF。

实现依据：[fontTools 子集说明](https://fonttools.readthedocs.io/en/latest/subset/index.html)、[CSS unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range)。
