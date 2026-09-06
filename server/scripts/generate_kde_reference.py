"""Independent SciPy reference; does not call OpenAcad's density implementation."""
import hashlib
import inspect
import json
from pathlib import Path
import platform
import numpy as np
import scipy
from scipy.stats import gaussian_kde

values=np.array([1,2,3,5,8,13],dtype=float)
grid=np.linspace(-1,15,512)
sample_sd=float(np.std(values,ddof=1))
point=2.5
cases={}
for name,bw,multiplier in [('scott','scott',1),('silverman','silverman',1),('customFactor',.42,1),('customAbsoluteWidth',1.25/sample_sd,1),('scottMultiplier','scott',1.6),('silvermanMultiplier','silverman',.7)]:
    kde=gaussian_kde(values,bw_method=bw)
    base_factor=float(kde.factor)
    kde.set_bandwidth(base_factor*multiplier)
    cases[name]={'bwMethod':bw,'bandwidthMultiplier':multiplier,'baseFactor':base_factor,'factor':float(kde.factor),'absoluteBandwidth':float(np.sqrt(kde.covariance[0,0])),'singlePoint':{'x':point,'density':float(kde(point)[0])},'gridDensity':kde(grid).tolist(),'integralOverRealLine':float(kde.integrate_box_1d(-np.inf,np.inf))}
invalid=[]
for sample in [[7.0],[7.0,7.0]]:
    try: gaussian_kde(sample)
    except Exception as error: invalid.append({'values':sample,'scipyException':type(error).__name__,'expectedOpenAcadBehavior':'明确拒绝少于两个有效点或常量列，不生成伪造密度'})
source=Path(inspect.getsourcefile(gaussian_kde))
report={'schemaVersion':1,'source':'直接调用已锁定SciPy gaussian_kde产生；未调用OpenAcad实现或浏览器预览函数','officialReference':'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html','provenance':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'scipyKdeSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()},'values':values.tolist(),'n':len(values),'sampleStandardDeviation':sample_sd,'covarianceDof':1,'grid':{'start':-1,'stop':15,'count':512,'endpoint':True,'values':grid.tolist()},'cases':cases,'invalidInputs':invalid,'apiGridConvention':{'points':512,'trimTrue':'linspace(min(values),max(values),points), 包含端点','trimFalse':'linspace(min(values)-3*populationSD,max(values)+3*populationSD,points), populationSD=ddof0','note':'本fixture主网格[-1,15]用于独立逐点核验，不声称是API默认裁剪域；h使用sampleSD(ddof1)而trim扩域使用populationSD(ddof0)。'},'numericBandwidthConvention':'正数bandwidth在SciPy/API中为factor，不是h；bandwidthMultiplier按各列独立计算基础factor后相乘。'}
Path('tests/artifacts/basic-kde-reference.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('已生成6个真实SciPy案例×512网格与单点、2个退化输入；sampleSD=',sample_sd)
