# 1.0.2 线上实际下载文件独立复核

本次复核 `live-exports/` 中桌面和手机各 4 个实际下载文件。源发行 `443357603240c87b9d28ebce346e8e87ea0d7f88`；先确认本轮 `manifest.json` 的发行标识，再逐文件核对原始 SHA-256 和字节数。只在本机重新打开文件，没有提交线上任务，没有修改产品、原下载或旧版证据。

**8/8 独立打开及边界检查通过，人工看图通过。** SVG 为 960×640 px，PNG 为 1500×1000 px（150 DPI），PDF 为一页 720×480 pt，EPS BoundingBox 为 `0 1 720 481`（页面 720×480 pt）。SVG/PDF/EPS 以 96 DPI 独立渲染为 960×640 px。所有非白色可见墨迹均未触及页面边界。中文标题、说明、坐标轴和分类标签清晰，无明显缺字框或裁切。

- SVG：Google Chrome 152.0.7977.76 直接打开本地文件；无外部请求、页面错误，69 个路径、0 个文本元素、0 个嵌入图像，文字已转曲。
- PNG：复用 `server/scripts/production_smoke.py` 中实际 `png_check` 函数，通过 AST 只加载该函数；检查签名、全部块 CRC、zlib/行过滤解码、真实像素和墨迹边界，无 API 客户端依赖或网络调用。
- PDF：Poppler 26.08.0 独立检查和渲染。桌面与手机均真实嵌入 `CQDAFL+NotoSerifCJKsc-Bold` 和 `ZAZLPD+NotoSerifCJKsc-Regular`，没有 `CairoFont` 合成资源。粗体标题在四种预览中清楚可见，未见旧版仅 PDF 合成粗体导致的明显字重差异。
- EPS：Ghostscript 10.07.1 以 `-dSAFER -dBATCH -dNOPAUSE -sDEVICE=pngalpha -r96 -dEPSCrop` 独立解码。

每个格式的桌面和手机独立预览 SHA 相同，因此人工逐格式检查 4 张桌面预览可对应这 8 份下载；这不表示不同格式的像素完全相同。PNG 的 DPI 和各独立渲染器的抗锯齿不同。

仍需保留的限制：PDF 复制文字包含部分兼容部首码位，预期标题和提取文字同做 Unicode NFKC 后一致；EPS 含一张 Cairo 栅格合成图，不能宣称纯矢量或全文字可编辑；PNG 自身不能反推出字体文件身份。样例视觉检查和外边界检查不等于所有数据、所有图表均绝无内部裁切。

检查器还对临时复制的旧 1.0.1 下载做负例自检：6 份格式/解码检查通过，两份缺少真实 Bold 的旧 PDF 被准确拒绝。这是检查器有效性证据，不计入本轮 8 份验收，不改旧记录。

逐文件 SHA、工具版本、尺寸、PDF 字体清单、墨迹边界、负例自检与视觉结论见 `independent-export-verification.json`；6 张独立 SVG/PDF/EPS 预览和 SVG 浏览器结构报告在 `independent-previews/`，PNG 直接检查原下载。

可重复运行机器检查（需要 Python 3、Node、web 的 Playwright 依赖、本机 Chrome、Poppler 和 Ghostscript）：

```sh
python3 tests/artifacts/production-browser-1.0.2-artifacts/independent-check.py \
  tests/artifacts/production-browser-1.0.2-artifacts \
  --repo /Users/a1-6/Documents/ChatGPT/OpenAcad \
  --source-revision 443357603240c87b9d28ebce346e8e87ea0d7f88
```

重复运行会重新产生机器报告并把人工视觉状态设回待审；必须再次实际看图后才能标记整项通过。原始 8 份下载始终只读。
