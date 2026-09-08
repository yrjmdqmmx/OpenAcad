import type { Dataset, Template, Cell } from '../core/types';
import { layerExample, defaultLayerSettings } from './tree/layers';
import { parseTree } from './tree/model';
import correlationExamples from './scientific-correlations.json';

// Fixed seeds keep screenshots, downloaded examples and computed summaries reproducible.
function random(seed: number) { return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return (seed + .5) / 4294967296; }; }
function normal(r: () => number) { return Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()); }
const round = (x: number) => +x.toFixed(3) || 0;
const table = (columns: string[], rows: Cell[][], name: string, role = 'data', id = 'data'): Dataset => ({ tables: [{ id, name, role, columns, rows }] });
const labels = ['对照', '低剂量', '中剂量', '高剂量'];

export function improveScientificExamples(templates: Template[]) {
  const get = (id: string) => templates.find(t => t.id === id)!;
  const set = (id: string, example: Dataset, style: Record<string, unknown> = {}) => {
    const t = get(id); t.example = structuredClone(example); Object.assign(t.defaultStyle, style);
  };
  for (const t of templates) {
    if (!t.defaultStyle.subtitle) t.defaultStyle.subtitle = '模拟数据 · 用于演示，不代表研究结论';
    t.exampleSource.label = 'OpenAcad 可复现模拟数据；仅用于演示，不代表研究结论';
  }
  const dose = table(['类别','数值'], labels.map((n,i)=>[n,[18.6,27.4,35.1,31.8][i]]), '模拟酶活性（U/mL）');
  for (const id of ['bar','lollipop']) set(id,dose,{title:'处理剂量与酶活性',yTitle:'酶活性 (U/mL)',xTitle:'处理剂量'});
  const category=table(['类别','数值','分组'],['碳水化合物代谢','氨基酸代谢','脂质代谢','膜运输','信号转导','蛋白质折叠'].map((n,i)=>[n,[36.2,21.8,14.9,28.3,18.4,12.6][i],i<3?'代谢功能':'细胞过程']),'模拟功能丰度（每千基因数）');
  for (const id of ['bar-category','lollipop-category']) set(id,category,{title:'微生物功能类别丰度',xTitle:'功能基因数 / 千基因',yTitle:'功能类别',sort:'descending',marginLeft:160});
  const grouped=table(['类别','数值','分组'],labels.flatMap((n,i)=>['野生型','突变体'].map((g,j)=>[n,[[18.6,17.2],[27.4,22.8],[35.1,29.6],[31.8,25.4]][i][j],g])),'模拟基因型处理实验（U/mL）');
  set('bar-grouped',grouped,{title:'不同基因型的处理响应',xTitle:'处理剂量',yTitle:'酶活性 (U/mL)'});
  for (const id of ['box','box-grouped','violin','raincloud','ridgeline','bar-error','bar-grouped-error','scatter-error']) {
    const grouped=['box-grouped','bar-grouped-error'].includes(id), density=['violin','raincloud','ridgeline'].includes(id), n=density?40:18, rng=random(7103);
    const rows: Cell[][]=[];
    labels.slice(0,3).forEach((name,g)=>{
      for(let strain=0;strain<(grouped?2:1);strain++) for(let i=0;i<n;i++) {
        const z=normal(rng), skew=g===2?(z*z-1)*1.4:0;
        const v=round(Math.max(.3,22+g*5+strain*(g===1?1:3)+z*(3+g*.8+strain)+skew+(i===n-1&&g===1?11:0)));
        rows.push(grouped?[name,v,['野生型','突变体'][strain],`重复${i+1}`]:[name,v,`重复${i+1}`]);
      }
    });
    const horizontal=['raincloud','ridgeline'].includes(id);
    set(id,table(grouped?['类别','数值','分组','样本']:['类别','数值','样本'],rows,'模拟重复实验（U/mL）'),{title:'处理响应与重复实验分布',subtitle:'固定种子模拟观测 · 用于演示',xTitle:horizontal?'酶活性 (U/mL)':'处理剂量',yTitle:horizontal?'处理剂量':'酶活性 (U/mL)',showPoints:id!=='ridgeline',...(id==='scatter-error'?{yMin:8,yMax:null}:{}),...(density?{pointSize:2.5}: {})});
  }
  for (const id of ['line','line-error']) {
    const rng=random(802), rows:Cell[][]=[], means=[[.14,.27,.56,.88,1.08,1.13],[.13,.24,.43,.65,.82,.91]];
    ['对照培养','盐胁迫'].forEach((g,j)=>[0,4,8,12,16,20].forEach((hour,i)=>{
      for(let k=0;k<(id==='line-error'?6:1);k++)rows.push([String(hour),round(Math.max(.01,means[j][i]+normal(rng)*(.012+i*.006))),g,...(id==='line-error'?[`重复${k+1}`]:[])]);
    }));
    set(id,table(id==='line-error'?['类别','数值','分组','样本']:['类别','数值','分组'],rows,'模拟微生物生长过程'),{title:'培养条件与生长曲线',xTitle:'培养时间 (h)',yTitle:'光密度 OD600',curve:'linear'});
  }
  for(const id of ['scatter','scatter-grouped']) {
    const rng=random(943), grouped=id.endsWith('grouped');
    const rows=Array.from({length:36},(_,i)=>{const x=round(12+rng()*24), g=i%2, y=round(5+.68*x+(grouped?g*3:0)+normal(rng)*2.2); return [`样本${String(i+1).padStart(2,'0')}`,x,y,...(grouped?[g?'补水':'对照']:[]),round(3+rng()*7)];});
    set(id,table(grouped?['名称','横坐标','纵坐标','分组','大小']:['名称','横坐标','纵坐标','大小'],rows,'模拟叶片气体交换'),{title:'叶片氮含量与光合速率',xTitle:'叶片氮含量 (mg/g)',yTitle:'净光合速率 (µmol/m²/s)'});
  }
  set('dumbbell',table(['类别','起点','终点'],['样地 A','样地 B','样地 C','样地 D','样地 E','样地 F'].map((n,i)=>[n,[21.3,28.5,24.2,31.6,18.9,26.1][i],[28.4,31.7,29.5,30.2,25.8,32.4][i]]),'模拟配对土壤含水率'),{title:'灌溉前后土壤含水率',xTitle:'土壤含水率 (%)',yTitle:'样地'});
  set('bar-line',table(['类别','数值','折线数值'],['0','3','6','9','12','15'].map((h,i)=>[h,[.2,.8,1.9,3.4,4.6,4.9][i],[20,17.8,14.1,9.6,5.3,3.4][i]]),'模拟发酵过程'),{title:'发酵过程中的生物量与底物',xTitle:'培养时间 (h)',yTitle:'干细胞质量 (g/L)',rightYTitle:'葡萄糖浓度 (g/L)',barLegend:'生物量',lineLegend:'葡萄糖',marginRight:100});
  const components=['碳代谢','氨基酸代谢','脂质代谢','其他功能'];
  set('pie',table(['类别','数值'],components.map((n,i)=>[n,[42,27,18,13][i]]),'模拟群落功能组成（%）'),{title:'微生物群落功能组成',subtitle:'模拟数据 · 各部分合计 100%',percentLabels:true,showLabels:true});
  const composition=[[42,27,18,13],[35,31,21,13],[48,22,16,14]], groups=['对照','升温','补水'];
  set('bar-stacked',table(['类别','数值','分组'],groups.flatMap((n,i)=>components.map((c,j)=>[n,composition[i][j],c])),'模拟功能组成（%）'),{title:'环境处理下的功能组成',normalize:true,yTitle:'相对丰度 (%)',xTitle:'环境处理'});
  set('bar-grouped-stacked',table(['类别','数值','分组','大组'],['根际土壤','非根际土壤'].flatMap((batch,k)=>groups.flatMap((n,i)=>components.map((c,j)=>[n,composition[i][j]+(k?[3,-2,1,-2][j]:0),c,batch]))),'模拟分层群落组成（%）'),{title:'生境与处理下的功能组成',normalize:true,yTitle:'相对丰度 (%)',xTitle:'环境处理'});
  set('rose',table(['类别','数值'],['北','东北','东','东南','南','西南','西','西北'].map((n,i)=>[n,[8,12,25,34,17,9,6,11][i]]),'模拟花粉传播方向频数'),{title:'花粉传播方向分布',subtitle:'模拟数据 · 扇区面积表示观测次数',showLabels:true});
  const traits=['耐盐性','耐旱性','生长速率','光合效率','水分利用率'];
  set('radar',table(['类别','数值','分组'],['品系 A','品系 B'].flatMap((g,j)=>traits.map((t,i)=>[t,[[82,67,74,86,71],[65,88,69,73,89]][j][i],g])),'模拟植物多性状评分'),{title:'植物品系多性状比较',subtitle:'模拟数据 · 指标统一为 0–100 分，分数越高表示该性状表现越强',yMax:100,showLabels:true});
  const sets=['转录组','蛋白组','代谢组','表型筛选'], intersections=[[1,18],[2,12],[3,15],[4,9],[5,7],[6,5],[7,11],[8,6],[9,4],[15,8]];
  const setRows:Cell[][]=[];let gene=0;
  intersections.forEach(([mask,count])=>{for(let n=0;n<count;n++){const id=`候选${++gene}`;sets.forEach((set,i)=>{if(mask&(1<<i))setRows.push([set,id]);});}});
  set('upset',table(['集合','成员'],setRows,'模拟多组学候选交集'),{title:'多组学候选条目的重叠',subtitle:'模拟数据 · 柱高为互斥交集成员数',showLabels:true});
  for(const id of ['heatmap','circle-heatmap','bubble-matrix','binary-dot','binary-rect']) {
    const rng=random(482), binary=id.startsWith('binary'), cols=['碳利用','氮转化','磷转化','抗氧化','膜运输','胁迫响应'];
    const rows=Array.from({length:9},(_,i)=>{const g=Math.floor(i/3);return [`${groups[g]}-${i%3+1}`,...cols.map((_,j)=>binary?Number((g+j)%3!==0||rng()>.7):round(Math.max(.1,[[14,10,7,3,5,4],[8,6,5,13,11,15],[17,14,12,6,8,7]][g][j]+normal(rng)*1.6)))];});
    set(id,table(['样本',...cols],rows,binary?'模拟功能存在矩阵':'模拟功能丰度矩阵','matrix','matrix'),{title:binary?'不同处理下的功能存在与缺失':'不同处理下的功能丰度',subtitle:binary?'模拟数据 · 1 表示存在，0 表示未检出':'模拟数据 · 标准化相对丰度（任意单位）',labelAngle:0,showValues:!binary&&id!=='circle-heatmap',marginLeft:115,innerRadius:95,sweepAngle:320});
  }
  for(const id of ['correlation','double-correlation','mantel'] as const) {
    set(id,correlationExamples[id].dataset as Dataset,{title:id==='double-correlation'?'土壤环境与群落功能关联':id==='mantel'?'群落结构与土壤环境关联':'土壤环境因子的相关性',subtitle:'模拟原始观测 · n = 18 · Pearson 实算；P 值未校正'+(id==='mantel'?'；Mantel 999 次置换':''),marginBottom:135});
  }
  get('bubble-matrix').defaultStyle.marginBottom=165;
  const motif=get('protein-motifs'), protein=get('protein-domains');
  const seq=protein.example.tables[0];
  const newSeq={...structuredClone(seq),rows:[['蛋白甲',720],['蛋白乙',640],['蛋白丙',890],['蛋白丁',765],['蛋白戊',810]]};
  const segments=Array.from({length:5},(_,i)=>[...Array.from({length:4},(_,j)=>{const start=45+j*145+(i%3)*18;return [['蛋白甲','蛋白乙','蛋白丙','蛋白丁','蛋白戊'][i],`基序 ${j%3+1}`,start,start+[18,24,15,18][j],`基序 ${j%3+1}`,Number((1e-7*(i+1)*(j+1)).toPrecision(3))];})]).flat();
  motif.example={tables:[newSeq,{...structuredClone(protein.example.tables[1]),name:'模拟基序命中（非 MEME 实测）',rows:segments}]};
  Object.assign(motif.defaultStyle,{title:'同源蛋白的短基序排列',subtitle:'模拟命中 · 短片段与重复基序 · 位置单位 aa',segmentHeight:18});
  protein.example=structuredClone(protein.example);protein.example.tables[0].rows.push(['蛋白丁',765],['蛋白戊',810]);
  protein.example.tables[1].rows.push(['蛋白丁','结合域',45,185,'结合域',1e-8],['蛋白丁','催化域',280,565,'催化域',1e-10],['蛋白戊','调节域',90,230,'调节域',1e-5],['蛋白戊','催化域',330,665,'催化域',1e-12]);
  protein.defaultStyle.subtitle='模拟结构域命中 · 非数据库检索结果 · 位置单位 aa';
  const genes=get('gene-cluster');genes.example=structuredClone(genes.example);genes.example.tables[0].rows.push(['菌株丁','丁_转录因子',100,780,'+','调节'],['菌株丁','丁_酶A',900,1680,'+','代谢'],['菌株丁','丁_转运蛋白',1890,2700,'+','运输'],['菌株戊','戊_酶A',400,1190,'-','代谢'],['菌株戊','戊_转录因子',1350,2100,'-','调节'],['菌株戊','戊_转运蛋白',2350,3210,'+','运输']);genes.defaultStyle.subtitle='模拟比较基因簇 · 箭头表示链方向 · 位置单位 bp';
  const packing=get('packing');packing.example=table(['name','value','group'],['根际','叶际','水体'].flatMap((g,i)=>Array.from({length:5},(_,j)=>[`${g}类群${j+1}`,[34,22,15,11,7][j]+i*(j%2?3:1),g])),'模拟生境群落组成','items','items');packing.defaultStyle.subtitle='模拟数据 · 圆面积表示相对丰度，颜色表示生境';
  const network=get('network');network.example=structuredClone(network.example);
  network.example.tables[0].rows=Array.from({length:15},(_,i)=>[`n${i+1}`,`基因${String(i+1).padStart(2,'0')}`,['代谢模块','信号模块','胁迫模块'][Math.floor(i/5)],3+i%5]);
  network.example.tables[1].rows=Array.from({length:3},(_,g)=>Array.from({length:5},(_,j)=>[`n${g*5+j+1}`,`n${g*5+(j+1)%5+1}`,1+(j%3)])).flat();
  network.example.tables[1].rows.push(['n3','n7',1],['n8','n12',2],['n1','n5',3],['n6','n10',2],['n11','n15',3]);
  Object.assign(network.defaultStyle,{title:'基因功能关联网络',subtitle:'模拟关联 · 颜色表示模块，节点大小表示权重，边宽表示关联强度',linkDistance:125,repulsion:320,nodeScale:5});
  set('sankey',table(['source','target','value'],[['原始样本','质控通过',180],['原始样本','质控剔除',20],['质控通过','完成测序',162],['质控通过','测序失败',18],['完成测序','纳入分析',148],['完成测序','覆盖不足',14]],'模拟样本筛选流程','links','links'),{title:'研究样本筛选流程',subtitle:'模拟数据 · 流带宽度表示样本数，逐步分流数量守恒',showValues:true});
  const map=get('map');map.example=structuredClone(map.example);map.example.tables[0].rows.push(['样点庚',100.2,25.6,'陆地',31],['样点辛',88.6,43.8,'陆地',9],['样点壬',151.2,-33.9,'海岸',26],['样点癸',7.3,43.7,'海岸',21]);map.defaultStyle.subtitle='模拟采样 · 点面积表示样本数，颜色表示生境';
  const volcano=get('volcano'), rng=random(6731);
  volcano.example=table(['id','log2FC','pvalue'],Array.from({length:360},(_,i)=>{const shifted=i%5===0,fc=normal(rng)*(shifted?1.4:.48)+(shifted?(i%2?1.8:-1.8):0), strength=Math.max(.03,Math.abs(fc)*1.6+normal(rng)*.65);return [`模拟基因${String(i+1).padStart(3,'0')}`,round(fc),Number((10**-strength).toPrecision(5))];}),'模拟差异结果（非统计检验）','genes','genes');
  Object.assign(volcano.defaultStyle,{title:'处理响应的差异分布',subtitle:'模拟 log2FC 与 P 值 · 非统计检验结果',neutralColor:'#87959f',showLabels:true,labelCount:8});
  const enrichment=get('enrichment-dot').example;
  const erows=[['SIM:01','24/180','碳水化合物代谢',.0004,24,'生物过程',310,17,7],['SIM:02','15/180','氧化应激响应',.002,15,'生物过程',220,11,4],['SIM:03','18/180','跨膜物质运输',.006,18,'细胞组分',275,8,10],['SIM:04','9/180','细胞壁组织',.019,9,'生物过程',190,6,3],['SIM:05','21/180','核酸结合',.004,21,'分子功能',360,9,12],['SIM:06','12/180','蛋白质折叠',.012,12,'分子功能',230,8,4],['SIM:07','7/180','膜结构重建',.037,7,'细胞组分',165,3,4],['SIM:08','16/180','信号转导调控',.009,16,'生物过程',290,10,6]] as Cell[][];
  for(const id of ['enrichment-dot','enrichment-bar','enrichment-circle']) {const e=structuredClone(enrichment);e.tables[0].rows=erows;set(id,e,{subtitle:'模拟富集结果 · 非检验输出 · GeneRatio = Count / 180',circleLabel:'description',showValues:id!=='enrichment-circle',marginLeft:id==='enrichment-circle'?95:170,marginBottom:135});}
  const synteny = get('synteny');
  synteny.example = { tables: [
    {id:'chromosomes',name:'模拟比较染色体',role:'chromosomes',columns:['id','length'],rows:[['参考染色体',12000],['样本 A',11500],['样本 B',12500],['样本 C',11800]]},
    {id:'synteny-genes',name:'模拟基因位置',role:'synteny-genes',columns:['chromosome','id','start','end'],rows:['参考染色体','样本 A','样本 B','样本 C'].flatMap((chr,i)=>Array.from({length:6},(_,j)=>[chr,`s${i}g${j}`,600+j*1700+i*100,1150+j*1700+i*100]))},
    {id:'synteny-links',name:'模拟配对（非比对结果）',role:'synteny-links',columns:['source','target','block','evalue'],rows:Array.from({length:3},(_,i)=>Array.from({length:6},(_,j)=>[`s${i}g${j}`,`s${i+1}g${i===1&&j>=2&&j<=4?6-j:j}`,j<2?'区段一':j<5?'区段二':'区段三',1e-12])).flat()},
  ]};
  synteny.defaultStyle.subtitle='模拟共线性配对 · 含倒位示意 · 位置单位 bp · 非序列比对结果';
  get('genome-circos').defaultStyle.subtitle='模拟染色体与区间轨道 · GC 数值为演示输入 · 非序列计算结果';
  for(const t of templates.filter(t=>t.familyId==='ordination')) {
    t.defaultStyle.palette=['#087f8c','#ce674f','#637faa','#916329','#679687','#9a6790'];
    t.exampleLayout={ sampleAnnotations:Object.fromEntries(t.example.tables[0].rows.map(r=>[String(r[0]),{group:String(r[0]).split(' ')[0],label:String(r[0])}])) };
    t.defaultStyle.subtitle='模拟土壤群落 · 对照 / 升温 / 补水 · 结果由真实算法计算';
    if(['cca','rda'].includes(t.id))t.defaultStyle.vectorScale=1.6;
  }
  for(const t of templates.filter(t=>t.id.startsWith('tree-'))) {
    const root=parseTree(t.example.text!);
    const kinds=t.id==='tree-unrooted'?['label-background']:['label-background','bar','heatmap'];
    t.exampleLayers=kinds.map((kind,i)=>({id:`example-${kind}`,type:`tree:${kind}`,name:['耐旱分组（模拟）','叶氮 (mg/g)','相对表达量'][i],visible:true,data:structuredClone(layerExample(kind,root)),settings:{...defaultLayerSettings,width:kind==='bar'?72:kind==='heatmap'?80:20,gap:6,fontSize:18,color:kind==='bar'?'#b96239':'#32778b',showValues:kind==='bar'}}));
    const grouping=t.exampleLayers[0].data!.tables[0];grouping.columns.push('分类');grouping.rows.forEach((r,i)=>r.push(i%2?'湿生型':'耐旱型'));
    const bar=t.exampleLayers.find(l=>l.type==='tree:bar');
    if(bar){bar.settings.title='叶氮';bar.data!.tables[0].rows.forEach((r,i)=>r[1]=[17.2,21.3,16.6,18.9,12.4,25.8,19.6][i]);}
    const heat=t.exampleLayers.find(l=>l.type==='tree:heatmap');
    if(heat){heat.settings.title='相对表达';const rng=random(3401);heat.data!.tables[0].rows.forEach((r,i)=>{r[1]=['对照','升温','干旱','补水'][i%4];r[2]=round(.4+rng()*3.8);});}
    Object.assign(t.defaultStyle,{fontSize:20,titleSize:30,labelWidth:80,lineWidth:2});
    t.defaultStyle.showLegend=true;
    t.defaultStyle.subtitle=bar?'模拟拓扑与性状 · 叶氮 mg/g · 热图从左到右：对照/升温/干旱/补水，颜色越深表达越高':'模拟拓扑与性状 · 不代表真实系统发育结论';
  }
}
