# OpenAcad 统计与导出 API v1

所有数据处理与服务器错误面向用户使用中文。服务入口为 `app.main:app`；Docker 默认启动 Uvicorn 8000。队列进程使用同一镜像运行 `python -m app.worker`。环境：`REDIS_URL=redis://redis:6379/0`、`JOB_TTL_SECONDS=3600`、`JOB_TIMEOUT_SECONDS=300`。

## 任务接口

`POST /api/jobs`：

```json
{"kind":"analysis","method":"pca","data":{"tables":[{"id":"table-1","name":"样本数据","role":"matrix","columns":["样本","长度","宽度"],"rows":[["A",1,2],["B",2,1],["C",3,4]]}]},"params":{"standardization":"None","direction":"column","seed":1}}
```

响应 HTTP 202：`{id,token,status:"queued",expiresAt}`。token 是仅返回一次的随机 capability。调用 `GET /api/jobs/{id}`、`DELETE /api/jobs/{id}` 时携带 `Authorization: Bearer <token>`。GET 返回 `{id,status,createdAt,expiresAt,result?,error?}`；status 为 queued/started/finished/failed/canceled。DELETE 取消排队或运行任务，并删除数据和结果。未知任务、过期或错误 token 均返回404。`GET /api/health` 检查 Redis 和已注册 worker；不公开数据。

维护标记 `OPENACAD_MAINTENANCE_FILE`（默认 `/run/openacad/maintenance`）存在时，新建任务返回中文503；查询和取消仍可用。队列达到100个等待任务时拒绝新建。单次请求体最多25 MB。

结果：`{schemaVersion:1,method,data,provenance,diagnostics}`。provenance 含引擎/包版本、methodVersion、seed、输入SHA256和参数；diagnostics 是 `{code,message}` 数组。失败的 error 为 `{code,message,table?,row?,column?}`，row 为含表头的1起始行号。

表格每行必须等长，列名唯一非空，ID唯一非空。默认首列是样本ID，其余数值；null仅在描述统计/密度/独立组检验中表示缺失。其他分析拒绝缺失。两矩阵按样本ID对齐，不按上传顺序猜测；ID集合不一致报错。最大100万单元格。所有选择项使用下列固定字符串。

## 通用参数

- `seed`: 0..2147483647，默认1；仅随机分析生效，始终记录。
- `standardization`: `None|StandardScaler|MinMaxScaler|MaxAbsScaler|RobustScaler|PercentScaler`，默认None。
- `direction`: `column|row`，默认column。StandardScaler使用总体SD(ddof0)，RobustScaler使用median/IQR(type7)，PercentScaler使用100*x/sum、非负且和大于0；尺度为0的其他缩放以尺度1处理并提示。
- `idColumn`: 矩阵类首列索引或列名，默认0；`columns`: 可选数值列索引/列名数组。R分析固定首列ID，所有后续列为数值，不支持这两个列映射参数，前端应先映射表格。
- `pAdjust`: `none|BH|BY|holm|bonferroni`，默认none。原始与校正P始终分别返回。

## 方法与结构（result.data）

### descriptive / density / tests

- `descriptive`：单宽表，允许null。返回 `columns:[{name,n,missing,mean,sd,se,min,q1,median,q3,max,lowerWhisker,upperWhisker,outliers:number[]}]`，SD为样本SD，单点为null；IQR规则1.5，四分位type7。
- `density`：同表。params `points`默认512(32..2048)、`bandwidth`默认`scott`，可`silverman`或正数（SciPy factor）；`bandwidthMultiplier`默认1，按每列样本量计算基础factor后相乘。实际核宽h=样本SD(ddof1)×有效factor。`trim`默认true时网格为[min,max]；false为[min−3×总体SD,max+3×总体SD]，扩域SD使用ddof0；两端点均包含。`bins`默认30。返回 `columns:[{name,x:number[],density:number[],bandwidthFactor,baseBandwidthFactor,bandwidthMultiplier,bandwidthAbsolute,histogram:{counts,edges}}],kernel:"gaussian"`。bandwidthAbsolute为实际h。单值样本或常量列拒绝估计KDE。
- `tests`：单宽表，每个数值列是一组；第一列样本/配对ID。同一行即同一配对；独立组可用null补齐。params `test=ttest_ind|ttest_rel|wilcoxon_ind|wilcoxon_rel|wilcoxon_rank_sum|anova`，默认ttest_ind；`comparisons=all|first`默认all；`alternative=two-sided|less|greater`默认two-sided；`equalVariance`默认false，仅独立t；`pAdjust`。返回 `comparisons:[{left,right,nLeft,nRight,statistic,p,adjustedP,meanDifference}],test,pAdjust,alternative`。ANOVA为单项 `{groups,statistic,p}`。wilcoxon_ind=Mann–Whitney渐近/连续性校正；wilcoxon_rel=符号秩渐近/校正；wilcoxon_rank_sum=ranksums正态近似，遇并列值要求改Mann–Whitney。配对缺失不一致报错。

