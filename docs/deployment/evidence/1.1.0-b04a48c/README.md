# 1.1.0-b04a48c 发行证据

本目录记录固定源码 b04a48cb71e8e14417e6027651d2c8c286c74cfc 的本次发行。入口见 [发布记录](../../production-record.md) 与 [逐模板生产验收](../../../qa/journal-figure-quality-production-2026-09-08.md)。

`qa-tools/` 与两份网页准备脚本为本次执行方法的审计副本，含当次固定源码、服务器与本机证据路径；不是可直接用于其他版本的通用发行工具。网页包从已核验 GitHub ZIP 提取，旧文件仅在内容 SHA 相同时复制，最终 398 个文件全部对照 CI 清单核验；没有重建应用。

220 份实际下载、完整截图和本机可交互报告保存在 `/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/release/production/`。`export-files.json` 保存每份文件字节数与 SHA；本目录保留代表大图、前后对照、全量概览和结构化结果。

旧项目首轮脚本因误选临时 SVG 测量副本失败，修正为工作台直接 SVG 后 4 项全部通过；首轮日志保留。UpSet 本地/生产 PNG 的细小文字基线差异单独记录，未改写为逐像素一致。EPS 透明效果可包含栅格。
