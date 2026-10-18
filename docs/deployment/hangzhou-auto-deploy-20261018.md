# 杭州自动发布验收 · 2026-10-18

OpenAcad 现在从独立 `codex/hangzhou-production` 分支自动发布杭州。用户选择保留当前线上基线，其他开发分支与旧 `main` 不会触发正式发布。仅文档改动跳过发布。

## 已完成的真实自动发布

- GitHub push 运行：[39105877141](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/39105877141)，结论 success。
- 已部署源码：`64931c2dd40e90090892ab2264aec6a59b098af8`。
- 生产入口：[openacad.xyz](https://openacad.xyz)；[version.json](https://openacad.xyz/version.json) 的 revision 与源码一致，target 为 Hangzhou。
- 宿主回执：`/opt/openacad/releases/ci-39105877141-1-64931c2dd40e/receipt.json`，完成于 `2026-10-18T07:21:37Z`，状态 healthy。
- API 与两个 Worker 使用同一不可变镜像 `sha256:5ab0505255735e8b759d1a6156557bbb77bab97385aed390db2d81227c367645`；来源 `ghcr.io/yrjmdqmmx/openacad-hz-worker@sha256:92b216cfdd2b36d70b081b333055fc8dd018532c280f7b6f51402f783c68629f`。
- 前端 467 项测试通过；浏览器 238 项通过、542 项跳过，跳过项包括原有浏览器限定和需要显式开启真实 API 的用例，不能称为 780 项全部通过。镜像构建包含 196 项后端测试，该次命中已通过测试的相同服务器内容缓存。

## 上线后独立验证

对生产 API 提交了本脚本生成的确定性模拟数据，未使用用户研究资料。5 项真实任务全部通过，完成后删除本轮任务：

| 项目 | 实际结果 |
| --- | --- |
| Python PCA | 得分与载荷重构最大绝对误差 `5.33e-15`，解释方差占比之和为 1 |
| R 线性回归 | 截距、斜率及置信区间由独立公式复核，系数误差容限 `1e-10` |
| PNG | 实际导出 1500 × 875，完整解码、中文正常、内容未碰触页边 |
| PDF | Poppler 独立解码，中文字体已嵌入，页面完整 |
| EPS | Ghostscript 独立解码，页面完整；半透明置信区间按格式限制合并为栅格，诊断已明确记录 |

浏览器验证实际生产版本、页面标题和 11 张已加载图片，未出现横向溢出。真实导出 PNG 已人工查看。

## 日常发布和故障恢复

经复核的业务更新合入 `codex/hangzhou-production`，GitHub Actions 测试、构建并发送至杭州；查看运行结果、宿主 receipt 和公开 version.json 三者一致才算上线。部署包不修改 Redis、数据卷、TLS、环境密钥或模型线路。维护时排空队列，健康检查失败回退原镜像和网页，恢复失败保留维护状态。

独立 `hangzhou-production` environment 只允许发布分支，部署 Key 限定 SSH 强制 status/deploy 命令。宿主接收器更新须由运维安装，业务发布包无法改写它。私有仓库的额外分支规则受当前套餐限制，未购买升级或公开仓库；environment 限制和最新分支 SHA 校验已生效。

镜像通过仅允许 GHCR 两个目的主机的香港 SSH 通道传入杭州。此通道与现有模型代理分离；模型 WireGuard / Squid 和香港、新加坡分渠道策略保留。详情见 [杭州发布说明](../../deploy/hangzhou/README.md)。

初始运行曾因日志管道掩盖 SSH 失败而显示绿色，但未切换生产；该轮不计成功。现已明确启用 Bash pipefail，并验证上游退出码 7 会令整条管道失败。当前成功结论来自上述真实回执、版本和生产任务。

本次模型调用 0、模型费用 0；没有新增付费计划。服务器、CI、GHCR 与网络仍使用既有资源额度，不宣称基础设施永久免费。Actions artifact 额度不足已通过 job output 和同 job 打包解决，没有删除其他项目数据。

详细机器可读证据保存在操作者本机 `hangzhou-auto-deploy/openacad-live/report.json`、`openacad-receipt.json` 与该次 GitHub run；其中不包含模型 Key 或用户研究数据。
