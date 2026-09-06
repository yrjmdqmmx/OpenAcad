"""Numerical operations. Statistical values are never inferred from chart examples."""
import hashlib
import importlib.metadata
import json
import math
import platform
import warnings

import numpy as np
from scipy import stats
from scipy.cluster import hierarchy
from scipy.spatial import distance
from sklearn.decomposition import PCA

from .data import align, matrix, numeric, standardize, table
from .errors import AnalysisError, require

R_METHODS = {"pcoa", "nmds", "cca", "rda", "lm", "loess", "gam", "mantel", "mantel.randtest", "mantel.rtest", "mantel.partial"}
METHODS = R_METHODS | {"descriptive", "density", "correlation", "tests", "standardize", "distance", "cluster", "pca", "gc"}
DISTANCES = {"euclidean", "sqeuclidean", "braycurtis", "canberra", "chebyshev", "cityblock", "correlation", "cosine", "dice", "hamming", "jaccard", "jensenshannon", "kulczynski1", "kulsinski", "mahalanobis", "matching", "minkowski", "rogerstanimoto", "russellrao", "seuclidean", "sokalmichener", "sokalsneath", "yule"}
BINARY = {"dice", "jaccard", "kulczynski1", "kulsinski", "rogerstanimoto", "russellrao", "sokalmichener", "sokalsneath", "yule"}
DEFAULTS = {
    "descriptive": {"idColumn": 0},
    "density": {"idColumn": 0, "points": 256, "bandwidth": "scott", "trim": True, "bins": 30},
    "correlation": {"correlation": "pearson", "alternative": "two-sided", "pAdjust": "none"},
    "tests": {"idColumn": 0, "test": "ttest_ind", "comparisons": "all", "alternative": "two-sided", "equalVariance": False, "pAdjust": "none"},
    "gc": {"contentWindow": 2000, "skewWindow": 2000},
}
for _method in ("standardize", "distance", "cluster", "pca", "pcoa", "nmds", "cca", "rda"):
    DEFAULTS[_method] = {"standardization": "None", "direction": "column"}
for _method in ("distance", "cluster", "pcoa"):
    DEFAULTS[_method].update(distance="euclidean", minkowskiP=2)
for _method in ("distance", "cluster"):
    DEFAULTS[_method].update(axis="row")
DEFAULTS["cluster"]["linkage"] = "complete"
DEFAULTS["pcoa"]["correction"] = "none"
DEFAULTS["nmds"].update(distance="bray", dimensions=2, **{"try":20}, tryMax=100, pseudocount=0)
DEFAULTS["cca"]["scaling"] = DEFAULTS["rda"]["scaling"] = 2
for _method in ("lm", "loess", "gam"):
    DEFAULTS[_method] = {"points": 200, "confidence": .95}
DEFAULTS["loess"].update(span=.5, degree=2)
DEFAULTS["gam"].update(basisDimension=10)
for _method in ("mantel", "mantel.randtest", "mantel.rtest", "mantel.partial"):
    DEFAULTS[_method] = {"speciesDistance":"bray", "environmentDistance":"euclidean", "controlDistance":"euclidean", "correlation":"pearson", "permutations":999, "pAdjust":"none", "pseudocount":0}


def clean(value):
    if isinstance(value, np.ndarray):
        return clean(value.tolist())
    if isinstance(value, np.generic):
        return clean(value.item())
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def number(p, key, default, minimum=None, maximum=None, integer=False):
    v = p.get(key, default)
    require(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v), f"参数 {key} 必须是有限数字")
    require(not integer or int(v) == v, f"参数 {key} 必须是整数")
    require(minimum is None or v >= minimum, f"参数 {key} 不能小于 {minimum}")
    require(maximum is None or v <= maximum, f"参数 {key} 不能大于 {maximum}")
    return int(v) if integer else float(v)


def p_adjust(values, method="none"):
    p = np.asarray(values, dtype=float)
    require(method in ("none", "BH", "holm", "bonferroni", "BY"), "P 值校正只支持 none/BH/BY/holm/bonferroni")
    if not len(p) or method == "none":
        return p
    if method in ("BH", "BY"):
        return stats.false_discovery_control(p, method=method.lower())
    if method == "bonferroni":
        return np.minimum(1, p * len(p))
    order = np.argsort(p, kind="stable")
    adjusted = np.minimum(1, np.maximum.accumulate(p[order] * np.arange(len(p), 0, -1)))
    result = np.empty_like(p)
    result[order] = adjusted
    return result


