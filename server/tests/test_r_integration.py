import json
import shutil
import subprocess
import numpy as np
import pytest
from scipy.spatial.distance import pdist, squareform
from app.analysis import run_analysis, p_adjust
from app.errors import AnalysisError
from test_analysis import payload

pytestmark = pytest.mark.skipif(shutil.which("Rscript") is None, reason="需要固定 R 统计镜像")


def table(values, role, name):
    result = payload("pca", np.asarray(values).tolist())["data"]["tables"][0]
    result.update(role=role, id=name)
    return result


def ecology_request(method, **params):
    rng = np.random.default_rng(29)
    y = rng.poisson(6, (12, 4)) + 1
    e = rng.normal(size=(12, 2))
    req = payload(method, **params)
    if method in ("cca", "rda"):
        req["data"]["tables"] = [table(y, "response", "y"), table(e, "environment", "e")]
    elif method.startswith("mantel"):
        req["data"]["tables"] = [table(y, "community", "y"), table(e, "environment", "e")]
        if method == "mantel.partial":
            req["data"]["tables"].append(table(rng.normal(size=(12, 2)), "control", "z"))
    else:
        req["data"]["tables"] = [table(y, "matrix", "y")]
    return req


@pytest.mark.parametrize("method", ["pcoa", "nmds", "cca", "rda"])
def test_ordination_actual(method):
    req = ecology_request(method)
    r = run_analysis(req)
    assert r["provenance"]["r"].startswith("4.6.1")
    s = np.array(r["data"]["scores"])
    assert s.shape[0] == 12 and s.shape[1] >= 2 and np.isfinite(s).all()
    if method == "pcoa":
        x = np.array([r[1:] for r in req["data"]["tables"][0]["rows"]])
        np.testing.assert_allclose(pdist(s), pdist(x), atol=1e-7)
    if method == "nmds":
        assert r["data"]["stress"] >= 0
        repeat = run_analysis(req)
        np.testing.assert_allclose(repeat["data"]["scores"], s, atol=1e-12)
    if method in ("cca", "rda"):
        assert np.array(r["data"]["environmentVectors"]).shape == (2, 2)


@pytest.mark.parametrize("correction", ["none", "lingoes", "cailliez"])
def test_pcoa_corrections(correction):
    req = ecology_request("pcoa", distance="braycurtis", correction=correction)
    data = run_analysis(req)["data"]
    assert data["negativeEigenvalueSum"] > 0
    assert len(data["explainedRatio"]) == len(data["scores"][0])
    assert sum(data["explainedRatio"]) == pytest.approx(1)


@pytest.mark.parametrize("method", ["lm", "loess", "gam"])
def test_regression_real(method):
    x = np.linspace(0, 10, 30)
    noise = np.sin(x) * .15
    req = payload(method, np.c_[x, 2*x+3+noise].tolist(), points=50)
    data = run_analysis(req)["data"]["series"][0]
    assert len(data["curve"]) == 50
    for item in data["curve"]:
        assert item["lower"] <= item["y"] <= item["upper"]
    if method == "lm":
        slope, intercept = np.polyfit(x, 2*x+3+noise, 1)
        assert data["model"]["coefficients"]["x"] == pytest.approx(slope)
        assert data["model"]["coefficients"]["(Intercept)"] == pytest.approx(intercept)


@pytest.mark.parametrize("method", ["mantel", "mantel.randtest", "mantel.rtest", "mantel.partial"])
def test_mantel_real_and_reproducible(method):
    req = ecology_request(method, seed=32, permutations=999)
    data = run_analysis(req)["data"]
    again = run_analysis(req)["data"]
    assert data == again and len(data["edges"]) == 2
    for edge in data["edges"]:
        assert -1 <= edge["r"] <= 1 and 0 < edge["p"] <= 1
    # The Mantel coefficient is independently reconstructed from distance vectors.
    y, e = [np.array([r[1:] for r in t["rows"]]) for t in req["data"]["tables"][:2]]
    xd = pdist(y, "braycurtis"); yd = pdist(e[:, :1])
    r = np.corrcoef(xd, yd)[0, 1]
    if method == "mantel.partial":
        z = np.array([r[1:] for r in req["data"]["tables"][2]["rows"]])
        zd = pdist(z); rxz = np.corrcoef(xd, zd)[0, 1]; ryz = np.corrcoef(yd, zd)[0, 1]
        r = (r-rxz*ryz)/np.sqrt((1-rxz**2)*(1-ryz**2))
    assert data["edges"][0]["r"] == pytest.approx(r, abs=1e-9)


def test_partial_requires_independent_control():
    req = ecology_request("mantel.partial")
    req["data"]["tables"].pop()
    with pytest.raises(AnalysisError, match="control"):
        run_analysis(req)


def test_p_adjust_cross_r():
    for method in ["BH", "BY", "holm", "bonferroni"]:
        result = subprocess.run(["Rscript", "--vanilla", "-e", f'cat(jsonlite::toJSON(p.adjust(c(.01,.04,.03,.5),method="{method}"),digits=16))'], capture_output=True, text=True, check=True)
        np.testing.assert_allclose(p_adjust([.01, .04, .03, .5], method), json.loads(result.stdout))


@pytest.mark.parametrize("distance", ["bray", "manhattan", "euclidean", "canberra", "clark", "kulczynski", "jaccard", "gower", "altGower", "morisita", "horn", "mountford", "raup", "binomial", "chao", "cao", "mahalanobis", "chisq", "chord", "hellinger", "aitchison"])
def test_all_ecological_distances(distance):
    rng = np.random.default_rng(836)
    a = rng.integers(1, 8, (12, 8)) * rng.binomial(1, .55, (12, 8))
    req = payload("nmds", a.tolist(), distance=distance, pseudocount=.5, tryMax=4)
    req["params"]["try"] = 2
    result = run_analysis(req)["data"]
    assert np.isfinite(result["stress"]) and np.isfinite(result["scores"]).all()