### standardize / distance / cluster / pca

- `standardize`：返回 `{values:number[][],rowLabels:string[],columnLabels:string[]}`。
- `distance`：params `distance`默认euclidean、`minkowskiP`默认2、`axis=row|column|both`默认row；返回 `{distance,row?:{labels,distances:number[][]},column?:{labels,distances:number[][]}}`。
- `cluster`：同distance，另 `linkage=single|complete|average|weighted|centroid|median|ward`默认complete；每个轴结果另有 `{linkage:number[][],order:number[],method}`，linkage遵循SciPy四列[左簇ID,右簇ID,合并高度,成员数]，order是0起始输入位置。centroid/median/ward只接受euclidean。顶层返回实际标准化后的 `values,rowLabels,columnLabels`；前端按order重排该矩阵。
- 通用距离完整枚举：`euclidean,sqeuclidean,braycurtis,canberra,chebyshev,cityblock,correlation,cosine,dice,hamming,jaccard,jensenshannon,kulczynski1,kulsinski,mahalanobis,matching,minkowski,rogerstanimoto,russellrao,seuclidean,sokalmichener,sokalsneath,yule`。matching/sokalmichener为兼容别名。二值距离要求0/1。无定义结果明确报错。
- `pca`：返回 `{scores:number[][],loadings:number[][],eigenvalues:number[],explainedRatio:number[],rowLabels,columnLabels,center}`。scores行为样本列为PC，loadings行为特征列为PC；默认图取前2列。解释率是0..1。预标准化后PCA仅中心化，不再缩放。

### correlation

单表为组内，两表为组间；固定首列样本ID。params `correlation=pearson|spearman|kendall`默认pearson（也接受pearsonr/spearmanr/kendalltau）；`alternative`、`pAdjust`。返回 `{rowLabels,columnLabels,r:number[][],p:number[][],adjustedP:number[][],n,correlation,hypothesisCount,pAdjust}`。组内校正只数上三角、不含对角，对角P记1；组间统计全部组合。常量列拒绝。

### pcoa / nmds / cca / rda

- `pcoa`：单矩阵，经通用standardization后Python距离，R ape分解。params通用`distance,minkowskiP`，`correction=none|lingoes|cailliez`默认none。返回 `{scores,rowLabels,eigenvalues,explainedRatio,negativeEigenvalueSum,correction}`；只返回可绘制正特征轴，比例以正特征值之和为分母，负特征值单独诊断。
- `nmds`：单矩阵；params生态`distance`默认bray、`dimensions`默认2(2..3)、`try`默认20、`tryMax`默认100、`seed`及通用标准化。返回 `{scores,rowLabels,stress,converged,tries,dimensions}`。自动变换关闭，不把stress当解释率。
- `cca`/`rda`：两个表，role必须分别为`response`与`environment`，首列均样本ID，后列数值。params通用标准化应用于response；`scaling`默认2，可1/2。返回 `{scores,rowLabels,loadings,columnLabels,environmentVectors,environmentLabels,eigenvalues,explainedRatio,constrainedExplainedRatio,totalInertia,constrainedInertia,scaling}`。scores为样本坐标，loadings为物种坐标，environmentVectors为环境箭头，皆二维数组。解释率分别占总惯量和约束惯量，均0..1。CCA要求非负响应且非零行列。

生态距离（vegan语义，与通用同名距离不混用）：`bray,manhattan,euclidean,canberra,clark,kulczynski,jaccard,gower,altGower,morisita,horn,mountford,raup,binomial,chao,cao,mahalanobis,chisq,chord,hellinger,aitchison`；`pseudocount`默认0，Aitchison有0时必须显式设正数。

### lm / loess / gam

