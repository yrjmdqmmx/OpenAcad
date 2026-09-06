"""Reproducible source-comparison artifact from the dated, reviewed research record.
Original scripts and images are references, not OpenAcad product assets.
"""
from pathlib import Path
import json,re,csv,html,hashlib,shutil
ROOT=Path(__file__).resolve().parent
INPUTS=json.loads((ROOT/'catalog-evidence.json').read_text())
EXAMPLES=json.loads((ROOT/'source-examples.json').read_text())
# page | Chinese name | field contract | multi-input | styles | computation | error checkpoints | own improvement
DETAILS='''tvbot|系统发育树|Newick/Nexus/phyloXML；注释表首列节点ID；部分时间树依据文档|树文件＋多种节点注释表|矩形/圆形/无根；重定根、排序、折叠、删除枝叶、枝长、支持度、29类注释|编辑已有树；不执行序列建树|树语法、非数字枝长、重复ID、注释ID未匹配|三布局、完整注释；无根增加分类字体/两类饼图/节点连线
 gene_cluster|基因簇|前五列ID/source/start/end/strand；起止数值、方向+/-|单表|箭头形态、头宽高、描边、标尺、分类色、同源连线、断裂区间|已有基因坐标绘图|方向错误、区间反向、缺ID|中文逐区间校验
 conserved_domains_plot|CDD保守结构域|CDD hitdata.txt 的Query/From/To/Short name＋FASTA蛋白长度|CDD＋FASTA两文件|蛋白基线、结构域位置、颜色、圆角、间距、描边、文字|展示CDD结果；不执行CDD搜索|缺文件、Query未匹配、区间越界|保留文件角色并提供标准化表格
 conserved_motif_plot|MEME保守基序|MEME XML序列、motif与scanned site引用|单XML|基序色、宽度、间距、基线、文字、描边|展示已有基序；不执行MEME搜索|XML类型、引用和坐标错误|中文XML定位与可编辑注释
 circos|基因组圈图|JSON contigName/contigLength/GCSkewArr/GCContentArr；或FASTA；可选CDS contig/start/end/strand/type|JSON或FASTA，可附CDS表|环宽、半径、间距、刻度、GC和正负链轨道|FASTA路径真实窗口GC计算；不执行组装|轨道长度、非数值、contig未匹配|窗口与有效碱基分母明确
 Volcano_plot|火山图|ID、Log2FoldChange、PValue；前三列位置读取|单表|阈值、上下调色、符号、点大小、标签、图例|-log10P与阈值分类；不执行差异表达分析|概率范围、误传原FC或-logP|P=0明确处理；不伪造P值
 enrich_plot|富集气泡图|Description/GeneRatio/Qvalue/Count按字段读取；示例另含ID|单表|条目轴、比例轴、气泡大小、Q色条、分类注释|已有富集结果绘图；不执行基因富集检验|缺列、比例字符串、非法概率/计数|点/柱两种真实布局
 circle_enrich_plot|圆形富集图|5或6列：条目/类别/PQ/背景数/差异数或上调和下调数|单表|分类环、背景环、上下调环、richFactor、宽度、文字、色条|基于已有结果计算比例；不执行富集检验|列数、零背景、计数越界|字段角色与计算说明
 McScanX_synteny_plot|MCScanX共线性|collinearity＋无表头4列简化GFF：chr/geneID/start/end；不是9列GFF3|两文件|染色体排列、拖序、对齐、宽高、连线块、尺度、基因层|展示MCScanX结果|错传GFF3、基因ID不匹配|明确格式区别与可编辑次序
 scatter_plot|基础散点图|前三列ID/数值X/数值Y；可关联注释|单表＋可选注释|点形、大小、色、标签、边缘密度、LM/LOESS/GAM与置信带|存在真实回归请求|非数值、ID、有效点数|真实模型统计与置信带，不伪线性拟合
 group_scatter_plot|分组散点图|ID/X/Y/组别|单表|分组色、点形、图例、逐组拟合、置信带；边缘密度待核实|真实分组回归请求|缺组别、组内数据量|方法参数和实际n
 pca|主成分分析PCA|样本ID＋数值特征矩阵|单表|标准化及方向、得分、载荷、解释率、点与注释|真实PCA计算|缺失、重复ID、零方差、有效维数|固定SVD与中心化定义
 pcoa|主坐标分析PCoA|样本ID＋数值特征矩阵|单表|距离、标准化、坐标、解释率、分组、标签|真实距离与PCoA排序|距离数据域、全零行、无效距离|保留负特征值诊断与校正选项
 nmds|非度量多维尺度NMDS|样本ID＋数值特征矩阵|单表|生态距离、标准化、点、标签、stress；种子/收敛控件待核实|真实迭代排序；stress不是解释率|重复ID、全零行、无效距离|种子、收敛、关闭隐式变换
 CCA|典范对应分析CCA|物种矩阵与环境矩阵；原首列表头sample/env区分角色|两表或两工作表|样本/物种/环境得分、箭头、解释率、标准化|真实典范对应分析；不是典型相关分析|样本匹配、非负响应、矩阵秩|显式角色与解释率分母
 RDA|冗余分析RDA|响应矩阵与环境矩阵；样本ID对应|两表或两工作表|得分、箭头、解释率、标准化|真实RDA；与CCA共展示内核|缺失、样本不匹配、共线性|固定scaling与诊断
 group_line_plot|折线与分组折线|宽表每行一个系列；首列系列名，其余列名是X、单元格是Y|单表|线色、虚线、线宽、透明、张力、点形、图例、断轴|已有数值绘图|转置方向、X表头、非数值|长表映射与专属坐标控件
 group_error_line_plot|分组误差折线|每表一个组的重复观测宽表|多表或多工作表|线点、误差线、分类/数值X|均值、样本SD；ANOVA代码存在但公开显著性面板待核实|条件列不一致、组名、样本量|SD/SE/CI与真实检验明确分开
 ridgelinePlot|峰峦图|样本ID＋多列原始数值|实际使用首表|分箱、trim、峰间距、填充、描边、分位线|确认分箱频数；标准KDE待核实|空列、常量、样本量|标准Gaussian KDE与频数分开
 lollipop_plot|棒棒糖图|标签、数值两列|单表|横纵向、点大小映射、杆线、间距、颜色、文字、纹理|已有数值绘图|缺列、数值混单位|排序与色觉友好配色
 lollipop_plot_with_category|分类棒棒糖|标签、数值、类别|单表|分类配色、纹理、大小、杆线、图例、排序|已有数值绘图|类别缺失、列错位|完整中文字段映射
 scatter_plot_errorBar|散点误差图|重复编号＋每类观测列；原始重复矩阵|单表|均值点、误差线、单侧显示、原始点、文字|均值和样本SD|误传均值±SD、观测不足|原始/汇总两种输入、SD/SE/CI
 upset_plot|UpSet集合交集图|每列一个集合，单元格为成员ID，允许空白补齐|单表|交集排序、零交集、集合大小子图、柱样式、成员结果|去重与真实集合交集|集合名、成员规范|互斥交集与包含式交集含义明确
 bar_plot|普通柱图|标签、数值两列|单表|横纵向、逐柱色、圆角、纹理、文字、间距、对数轴、断轴|已有数值绘图|非数值、对数非正值|中文校验和可靠导出
 bar_plot_width_category|分类柱图|标签、数值、类别|单表|分类排序、颜色、纹理、条宽、圆角、图例|已有数值绘图|缺类别、非数值|字段映射与分类说明
 bar_plot_errorBar|误差柱图|重复编号＋每类原始观测|单表|柱样式、误差线、原始点、单侧误差、数值、断轴|均值和SD|组内不足两项、混入汇总值|原始/汇总两种输入、SD/SE/CI
 group_bar_plot|分组柱图|首列类别，其余系列数值；单元格直接成柱|单宽表|组间距、系列色、纹理、文字、图例、横纵向|不求均值，直接绘图|误把重复观测当汇总值|清楚区分分组柱与分组误差柱
 group_error_bar_plot|分组误差柱图|多个大组表，子组列名和顺序一致|多表或多工作表|均值、SD、误差、原始点、排序、显著性线、两两/对照|真实t/Wilcoxon类检验|组列不一致、样本量、配对关系|明确检验名、P校正与有效n
 bar_with_line_plot|柱线组合图|待核实：当前入口404|待核实|待核实|待核实|待核实|自主实现共享X、柱线系列、单/双Y轴、独立单位和图例
 stackedbar_plot|堆叠柱图|首列样本，其余组成数值|单表|横纵向、组成色、文字、相邻色块连接、图例|原站百分比归一化待核实|空值、负值、列角色|增加百分比堆叠
 group_stackedbar_plot|分组堆叠柱图|多个组成表，需跨表样本和列对齐|多表或多工作表|组间距、颜色、文字、图例、堆叠|原站百分比归一化待核实|跨表样本/组分不一致|分组百分比堆叠
 rosePlot|玫瑰与花瓣图|标签、数值两列|单表|弧/菱形/花瓣、内径、间距、径向刻度、颜色、文字、动画；原独立图例未实现|径向已有数值展示|负值和全零处理待核实|补图例与负值明确校验
 box_plot|箱线图|样本ID＋每变量原始观测；不是五数概括|单表|箱体、须、离群点、原始点、间距、显著性|分位数/IQR，真实组间检验|错传五数概括、空列|标准Tukey观测须端
 group_box_plot|分组箱线图|多个观测表，子组列一致|多表或多工作表|箱图＋组顺序、间距、配色、图例|真实组间检验|组名、列、配对关系|明确P校正与样本数
 violin_plot|小提琴图|样本ID＋数值变量原始观测|单表|分箱、排除值、宽度、间距、颜色、箱图、抖动点|原站标准KDE待核实|常量、样本量|标准Gaussian KDE、Scott/Silverman/自定义
 raincloud_plot|云雨图|单观测矩阵|单表|分布、箱体、点、trim、分箱、间距、分位线|描述统计；未调用检验函数不算可用检验|空列、非数值、样本量|明确分布估计与检验边界
 piePlot|饼与圆环图|分类、数值两列|单表|内径、扇区色、透明、描边、数值/百分比、引导线|占比计算|负值、全零、重复类别|中文比例与零和校验
 vennPlot|韦恩图|2～5列集合，成员字符串，允许空白|单表|轮廓、集合色、交集数、拖动标签、零交集|真实集合交集|集合数、空/重复集合名|精确互斥结果与面积语义说明
 radarPlot|雷达图|首列系列，后续为数值指标|单表|面积、顶点、描边、径向范围/网格/刻度|自动跨指标标准化待核实|量纲不一致、非数值|归一化与共同尺度明确
 heatmap|矩形热图|行名＋数值矩阵，可另有行列注释|单表＋注释|色阶、格子、数值、零值、注释、聚类树|真实标准化与聚类|空行名、非数值、注释混数值|明确距离/连接适用域
 circle_heatmap|圈形热图|行名＋数值矩阵|单表＋注释|环宽、角度、内外圈、标签、注释、聚类|真实标准化与聚类|非数值、标签对应|与矩形同家族独立布局
 correlation_heatmap|组内相关热图|已有方阵r或r/P两表；也有原始样本矩阵计算路径|一或两表|全矩阵/三角、对角线、圆/方、系数、星号、聚类；原独立标题被删除|真实相关分析或已有结果绘图|非方阵、标签、概率|补标题、实际n、P校正、区分原始/结果
 dubble_matrices_correlation_heatmap|组间相关热图|矩形r＋可选P；或两个原始矩阵|两表或两工作表|符号、系数、显著性、色阶、聚类|真实组间相关；导入r仍请求聚类|样本与r/P标签不对应|本地结果绘图与统计分开
 mantel_test_correlation_heatmap|Mantel关联热图|r/P＋mantel/env/r/p结果；或环境＋多个群落矩阵|多表；partial控制矩阵原契约待核实|节点、标签、曲线、粗细/色/虚线、筛选|真实四种Mantel方法与两侧生态距离|样本不一致、结果标签；partial契约待核实|独立控制矩阵Z、明确单侧/置换/种子
 binary_plot2|方格二值图|行名＋0/1矩阵|单表＋注释|两类颜色、格子、文字、图例、注释、聚类树|存在聚类请求|原站是否严格拒绝非0/1待核实|严格0/1校验
 dumbbell_plot|哑铃图|对象名＋两个或更多数值系列|单表|点、系列色、连接线、轴、图例|连接每行最小和最大值；无推断统计|非数值、系列不足|多端点与差值含义明确
 bubble_plot|数值气泡矩阵|行名＋数值矩阵，不是X/Y/size散点表|单表＋注释|大小、连续/分类色、数值、图例、行列注释|数值映射；正负值映射待核实|错用散点格式、负值映射|按面积编码绝对值、颜色区分符号
 packing_bubble_plot|圆堆砌|对象、数值、类别三列；原站仅纳入正值|单表|圆大小、间距、类别色、文字、外包围圆、图例|原站扁平数据，不是任意层级输入|零负值、重复对象|不静默丢弃无效数值
 binary_plot|圆点二值图|行名＋0/1矩阵|单表＋注释|空心/实心、行列类别色、图例、注释|此入口未见聚类调用|非0/1、行列名|与方格二值合并为家族变体
 sankey_plot|桑基图|source/target/value边表；自动生成节点|单表|节点宽距、对齐、文字、链接色/渐变、排序|流量求和与布局|自环、环路、负流量、重复边|中文拓扑错误提示
 network_plot|动态网络图|node id/label＋edge id/source/target；可另接注释|节点与边两表|力布局、拖动、节点形色大小、连接数、边、注释；原删除X/Y和背景面板|网络布局；无共现网络推断证据|悬空端点、重复ID|补背景、稳定布局和位置保存
 map_plot|地图点位|coordinate_id/longitude/latitude；可接ID注释|点表＋可选注释|五种投影、中心、缩放、底图、点形大小、颜色层|坐标投影；无地理编码/区域统计/完整GIS证据|经纬度范围、注释未匹配|许可明确底图、中文坐标校验'''
