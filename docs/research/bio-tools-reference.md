# ChiBioTools 实际页面研究

记录时间：2026-09-07（Asia/Shanghai）。此记录只描述参考站的观察，与 [OpenAcad 自身验收](../qa/bio-tools-acceptance.md) 分开。研究在实现前进行；没有修改参考站脚本、依赖或数据。

## 入口与实际页面

- [工具列表](https://chiplot.online/static/ChiBioTools/src/index.html)
- [AB1 文件查看器](https://chiplot.online/static/ChiBioTools/src/ab1_file.html)
- [KO 号表转 pathway 信息表](https://chiplot.online/static/ChiBioTools/src/ko2pathwayInfo.html)

列表有两个工具卡片及视频教程/前往按钮。进入实际工具后再检查输入与输出，没有把卡片截图或 HTTP 200 当作功能通过证据。Chrome 开启的翻译会翻译部分界面文字，导出表头和数据库名称仍为原文。

## AB1：可见界面与阻塞

实际页面可见拖放/文件选择区域、Summary、Peak figure、Sequence 与复制入口。页面上未观察到可下载示例或清晰格式说明。

尝试导入公开的 Biopython `3730.ab1` 时，初始化失败；重新加载仍出现 `ReferenceError: Vue is not defined`，堆栈指向 `footerQRCode.js` 中的 `FooterQRCode.createQRCodeApp`，AB1 应用构造未完成。因此本次**未验证**真实 AB1 导入成功、峰图缩放/拖动/定位、序列与质量联动、复制及导出。

公开页面脚本包含向 `/ChiBioTools/getAb1Data` 提交文件、渲染峰图/质量、复制序列的代码。这只是实现线索，不能代替实际操作通过。没有注入 Vue、绕过错误或替换参考站代码。

## KO：实际成功的流程

通过文件选择器导入下面的 UTF-8 TSV。它是本次编排的模拟输入，不含用户科研数据。

```tsv
userID	KO
geneA	K00001
geneB	K00844
geneC	K00001
geneD	K99999
geneE	BAD
geneF
```

最后一行实际上传时在 geneF 后保留制表符，表示 KO 为空。

导入后出现汇总饼图及明细表，显示原始 ID、查询 KO、通路数、三级分类的 ID/名称、KO 名称/描述和 EC 等字段。实际输出 32 行：K00001 在 geneA 与 geneC 各展开 9 行，K00844 在 geneB 展开 14 行。重复 KO 对应的不同原始 ID 分别保留。部分明细包含 `Brite Hierarchies`（例如 `ko04131`），因此不能直接将全部行当作参考 pathway。

`K99999`、`BAD` 和空值未在明细中留下状态行。页面汇总却显示 `Annotated 6 records out of 7 (85.71%)`，与 6 条数据行以及仅 3 条原始行有输出的观察不一致；不据此推定后端计数原因。

表格检索 `K99999` 后没有结果，汇总仍保持原值。随后实际点击导出，下载得到：

| 文件 | 实际检查 | 结果 |
| --- | --- | --- |
| `ko_detail.tsv` | 文件存在，5064 字节；解析表头、行数及原始 ID | 32 条数据，搜索无结果时仍导出全表 |
| `summary.tsv` | 文件存在，420 字节；检查文本内容 | 下载成功 |
| `summary.svg` | 文件存在，5438 字节；检查 SVG 内容 | 下载成功；本次未独立打开渲染验证 |

文件选择阶段遇到浏览器自动化对原生选择器识别失败，切换到原生文件窗口后导入成功；这是操作接口的限制，未记作参考产品导入失败。下载事件等待也未捕获到通知，但下载目录中的真实文件证明下载已发生。

本次没有验证 CSV、Excel、KO 列选择、输入格式纠错、部分网络失败恢复或批量上限；页面也未观察到示例下载和数据库版本/获取时间。以上记为未确认，不能根据未见入口断言产品绝不支持。

## 转化为 OpenAcad 需求

OpenAcad 补充浏览器本地 AB1 解析、真实样例及交互导出；KO 支持粘贴/CSV/TSV/Excel、选择列、保留原字段及所有失败状态，明确一对多展开与去重口径。只使用 KEGG KO 的 PATHWAY 关系，分类取对应 pathway 的 CLASS 字段，不混入 BRITE 或表达为富集分析。

当前 KEGG 实查 K00001 为 8 条、K00844 为 18 条，与参考站输出不同。参考站的数据版本未公开确认，不能将参考站的条数作为 OpenAcad 正确性的判据。OpenAcad 的数据来源、获取时间及独立核验见自身验收记录。
