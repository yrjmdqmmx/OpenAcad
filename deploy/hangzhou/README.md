# OpenAcad 杭州自动发布

用户选择独立杭州发布分支，OpenAcad 同样从当前线上版本建立 `codex/hangzhou-production`。推送/合并代码到此分支会自动测试网页、三种浏览器（含手机视口）及镜像内 Python/R/Inkscape，全部成功后发布杭州 `116.62.146.226`；纯文档修改不发布。其他分支和旧默认分支不会自动切换生产。

独立 `hangzhou-production` environment 仅允许发布分支，存放受限 SSH Key 和 known_hosts；没有模型密钥。强制 SSH 接收器只接受 status/deploy，校验实际 GitHub run、最新源码 SHA、固定镜像摘要及网页包。服务器保持当前 Compose / Redis / 参数，仅更新 API 和两个 Worker 的镜像以及 `/opt/openacad/current` 网页目录；不覆盖 HTTPS、其他项目或任何模型线路。

切换前维护并排空当前任务，健康与实际网页版本成功后开放新任务；失败恢复先前镜像和网页目录。保留旧版本用于恢复。宿主接收器必须通过运维管理 SSH 安装，不能由发行包任意替换。

此流程不调用模型。不启用新付费资源；GitHub Actions 和镜像存储按仓库现有额度计费，不能把零模型费用等同于全部基础设施永久免费。

Worker 的不可变镜像摘要经 GitHub job output 传递；网页测试、打包和发布在同一个执行任务完成，不使用 Actions artifact 存储额度。发布回执写入 GitHub run summary 及服务器发布目录的 `receipt.json`。构建缓存和现有 GHCR 镜像仍使用原有额度；没有开通付费计划。

### 镜像传输与失败状态

杭州直拉 GHCR 实测过慢，镜像字节使用独立 SSH SOCKS 通道经香港获取，再由杭州 Skopeo/OCI 缓存导入 Docker。此通道不使用也不改动模型 Squid 配置。专用密钥只留杭州宿主，香港公钥限定源地址 `10.78.0.2`，仅允许 `ghcr.io:443` / `pkg-containers.githubusercontent.com:443`；禁止 shell、PTY 及其他目的地。通道只在导入时监听杭州 loopback，退出即关闭，不在香港缓存镜像。

宿主需安装 `skopeo`，配置 root-only `/opt/paperbanana/operations/hangzhou/registry-tunnel/` 中的专用密钥及固定 HK known_hosts；`registry_import.py` 和接收器由运维安装，CI 发布包不能安装或改写它们。OCI 缓存 `/var/cache/hangzhou-ci-oci` 属于本流程；保留回退镜像，后续按磁盘使用情况维护，禁止对共享主机执行全局 prune。

校验固定来源 digest、OCI 配置 blob SHA256、Linux amd64、Docker 实际运行配置与所有解压层摘要，返回宿主不可变 image ID。Docker containerd 后端的 image ID 可以是 manifest digest，因此不把它误认为配置 blob digest。公开回执同时记录来源 digest 和实际运行 image ID。

发布日志管道明确启用 Bash `pipefail`，SSH/接收器失败必须让 CI 失败；绿色状态还必须有服务器健康回执与对应公开 `version.json`，不能仅凭日志保存成功判定上线。

实际自动发布、测试数量、生产数值和导出验收见 [2026-10-18 验收记录](../../docs/deployment/hangzhou-auto-deploy-20261018.md)。

## 国内静态资源传输

`nginx/` 保存当前杭州域名配置，静态 JS / CSS / SVG 启用 gzip 与 Accept-Encoding Vary；账号和任务 JSON 不加入此压缩范围。宿主配置由运维单独备份、`nginx -t` 验证后 reload；CI 只切换静态 release 目录，不覆盖 Nginx。不要用 `deploy/icp-domains-20261015` 的历史跨境 upstream 配置覆盖现网。