def distances(x, method="euclidean", p=2):
    require(method in DISTANCES, f"不支持距离方法 {method}")
    require(2 <= len(x) <= 2000, "距离计算需要 2～2000 个样本")
    if method in BINARY:
        require(np.all((x == 0) | (x == 1)), f"{method} 距离需要 0/1 数据")
    if method in ("braycurtis", "jensenshannon"):
        require(np.all(x >= 0) and np.all(x.sum(axis=1) > 0), f"{method} 距离要求非负数据，且每行总和大于零")
    if method == "correlation":
        require(np.all(x.std(axis=1) > 0), "相关距离不能包含常量行")
    if method == "cosine":
        require(np.all(np.linalg.norm(x, axis=1) > 0), "余弦距离不能包含全零行")
    kwargs = {}
    actual = {"matching": "hamming", "sokalmichener": "rogerstanimoto"}.get(method, method)
    if method == "minkowski":
        require(p >= 1, "Minkowski 的 p 必须至少为 1")
        kwargs["p"] = p
    if method == "seuclidean":
        v = x.var(axis=0, ddof=1)
        require(np.all(v > 0), "标准化欧氏距离存在零方差列")
        kwargs["V"] = v
    if method == "mahalanobis":
        cov = np.atleast_2d(np.cov(x, rowvar=False, ddof=1))
        require(np.linalg.matrix_rank(cov) == cov.shape[0], "马氏距离的协方差矩阵不可逆，请删除重复或共线变量")
        kwargs["VI"] = np.linalg.inv(cov)
    if method in ("kulsinski", "kulczynski1"):
        def legacy(u, v):
            n11 = np.count_nonzero((u == 1) & (v == 1))
            mismatch = np.count_nonzero(u != v)
            if method == "kulsinski":
                return (mismatch - n11 + len(u)) / (mismatch + len(u))
            require(mismatch > 0, "Kulczynski1 存在不相异的样本对，分母为零")
            return n11 / mismatch
        actual = legacy
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        result = distance.pdist(x, metric=actual, **kwargs)
    require(np.isfinite(result).all(), f"{method} 对这些数据产生未定义距离，请检查全零行及分母")
    return distance.squareform(result)


def descriptive(payload):
    x, ids, names = matrix(payload, allow_missing=True)
    out = []
    for j, name in enumerate(names):
        a = x[:, j][np.isfinite(x[:, j])]
        require(len(a) > 0, f"“{name}”列没有有效数字")
        q1, med, q3 = np.quantile(a, [.25, .5, .75], method="linear")
        iqr = q3 - q1
        inner = a[(a >= q1 - 1.5 * iqr) & (a <= q3 + 1.5 * iqr)]
        out.append({"name": name, "n": len(a), "missing": len(x)-len(a), "mean": a.mean(), "sd": a.std(ddof=1) if len(a)>1 else None,
                    "se": a.std(ddof=1)/np.sqrt(len(a)) if len(a)>1 else None, "min": a.min(), "q1": q1, "median": med, "q3": q3, "max": a.max(),
                    "lowerWhisker": inner.min(), "upperWhisker": inner.max(), "outliers": a[(a < q1-1.5*iqr)|(a > q3+1.5*iqr)]})
    return {"columns": out, "quantileMethod": "linear/type7", "sdDof": 1}


