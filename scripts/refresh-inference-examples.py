"""Reproducible simulated examples, with actual inference (no planted P values).

Run with server/.venv/bin/python. Raw observations/memberships travel with the
downloaded project. SIM pathways and assigned directions are fictional inputs.
"""
import json
import pathlib
import random
import numpy as np
from scipy.stats import ttest_ind, hypergeom, false_discovery_control

ROOT = pathlib.Path(__file__).resolve().parents[1]
def table(id, name, role, columns, rows):
    return dict(id=id, name=name, role=role, columns=columns, rows=rows)


def generate(seed, alternate=False):
    rng = random.Random(seed)
    raw, results = [], []
    for i in range(360):
        name = f"模拟基因{i + 1:03}"
        effect = (1.5 if i % 2 else -1.5) if i % 5 == 0 else 0
        if alternate: effect *= .7
        scale = .5 + (i % 7) * .09
        a = [round(7 + rng.gauss(0, scale), 5) for _ in range(8)]
        b = [round(7 + effect + rng.gauss(0, scale), 5) for _ in range(8)]
        test = ttest_ind(b, a, equal_var=False)
        raw.append([name, *a, *b])
        results.append([name, float(np.mean(b) - np.mean(a)), float(test.pvalue)])

    volcano = dict(tables=[
        table('genes', '模拟观测的 Welch 检验（P 未校正）', 'genes', ['id', 'log2FC', 'pvalue'], results),
        table('raw-expression', '模拟 log2 表达量（每组 8 个独立观测）', 'raw-expression',
              ['id', *[f'对照{i+1}' for i in range(8)], *[f'处理{i+1}' for i in range(8)]], raw),
    ])
    specs = [
        ('碳水化合物代谢', 310, 24, '生物过程'), ('氧化应激响应', 220, 15, '生物过程'),
        ('跨膜物质运输', 275, 18, '细胞组分'), ('细胞壁组织', 190, 9, '生物过程'),
        ('核酸结合', 360, 21, '分子功能'), ('蛋白质折叠', 230, 12, '分子功能'),
        ('膜结构重建', 165, 7, '细胞组分'), ('信号转导调控', 290, 16, '生物过程'),
    ]
    universe = [f'SIM-G{i+1:04}' for i in range(6000)]
    study = set(rng.sample(universe, 180))
    directions = {g: ('上调' if rng.random() > .5 else '下调') for g in sorted(study)}
    memberships, erows, pvalues = [], [], []
    for i, (name, background, overlap, group) in enumerate(specs):
        if alternate: overlap = [11, 22, 10, 5, 28, 8, 12, 7][i]
        term = f'SIM:{i+1:02}'
        members = set(rng.sample(sorted(study), overlap) + rng.sample(sorted(set(universe) - study), background - overlap))
        hits = members & study
        pvalues.append(float(hypergeom.sf(len(hits)-1, len(universe), len(members), len(study))))
        up = sum(directions[g] == '上调' for g in hits)
        erows.append([term, f'{len(hits)}/{len(study)}', name, 0, len(hits), group, len(members), up, len(hits)-up])
        memberships.extend([[g, term] for g in sorted(members)])
    for r, q in zip(erows, false_discovery_control(pvalues, method='bh')):
        r[3] = float(q)
    enrichment = dict(tables=[
        table('enrichment', '模拟集合的超几何检验（BH 校正）', 'enrichment', ['ID','GeneRatio','Description','Qvalue','Count','Class','Background','Up','Down'], erows),
        table('raw-universe', '模拟背景基因（N = 6000）', 'raw-universe', ['gene'], [[g] for g in universe]),
        table('raw-study', '模拟输入基因（n = 180，方向为模拟输入）', 'raw-study', ['gene', '模拟方向'], [[g, directions[g]] for g in sorted(study)]),
        table('raw-membership', '虚构 SIM 通路成员（允许通路重叠）', 'raw-membership', ['gene','term'], memberships),
        table('raw-tests', '实际超几何 P 值与 BH Q 值', 'raw-tests', ['term','Pvalue','Qvalue'], [[r[0],p,r[3]] for r,p in zip(erows,pvalues)]),
    ])
    return dict(volcano=volcano, enrichment=enrichment)

out = generate(6731)
out['alternate'] = generate(19073, alternate=True)
out['method'] = dict(seed=6731, alternateSeed=19073,
    volcano='Both examples: two-sided Welch t-test on log2 expression, n=8+8, unadjusted P; log2FC=difference of group means.',
    enrichment='Both examples: hypergeometric upper-tail overrepresentation; N=6000, n=180; BH over all eight fictional SIM terms.')
(ROOT / 'web/src/templates/scientific-inference.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
print('Computed primary and alternate examples: 720 Welch tests and 16 hypergeometric tests; all raw inputs retained.')
