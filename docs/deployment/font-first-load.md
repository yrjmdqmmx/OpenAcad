# 字体首次加载

磁异常模板首次打开原先加载 15 份字体，共 4,066,492 字节。少量中文散落在多个 1024 字符分片中，界面和科学图表又使用不同的字体资源；慢链路会拖延 `document.fonts.ready` 和截图。

现在由 `scripts/build-critical-webfonts.py` 从已有前端文字和固定的 Noto Sans Regular/Bold OTF 生成两份常用字 WOFF2，共 726,116 字节。UI 别名和科学图表共用同一 URL；完整字体的 CSS `unicode-range` 排除这些字符，其余字符继续按需加载原来的分片。没有修改原字体、字形、字宽、粗细、项目格式或服务器导出字体。SVG 继续按实际字符嵌入字体和 OFL 授权。

未使用字体 preload：WebKit 验证发现 preload 与后续使用会重复请求，所以通过实际请求预算防止再次引入重复传输。

维护命令（使用 `scripts/font-delivery-requirements.txt` 的隔离 Python 环境）：

```sh
python scripts/build-critical-webfonts.py
python scripts/build-critical-webfonts.py --check
cd web
npx playwright test e2e/font-first-load.spec.ts
```

两个原字体生成脚本会自动刷新共享子集。校验器核对固定源 SHA、有效字重与 CFF 矩阵、所有保留字形的轮廓和水平/垂直 metrics、完整且不重叠的 CSS 字符覆盖。PR 和正式发布均运行此检查。浏览器回归使用全新 context，要求磁异常首屏仅请求两份字体、总量小于 1 MB，并验证子集外的生僻字仍能显示和导出可编辑 SVG。截图继续等待字体完成，没有提高超时或禁用字体检查。

发布验收还需独立记录：相同限速下的前后冷缓存测量、线上准确 SHA、手机新 context 首屏与截图、实际 PNG/PDF/SVG 下载和文件解析。局部请求成功不能替代整页首次加载验收；模拟手机视口不等于实体手机测试。