def density(payload):
    x, _, names = matrix(payload, allow_missing=True)
    p = payload["params"]
    count = number(p, "points", 256, 32, 2048, True)
    bandwidth = p.get("bandwidth", "scott")
    if not isinstance(bandwidth, str):
        bandwidth = number(p, "bandwidth", 1, 1e-6, 100)
    else:
        require(bandwidth in ("scott", "silverman"), "带宽方法必须为 scott、silverman 或正数")
    out = []
    for j, name in enumerate(names):
        a = x[:, j][np.isfinite(x[:, j])]
        require(len(a) >= 2 and np.ptp(a) > 0, f"“{name}”列至少需要两个不相同的值才能估计密度")
        require(len(a) <= 20000, "单列 KDE 最多支持 20000 个观测")
        kde = stats.gaussian_kde(a, bw_method=bandwidth)
        grid = np.linspace(a.min(), a.max(), count) if p.get("trim", True) else np.linspace(a.min()-3*np.std(a), a.max()+3*np.std(a), count)
        bins = number(p, "bins", 30, 2, 200, True)
        freq, edges = np.histogram(a, bins=bins)
        out.append({"name": name, "x": grid, "density": kde(grid), "bandwidthFactor": kde.factor, "histogram": {"counts": freq, "edges": edges}})
    return {"columns": out, "kernel": "gaussian"}


def correlation(payload):
    ts = payload["data"]["tables"]
    require(len(ts) in (1, 2), "相关分析需要一张或两张数据表")
    p = payload["params"]
    x, xi, xn = numeric(ts[0], id_column=0)
    y, yi, yn = numeric(ts[-1], id_column=0)
    require(len(xn)*len(yn) <= 40000, "相关结果最多支持 40000 个变量组合，请减少变量数")
    if len(ts) == 2:
        x, y = align(x, xi, y, yi)
    require(len(x) >= 3, "相关分析至少需要 3 个配对观测")
    require(np.all(x.std(axis=0) > 0) and np.all(y.std(axis=0) > 0), "相关分析不能包含常量列")
    method = p.get("correlation", "pearson")
    method = {"pearsonr": "pearson", "spearmanr": "spearman", "kendalltau": "kendall"}.get(method, method)
    require(method in ("pearson", "spearman", "kendall"), "相关方法必须为 Pearson、Spearman 或 Kendall")
    alternative = p.get("alternative", "two-sided")
    require(alternative in ("two-sided", "less", "greater"), "检验方向参数无效")
    r = np.empty((len(xn), len(yn))); pv = np.empty_like(r)
    for i in range(len(xn)):
        for j in range(len(yn)):
            if method == "pearson":
                obj = stats.pearsonr(x[:, i], y[:, j], alternative=alternative)
            elif method == "spearman":
                obj = stats.spearmanr(x[:, i], y[:, j], alternative=alternative)
            else:
                obj = stats.kendalltau(x[:, i], y[:, j], alternative=alternative, method="asymptotic")
            r[i, j], pv[i, j] = obj.statistic, obj.pvalue
    # For a symmetric matrix, a hypothesis appears only once and diagonal is not tested.
    mask = np.triu(np.ones_like(pv, dtype=bool), 1) if len(ts) == 1 else np.ones_like(pv, dtype=bool)
    adjusted = p_adjust(pv[mask], p.get("pAdjust", "none"))
    q = np.ones_like(pv); q[mask] = adjusted
    if len(ts) == 1:
        q = np.triu(q, 1) + np.triu(q, 1).T
        np.fill_diagonal(pv, 1); np.fill_diagonal(q, 1)
    return {"rowLabels": xn, "columnLabels": yn, "r": r, "p": pv, "adjustedP": q, "n": len(x), "correlation": method, "hypothesisCount": int(mask.sum()), "pAdjust": p.get("pAdjust", "none")}


