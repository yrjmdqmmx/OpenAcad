# OpenAcad 55 模板科研插图视觉质量改造

基线提交：`88e22f6862586b9d9e1bcdec3804c30ce44ecd4c`。工作分支：`codex/journal-figure-quality`。状态：本地实现与验收；没有发布到生产。

用户目标：真实论文启发下的类型专属设计；实际 SVG 渲染、编辑、统计和项目往返保持可用。先建立全部 55 项差距清单，再按 6 / 23 / 10 / 10 / 6 分批实施。初始差距与截图保留在证据目录，最终来源取本文件及 `papers.json`，不沿用候选阶段未核实的图号。

本次证据目录：[/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality)；[交互报告](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/report.html)；[逐模板机器记录](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/final-gap-ledger.json)。

## 参考核验边界

公开论文共 21 个条目；15 篇已查看对应图像，6 个条目为方法、反例或未确认图片的候选。直接同类与设计迁移逐项标明。Circos / MCScanX 原图尚未完成核验，不能视为已经完成的原图视觉研究。

## 设计与实现约束

标题、方法注记、主体、坐标与图例形成清楚层次。新建项目使用 Noto Sans SC；正文默认 17、标题 24，刻度与高密度轨道按类型设定。不是给 55 图套同一颜色：单变量用单色，非负矩阵用顺序色，相关性以 0 为中心用发散色，分组使用定性色并在散点/排序/网络中叠加点形。保留可编辑 SVG text、D3 坐标与真实数据几何。

共享 `FigureHeading` 以 SVG tspan 换行；各类 renderer 控制自己的轴、间距、图例和密度。`publicationDefaults.ts` 写入新项目默认设置；旧 schemaVersion=1 项目不会被强制迁移样式。新的曲线末端标注与按组点形均由真实渲染代码消费。模板卡片、详情页和工作台采用相同项目与渲染器，55 项去除动态 id 后 SVG 内容哈希一致。

所有新增数据均为模拟数据，不能作为真实实验结论。误差图从原始观测计算 SD、SE 或 t 置信区间，并按实际分组显示 n；箱线、密度和集合按实际输入计算。火山图保存 360 个基因的 8+8 个 log₂ 观测，执行双侧 Welch 检验，P 未校正；富集图从 N=6000、n=180 的虚构 SIM 集合执行超几何检验，并对全部 8 个通路作 BH 校正。原始观测、背景、成员、方向和检验表随项目保存。蛋白/共线性展示模拟位置，不运行序列检索，P/E 留空；主动设置低于 1 的筛选阈值会排除未提供检验值的片段。GC 轨道是模拟数值输入，不称为序列计算结果。树保持输入分支长度，未添加虚构支持度。

## 全量差距清单与最终方案

