# 生信样例来源

获取日期：2026-09-07。

## AB1 真实数据

以下文件来自 Biopython 公开测试集，保留原始二进制，非 OpenAcad 模拟峰图。

固定提交：`ae8435837a47e26b5b3456a5bbd06d24870e464a`。

[源目录](https://github.com/biopython/biopython/tree/ae8435837a47e26b5b3456a5bbd06d24870e464a/Tests/Abi)；项目许可证见同目录 `BIOPYTHON-LICENSE.rst`。

| 文件 | 碱基数 | SHA-256 |
| --- | ---: | --- |
| [3730.ab1](3730.ab1) | 1165 | `e4663e4db40232576ccdda5b878dddb01ef80a3d1b032941ba053146ce53f77b` |
| [310.ab1](310.ab1) | 868 | `0a395d39520d24a89af4c77dd55fd7fb632e732a6da807ceb6ead0c2465cb887` |
| [3100.ab1](3100.ab1) | 795 | `78588d824dd967a1e58a9667a8f7ca1687ba38266420bbc5a6562c1893888efd` |
| [empty.ab1](empty.ab1) | 5 | `c56a89d25ff8dde424ca3f6e177655dd16fe34322563ace3956b66f897172e85` |

`empty.ab1` 是上游文件名，实际含 5 个碱基，不能用文件名推断内容为空。

完整序列、PCON2、PLOC2 和 DATA9–12 通道摘要通过独立 Biopython 1.87 读取，基准保存在 `web/src/bio/__fixtures__/biopython-golden.json`，由 Vitest 对全数组与通道哈希核对。没有将 OpenAcad 解析结果写回作为基准。

## KO 模拟输入

`ko-example.tsv` 由 OpenAcad 手工编排。基因 ID 与备注是模拟数据，包括 K00001、K00844、一对多、跨行重复、同格重复、K99999、BAD 与空值。转换关系通过 KEGG 实时获取，不是内置模拟匹配结果。

示例不含用户私人科研数据。
