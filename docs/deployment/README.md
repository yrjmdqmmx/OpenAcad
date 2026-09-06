# OpenAcad 部署、更新与恢复

OpenAcad 使用独立的 `/opt/openacad` 目录、`openacad` Compose 项目、`127.0.0.1:13310` API 端口与 `openacad.xyz` Nginx 虚拟主机。现有 PaperBanana 和 Tensor Auto 不在这些命令的操作范围内。

## 发行内容

每次发行目录为 `/opt/openacad/releases/<版本>-<提交短号>`，包括：

- `web/`：由锁文件构建的网页和自制示例。
- `compose.yml`、`release.env`：固定镜像标签和运行配置。
- `REVISION`：前端源码提交号；若复用已验证的相同后端镜像，另记 `BACKEND_REVISION` 和镜像身份。

项目长期数据保存在使用者的浏览器 IndexedDB 和下载的 `.openacad.json` 文件中。服务器只保存临时任务；升级会暂停新任务并等待已有任务完成。Redis 未启用磁盘持久化，故障重启时未下载的临时结果可能丢失，界面允许重新计算。

## 构建与验证

在仓库目录执行：

```sh
npm --prefix web ci
npm --prefix web run build
npm --prefix web test
cd web
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

Linux amd64 镜像由私有仓库 Actions 构建，执行 Python、R 与 Inkscape 测试后生成 `worker-image` 发行附件。不要把 macOS arm64 镜像部署到 x86_64 服务器。固定 Python 依赖见 `server/requirements.lock`，R 固定包见 `server/r/packages.lock.json` 和 `server/r/renv.lock`，基础镜像固定摘要见 `server/Dockerfile`。

## 下载 Linux 发行附件

若操作机下载大附件较慢，可用 `deploy/fetch-artifact.py` 将附件直接传到已授权服务器：

```sh
GODEBUG=http2client=0 server/.venv/bin/python deploy/fetch-artifact.py \
  --run <通过的Actions运行ID> --artifact worker-image \
  --host root@<服务器IP> --out /opt/openacad/releases/worker-artifact.zip
