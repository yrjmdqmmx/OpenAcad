# 科研绘图 P1/P2 修复与验收（2026-09-07）

本轮范围为 55 个科研绘图模板的默认数据、控件、版式、项目往返与导出。保留已有首页科研实景轮播、图研布局和模板详情工作。项目 schema 仍为 v1；新示例预设仅在新建项目时应用，不覆盖用户已有项目。

## 修复内容

- 连续色带、火山类别和富集显著性配色实际消费所选方案；树图使用注释自身的配色入口。标签与数值开关按对象命名，不适用的设置隐藏。
- 排序分析按数据、算法和参数散列检查结果有效性。无结果或结果失效时禁止导出，并给出返回分析入口；已有坐标模式独立判断。
- 工作台默认适应可视区域；树画布随注释扩展后重新适配，100% 显示时顶部可以滚达。自动标签避让保留真实点位和已保存的手动偏移。
- 横向图方向切换时一起交换两轴标题与单位，旧项目原有坐标语义不变。
- 55 个默认图内保留模拟说明；误差图动态标注 SD / SE / 95% t 区间及实际 n。基础图加入具名指标与单位，分布示例包含偏态、离群和重叠，组成图采用真实意义的组成项。
- 补充矩阵文字对比、相关显著性说明、气泡大小与 Mantel 线宽/颜色图例；统一柱线系列配色，分层堆叠标签，修正 UpSet 整数轴、韦恩区域计数、玫瑰图面积编码。
- 蛋白基序采用独立短片段；网络采用模块结构，流向示例保持流量守恒，基因组/共线性图补充轨道说明与倒位区段；树提供可编辑注释预设。
- 五种排序图的 18 样本、3 分组示例由真实服务计算。Pearson 与 Mantel 示例从模拟原始观测实算，保存原始请求与算法来源；火山和富集的展示输入明确标为模拟结果，不能当成实际检验。

## 复现

先启动依赖与统计 worker，确认 `/api/health`；没有真实服务时应跳过真实分析及服务导出，不能据此宣称通过。

```sh
npm --prefix web test
npm --prefix web run build
cd web
npm run test:browser
OPENACAD_LIVE_API=1 npm run test:browser -- --project=chromium live-analysis.spec.ts live-export.spec.ts
OPENACAD_LIVE_API=1 OPENACAD_QUALITY_OUTPUT=/absolute/qa/output npm run test:browser -- --project=chromium template-quality.spec.ts
npm run test:browser -- --project=chromium template-control-quality.spec.ts template-layout-quality.spec.ts
```

独立验收端口可用 `OPENACAD_BASE_URL=http://127.0.0.1:5181` 指定。完整质量用例实际打开工作台、改控件、下载项目、重新打开、再下载 SVG / PNG / PDF / EPS。PNG 使用 150 DPI；并非所有 DPI、透明度、文字转路径和编辑软件的笛卡尔积。

更新实算示例：

```sh
python3 scripts/refresh-ordination-examples.py
node scripts/refresh-reference-hashes.mjs
python3 scripts/refresh-correlation-examples.py
```

两个 Python 脚本使用 `OPENACAD_EXAMPLE_API`，默认本地 `http://127.0.0.1:18082`。生成物保留输入和算法来源，勿手填统计结果。

## 环境说明

本地旧 QA worker 缺少粗体字形，但此前正式站 PNG 粗体正常。本次在 OpenAcad QA worker 中补齐仓库已有字体后验收，未将该环境差异当成生产前端缺陷。该本地 QA 镜像为当前主机架构，不是生产固定提交的 Linux amd64 发行镜像。

EPS 不支持透明度，服务可能将含透明度图形栅格化；本轮检查画面与尺寸一致性，不保证全部 EPS 元素仍可单独矢量编辑。保留文字的 SVG 在接收端需要相应字体，投稿需按用途选择文字转路径。

以上为 2026-09-07 至 09-08 的本地验收记录，验收结束时尚未提交或部署。后续提交、Linux CI 与生产状态分别记录，不将本地通过视为上线完成。
