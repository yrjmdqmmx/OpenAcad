# OpenAcad 杭州自动发布

用户选择独立杭州发布分支 `codex/hangzhou-production`。合并后先读取服务器实际前端/后端源码版本，再按差异安排检查和发布；其他分支和旧默认分支不会自动切换生产。

| 改动 | 验收 | 发布行为 |
| --- | --- | --- |
| 模块内 UI / 样式（如磁异常上传） | 前端构建、对应单元与浏览器用例、字体完整性 | 只切换静态网页，复用运行中的 API/Worker |
| 共享编辑器 UI | 项目往返、布局及代表模板交互 | 只发布前端 |
| 共享数据契约、前端依赖或未映射构建输入 | 完整前端回归 | 只发布前端；没有 `server/` 变化不构建 worker |
| `server/` Docker 上下文 | 镜像内 Python/R/Inkscape 验收 | 构建 worker，排空队列后更新 API/两个 Worker；无网页变化时保留网页版本 |
| 前后端混合 | 两边各自需要的检查 | 同一受保护发布中更新两边 |
| 发布工具/工作流 | 分类、保护和恢复测试及基础网页流程 | 验证前端发布路径，不重建未变化的 worker |
| 文档 / 验收证据 | 不部署；仅测试文件变动运行对应检查 | 不切换线上 |

规则及检查清单在 `deploy/change_scope.py`，执行器为 `deploy/run_web_checks.py`。重命名同时检查旧路径与新路径；找不到基线直接失败，删除已映射用例时扩大回归。生产比较基于线上版本，覆盖前次失败或只更新了一侧后尚未发布的差异，不只使用 push 的 `before`。

PR 使用同一套分类规则，取消 feature push 与 PR 的重复执行。普通 CI 不再上传整个 worker 镜像；旧手动增量工具需要归档时，在“构建与验收”手动运行中明确开启 `archive_worker`。生产手动运行提供 `force_web`、`rebuild_worker`、`full_web`，默认均关闭，不因点了手动运行就重建所有内容。

独立 `hangzhou-production` environment 仅允许发布分支，存放受限 SSH Key 和 known_hosts；没有模型密钥。强制 SSH 接收器只接受 status/deploy，校验实际 GitHub run、最新源码 SHA、固定镜像摘要及发布包。协议 2 的 manifest 包含 `sha/mode/images`，mode 是 frontend/backend/full。frontend 不允许携带镜像，backend 不允许携带网页；接收器独立比较不可变 Git 源码树，拒绝把未发布后端改动伪装成纯前端发布（或遗漏网页改动）。固定仓库、最新提交、包摘要、锁和现网状态检查均保留。

纯前端不登录镜像仓库、不排空队列、不运行 Compose，也不创建维护标记。只原子切换网页目录，验证公开版本/API 健康和运行容器身份；失败仅恢复旧网页指针。后端更新才进入维护、排空任务和容器更新，失败恢复先前镜像与网页。回执分别记录 webRevision/backendRevision 及容器 ID，避免把新版网页误认为后端也已更新。

宿主接收器必须经运维 SSH 备份后安装到 `/opt/openacad/operations/hangzhou/ci_receive.py`（root:root，0700），不能由发布包替换。先运行 `deploy/tests` 与 `deploy/hangzhou/tests`，检查无在途发布，再安装并调用受限 status 核对 protocol=2 与仓库文件 SHA256；工作流会阻止接收器版本未同步时发布。只操作 OpenAcad 的副本，不修改同机其他项目的接收器。接收器回退与业务网页回退是独立操作，应保留安装前的脚本备份。

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