def tests(payload):
    x, ids, names = matrix(payload, allow_missing=True)
    p = payload["params"]
    method = p.get("test", "ttest_ind")
    require(method in ("ttest_ind", "ttest_rel", "wilcoxon_ind", "wilcoxon_rel", "wilcoxon_rank_sum", "anova"), "未知检验方法")
    require(len(names) >= 2, "检验至少需要两列分组数据")
    alternative = p.get("alternative", "two-sided")
    require(alternative in ("two-sided", "less", "greater"), "检验方向参数无效")
    if method == "anova":
        groups = [c[np.isfinite(c)] for c in x.T]
        require(all(len(c) >= 2 for c in groups), "方差分析每组至少需要两个观测")
        obj = stats.f_oneway(*groups)
        require(np.isfinite(obj.statistic) and np.isfinite(obj.pvalue), "方差分析数据没有可估计的组内方差")
        return {"comparisons": [{"groups": names, "statistic": obj.statistic, "p": obj.pvalue}], "test": method}
    mode = p.get("comparisons", "all")
    require(mode in ("all", "first"), "比较范围必须为 all 或 first")
    pairs = [(i, j) for i in range(len(names)) for j in range(i+1, len(names)) if mode == "all" or i == 0]
    require(len(pairs) <= 5000, "两两检验最多支持 5000 组比较，请减少分组数")
    out = []
    for i, j in pairs:
        a, b = x[:, i], x[:, j]
        paired = method in ("ttest_rel", "wilcoxon_rel")
        if paired:
            require(np.array_equal(np.isfinite(a), np.isfinite(b)), f"“{names[i]}”与“{names[j]}”存在未配对的观测，请检查样本 ID 所在行")
        a, b = a[np.isfinite(a)], b[np.isfinite(b)]
        require(len(a) >= 2 and len(b) >= 2, "每个比较组至少需要两个有效观测")
        if method == "ttest_ind":
            obj = stats.ttest_ind(a, b, equal_var=p.get("equalVariance", False), alternative=alternative)
        elif method == "ttest_rel":
            obj = stats.ttest_rel(a, b, alternative=alternative)
        elif method == "wilcoxon_ind":
            obj = stats.mannwhitneyu(a, b, method="asymptotic", use_continuity=True, alternative=alternative)
        elif method == "wilcoxon_rank_sum":
            require(len(np.unique(np.r_[a, b])) == len(a)+len(b), "秩和正态近似不处理并列值，请改用 Mann–Whitney 检验")
            obj = stats.ranksums(a, b, alternative=alternative)
        else:
            require(np.any(a != b), "全部配对差值为零，无法执行符号秩检验")
            obj = stats.wilcoxon(a, b, zero_method="wilcox", correction=True, method="approx", alternative=alternative)
        require(np.isfinite(obj.statistic) and np.isfinite(obj.pvalue), f"“{names[i]}”与“{names[j]}”无法得到有限检验结果，请检查零方差")
        out.append({"left": names[i], "right": names[j], "nLeft": len(a), "nRight": len(b), "statistic": obj.statistic, "p": obj.pvalue, "meanDifference": a.mean()-b.mean()})
    adjusted = p_adjust([c["p"] for c in out], p.get("pAdjust", "none"))
    for item, q in zip(out, adjusted):
        item["adjustedP"] = q
    return {"comparisons": out, "test": method, "pAdjust": p.get("pAdjust", "none"), "alternative": alternative}


def matrix_operation(payload):
    x, ids, names = matrix(payload)
    p, method = payload["params"], payload["method"]
    x, diagnostics = standardize(x, p.get("standardization", "None"), p.get("direction", "column"))
    if method == "standardize":
        return {"values": x, "rowLabels": ids, "columnLabels": names, "diagnostics": diagnostics}
    if method == "pca":
        require(min(x.shape) >= 2 and np.any(x.std(axis=0) > 0), "PCA 至少需要两个样本及两列数据，且不能全部为常量")
        pca = PCA(svd_solver="full").fit(x)
        return {"scores": pca.transform(x), "loadings": pca.components_.T, "eigenvalues": pca.explained_variance_, "explainedRatio": pca.explained_variance_ratio_, "rowLabels": ids, "columnLabels": names, "center": pca.mean_, "diagnostics": diagnostics}
    metric = p.get("distance", "euclidean")
    power = number(p, "minkowskiP", 2, 1, 20)
    axis = p.get("axis", "row")
    require(axis in ("row", "column", "both"), "计算轴必须是 row、column 或 both")
    out = {"diagnostics": diagnostics, "distance": metric, "values": x, "rowLabels": ids, "columnLabels": names}
    for current in (("row", "column") if axis == "both" else (axis,)):
        values, labels = (x, ids) if current == "row" else (x.T, names)
        d = distances(values, metric, power)
        part = {"labels": labels, "distances": d}
        if method == "cluster":
            linkage = p.get("linkage", "complete")
            require(linkage in ("single", "complete", "average", "weighted", "centroid", "median", "ward"), "未知层次聚类方法")
            require(linkage not in ("centroid", "median", "ward") or metric == "euclidean", "centroid、median 和 ward 聚类仅接受欧氏距离")
            z = hierarchy.linkage(distance.squareform(d, checks=False), method=linkage, optimal_ordering=False)
            part.update({"linkage": z, "order": hierarchy.leaves_list(z), "method": linkage})
        out[current] = part
    return out


