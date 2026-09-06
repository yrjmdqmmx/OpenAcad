# 八面字体最终后端回归

这是本次字体修复的最终本机 Linux 引擎证据：63 项检查通过（39.27 秒），包括属性/样式表字重匹配、安全校验、相对字重边界，以及真实 Inkscape 输出。新增字体夹具实际转换 42 次；14 份 PDF 均经本机 Poppler 独立打开，字体全部嵌入，墨迹未触及页面边界。

两字体的 650/700：SVG 路径、PNG 解码像素和 PDF 字体资源相同；独立 PDF 预览也相同。400/700 的实际笔画不同。

两字体 × 400/700 的四个斜体组合：普通/斜体 SVG 几何和 PNG 像素不同，尺寸保持不变；PDF 分别具名嵌入 `OpenAcadNotoSansCJKsc-Oblique`、`OpenAcadNotoSansCJKsc-BoldOblique`、`OpenAcadNotoSerifCJKsc-Oblique`、`OpenAcadNotoSerifCJKsc-BoldOblique`，没有合成 CairoFont 资源。独立打开后的 PDF 普通/斜体预览也不同。

派生斜体是明确记录的 12° CFF FontMatrix Oblique 字体面，不声称原设计者绘制的 Italic。字体派生、来源及许可由 `server/fonts/oblique-derivation.json` 和同目录字体说明记录；本验证不修改字体。不同格式与解码器仍有抗锯齿差异，不声称像素完全相同。

`export.py` 对相对字重不猜测 CSS 级联：有效相对字重与必须改值的数值映射同时存在时，返回明确中文错误；单纯别名、`400.0` 等价替换不误报，字符串/custom property 中的字重词不误报。前端正常导出保存各文本实际 computed 绝对字重。方法文档在 `server/docs/API.md`。

原始 59 成功/2 斜体失败的真实证据保留于 `../final-regression/regression-status.json`，原型成功与先前纯数值验证也保留。本报告证明本机指定 Linux 引擎与冻结源码可用；正式发布仍由主代理的完整 CI 与线上验收确认。
