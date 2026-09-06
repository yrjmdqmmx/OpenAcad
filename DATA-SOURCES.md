# 数据、字体与第三方来源

OpenAcad 模板与示例数据由本工程独立制作。示例中的样本、组别、数量、表达值、节点、序列和统计矩阵均为模拟数据，采用 CC0-1.0；不能作为真实研究发现。模板详情、预览副标题及项目数据来源均明确标注。

- 地图陆地轮廓：Natural Earth，公有领域；下载位置、具体文件和条款记录见 [特殊图数据来源](web/src/templates/special/DATA-SOURCES.md)。
- 中文字体：Noto Sans SC 与 Noto Serif CJK SC，SIL Open Font License 1.1；官方来源、版本和文件校验值见 [字体记录](web/public/fonts/SOURCES.md)。浏览器与服务器使用同字节文件。
- React、D3、SheetJS、FastAPI、RQ、NumPy、SciPy、scikit-learn、R、ape、vegan、ade4、mgcv、Inkscape 等分别遵循上游许可。包版本锁在 web/package-lock.json、server/requirements.lock、server/r/renv.lock；容器基础镜像也固定摘要。
- ChiPlot 图片、脚本及示例链接仅用于研究证据。生产绘图不使用其源代码、预览图片或科研示例；原站资料的权利仍归相应权利人。
- 用户提供的视频只用于本次研究，不随网站或私有源码仓库分发。研究报告保留视频观察的证据边界。

`.openacad.json` 保存用户自己的数据与样式；上传统计任务不会改变数据所有权。本项目不建立用户数据长期公开库。
