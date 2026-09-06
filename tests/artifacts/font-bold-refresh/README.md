# 真实常规体与粗体的本地导出复核

这里保存独立本地容器的导出证据，不代表生产服务器已更新。没有重写此前的默认、复杂图层或树枝线报告，也没有改动它们的源 SVG。

最终通过的一轮位于 **`normalized-weight/`**，结论见该目录的 `verification-summary.json`，`passed: true`。默认图、复杂图层、树枝线分别是 55 × 3 = 165、15 × 3 = 45、16 × 3 = 48 份文件；报告行数、唯一路径数和实际文件数分别完全相等，共 258 份。每一份均重新经真实队列导出、独立打开且无页面触边，没有复用第一轮输出。86 个 PDF 均实际包含 Noto Bold 字体资源；37 份含 650 的源图在归一化后 PNG 像素改变，另外 49 份图的 PNG 像素与第一轮完全相同。逐文件结果在各组的 `export-matrix.json`、`pdf-font-resources.json` 与 `png-normalization-comparison.json` 中。

最终一轮使用相同的四份冻结 OTF，以及同一镜像上的只读导出模块覆盖；实际模块 SHA-256 为 `99eb7d3cac5a3e3008b5b481e652a0ab074e880e3b0c4dd107979ba1a94e8ec5`。`normalized-weight/run-provenance.json` 明确记录基础镜像身份、覆盖文件 SHA、实际字体匹配和命令；这不是声称该基础镜像本身已经包含新模块，也不是最终 CI 或生产镜像验证。

第一轮位于 `default/`、`advanced/`、`tree-branch/`：55、15、16 份历史 SVG 共重新转换 258 个 PNG/PDF/EPS；没有复用此前的常规体输出。四份 OTF 的 SHA-256 与实际 `fc-match` 结果保存在 `run-provenance.json`。三组源 SVG 是原始文件的字节相同副本，保留与旧报告一致的 `sourceSha256`。

第一轮独立解析全部通过、没有页面触边，但**字体验收未通过**：37 份源 SVG 使用数值字重 650；Inkscape 1.2.2 即使安装真实粗体，也仍按常规体解释此值。`inkscape-650-findings.json` 记录受影响来源；`verification-summary.json` 另记录其中 28 个 PDF 完全缺少真实粗体字体资源。其余文件含其他粗体文本，不能仅根据 PDF 中存在 Bold 字体资源推断标题正确。此轮作为发现缺陷的历史证据保留。

转换使用仓库原有 `server/scripts/export_matrix.py`，通过独立 API、Redis、RQ 与 Inkscape 完成。PNG、PDF、EPS 分别由 Pillow、Poppler、Ghostscript 独立打开。`verify_evidence.py` 检查报告行数、唯一文件路径、实际文件数、输入输出 SHA、四字体身份、旧证据不变、页面边界和 PDF 字体资源；有意斜体产生的 Cairo 合成字体单独记录，不自动认作缺失粗体。

本目录尚不替代原有浏览器几何、数据、交互和项目保存测试。粗细轮廓及像素的专项对照由 `tests/artifacts/font-weight-export/` 单独记录。

复核最终静态证据（需要 Pillow 与 `pdffonts`）：

```sh
python3 tests/artifacts/font-bold-refresh/verify_evidence.py --run-directory tests/artifacts/font-bold-refresh/normalized-weight
```

代码审查和人工打开抽查包括柱状图、环形树、圈形聚类热图。圈形聚类热图的第二轮标题已显示真实粗体，PDF 同时嵌入 Regular 与 Bold。逐项独立解码不等同于对 258 个文件逐一人工视觉检查。
