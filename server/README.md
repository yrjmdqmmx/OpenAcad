# OpenAcad 计算服务

Python 与 R 的真实计算服务；不运行用户提交的表达式或脚本。API 契约见 [docs/API.md](docs/API.md)。本目录可独立构建，不依赖其他产品或密钥。

```sh
docker build -t openacad-server:local server
docker run --rm openacad-server:local python -m pytest -q -p no:cacheprovider
```

API 默认 `uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log`。同镜像独立 worker 命令 `python -m app.worker`。两者连接相同 Redis，变量 `REDIS_URL`。代理应只公开 API；Redis 和 worker 不映射公网端口。无需账号登录，创建任务返回一次随机 capability，查结果与取消必须携带 Bearer。浏览器重载后凭证丢失则不能找回服务器任务；项目文件由浏览器独立保存。

任务数据默认保留最多 3600 秒，`JOB_TTL_SECONDS` 可调；运行完成即清除队列中的原始参数，仅保留结果至 capability 到期。单任务超时默认 300 秒，`JOB_TIMEOUT_SECONDS` 可调；R 子进程默认 240 秒，`R_TIMEOUT_SECONDS` 可调。取消/超时由 RQ 终止工作子进程；Linux 子进程设置父进程死亡信号，避免 R/Inkscape 遗留。Redis 建议关闭磁盘持久化，配置内存限额，API 前代理限制请求速率及 25 MB 请求体。

镜像固定 R 4.6.1 及基础镜像 digest。R 包及传递依赖使用 `r/packages.lock.json` 和 Posit 的 2026-09-06 CRAN 快照，安装后逐一核对版本。`r/renv.lock` 由该实际 R 环境通过 renv 1.2.4 生成，包含 16 个包的准确版本与来源；`r/write-lock.R` 保留生成步骤。Python 完整版本固定在 `requirements.lock`。Inkscape 由镜像 apt 安装，具体版本写入导出 provenance；正式发布必须按构建后的镜像 digest 部署，不按浮动镜像标签更新。中文字体使用 `fonts/` 内与网页来源逐字节一致的黑体、宋体完整 OTF，许可证和 SHA-256 同目录保留，镜像配置屏蔽 apt 的旧 CJK TTC。导出 provenance 包含可用字体哈希。

数值测试包含 Python 的距离语义、P 校正、PCA 重构、缩放方向、KDE 积分、检验和 GC；R 集成测试包含四种排序、三种回归、四种 Mantel、PCoA 负特征值修正及跨引擎 P 校正。R/Inkscape 缺失时仅跳过相应集成测试，发布验收必须在完整镜像内执行并要求零跳过。

统计约定：矩阵缺失值默认拒绝；描述统计、KDE 和独立组检验明确允许 null。CCA 指 canonical correspondence analysis，使用 vegan::cca。NMDS 不输出虚构解释率；报告 stress、稳定解重复情况。GAM 使用 mgcv 的高斯薄板样条 REML；LOESS 为高斯局部多项式。partial Mantel 的第三控制矩阵必须单独输入。PercentScaler 是本产品明示的百分比归一化定义，不能声称与语义未公开的 ChiPlot 内部实现相同。

SVG 外链、脚本、事件、foreignObject、外部 CSS、嵌入图片及实体被拒绝。导出仅允许内部 # 引用。EPS 不支持透明效果：出现透明度/滤镜时主动按所选 DPI 合并到不透明背景，文件含栅格图且返回中文说明；不丢弃透明效果冒充矢量。开启文字转曲线可减轻跨设备字体差异，SVG 转曲结果额外检查没有 text 节点。

Worker 容器健康检查为 `python -m app.worker_health`：必须在当前 hostname 下有存活 PID，状态为空闲或工作中，心跳不早于 90 秒。worker 的注册 TTL 设为 60 秒，空闲等待约 45 秒会更新心跳；运行时监视间隔为 30 秒。API 的 worker 数也排除旧心跳，但发布时应分别等待两个 worker 容器的检查通过。

任务清理同时覆盖正常结束、父进程发现工作子进程被硬杀、取消和 abandoned registry 恢复。每次结果持久化末步用 Redis 原子检查凭证剩余期限；凭证已撤销则删除任务与结果，取消先撤销凭证，避免竞态重建。原输入在失败保存前清空，故障结果也不能延长凭证期限。测试依赖锁为 `requirements-test.lock`（包含完整运行依赖与用于 Redis Lua 回归测试的 lupa）。
