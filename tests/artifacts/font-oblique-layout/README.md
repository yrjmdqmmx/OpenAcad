# 局部斜体与旋转粗斜体的实际界面验收

两个本机 Chromium 界面案例均通过；每个案例实际下载 SVG、PNG、PDF、EPS，共 **8 个文件**。这是一组独立专项，不应把截图数或文件数并入此前全套浏览器测试的通过数，也不代表生产环境已经更新。

- `tree-mixed-italic/`：使用矩形树现有“局部斜体”注释层。`拟南芥` 中 `拟` 保持正常、`南芥` 倾斜；另两叶名局部倾斜，其他叶名保持正常。标签锚点与旋转变换未改变。
- `bar-rotated-bold-italic/`：载入既有复杂柱状图项目，保留断轴、填充纹理、类别注释；通过真实控件启用宋体粗斜体标题、横轴刻度斜体及 35° 旋转。标题居中，刻度与注释分开显示，没有明显裁切。

两案例都验证了正常→斜体像素改变、关闭斜体恢复原像素，以及保存 `.openacad.json` 后在全新浏览器上下文重新打开，图像恢复完全一致。没有伪造 DOM 样式或修改项目文件来代替界面操作。

`browser-report.json` 记录真实控件交互、混合 tspan、已加载字体面、画布边界、项目与下载文件 SHA；`file-verification.json` 记录独立文件打开结果。SVG 选择文字转曲，先经 XML 解析，再以 Chromium 图片解码器单独打开；PNG、PDF、EPS 分别经 Pillow、Poppler、Ghostscript 打开。两份 PDF 实际包含派生 Oblique/BoldOblique 字体资源，没有 Cairo 合成字体。PNG/PDF/EPS 没有页面触边。人工查看了两个网页预览及两份 PNG，局部倾斜、粗斜体标题和旋转刻度均可辨认。

`webfont-assets.json` 保留八面 CSS/manifest 身份，以及浏览器实际请求的 20 个 WOFF2 资源；逐项本机 HTTP 读取的字节 SHA 与字体 manifest 一致。`run-provenance.json` 记录八份后端 OTF、实际 fontconfig 匹配、基础镜像和只读覆盖导出模块 SHA。API 只运行于本机独立网络的 `127.0.0.1:18084`；没有访问线上，也没有改动产品代码。`cleanup.json` 记录临时容器和网络已清理。

复现工具是本目录的 `browser-check.mjs` 与 `verify-files.py`。前者需要八面字体已生成的本机网页与隔离 API，并只使用已有界面；后者读取已保存文件，需要 Pillow、Poppler、Ghostscript。首次生成以外的重复运行应使用新证据目录，避免覆盖既有结果。
