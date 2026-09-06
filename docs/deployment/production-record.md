# OpenAcad 正式发布记录

状态：**2026-09-07（北京时间），当前正式版本1.0.1；最终独立复核发现标题加粗跨格式差异，正在修复1.0.2。** 全量Linux发行检查、正式HTTPS浏览器验收、真实计算/导出与版本恢复演练均已通过。首轮发现的字体加载和取消问题已修复；历史失败保留在下文，不冒充成功运行。

## 发行身份

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
|最新Linux CI|[34048295712](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34048295712) 完整成功；前端311单测、77浏览器场景（219按配置跳过）、后端152项、发布与镜像工具回归13项。见[摘要](evidence/ci-1.0.1-summary.txt)。|
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

## 交付与保留限制

55模板和52入口对照均有逐项证据；默认/变体/复杂样式、统计基准、树图层和项目往返各自列出方法，不将SSR属性审计写成逐控件浏览器实测。[验收索引](../acceptance/README.md)保留早期完整本地运行，后续生产21份实际下载和截图另存，原输入与图片SHA没有被新时间戳静默覆盖。

无需登录；本机草稿和项目文件长期保存由用户设备承担。任务只临时保存，Redis重启可能丢失未下载结果。EPS透明效果可能含栅格；保留文字SVG需要接收端字体，跨设备推荐转曲。已有时间树编辑不执行序列建树和年代估计；不包含AB1/KO等明确排除项。完整边界见[交付状态](../STATUS.md)和各模板中文帮助。


## 1.0.1最终独立打开后的新增问题

[八份下载独立打开](../../tests/artifacts/production-browser-artifacts/INDEPENDENT-EXPORT-README.md)确认尺寸、中文内容及边界通过，但PDF保留文字标题更粗、SVG转曲/PNG/EPS标题未保留同样的加粗。服务仅有Regular字体，浏览器与PDF的合成粗体并未在其他输出路径保持。这属于已声明样式的导出差异，1.0.2将补齐同版本真实Bold字体并重新验证；不把“可打开”当成加粗效果已通过。

原报告同时记录PDF复制的兼容部首码点及EPS透明合成栅格限制，未删改原下载或原有失败证据。

## 1.0.2发布前实际字体回归

真实Bold补齐后，55默认、15复杂配置、16树图源共258份图片在本机隔离环境重转。首轮发现37份650字重未按浏览器匹配Bold；修复静态字重归一化后，第二轮全部独立打开，37份PNG产生预期变化，其他49份PNG保持一致。两轮完整报告都保留，不将第一轮视为字体通过。

随后实际斜体检查发现，浏览器原 `font-synthesis:weight` 阻止倾斜；允许style后网页像素开关有效。当前Inkscape即使fontconfig提供倾斜矩阵，PNG与转曲SVG仍未变化。该失败也保留；正在用明确标注、可复现的派生倾斜字形验证同一显示与导出形状，尚未发布1.0.2。
