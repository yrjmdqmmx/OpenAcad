import json
from pathlib import Path
import numpy as np
import pytest
from scipy.stats import gaussian_kde
from app.analysis import run_analysis
from app.errors import AnalysisError


def test_fixture_is_independent_locked_scipy_reference():
    reference=json.loads((Path(__file__).parent/'artifacts/basic-kde-reference.json').read_text())
    x=np.asarray(reference['values']);grid=np.asarray(reference['grid']['values'])
    for case in reference['cases'].values():
        kde=gaussian_kde(x,bw_method=case['bwMethod'])
        kde.set_bandwidth(kde.factor*case['bandwidthMultiplier'])
        np.testing.assert_allclose(kde(grid),case['gridDensity'],rtol=1e-13,atol=1e-15)
        assert kde(case['singlePoint']['x'])[0]==pytest.approx(case['singlePoint']['density'],abs=1e-15)


@pytest.mark.parametrize('bandwidth,multiplier',[('scott',1),('silverman',1),('scott',1.6),('silverman',.7),(.42,1)])
@pytest.mark.parametrize('trim',[True,False])
def test_service_grid_and_multiplier_for_unequal_group_sizes(bandwidth,multiplier,trim):
    values=[1,2,3,5,8,13]
    payload={'kind':'analysis','method':'density','data':{'tables':[{'id':'matrix','role':'matrix','columns':['id','six','four'],'rows':[[str(i),v,v if i<4 else None] for i,v in enumerate(values)]}]},'params':{'bandwidth':bandwidth,'bandwidthMultiplier':multiplier,'trim':trim}}
    result=run_analysis(payload)
    for n,column in zip([6,4],result['data']['columns']):
        a=np.asarray(values[:n]);kde=gaussian_kde(a,bw_method=bandwidth);base=kde.factor;kde.set_bandwidth(base*multiplier)
        grid=np.linspace(a.min(),a.max(),512) if trim else np.linspace(a.min()-3*a.std(ddof=0),a.max()+3*a.std(ddof=0),512)
        np.testing.assert_allclose(column['x'],grid,rtol=1e-14)
        np.testing.assert_allclose(column['density'],kde(grid),rtol=1e-13,atol=1e-15)
        assert column['baseBandwidthFactor']==pytest.approx(base)
        assert column['bandwidthAbsolute']==pytest.approx(a.std(ddof=1)*base*multiplier)
    assert result['provenance']['parameters']['points']==512


def test_degenerate_density_samples_are_rejected():
    for values in [[7],[7,7]]:
        payload={'kind':'analysis','method':'density','data':{'tables':[{'id':'matrix','role':'matrix','columns':['id','value'],'rows':[[str(i),v] for i,v in enumerate(values)]}]},'params':{}}
        with pytest.raises(AnalysisError,match='至少需要两个不相同'):
            run_analysis(payload)
