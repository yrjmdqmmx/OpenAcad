# OpenAcad 开放学术

中文科研绘图与统计工作台：55个可编辑模板，直接试用模拟数据、替换自己的数据、调整样式并下载图片或可继续编辑的项目。无需登录。

正式网站：[https://openacad.xyz](https://openacad.xyz) · 当前已部署 **1.0.2**。V1功能、完整Linux CI、正式域名验收和恢复演练已完成；[发布记录](docs/deployment/production-record.md)保留运行源码、测试范围及限制。

- `web/`：React、TypeScript、D3/SVG；CSV/TSV/Excel、专业文件、IndexedDB草稿。
- `server/`：FastAPI、RQ、Redis、固定版本Python/R统计和Inkscape导出。
- [逐图研究](docs/research/README.md)：52个ChiPlot原站入口、54张卡和29×3树图层矩阵，明确区分代码、文档和操作证据。
- [验收索引](docs/acceptance/README.md)：逐模板输入、样式、图片和项目证据。
- [部署、更新与恢复](docs/deployment/README.md)。
- [当前交付状态与限制](docs/STATUS.md)。

开发：`npm --prefix web ci`，`npm --prefix web run dev`；网页默认127.0.0.1:5178，本地API代理127.0.0.1:18082。构建与检查：`npm --prefix web run build`、`npm --prefix web test`，浏览器检查在web目录运行`npm run test:browser`。真实服务联测设置`OPENACAD_LIVE_API=1`。统计环境见server/README.md。

模板和示例独立制作；模拟数据采用CC0并明确标注。第三方数据及字体许可见[数据来源](DATA-SOURCES.md)。源码为独立私有仓库，依赖遵循各自许可。没有将ChiPlot源代码、预览图或研究示例作为本站生产模板。
