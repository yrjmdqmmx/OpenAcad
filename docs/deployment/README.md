# OpenAcad 部署、更新与恢复

OpenAcad 使用独立的 `/opt/openacad` 目录、`openacad` Compose 项目、`127.0.0.1:13310` API 端口与 `openacad.xyz` Nginx 虚拟主机。现有 PaperBanana 和 Tensor Auto 不在这些命令的操作范围内。

## 发行内容

每次发行目录为 `/opt/openacad/releases/<版本>-<提交短号>`，包括：

- `web/`：由锁文件构建的网页和自制示例。
- `compose.yml`、`release.env`：固定镜像标签和运行配置。
- `REVISION`：源码提交号。

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

Linux amd64 镜像由私有仓库 Actions 构建，执行 Python、R 与 Inkscape 测试后生成 `worker-image` 发行附件。不要把 macOS arm64 镜像部署到 x86_64 服务器。固定 Python 依赖见 `server/requirements.lock`，R 固定包见 `server/r/packages.lock.json` 和 `renv.lock`，基础镜像固定摘要见 `server/Dockerfile`。

## 首次安装

前提：Docker Compose、Nginx、Certbot 已安装；SSH 使用已有授权访问；根域 A 记录指向香港服务器；防火墙允许 80/443。不要添加未经验证的 AAAA 记录。

```sh
mkdir -p /opt/openacad/releases /opt/openacad/shared /var/www/openacad-acme
# 将通过验证的发行包解压至具体发行目录，并加载 Linux 镜像。
docker load -i openacad-worker.tar.gz
docker tag openacad-worker:verified openacad-worker:<版本>
# release.env 的唯一必需项为该版本专属镜像标签：
# OPENACAD_IMAGE=openacad-worker:<版本>
install -m 644 nginx.conf /etc/nginx/sites-available/openacad
ln -s /etc/nginx/sites-available/openacad /etc/nginx/sites-enabled/openacad
nginx -t
systemctl reload nginx
bash update.sh /opt/openacad/releases/<版本>-<提交短号>
certbot --nginx -d openacad.xyz --redirect --non-interactive --agree-tos --register-unsafely-without-email
curl --fail https://openacad.xyz/api/health
```

Certbot 命令仅操作新域名的虚拟主机。可以另行给证书登记维护邮箱；没有邮箱时依赖自动续期日志和定期健康检查。首次发布前，应确认 DNS 已解析到目标 IPv4。

## 更新与回退

发行脚本 `deploy/update.sh` 先启用维护标记，停止接收新计算/导出任务；已有结果仍可读取或取消。最多等待约 350 秒排空队列，然后启动新镜像，要求两名 worker 就绪，切换网页目录并重载 Nginx。检查失败时恢复上一发行；首次安装失败则关闭本次 OpenAcad 容器。

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

任务凭据和结果在最多一小时后过期；原输入在任务执行后移除。Inkscape/R 的临时文件位于容器 `/tmp`，单任务上下文结束时清理；容器重启也会清空 tmpfs。`/opt/openacad/shared/maintenance` 只控制是否接受新任务，更新成功或自动恢复后移除。

```sh
certbot renew --dry-run
# 确认更新进程已退出且服务正常后，才清理遗留维护标记：
rm -f /opt/openacad/shared/maintenance
```

验收应同时覆盖网站、真实统计、四种图片下载和项目文件重开；仅 `/api/health` 成功不等于功能验收完成。生产版本、发布日期和恢复演练结果另记在 `production-record.md`。
