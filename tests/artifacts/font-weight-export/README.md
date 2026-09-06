# 真实字体字重回归

本目录记录新增同源真实 Bold 字体后的后端回归，不覆盖 1.0.1 的历史实际下载记录。

Linux 的实际 Inkscape 1.2.2 完成 12 次小图转换，两个独立参数化回归均通过（4.05 秒）。本机未安装 Inkscape，因此本机 pytest 的两项为 skip，不能代替这里的真实容器结果。容器以默认用户 10001、只读镜像、1 CPU、512 MiB 内存运行，只读挂载新字体和回归测试；未使用 API、Redis 或生产服务。

- 黑体 Bold 的 PNG 黑色墨迹积分为 Regular 的 1.529228 倍。
- 宋体 Bold 的 PNG 黑色墨迹积分为 Regular 的 1.500769 倍。
- 两种字体 400/700 的实际 SVG 字形路径不同，转曲文件没有文本元素。
- 两种 700 PDF 的真实字体资源分别为 `NotoSansCJKsc-Bold` 和 `NotoSerifCJKsc-Bold`，没有先前的合成 `CairoFont` 名称。400 PDF 对应具名 Regular。
- 4 个 PDF 另经本机 Poppler 26.08.0 打开；字体资源均已嵌入。全部输出包含相同的小型中文/拉丁示例，原 SVG、输出和 PDF 预览均保留。

`server/app/export.py` 无 Regular 文件名白名单，按原目录加载全部字体，保留 `font-weight`，并动态输出整个 manifest；无需修改产品导出代码。容器中该文件和当前源码 SHA 完全一致。回归代码为 `server/tests/test_font_weights.py`，完整 CI 镜像构建时会随现有 pytest 执行；设置 `OPENACAD_FONT_EXPORT_EVIDENCE` 可保留实际产物，不设置则仅写 pytest 临时目录。

当前界面支持 SVG、PDF、EPS 的“文字转为路径”，PNG 是栅格格式，没有此选项。后端把选项传给 Inkscape `--export-text-to-path`。转曲取消文字可编辑/搜索能力；不同格式及不同解码器仍可能有抗锯齿差异，不宣称像素完全相同。修复针对真实字体字重生效，不能用转曲去掩盖缺失 Bold 字体的问题。
