# WebKit 截图坐标的测试失败记录

源码 `27d1b194fc896e0b7e2977e1688ee94c337ef999`，未部署。

Linux CI [34052400211](https://github.com/yrjmdqmmx/OpenAcad/actions/runs/34052400211) 中，311项前端单测、186项后端全套测试通过；浏览器80通过、223按配置跳过、1失败。唯一失败是WebKit的真实斜体像素检查。Chrome和Firefox对应检查通过。本机macOS WebKit也用同一专项复现。

进一步人工检查附件确认：`sans-400-0-normal.png`、`sans-400-1-italic.png` 等实际截到画布边缘空白，没有标题。WebKit对SVG text的定位导致原测试采用的locator.boundingBox裁片坐标不正确；不能据空白图相同推断字体不工作。最小WebKit原型 `webkit-fontmatrix-visible.png` 显示同一字体的常规和斜体确实不同。修复应使用SVG getBBox与getScreenCTM映射正确裁片、检查内容并在三浏览器复验，不改已验证字体。

四张原始失败PNG与SHA见 `evidence.json`；保存本机报告与CI失败日志，不保存原始trace归档。此目录保留诊断过程，最终测试与上线状态见 `docs/deployment/production-record.md`。