rows={}
for line in DETAILS.strip().splitlines():
 parts=[v.strip() for v in line.split('|')]
 assert len(parts)==8,parts
 rows[parts[0]]={'chineseName':parts[1],'requiredFields':parts[2],'multipleInputs':parts[3],'specificStyles':parts[4],'statistics':parts[5],'errorCheckpoints':parts[6],'openacadEnhancement':parts[7]}
cat=INPUTS['catalog'];statuses={p['path']:p for p in INPUTS['statuses']};previews=INPUTS['previews']
noaxes={'tvbot','rosePlot','piePlot','vennPlot','radarPlot','packing_bubble_plot','sankey_plot','network_plot','map_plot','circle_heatmap','circos','circle_enrich_plot'}
records=[];seen=set()
for group in cat:
 for card in group['cards']:
  path=card['url']
  if not path.startswith('/') or not path.endswith('.html') or path in seen:continue
  seen.add(path);key=Path(path).stem
  if key not in rows:continue
  r={**rows[key],'id':key,'sourceUrl':'https://www.chiplot.online'+path,'category':group['category'],'previewUrls':list(dict.fromkeys(previews.get(path,[]))),'checkedAt':'2026-09-06','availability':statuses.get(path,{}).get('status','待核实'),'evidenceTypes':['C','D'] if key=='tvbot' else ['C'],'actualOperation':'待逐图操作验收','uploadFormats':'CSV、TSV、XLS、XLSX 解析路径有代码证据；逐格式操作待核实','pasteInput':'待核实','editableTableInput':'待核实','optionalFields':'仅所列注释/附属文件已记录；其余待核实','canvas':'宽、高、四边距、全局字体有公共核心代码证据；背景按单图差异','text':'全局字体有代码；标题/局部文字/标签按专有项，未列明待核实','axes':'普通X/Y直角坐标不适用；专有尺度见图表设置' if key in noaxes else '直角坐标核心有代码；具体范围/对数/刻度选项逐项待实测','colorsLegend':'专有样式列出已确认项；其他待核实','elementsLayout':rows[key]['specificStyles'],'exportProfile':'E','projectProfile':'P','exampleUrls':[],'sourceScripts':['https://www.chiplot.online'+s if s.startswith('/') else s for s in statuses.get(path,{}).get('scripts',[])],'sourceEvidenceHashes':{}}
  record=EXAMPLES.get(key,{})
  r['exampleUrls']=record.get('exampleUrls',[])
  r['sourceEvidenceHashes']={v['url']:v['sha256'] for v in record.get('scripts',[])}
  if key in {'conserved_domains_plot','conserved_motif_plot','circos','McScanX_synteny_plot','tvbot'}:r['uploadFormats']=r['requiredFields']+'；附属注释的表格格式见共同记录'
  if key=='tvbot':r['exampleUrls']=['https://www.chiplot.online/static/Ali/data/NJ_tree.treefile']
  if key=='pca':r['actualOperation']='默认示例显示已有操作证据；PC1 92.46%、PC2 5.31%；未独立复算';r['evidenceTypes'].append('O')
  if key=='dubble_matrices_correlation_heatmap':r['actualOperation']='已编辑图例并下载32577字节SVG，解析通过；长图例出现裁切；项目默认示例保存报No user data';r['evidenceTypes'].append('O')
  if key=='bar_with_line_plot':
   for k in ['uploadFormats','canvas','text','axes','colorsLegend','elementsLayout','exportProfile','projectProfile']:r[k]='待核实（入口404）'
  if not r['exampleUrls']:r['exampleStatus']='示例文件名已在研究方案记录；完整URL待补充核验'
  else:r['exampleStatus']='公开脚本中的直接示例URL；访问可用性按证据日期'
  records.append(r)
