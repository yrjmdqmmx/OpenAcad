# 数据、字体与第三方来源

OpenAcad 模板与示例数据由本工程独立制作。示例中的样本、组别、数量、表达值、节点、序列和统计矩阵均为模拟数据，采用 CC0-1.0；不能作为真实研究发现。模板详情、预览副标题及项目数据来源均明确标注。

- 地图陆地轮廓：Natural Earth，公有领域；下载位置、具体文件和条款记录见 [特殊图数据来源](web/src/templates/special/DATA-SOURCES.md)。
- 中文字体：Noto Sans SC 与 Noto Serif CJK SC，均提供同版本的真实 Regular 400、Bold 700，使用 SIL Open Font License 1.1；官方来源、版本和文件校验值见 [字体记录](web/public/fonts/SOURCES.md)。网页使用由服务端对应字重的原始 OTF 派生的按字符范围加载的 WOFF2 子集，按各字重逐字核对覆盖、字形轮廓与排版 metrics；服务端保留四份原始 OTF，并使用四份明确标注 OpenAcad 的 12° Oblique 派生 OTF；派生面保留原字形程序与字宽，以 CFF FontMatrix 执行倾斜，不冒充官方 Italic。网页具有对应的真实 italic 分片。派生来源、方法、版权许可与逐面 SHA 记录在字体说明中；压缩后的网页字体与 OTF 文件字节不同。
- React、D3、SheetJS、FastAPI、RQ、NumPy、SciPy、scikit-learn、R、ape、vegan、ade4、mgcv、Inkscape 等分别遵循上游许可。包版本锁在 web/package-lock.json、server/requirements.lock、server/r/renv.lock；容器基础镜像也固定摘要。
- ChiPlot 图片、脚本及示例链接仅用于研究证据。生产绘图不使用其源代码、预览图片或科研示例；原站资料的权利仍归相应权利人。
- 用户提供的视频只用于本次研究，不随网站或私有源码仓库分发。研究报告保留视频观察的证据边界。

`.openacad.json` 保存用户自己的数据与样式；上传统计任务不会改变数据所有权。本项目不建立用户数据长期公开库。
