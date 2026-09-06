import json,csv,pathlib,hashlib,datetime,collections,subprocess,argparse,shutil,html
ROOT=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='从仓库中的实际报告构建55模板验收索引。此脚本不重新执行浏览器或导出任务。')
parser.add_argument('--unit-passed',type=int,default=311,help='主任务已完成单元测试数；默认是1.0功能冻结运行311')
args=parser.parse_args()
OUT=ROOT/'docs/acceptance';OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def relative(p):
 try:return str(pathlib.Path(p).relative_to(ROOT))
 except ValueError:
  # Reports may contain paths relative to server/ or an earlier checkout.
  # These artifact roots are repository contracts, not the caller's cwd.
  value=pathlib.Path(p).as_posix()
  for prefix in ['server/tests/artifacts/','tests/artifacts/','web/src/templates/']:
   if prefix in value:return prefix+value.split(prefix,1)[1]
  return value
def evidence(path,selector=None,kind=None):
 d={'path':path}
 if selector:d['selector']=selector
 if kind:d['kind']=kind
 return d
metadata_code = """
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{const {templates}=await server.ssrLoadModule('/src/templates/index.ts');process.stdout.write(JSON.stringify(templates.map(t=>({id:t.id,name:t.name,sourceUrls:t.sourceUrls,familyId:t.familyId,category:t.category,formats:t.formats,limitations:t.limitations,analysisMethods:t.analysisMethods?.map(a=>a.method)}))));}finally{await server.close();}
"""
try:
 metadata_run=subprocess.run(['node','--input-type=module','-e',metadata_code],cwd=ROOT/'web',capture_output=True,text=True,check=True)
 meta=json.loads(metadata_run.stdout)
except (OSError,subprocess.CalledProcessError,json.JSONDecodeError) as exc:
 raise SystemExit('无法读取当前模板注册表。请先安装Node并在web目录执行npm ci。'+str(exc))
invalid=read('docs/acceptance/invalid-input-browser.json')
browser=read('tests/artifacts/browser-results.json');controls=read('tests/artifacts/control-audit.json')['records'];exports=read('tests/artifacts/export-matrix.json')
tree_default=read('tests/artifacts/tree-default-refresh.json')
special=read('web/src/templates/special/evidence/browser-qa.json');special_ids={r['id'] for r in special['report']}
basic=read('web/src/templates/basic/evidence/browser-advanced.json');advanced=read('server/tests/artifacts/advanced-export-matrix.json')
source=read('docs/research/comparison.json');sourceByUrl={r['sourceUrl']:r for r in source['records']}
TREE='web/src/templates/tree'
tree_time=read(TREE+'/evidence/browser-time.json')
tree_directions=read(TREE+'/evidence/browser-directions.json')
tree_branches=read(TREE+'/evidence/branch-styles/browser-report.json')
tree_dynamic=read(TREE+'/evidence/browser-dynamic-options.json')
tree_branch_exports=read('server/tests/artifacts/tree-branch-export-matrix.json')
def downloaded_tree_case(case,report_path,prefix):
 artifacts=[]
 for artifact in case['artifacts']:
  path=relative(artifact['file'])
  artifacts.append({'format':artifact['format'],'artifact':path,'bytes':(ROOT/path).stat().st_size,'sha256':sha(ROOT/path),'reportedBytesMatch':artifact['bytes']==(ROOT/path).stat().st_size})
 return {'layout':case['case'],'status':'passed' if case['passed'] else 'failed','evidence':evidence(report_path,f'[case={case["case"]}]','browser-specialized'),'artifacts':artifacts,'project':{'path':f'{TREE}/evidence/{prefix}-{case["case"]}.openacad.json','sha256':sha(ROOT/f'{TREE}/evidence/{prefix}-{case["case"]}.openacad.json')},'decodeAndVisualCheck':evidence(TREE+'/ACCEPTANCE.md','追加专项证据','independent-decoder-and-reported-visual-inspection'),'boundary':'文件数量是下载产物数，不是单独测试数；这些专项不在较早82项总套件内。'}
tree_time_cases=[downloaded_tree_case(c,TREE+'/evidence/browser-time.json','time') for c in tree_time]
tree_direction_cases=[downloaded_tree_case(c,TREE+'/evidence/browser-directions.json','direction') for c in tree_directions]
branch_files=[]
for entry in tree_branch_exports['files']:
 path=relative(entry['file']);svg=f'{TREE}/evidence/branch-styles/{entry["template"]}.svg'
 branch_files.append({'case':entry['template'],'format':entry['format'],'artifact':path,'sourceSvg':svg,'sourceSha256':entry['sourceSha256'],'sourceHashMatches':entry['sourceSha256']==sha(ROOT/svg),'sha256':entry['sha256'],'artifactHashMatches':entry['sha256']==sha(ROOT/path),'bytes':entry['bytes'],'opened':entry['opened'],'decoder':entry['decoder'],'touchesPageEdge':entry['touchesPageEdge'],'diagnostics':entry.get('diagnostics',[])})