assert len(records)==52,len(records)
profiles={'E':{'formats':['SVG','PNG','透明PNG','PDF','EPS'],'evidence':'代码分支存在，不等于逐图导出通过','size':'画布宽高；导出物理尺寸和实际像素逐图待核实','dpi':'独立DPI控件待核实','transparent':'透明PNG分支有代码；其他格式背景逐图待核实','fontClipping':'中文字体与裁切逐图待核实'},'P':{'format':'JSON编辑状态','contains':'数据、样式、图层有代码路径','reopen':'保存/恢复代码存在；逐图往返待核实','example':'默认示例可能No user data，不能视为所有示例都可保存'}}
result={'title':'ChiPlot逐图研究与OpenAcad功能对照','checkedAt':'2026-09-06','counts':{'drawingCards':54,'uniqueEntrances':52,'HTTP200':51,'HTTP404':1,'previewCardsReachable':54},'profiles':profiles,'records':records,'evidencePolicy':'C=代码 D=官方文档 O=实际操作。HTTP200不等于功能可用。没有统一假设输入、导出或项目全支持。原站限制不是OpenAcad能力上限。'}
(ROOT/'comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
fields=list(records[0].keys())
with (ROOT/'comparison.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields+['exampleStatus']);w.writeheader()
 for r in records:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()})