```

脚本使用操作机现有 `gh` 登录，仅在内存获取一次性下载地址，通过 SSH 标准输入交给服务器；不保存 GitHub 凭据，并核对 GitHub 附件 SHA-256。`web-evidence` 可用同样方式获取。附件下载与测试通过分别核查；先确认运行完整成功再发布。也可常规使用 `gh run download` 后通过 SCP 上传。

若大附件的临时链接在传输完成前过期，可使用[镜像增量发行流程](../../deploy/IMAGE_DELTA.md)。它从已成功构建的完整归档生成差异包，按实际 SHA 复用旧归档成员，再通过 `verify-loaded` 核对配置摘要、OCI 根、全部文件系统层、平台和运行配置；应用不重新构建。旧完整归档及上一发行必须保留。

## 首次安装

前提：Docker Compose、Nginx、Certbot 已安装；SSH 使用已有授权访问；根域 A 记录指向香港服务器；防火墙允许 80/443。不要添加未经验证的 AAAA 记录。

```sh
mkdir -p /opt/openacad/releases /opt/openacad/shared /opt/openacad/bin /var/www/openacad-acme
# 以下命令所在目录应有已上传的 deploy/nginx.conf 与 deploy/update.sh。
install -m 755 update.sh /opt/openacad/bin/update.sh
# 非 root API 需要能遍历共享目录，以检测维护标记。
chmod 755 /opt/openacad /opt/openacad/shared
# 将通过验证的发行包解压至具体发行目录，并加载 Linux 镜像。
docker load -i openacad-worker.tar.gz
docker tag openacad-worker:verified openacad-worker:<版本>
# release.env 的唯一必需项为该版本专属镜像标签：
# OPENACAD_IMAGE=openacad-worker:<版本>
install -m 644 nginx.conf /etc/nginx/sites-available/openacad
ln -s /etc/nginx/sites-available/openacad /etc/nginx/sites-enabled/openacad
nginx -t
systemctl reload nginx
bash /opt/openacad/bin/update.sh /opt/openacad/releases/<版本>-<提交短号>
certbot --nginx -d openacad.xyz --redirect --non-interactive --agree-tos --register-unsafely-without-email
curl --fail https://openacad.xyz/api/health
```

Certbot 命令仅操作新域名的虚拟主机。可以另行给证书登记维护邮箱；没有邮箱时依赖自动续期日志和定期健康检查。首次发布前，应确认 DNS 已解析到目标 IPv4。

## 更新与回退

后续更新保留 Certbot 已修改的 HTTPS 虚拟主机，不再次用仓库内首次安装用的纯HTTP模板覆盖。只切换发行目录和本发行的服务。

只有 `server/` Git树完全一致、最新CI重建的配置摘要与已验证镜像一致时，前端修复才复用该后端镜像；记录前后源码、配置摘要及实际加载身份。1.0.1的实际记录见[后端复用核验](evidence/backend-reuse-1.0.1.json)。不能仅凭镜像标签相同推断内容相同。

发行脚本 `deploy/update.sh` 先启用维护标记，停止接收新计算/导出任务；已有结果仍可读取或取消。最多轮询 70 次、每次间隔 5 秒排空队列，然后启动新镜像。API、worker-one、worker-two 三个容器均须 healthy，且 API 实际响应成功，才切换网页目录并重载 Nginx。worker 健康命令为 `python -m app.worker_health`，核对本容器 hostname、存活 PID 和 90 秒以内的心跳，不用 Redis 中残留的旧 worker 数量代替就绪证据。

发布检查失败时重新启动上一发行并再次等待上述健康检查；恢复及 Nginx 检查通过后才解除维护。恢复不成功会保留维护标记并返回失败，不能据此声称旧版本已恢复。首次安装失败则关闭本次 OpenAcad 容器。排空检查应使用 `q.started_job_registry`，保留服务自定义的任务清理类与 JSON 序列化器。

```sh
bash /opt/openacad/bin/update.sh /opt/openacad/releases/<新版本>-<提交短号>
# 手动恢复上一版本，同样经过排空与健康检查：
bash /opt/openacad/bin/update.sh /opt/openacad/releases/<上一版本>-<提交短号>
```

保留至少上一份发行目录和版本镜像。不要执行全局 `docker system prune`，它会影响同机其他应用。没有数据库迁移；项目 schemaVersion 的兼容性由文件导入验证。

## 查看状态与日志

```sh
cd /opt/openacad/current
docker compose --env-file release.env -f compose.yml ps
docker compose --env-file release.env -f compose.yml logs --tail 100 api worker-one worker-two
curl --fail http://127.0.0.1:13310/api/health
nginx -t
systemctl status certbot.timer
journalctl -u certbot.service --since '7 days ago'
```

日志限制为每个服务 3 份、每份 10 MB。不要把用户数据或任务访问凭据粘贴到公开问题单。计算错误会返回中文原因与必要的行列定位，意外异常只返回任务编号。

## 临时数据与证书

任务凭据自创建起最多一小时有效，结果不会晚于凭据期限过期；原输入在执行完成或异常恢复保存前移除。取消会先撤销凭据，再删除任务及结果；并发完成、硬杀后的父进程保存也须遵守该凭据状态。Inkscape/R 的临时文件位于容器 `/tmp`，单任务上下文结束时清理；容器重启也会清空 tmpfs。`/opt/openacad/shared/maintenance` 只控制是否接受新任务，更新或恢复验证成功后移除。

```sh
certbot renew --cert-name openacad.xyz --dry-run
# 确认更新进程已退出且服务正常后，才清理遗留维护标记：
rm -f /opt/openacad/shared/maintenance
```

## 线上计算与导出验收

在可信任的操作机上，从源码目录运行以下脚本。需要 Python 3 与锁文件中的 `httpx==0.28.1`（使用已安装依赖的 `server/.venv`）；完整独立打开检查还需要本机 Poppler（`pdftoppm`、可选 `pdffonts`）与 Ghostscript（`gs`）。脚本不操作 DNS、服务器配置或其他人的任务，仅提交五个确定性模拟数据任务，保存本地结果后清理本次任务。不会保存或打印临时任务访问凭据。

```sh
server/.venv/bin/python server/scripts/production_smoke.py https://openacad.xyz \
  --output tests/artifacts/production-smoke
```

默认要求至少两个近期活跃 worker。脚本检查首页和 API，实际执行 PCA、R LM，并用独立重构与最小二乘公式验证数值；随后把真实结果生成的中文图导出 PNG/PDF/EPS，核对像素尺寸、校验和、非空白和页面边界，并用 Poppler/Ghostscript 独立打开。输出目录包含模拟输入、完整计算结果、图片、字体及方法版本和 `report.json`。`complete: true` 才表示这些检查全部通过。缺少独立打开工具时，可显式加 `--skip-independent-open`，报告将标记 `partial`，不能作为完整导出验收。单 worker 本地调试可加 `--min-workers 1`。

该脚本不替代浏览器逐模板验收：仍需检查 SVG、项目文件重开、交互和手机下载；仅 `/api/health` 成功也不等于功能验收完成。生产版本、发布日期和恢复演练结果另记在[正式发布记录](production-record.md)。