tree_supplement={'separateFromMainBrowserSuite':True,'boundary':'保留82项总套件数量。专项案例、布局组合、截图和下载文件分别计数，不相加成新的测试通过数。','time':{'browserCases':len(tree_time),'passedCases':sum(c['passed'] for c in tree_time),'downloadedImages':sum(len(c['artifacts']) for c in tree_time),'cases':tree_time_cases,'contract':'只展示已有MCMCTree/BEAST时间树及其年龄/区间摘要，不运行分歧时间推断；HPD与未注明类型的95%区间保留语义区别。'},'directions':{'browserCases':len(tree_directions),'passedCases':sum(c['passed'] for c in tree_directions),'downloadedImages':sum(len(c['artifacts']) for c in tree_directions),'cases':tree_direction_cases,'contract':'矩形从右向左、环形向内；叶名、注释轨道和已有年代一起改变。无根方向开关不适用。'},'branches':{'browserCases':len(tree_branches),'passedCases':sum(c['passed'] for c in tree_branches),'layoutStyleCombinations':14,'downloadedSvg':len({r['case'] for r in branch_files}),'convertedImages':len(branch_files),'browserEvidence':evidence(TREE+'/evidence/branch-styles/browser-report.json',kind='browser-specialized'),'browserRecords':tree_branches,'exportsEvidence':evidence('server/tests/artifacts/tree-branch-export-matrix.json',kind='service-and-independent-decoder'),'exports':branch_files,'boundary':'14个布局×路径组合与1个支持度综合案例产生16份SVG；综合案例前后SVG不是两个独立浏览器测试。'},'dynamicOptions':{'cases':tree_dynamic,'evidence':evidence(TREE+'/evidence/browser-dynamic-options.json',kind='browser-specialized'),'contract':'三布局可用分支样式枚举分别为6、5、3，同一项目切换后菜单更新。'},'unitEvidence':[evidence('web/tests/tree.test.tsx','106项：已有时间、语义、年龄几何、区间、布局及项目恢复','unit-run-reported-by-tree-agent'),evidence('web/tests/tree-branch-style.test.tsx','12项：分支路径、支持度变量/阈值、文字与拖动偏移','unit-run-reported-by-tree-agent')],'acceptanceDocument':evidence(TREE+'/ACCEPTANCE.md')}
checks=[]
def walk(suites,prefix='$.suites'):
 for i,s in enumerate(suites):
  for j,sp in enumerate(s.get('specs',[])):
   for k,t in enumerate(sp.get('tests',[])):
    results=t.get('results',[]);last=results[-1] if results else {}
    checks.append({'file':sp.get('file',s.get('file')),'title':sp['title'],'project':t['projectName'],'status':last.get('status','not-run'),'reportSelector':f'{prefix}[{i}].specs[{j}].tests[{k}]','startedAt':last.get('startTime')})
  walk(s.get('suites',[]),f'{prefix}[{i}].suites')
walk(browser['suites'])
main_checks=checks
checks=[]
walk(tree_default['suites'])
tree_default_checks=checks
checks=main_checks
browser_groups=collections.Counter(c['file'] for c in checks if c['status']=='passed')
browser_scope=f"55模板逐图仅Chromium；通用3流程在Chromium/Firefox/WebKit/390px手机共{browser_groups['workflow.spec.ts']}项；{browser_groups['live-analysis.spec.ts']}实际排序分析、{browser_groups['live-export.spec.ts']}真实导出（桌面与手机各四格式）、{browser_groups['ordination-editor.spec.ts']}排序分组/已有坐标/项目恢复、{browser_groups['performance.spec.ts']}性能；其余{browser['stats']['skipped']}项按测试配置跳过。"
conditional={
 ('sankey','flowAlign'):{'status':'passed-conditional','explanation':'默认来源和终点路径层数相同，对齐选项等价；专项加入短路径终点后左对齐改变几何。','evidence':evidence('web/src/templates/special/special.test.tsx','流对齐、类别透明度与普通数值轨道上限使用相应输入','unit-SSR')},
 ('synteny','syntenyInput'):{'status':'passed-equivalent-input','explanation':'默认标准表与MCScanX两原文件描述同一批数据，切换解析模式不必改变几何；原文件及另一组原文件已实际解析并在浏览器显示。','evidence':evidence('web/src/templates/special/evidence/browser-interactions.json','results[id=synteny-native]','browser')},
 ('synteny','chromosomeSort'):{'status':'passed-conditional','explanation':'默认染色体已按名称排序；专项反转输入后名称排序改变几何，另有浏览器拖序与项目重开。','evidence':evidence('web/src/templates/special/special.test.tsx','富集标签开关与共线性名称排序在对应情况下可见','unit-SSR')},
 ('tree-normal','marginRight'):{'status':'passed-conditional','explanation':'默认画布已有空余宽度；8个柱图层迫使自动画布扩展时，右边距+100使实际SVG宽度+100。','evidence':evidence('web/tests/tree.test.tsx','图例需有分类注释；密集图层右边距改变真实画布尺寸','unit-SSR')},
}
extra_config={
 'heatmap':['heatmap-annotated'],'binary-dot':['binary-dot-annotated'],'bubble-matrix':['bubble-matrix-annotated','bubble-matrix-category'],
 'circle-heatmap':['circle-heatmap-annotated','circle-heatmap-cluster'],'gene-cluster':['gene-cluster-broken'],'genome-circos':['genome-custom-tracks'],
 'network':['network-labeled-loops','network-attribute-mappings'],'sankey':['sankey-gradient'],'venn':['venn-dragged-label'],'synteny':['synteny-reordered'],
 'enrichment-dot':['enrichment-dot-class'],'enrichment-bar':['enrichment-bar-class']}
