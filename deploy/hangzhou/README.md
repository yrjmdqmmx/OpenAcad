# OpenAcad 杭州自动发布

用户选择独立杭州发布分支，OpenAcad 同样从当前线上版本建立 `codex/hangzhou-production`。推送/合并代码到此分支会自动测试网页、三种浏览器及镜像内 Python/R/Inkscape，全部成功后发布杭州 `116.62.146.226`；纯文档修改不发布。其他分支和旧默认分支不会自动切换生产。

独立 `hangzhou-production` environment 仅允许发布分支，存放受限 SSH Key 和 known_hosts；没有模型密钥。强制 SSH 接收器只接受 status/deploy，校验实际 GitHub run、最新源码 SHA、固定镜像摘要及网页包。服务器保持当前 Compose / Redis / 参数，仅更新 API 和两个 Worker 的镜像以及 `/opt/openacad/current` 网页目录；不覆盖 HTTPS、其他项目或任何模型线路。

切换前维护并排空当前任务，健康与实际网页版本成功后开放新任务；失败恢复先前镜像和网页目录。保留旧版本用于恢复。宿主接收器必须通过运维管理 SSH 安装，不能由发行包任意替换。

此流程不调用模型。不启用新付费资源；GitHub Actions 和镜像存储按仓库现有额度计费，不能把零模型费用等同于全部基础设施永久免费。
