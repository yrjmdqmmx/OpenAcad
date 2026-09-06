import numpy as np
from .errors import AnalysisError, require


def table(payload, role=None):
    tables = payload["data"].get("tables", [])
    matches = [t for t in tables if t.get("role") == role] if role else tables
    require(bool(matches), f"缺少{role or '主'}数据表")
    require(len(matches) == 1, "该分析只接受一份主数据表，请合并或选择需要分析的数据表")
    return matches[0]


def column_index(t, value, default=None):
    if value is None:
        return default
    if isinstance(value, str):
        require(value in t["columns"], f"缺少“{value}”列", table=t["id"], column=value)
        return t["columns"].index(value)
    require(isinstance(value, int) and not isinstance(value, bool) and 0 <= value < len(t["columns"]), "列索引超出范围")
    return value


def numeric(t, *, id_column=0, columns=None, allow_missing=False):
    idx = list(range(len(t["columns"]))) if columns is None else [column_index(t, c) for c in columns]
    idx = [i for i in idx if i != id_column]
    require(len(set(idx)) == len(idx), "所选数值列不能重复", table=t["id"])
    require(bool(idx), "至少需要一列数值", table=t["id"])
    ids = [str(row[id_column]).strip() for row in t["rows"]] if id_column is not None else [str(i + 1) for i in range(len(t["rows"]))]
    require(all(ids) and all(x != "None" for x in ids), "样本 ID 不能为空", table=t["id"])
    require(len(set(ids)) == len(ids), "样本 ID 重复，请使用唯一 ID", table=t["id"])
    values = []
    for r, row in enumerate(t["rows"]):
        result = []
        for i in idx:
            cell = row[i]
            if cell is None or (isinstance(cell, str) and not cell.strip()):
                if allow_missing:
                    result.append(np.nan)
                    continue
                raise AnalysisError(f"第 {r+2} 行“{t['columns'][i]}”列为空", table=t["id"], row=r+2, column=t["columns"][i])
            try:
                value = float(cell)
            except (ValueError, TypeError):
                raise AnalysisError(f"第 {r+2} 行“{t['columns'][i]}”列不是数字：{str(cell)[:60]}", table=t["id"], row=r+2, column=t["columns"][i])
            require(np.isfinite(value), f"第 {r+2} 行“{t['columns'][i]}”列必须是有限数字", table=t["id"], row=r+2, column=t["columns"][i])
            require(abs(value) <= 1e150, f"第 {r+2} 行“{t['columns'][i]}”列数值过大，请先调整计量单位", table=t["id"], row=r+2, column=t["columns"][i])
            result.append(value)
        values.append(result)
    return np.asarray(values, dtype=float), ids, [t["columns"][i] for i in idx]


def matrix(payload, role=None, allow_missing=False):
    t = table(payload, role)
    p = payload.get("params", {})
    id_col = column_index(t, p.get("idColumn", 0), 0)
    return numeric(t, id_column=id_col, columns=p.get("columns"), allow_missing=allow_missing)


def align(x, xi, y, yi):
    require(set(xi) == set(yi), "两份数据的样本 ID 不一致，请补齐或删除不匹配的样本")
    lookup = {v: i for i, v in enumerate(yi)}
    return x, y[[lookup[v] for v in xi]]


def standardize(x, method="None", direction="column"):
    require(direction in ("row", "column"), "标准化方向必须是 row 或 column")
    require(method in ("None", "StandardScaler", "MinMaxScaler", "MaxAbsScaler", "RobustScaler", "PercentScaler"), "未知标准化方法")
    a = x.copy()
    if method == "None":
        return a, []
    axis = 0 if direction == "column" else 1
    warnings = []
    if method == "PercentScaler":
        require(np.all(a >= 0), "百分比标准化只接受非负数据")
        den = a.sum(axis=axis, keepdims=True)
        require(np.all(den > 0), "百分比标准化存在总和为零的行或列")
        return 100 * a / den, warnings
    if method == "StandardScaler":
        center, den = a.mean(axis=axis, keepdims=True), a.std(axis=axis, ddof=0, keepdims=True)
    elif method == "MinMaxScaler":
        center = a.min(axis=axis, keepdims=True)
        den = a.max(axis=axis, keepdims=True) - center
    elif method == "MaxAbsScaler":
        center, den = 0, np.abs(a).max(axis=axis, keepdims=True)
    else:
        center = np.median(a, axis=axis, keepdims=True)
        q = np.quantile(a, [.25, .75], axis=axis, keepdims=True, method="linear")
        den = q[1] - q[0]
    if np.any(den == 0):
        warnings.append({"code": "ZERO_SCALE", "message": "部分行或列的缩放尺度为零，已按尺度 1 处理"})
    return (a - center) / np.where(den == 0, 1, den), warnings