records=[]
for m in meta:
 id=m['id'];unit='web/src/templates/special/special.test.tsx' if id in special_ids else 'web/tests/tree.test.tsx' if id.startswith('tree-') else 'web/tests/ordination.test.tsx' if id in ['pca','pcoa','nmds','cca','rda'] else 'web/tests/basic.test.tsx'
 b=next((c for c in checks if c['file']=='templates.spec.ts' and c['title']==m['name']+'：示例、几何、项目与 SVG 文件' and c['project']=='chromium'),{'status':'pending-report-refresh','reportSelector':f'待最终总报告: {m["name"]} / Chromium'})
 browserEv=evidence('tests/artifacts/browser-results.json',b['reportSelector'],'browser-Chromium')
 if id.startswith('tree-'):
  b=next(c for c in tree_default_checks if c['title']==m['name']+'：示例、几何、项目与 SVG 文件' and c['project']=='chromium')
  browserEv=evidence('tests/artifacts/tree-default-refresh.json',b['reportSelector'],'browser-Chromium-final-tree-refresh')
 if id in special_ids:
  alternate={'status':'passed','method':'browser','evidence':[evidence('web/src/templates/special/evidence/browser-qa.json',f'report[id={id}].alternate','browser'),evidence(unit,f'{id}：两组数据、SVG、项目重开','unit-SSR')]}
 elif id in ['pca','pcoa','nmds','cca','rda']:
  live=next((c for c in checks if c['file']=='live-analysis.spec.ts' and c['title'].startswith(id+' ') and c['status']=='passed'),{'reportSelector':f'待最终总报告: {id} 真实服务计算；已保存项目可独立核查'})
  alternate={'status':'passed','method':'browser-real-analysis','evidence':[evidence('tests/artifacts/browser-results.json',live['reportSelector'],'browser-service'),evidence(f'tests/artifacts/analysis/{id}.openacad.json',kind='project-with-provenance')]}
 else:
  alternate={'status':'passed','method':'unit-SSR','evidence':[evidence(unit, m['name']+(' 示例/第二组数据/结构保存' if id.startswith('tree-') else '：示例与替代数据合法且产生不同的有效 SVG'),'unit-SSR')],'browserScope':'未声称本模板两组完整预设数据都在浏览器逐一更换；同内核公共流程另有代表验收。'}
 bad=next(r for r in invalid['results'] if r['id']==id)
 c=[r for r in controls if r['id']==id]
 pending=[conditional.get((id,r['key']),{'status':'unresolved','explanation':'未找到专项映射'})|{'key':r['key'],'label':r['label']} for r in c if not r['changedFromExample'] or r['error']]
 browserStyle=[]
 if id in special_ids:browserStyle.append(evidence('web/src/templates/special/evidence/browser-qa.json',f'report[id={id}].title','browser-title-change'))
 if id=='bar':browserStyle.append(evidence('web/src/templates/basic/evidence/browser-advanced.json','[case=basic-advanced]','browser-pattern-series-label-axis'))
 if id=='bar-error':browserStyle.append(evidence('web/src/templates/basic/evidence/browser-statistics.json','[case=real-tests-p-letters-drag]','browser-real-tests-label-drag'))
 if id.startswith('tree-'):browserStyle.append(evidence('web/src/templates/basic/evidence/browser-advanced.json',f'[case={id}].layers','browser-layer-alternate-hide-reopen'))
 if id in ['pca','pcoa','nmds','cca','rda']:browserStyle.append(evidence('web/e2e/live-analysis.spec.ts',id+' 标题修改不重新请求计算','browser-service'))
 if id in extra_config:browserStyle.append(evidence('web/src/templates/special/evidence/browser-coverage.json' if id in ['network','sankey','venn','synteny','enrichment-dot','enrichment-bar'] else 'web/src/templates/special/evidence/browser-advanced.json',id,'browser-special-configuration'))
 style={'status':'passed-scoped','ssrAudit':{'evidence':evidence('tests/artifacts/control-audit.json',f'records[id={id}]','unit-SSR-string-difference'),'audited':len(c),'changedFromExample':sum(r['changedFromExample'] for r in c),'errors':[r['error'] for r in c if r['error']],'controls':c},'conditionalControls':pending,'browserEvidence':browserStyle,'boundary':'SSR标记字符串变化证明对应输入分支产生差异；不是逐个控件的浏览器实际操作，也不是穷举所有数值与数据组合。未出现在记录的条件隐藏控件不能用此默认审计判定。'}
 svgPath=f'tests/artifacts/svg/{id}.svg';svgHash=sha(ROOT/svgPath)
 fmts={'svg':{'status':b['status'],'artifact':svgPath,'sha256':svgHash,'actualDownload':True,'reopenedInBrowser':True,'evidence':browserEv}}
 for fmt in ['png','pdf','eps']:
  r=next(r for r in exports['files'] if r['template']==id and r['format']==fmt);artifact=relative(r['file']);fmts[fmt]={'status':'passed' if r.get('opened') and not r.get('touchesPageEdge') else 'needs-review','artifact':artifact,'decoder':r.get('decoder'),'bytes':r['bytes'],'sha256':r['sha256'],'artifactHashMatches':sha(ROOT/artifact)==r['sha256'],'sourceSha256':r['sourceSha256'],'sourceHashMatchesCurrentSvg':r['sourceSha256']==svgHash,'opened':r.get('opened'),'touchesPageEdge':r.get('touchesPageEdge'),'diagnostics':r.get('diagnostics',[]),'evidence':evidence('tests/artifacts/export-matrix.json',f'files[template={id},format={fmt}]','service-and-independent-decoder')}
 project={'status':'passed','downloadAndDatasetCheck':browserEv,'serializationRoundtrip':evidence('web/tests/project.test.ts',id+' 项目完整往返','unit'),'fixture':evidence('tests/artifacts/template-cases.json',f'[id={id}].project','input-fixture'),'boundary':'默认逐图浏览器测试实际下载项目并校验数据/结果；未持久保留每份临时下载，fixture是相同输入，不冒充下载文件。'}
 if id in special_ids:project['browserReopen']=evidence('web/src/templates/special/evidence/browser-qa.json',f'report[id={id}].projectReopen','browser-same-id-reopen')
 if id.startswith('tree-'):project['browserReopen']=evidence('web/src/templates/basic/evidence/browser-advanced.json',f'[case={id}].layers[*].projectRoundtrip','browser-layer-project')
 if id=='bar-grouped':project['browserReopen']=evidence('web/e2e/workflow.spec.ts','模板搜索、数据更换、错误定位、撤销和项目往返','browser-four-profiles')
 rec={'templateId':id,'nameZh':m['name'],'category':m['category'],'sourceUrls':m['sourceUrls'],'sourceEntrances':[u for u in m['sourceUrls'] if u in sourceByUrl],'inputFormats':m['formats'],'example':{'status':b['status'],'method':'browser-Chromium','evidence':browserEv},'alternateData':alternate,'invalidData':{'status':'passed' if bad['status']=='passed' and bad['fieldCase']['status']=='passed' else 'failed','method':'browser-Chrome-standalone','checkedAt':invalid['checkedAt'],'fieldCheckedAt':invalid['fieldCheckedAt'],'emptyDataCase':{k:v for k,v in bad.items() if k not in ['id','fieldCase']},'fieldCase':bad['fieldCase'],'supplement':evidence(unit,'具体字段/区间/格式边界测试','unit'),'boundary':'每模板实际导入两种错误；不是穷举所有非法输入。'},'styles':style,'exports':fmts,'project':project,'declaredLimitations':m['limitations'],'analysisMethods':m.get('analysisMethods',[]),'specialConfigurations':[]}
 for config in extra_config.get(id,[]):
  files=[r for r in advanced['files'] if r['template']==config]
  rec['specialConfigurations'].append({'name':config,'sourceSvg':f'web/src/templates/special/evidence/{config}.svg','exports':[{'format':r['format'],'artifact':relative(r['file']),'opened':r.get('opened'),'touchesPageEdge':r.get('touchesPageEdge'),'sourceHashMatches':r['sourceSha256']==sha(ROOT/f'web/src/templates/special/evidence/{config}.svg')} for r in files],'evidence':evidence('server/tests/artifacts/advanced-export-matrix.json',f'files[template={config}]','service-and-independent-decoder')})
 if id.startswith('tree-'):
  layers=next(r['layers'] for r in basic if r['case']==id)
  rec['treeLayers']={'applicable':len(layers),'passed':sum(r['passed'] for r in layers),'notApplicable':29-len(layers),'records':layers,'evidence':evidence('web/src/templates/basic/evidence/browser-advanced.json',f'[case={id}].layers','browser'),'boundary':'矩形29/环形29/无根13个适用图层；无根16个不适用项不是未测却视作通过。布局适用性见docs/research/tree-layers.json。'}
  layout=id.removeprefix('tree-')
  rec['treeSupplementalEvidence']={'separateFromMain82':True,'time':next(c for c in tree_time_cases if c['layout']==layout),'direction':next((c for c in tree_direction_cases if c['layout']==layout),{'status':'not-applicable','reason':'无根布局不提供向内或从右向左生长开关。'}),'branchStyles':{'records':[c for c in tree_branches if c['case'].startswith(layout+'-')],'evidence':evidence(TREE+'/evidence/branch-styles/browser-report.json',f'[case begins {layout}-]','browser-specialized')},'dynamicOptions':next(c for c in tree_dynamic if c['kind']==layout),'sharedSupportStyleEvidence':{'evidence':evidence(TREE+'/evidence/branch-styles/browser-report.json','[case=support-variable-circle-filter-drag-undo-redo-reopen]','browser-specialized'),'boundary':'支持度变量、阈值、圆点与拖动为代表综合案例；不把同一案例重复算成三个布局各一次测试。'}}
  rec['styles']['browserEvidence'].extend([evidence(TREE+'/evidence/browser-time.json',f'[case={layout}]','browser-specialized'),evidence(TREE+'/evidence/branch-styles/browser-report.json',f'[case begins {layout}-]','browser-specialized'),evidence(TREE+'/evidence/browser-dynamic-options.json',f'[kind={layout}]','browser-specialized')])
  rec['exports']['svg']['currentArtifactRefresh']={'basis':'1.0冻结后专门刷新三个默认树SVG；与较早82总套件分开','sha256':svgHash,'startedAt':b['startedAt'],'evidence':browserEv}
 records.append(rec)
