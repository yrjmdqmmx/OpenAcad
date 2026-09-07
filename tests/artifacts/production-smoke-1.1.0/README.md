# 1.1.0 正式服务独立验收

运行对象：https://openacad.xyz，源码 `7e68b5b9f740855e89bf5c8d49d0c5d8c6dfacff`。全部输入为本地确定性模拟数据，使用现有 TLS/代理配置，未重试 POST；每个任务通过 `Api.job` 在完成后清理其临时凭据与任务。

标准命令：`server/.venv/bin/python server/scripts/production_smoke.py https://openacad.xyz --output tests/artifacts/production-smoke-1.1.0`。原始 [report.json](report.json) 保留5项结果：PCA、R LM、PNG、PDF、EPS，`complete: true`。

另使用相同 PCA/LM 结果生成的 SVG，将外层文字设为700/italic，提交PNG与PDF两项新导出。通过同一 `check_export` 校验，PDF额外断言实际嵌入 NotoSansCJKsc-BoldOblique 与 NotoSerifCJKsc-BoldOblique。[补充报告](bold-oblique/report.json)独立保留，未改写五项原报告。

[汇总](summary.json)：7项全部通过。PNG通过逐块CRC、zlib/过滤还原和非空/边界检查；PDF/EPS以本机Poppler/Ghostscript独立打开，PDF用pdffonts检查嵌入。粗斜体PNG另由实际图像目视复核，中文完整，未触边。
