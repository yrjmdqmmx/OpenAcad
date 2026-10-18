import type {Control, Dataset, Template} from '../../core/types';
import {bool, col, createTemplate, num} from '../special/shared';
import {MagneticRenderer} from './Renderer';
import {MAGNETIC_PARAMS, prepareMagneticAnalysis, validateMagneticData} from './model';
import exampleData from './example-data.json';
import exampleAnalysis from './example-analysis.json';
export * from './model';
export {MagneticRenderer, jetColor} from './Renderer';

const txt = (key:string,label:string,section:string,help?:string): Control => ({key,label,type:'text',section,help});
const on = (key:string) => (p:import('../../core/types').Project) => p.style[key] !== false;
const controls: Control[] = [
  bool('showLabels','显示测线、方向与断裂标签','剖面布局'),
  txt('magnetic_line_label','剖面标识','剖面布局'),
  bool('magnetic_reverse','反转距离轴（仅显示）','剖面布局'),
  num('magnetic_panel_ratio','下图 / 上图高度比',.5,5,.1,'剖面布局'),
  num('magnetic_panel_gap','上下图间隔',12,100,1,'剖面布局'),
  num('magnetic_zmax','最大显示深度 / km',5,100,.5,'坐标轴'),
  num('yMin','磁异常轴最小值 / nT',-10000,10000,10,'坐标轴'),
  num('yMax','磁异常轴最大值 / nT',-10000,10000,10,'坐标轴'),
  num('magnetic_x_ticks','距离轴刻度数',2,20,1,'坐标轴'),
  num('magnetic_y_ticks','磁异常轴刻度数',2,12,1,'坐标轴'),
  num('magnetic_depth_ticks','深度轴刻度数',2,15,1,'坐标轴'),
  txt('magnetic_depth_label','深度轴标题','坐标轴'),
  txt('magnetic_start_label','测线起点方向','坐标轴'),
  txt('magnetic_end_label','测线终点方向','坐标轴'),
  col('magnetic_curve_color','磁异常曲线颜色','曲线与站位'),
  bool('magnetic_show_stations','显示等距示意站位','曲线与站位'),
  {...num('magnetic_n_sta','示意站位数量',0,100,1,'曲线与站位'), visible:on('magnetic_show_stations'), help:'等距排布的示意标记，不由测线经纬度推断实际站位。'},
  {...num('magnetic_station_size','站位三角大小',2,18,.5,'曲线与站位'), visible:on('magnetic_show_stations')},
  bool('magnetic_show_bathy','显示海底线','构造线'),
  {...col('magnetic_bathy_color','海底线颜色','构造线'),visible:on('magnetic_show_bathy')},
  {...num('magnetic_bathy_width','海底线宽',.3,8,.1,'构造线'),visible:on('magnetic_show_bathy')},
  {...txt('magnetic_bathy_label','海底图例名称','构造线'),visible:on('magnetic_show_bathy')},
  bool('magnetic_show_basement','显示磁性基底','构造线'),
  {...col('magnetic_basement_color','基底线颜色','构造线'),visible:on('magnetic_show_basement')},
  {...num('magnetic_basement_width','基底线宽',.3,8,.1,'构造线'),visible:on('magnetic_show_basement')},
  {...txt('magnetic_basement_label','基底图例名称','构造线'),visible:on('magnetic_show_basement')},
  bool('magnetic_show_moho','显示参数化莫霍面','构造线'),
  {...col('magnetic_moho_color','莫霍面颜色','构造线'),visible:on('magnetic_show_moho')},
  {...num('magnetic_moho_width_px','莫霍线宽',.3,8,.1,'构造线'),visible:on('magnetic_show_moho')},
  {...txt('magnetic_moho_label','莫霍图例名称','构造线'),visible:on('magnetic_show_moho')},
  {...num('magnetic_moho_nw','莫霍起端深度 / km',1,100,.5,'莫霍参数'),visible:on('magnetic_show_moho')},
  {...num('magnetic_moho_se','莫霍末端深度 / km',1,100,.5,'莫霍参数'),visible:on('magnetic_show_moho')},
  {...num('magnetic_moho_mid','莫霍过渡中心 / km',0,2000,1,'莫霍参数'),visible:on('magnetic_show_moho')},
  {...num('magnetic_moho_width','莫霍过渡宽度 / km',.1,1000,1,'莫霍参数'),visible:on('magnetic_show_moho')},
  bool('magnetic_show_faults','显示断裂标注','断裂标注'),
  {...txt('magnetic_faults','断裂名称与距离','断裂标注','格式：F1:50; F2:110。分号分隔，位置单位 km。'),visible:on('magnetic_show_faults')},
  {...col('magnetic_fault_color','断裂线颜色','断裂标注'),visible:on('magnetic_show_faults')},
  {...num('magnetic_fault_width','断裂线宽',.3,5,.1,'断裂标注'),visible:on('magnetic_show_faults')},
  num('magnetic_vmin','色阶下限',-1,.99,.05,'成像色阶'),
  num('magnetic_vmax','色阶上限',-.99,1,.05,'成像色阶'),
  bool('magnetic_show_colorbar','显示色标','成像色阶'),
  {...txt('magnetic_colorbar_label','色标标题','成像色阶'),visible:on('magnetic_show_colorbar')},
];

