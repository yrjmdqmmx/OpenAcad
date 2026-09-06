import numpy as np
import pytest
from app.analysis import run_analysis, distances, DISTANCES, BINARY, p_adjust
from app.errors import AnalysisError
from app.models import JobRequest


def payload(method, values=None, **params):
    if values is None:
        values = [[1, 2], [2, 5], [4, 3], [7, 8], [8, 6]]
    return {"kind": "analysis", "method": method, "data": {"tables": [{"id": "t", "role": "matrix", "name": "数据", "columns": ["样本"] + [f"v{i}" for i in range(len(values[0]))], "rows": [[f"s{i}"] + row for i, row in enumerate(values)]}]}, "params": params}


def test_descriptive_and_bad_cell():
    r = run_analysis(payload("descriptive", [[1], [2], [3], [4], [100]]))["data"]["columns"][0]
    assert r["median"] == 3 and r["outliers"] == [100] and r["upperWhisker"] == 4
    with pytest.raises(AnalysisError) as e:
        run_analysis(payload("pca", [[1, 3], ["bad", 4], [3, 5]]))
    assert e.value.detail["row"] == 3 and e.value.detail["column"] == "v0"


@pytest.mark.parametrize("direction", ["row", "column"])
@pytest.mark.parametrize("method", ["None", "StandardScaler", "MinMaxScaler", "MaxAbsScaler", "RobustScaler", "PercentScaler"])
def test_standardization(method, direction):
    result = run_analysis(payload("standardize", standardization=method, direction=direction))["data"]["values"]
    x = np.array(result)
    axis = 1 if direction == "row" else 0
    if method == "StandardScaler":
        np.testing.assert_allclose(x.mean(axis=axis), 0, atol=1e-15)
        np.testing.assert_allclose(x.std(axis=axis), 1)
    if method == "PercentScaler":
        np.testing.assert_allclose(x.sum(axis=axis), 100)


@pytest.mark.parametrize("metric", sorted(DISTANCES))
def test_all_distances(metric):
    binary = np.array([[1, 0, 1, 0], [0, 1, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]], float)
    x = binary if metric in BINARY else np.array([[1, 2], [2, 5], [4, 3], [7, 8], [8, 6]], float)
    d = distances(x, metric)
    assert np.isfinite(d).all()
    np.testing.assert_allclose(d, d.T)
    np.testing.assert_allclose(d.diagonal(), 0)


def test_distance_semantics():
    x = np.array([[1, 0], [0, 1]], float)
    assert distances(x, "canberra")[0, 1] == 2  # vegan would return 1.
    assert distances(x, "kulsinski")[0, 1] == 1
    np.testing.assert_allclose(distances(x, "jensenshannon")[0, 1], np.sqrt(np.log(2)))
    with pytest.raises(AnalysisError):
        distances(np.array([[1, 2], [2, 4], [3, 6.]]), "mahalanobis")


@pytest.mark.parametrize("method", ["single", "complete", "average", "weighted", "centroid", "median", "ward"])
def test_linkage(method):
    result = run_analysis(payload("cluster", linkage=method))["data"]["row"]
    assert len(result["linkage"]) == 4 and result["linkage"][-1][3] == 5
    assert sorted(result["order"]) == list(range(5))


def test_pca_reconstructs_and_explained_variance():
    req = payload("pca")
    data = run_analysis(req)["data"]
    x = np.array([r[1:] for r in req["data"]["tables"][0]["rows"]])
    reconstructed = np.array(data["scores"]) @ np.array(data["loadings"]).T + data["center"]
    np.testing.assert_allclose(x, reconstructed)
    assert sum(data["explainedRatio"]) == pytest.approx(1)
    np.testing.assert_allclose(data["eigenvalues"], np.linalg.eigvalsh(np.cov(x.T))[::-1])


def test_correlation_and_adjustment_unique_hypotheses():
    r = run_analysis(payload("correlation", pAdjust="BH"))["data"]
    expected = np.corrcoef(np.array([[1,2],[2,5],[4,3],[7,8],[8,6]]).T)
    np.testing.assert_allclose(r["r"], expected)
    assert r["hypothesisCount"] == 1 and r["p"][0][0] == 1
    np.testing.assert_allclose(p_adjust([.01, .04, .03, .5], "BH"), [.04, .053333333333, .053333333333, .5])
    np.testing.assert_allclose(p_adjust([.01, .04, .03, .5], "holm"), [.04, .09, .09, .5])


@pytest.mark.parametrize("test", ["ttest_ind", "ttest_rel", "wilcoxon_ind", "wilcoxon_rel", "wilcoxon_rank_sum", "anova"])
def test_real_tests(test):
    result = run_analysis(payload("tests", [[1, 3], [2, 6], [4, 7], [8, 12]], test=test))["data"]["comparisons"][0]
    assert 0 <= result["p"] <= 1 and np.isfinite(result["statistic"])


def test_kde_integral_and_gc_windows():
    d = run_analysis(payload("density", trim=False, points=2048))["data"]["columns"][0]
    assert np.trapezoid(d["density"], d["x"]) == pytest.approx(1, abs=.01)
    r = run_analysis({"kind": "analysis", "method": "gc", "data": {"sequences": ">chr1\nGCAANN", "tables": []}, "params": {"contentWindow": 4, "skewWindow": 4}})["data"]["sequences"][0]
    assert r["gcContent"][0]["value"] == 50
    assert r["gcSkew"][0]["value"] == 0
    assert r["gcContent"][1]["value"] is None


def test_schema_rejects_bool_and_bad_shape():
    req = payload("pca", [[True, 2], [3, 4]])
    with pytest.raises(ValueError): JobRequest.model_validate(req)
    req = payload("pca"); req["data"]["tables"][0]["rows"][0].pop()
    with pytest.raises(ValueError, match="单元格"): JobRequest.model_validate(req)
