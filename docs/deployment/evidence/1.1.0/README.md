# 1.1.0 发布证据

运行源码固定为 `7e68b5b9f740855e89bf5c8d49d0c5d8c6dfacff`；目录 `/opt/openacad/releases/1.1.0-7e68b5b`。后续归档提交不改变运行源码。

CI、附件摘要、重组与实加载镜像、HTTPS、KEGG真实响应、回退及同机隔离各自保留结构化报告。人工浏览器观察与自动测试报告分开。

`publish.txt` 与回退的 TXT 日志仅去除 Docker 输出行尾空格，未改动内容。原始 `.log` 保留在本地或 `/opt/openacad/verification/1.1.0/version-rehearsal/`，不覆盖历史发行。

`verify-browser-downloads.py` 只读取本次实际下载并在同一证据目录生成独立预览，不调用服务器。SVG执行XML/转曲结构检查；PNG/PDF/EPS进行实际像素或独立解码。生产浏览器完整报告与原文件见 `tests/artifacts/production-browser-1.1.0*`。
