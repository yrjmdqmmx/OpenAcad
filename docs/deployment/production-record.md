# OpenAcad 正式发布记录

状态：**2026-09-08（北京时间），1.1.0 已更新至前后端 `3d772df`，首页五张科研实景截图已同步新版工作台，PR #2 已合并；公网版本、桌面/手机逐张操作及核心计算/导出复验通过。** 下方历史记录不改写为本次证据。


## 1.1.0 首页科研实景截图同步（3d772df）

依据用户“更新替换”执行。首页轮播此前沿用旧版静态截图；本批从已上线的期刊绘图质量版本 `b04a48c` 的真实工作台重新截取分组柱状图、热图、火山图、桑基图和环形进化树，替换全部 5 张 JPEG，保留 1710×838 画幅及模拟数据标注。图片、图片点击与“查看大图”使用同一带 `?v=journal-20260908` 的地址，使刷新后的首页请求新版图片。对应模板入口仍进入实际可编辑工作台。

- 固定运行源码：`3d772df87508db902c95ac859705a5227bdc7049`；[PR #2](https://github.com/yrjmdqmmx/OpenAcad/pull/2) 合并提交 `58e6eae51586ed35826e44d9b90a56070ba497cb`，两者 Git 树同为 `16f41cd7e9f52bfd334b051ff4d94f62c9608b5e`。应用版本保持 1.1.0，发行目录 `/opt/openacad/releases/1.1.0-3d772df`。
- [固定源码 CI 34214702382](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34214702382) 全部成功：467 前端单测、238 浏览器用例、196 后端测试和 13 恢复流程回归通过；542 浏览器用例按配置跳过，0 失败/不稳定。[PR CI 34214749485](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34214749485) 和[合并 CI 34216862755](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34216862755) 均成功，自动代码审查未提出问题。
- 本地首页/轮播专项为 Chromium、Firefox、WebKit 和手机配置合计 29 通过、3 项按配置跳过。正式站 1440×1000 与 390×844 分别逐张核对：10 次图片 SHA 均与新工作台原始截图一致，大图能打开，模板入口与可编辑图匹配，无页面错误或横向溢出。手机为浏览器模拟，未验实体手机。
- 正式站额外双并发首页/轮播回归为 15 通过、14 失败、3 跳过，不能记为完整通过。失败集中于 45 秒页面加载或 10 秒图片加载等待；trace 中相关资源返回 200，但脚本和多份字体分片接收耗时较长。已保留失败截图和网络记录，作为冷启动加载性能风险；随后以单并发、120 秒整体用例上限复验 Chromium、Firefox、WebKit 和手机配置的逐张切换，4 项全部通过（图片及交互断言保持不变）。这项复验确认了操作功能，未消除并发冷启动加载较慢的风险。
- 新版生产实际完成 PCA、R LM 与 PNG/PDF/EPS 五个模拟任务，独立数值与文件打开检查全部通过，临时任务已清理。2026-09-08 19:02 的公网核对确认完整 `3d772df` 源码、两个健康 worker，维护标记已解除。
- `server/` Git 树仍为 `13f1f45552b56a73f52c0452ddf527ec19c2f71d`，但 CI 重建镜像的配置摘要与 11 个层摘要变化，因此依照既有发行规则使用本次新镜像。实际标签 `openacad-worker:1.1.0-3d772df`，Linux amd64；CI config digest `sha256:090fa221285d1b6b9d4b7b3ab07cb6537536ccc8b644bd343048175fc2ce96bd`，实际 OCI 根 `sha256:a270e2a3b16af6d08f79e9c493727074ef7f26d36bbd994697db1c535f1092ce`。56 个归档成员、全部 RootFS 层及运行 Config 均通过加载核验。
- 网页附件 `10051989294` 为 282407416 字节，SHA `08b78ec7e1ab2e1f05d3ef70d13d0a1b1624422fb422461398f06aab69dc3753` 与 GitHub 一致。398 个实际网页文件全部核对，其中 389 个按内容 SHA 复用，9 个替换；传输包 1143194 字节，SHA `43d46b5a5218ee3346446b39122036d8dda6fc91d8e03bcc15cf09070c24f23d`。389 个公共源码文件及 368 字体分片与固定源码匹配。
- [镜像增量运行 34216606165](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34216606165) 完整成功，绑定本次固定源码 CI；附件 `10052054067` 为 148382928 字节，SHA `33006d78c40a1e244b52747ea2be309e14f2a6ca439093184e56813cb498a094`。服务器直传与远端并行尝试因带宽较慢而停止，保留的未完成文件未用于发行；最终由本地完整校验后分块上传，所有分块及服务器整包校验成功，再按已核验旧归档重组。
- 切换前后其他 10 个应用容器的 ID、镜像及启动时间一致，Nginx 配置 SHA 一致。上一 `1.1.0-b04a48c` 发行目录与镜像保留，本批未强制进行回退再升级演练。

恢复至紧邻上一发行：

```sh
bash /opt/openacad/bin/update.sh /opt/openacad/releases/1.1.0-b04a48c
```

## 1.1.0 期刊绘图质量更新（b04a48c）

依据用户“走上线流程”执行。固定前后端源码 `b04a48cb71e8e14417e6027651d2c8c286c74cfc`，版本仍为 1.1.0；[PR #1](https://github.com/yrjmdqmmx/OpenAcad/pull/1) 合并到发布分支 `codex/platform-home`，合并提交 `94c31f976625855e907905fb849a151d6becc121` 与该源码树完全相同。运行的是固定源码 CI 的原始构建内容；后续文档提交不改变运行源码。

| 关卡 | 本次结果 |
| --- | --- |
| 完整 CI | [源码 34205493679](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34205493679)、[PR 34205497850](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34205497850)、[合并 34207732069](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34207732069) 均成功。固定源码为 467 单测、238 浏览器、196 后端、13 恢复回归；542 浏览器按配置跳过、0 失败/不稳定。[摘要](evidence/1.1.0-b04a48c/ci-summary.json)。 |
| 评审修复 | 主/替代火山和富集示例均真实计算其声明的统计量，原始模拟依据随项目保存。初轮 CI 有两项 WebKit/手机字体坐标比较失败，统一固有尺寸和设备尺度后保留原 `<0.1` 容差，四浏览器通过；未据失败运行发布。[评审修复](evidence/1.1.0-b04a48c/review-fix-verification.json)。 |
| 网页附件 | GitHub ZIP 282268627 字节、SHA `019a3ebff229bfbf12d98dde7b3203c94dcb87ef9f81cd33c65c3b1e4fd62503`。按字节 SHA 复用 393 个不变文件，仅传 473921 字节派生载荷；最终 398 文件全部与 CI 内容一致，包括 389 个源码公开文件、368 个字体分片。派生载荷 SHA 与 GitHub ZIP 分开记录，没有重建应用。[网页准备](evidence/1.1.0-b04a48c/staged-web.json)。 |
| Linux 镜像 | [增量 34207512133](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34207512133) 绑定上述完整成功源码 CI；ZIP SHA `fc7d167220088df3cc19d5cbc0bfd9d4bad0847b48f935dff9a10e9f6306b817`，148384893 字节。56 成员、全部 RootFS、平台与 Config 核验通过。[镜像来源](evidence/1.1.0-b04a48c/image-staging-source.json)、[加载核验](evidence/1.1.0-b04a48c/image-loaded-verification.json)。早先候选全量包与上传残片未用于本次加载。 |
| 正式功能 | 55 模板、110 默认/替代场景、55 项目往返、220 实际下载及独立打开；三处图形 55/55 一致。额外浏览器 23 通过/41 跳过/0 失败，5 项真实 API 校验、8 份宋体下载、4 个旧项目两轮往返通过。[生产交付报告及前后大图](../qa/journal-figure-quality-production-2026-09-08.md)。 |
| 切换与隔离 | 09:14:17 UTC 切换完成，维护解除，API 与两 worker 健康；即时发布前后的 10 个其他容器 ID/镜像/启动时间和 Nginx 文件哈希未变。首次会话基线后、OpenAcad 发布前已观测到其他容器变化，另存该观察，不归入本次切换。[发布日志](evidence/1.1.0-b04a48c/publish.txt)、[公网](evidence/1.1.0-b04a48c/public-after-switch.json)、[隔离](evidence/1.1.0-b04a48c/isolation-verification.json)。 |

发行目录 `/opt/openacad/releases/1.1.0-b04a48c`；镜像 `openacad-worker:1.1.0-b04a48c`。CI config digest 为 `sha256:6a625c9507af50c9f0fe9c89b7f95497731d8f0cb7b2d53e2ff02644c5b05434`；实际 containerd/OCI 根为 `sha256:648353345ff3126042f5bf40e9712817639917485d798bdec887239b91421a7c`，二者分开记录。前后端 REVISION 均为完整 b04a48c 源码。

55 SVG 均离线加载内嵌字体。50 默认 PNG 与本地验收像素相同；UpSet 两份 SVG 完全相同，但四行名称的 PNG 基线略不同，具体渲染原因未单独定位，数值与各行对应完整；其余四项为极小像素差。未宣称四格式逐像素一致或所有 EPS 全矢量。研究候选、EPS 透明栅格、压力测试所在环境与 KEGG 上游未复验的边界见交付报告。

紧邻上一 `/opt/openacad/releases/1.1.0-3993a2a`、固定镜像 `openacad-worker:1.1.0-80370e0` 及更早发行保留。本次没有强制回退再升级演练，恢复命令仍经过维护排空与三服务健康检查：

```sh
bash /opt/openacad/bin/update.sh /opt/openacad/releases/1.1.0-3993a2a
```


## 1.1.0 标签补丁最终发行（3993a2a）

承接本轮更新正式站授权，修复生产视觉复查发现的雷达数值及基因簇行间刻度碰撞；数据点、多边形、基因长度及链方向均未改变。前端源码 `3993a2a3d9ed1485ef1b50b73adf389b6caf71f8`，发行目录 `/opt/openacad/releases/1.1.0-3993a2a`，版本仍为 1.1.0。

| 检查 | 最终结果 |
| --- | --- |
| 固定提交 CI | [34182366813](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34182366813) 成功；460 单元、233 浏览器、196 后端、13 恢复回归通过；539 浏览器用例按配置跳过、0 失败/不稳定。浏览器运行 16.8 分钟。[摘要](evidence/1.1.0-3993a2a/ci-summary.json)。 |
| 网页附件 | GitHub ZIP 摘要、网页 revision、368 字体分片和 5 张首页实景图片逐一核验；[传输记录](evidence/1.1.0-3993a2a/web-transfer-used.json)、[准备结果](evidence/1.1.0-3993a2a/staged-web.json)。 |
| 后端复用 | `server/` 树、最新 CI 配置摘要、全部 RootFS、运行配置相同，符合部署规则。`BACKEND_REVISION` 记录 `80370e0f495d9517f7bf99ccd4cb1de0b84fbfe1`；镜像 `openacad-worker:1.1.0-80370e0`、config `sha256:35d7ea3dd26873e430fa2b8ea60d1a7c0eaf5aeb808862e03c2f9bbf0bd72a66`、实际 OCI 根 `sha256:0e523f651921f8bcccd7f270befd9d19d04d1c7f32e82f727c80a820bc18a20d`。[复用核验](evidence/1.1.0-3993a2a/backend-reuse.json)。 |
| 最终正式站 | 专项首跑 10 通过、1 项手机字体加载超时、9 跳过；超时项延长 QA 命令总时限后补测通过，按每项最新结果为 11 通过、9 跳过。真实保存重开及两个模板保留全部标签的 8 文件四格式下载通过；四格式独立打开与尺寸/画面对照通过。桌面及 390px 工作台 4 张页面无错误/横向溢出，5 项真实统计/导出 smoke 再次通过。[交付报告与前后截图](../qa/template-quality-production-2026-09-08.md)。 |
| 切换与隔离 | 维护排空、健康检查、目录切换和 Nginx 校验完成；公网 revision 为最终源码，2 个 worker 健康。10 个其他应用容器的 ID/镜像/启动时间与 Nginx 配置保持一致。[发布日志](evidence/1.1.0-3993a2a/publish.txt)、[公网最终](evidence/1.1.0-3993a2a/public-final.json)、[隔离记录](evidence/1.1.0-3993a2a/isolation-verification.json)。 |

55 个模板全量生产操作来自下方 `80370e0`；最终补丁仅改两个模板，另行完成专项复验；其余 53 个模板沿用前一源码的全量生产证据。上一 `/opt/openacad/releases/1.1.0-80370e0`、更早 `1.1.0-7e68b5b` 和镜像保留。本次未强制进行生产回退再升级演练。

恢复至紧邻上一发行：

```sh
bash /opt/openacad/bin/update.sh /opt/openacad/releases/1.1.0-80370e0
```

## 1.1.0 科研绘图质量更新（80370e0）

用户于本轮明确确认更新正式站后执行。前后端源码 `80370e0f495d9517f7bf99ccd4cb1de0b84fbfe1`；发行目录 `/opt/openacad/releases/1.1.0-80370e0`，应用版本仍为 1.1.0。内容包括 P1/P2 模板优化、首页 3 秒科研实景轮播、图研版式及 55 个详情页。

- [完整 CI 34178615830](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34178615830)：460 前端单测、224 浏览器、196 后端、13 恢复回归通过，528 浏览器按配置跳过；候选准备见[历史候选记录](template-quality-candidate-2026-09-08.md)。
- 实际镜像 `openacad-worker:1.1.0-80370e0`，Linux amd64。CI config digest `sha256:35d7ea3dd26873e430fa2b8ea60d1a7c0eaf5aeb808862e03c2f9bbf0bd72a66`；实际 OCI 根 `sha256:0e523f651921f8bcccd7f270befd9d19d04d1c7f32e82f727c80a820bc18a20d`。由[增量运行 34180339418](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34180339418)运送已通过测试的原始镜像内容，未重新构建应用；[重建与加载核验](evidence/1.1.0-80370e0/image/loaded-image-verification.json)。
- 网页 ZIP SHA `b6c53d751d2f94b153d205e4b6a170d44159b6b96ed2287368b322c641d0ff4f`；增量 ZIP SHA `62a713756f67565240c09c8b9a78f4720859559c8266fb6c789c0ea25a594fc4` 均与 GitHub 附件匹配，字体分片、示例及 5 张首页图片逐一核验。
- [正式浏览器](evidence/1.1.0-80370e0/browser-acceptance.json)：140 通过、6 跳过、0 失败/不稳定；包含 55 个模板逐一编辑、保存重开、220 个四格式下载，五种真实排序分析、桌面/手机导出、首页轮播、AB1 和实时 KEGG。220 文件另以浏览器/PDFium/Ghostscript 独立打开，PDF/EPS 对 PNG 的最大平均通道差 1.581/255。[导出复核](evidence/1.1.0-80370e0/export-verification.json)。
- [生产数值验证](evidence/1.1.0-80370e0/production-smoke.json)5 项通过；PCA 重构误差 5.329e-15，R LM 与独立 OLS 在 1e-10 容差内一致。4 个旧项目五字段往返一致；额外 8 份宋体浏览器下载独立打开且 PDF 字体嵌入通过。
- [切换记录](evidence/1.1.0-80370e0/publish.txt)、[公网版本与健康](evidence/1.1.0-80370e0/public-after-switch.json)、[同机隔离](evidence/1.1.0-80370e0/isolation-verification.json)。10 个其他应用容器 ID/镜像/启动时间及 Nginx 配置未变，维护标记解除，2 个 worker 健康。上一 `1.1.0-7e68b5b` 和镜像保留。

自动化通过后的逐张大图复查另发现雷达图和基因簇标签碰撞，记录在[交付清单](../qa/template-quality-production-2026-09-08.md)，由后续补丁单独修复和验收。未将第一轮自动化通过描述为所有视觉问题都不存在。本次未强制进行生产回退再升级演练；13 项恢复回归通过，下面的真实回退记录属于以前的发行。

## 历史：1.1.0 首次发行与验收

本次发布平台首页与导航、AB1 本地查看器、KO 转 pathway 信息表，以及公开参考站文案与报告入口清理。内部研究和验收记录保留；绘图项目 schema、计算白名单及既有统计服务兼容。

- 正式入口：[首页](https://openacad.xyz)、[AB1 查看器](https://openacad.xyz/#bio/ab1)、[KO 转换器](https://openacad.xyz/#bio/ko)。
- 前后端运行源码：`7e68b5b9f740855e89bf5c8d49d0c5d8c6dfacff`，发布分支 `codex/platform-home`。文档归档提交与运行源码分开记录。
- 发行目录：`/opt/openacad/releases/1.1.0-7e68b5b`；镜像 `openacad-worker:1.1.0-7e68b5b`，Linux amd64。
- CI config digest：`sha256:c2cc25af01a34b9f4f8f4609f953530efd18ecb168eb48107e7f09b83c147b35`。
- 实际 containerd/OCI 根：`sha256:dbcd2de2f108dd8d8cd82bdf404a760c8c2b3b35b411380a082f13df3948c85d`。全部 RootFS 和运行配置核验通过，见[镜像加载核验](evidence/1.1.0/image/loaded-image-verification.json)。
- 上一版 `1.0.2-4433576` 及对应镜像保留；不复用旧后端处理本次新增接口。

| 检查 | 本次结果与证据 |
|---|---|
| 完整 Linux CI | [34119366158](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34119366158)：332前端单测、131浏览器用例、196后端、13发布工具回归通过；233浏览器用例按配置跳过、0失败。镜像内重复执行同一196项，不重复相加。[结构化摘要](evidence/1.1.0/ci-summary.json)。 |
| 网页发行包 | 201441711字节；SHA `f3a255b187072a8b840015b134e38a53167d74c15aac44622285317a0eda7a95` 与GitHub一致。393个文件、368字体分片核验；5个示例文件SHA与源码一致。[准备报告](evidence/1.1.0/staged-web.json)。 |
| 镜像传输 | [增量34120388279](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34120388279)绑定本次完整成功CI/源码。ZIP 148385951字节，SHA `8225fc2c863e6e5ed076ef4498acb7e51be7abdaaa37a389a40d8eb4d72bc2c5`；56成员全部核验后重组加载。[来源及准备](evidence/1.1.0/image/staging-report.json)。 |
| 正式浏览器 | [完整结果](../../tests/artifacts/production-browser-1.1.0.json)：83通过、29跳过、0失败/不稳定，331秒；57份下载/截图另存[清单](../../tests/artifacts/production-browser-1.1.0-artifacts/manifest.json)。 |
| 实际计算和独立导出 | [7项汇总](../../tests/artifacts/production-smoke-1.1.0/summary.json)：标准5项和粗斜PNG/PDF2项分别保留原报告，全部通过；没有POST重试。PCA重构误差5.329e-15，R LM与独立OLS在1e-10容差内一致。 |
| 浏览器实际下载复验 | [8份结果](../../tests/artifacts/production-browser-1.1.0-artifacts/independent-export-verification.json)：SVG转曲结构、PNG像素、PDF/EPS独立解码通过；尺寸960×640或1500×1000，PDF真嵌入宋体Bold，墨迹不触边。 |
| 正式HTTPS与移除入口 | [公网核验](evidence/1.1.0/public-final.json)确认1.1.0/完整源码和两worker；旧研究、验收URL返回SPA壳，不再发布旧报告，不将HTTP200写成报告仍存在。方法页实际确认相关文案与链接已移除。 |
| 回退与恢复 | [1.1.0→1.0.2→1.1.0](evidence/1.1.0/version-rehearsal/report.json)成功；各步核对网页SHA、服务镜像/健康和维护标记。 |
| 同机隔离 | [核对记录](evidence/1.1.0/isolation-verification.json)：10个其他应用容器的ID、镜像、启动时间保持一致；HTTPS Nginx配置SHA未变。 |

83项生产浏览器的范围：生信25、首页12、轮播/目录17、通用绘图流程12、项目导航4、真实统计5、桌面/手机真实导出8。29项跳过为其他配置重复统计15、Firefox/WebKit服务导出8、非Chromium原生触摸6。KO部分失败和停止恢复有8项模拟响应测试；其余真实KEGG查询4项单独计数，不把模拟故障写成真实上游失败。

AB1生产实际导入3730真实样例并逐字符核对序列；定位100位为G/Q50/PLOC1279，通道A0、C19、G651、T0，四色曲线与质量柱目视正确。KO正式查询K00001/K00844/K99999，分别8/18/0条PATHWAY；7行模拟原表展开63行，去重KO计数为有效3、匹配2、未匹配1，无效项1、空行1。匹配含map00010及实际分类，保留获取时间。[正式原始响应](evidence/1.1.0/kegg-production-response.json)、[人工浏览器核对](evidence/1.1.0/manual-browser.json)。

本轮限制：KEGG为实时公开来源，结果随上游更新，最多6小时缓存；未进行大并发压测或多API进程限速验收，当前生产仅一个API进程。手机是390px浏览器模拟及Chromium原生触摸测试，未验实体设备。AB1仅核验明确来源的4份历史仪器样本，不支持重新base calling；生信数据不写入绘图项目，刷新前需导出。EPS透明效果可能含栅格。证书续期配置本次未修改，续期dry-run属于下方历史验证，不冒充本次执行。

### 1.1.0 恢复命令

```sh
bash /opt/openacad/bin/update.sh /opt/openacad/releases/1.0.2-4433576
# 已实际验证可重新升级：
bash /opt/openacad/bin/update.sh /opt/openacad/releases/1.1.0-7e68b5b
```

## 1.0.2 发行与验收

- 正式地址：[OpenAcad 开放学术](https://openacad.xyz)。
- 前后端发行源码：`443357603240c87b9d28ebce346e8e87ea0d7f88`；目录 `/opt/openacad/releases/1.0.2-4433576`；镜像 `openacad-worker:1.0.2-4433576`。
- CI config digest：`sha256:c8eb293e2586c435e3f9d23ea11c56343ec05542f342f8b9bd2208a0ead0c561`。
- 实际 containerd 镜像/OCI 根：`sha256:31827c08ecfc92178d3bb26bb8adc29467070a11471b8068f898188d4c93acda`。与 config digest 分开记录；全部 RootFS 和运行 Config 校验通过，见[镜像加载验证](evidence/image-1.0.2/loaded-image-verification.json)。
- 上一版本 `1.0.1-01c5d87` 及更早发行均保留。本次后端字体与导出代码改变，使用新镜像；不套用1.0.1的后端复用结论。后续文档提交不改变此运行源码。

| 检查 | 本次证据 |
|---|---|
| 完整 Linux CI | [34053253054](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34053253054)：311前端单测、81浏览器场景、186后端、13发布工具回归通过；223浏览器场景按配置跳过，0失败。63项字体/导出专项是186中的子集，不重复相加。[结构化摘要](evidence/ci-1.0.2-summary.json)。 |
| 网页发行包 | 194219281字节，SHA `0f4fb785a6e2d39cdf86f4c9233c776f081460edc53ce07292a1742a28e1211c` 与GitHub一致；387个文件、368字体分片逐一核验。[准备报告](evidence/staged-web-1.0.2.json)。 |
| 镜像发行包 | [增量工作流34053706639](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34053706639)显式绑定本次成功CI及源码。ZIP为148391523字节，SHA `dfdd199c5ca4035adc5019ef82b20b8d9ad04e0fbb87138cda85a5d00690182e`；实际差异包148360375字节，复用1699293696字节已核验旧成员。[准备与来源](evidence/image-1.0.2/staging-report.json)。 |
| HTTPS 与目录 | [外部TLS检查](evidence/public-https-1.0.2.json)：1.0.2完整源码、两worker、52研究条目和55模板索引均可读。 |
| 版本恢复 | [1.0.2→1.0.1→1.0.2](evidence/version-rehearsal-1.0.2/report.json)通过，2026-09-06T19:23:30Z回到1.0.2；逐步核对网页SHA、三容器镜像/健康与维护标记。 |
| 同机隔离 | [升级及演练后的核对](evidence/isolation-verification-1.0.2.json)：10个其他应用容器的镜像和启动时间保持一致。 |

[正式浏览器完整报告](../../tests/artifacts/production-browser-1.0.2.json)：37通过、39按配置跳过、0失败、0重试不稳定，共432.6秒。16项通用流程、5项真实排序、桌面/手机8项真实格式下载、5项字体/取消检查、3项三桌面字体像素检查；其中4项异常注入与真实服务分别计数。[22份下载与截图](../../tests/artifacts/production-browser-1.0.2-artifacts/manifest.json)及[75份字体附件](../../tests/artifacts/production-browser-1.0.2-artifacts/typography/manifest.json)独立保存，原本地基线已恢复。

[七任务生产API报告](../../tests/artifacts/production-smoke-1.0.2/report.json)为 `complete: true`，7/7通过。PCA重构最大绝对误差5.329e-15，LM与独立OLS在1e-10容差内一致；五份PNG/PDF/EPS文件独立打开，粗斜PDF真嵌入Sans/Serif两种BoldOblique，8字体SHA全等冻结manifest，未发生POST重试，任务与验证容器均清理。[执行及独立工具说明](../../tests/artifacts/production-smoke-1.0.2/README.md)。

[8份浏览器实际下载独立验证](../../tests/artifacts/production-browser-1.0.2-artifacts/independent-export-verification.json)全部通过：SVG960×640、PNG1500×1000、PDF/EPS720×480pt，中文与真实粗体清楚，墨迹不触边。两PDF真嵌入NotoSerifCJKsc-Bold，未使用Cairo合成；桌面/手机各格式预览一致。EPS透明效果可能包含栅格，保留文字SVG依赖接收端字体，不能据可打开声称所有EPS均全矢量。

标题编辑性能：常规模拟数据30次测量全部低于300ms，p95 94.2ms，最大113.3ms；仅覆盖明确的标题编辑路径，不能外推大数据、所有控件或统计任务。[原始分段](evidence/staged-web-1.0.2.json)。

首次1.0.2 CI曾报告WebKit斜体像素相同。检查原始附件发现裁片只有画布边框，没有标题；字体在WebKit实际显示正常。测试改为 `getBBox` 四角经 `getScreenCTM` 定位，并确认真实深色墨迹和整图截图，三桌面本机及最终Linux CI通过。正式8OTF、368WOFF2和字体生成器未因此改变。[失败及诊断](../../tests/artifacts/font-webkit-matrix-before/README.md)、[正确裁片复验](../../tests/artifacts/font-webkit-crop-after/README.md)。

## 历史：1.0.1 发行身份

- 正式地址：https://openacad.xyz
- 已部署前端源码：`01c5d87a6f36263b236bd964d70996d25635a907`。后端核验源码为`23d5bb098d4b1a6d8551f3de8fe6e88893807f91`，两者`server/` Git树完全相同，最新CI重建配置摘要亦相同，见[复用核验](evidence/backend-reuse-1.0.1.json)。
- 正式发行目录：`/opt/openacad/releases/1.0.1-01c5d87`。
- 正式镜像：`openacad-worker:1.0.0-23d5bb0`，已验证 Linux amd64。
- CI 配置摘要：`sha256:f5a6ac07b01aca00c5e0f5a849db06bd50286ea02335b40b26991aaf985612d4`；实际 containerd 镜像/OCI 根摘要：`sha256:cec91c1f008073236405713073ff14011102d9913fecea48fbdcadfb0134d168`。两者的关系、25层 RootFS 和 Config 均通过[加载校验](evidence/image/loaded-image-verification.json)。
- 上一实际版本：`/opt/openacad/releases/1.0.0-23d5bb0`；更早0.1.0目录与镜像也保留。
- 前端 `/version.json` 保存发行版本、完整源码提交号和构建时间；文档后续提交不代表已经另行部署。

发行与线上检查分别记录如下。

|检查|状态与证据|
|---|---|
|1.0.1 Linux CI|[34048295712](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34048295712) 完整成功；前端311单测、77浏览器场景（219按配置跳过）、后端152项、发布与镜像工具回归13项。见[摘要](evidence/ci-1.0.1-summary.txt)。|
|1.0.1发行附件|网页45334623字节，SHA-256 `a70eeedd4a2766015bbe0ca823423038cf7e1460d1e751a44e41b53ad8e886d8` 与GitHub附件一致；110个发行文件、92份WOFF2逐一核验，见[准备记录](evidence/staged-web-1.0.1.json)。后端字节未变，复用已验证镜像。|
|HTTPS版本与健康|[外部HTTPS检查](evidence/public-https-1.0.1.json)确认版本1.0.1/完整01c5源码、两个worker；研究52条、验收55模板JSON可读。|
|生产浏览器|[完整报告](../../tests/artifacts/production-browser.json)：33通过、35按配置跳过、0失败、0重试不稳定，实际耗时442.3秒。16项跨引擎/手机通用流程、5项真实排序、桌面/手机8项真实格式下载，以及4项字体/取消故障注入。后4项是异常处理测试，不计为真实服务计算。|
|生产计算与独立打开|[五任务报告](../../tests/artifacts/production-smoke/report.json)全部通过；PCA重构最大绝对误差5.329e-15，R LM与独立最小二乘系数差小于1e-10；PNG、PDF、EPS独立解码，PDF嵌入黑体/宋体，墨迹未触边。浏览器本次实际文件另存[生产下载清单](../../tests/artifacts/production-browser-artifacts/manifest.json)。|
|手动回退及重新升级|[1.0→0.1→1.0](evidence/version-rehearsal/report.json)、[1.0.1→1.0→1.0.1](evidence/version-rehearsal-1.0.1/report.json)均通过；核对三服务镜像/健康、HTTPS页面SHA、源码及维护标记。最新演练于2026-09-06T17:34:16Z恢复到1.0.1。|

## 已完成的部署前检查

根域 A 记录指向香港 IPv4；未添加 AAAA。Certbot 为 openacad.xyz 签发证书，自动续期计时器处于 active。2026-09-06 的域名专属 `certbot renew --cert-name openacad.xyz --dry-run` 成功，见 [续期日志](evidence/certificate-renewal.txt)。

同机应用镜像和容器启动时间在切换前记录于 [容器基线](evidence/containers-before.txt)。OpenAcad 使用独立 Compose 项目、API 端口和目录；[1.0对比](evidence/isolation-verification.json)和[1.0.1后复查](evidence/isolation-verification-1.0.1.json)均确认同机10个其他应用容器的镜像和启动时间未变化。

## 发布失败自动恢复演练

2026-09-06T15:47:54Z，在专用 probe 发行目录中指定不存在的本地镜像，并设置 `pull_policy: never`。这模拟新镜像无法启动，不是“新版本运行一段时间后故障”。

实际命令返回 1；错误处理重新检查旧版本容器与 API，输出“之前版本已恢复”。`current` 仍指向 0.1.0，维护标记已移除，API 返回正常且两个 worker 就绪。见 [结构化演练记录](evidence/automatic-recovery.json)。

该演练前修复了 Bash 函数内错误不会继承 ERR trap 的问题：更新脚本启用 `set -Eeuo pipefail`。两项隔离回归覆盖恢复成功解除维护、恢复失败保留维护；[测试源码](../../deploy/tests/test_update.py)。真实服务器未制造“旧版本也无法启动”的情况。

## 性能证据口径

早期 Linux 检查只有自动化总耗时断言失败，分别测到 479ms 和 433ms；当时把 Node/Playwright 定位、滚动及协议往返算入产品响应时间。对应运行没有标记成功，也未据此发布完整版本。

随后改为浏览器真实 input 事件→SVG 标题文字更新→双 requestAnimationFrame，保留自动化总耗时另列，300ms 阈值保持不变。第三次 Linux 开发构建仍有 3/30 超标，p95 369.5ms；PCA、地图、箱线图的 DOM 更新和后续帧两段均较长。该失败记录保留在 [Linux 原始分段](../../tests/artifacts/performance-linux-2794ea6.json)。

进一步采样发现父组件项目回传造成额外整树渲染，以及调试构建的 JSX 开销。已去除普通编辑的 App 状态回传，并使 CI 测试真实 dist 发行构建。4倍CPU减速下，生产构建空闲 p95 29.7ms、并发两 workers 28.3ms；完整120样本及对照见[性能调查](../../tests/artifacts/performance-profile/INVESTIGATION.md)。随后1.0 Linux发行构建的30次测量全部通过，p95 109.1ms、最大112.2ms；[原始分段](evidence/staged-web.json)。1.0.1最新CI同样30次全部通过，p95 **102.9ms**、最大**126.2ms**；[最新分段](evidence/staged-web-1.0.1.json)。只覆盖常规模拟数据的标题编辑，不能外推任意大数据、其他布局调整或统计任务。[测量方法](../../web/e2e/PERFORMANCE.md)。

## 传输与验证范围

本机脚本曾遇 TLS EOF/连接池超时。未关闭证书校验、未修改代理；基线部分任务结果与失败报告分别保留。五任务已使用服务器上的独立一次性验证容器访问正式 HTTPS，并取回本机用 Poppler/Ghostscript 独立打开。[完整报告](../../tests/artifacts/production-smoke/report.json)为 `complete: true`；[执行身份](../../tests/artifacts/production-smoke/execution.json)记录源码、实际镜像与命令。

正式计算验收使用自行生成的确定性模拟数据，不涉及用户研究数据。验收任务完成后删除本次任务及访问凭据；报告不保存凭据。浏览器草稿和 `.openacad.json` 项目由用户本机保存，不依赖服务器长期保留任务。

## 镜像传输来源

完整工作镜像附件因网络慢和临时链接过期未能完整下载，部分ZIP未用于加载。改用[手动增量工作流 34046784103](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34046784103)，只从完整成功的23d5构建生成差异包。工具提交为`af6b27d`；13项辅助回归与真实小镜像往返通过。工具提交触发的重复全量应用构建被主动取消，应用发行仍引用原成功运行34044909758。

服务器校验全部旧归档成员和差异包，保留目标元数据字节，重新打包外层tar后加载。压缩层转换后的Docker save OCI根摘要与构建时压缩manifest摘要可能不同；固定CI config、实际diff_ids和加载后Config分别验证，未将两种摘要混称。完整记录见[增量报告](evidence/image/delta-report.json)和[发行准备报告](evidence/image/staging-report.json)。

## 首轮线上字体与传输失败

首轮浏览器中，完整黑体OTF16.45 MB冷下载耗89.4秒，宋体仍在下载；SVG转曲等待字体110秒超时，尚未创建服务任务。PNG同类等待也超时。NMDS的POST实际返回202但耗52.3秒，随后第一次GET等待响应；[worker关联记录](evidence/nmds-transfer-initial.json)显示算法1.012秒成功。字体传输与该延迟共现，尚未证明因果。已补充收到202后立即显示“任务已提交，正在读取进度”，避免旧状态掩盖已提交事实。6个场景通过后，因确认的字体问题主动停止剩余运行；按报告区分失败、超时和中断。[匿名化网络证据](evidence/font-loading-failure.json)。

1.0.1将相同原始OTF字形转换为按Unicode范围加载的92份WOFF2分片，保留完整字符覆盖；服务器仍用原OTF。黑体44810、宋体44777个码点和各25个变体序列均保留，64682/64586个字形轮廓及指标无差异。黑体常用分片356620字节、宋体504644字节。弱网限定80ms延迟/160KiB每秒的浏览器场景覆盖常用中文和𠮷；8个实际请求分片合计1401580字节，未请求OTF，无页面错误。稀有宋体场景已在切换字体时预取，明确不将其称作独立冷缓存测试。[字体完整证据](../../tests/artifacts/font-delivery/README.md)。

导出只等待图内实际使用的字体、字重及文字；需要的字体失败时给出中文提示，30秒准备超时可取消，不再等待无关字体。提交POST之前即可取消；迟到的任务编号会触发删除，不继续轮询或下载。四项新增异常分支测试在本机、CI和生产页面均通过。1.0.1正常生产浏览器中，NMDS场景10.9秒，桌面四格式12.2～21.9秒，手机四格式12.1～14.9秒，包含页面加载、编辑及下载，不将其当成纯服务执行耗时。[完整生产运行](../../tests/artifacts/production-browser.json)。

## 历史：1.0.2 交付与保留限制

55模板和52入口对照均有逐项证据；默认/变体/复杂样式、统计基准、树图层和项目往返各自列出方法，不将SSR属性审计写成逐控件浏览器实测。[验收索引](../acceptance/README.md)保留早期完整本地运行，后续生产21份实际下载和截图另存，原输入与图片SHA没有被新时间戳静默覆盖。

无需登录；本机草稿和项目文件长期保存由用户设备承担。任务只临时保存，Redis重启可能丢失未下载结果。EPS透明效果可能含栅格；保留文字SVG需要接收端字体，跨设备推荐转曲。已有时间树编辑不执行序列建树和年代估计；不包含AB1/KO等明确排除项。完整边界见[交付状态](../STATUS.md)和各模板中文帮助。


## 1.0.1最终独立打开后的新增问题

[八份下载独立打开](../../tests/artifacts/production-browser-artifacts/INDEPENDENT-EXPORT-README.md)确认尺寸、中文内容及边界通过，但PDF保留文字标题更粗、SVG转曲/PNG/EPS标题未保留同样的加粗。服务仅有Regular字体，浏览器与PDF的合成粗体并未在其他输出路径保持。这属于已声明样式的导出差异，1.0.2将补齐同版本真实Bold字体并重新验证；不把“可打开”当成加粗效果已通过。

原报告同时记录PDF复制的兼容部首码点及EPS透明合成栅格限制，未删改原下载或原有失败证据。

## 1.0.2发布前实际字体回归

真实Bold补齐后，55默认、15复杂配置、16树图源共258份图片在本机隔离环境重转。首轮发现37份650字重未按浏览器匹配Bold；修复静态字重归一化后，第二轮全部独立打开，37份PNG产生预期变化，其他49份PNG保持一致。两轮完整报告都保留，不将第一轮视为字体通过。

随后实际斜体检查发现，浏览器原 `font-synthesis:weight` 阻止倾斜；允许style后网页像素开关有效。当前Inkscape即使fontconfig提供倾斜矩阵，PNG与转曲SVG仍未变化。该失败也保留；之后使用明确标注、可复现的12度派生Oblique面，8份完整OTF与368份网页分片全量核验；63项字体/导出子集、42份小夹具转换和14份PDF独立打开通过。两种复杂布局另有实际界面编辑、项目重开和8份四格式下载通过，见[字体证据](../../tests/artifacts/font-delivery-oblique/README.md)及[复杂布局证据](../../tests/artifacts/font-oblique-layout/README.md)。
