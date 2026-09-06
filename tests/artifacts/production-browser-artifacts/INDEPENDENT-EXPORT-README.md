# 线上实际下载文件独立复核

本次只复核 `live-exports/` 中桌面和手机各 4 个实际下载文件；未提交新任务，未改原文件、产品源码或其他证据。源发行 `01c5d87a6f36263b236bd964d70996d25635a907`，原始 SHA 对照同目录 `manifest.json`。

8/8 文件可独立打开，SHA 全部匹配。SVG 为 960×640 px；PNG 为 1500×1000 px（150 DPI）；PDF 为一页 720×480 pt；EPS 的 BoundingBox 为 `0 1 720 481`（页面宽高 720×480 pt）。SVG/PDF/EPS 按 96 DPI 独立渲染为 960×640 px。非白色可见墨迹均未触及页面边界，视觉检查未见明显裁切或缺字框。桌面、手机逐格式预览的字节 SHA 相同。

- SVG：Google Chrome 152.0.7977.76 直接打开本地文件，无外网请求、页面错误；69 个路径、0 个文本元素、0 个嵌入图像，文字已转曲。
- PNG：冻结的 `server/scripts/production_smoke.py` 中 `png_check` 验证文件签名、块 CRC、zlib 数据、行过滤、真实像素和墨迹边界。
- PDF：Poppler 26.08.0 的 `pdfinfo`、`pdffonts`、`pdftotext`、`pdftoppm`；两种实际字体资源均已嵌入，其中包括 Noto Serif CJK SC 与 Cairo 生成的字体资源。
- EPS：Ghostscript 10.07.1，使用 `-dSAFER -dBATCH -dNOPAUSE -sDEVICE=pngalpha -r96 -dEPSCrop` 独立解码。

实际限制：PDF 标题比其他三种预览更粗，不能声称四种格式字重完全一致。PDF 复制文字包含部分兼容部首码位（如 `⽂`）；对预期文字和提取文字同做 Unicode NFKC 规范化后标题一致。EPS 包含一张 Cairo 栅格图，保留中文外观但不具备全文字/图形可编辑的纯矢量性质。PNG 不能从文件本身反推出字体身份。边缘检查与本次视觉检查不等于所有数据、所有模板都绝无内部裁切。

PDF 首次文本断言仅对实际值做 NFKC，而预期值仍含全角冒号，造成检查器假阴性；已对两边采用同一规范化方法，原文件未改。修正与初始断言信息保留在 JSON 中。

详细逐文件 SHA、解码工具、尺寸、字体清单、墨迹边界和限制见 `independent-export-verification.json`，6 份独立 SVG/PDF/EPS 预览见 `independent-previews/`；PNG 直接检查原下载文件。
