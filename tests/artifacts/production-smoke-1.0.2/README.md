# 1.0.2 正式生产验收

**七项真实任务及本机独立检查全部通过，`report.json` 为 `status: passed`、`complete: true`。** 2026-09-06 19:24:54 UTC 开始，19:26:24 UTC 完成独立数值与解码检查，随后完成五张预览的视觉检查。

本次实际发行目录为 `/opt/openacad/releases/1.0.2-4433576`；源码 `443357603240c87b9d28ebce346e8e87ea0d7f88`；启动前核对的实际 Docker 镜像 ID 为 `sha256:31827c08ecfc92178d3bb26bb8adc29467070a11471b8068f898188d4c93acda`。HTTPS 健康检查返回服务正常、队列可用、两名活跃 worker。完整身份、实际命令及执行边界记录在 `execution.json`。

| 任务 | 实际验证结果 |
| --- | --- |
| PCA | 得分与载荷重构模拟输入，最大绝对误差 `5.329070518200751e-15`；解释率之和为 1 |
| R LM | 独立最小二乘截距 `4.094083486474121`、斜率 `1.484451480355718`；系数容差 `1e-10`；80 个预测点及其置信区间通过 |
| PNG | 150 DPI，实际解码为 1500×875；SHA、CRC、像素及页面边界通过 |
| PDF | Poppler 26.08.0 打开，96 DPI 预览为 960×560；黑体、宋体 Regular 字体均已嵌入 |
| EPS | Ghostscript 10.07.1 打开，预览为 960×560；透明置信带明确记录 `EPS_ALPHA_FLATTENED` |
| 粗斜体 PNG | 1500×875；黑体、宋体 700 italic 均可见，中文可读、无明显裁切 |
| 粗斜体 PDF | 两个具名 `OpenAcadNotoSansCJKsc-BoldOblique`、`OpenAcadNotoSerifCJKsc-BoldOblique` 均真实嵌入，无合成 `CairoFont` 资源；中文粗斜体可见 |

五个导出文件均独立打开、墨迹未触及页面边缘；SHA、墨迹坐标、字体清单和检查方法保留在 `report.json`。所有导出任务返回的八面字体完整 SHA 集合均与 `expected-font-manifest.json` 一致。粗斜体采用明确标注的 OpenAcad 12° CFF FontMatrix 派生字体；正式字体未因 WebKit 测试裁片定位问题而改变。本次不声称跨格式抗锯齿逐像素一致，也不将包含透明栅格合成的 EPS 称为纯矢量文件。

冻结五任务脚本 SHA 为 `744ac93024a8e687a963a36b4d47884fc786dcfd618fa9807e341307beec6580`，七任务包装器及字体清单的哈希见 `SHA256SUMS`。独立容器通过正式 HTTPS 域名提交，仅使用模拟数据与文字，正常校验证书；以默认用户 10001、只读镜像、0.5 CPU、256 MiB、96 进程和 64 MiB 临时目录运行。只挂载验证脚本和独立输出目录，不接触应用数据。七项任务均检查缺失/错误凭据返回 404，完成后删除自己的任务并再次确认 404；访问凭据未写入证据。实际传输重试为零，POST 未重试。

原始服务器阶段报告保留在 `server-report-before-independent-open.json`；`baseline/report.json` 也保留服务器阶段的部分验证状态。最终结论以本目录顶层 `report.json` 为准。`preparation.json`、`upload-verification.json` 为执行前的历史状态，旧生产验收目录未覆盖。已执行的输出目录禁止重新提交任务；复现应使用新的独立目录和经确认的发行身份。

本次七项生产任务与 CI 测试计数分列：正式 CI 为 **186 项**；字体与导出专项 **63 项是其中子集**，不能相加。既有本地字体专项的 **42 次转换、14 个独立 PDF 打开**是产物验证计数，保留在 `../font-weight-export/all-faces-final/`，不是额外 CI 测试数。本次产品文件、DNS 和服务器配置均未修改。