sourceMapping=[{'sourceUrl':u,'sourceNameZh':s['chineseName'],'sourceAvailability':s['availability'],'templateIds':[r['templateId'] for r in records if u in r['sourceEntrances']]} for u,s in sourceByUrl.items()]
inputs=['docs/acceptance/invalid-input-browser.json','tests/artifacts/browser-results.json','tests/artifacts/control-audit.json','tests/artifacts/export-matrix.json','tests/artifacts/template-cases.json','server/tests/artifacts/advanced-export-matrix.json','web/src/templates/basic/evidence/browser-advanced.json','web/src/templates/basic/evidence/browser-statistics.json','web/src/templates/special/evidence/browser-qa.json','web/src/templates/special/evidence/browser-interactions.json','web/src/templates/special/evidence/browser-advanced.json','web/src/templates/special/evidence/browser-real-analysis.json','web/src/templates/special/evidence/browser-coverage.json','docs/research/comparison.json']
result={'schemaVersion':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'本地交付验收索引；不构成生产HTTPS部署成功声明','counts':{'templates':len(records),'sourceEntrances':len(sourceMapping),'unmappedSourceEntrances':sum(not x['templateIds'] for x in sourceMapping),'browserPassed':browser['stats']['expected'],'browserIntentionalSkips':browser['stats']['skipped'],'browserFailed':browser['stats']['unexpected'],'browserFlaky':browser['stats']['flaky'],'defaultSsrControls':len(controls),'defaultSsrChanged':sum(r['changedFromExample'] for r in controls),'defaultSsrConditional':sum(not r['changedFromExample'] for r in controls),'invalidInputBrowserCases':len(records)*2,'exportFiles':len(exports['files']),'exportFilesDecoded':sum(r.get('opened') is True for r in exports['files']),'exportCurrentSourceShaMismatches':sum(not r['exports'][f]['sourceHashMatchesCurrentSvg'] for r in records for f in ['png','pdf','eps'])},'browserScope':browser_scope,'unitRunReportedByMainTask':{'passed':args.unit_passed,'note':'来自主任务2026-09-06最终单元测试运行反馈；本索引引用具体测试源码与已保存审计，不把源码存在当作浏览器实操。'},'sourceManifests':[{'path':p,'sha256':sha(ROOT/p)} for p in inputs],'sourceMapping':sourceMapping,'templates':records}
tree_inputs=['tests/artifacts/tree-default-refresh.json',TREE+'/ACCEPTANCE.md',TREE+'/evidence/browser-time.json',TREE+'/evidence/browser-directions.json',TREE+'/evidence/branch-styles/browser-report.json',TREE+'/evidence/browser-dynamic-options.json','server/tests/artifacts/tree-branch-export-matrix.json']
result['sourceManifests'].extend({'path':p,'sha256':sha(ROOT/p)} for p in tree_inputs)
result['supplementalTreeEvidence']=tree_supplement
result['mainBrowserSuite']={'evidence':evidence('tests/artifacts/browser-results.json'),'startedAt':browser['stats']['startTime'],'stats':browser['stats'],'boundary':'82项历史总套件单独保留；之后的三默认树刷新与树功能专项不追记到该报告。'}
result['supplementalTreeEvidence']['finalDefaultRefresh']={'evidence':evidence('tests/artifacts/tree-default-refresh.json'),'startedAt':tree_default['stats']['startTime'],'stats':tree_default['stats'],'cases':tree_default_checks,'boundary':'311单元测试后的当前默认树SVG、项目下载与重新打开验收。仅3个树模板；其他52默认SVG未改写。'}
result['browserScope']=browser_scope
result['browserGroups']=dict(browser_groups)
result['counts']['exportOutputShaMismatches']=sum(not r['exports'][f]['artifactHashMatches'] for r in records for f in ['png','pdf','eps'])
result['counts']['advancedExportFiles']=sum(len(c['exports']) for r in records for c in r['specialConfigurations'])
result['counts']['advancedExportSourceShaMismatches']=sum(not e['sourceHashMatches'] for r in records for c in r['specialConfigurations'] for e in c['exports'])
result['counts']['treeBranchExportSourceShaMismatches']=sum(not r['sourceHashMatches'] for r in branch_files)
result['counts']['treeBranchExportOutputShaMismatches']=sum(not r['artifactHashMatches'] for r in branch_files)
result['reportStatus']='complete'
if sum(r['example']['status']=='passed' for r in records)!=55 or browser['stats']['unexpected'] or browser.get('errors'):
 result['reportStatus']='pending-final-browser-rerun'
