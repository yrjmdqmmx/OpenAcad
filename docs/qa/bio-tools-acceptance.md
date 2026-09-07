# OpenAcad 生物信息学工具本地验收

日期：2026-09-07（Asia/Shanghai）。工作目录 `/Users/a1-6/Documents/ChatGPT/OpenAcad`，分支 `codex/platform-home`，基线提交 `4fc8d1215e87ce9194ee25c0e8dea75ef7169897`；验收对象包含当前未提交改动，不能称为该提交已具备新功能。保留交接中首页、轮播、目录等未提交工作；没有修改 PaperBanana/Tensor Auto，也没有发布。

[参考站研究](../research/bio-tools-reference.md) 与本记录独立；[使用及启动说明](../bio-tools.md)。

## 数据与数值核验

AB1 使用 Biopython 固定提交 `ae8435837a47e26b5b3456a5bbd06d24870e464a` 的四份原始文件。通过独立安装的 Biopython 1.87 读取完整序列、质量数组、PLOC2、FWO_1 和 DATA9–12，再由前端测试逐项比较，四通道使用完整数组序列化 SHA-256 比较。测试不是比较本解析器生成的预期值。

| 真实样本 | 碱基数 | 核对结果 |
| --- | ---: | --- |
| 3730.ab1 | 1165 | 序列、全部质量/位置、通道全数组哈希、样本名称一致 |
| 310.ab1 | 868 | 同上 |
| 3100.ab1 | 795 | 同上 |
| empty.ab1 | 5 | 同上；文件名不代表没有碱基 |

3730 样例第 100 位（1-based）为 G，Q50，PLOC=1279，四通道 A=0、C=19、G=651、T=0。浏览器定位后与独立解析数据一致。变更 FWO_ 的测试确认通道映射来自文件，不硬编码 GATC。校验值和来源见 [样例说明](../../web/public/examples/bio/README.md)。

KO 来源为 KEGG REST 的原始文本及真实 API 查询，不以 ChiBioTools 的条数作正确性基准。2026-09-07T11:24:27Z 获取的 K00001 有 8 条 PATHWAY、K00844 有 18 条、K99999 未返回条目；其中两项都包含 `map00010 / Glycolysis / Gluconeogenesis`，分类实查为 `Metabolism; Carbohydrate metabolism`。后续测试命中缓存时仍保留此次真实时间。

模拟 TSV 示例 7 条原始数据行，3 个不同有效 KO，2 匹配、1 未匹配、1 无效项、1 空值行。结果展开 63 行；K00001 同行重复去除、跨行分别保留，同格多个 KO 分别展开。模拟数据明确标注，在线匹配不是模拟服务。网络失败、缺字段、无 PATHWAY 等故障注入测试与真实查询单独记录。

## 实际操作

| 范围 | 通过项 | 证据 |
| --- | --- | --- |
| AB1 导入 | 本机真实文件、内置真实样例、损坏文件保留上一份成功记录、质量缺失中文提示 | 四浏览器实际文件输入；单测另覆盖偏移越界、版本、签名、位置/通道缺失等 |
| AB1 交互 | 窗口缩放、位置 100/101 定位、碱基/质量柱/峰图联动、鼠标拖动、滑块/前后移动 | DOM 数值和选中标记；Chrome 人工操作复核 |
| 手机操作 | 390px 与 320px 不产生整页横向溢出；峰图保留竖向页面滚动 | iPhone 尺寸 WebKit、Chrome 窄屏；Chromium 原生触摸横向平移与纵向滚动测试 |
| AB1 导出 | 复制完整 1165 碱基、FASTA 完整一致、真实 SVG/PNG 下载 | FASTA 逐字符核对；SVG 4 通道及无 NaN；PNG 文件头/尺寸；独立打开桌面和手机 PNG 看见文字、四色曲线和质量柱 |
| KO 输入 | 粘贴、带引号 CSV、TSV、Excel 多工作表、KO 列选择、中文与原始数字保留 | 实际浏览器导入与数据断言 |
| KO 状态 | 一对多、跨行重复、同格去重、空值、无效、未匹配、部分失败、停止后重试 | 原始行/原字段及统计断言；只重试失败/待查询项，保留成功数据 |
| KO 结果 | 状态筛选、全文检索、分页、CSV/Excel 下载并重新解析 | 筛选后全行导出；Excel「来源与规则」；CSV 原字段/来源列 |
| 数据来源 | 四浏览器配置下实查 KEGG、已知关系与名称/分类、逐条获取时间 | 在线用例无 mock，保存实际 Excel 和 API 响应 |
| 项目兼容 | 原有模板、工作台操作、项目保存/重开及分析结果保留 | 全量浏览器回归和真实统计回归；未改 schema/计算白名单 |

