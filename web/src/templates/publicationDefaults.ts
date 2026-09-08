import type { Template, ChartStyle } from '../core/types';
import { parseTree } from './tree/model';
import { layerExample, defaultLayerSettings } from './tree/layers';
import inference from './scientific-inference.json';

export const publicationPalette = ['#287c9a', '#cb6943', '#779146', '#8c6b9a', '#b39345', '#4e9590', '#a65e78', '#697d92'];
// Versioned defaults affect newly created projects. decodeProject deliberately
// preserves saved styles, data, analysis and manually positioned annotations.
const common: Partial<ChartStyle> = {
  publicationVersion: 1, fontFamily: 'Noto Sans SC', fontSize: 17, titleSize: 24,
  textColor: '#293640', palette: publicationPalette, opacity: 1,
  marginTop: 116, marginBottom: 100, marginLeft: 106, marginRight: 55,
  axisColor: '#59636b', gridColor: '#52616b', gridOpacity: .12,
  tickCount: 5, lineWidth: 1.8, pointSize: 5, cornerRadius: 0,
};
const firstBatch: Record<string, Partial<ChartStyle>> = {
  'bar-error': { height: 680, palette: ['#287c9a'], barPadding: .5, showLegend: false, opacity: .2, strokeWidth: 1.4, pointSize: 7, errorCap: 8, lineWidth: 2, showLabels: false },
  raincloud: { height: 720, marginLeft: 112, marginBottom: 90, barPadding: .3, opacity: .3, pointSize: 3.3, lineWidth: 1.6, showLegend: false, boxWidth: 22 },
  heatmap: { height: 720, marginLeft: 130, marginBottom: 130, cellGap: 1.2, cellStroke: 0, diverging: false, lowColor: '#f0f5ef', highColor: '#225c70', digits: 1, labelAngle: 0 },
  volcano: { height: 720, marginTop: 140, marginBottom: 126, pointSize: 3.8, pointOpacity: .72, upColor: '#c66442', downColor: '#287c9a', neutralColor: '#b0b7bc', labelCount: 7, showGrid: false, thresholdColor: '#7b858d', thresholdWidth: 1.2 },
  pca: { height: 720, pointSize: 7, labelSize: 14, pointShape: 'group', showGrid: false, seriesStyles: {'变量载荷':{legendShape:'line'}, '环境因子':{legendShape:'line'}} },
  'tree-circle': { width: 1060, height: 1100, treeWidth: 540, labelWidth: 100, fontSize: 17, lineWidth: 1.6, nodeSize: 2.4, marginTop: 128, marginBottom: 75 },
};
const basicProfiles: Record<string, Partial<ChartStyle>> = {
  bar: {palette:['#287c9a'], showLegend:false, barPadding:.48, showLabels:true, strokeWidth:0},
  'bar-grouped': {barPadding:.32, showLabels:true, strokeWidth:0},
  'bar-category': {marginLeft:190, barPadding:.4, showLabels:true, strokeWidth:0},
  'bar-grouped-error': {...firstBatch['bar-error'],palette:publicationPalette,showLegend:true,barPadding:.32,pointSize:5.5},
  'scatter-error': {...firstBatch['bar-error'],opacity:1,pointSize:8,barPadding:.45},
  'bar-stacked': {barPadding:.42,strokeColor:'#ffffff',strokeWidth:1.2,opacity:1},
  'bar-grouped-stacked': {barPadding:.24,strokeColor:'#ffffff',strokeWidth:1.2,opacity:1},
  'bar-line': {barPadding:.5,lineWidth:2.8,pointSize:5,marginRight:100,showGrid:false},
  lollipop: {palette:['#287c9a'],showLegend:false,showLabels:true,pointSize:7,lineWidth:2.2},
  'lollipop-category': {marginLeft:190,showLabels:true,pointSize:7,lineWidth:2},
  line: {pointSize:5,lineWidth:2.6,showGrid:false,marginRight:145,directSeriesLabels:true},
  'line-error': {pointSize:4.7,lineWidth:2,errorCap:6,showGrid:false,marginRight:145,directSeriesLabels:true},
  box: {opacity:.22,pointSize:3.4,lineWidth:1.8,showLegend:false,boxWidth:74},
  'box-grouped': {opacity:.25,pointSize:2.8,lineWidth:1.6,boxWidth:45},
  violin: {opacity:.28,pointSize:2.8,lineWidth:1.6,showLegend:false,boxWidth:18},
  ridgeline: {opacity:.28,lineWidth:1.5,showLegend:false,height:850,barPadding:.16,marginBottom:92},
  pie: {width:960,height:720,showLegend:false,marginLeft:65,marginRight:65,marginBottom:55,slicePadding:.016,strokeWidth:1.5,innerRadius:.52},
  rose: {width:900,height:800,showLegend:false,marginLeft:55,marginRight:55,marginBottom:55,palette:['#287c9a'],opacity:.85,strokeWidth:1,innerRadius:0,showGrid:true,startAngle:-22.5},
  radar: {width:900,height:850,marginLeft:150,marginRight:150,marginBottom:65,areaOpacity:.055,lineWidth:2.2,pointSize:4.5,radarTickCount:4,showLabels:false},
  dumbbell: {marginLeft:140,pointSize:7,lineWidth:2.2,startLabel:'灌溉前',endLabel:'灌溉后',showLabels:true,connectorColor:'#b5bfc4'},
  scatter: {pointSize:5.2,opacity:.72,showGrid:false,strokeColor:'#ffffff',strokeWidth:1},
  'scatter-grouped': {pointSize:5.7,opacity:.8,showGrid:false,pointShape:'group',strokeColor:'#ffffff',strokeWidth:1},
  upset: {height:740,barPadding:.28,pointSize:5.5,lineWidth:2,showLabels:true,marginLeft:150},
};
const matrixProfiles: Record<string, Partial<ChartStyle>> = {
  'circle-heatmap': {height:850,width:1000,marginLeft:110,marginRight:110,marginBottom:145,diverging:false,lowColor:'#f0f5ef',highColor:'#225c70',innerRadius:80,sweepAngle:310,cellGap:1},
  'binary-dot': {height:700,marginLeft:130,marginBottom:120,presentColor:'#287c9a',absentColor:'#ffffff',cellStroke:1.3,cellGap:3,showGrid:false},
  'binary-rect': {height:700,marginLeft:130,marginBottom:120,presentColor:'#287c9a',absentColor:'#f3f5f6',cellStroke:.8,cellGap:4,showGrid:false},
  'bubble-matrix': {height:750,marginLeft:135,marginBottom:180,diverging:false,lowColor:'#d6e7e6',highColor:'#225c70',cellStroke:1.3,showValues:false,bubbleScale:.8},
  correlation: {height:760,width:900,marginLeft:140,marginBottom:145,triangle:'lower',lowColor:'#31799e',midColor:'#f8f7f4',highColor:'#b75443',colorCenter:0,cellGap:3,cellStroke:0,labelAngle:0,showValues:true,digits:2},
  'double-correlation': {height:720,marginLeft:160,marginBottom:145,lowColor:'#31799e',midColor:'#f8f7f4',highColor:'#b75443',colorCenter:0,cellGap:3,cellStroke:0,labelAngle:0,showValues:true,digits:2},
  mantel: {height:760,width:1100,marginLeft:145,marginBottom:155,lowColor:'#31799e',midColor:'#f8f7f4',highColor:'#b75443',colorCenter:0,cellGap:3,linkWidthScale:6,significantColor:'#467d6f',nonsignificantColor:'#b8bec3',labelAngle:0},
  'enrichment-dot': {height:780,width:1060,marginLeft:255,marginTop:142,marginBottom:160,lowQColor:'#633a85',highQColor:'#d5dcf0',enrichPointSize:18,enrichPointStroke:1.4,showGrid:true,showValues:false,labelLength:55},
  'enrichment-bar': {height:740,width:1060,marginLeft:255,marginTop:142,marginBottom:100,lowQColor:'#633a85',highQColor:'#d5dcf0',barHeightRatio:.55,enrichBarRadius:0,showValues:true,labelLength:55},
  'enrichment-circle': {height:910,width:1060,marginLeft:130,marginRight:130,marginBottom:180,lowQColor:'#633a85',highQColor:'#d5dcf0',upColor:'#cb6943',downColor:'#287c9a',enrichSectorGap:2.5,circleLabel:'name'},
};
const relationProfiles: Record<string, Partial<ChartStyle>> = {
  venn: {width:1100,height:760,marginLeft:70,marginRight:45,setOpacity:.16,setStroke:2.2},
  packing: {width:1000,height:820,marginLeft:65,marginRight:65,marginBottom:90,packingGap:8,circleStroke:1.8},
  sankey: {width:1100,height:700,marginLeft:65,marginRight:120,nodeGap:35,nodeWidth:18,nodeRadius:0,flowOpacity:.3,fontSize:17},
  network: {width:1050,height:820,marginLeft:60,marginRight:60,marginBottom:110,linkDistance:82,repulsion:240,nodeScale:6,edgeWidth:1.2,edgeColor:'#95a2ad',nodeStrokeWidth:2,nodeShapeMode:'group'},
  map: {width:1100,height:760,marginLeft:45,marginRight:45,marginBottom:130,landColor:'#e5e8e5',oceanColor:'#fafbfc',coastColor:'#a6b0b3',mapPointSize:15,mapPointOpacity:.88,gridColor:'#d4dce1'},
  'gene-cluster': {width:1140,height:830,marginLeft:165,marginRight:65,marginBottom:110,geneHeight:25,geneStroke:1,backboneColor:'#a5adb4',backboneWidth:1.3,geneScale:'global'},
  'protein-domains': {width:1100,height:780,marginLeft:165,marginRight:80,marginBottom:110,segmentHeight:26,segmentStroke:.8,proteinLineWidth:2,proteinLineColor:'#bbc4ca'},
  'protein-motifs': {width:1100,height:780,marginLeft:165,marginRight:80,marginBottom:110,segmentHeight:24,segmentStroke:.6,segmentStrokeColor:'#52656f',proteinLineWidth:1.7,proteinLineColor:'#bbc4ca'},
  'genome-circos': {width:1100,height:1050,marginLeft:90,marginRight:90,marginBottom:155,chromosomeWidth:18,trackWidth:27,genomeLinkWidth:1.4,genomeLinkOpacity:.32,gcColor:'#487e88',skewPositive:'#98659a',skewNegative:'#8e995d'},
  synteny: {width:1100,height:850,marginLeft:100,marginRight:65,marginBottom:115,syntenyChromosomeWidth:22,syntenyLinkOpacity:.2,chromosomeColor:'#dce2e6',syntenyLineWidth:1.5},
};
const finalProfiles: Record<string, Partial<ChartStyle>> = {
  pcoa: {...firstBatch.pca}, nmds: {...firstBatch.pca},
  cca: {...firstBatch.pca,width:1050,marginRight:85}, rda: {...firstBatch.pca,width:1050,marginRight:85},
  'tree-normal': {width:1240,height:1000,treeWidth:530,labelWidth:140,fontSize:17,lineWidth:1.7,nodeSize:2.5,marginTop:150,marginBottom:90,leafSpacing:28},
  'tree-unrooted': {width:1100,height:1000,treeWidth:560,labelWidth:120,fontSize:17,lineWidth:1.7,nodeSize:2.5,marginTop:140,marginBottom:80},
};
export function applyPublicationDefaults(templates: Template[]) {
  for (const t of templates) {
    const profile = firstBatch[t.id] || basicProfiles[t.id] || matrixProfiles[t.id] || relationProfiles[t.id] || finalProfiles[t.id]; if (!profile) continue;
    Object.assign(t.defaultStyle, common, profile);
    if (t.id === 'volcano') {
      t.example = structuredClone(inference.volcano);
      t.defaultStyle.subtitle = '模拟 log₂ 表达量 · 每组 n = 8 · 双侧 Welch t 检验，P 未校正';
    }
    if (t.id.startsWith('enrichment-')) {
      t.example = structuredClone(inference.enrichment);
      t.defaultStyle.subtitle = '模拟集合 · 超几何检验 + BH 校正 · 背景 N = 6000，输入 n = 180';
    }
    if(t.id==='packing') t.example.tables[0].rows=['根际','叶际','水体','表土'].flatMap((g,i)=>[48,26,14,8,4,2].map((v,j)=>[`${String.fromCharCode(65+i)}${j+1}`,v+i*(j%2),g]));
    if(t.id==='network') {
      const labels=['碳代谢','信号传递','膜运输','胁迫响应'];
      t.example.tables[0].rows=Array.from({length:24},(_,i)=>[`n${i+1}`,`基因${String(i+1).padStart(2,'0')}`,labels[Math.floor(i/6)],3+(i*7%9)]);
      t.example.tables[1].rows=labels.flatMap((_,g)=>Array.from({length:6},(_,i)=>[`n${g*6+i+1}`,`n${g*6+(i+1)%6+1}`,1+i%3]));
      labels.forEach((_,g)=>t.example.tables[1].rows.push([`n${g*6+1}`,`n${g*6+4}`,2],[`n${g*6+2}`,`n${g*6+5}`,3],[`n${g*6+6}`,`n${(g+1)%4*6+1}`,1]));
      t.defaultStyle.subtitle='模拟功能关联 · 节点面积表示权重，边宽表示关联强度；颜色与点形表示模块';
    }
    if(t.id==='gene-cluster') t.example.tables[0].rows=Array.from({length:8},(_,i)=>['调节','合成','代谢','运输','调节'].flatMap((cat,j)=>i===5&&j===2?[]:[[ `菌株 ${String.fromCharCode(65+i)}`,`${['reg','syn','met','tra','reg'][j]}${i+1}${j+1}`, 250+j*1100+(i%3)*90,850+j*1100+(i%3)*90+(i%2)*110, i===3||i===6?'-':'+',cat]])).flat();
    if(['protein-domains','protein-motifs'].includes(t.id)) {
      t.example.tables[0].rows=Array.from({length:8},(_,i)=>[`同源蛋白 ${i+1}`,670+i*45]);
      t.example.tables[1].rows=Array.from({length:8},(_,i)=>Array.from({length:t.id==='protein-motifs'?6:3},(_,j)=>{
        const motif=t.id==='protein-motifs',start=35+j*(motif?92:190)+i*8,category=motif?`基序 ${j%4+1}`:['结合域','催化域','调节域'][j];
        return [`同源蛋白 ${i+1}`,category,start,start+(motif?[18,24,15,21][j%4]:[108,166,89][j]),category,''];
      })).flat();
      t.defaultStyle.subtitle='模拟片段位置 · 单位 aa · 未执行序列检索，P/E 值未提供';
      for(const table of t.alternate.tables) if(table.role==='segments') table.rows.forEach(r=>r[table.columns.indexOf('significance')]='');
    }
    if(t.id==='synteny') {
      for(const example of [t.example,t.alternate]) for(const table of example.tables) if(table.role==='synteny-links') table.rows.forEach(r=>r[table.columns.indexOf('evalue')]='');
      t.defaultStyle.subtitle='模拟基因配对与倒位 · 单位 bp · 未执行序列比对，E 值未提供';
    }
    if(t.id==='genome-circos') {
      const chrs=Array.from({length:5},(_,i)=>[`Chr ${i+1}`,12000-i*1000] as [string,number]);t.example.tables[0].rows=chrs;
      t.example.tables[1].rows=chrs.flatMap(([chr,len],ci)=>Array.from({length:len/1000},(_,j)=>[[chr,j*1000+1,(j+1)*1000,38+(j*13+ci*7)%26,'gc-content'],[chr,j*1000+1,(j+1)*1000,+(.45*Math.sin(j*1.6+ci)).toFixed(3),'gc-skew']]).flat());
      t.example.tables[2].rows=chrs.flatMap(([chr],i)=>Array.from({length:3},(_,j)=>[chr,400+j*2400,1000+j*2400,`模拟基因${i+1}-${j+1}`,j%2?'-':'+']));
      t.example.tables[3].rows=chrs.flatMap(([chr],i)=>Array.from({length:3},(_,j)=>[chr,500+j*2000,1100+j*2000,chrs[(i+1+j%2)%5][0],800+j*1800,1450+j*1800,1+j%2]));
    }
    if (['line','line-error'].includes(t.id) && !t.controls.some(c=>c.key==='directSeriesLabels')) t.controls.push({key:'directSeriesLabels',label:'曲线末端标注分组',type:'boolean',section:'图形细节'});
    if (t.id === 'scatter-grouped') {
      const control = t.controls.find(c=>c.key==='pointShape');
      if(control?.options && !control.options.some(o=>o.value==='group')) control.options.unshift({value:'group',label:'按分组区分点形'});
    }
    if (t.id === 'ridgeline') {
      const t0 = t.example.tables[0];
      t0.rows = Array.from({length:6},(_,k)=>Array.from({length:40},(_,i)=>[
        ['清晨','上午','正午','午后','傍晚','夜间'][k],
        +([18,24,30,26,21,16][k] + Math.sin(i*2.399+k)*[3,4,6,5,4,2][k] + Math.cos(i*1.71)*2 + (k===2&&i%5===0?7:0)).toFixed(3), `观测${i+1}`,
      ])).flat();
      t0.name='模拟叶片温度日变化（℃）';
      Object.assign(t.defaultStyle,{title:'叶片温度的日变化分布',subtitle:'模拟独立叶片观测 · 各时段真实 KDE',xTitle:'叶片温度 (℃)',yTitle:'采样时段'});
    }
    if (t.id === 'heatmap') {
      const rows = t.example.tables[0].rows;
      t.exampleLayers = [{id:'publication-treatment', type:'matrix-row-color', name:'处理分组', visible:true,
        data:{tables:[{id:'treatment',name:'模拟处理分组',role:'annotation',columns:['标签','值'],rows:rows.map(r => [r[0],String(r[0]).split('-')[0]])}]}, settings:{size:10}}];
    }
    if (t.id.startsWith('tree-')) {
      const clades = ['A', 'B', 'C', 'D'].map((g, i) => `(${Array.from({length:3}, (_,j) => `(谱系${g}${j*2+1}:${(.12+j*.035+i*.012).toFixed(3)},谱系${g}${j*2+2}:${(.16+j*.028+i*.007).toFixed(3)}):${(.11+j*.035).toFixed(3)}`).join(',')}):${(.19+i*.055).toFixed(3)}`);
      t.example = {tables: [], text: `(${clades.join(',')});`, format: 'newick'};
      const root = parseTree(t.example.text!);
      t.exampleLayers = ['label-background', 'bar', 'heatmap'].map((kind, i) => ({
        id: `publication-${kind}`, type: `tree:${kind}`, name: ['生境（模拟）','叶氮 (mg/g)','相对表达量'][i], visible: true,
        data: structuredClone(layerExample(kind, root)), settings: {...defaultLayerSettings, width: kind === 'bar' ? 40 : kind === 'heatmap' ? 48 : 20, gap: 7, fontSize: 14, color: '#467d91', showValues: false, title: kind === 'bar' ? '叶氮' : kind === 'heatmap' ? '相对表达' : '生境'},
      }));
      const grouping = t.exampleLayers[0].data!.tables[0];
      grouping.columns.push('分类'); grouping.rows.forEach((r,i) => {r.push(['旱地','湿地','林下','草地'][Math.floor(i/6)]); const c = grouping.columns.indexOf('颜色'); if(c>=0)r[c]=publicationPalette[Math.floor(i/6)];});
      t.exampleLayers[1].data!.tables[0].rows.forEach((r,i) => {r[1]=+(13 + (i*7%13)*.9 + Math.sin(i)*1.4).toFixed(1);});
      t.exampleLayers[2].data!.tables[0].rows.forEach((r,i) => {r[1]=['对照','升温','干旱','补水'][i%4]; r[2]=+(.4 + (i*13%31)/10).toFixed(1);});
      Object.assign(t.defaultStyle, {title:'模拟谱系的亲缘关系与功能性状', subtitle:'模拟拓扑与性状 · 叶氮 mg/g · 热图：对照 / 升温 / 干旱 / 补水；颜色越深表达越高'});
      if(t.id==='tree-unrooted') {t.exampleLayers=t.exampleLayers.slice(0,1);t.defaultStyle.subtitle='模拟无根拓扑与生境 · 分支长度按输入绘制 · 不代表真实系统发育结论';}
    }
  }
}