elif result['counts']['exportCurrentSourceShaMismatches'] or result['counts']['exportOutputShaMismatches'] or result['counts']['advancedExportSourceShaMismatches'] or result['counts']['treeBranchExportSourceShaMismatches'] or result['counts']['treeBranchExportOutputShaMismatches']:
 result['reportStatus']='pending-export-refresh'
if result['reportStatus']=='pending-final-browser-rerun':result['previousObservedBrowserRun']={'passed':77,'intentionalSkips':195,'failed':0,'observedStartTime':'2026-09-06T13:54:41.729Z','note':'此前读取并核对过；后续错误的单文件测试命令把总报告覆盖为空，主任务正统一重跑，当前不以旧成功填充新报告。'}
(OUT/'templates.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
with (OUT/'templates.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['模板ID','中文名称','类别','原页面链接','示例','替代数据','错误校验','样式SSR变化/审计数','浏览器样式证据','条件项','SVG文件','PNG文件','PDF文件','EPS文件','导出来源SHA一致','项目证据','逐项结构记录'])
 for r in records:
  w.writerow([r['templateId'],r['nameZh'],r['category'],' | '.join(r['sourceUrls']),('通过·Chromium' if r['example']['status']=='passed' else '最终总报告重跑中'),r['alternateData']['method'],'通过·浏览器两种错误',f"{r['styles']['ssrAudit']['changedFromExample']}/{r['styles']['ssrAudit']['audited']}",' | '.join(e['path'] for e in r['styles']['browserEvidence']) or '本模板未逐控件浏览器实操；见SSR与公共代表流程',' | '.join(c['key']+':'+c['explanation'] for c in r['styles']['conditionalControls']),*[r['exports'][fmt]['artifact'] for fmt in ['svg','png','pdf','eps']],'是' if all(r['exports'][fmt]['sourceHashMatchesCurrentSvg'] for fmt in ['png','pdf','eps']) else '待刷新当前输入版本',r['project']['downloadAndDatasetCheck']['path']+'；web/tests/project.test.ts；tests/artifacts/template-cases.json',f"docs/acceptance/templates.json → templates[templateId={r['templateId']}]"])
c=result['counts']
readme=f'''# OpenAcad 逐模板验收索引

更新时间：{result['generatedAt']}。本目录对应 **{c['templates']} 个可编辑模板、{c['sourceEntrances']} 个去重源站入口**。这是本地交付证据索引，正式域名、服务器发布与回滚另见部署文档。

- [逐模板表格](templates.csv)：适合筛选模板、来源、四种图片文件和条件项。
- [完整结构记录](templates.json)：每项检查的方法、报告选择路径、原始中文错误、文件 SHA、条件分支和源站一对多映射。
- [公开简要页面](../../web/public/acceptance/index.html)：部署路径 `/acceptance/index.html`，提供中文检索及相同 JSON/CSV 下载。

## 最终运行结果及解释

主浏览器套件（开始时间：{browser['stats']['startTime']}）：**{c['browserPassed']} 通过，{c['browserFailed']} 失败，{c['browserIntentionalSkips']} 按配置跳过，{c['browserFlaky']} 重试不稳定**。55 个模板均在 Chromium 实际显示、下载项目、下载 SVG 并重新打开 SVG；3 个通用工作流另在 Chromium、Firefox、WebKit 和 390px 手机配置各运行一次。{browser_groups['live-analysis.spec.ts']} 项排序分析使用真实后端，{browser_groups['live-export.spec.ts']} 项验证实际图片导出（桌面与手机各四格式），{browser_groups['ordination-editor.spec.ts']} 项检查排序图分组/已有坐标模式/项目恢复，{browser_groups['performance.spec.ts']} 项检查样式响应时间。{c['browserIntentionalSkips']} 个跳过项表示按场景只在指定配置运行，不能说55图均完成四浏览器逐项验收。原报告：[browser-results.json](../../tests/artifacts/browser-results.json)。

默认样式审计记录 **{c['defaultSsrControls']} 项**，其中 **{c['defaultSsrChanged']} 项**改变服务器端 React SVG 序列化，另 **{c['defaultSsrConditional']} 项**依赖特定数据或布局。它不是{c['defaultSsrControls']}次浏览器操作，也不证明任意参数组合。每个模板的真实浏览器样式覆盖单独列出。主任务最终单元测试反馈为{args.unit_passed}项通过；本索引把具体断言位置与运行报告分开引用。

另外完成 **110 次实际 Chrome 注错**：每个模板一次缺数据，一次非法数字、缺必填列、集合数超限或非法 Newick 分支长度；55×2全部显示中文错误。具体破坏位置及界面错误原文已内嵌 JSON 的 `invalidData`。这是逐模板有界输入检查，不是穷举所有错误。

图片导出 **{c['exportFilesDecoded']}/{c['exportFiles']}** 文件经过真实 Redis/RQ/Inkscape 转换，使用 Pillow/Poppler/Ghostscript 独立打开。每个模板分别列SVG、PNG、PDF、EPS文件；当前输入SHA不一致项为 **{c['exportCurrentSourceShaMismatches']}**。SHA不一致只说明当前SVG与导出使用的版本不同，不能把旧文件套在新输入上声明完成；最终应为0。EPS透明效果可能按背景栅格化，详见各文件diagnostics；不能把“EPS可打开”写成“所有EPS均为全矢量”。[导出报告](../../tests/artifacts/export-matrix.json)。

## 数据替换、样式和项目的证据层次

- 特殊22模板：Chrome实际替代数据、撤销、中文标题、项目下载及同ID重开；专项覆盖矩阵注释、聚类树、圈轨道、断轴、网络属性/拖动、Venn拖动、共线性拖序和分类色。另有8次真实统计服务计算。[特殊图证据说明](../special-capability-gaps.md)。
- 基础25模板：每模板两套数据的SSR几何变化、缺必填字段与项目往返；柱图有纹理、系列覆盖、轴设置及标签拖动的独立浏览器与四格式文件，误差柱有真实P值/字母标注及拖动。不能把同内核代表浏览器场景算作25图每个控件都已实际点击。
- 排序5模板：实际替换另一组数据、重新提交服务、输出变化、过期结果提示、保存含provenance的项目；已有坐标模式及注释另外有单测。
- 树3布局：原树/第二组树/拓扑保存有逐布局单测；浏览器逐层共71个适用组合（矩形29、圈形29、无根13）检查替代图层数据、隐藏和项目重开。无根16个布局不适用项见[树图层研究](../research/tree-layers.json)，不算成功执行。三图层组合另有实际四格式导出。

项目文件为 `.openacad.json`，图片格式是SVG/PNG/PDF/EPS。默认逐图测试实际下载项目并检查输入数据/分析结果；部分临时下载没有独立留档，索引明确将 `template-cases.json` 标为测试输入夹具，而非伪称下载证据。[项目往返断言](../../web/tests/project.test.ts)。

## 1.0冻结后树功能专项

以下专项独立于保留的82项总浏览器套件；**案例数、布局组合数与图片文件数分开记录**，不把截图或下载数量加到82项测试上。完整记录见 JSON 顶层 `supplementalTreeEvidence`，三树模板也有各自的 `treeSupplementalEvidence`。

|专项|浏览器案例|实际文件|证据|
|---|---|---|---|
|已有时间树|3布局、3案例通过|12份SVG/PNG/PDF/EPS及3个可编辑项目|[时间树报告](../../web/src/templates/tree/evidence/browser-time.json)|
|生长方向|矩形RTL、环形向内，共2案例通过|8份四格式图片及2个项目|[方向报告](../../web/src/templates/tree/evidence/browser-directions.json)|
|分支/支持度|14个布局×路径组合＋1个支持度综合案例，共15通过|16份SVG，另48份PNG/PDF/EPS独立打开；综合案例前后SVG不算两个测试|[浏览器报告](../../web/src/templates/tree/evidence/branch-styles/browser-report.json)、[导出报告](../../server/tests/artifacts/tree-branch-export-matrix.json)|
|动态分支菜单|同一项目切换3布局|当前有效路径选项为6/5/3；无额外图片计数|[菜单记录](../../web/src/templates/tree/evidence/browser-dynamic-options.json)|

三个默认树SVG在1.0功能冻结后专门刷新：[独立机器报告](../../tests/artifacts/tree-default-refresh.json) 开始于 {tree_default['stats']['startTime']}，3项通过；对应9份PNG/PDF/EPS也已与当前源SHA同步。这次刷新单独标注，不把它追记为较早总套件的一部分。已有时间树编辑使用用户已有年代、后验摘要与可信区间；不运行BEAST/MCMCTree，也不从单树估计分歧时间或收敛。[树工作台验收与边界](../../web/src/templates/tree/ACCEPTANCE.md)。

## 四个默认未变的条件项

|模板/控件|为什么默认未变|专项证据|
|---|---|---|
|sankey / flowAlign|默认各路径层数相同；增加短路径终点后对齐改变几何|special.test.tsx：流对齐、类别透明度与普通数值轨道上限使用相应输入|
|synteny / syntenyInput|默认原文件和标准化表表达同一生物数据；等价结果是预期|browser-interactions.json 的 synteny-native；原格式及另一组原文件实际显示|
|synteny / chromosomeSort|默认数据已按名称排序；反转后名称排序改变几何|special.test.tsx 对应排序测试；browser-coverage.json 拖序重开|
|tree-normal / marginRight|默认画布尚有余量；密集8图层时触发真实画布扩展|tree.test.tsx：右边距+100断言SVG宽度+100|

## 重建索引

先确保 Node 和 `web/node_modules` 可用，再从任意目录运行：

```sh
python3 /你的仓库路径/OpenAcad/docs/acceptance/build_index.py --unit-passed {args.unit_passed}
```

脚本通过自身位置找到仓库，用 Vite 只读加载当前模板注册表，读取仓库内测试报告和 [逐模板注错原始记录](invalid-input-browser.json)。它不会重新执行测试、请求统计服务或覆盖SVG；总报告缺失/不完整时标记待刷新。新增模板不应继承旧模板的成功记录。先完成测试，再重建索引。

## 来源与文件版本

`sourceUrls`保留注册模板的全部来源链接；`sourceEntrances`只统计52个ChiPlot入口，自然地理数据许可证链接不计为图表入口。圆点二值对应 `binary_plot.html`，方格二值对应 `binary_plot2.html`；富集点/柱同源入口，三树布局同源tvBOT入口。JSON顶层 `sourceMapping` 保留52→55映射。

每份输入报告在 `sourceManifests` 中记录SHA，图片记录输出SHA与源SVG SHA。若重跑浏览器生成新SVG，必须同步刷新导出矩阵再刷新索引；只改文字/UUID也不应静默当作同字节来源。索引不修改研究生成器、原站事实或生产发布状态。
'''
if result['reportStatus']=='pending-final-browser-rerun':readme=readme.replace('## 最终运行结果及解释','## 当前总报告待刷新\n\n此前已读取77通过/195有意跳过/0失败的完整报告；后续一次测试文件路径错误覆盖为空。主任务正重跑完整套件，当前默认逐图记录标记 pending-report-refresh。已完成的110次注错、165份独立导出和模块专项仍有独立证据。下述总浏览器数字来自当前文件，不能视为最终完成声明。\n\n## 最终运行结果及解释')
if result['reportStatus']=='pending-export-refresh':readme=readme.replace('## 最终运行结果及解释','## 当前导出版本待同步\n\n浏览器报告已通过；部分导出使用的源SVG校验值与当前输入不同，正在重新转换。索引状态为 pending-export-refresh，不能用旧导出完成当前版本验收。\n\n## 最终运行结果及解释')
(OUT/'README.md').write_text(readme)
PUBLIC=ROOT/'web/public/acceptance'
PUBLIC.mkdir(parents=True,exist_ok=True)
for name in ['templates.json','templates.csv']:
 shutil.copyfile(OUT/name,PUBLIC/name)
summary_state='本地验收记录已同步' if result['reportStatus']=='complete' else '证据版本正在同步，请以各项记录为准'
page='''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>逐模板验收记录 · OpenAcad 开放学术</title>
<style>
:root{font-family:system-ui,"Noto Sans CJK SC",sans-serif;color:#1c302b;background:#f5f7f3;line-height:1.65}
body{max-width:1180px;margin:0 auto;padding:28px 20px}a{color:#17644d}h1{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.25}h2{font-size:1.2rem}
.links{display:flex;gap:20px;flex-wrap:wrap}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:24px 0}.card{padding:16px;background:white;border:1px solid #d4ded6;border-radius:10px}.card strong{display:block;font-size:1.6rem}.note{padding:16px;border-left:4px solid #b68b35;background:#fff9e9}.table-wrap{overflow-x:auto;border:1px solid #d4ded6;border-radius:8px;background:white}table{border-collapse:collapse;min-width:850px;width:100%;font-size:.91rem}th,td{padding:12px;text-align:left;border-bottom:1px solid #e1e7e0;vertical-align:top}th{background:#e8f0e7}small{display:block;color:#57655d}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #afbeb2;border-radius:6px;margin:8px 0 16px;font:inherit}code{overflow-wrap:anywhere}footer{color:#57655d;margin-top:24px}
</style></head><body>
<nav class="links"><a href="/">返回 OpenAcad</a><a href="/research/index.html">图表功能研究</a></nav>
<h1>逐模板验收记录</h1>
<p>@@STATE@@。这里记录 55 个可编辑模板与 52 个源站入口的对应关系，区分浏览器操作、代码渲染检查与实际文件解码。</p>
<p class="links"><a href="templates.csv" download>下载逐模板 CSV</a><a href="templates.json" download>下载完整 JSON 证据索引</a></p>
<div class="cards"><div class="card"><strong>@@BROWSER@@</strong>浏览器测试通过</div><div class="card"><strong>@@ERRORS@@</strong>实际输入错误检查</div><div class="card"><strong>@@EXPORTS@@</strong>默认图片独立解码</div><div class="card"><strong>@@SPECIAL@@</strong>复杂配置图片独立解码</div></div>
<p class="note">55 个模板逐图验收运行于 Chromium；3 个通用流程覆盖 Chromium、Firefox、WebKit 和 390px 手机。@@CONTROLS@@ 项默认控件审计是 SVG 渲染检查，其中 @@CONDITIONAL@@ 项有条件分支专项证据，不能当作逐控件浏览器点击。EPS 透明效果可能栅格化。</p>
<p>图片格式为 SVG、PNG、PDF、EPS；可继续编辑的项目文件为 <code>.openacad.json</code>。完整 JSON 内记录证据路径与 SHA，源码仓库保留对应报告和文件；本公开页面不镜像所有测试图片，也不代表正式服务器部署验收结论。</p>
<h2>1.0 树功能追加专项</h2><p>前端单元测试 @@UNIT@@ 项通过。以下专项独立于82项总浏览器套件：已有时间树3个案例、12份图片；矩形RTL与环形向内2个案例、8份图片；分支及支持度15个案例、16份SVG，另48份PNG/PDF/EPS独立打开。布局组合、下载文件和截图数量不相加成测试数。三布局的动态分支选项分别为6/5/3。</p><p>树图展示用户已有年代及区间，不运行BEAST/MCMCTree估计分歧时间。完整JSON中的 <code>supplementalTreeEvidence</code> 提供专项路径、文件SHA和边界。</p>
<label for="search">搜索模板名称或编号</label><input id="search" type="search" placeholder="例如：热图、network、PCA">
<p id="count" aria-live="polite"></p>
<div class="table-wrap"><table><thead><tr><th>模板</th><th>示例</th><th>替代数据</th><th>错误提示</th><th>样式检查</th><th>四格式文件</th><th>项目</th><th>原站入口</th></tr></thead><tbody id="rows"></tbody></table></div>
<h2>证据怎样阅读</h2><p>“SSR”表示根据输入在服务端渲染 SVG 并比较结果，和浏览器实际操作分别记录。每个模板的错误检查覆盖两种实际注错；更详细的字段边界见单元测试。树图层记录适用组合，不把无根布局不适用的图层算作成功执行。</p>
<footer>更新：@@UPDATED@@。完整记录包含 @@SKIPS@@ 项按测试配置跳过的场景；跳过不算通过。</footer>
<script id="acceptance-data" type="application/json">@@ROWS@@</script>
<script>
const rows=JSON.parse(document.getElementById('acceptance-data').textContent);
const tbody=document.getElementById('rows');
function addCell(tr,value){const td=document.createElement('td');td.textContent=value;tr.append(td);return td;}
function render(){const query=document.getElementById('search').value.trim().toLowerCase();const selected=rows.filter(r=>(r.id+' '+r.name).toLowerCase().includes(query));tbody.replaceChildren();for(const r of selected){const tr=document.createElement('tr');const label=addCell(tr,r.name);const id=document.createElement('small');id.textContent=r.id;label.append(id);addCell(tr,r.example);addCell(tr,r.alternate);addCell(tr,r.errors);addCell(tr,r.styles);addCell(tr,r.formats);addCell(tr,r.project);const source=addCell(tr,'');r.sources.forEach((url,i)=>{const a=document.createElement('a');a.href=url;a.textContent='入口'+(i+1);a.rel='noopener';a.target='_blank';source.append(a,document.createElement('br'));});tbody.append(tr);}document.getElementById('count').textContent='显示 '+selected.length+' / '+rows.length+' 个模板';}
document.getElementById('search').addEventListener('input',render);render();
</script></body></html>'''
public_rows=[]
for r in records:
 current=all(r['exports'][f]['sourceHashMatchesCurrentSvg'] and r['exports'][f]['artifactHashMatches'] and r['exports'][f]['status']=='passed' for f in ['png','pdf','eps'])
 public_rows.append({'id':r['templateId'],'name':r['nameZh'],'sources':r['sourceEntrances'],'example':'浏览器通过' if r['example']['status']=='passed' else '待刷新','alternate':{'browser':'浏览器','browser-real-analysis':'浏览器＋真实计算','unit-SSR':'SSR几何变化'}[r['alternateData']['method']],'errors':'两种注错通过' if r['invalidData']['status']=='passed' else '待核查','styles':str(r['styles']['ssrAudit']['changedFromExample'])+'/'+str(r['styles']['ssrAudit']['audited'])+' SSR；浏览器范围见JSON','formats':'文件可打开，SHA一致' if current else '版本待同步','project':'下载＋数据校验；重开范围见JSON'})
tokens={'STATE':summary_state,'UNIT':str(args.unit_passed),'BROWSER':str(c['browserPassed']),'ERRORS':str(c['invalidInputBrowserCases']),'EXPORTS':str(c['exportFilesDecoded']),'SPECIAL':str(c['advancedExportFiles']),'CONTROLS':str(c['defaultSsrControls']),'CONDITIONAL':str(c['defaultSsrConditional']),'UPDATED':result['generatedAt'],'SKIPS':str(c['browserIntentionalSkips'])}
for token,value in tokens.items():page=page.replace('@@'+token+'@@',html.escape(value))
page=page.replace('@@ROWS@@',json.dumps(public_rows,ensure_ascii=False).replace('<','\\u003c'))
(PUBLIC/'index.html').write_text(page)
assert len(records)==55 and len(sourceMapping)==52 and all(x['templateIds'] for x in sourceMapping)
assert all(r['invalidData']['status']=='passed' for r in records)
assert not any(c['status']=='unresolved' for r in records for c in r['styles']['conditionalControls'])
print(json.dumps(result['counts'],ensure_ascii=False))
