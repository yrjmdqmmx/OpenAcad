# ChiPlot 与原视频研究档案

本档案是研究证据，不是 OpenAcad 功能通过声明。日期为 2026-09-06。

- `index.html`：可离线筛选的完整对照表；预览图链接读取原站公开资源，仅用于研究。
- `comparison.csv` / `comparison.json`：52 个唯一绘图入口、54 张卡对应的字段、文件角色、专有样式、统计边界、导出和项目证据。
- `catalog-evidence.json`：去重目录、公开脚本位置和原目录预览 URL。部分卡有多幅轮播预览，所以预览 URL 总数不等于卡片数。
- `source-examples.json`：公开脚本直接引用的示例 URL 和脚本 SHA-256。没有把公共解析器能力直接当作逐图操作通过。
- `example-access-check.json`：57 个不同示例文件的 HTTP 检查，均返回 200；入口 404 的柱线图没有伪造示例。
- `tree-layers.csv` / `tree-layers.json`：29 种注释 × 3 布局。原站支持、OpenAcad 约定和验收状态分列。
- `special-source-details.json`：矩阵、关系、生信的补充来源定位与明确待核实项。
- `video-and-site-study.pdf`：最初的视频与网站深度研究报告。视频为用户提供的 `AepFg2Tqzw##1.mp4`，通过关键帧、屏幕文字和语音转录交叉检查。报告是当时的研究快照；之后的逐图代码核查补充了目录与算法细节，发生差异时以本目录逐图证据为准。
- `initial-claim-ledger.json`：早期报告主张与来源的定位记录。

C 表示代码检查，D 表示官方文档，O 表示实际操作。HTTP 可达不证明编辑成功，代码有分支不证明文件能够打开。尚未操作的原站格式、控件和项目往返继续标“待核实”，不会用 OpenAcad 自己的实现倒推原站能力。

OpenAcad 的模板和模拟数据独立制作，没有将原站预览图片、示例研究数据或源代码加入生产模板。相关许可见项目数据来源文件。

在任意检出目录运行 `python3 docs/research/build_catalog.py` 可从已保存的目录元数据和示例证据重建 HTML/CSV/JSON，并同步到 `web/public/research/`。无需访问前一会话的绝对路径。原视频较大且由用户提供，不放入代码仓库。