export const magneticDefaults = {
  publicationVersion:1,
  width:1200,height:960,marginTop:96,marginRight:90,marginBottom:92,marginLeft:94,
  title:'磁异常曲线与磁异常相关成像剖面图',
  subtitle:'参考图形状重建模拟 · 棱柱正演与窗口相关实算 · 非原始观测或地质反演结论',
  fontSize:17,titleSize:25,fontFamily:'Noto Sans SC, sans-serif',textColor:'#111111',lineWidth:1.8,
  xTitle:'距离/km',yTitle:'ΔT/nT',yMin:-300,yMax:200,
  showGrid:true,showLegend:true,showLabels:true,
  magnetic_line_label:'OBS93',magnetic_reverse:false,magnetic_panel_ratio:2.2,magnetic_panel_gap:38,
  magnetic_zmax:26,magnetic_x_ticks:8,magnetic_y_ticks:5,magnetic_depth_ticks:6,
  magnetic_depth_label:'深度/km',magnetic_start_label:'NW',magnetic_end_label:'SE',
  magnetic_curve_color:'#111111',magnetic_show_stations:true,magnetic_n_sta:15,magnetic_station_size:7,
  magnetic_show_bathy:true,magnetic_bathy_color:'#1565c0',magnetic_bathy_width:2.1,magnetic_bathy_label:'海底',
  magnetic_show_basement:true,magnetic_basement_color:'#111111',magnetic_basement_width:2.3,magnetic_basement_label:'磁性基底',
  magnetic_show_moho:true,magnetic_moho_color:'#111111',magnetic_moho_width_px:1.8,magnetic_moho_label:'莫霍面（参数化）',
  magnetic_moho_nw:26,magnetic_moho_se:12,magnetic_moho_mid:220,magnetic_moho_width:40,
  magnetic_show_faults:true,magnetic_faults:'F1:50; F2:110; F3:210; F4:300',magnetic_fault_color:'#333333',magnetic_fault_width:1,
  magnetic_vmin:-.4,magnetic_vmax:.6,magnetic_show_colorbar:true,magnetic_colorbar_label:'相关系数',
};
const example = exampleData as Dataset;
const alternate = structuredClone(example);
alternate.tables[0].name = '磁异常替换示例（模拟，需重新运行成像）';
alternate.tables[0].rows = alternate.tables[0].rows.map(row=>[row[0],+(Number(row[1])*.8+14*Math.sin(Number(row[0])/30)).toFixed(4)]);

export const magneticTemplates: Template[] = [createTemplate(
  'magnetic-correlation','磁异常曲线与磁异常相关成像剖面图','地球物理',
  '上传磁异常曲线 CSV、海底和基底 CSV、测线位置 JSON，执行棱柱磁场正演与滑窗相关成像，叠加可编辑海底、基底、断裂和参数化莫霍面。',
  example,alternate,MagneticRenderer,{
    familyId:'magnetic-correlation',variant:'磁异常相关成像',controls,defaultStyle:magneticDefaults,
    tags:['磁异常','相关成像','地球物理','剖面图','海底','磁性基底','Python','SVG'],
    formats:['csv','json'],
    inputHelp:'必须上传三份文件：磁异常曲线 CSV（dist_km, mag_nT）、海底和基底 CSV（s_km, bathy_m, basement_km）、测线位置 JSON（{"OBS93":{"poly":[[经度,纬度],...]}}）。bathy_m 水下为负，basement_km 深度向下为正；距离列须严格递增。',
    tutorial:[
      '下载三份模拟示例，查看列名、单位和 JSON 测线结构；示例根据参考图形状重建，不是原始观测。',
      '分别上传磁异常曲线 CSV、海底和基底 CSV、测线位置 JSON；多测线 JSON 需指定测线名。',
      '检查扫描范围、棱柱厚度、相关窗口、地磁倾角/偏角和测线轴长，运行相关成像。',
      '编辑曲线、字体、色阶、断裂、站位示意及莫霍面参数；保存项目可保留数据与计算结果。',
      '导出 PNG、PDF 或 SVG。SVG 热图由独立矩形组成，曲线与文字保持可编辑。',
    ],
    limitations:[
      '相关系数表示观测与正演形态的相关程度，不是磁性体存在概率、磁化率或确定的反演结果。',
      '示例曲线、海底和基底由参考图可见形状手工重建；经纬度为模拟几何，无法恢复真实原始数据。',
      '海底和磁性基底用于叠加显示；参数化莫霍面和断裂为解释辅助线，不参与相关成像计算。',
      '海底和基底按上传的原始距离与深度显示；超出显示轴范围的部分会被裁出画布，不会修改输入数值。',
      '站位三角按所设数量等距排布，仅为示意，不能代替实际站位坐标。',
      '修改输入数据或计算参数后需要重新运行；图形样式调整无需重算。',
    ],
    exampleSource:{kind:'simulated',label:'根据用户参考图可见形状手工重建的模拟输入；测线为模拟坐标；真实算法计算热图，不代表原始观测',license:'CC0-1.0'},
    validate:validateMagneticData,
    exampleAnalysis,
    analysisMethods:[{method:'magnetic-correlation',label:'磁异常相关成像',description:'按用户 Python 程序执行 Harmonica 棱柱磁场正演、窗口 Pearson 相关及高斯平滑。',params:MAGNETIC_PARAMS}],
    prepareAnalysis:prepareMagneticAnalysis,
  },
)];