## 命令与结果

所有浏览器命令从 `web/` 运行，产物使用独立 `/tmp/openacad-bio-*` 目录，最终复制到下方证据目录。旧测试会改写的 `tests/artifacts` 产物已保留到独立目录，再恢复到本次开始时的干净状态，没有覆盖交接工作。

| 验证 | 命令 | 结果 |
| --- | --- | --- |
| 前端单测 | 根目录 `npm --prefix web test -- --reporter=dot` | 11 文件，332 通过；新生信测试 18 项 |
| 构建 | 根目录 `npm --prefix web run build` | TypeScript + Vite 通过；仍有既有主包超过 500 KB 的提示；生信独立 JS 约 37.65 KB |
| 后端定向回归 | server 中 `.venv/bin/python -m pytest tests/test_bio.py tests/test_api.py -q -p no:cacheprovider` | 13 通过（新生信 10 + 原 API 3）；2 条依赖弃用警告 |
| 全量浏览器 | `npm run test:browser -- --output=/tmp/openacad-bio-full-browser-final --reporter=list` | 131 通过，233 跳过，0 失败 |
| 生信四浏览器含真实 KEGG | `OPENACAD_LIVE_API=1 npm run test:browser -- e2e/bio-tools.spec.ts --output=/tmp/openacad-bio-final-browser --reporter=list` | 25 通过，3 跳过，0 失败；跳过为非 Chromium 的原生触摸用例 |
| 真实统计与既有导出 | `OPENACAD_LIVE_API=1 npm run test:browser -- e2e/live-analysis.spec.ts e2e/live-export.spec.ts --project=chromium --project=mobile --output=/tmp/openacad-bio-live-regression --reporter=list` | 13 通过，5 跳过，0 失败；5 个统计计算 + 桌面/手机各 4 种导出；手机重复统计按既有条件跳过 |

全量浏览器的 233 个跳过：模板在非 Chromium 配置跳过 165；未设置 LIVE 时统计/导出/KO 在线用例 40；字体用例在非 Chromium 15；两组 Chromium 原生触摸的其他配置 6；排序编辑器/性能的其他配置 6；排版的条件跳过 1。真实统计运行前健康接口确认 18082 服务有 1 个 worker，因此没有把缺 worker 当作通过。

首次全量运行 129 通过/230 跳过/1 失败，失败为既有首页自动轮播计时测试。单独重复复现后，固定加载完成后的测试时钟并通过悬停/离开重设计时起点，保留三秒/悬停/恢复断言，未改轮播产品实现；随后全量通过。测试开发中修复精确可访问名称、搜索覆盖原表字段的预期和 Node 测试文件位置问题；最终成功结果见上表。

## 本地证据

证据目录：`/Users/a1-6/.codex/visualizations/2026/09/07/01a07b8c-3b6b-7933-bd37-98cf07283e3c/bio-acceptance/`。

- `bio-browser/`：各浏览器 AB1 页面截图、真实下载 SVG/PNG/FASTA、KO 页面截图、CSV/XLSX 及在线 XLSX。
- `kegg-live-api-response.json`、`ko-real.txt`、`map00010.txt`：公开 KEGG 响应及获取记录。
- `live-regression/`：真实统计/原有导出用例输出。
- `openacad-bio-*.log`：前端单测、构建、全量与生信/真实服务浏览器运行输出。
- `reference/`：参考站本次模拟输入及三个实际下载文件；与本地产品证据分开。

## 未覆盖及剩余限制

- 参考站 AB1 被其 Vue 初始化错误阻塞；不声称参考站 AB1 操作通过。参考 KO 的数据版本、其他导入格式与故障恢复未确认。
- 本地四份仪器文件不能代表所有历史/厂商 ABIF 变体；不支持无碱基识别结果的 fragment 文件，不进行新一轮 base calling、变异判定或序列编辑。
- 手机为尺寸模拟和原生触摸输入验收，未用实体手机；CSV/TSV 使用 UTF-8，历史编码 XLS 与加密工作簿未全面覆盖。
- KEGG 依赖外网及来源使用条件。没有固定完整数据库快照；缓存有最多 6 小时延迟。单进程限速已验证，多进程/生产集群限速未验收。
- 生信数据仅保留当前页面会话，不纳入绘图 `.openacad.json`；刷新前需要导出。
- 本次没有新增 CI 执行、Linux 镜像/性能压测、远程提交、部署或生产可用性验证。
