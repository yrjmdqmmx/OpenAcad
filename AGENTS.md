# OpenAcad 开放学术

独立中文科研绘图项目。不要修改同机 PaperBanana 或 Tensor Auto 的源码、服务和数据。

- 前端：`web/`，React/TypeScript/Vite/D3；开发端口 5178，统计开发服务 18082。
- 后端：`server/`，FastAPI/RQ/Redis/Python/R/Inkscape。计算白名单和项目 schema 必须保持兼容。
- 模板注册：`web/src/templates/index.ts`；基本图、专业图、排序图、树图分别有独立目录。
- 数据、样式、图层、布局与已有分析结果都必须能通过 `.openacad.json` 往返。
- 所有新控件必须实际消费；不适用条件使用 `Control.visible`。新增示例用模拟数据并标注来源。
- 源站研究与自身验收分开记录，HTTP 200、代码有分支、实际操作通过不能互相替代。

验证按改动范围执行：用 `deploy/change_scope.py` 生成计划，再用 `python3 deploy/run_web_checks.py --plan <计划文件>` 完成前端构建及相关单元/浏览器用例。共享数据契约、依赖和未映射输入扩大为完整前端回归；只改前端不能触发 worker 构建。`OPENACAD_LIVE_API=1` 开启真实服务浏览器用例。没有统计 worker 时应明确记录跳过，不能声称统计通过。

生产发行采用固定提交与 Linux amd64 镜像，部署和恢复命令见 `docs/deployment/README.md`。操作新服务允许范围为 `/opt/openacad`、Compose 项目 `openacad` 与 `openacad.xyz` 虚拟主机。

业务位于杭州 `116.62.146.226`。日常更新合入 `codex/hangzhou-production`，由 GitHub 按线上前端与后端各自的实际版本比较差异并发布到 `/opt/openacad`；旧默认分支不自动发布。纯前端只切换网页目录，不拉镜像、不重启容器、不暂停队列；`server/` Docker 上下文变化才构建 worker，并走后端排空/恢复流程。发布工具变更先验证工具及基础网页流程；接收器由运维在 `/opt/openacad/operations/hangzhou/` 单独安装，流水线校验文件摘要。详见 `deploy/hangzhou/README.md`。香港/新加坡仅保留获准模型出口，不得恢复旧香港业务写入。
