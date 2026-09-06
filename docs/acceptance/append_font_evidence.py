"""Append verified typography evidence without replacing historical image runs."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/acceptance'
PUBLIC = ROOT / 'web/public/acceptance'
SOURCE = ROOT / 'tests/artifacts/font-bold-refresh/normalized-weight/verification-summary.json'
if not SOURCE.exists():
    raise SystemExit('字体补充报告尚未生成；不标记成功。')
summary = json.loads(SOURCE.read_text())
assert summary['passed'] and not summary['failures']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

rows = []
for name, group in summary['groups'].items():
    report = ROOT / group['report']
    assert digest(report) == group['reportSha256']
    items = json.loads(report.read_text())['files']
    assert len(items) == group['reportRows'] == group['actualOutputFiles']
    assert len({item['file'] for item in items}) == len(items)
    for item in items:
        stored = item['file']
        relative = 'tests/artifacts/' + stored.split('/tests/artifacts/', 1)[1] if '/tests/artifacts/' in stored else stored
        path = (ROOT / relative).resolve()
        assert path.is_relative_to(ROOT.resolve())
        assert digest(path) == item['sha256'] and item['opened'] and not item['touchesPageEdge']
        rows.append({'group': name, 'templateId': item['template'], 'format': item['format'],
                     'sourceSha256': item['sourceSha256'], 'file': str(path.relative_to(ROOT)),
                     'sha256': item['sha256'], 'bytes': item['bytes'], 'decoder': item['decoder'],
                     'opened': True, 'diagnostics': item['diagnostics']})
assert len(rows) == 258
result = {'scope': '本机隔离环境；同86份SVG与真实400/700字体，258份实际服务转换及独立打开，不是生产域名验收',
          'sourceReport': str(SOURCE.relative_to(ROOT)), 'sourceReportSha256': digest(SOURCE),
          'fontManifest': summary['fontManifest'], 'verifiedAt': summary['verifiedAt'],
          'groups': summary['groups'], 'files': rows,
          'relatedEvidence': ['tests/artifacts/font-delivery-oblique/README.md',
                              'tests/artifacts/font-weight-export/README.md',
                              'tests/artifacts/font-italic-after/README.md',
                              'tests/artifacts/font-oblique-layout/README.md',
                              'server/fonts/SOURCES.md'],
          'boundaries': ['旧字体及第一轮650失败结果保留，未覆盖旧证据。',
                         '650到700采用已提供静态字体的匹配规则；斜体使用明确标注的12度派生Oblique面，网页和服务使用同源字体。',
                         '独立打开及边界检查不等于全部图形内部组合的穷举证明。']}
for base in (OUT, PUBLIC):
    (base / 'font-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    index = base / 'templates.json'
    data = json.loads(index.read_text())
    data['supplementalFontEvidence'] = {key: value for key, value in result.items() if key != 'files'}
    data['supplementalFontEvidence']['fileIndex'] = 'font-verification.json'
    for template in data['templates']:
        template['fontWeightExports'] = [row for row in rows if row['group'] == 'default' and row['templateId'] == template['templateId']]
        assert len(template['fontWeightExports']) == 3
    index.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
page = PUBLIC / 'index.html'
s = page.read_text()
block = '''<!-- font-evidence:start -->
<h2>1.0.2 字体与导出补充</h2>
<p>补齐同源的常规体与真实粗体，并明确保存静态字重匹配；斜体使用同源的12度派生倾斜面，不冒称官方Noto Italic设计。网页各字体面与斜体开关的实际像素变化分别验证，另有两种复杂布局的项目重开与8份四格式下载验证。</p>
<p>使用新字体对相同86份SVG重新转换258份PNG/PDF/EPS，全部独立打开且未触边。86个PDF使用真实Bold；37份原650字重图片已改变，其余49份PNG保持一致。这是本机隔离环境的补充证据，旧运行仍保留；不将图片数加成浏览器测试数。</p>
<p><a href="font-verification.json" download>下载字体补充证据与258份文件SHA索引</a>。可编辑项目仍为 <code>.openacad.json</code>；EPS透明效果可能栅格化。</p>
<!-- font-evidence:end -->'''
if '<!-- font-evidence:start -->' in s:
    s = re.sub(r'<!-- font-evidence:start -->.*?<!-- font-evidence:end -->', block, s, flags=re.S)
else:
    s = s.replace('<label for="search">', block+'\n<label for="search">', 1)
page.write_text(s)
readme = OUT / 'README.md'
s = readme.read_text()
block = '''<!-- font-evidence:start -->
## 1.0.2 字体与导出补充

真实400/700字体与静态字重匹配修复后，对相同86个源SVG全量重转258份PNG/PDF/EPS，独立打开全部通过，未复用旧输出。86个PDF有真实Bold资源；37个650源图产生预期像素变化，其余49个PNG保持一致。[补充索引](font-verification.json)列出每份源/输出SHA、独立工具和字体身份；每模板的3份新默认输出另列于完整JSON的 `fontWeightExports`，不覆盖历史 `exports`。

此轮使用本机隔离镜像和明确SHA的修复导出模块；后续相对字重输入拒绝规则另经服务测试验证。不能把这258份文件称作生产域名下载。浏览器字重、稀有字、实际斜体像素以及服务器63项字体测试、42份实际小夹具导出及14份PDF独立打开分别记录；原始1.0.1与第一轮650失败样品仍保留。正式部署状态见[发布记录](../deployment/production-record.md)。
<!-- font-evidence:end -->'''
if '<!-- font-evidence:start -->' in s:
    s = re.sub(r'<!-- font-evidence:start -->.*?<!-- font-evidence:end -->', block, s, flags=re.S)
else:
    s += '\n'+block+'\n'
readme.write_text(s)
print('已添加258份字体补充文件、55模板新默认导出记录；保留历史运行。')