def gc(payload):
    text = payload["data"].get("sequences") or ""
    require(text.strip().startswith(">"), "请提供 FASTA 格式序列，以 >序列名 开头")
    sequences = {}; current = None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            current = line[1:].split()[0] if line[1:].split() else ""
            require(current and current not in sequences, "FASTA 序列名称为空或重复")
            sequences[current] = []
        else:
            require(current is not None, "FASTA 序列前缺少名称行")
            seq = line.upper()
            require(all(c in "ACGTRYSWKMBDHVN-" for c in seq), f"序列 {current} 含非 DNA 字符")
            sequences[current].append(seq)
    p = payload["params"]
    wc = number(p, "contentWindow", 2000, 1, 1000000, True)
    ws = number(p, "skewWindow", 2000, 1, 1000000, True)
    total = sum(sum(map(len, parts)) for parts in sequences.values())
    require(total / wc + total / ws <= 100000, "GC 输出窗口超过 10 万个，请增加窗口大小")
    def windows(seq, size, skew):
        out = []
        for start in range(0, len(seq), size):
            s = seq[start:start+size]; g=s.count("G"); c=s.count("C"); valid=sum(s.count(v) for v in "ACGT")
            denominator = g+c if skew else valid
            value = ((g-c) if skew else 100*(g+c))/denominator if denominator else None
            out.append({"start": start+1, "end": start+len(s), "value": value, "validBases": valid})
        return out
    result = []
    for name, parts in sequences.items():
        seq = "".join(parts)
        require(bool(seq), f"序列 {name} 为空")
        result.append({"name": name, "length": len(seq), "gcContent": windows(seq,wc,False), "gcSkew": windows(seq,ws,True)})
    return {"sequences": result, "windowStep": "window-size", "coordinateSystem": "1-based-inclusive", "ambiguousBases": "excluded-from-denominator", "emptyDenominator": "null"}


def run_analysis(payload):
    method = payload["method"]
    require(method in METHODS, f"未知分析方法：{method}", "UNKNOWN_METHOD")
    payload = {**payload, "params": {"seed": 1, **DEFAULTS.get(method, {}), **payload.get("params", {})}}
    p = payload["params"]
    for name in ("equalVariance", "trim"):
        if name in p:
            require(type(p[name]) is bool, f"参数 {name} 必须为布尔值")
    seed = number(payload["params"], "seed", 1, 0, 2147483647, True)
    caught = []
    with warnings.catch_warnings(record=True) as seen:
        warnings.simplefilter("always")
        if method in R_METHODS:
            from .r_bridge import run_r
            result = run_r(payload)
            if method.startswith("mantel"):
                env = [t for t in payload["data"]["tables"] if t.get("role") == "environment"]
                require(len(env) == 1, "Mantel 需要一份环境表")
                result["environmentCorrelation"] = correlation({"data": {"tables": env}, "params": {"correlation": "pearson", "pAdjust": payload["params"].get("pAdjust", "none")}})
        elif method in ("standardize", "distance", "cluster", "pca"):
            result = matrix_operation(payload)
        else:
            result = {"descriptive": descriptive, "density": density, "correlation": correlation, "tests": tests, "gc": gc}[method](payload)
        caught = [{"code": type(w.message).__name__, "message": "计算产生数值或方法学提示，请检查样本量、并列值和数据分布"} for w in seen]
    versions = {name: importlib.metadata.version(name) for name in ("numpy", "scipy", "scikit-learn")}
    provenance = {"engine": "R" if method in R_METHODS else "Python", "method": method, "methodVersion": "openacad-1", "python": platform.python_version(), "packages": versions, "seed": seed,
                  "inputSha256": hashlib.sha256(json.dumps(payload["data"], sort_keys=True, ensure_ascii=False).encode()).hexdigest(), "parameters": payload["params"]}
    if isinstance(result, dict) and "provenance" in result:
        provenance.update(result.pop("provenance"))
    return clean({"schemaVersion": 1, "method": method, "data": result, "provenance": provenance, "diagnostics": caught + result.pop("diagnostics", [])})
