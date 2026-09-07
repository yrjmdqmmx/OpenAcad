# OpenAcad 开放学术

面向科研与学术工作的中文平台：55个可编辑科研绘图模板、真实统计、AB1 测序查看和 KO 到 pathway 表格转换。无需登录。

正式网站：[https://openacad.xyz](https://openacad.xyz) · 当前已部署 **1.1.0**。平台首页、生信工具、完整Linux CI、正式域名验收和恢复演练已完成；[发布记录](docs/deployment/production-record.md)保留运行源码、测试范围及限制。

- `web/`：React、TypeScript、D3/SVG；CSV/TSV/Excel、专业文件、IndexedDB草稿。
- `server/`：FastAPI、RQ、Redis、固定版本Python/R统计和Inkscape导出。
- [生物信息学工具](docs/bio-tools.md)：浏览器本地 AB1 解析、KEGG 对应关系转换与来源记录。

- [逐图研究](docs/research/README.md)：52个ChiPlot原站入口、54张卡和29×3树图层矩阵，明确区分代码、文档和操作证据。
- [验收索引](docs/acceptance/README.md)：逐模板输入、样式、图片和项目证据。
- [部署、更新与恢复](docs/deployment/README.md)。
- [当前交付状态与限制](docs/STATUS.md)。

开发：`npm --prefix web ci`，`npm --prefix web run dev`；网页默认127.0.0.1:5178，统计 API 代理127.0.0.1:18082，生信查询代理18083（启动方式见生信工具说明）。构建与检查：`npm --prefix web run build`、`npm --prefix web test`，浏览器检查在web目录运行`npm run test:browser`。真实服务联测设置`OPENACAD_LIVE_API=1`。统计环境见server/README.md。

模板和示例独立制作；模拟数据采用CC0并明确标注。第三方数据及字体许可见[数据来源](DATA-SOURCES.md)。源码为独立私有仓库，依赖遵循各自许可。没有将ChiPlot源代码、预览图或研究示例作为本站生产模板。