|批次 / 模板|原先差距|实施内容与原因|具体参考及迁移边界|
|---|---|---|---|
|2 · 分组柱状图 `bar-grouped`|两组仅靠色相；柱间与组间节奏弱|组间距大于组内距；蓝橙对比，统一零起点|R01 Fig 1（汇总与观测层次迁移）；[R01 Fig 1；Fig 2 为配对表达方法补充](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)|
|2 · 散点图 `scatter`|点密度偏低、坐标视觉过弱|丰富具噪声观测，点白边与安静网格；不自动添拟合或显著性|R03 Fig 4a；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|2 · 折线图与分组折线图 `line`|点小、线淡，读者反复寻找图例|加粗曲线与空心节点、直接末端标签；保留线性连接|R07 Fig 4a–f；[R07 Fig 4a–f](https://essd.copernicus.org/articles/17/965/2025/)|
|1 · 数值热图 `heatmap`|正值矩阵用了隐含中心的发散色；细格间隙与数据混杂|顺序色带，具名分组色条，单小数值，协调单元格比例|R03 Fig 1；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|2 · 箱线图 `box`|分布观测为细黑点，箱线与点混合|淡箱体、空心观测、强调中位线；显示真实 IQR/离群|R01 Fig 1；R13 Fig 3；[R01 Fig 1；Fig 2 为配对表达方法补充](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|2 · 饼图与环图 `pie`|只有比例外围标签，名称需寻图例|环旁直接类别与比例、细分隔，扇区面积不变|R13 Fig 1c/f（组成色义迁移，原图为堆叠柱）；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|2 · 柱状图 `bar`|单系列四柱却用了四种分类色；柱面压过刻度|单主色、窄柱、直接数值；保持零基线|R03 Fig 4b；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|2 · 分类柱状图 `bar-category`|长功能名与纵轴标题空间紧；图例距主体远|横向排名，完整换行标签；分组颜色与端点数值|R03 Fig 4b；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|1 · 误差柱状图 `bar-error`|实心柱、黑色观测和误差互相掩盖|淡柱底、空心观测、清楚的均值误差；保留离群和真实 SD/SE/tCI|R01 Fig 1；R19 Fig 2D；[R01 Fig 1；Fig 2 为配对表达方法补充](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)；[R19 Fig 2D](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0121546)|
|2 · 分组误差柱状图 `bar-grouped-error`|较密观测遮住误差帽|组内窄柱和较小空心点；黑色误差前景|R01 Fig 1；R19 Fig 2D；[R01 Fig 1；Fig 2 为配对表达方法补充](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)；[R19 Fig 2D](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0121546)|
|2 · 散点误差图 `scatter-error`|均值点与原始观测区分弱|增大中心点，减弱观测，短误差帽；保持真实样本量|R19 Fig 2D；[R19 Fig 2D](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0121546)|
|2 · 堆叠柱状图 `bar-stacked`|组成只有三组且色块饱和|更多有场景样本，协调定性色，细白分隔与总量说明|R13 Fig 1c/f；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|2 · 分组堆叠柱状图 `bar-grouped-stacked`|组头和堆叠内阅读层级接近|加强两层间距、弱组界、百分比刻度|R13 Fig 1c/f（嵌套分组迁移）；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|2 · 柱状图与折线组合 `bar-line`|折线细淡而柱太厚，双轴辨识弱|折线加粗与点形强化、柱收窄；分别标明轴单位，不伪称同一尺度|R07 Fig 4a–f（时序层次迁移，双轴是本项目设计）；[R07 Fig 4a–f](https://essd.copernicus.org/articles/17/965/2025/)|
|2 · 棒棒糖图 `lollipop`|多色短样本缺少排名信息|同色杆端，直接数值、增加真实场景指标|R03 Fig 4b（排名条形的杆端表达）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|2 · 分类棒棒糖图 `lollipop-category`|杆过细、长标签截断|端点突出，完整类别换行、精简网格|R03 Fig 4b（排名条形的杆端表达）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|2 · 分组误差折线图 `line-error`|误差帽与线节点叠为墨点|节点与误差层级分开；误差定义及 n 始终可读|R07 Fig 4a–f；R01 Fig 1；[R07 Fig 4a–f](https://essd.copernicus.org/articles/17/965/2025/)；[R01 Fig 1；Fig 2 为配对表达方法补充](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)|
|2 · 分组箱线图 `box-grouped`|两组密集时箱体边界不清|对齐组内箱线、减淡原始点、分组色固定|R13 Fig 3；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|2 · 小提琴图 `violin`|尾部窄且黑观测压过密度|明确轮廓与低透明填充，箱线独立，保留密度参数|R21 Fig 2（半密度迁移）；R08 Fig 2e；[R21 Fig 2](https://www.nature.com/articles/s41598-025-21890-x)；[R08 Fig 2e](https://www.nature.com/articles/s41593-022-01061-1)|
|1 · 云雨图 `raincloud`|雨点细碎且箱线太扁；组间高度大|密度、箱线、原始点分三个可读层；每层 n 可核验|R21 Fig 2；R02 Fig 3/4（方法补充，图像未确认）；[R21 Fig 2](https://www.nature.com/articles/s41598-025-21890-x)；[R02 Fig 3、4](https://wellcomeopenresearch.org/articles/4-63/v2)|
|2 · 峰峦图 `ridgeline`|只有三层，不易体现分布渐变|六个时间窗口的非单调模拟观测；真实 KDE，细轮廓与轻参考线|R08 Fig 2e；[R08 Fig 2e](https://www.nature.com/articles/s41593-022-01061-1)|
|2 · UpSet 集合交集图 `upset`|数量条与成员矩阵距离远，灰点太淡|协调数量条/行引导/连接点的尺度；交集精确计数|R09 Fig 3；R14 Fig 6（方法文字补充）；[R09 Fig 3](https://www.nature.com/articles/s41598-019-45835-3)；[R14 Fig 6](https://pmc.ncbi.nlm.nih.gov/articles/PMC4720993/)|
|2 · 玫瑰图 `rose`|八方向多色，方向与数量双重解码|单色数量瓣，方向直标，径向刻度；保持原面积/半径编码规则并写明|R05 Fig 1e；[R05 Fig 1a（地图）、1e（方向玫瑰图）](https://www.nature.com/articles/srep03324)|
|2 · 雷达图 `radar`|多边形小、填充叠压，外围留白多|统一量纲0–100，扩大有效半径，降低填充、强化线和节点|R20 Fig 2b（只借鉴层次，不沿用截断轴）；[R20 Fig 2b](https://www.nature.com/articles/s41467-022-35672-w)|
|2 · 哑铃图 `dumbbell`|端点太细，配对方向依赖图例|增大差异端点，轻连接线、直接前后名称与数值|R01 Fig 2（配对方法，图像未确认；本项目独立设计）；[R01 Fig 1；Fig 2 为配对表达方法补充](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)|
|2 · 分组散点图 `scatter-grouped`|分组仅靠颜色|色彩加点形、适当透明度；保留样本重叠|R03 Fig 4a；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · 圈形热图 `circle-heatmap`|中心文字堆叠，环轨颜色差别低|压缩中心说明、加强轨道层级，顺序色带和外圈标签|R03 Fig 1（矩阵色义迁移，环形是本项目设计）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · 圆点二值图 `binary-dot`|空缺与存在差距不够明确|实心存在、空心缺失，行组轻引导；不依赖颜色单一判断|R03 Fig 1（存在/缺失矩阵迁移）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · 方格二值图 `binary-rect`|矩阵大色块扁平，标签细|稀疏白色缺失与色块存在；细分组条和较大标签|R03 Fig 1（存在/缺失矩阵迁移）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · 数值气泡矩阵 `bubble-matrix`|数值覆盖小气泡；颜色面积双编码不够清楚|少量有效精度、白边圆、独立面积与颜色图例|R03 Fig 1（矩阵层次迁移，面积编码为本项目设计）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · 组内相关性热图 `correlation`|重复上下三角，满格过重|下三角默认、零点中性色、系数星号分行；r 固定[-1,1]|R03 Fig 1（矩阵层次迁移，相关系数采用独立发散色设计）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · 组间相关性热图 `double-correlation`|双组行列无视觉区分|矩形相关矩阵完整保留；两组方向与发散色明确|R03 Fig 1（矩阵层次迁移）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)|
|3 · Mantel 关联热图 `mantel`|连线与矩阵争夺空间，图例过小|左侧网络与右矩阵独立区域；线宽 r 和线色 P 明确|R03 Fig 1、5；R06 Fig 1a–c（矩阵/连线组合迁移，非直接 Mantel 范例）；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)；[R06 Fig 1a–c（网络）、1d（流向图）](https://www.nature.com/articles/s41467-021-21824-x)|
|4 · 韦恩集合交集图 `venn`|重叠区接近混色，计数标签弱|低饱和填充和清楚描边、交集数前景；不宣称圆面积比例|R13 Fig 4；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|4 · 分组圆堆砌图 `packing`|15节点过于规则，名称数字拥挤|有长尾丰度的四生境类群；组围圆轻填充、标签按圆空间换行|R13 Fig 2；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|4 · 桑基流向图 `sankey`|节点文字小、长流带占滿高度|紧凑节点、端点直标，灰背景流与分组重点色；数量守恒|R06 Fig 1d；[R06 Fig 1a–c（网络）、1d（流向图）](https://www.nature.com/articles/s41467-021-21824-x)|
|4 · 动态关系网络图 `network`|链状结构松散、边与节点标签弱|合理模块连接模拟，确定布局、节点白边、边宽与模块色分离|R03 Fig 5；R06 Fig 1a–c；[R03 Fig 1；Fig 4a–b；Fig 5](https://www.nature.com/articles/s41467-020-18873-z)；[R06 Fig 1a–c（网络）、1d（流向图）](https://www.nature.com/articles/s41467-021-21824-x)|
|4 · 地理采样点地图 `map`|地图占比大而采样点过小，中文名拥挤|中性底图，清楚样点面积图例，少量注释和避让；地理位置不变|R05 Fig 1a（底图层级）；R20 Fig 2a（空间数据迁移）；[R05 Fig 1a（地图）、1e（方向玫瑰图）](https://www.nature.com/articles/srep03324)；[R20 Fig 2b](https://www.nature.com/articles/s41467-022-35672-w)|
|1 · 差异表达火山图 `volcano`|标签用同等字体，阈值线无就近标值|更丰富的模拟结果、清楚蓝/灰/橙类别，阈值注释和避让|R11 Fig 3a（关联火山式表达，原横轴并非 log2FC）；[R11 Fig 3a](https://www.nature.com/articles/s41467-017-02391-6)|
|3 · 富集气泡图 `enrichment-dot`|条目与数值气泡间空白大、图例小|更长功能名、统一单行对齐，面积Count与顺序q色明确|R15 Fig 3G–I（富集条形迁移，面积图例为本项目设计）；[R15 Fig 3G–I](https://www.nature.com/articles/s41598-025-23736-y)|
|3 · 富集条形图 `enrichment-bar`|数值标签小、排序信息弱|横向排序、右端GeneRatio直标；q颜色始终有键|R15 Fig 3G–I；[R15 Fig 3G–I](https://www.nature.com/articles/s41598-025-23736-y)|
|3 · 富集圈图 `enrichment-circle`|多轨颜色同等抢眼、外围标签细|各轨单独色义与内外层次、增大标签空间|R15 Fig 3G–I（富集色义迁移）；R10 Fig 2（多轨对齐迁移）；[R15 Fig 3G–I](https://www.nature.com/articles/s41598-025-23736-y)；[R10 Fig 2](https://bmcplantbiol.biomedcentral.com/articles/10.1186/s12870-025-07172-8)|
|4 · 基因簇排列图 `gene-cluster`|五行注释文字細且节奏均匀|更清楚bp坐标与链方向；功能色固定、组标签与箭头分层|R10 Fig 2（位置与基因结构轨道）；[R10 Fig 2](https://bmcplantbiol.biomedcentral.com/articles/10.1186/s12870-025-07172-8)|
|4 · 蛋白保守结构域图 `protein-domains`|不同结构域长度的比较不突出|同尺aa轨道、较粗结构域条、轻基线、直标长度|R10 Fig 2；[R10 Fig 2](https://bmcplantbiol.biomedcentral.com/articles/10.1186/s12870-025-07172-8)|
|4 · 蛋白保守基序图 `protein-motifs`|短基序标记过小，母体轨道太淡|增强短片段描边、统一比例尺和基序键；不能放大改变命中长度|R10 Fig 2；[R10 Fig 2](https://bmcplantbiol.biomedcentral.com/articles/10.1186/s12870-025-07172-8)|
|4 · 基因组圈图 `genome-circos`|三染色体稀疏，环轨与连线色义混合|五染色体有区间和长短变异；明确GC正负/轨道与连线|R16 Fig 5（论文/图注已核实，原图未确认）；[R16 Fig 5；Fig 1–4 为折页](https://genome.cshlp.org/content/19/9/1639)|
|4 · MCScanX 共线性图 `synteny`|基因和染色体标签細，平行色带生硬|较宽染色体、低透明连接、清楚倒位与bp标尺|R17 Fig 3A–D（原文 XML/图注已核实，原图未确认）；[R17 Fig 3A–D](https://doi.org/10.1093/nar/gkr1293)|
|1 · 主成分分析 PCA `pca`|样本点与载荷标签争夺注意，坐标网格密|点形+颜色冗余分组，安静零线、更大点；真解释率和原坐标|R13 Fig 5（PCoA 的排序视觉迁移）；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|5 · 主坐标分析 PCoA `pcoa`|少数散点标签挤在一起|固定点形语义、长标签避让、明确距离方法与轴解释率|R13 Fig 5；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|5 · 非度量多维尺度 NMDS `nmds`|空间小、stress状态贴边|stress保留在独立状态位置、组形状与点间距清楚|R13 Fig 5（排序视觉迁移）；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|5 · 典范对应分析 CCA `cca`|环境箭头与样本标签同权|统一环境向量深色、引导线，轴标保留真实算法口径|R13 Fig 5（排序视觉迁移，环境箭头为本项目设计）；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|5 · 冗余分析 RDA `rda`|标题重、箭头小、样本组色近似|增强载荷向量和分组点；不改变向量缩放语义|R13 Fig 5（排序视觉迁移，环境箭头为本项目设计）；[R13 Fig 1c/f、2、3、4、5](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)|
|5 · 矩形进化树工作台 `tree-normal`|7叶树太简单，图例和标题拥挤|24叶模拟亲缘层级及对应性状；细枝、对齐叶名、比例尺和独立轨道|R10 Fig 2（对齐树/性状）；[R10 Fig 2](https://bmcplantbiol.biomedcentral.com/articles/10.1186/s12870-025-07172-8)|
|1 · 环形进化树工作台 `tree-circle`|7叶树被宽轨道盖过，树芯过小|24叶模拟树，树芯占主区域，窄性状环和径向可读叶名|R04 Fig 1（分支层级迁移，环形轨道为本项目设计）；[R04 Fig 1](https://www.nature.com/articles/nmicrobiol201648)|
|5 · 无根进化树工作台 `tree-unrooted`|叶子太少，长分支浪费画布|24叶结构，模块色标签与较清楚分支尺；保留无根含义|R04 Fig 1；[R04 Fig 1](https://www.nature.com/articles/nmicrobiol201648)|

## 每批结果

### 批次 1 · 六种代表图（6 个）

误差观测、密度、矩阵、差异分析、排序与树，先确认六种不同的设计方向。

完成 30 个默认/替换/小画布/宽画布/长标签或分组场景、6 个保存重开和 24 个四格式实导出。每张图的前后图、精确参数与原始证据见[交互报告对应批次](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/report.html#batch-1)。

### 批次 2 · 其余基本图（23 个）

23 个模板：零基线、真实分布、配对表达、末端标签、分组点形与明确的面积编码。

完成 115 个默认/替换/小画布/宽画布/长标签或分组场景、23 个保存重开和 92 个四格式实导出。每张图的前后图、精确参数与原始证据见[交互报告对应批次](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/report.html#batch-2)。

### 批次 3 · 矩阵与富集（10 个）

10 个模板：顺序/发散/二值编码分开，行列文字完整，富集数值由模拟集合真实计算。

完成 50 个默认/替换/小画布/宽画布/长标签或分组场景、10 个保存重开和 40 个四格式实导出。每张图的前后图、精确参数与原始证据见[交互报告对应批次](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/report.html#batch-3)。

### 批次 4 · 关系、地理与基因组（10 个）

10 个模板：网络模块、精确集合、守恒流量、统一坐标轨道、模拟位置与检验结果区分。

完成 50 个默认/替换/小画布/宽画布/长标签或分组场景、10 个保存重开和 40 个四格式实导出。每张图的前后图、精确参数与原始证据见[交互报告对应批次](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/report.html#batch-4)。

### 批次 5 · 排序与进化树（6 个）

6 个模板：真实排序计算、点形分组、载荷与样本层次、24 叶树和可编辑性状轨道。

完成 30 个默认/替换/小画布/宽画布/长标签或分组场景、6 个保存重开和 24 个四格式实导出。每张图的前后图、精确参数与原始证据见[交互报告对应批次](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/report.html#batch-5)。

## 实际验收结果

- 单元测试：464 passed / 14 test files；构建：passed；Vite 报告 bundle 大于 500 kB 的提示。
- 浏览器：全套 772 项初跑：227 通过、25 个大 SVG 的 data-URL 打开失败、520 按条件跳过；改为 Blob 文件打开后，相关 244 项重跑 64 通过、180 跳过。按唯一用例合并：252 通过、520 跳过、0 未解决失败。
- 55 个模板，275 个场景；每个模板均实际替换数据。5 个排序模板的替代输入调用运行中的统计 API / worker 重算。
- 55 个项目保存重开；dataset、style、layers、layout、analysis 逐字段一致。
- 220 个实际导出：SVG、PNG、PDF、EPS 各 55；SVG 用独立浏览器打开，PNG 用图像解码器，PDF/EPS 用 Ghostscript 打开。
- 四格式按相同比例栅格化比较。像素误差只辅助识别字体/布局漂移，不是“科学正确”的替代证据；具体数值见 `export-renders/comparison.json`。
- 逐张查看 55 个默认图和分批对比；另对长标签/小画布截图做联系表视觉检查，修复分类数据遮盖、轴标签截断、环图小尺寸轨道与中心文字等问题。

验收覆盖本次列出的有限样例，不能保证任意规模和任意长度输入都无需调整。640×480 的复杂图需要放大读取细节；基因组多轨圈图使用 640×700，低于轨道所需空间会显示明确校验提示。树按叶间距扩展实际画布。可编辑 SVG 内嵌 OFL 字体子集及授权文本；上下标数字转换为可编辑 tspan，避免桌面 CJK 字体丢失对数底数与面积指数。SVG 已在浏览器离线核验；不支持内嵌字体的编辑软件仍需安装 Noto，或选择文字转曲。本轮未测试 Illustrator 等第三方编辑器。四格式默认输出实际下载并打开，未穷举所有控件与导出选项的笛卡尔组合。真实 KEGG 查询是独立生信工具，排除在这 55 个绘图模板验收范围外。

## 复现

```sh
npm --prefix web test
npm --prefix web run build
cd web
OPENACAD_LIVE_API=1 npm run test:browser -- --grep-invert 'KO 真实 KEGG'
```

真实统计与导出需本地 18082 API/worker。没有 worker 时不能把跳过的真实用例记作通过。样例推断数据可用 `server/.venv/bin/python scripts/refresh-inference-examples.py` 复现；Web 独立公式测试核对 Welch P 值与 BH、集合计数。外部证据脚本 `verify.mjs`、`check-surfaces.mjs`、`render-svg.mjs`、`compare-exports.py` 保留实际点击、文件打开与测量过程。

## 论文索引

### R01 · Beyond Bar and Line Graphs: Time for a New Data Presentation Paradigm

PLOS Biology · 2015 · 方法研究。[原文](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)。具体图：Fig 1；Fig 2 为配对表达方法补充。核验：Fig 1 原图已查看；Fig 2 仅核对文字。

同一均值可隐藏不同分布。保留独立观测、明确区间定义；弱化汇总柱面，不添加虚构显著性。 不直接用研究示意数据，也不把均值误差解释为数据全范围。

已查看图像：[R01-fig1-large.png · 2144×1199](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R01-fig1-large.png)

### R02 · Raincloud plots: a multi-platform tool for robust data visualization

Wellcome Open Research · 2019 · 方法论文。[原文](https://wellcomeopenresearch.org/articles/4-63/v2)。具体图：Fig 3、4。核验：全文与图注已核实；图片获取未成功，候选方法参考。

半密度、原始散点、箱线分层。实证视觉参考改用 R21 Fig 2。 不声称已查看高清原图。

图片核验状态：未计入已查看图像。

### R03 · Predicting cell-to-cell communication networks using NATMI

Nature Communications · 2020 · 单细胞生物学。[原文](https://www.nature.com/articles/s41467-020-18873-z)。具体图：Fig 1；Fig 4a–b；Fig 5。核验：原文、图注与图像已查看。

矩阵统一标签与连续色键；网络中以位置组织模块，以较轻连线解释联系，保持节点和边的含义独立。 不移植其细胞类型、连接数据或独特网络构图；相关矩阵只是视觉方法迁移。

已查看图像：[R03-fig1.png · 685×247](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R03-fig1.png)；[R03-fig4.png · 685×502](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R03-fig4.png)；[R03-fig5.png · 685×291](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R03-fig5.png)

### R04 · A new view of the tree of life

Nature Microbiology · 2016 · 系统发育。[原文](https://www.nature.com/articles/nmicrobiol201648)。具体图：Fig 1。核验：原文、图注与图像已查看。

密集树以分支层级、有限类别色和外围命名建立层次。扩大树本体，性状轨道只作补充。 不复制论文独特扇形；不从模拟拓扑推断真实演化结论；Supplementary Fig 1 未作为已核验图片使用。

已查看图像：[R04-fig1.jpg · 685×821](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R04-fig1.jpg)

### R05 · Entropy and order in urban street networks

Scientific Reports · 2013 · 城市地理。[原文](https://www.nature.com/articles/srep03324)。具体图：Fig 1a（地图）、1e（方向玫瑰图）。核验：原文、图注与图像已查看。

方向刻度和地理底图先提供定位；让数值编码集中于扇区或采样点。 不采用地图圆点的光泽渐变；本产品玫瑰图继续采用面积编码，并明示含义。

已查看图像：[R05-fig1.jpg · 685×448](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R05-fig1.jpg)

### R06 · An ecological network approach to predict ecosystem service vulnerability to species losses

Nature Communications · 2021 · 生态系统。[原文](https://www.nature.com/articles/s41467-021-21824-x)。具体图：Fig 1a–c（网络）、1d（流向图）。核验：原文、图注与图像已查看。

形状区分节点性质，细边服从节点；桑基流带分层，端点就近标记。 高密度黑边容易糊成块，本产品降低边权视觉强度；不套用原生态关系。

已查看图像：[R06-fig1.png · 685×537](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R06-fig1.png)

### R07 · Global Carbon Budget 2024

Earth System Science Data · 2025 · 地球系统。[原文](https://essd.copernicus.org/articles/17/965/2025/)。具体图：Fig 4a–f。核验：原文、图注与图像已查看。

趋势线高于不确定区间，单位和时间轴稳定，分面间字体与线宽协调。迁移到折线、误差折线的层次。 Fig 2 是碳库流量示意，未当作桑基范例；旧候选 Fig 15 地图图号未确认，已弃用。

已查看图像：[R07-fig4.png · 500×643](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R07-fig4.png)

### R08 · Single-cell genomic profiling of human dopamine neurons identifies a population that selectively degenerates in Parkinson’s disease

Nature Neuroscience · 2022 · 神经科学。[原文](https://www.nature.com/articles/s41593-022-01061-1)。具体图：Fig 2e。核验：原文、图注与图像已查看。

分布按层排布、共享数值方向；密度峰形是信息主体，轮廓和行距不能互相遮挡。 不复制解剖空间布局；用六时段模拟叶温和实际 KDE 重新实现。

已查看图像：[R08-fig2.png · 685×469](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R08-fig2.png)

### R09 · Systematic comparison of germline variant calling pipelines cross multiple next-generation sequencers

Scientific Reports · 2019 · 基因组学。[原文](https://www.nature.com/articles/s41598-019-45835-3)。具体图：Fig 3。核验：原文、图注与图像已查看，图号已由初始候选修正为 3。

UpSet 的交集数量柱和成员点阵严格垂直对齐；连接线、非成员灰点和集合数分层。 不照搬论文的插入饼图、成员集合和极端数量分布。

已查看图像：[R09-fig3.png · 685×831](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R09-fig3.png)

### R10 · The potential role of short internodes/stylish (SHI/STY) and SHI related sequence (SRS) in potato tuberization

BMC Plant Biology · 2025 · 植物分子生物学。[原文](https://bmcplantbiol.biomedcentral.com/articles/10.1186/s12870-025-07172-8)。具体图：Fig 2。核验：原文、图注与图像已查看；取代初始不可访问的 PeerJ 候选。

蛋白和基因位点沿同尺轨道排列，结构域、短基序、主干分别编码；比较对象按行对应。 不采用装饰渐变或树与基序的独特拼版；短基序按真实坐标宽度绘制。

已查看图像：[R10-fig2.png · 685×131](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R10-fig2.png)

### R11 · Perturbation-response genes reveal signaling footprints in cancer gene expression

Nature Communications · 2017 · 肿瘤信号。[原文](https://www.nature.com/articles/s41467-017-02391-6)。具体图：Fig 3a。核验：原文、图注与图像已查看。

将双侧效应、显著性高度和重点标签分开；中性点退后，阈值明确。 论文横轴统计含义与本模板 log₂FC 不同，只迁移表达方法；不移植信号和 P 值。

已查看图像：[R11-fig3.jpg · 685×464](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R11-fig3.jpg)

### R12 · Improving visual communication of environmental model projections

Scientific Reports · 2021 · 方法评价。[原文](https://www.nature.com/articles/s41598-021-98290-4)。具体图：Fig 1。核验：作为方法候选/反例阅读，未计入已选优质实例。

图形选择要匹配变量，不能因为有雷达轮廓就认为适合多性状比较。 不采用其被评估的红绿交通灯或单变量雷达方案。

图片核验状态：未计入已查看图像。

### R13 · Passionfruit plants alter the soil microbial community with continuous cropping and improve plant disease resistance by recruiting beneficial microorganisms

PLOS ONE · 2023 · 土壤微生物。[原文](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281854)。具体图：Fig 1c/f、2、3、4、5。核验：原文、图注与大图已查看。

组成图同序堆叠；箱线保留观测；集合计数可核对；排序轴标出解释率。圆堆砌只借鉴层级间距。 不采用过量高饱和类别色、过密小标签或多环饼；PCoA 图中的包络线不被当作置信区域。

已查看图像：[R13-fig1-large.png · 4200×2027](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R13-fig1-large.png)；[R13-fig2-large.png · 3888×2193](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R13-fig2-large.png)；[R13-fig3-large.png · 3672×1992](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R13-fig3-large.png)；[R13-fig4-large.png · 3433×1425](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R13-fig4-large.png)；[R13-fig5-large.png · 3000×1950](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R13-fig5-large.png)

### R14 · UpSet: Visualization of Intersecting Sets

IEEE TVCG · 2014 · 可视化方法。[原文](https://pmc.ncbi.nlm.nih.gov/articles/PMC4720993/)。具体图：Fig 6。核验：方法文字补充，实证视觉范例使用 R09 Fig 3。

交集矩阵编码方法。 不把方法演示称为实证数据。

图片核验状态：未计入已查看图像。

### R15 · Single-nucleus transcriptome profiling provides insights into the pathophysiology of OSA-related renal injury

Scientific Reports · 2025 · 肾脏单细胞。[原文](https://www.nature.com/articles/s41598-025-23736-y)。具体图：Fig 3G–I。核验：原文、图注与图像已查看。

富集条目排序、长名称和图例对齐。气泡/圈图从条目表达迁移，未冒称论文含同款气泡图。 不采用同图 F 的拥挤火山标签；论文色义不等于本产品 Q 值色义。

已查看图像：[R15-fig3.png · 685×468](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R15-fig3.png)

### R16 · Circos: an information aesthetic for comparative genomics

Genome Research · 2009 · 基因组可视化方法。[原文](https://genome.cshlp.org/content/19/9/1639)。具体图：Fig 5；Fig 1–4 为折页。核验：仅核实论文与图注，原图未完成核验。

多轨道需各有量纲与清晰的内外顺序。当前圈图设计另由已查看的 R10 轨道与 R04 径向布局交叉支持。 未确认的高清图不作为已验收参考；不复制折页独特构图。

图片核验状态：未计入已查看图像。

### R17 · MCScanX: a toolkit for detection and evolutionary analysis of gene synteny and collinearity

Nucleic Acids Research · 2012 · 比较基因组。[原文](https://doi.org/10.1093/nar/gkr1293)。具体图：Fig 3A–D。核验：原文 XML 与准确图注已核实，原图未完成核验。

对应染色体、位置标尺与连接区块分离；使用标准输入重新绘图。 仅图注核验不等于视觉核验；不从模拟配对推断同源性。

图片核验状态：未计入已查看图像。

### R18 · External Apical Root Resorption in Orthodontic Patients Who Practice Combat Sports: A Case-Control Observational Pilot Study

Medicina · 2022 · 口腔临床。[原文](https://www.mdpi.com/1648-9144/58/10/1342)。具体图：Fig 2、3。核验：原文 XML 与图注已核实，图像访问受限；候选。

雨云图临床应用候选；最终视觉依据使用可查看的 R21。 不对未看到的图作精致度评分。

图片核验状态：未计入已查看图像。

### R19 · A Method for Identification and Analysis of Non-Overlapping Myeloid Immunophenotypes in Humans

PLOS ONE · 2015 · 免疫学。[原文](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0121546)。具体图：Fig 2D。核验：原文、图注与大图已查看。

独立观测、中心趋势、不同点形能同时呈现样本量与分组。 该文 Fig 2B/C 所称 radar 是流式多变量投影，不是多边形雷达；已排除这种错误对应。

已查看图像：[R19-fig2.png · 1260×1800](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R19-fig2.png)

### R20 · Regional and tele-connected impacts of the Tibetan Plateau surface darkening

Nature Communications · 2023 · 气候科学。[原文](https://www.nature.com/articles/s41467-022-35672-w)。具体图：Fig 2b。核验：原文、图注与图像已查看。

双组雷达用有限颜色、节点和细网格明确比较对象，外围类别保持固定顺序。 原图各轴使用局部数值范围，本产品多性状评分统一 0–100；不沿用截断尺度。

已查看图像：[R20-fig2.png · 685×327](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R20-fig2.png)

### R21 · Effects on nonverbal numerical acuity performance after a single-session transient random noise stimulation over the intraparietal sulcus or dorsolateral prefrontal cortex

Scientific Reports · 2025 · 认知神经科学。[原文](https://www.nature.com/articles/s41598-025-21890-x)。具体图：Fig 2。核验：原文、图注与图像已查看。

横向雨云图让原始点、箱体、单侧密度各占一层；各组共享数值轴并保留非单峰分布。 不复制论文四分面的粗黑框、数值和处理条件。

已查看图像：[R21-fig2.png · 685×856](/Users/a1-6/.codex/visualizations/2026/09/08/01a07f8d-08e2-7c40-aff1-8dbfa4d2b0c0/figure-quality/references/R21-fig2.png)