单表前三列为ID/x/y；可通过params `groupColumn`指定分组列索引(0起始)或名称，其余映射由前端完成。params `confidence`默认.95，`points`默认200(20..1000)；loess另`span`默认.5、`degree`默认2(1/2)；gam `basisDimension`默认10，实际最多distinct_x−1；固定高斯族、薄板样条、REML。

返回 `{series:[{name,observations:[{id,x,y}],curve:[{x,y,lower,upper}],model:{method,formula,n,coefficients?,rSquared?,p?,edf?,rank?,residualDf?}}]}`。LM是均值响应置信带；LOESS/GAM为文档说明的近似带；不会把曲线简化为虚构线性方程。

### mantel / mantel.randtest / mantel.rtest / mantel.partial

role=`environment`表一份，role=`community`表一至多份；partial必须额外role=`control`表一份。每张首列样本ID，后列数值。按环境表的每个变量，分别生成群落→变量的关联边；Z固定为整份控制矩阵的距离，绝不自动选其他环境变量。

params `speciesDistance`默认bray、`environmentDistance`默认euclidean、`controlDistance`默认euclidean（生态距离枚举）；`correlation`默认pearson，普通mantel可spearman/kendall，其他三分支仅pearson；`permutations=999|9999|99999`默认999；`seed`、`pAdjust`。结果 `{edges:[{source,target,r,p,adjustedP,n}],method,permutations,seed,alternative:"greater"}`；source为community表id，target为环境列名。默认检验正关联单侧。partial缺control时报错。

Mantel 结果额外有 `environmentCorrelation:{r,p,adjustedP,rowLabels,columnLabels,n,correlation:"pearson",hypothesisCount,pAdjust}`，由 Python 对同一环境表真实计算，用于环境相关性热图。环境相关性与 Mantel 边分别进行 P 值校正。

### gc

`data.sequences`为FASTA文本。params `contentWindow,skewWindow`默认2000，各1..1000000，步长等于窗口大小且保留末窗。返回 `{sequences:[{name,length,gcContent:[{start,end,value,validBases}],gcSkew:[...]}],coordinateSystem:"1-based-inclusive"}`；GC%以ACGT总数为分母，GC-skew=(G−C)/(G+C)，歧义碱基排除，零分母返回null。

## 导出

`{kind:"export",method:"render",data:{svg:"<svg ...>...</svg>"},params:{format:"svg|png|pdf|eps",dpi:300,outline:false,filename:"图表",width?:800,height?:600,background?:"#ffffff"}}`。

dpi仅150/300/600；SVG单位px，宽高可显式覆盖正数(最多16000)。PNG依据96 CSS px/in换算DPI。默认保留SVG背景/透明度；`background:"transparent"`或十六进制色明确覆盖。EPS不支持半透明，需背景色(默认白)且主动栅格化透明效果，结果诊断明确标注；outline=true先将文字转曲线。拒绝script、foreignObject、事件、外链href、外部CSS及外部URL；内部#引用允许。镜像提供Noto CJK中文字体。

`Noto Sans SC` 字体家族在导出时归一化为镜像实际安装的 `Noto Sans CJK SC`。覆盖背景色会增加画布背景，但不删除图表自身的矩形或其他可见元素。

镜像提供两种字体各自真实的 Regular（400）和 Bold（700）。直接 API SVG 的 `font-weight` 属性、行内样式及样式表声明按这两种静态字重匹配：有效数值 1..1000 中，<=500 选择 400，>500 选择 700；`normal`/`bold` 等价于 400/700。声明顺序、`!important`、其他属性、CSS 字符串和 custom property 保持原样。

直接 API SVG 若同时包含有效 `bolder`/`lighter` 相对字重声明及必须改变数值的字重映射，会返回 `RELATIVE_FONT_WEIGHT` 中文错误，要求先将文字字重转换为明确的 400/700；后端不猜测完整 CSS 级联，以免改写祖先数值后导致子文字相对字重变义。仅 `normal`/`bold` 或 `400.0`→`400` 等数值不变的替换不会触发此限制，字符串和 custom property 中的相对字重词也不计入。正常网页导出会先把各文本实际计算后的字重保存为绝对值，因此不依赖这一相对声明分支。

返回 `result={schemaVersion:1,method:"render",data:{},artifact:{filename,mimeType,contentBase64},provenance:{...},diagnostics:[]}`。前端base64解码后Blob下载，不需要公开文件地址。SVG/PDF/EPS/PNG均通过真实Inkscape处理并检查魔数；导出异常返回具体中文说明。