layers=['替换叶名','追加叶名','叶名上标','局部斜体','叶名分类颜色','叶名字体分类','分支分类颜色','叶名背景色块','节点符号','叶侧饼图','分支饼图','普通柱图','分类柱图','普通棒棒糖','分类棒棒糖','堆叠柱','普通箱线','分类箱线','热图','二值类型一','二值类型二','气泡','文本矩阵','分类文本矩阵','分支文字','节点连线','地质年代尺','MEME基序','重组片段']
u={1,2,3,4,5,7,8,9,25};enhance={6,10,11,26}
lmatrix=[{'id':i,'name':name,'sourceNormal':'注册并有绘制路径（C）','sourceCircle':'注册；绘制路径待核实' if i==29 else '注册并有绘制路径（C）','sourceUnrooted':'支持（C）' if i in u else '未开放新增层（C）','openacadNormal':'计划实现','openacadCircle':'计划实现','openacadUnrooted':'计划实现' if i in u|enhance else '不适用：布局语义未纳入','acceptance':'待验收'} for i,name in enumerate(layers,1)]
(ROOT/'tree-layers.json').write_text(json.dumps(lmatrix,ensure_ascii=False,indent=2))
with (ROOT/'tree-layers.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=list(lmatrix[0]));w.writeheader();w.writerows(lmatrix)
payload=json.dumps(result,ensure_ascii=False).replace('</','<\\/')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>逐图研究 · OpenAcad</title><style>body{font:14px/1.7 system-ui,sans-serif;color:#172b3a;margin:30px auto;max-width:1300px;padding:0 20px}a{color:#087f8c}h1{font-size:28px}input,select{font:inherit;padding:9px;border:1px solid #cad6dd;border-radius:4px;margin:5px}input{width:min(500px,80vw)}article{border-top:1px solid #dce3e8;padding:25px 0}h2{margin:0 0 10px}dl{display:grid;grid-template-columns:170px 1fr;gap:8px 20px}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}.preview{float:right;max-width:240px;max-height:170px;margin:0 0 20px 25px}small{color:#607585}.policy{padding:15px;background:#f1f7f8}.links{display:flex;gap:20px;flex-wrap:wrap}@media(max-width:650px){dl{display:block}dt{margin-top:12px}.preview{float:none;display:block;width:100%;margin:0 0 15px}}</style><h1>ChiPlot 逐图研究与 OpenAcad 功能对照</h1><p>核查日期：2026-09-06 · 54 张绘图卡 · 52 个唯一入口 · 3 种树布局</p><div class="policy">这是原站研究记录，不是 OpenAcad 验收完成声明。C：代码；D：官方文档；O：实际操作。入口可达、代码分支存在和实际功能通过分别记录。原站不支持的合理需求仍可由 OpenAcad 增强。</div><p class="links"><a href="comparison.csv">下载 CSV 对照表</a><a href="comparison.json">下载 JSON 完整记录</a><a href="tree-layers.csv">29 层×3 布局矩阵</a><a href="tree-layers.json">树图完整记录</a></p><details><summary>共通导出 E 与项目 P 的证据边界</summary><p>导出 E：代码存在 SVG、PNG、透明 PNG、PDF、EPS；独立 DPI 控件待核实，逐图尺寸/中文字体/裁切待实测。项目 P：JSON 数据/样式/图层保存恢复代码存在，逐图往返待核实；默认示例可能报 No user data。单表通常只读 Excel 首表；多表按图记录。所有图的粘贴与表格直接填写目前均待核实。</p></details><input id="q" aria-label="搜索对照表" placeholder="搜索名称、字段、计算或增强项"><select id="category" aria-label="类别"><option value="">全部类别</option></select><p id="count"></p><main id="rows"></main><script>const report=PAYLOAD;const cats=[...new Set(report.records.map(r=>r.category))];for(const c of cats){const o=document.createElement('option');o.value=c;o.textContent=c;document.getElementById('category').append(o)}const labels={requiredFields:'必填字段与数据类型',optionalFields:'可选字段',multipleInputs:'多文件/工作表',uploadFormats:'上传格式',pasteInput:'粘贴输入',editableTableInput:'网页表格填写',specificStyles:'专有样式',canvas:'画布、背景、边距',text:'标题、字体、标签',axes:'坐标、刻度、范围、网格',colorsLegend:'颜色与图例',statistics:'统计计算边界',errorCheckpoints:'常见格式错误检查点',openacadEnhancement:'OpenAcad 增强要求',actualOperation:'实际操作证据',exampleStatus:'示例证据状态'};function link(url,label){const a=document.createElement('a');a.href=url;a.textContent=label;a.target='_blank';a.rel='noopener';return a}function render(){const q=document.getElementById('q').value.toLowerCase(),cat=document.getElementById('category').value;const rs=report.records.filter(r=>(!cat||r.category===cat)&&JSON.stringify(r).toLowerCase().includes(q));const root=document.getElementById('rows');root.replaceChildren();document.getElementById('count').textContent='显示 '+rs.length+' / 52 个唯一入口';for(const r of rs){const a=document.createElement('article');const h=document.createElement('h2');h.append(link(r.sourceUrl,r.chineseName));a.append(h);const status=document.createElement('small');status.textContent=r.category+' · HTTP '+r.availability+' · 证据 '+r.evidenceTypes.join('/')+' · 导出 '+r.exportProfile+' / 项目 '+r.projectProfile;a.append(status);if(r.previewUrls.length){const im=document.createElement('img');im.src=r.previewUrls[0];im.alt=r.chineseName+'原站预览（仅研究引用）';im.loading='lazy';im.className='preview';a.append(im)}const dl=document.createElement('dl');for(const [key,label]of Object.entries(labels)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=r[key];dl.append(dt,dd)}for(const [key,label]of [['exampleUrls','原始示例链接'],['previewUrls','全部原站预览'],['sourceScripts','公开脚本']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;r[key].forEach((url,i)=>{if(i)dd.append(document.createTextNode(' · '));dd.append(link(url,url.split('/').pop()))});if(!r[key].length)dd.textContent='待补充核验';dl.append(dt,dd)}a.append(dl);root.append(a)}}document.getElementById('q').oninput=render;document.getElementById('category').onchange=render;render();</script></html>'''.replace('PAYLOAD',payload)
(ROOT/'index.html').write_text(page)
print(json.dumps({'records':len(records),'previews':sum(len(r['previewUrls']) for r in records),'examples':sum(bool(r['exampleUrls']) for r in records),'missingPreview':[r['id'] for r in records if not r['previewUrls']]},ensure_ascii=False))
public=ROOT.parents[1]/'web'/'public'/'research';public.mkdir(parents=True,exist_ok=True)
for name in ['index.html','comparison.json','comparison.csv','tree-layers.json','tree-layers.csv']:shutil.copy2(ROOT/name,public/name)
