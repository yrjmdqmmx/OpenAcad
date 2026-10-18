# OpenAcad 开放学术

独立中文科研绘图项目。不要修改同机 PaperBanana 或 Tensor Auto 的源码、服务和数据。

- 前端：`web/`，React/TypeScript/Vite/D3；开发端口 5178，统计开发服务 18082。
- 后端：`server/`，FastAPI/RQ/Redis/Python/R/Inkscape。计算白名单和项目 schema 必须保持兼容。
- 模板注册：`web/src/templates/index.ts`；基本图、专业图、排序图、树图分别有独立目录。
- 数据、样式、图层、布局与已有分析结果都必须能通过 `.openacad.json` 往返。
- 所有新控件必须实际消费；不适用条件使用 `Control.visible`。新增示例用模拟数据并标注来源。
- 源站研究与自身验收分开记录，HTTP 200、代码有分支、实际操作通过不能互相替代。

验证：`npm --prefix web test`、`npm --prefix web run build`；浏览器从 `web/` 运行 `npm run test:browser`。`OPENACAD_LIVE_API=1` 开启真实服务浏览器用例。没有统计 worker 时应明确记录跳过，不能声称统计通过。

生产发行采用固定提交与 Linux amd64 镜像，部署和恢复命令见 `docs/deployment/README.md`。操作新服务允许范围为 `/opt/openacad`、Compose 项目 `openacad` 与 `openacad.xyz` 虚拟主机。

2026-10-18：业务现位于杭州 `116.62.146.226`。日常更新合入 `codex/hangzhou-production`，由 GitHub 自动测试/构建并发布到 `/opt/openacad`；旧默认分支不自动发布。接收器保留 Redis、现网参数和其他项目，仅更新 API/两个 Worker 与静态网页；正式执行结果见 `docs/deployment/hangzhou-auto-deploy-20261018.md`。香港/新加坡仅保留获准模型出口，不得恢复旧香港业务写入。
