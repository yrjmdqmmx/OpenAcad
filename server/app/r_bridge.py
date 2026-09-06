import json
import os
from pathlib import Path
import shutil

import numpy as np

from .analysis import clean, distances, number
from .data import column_index, numeric, standardize
from .errors import AnalysisError, require
from .process import run_process


def run_r(payload):
    binary = os.getenv("RSCRIPT", "Rscript")
    require(shutil.which(binary) is not None, "统计运行环境尚未就绪：缺少 R 服务", "R_UNAVAILABLE")
    p, method = dict(payload["params"]), payload["method"]
    require("idColumn" not in p and "columns" not in p, "该分析请先把样本 ID 放在第一列，数值列按需映射")
    prepared, diagnostics = [], []
    tables = payload["data"].get("tables", [])
    require(bool(tables), "分析需要数据表")
    if method in ("pcoa", "nmds", "lm", "loess", "gam"):
        require(len(tables) == 1, "该分析只接受一份数据表")
    for t in tables:
        if method in ("lm", "loess", "gam"):
            require(len(t["columns"]) >= 3, "回归数据需要 ID、x、y 三列")
            x, ids, names = numeric(t, id_column=0, columns=[1, 2])
            group = column_index(t, p.get("groupColumn"), None)
            if group is not None:
                require(all(row[group] is not None and str(row[group]).strip() for row in t["rows"]), "分组列不能包含空值")
            groups = [str(row[group]) for row in t["rows"]] if group is not None else ["全部数据"]*len(x)
        else:
            x, ids, names = numeric(t, id_column=0)
            groups = None
        require(len(x) <= 2000, "该统计模块最多支持 2000 个样本")
        if method in ("pcoa", "nmds") or (method in ("cca", "rda") and t.get("role") == "response"):
            x, ds = standardize(x, p.get("standardization", "None"), p.get("direction", "column"))
            diagnostics.extend(ds)
        prepared.append({"id": t["id"], "role": t.get("role", "matrix"), "name": t.get("name", t["id"]), "values": x.tolist(), "rowLabels": ids, "columnLabels": names, "groups": groups})
    if method == "pcoa":
        require(len(prepared) == 1, "PCoA 需要一份数据")
        prepared[0]["distances"] = distances(np.array(prepared[0]["values"]), p.get("distance", "euclidean"), number(p, "minkowskiP", 2, 1, 20)).tolist()
    for name, default, low, high in [("points",200,20,1000),("dimensions",2,2,3),("try",20,1,100),("tryMax",100,1,1000),("basisDimension",10,3,50)]:
        if name in p:
            p[name] = number(p,name,default,low,high,True)
    for name, default, low, high in [("confidence",.95,.5,.999),("span",.5,.01,1),("pseudocount",0,0,1000000)]:
        if name in p:
            p[name] = number(p,name,default,low,high)
    number(p,"seed",1,0,2147483647,True)
    if method.startswith("mantel"):
        require(p.get("permutations",999) in (999,9999,99999), "置换次数必须是 999、9999 或 99999")
    request = {"method": method, "params": p, "tables": prepared}
    path = Path(__file__).resolve().parent.parent / "r" / "analyze.R"
    try:
        output, _ = run_process([binary,"--vanilla",str(path)], input=json.dumps(request,ensure_ascii=False), timeout=int(os.getenv("R_TIMEOUT_SECONDS","240")))
        result = json.loads(output)
    except FileNotFoundError:
        raise AnalysisError("统计运行环境尚未就绪", "R_UNAVAILABLE")
    except json.JSONDecodeError:
        raise AnalysisError("统计服务返回格式异常", "R_INVALID_RESPONSE")
    if "error" in result:
        raise AnalysisError(result["error"].get("message","统计计算未完成"), result["error"].get("code","STATISTICAL_ERROR"))
    result["diagnostics"] = diagnostics + result.get("diagnostics", [])
    return clean(result)
