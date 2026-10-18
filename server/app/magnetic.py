"""Bounded correlation imaging adapted from the supplied step_w7_corrimaging.py.

Only this installed implementation is executable; uploaded inputs are data.
Positive depth is downward, bathy_m is elevation (negative below sea level).
The correlation is a signed shape similarity, not an occurrence probability.
"""
import math

import harmonica as hm
import numpy as np
from pyproj import Geod
from scipy.ndimage import gaussian_filter

from .errors import require

DEFAULTS = {
    "axis_len": 390.0, "inc": 33.8, "dec": -2.5, "scan_dx": 5.0,
    "scan_z0": 2.5, "scan_z1": 25.0, "scan_dz": 1.0, "th_km": 4.0,
    "win_km": 90.0, "min_pts": 25, "strike_ext_km": 500.0, "smooth": 1.2,
}
BOUNDS = {
    "axis_len": (1, 2000), "inc": (-90, 90), "dec": (-180, 180),
    "scan_dx": (.25, 100), "scan_z0": (.1, 100), "scan_z1": (.1, 100),
    "scan_dz": (.25, 20), "th_km": (.1, 50), "win_km": (1, 2000),
    "min_pts": (3, 5000), "strike_ext_km": (1, 2000), "smooth": (0, 5),
}


def finite_number(value, label, minimum=None, maximum=None):
    require(isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value), f"{label} 必须是有限数字")
    require(minimum is None or value >= minimum, f"{label} 不能小于 {minimum}")
    require(maximum is None or value <= maximum, f"{label} 不能大于 {maximum}")
    return float(value)


def parameters(raw):
    require(isinstance(raw, dict), "成像参数必须为对象")
    # seed is injected by the common analysis pipeline and is not used here.
    require(not (set(raw) - set(DEFAULTS) - {"seed"}), "包含未知磁异常成像参数")
    p = {k: finite_number(raw.get(k, v), f"参数 {k}", *BOUNDS[k]) for k, v in DEFAULTS.items()}
    require(p["min_pts"].is_integer(), "参数 min_pts 必须是整数")
    p["min_pts"] = int(p["min_pts"])
    require(p["scan_dx"] <= p["axis_len"], "扫描间距不能超过剖面长度")
    require(p["scan_z1"] >= p["scan_z0"], "最大扫描深度不能小于最小扫描深度")
    require(p["scan_z0"] - p["th_km"] / 2 >= .1 - 1e-12,
            "棱柱顶面须位于海平面以下至少 0.1 km，请增加最小扫描深度或减小厚度")
    return p


def rows(data, key, fields, limits, minimum):
    value = data.get(key)
    require(isinstance(value, list) and minimum <= len(value) <= 20000,
            f"{key} 需要 {minimum}～20000 行数据")
    result = []
    for index, row in enumerate(value):
        require(isinstance(row, dict) and all(k in row for k in fields),
                f"{key} 第 {index + 2} 行缺少列：{', '.join(fields)}")
        result.append([finite_number(row[k], f"{key} 第 {index + 2} 行 {k}", *limit)
                       for k, limit in zip(fields, limits)])
    array = np.asarray(result)
    require(len(np.unique(array[:, 0])) == len(array), f"{key} 距离列不能重复")
    require(np.all(np.diff(array[:, 0]) > 0), f"{key} 距离列必须严格递增")
    return array


def track_bearing(track):
    require(isinstance(track, dict), "请提供测线位置 JSON")
    name = track.get("name")
    require(isinstance(name, str) and 1 <= len(name.strip()) <= 100, "测线名称需要 1～100 个字符")
    poly = track.get("poly")
    require(isinstance(poly, list) and 2 <= len(poly) <= 1000, "测线 poly 需要 2～1000 个经纬度坐标")
    coords = []
    for index, point in enumerate(poly):
        require(isinstance(point, (list, tuple)) and len(point) == 2,
                f"测线坐标 {index + 1} 必须是 [经度, 纬度]")
        coords.append((finite_number(point[0], "经度", -180, 180),
                       finite_number(point[1], "纬度", -90, 90)))
    bearing, _, length = Geod(ellps="WGS84").inv(*coords[0], *coords[-1])
    require(math.isfinite(bearing) and length >= 1, "测线首尾位置不能重合（间距须至少 1 m）")
    return bearing % 360.0


def prism_response(xobs_km, x0_km, z0_km, p, beta):
    """Original sea-level 2.5D prism response, 1 A/m induced magnetization."""
    inc, delta = np.deg2rad(p["inc"]), np.deg2rad(p["dec"] - beta)
    fe, fn, fu = np.cos(inc) * np.cos(delta), np.cos(inc) * np.sin(delta), -np.sin(inc)
    half, strike = p["scan_dx"] * 500, p["strike_ext_km"] * 1000
    bottom, top = -(z0_km + p["th_km"] / 2) * 1000, -(z0_km - p["th_km"] / 2) * 1000
    prism = [x0_km * 1000 - half, x0_km * 1000 + half, -strike, strike, bottom, top]
    xobs = np.asarray(xobs_km, dtype=float) * 1000
    zeros = np.zeros_like(xobs)
    magnetization = tuple(np.array([value]) for value in (fe, fn, fu))
    # Thousands of small calls are faster without per-call parallel scheduling.
    be, bn, bu = hm.prism_magnetic((xobs, zeros, zeros), [prism], magnetization,
                                    field="b", parallel=False)
    return be * fe + bn * fn + bu * fu


def smooth_valid_segments(values, sigma):
    """Normalize by valid support, keep holes null, never bridge invalid columns."""
    if sigma <= 0:
        return values.copy()
    result = values.copy()
    valid_columns = np.isfinite(values).any(axis=0)
    boundaries = np.flatnonzero(np.diff(np.r_[False, valid_columns, False]))
    for start, end in zip(boundaries[::2], boundaries[1::2]):
        block = values[:, start:end]
        valid = np.isfinite(block)
        numerator = gaussian_filter(np.where(valid, block, 0.0), sigma, mode="reflect")
        denominator = gaussian_filter(valid.astype(float), sigma, mode="reflect")
        result[:, start:end] = np.where(valid, numerator / np.maximum(denominator, 1e-30), np.nan)
    return result


def magnetic_correlation(payload):
    p = parameters(payload.get("params", {}))
    data = payload.get("data")
    require(isinstance(data, dict), "成像输入必须包含三份数据")
    curve = rows(data, "curve", ("dist_km", "mag_nT"), ((0, 2000), (-1e7, 1e7)), 3)
    profile = rows(data, "profile", ("s_km", "bathy_m", "basement_km"),
                   ((0, 10000), (-15000, 10000), (0, 100)), 2)
    require(profile[-1, 0] > 0, "地形数据的累计距离必须大于零")
    require(profile[-1, 0] <= p["axis_len"] + 1e-9, "海底和基底数据的距离超过剖面长度，请增大 axis_len")
    require(np.all(profile[:, 2] + 1e-9 >= np.maximum(0, -profile[:, 1] / 1000)),
            "磁性基底深度不能位于海底上方，请检查 bathy_m（海底高程，m）和 basement_km（向下深度，km）")
    require(curve[-1, 0] <= p["axis_len"] + 1e-9, "磁异常曲线的距离超过剖面长度，请增大 axis_len")
    beta = track_bearing(data.get("track"))
    xs = np.arange(p["scan_dx"] / 2, p["axis_len"], p["scan_dx"])
    zs = np.arange(p["scan_z0"], p["scan_z1"] + 1e-6, p["scan_dz"])
    require(xs.size * zs.size <= 12000, "扫描网格最多 12000 个节点，请增大扫描间距")
    xo, yo = curve.T
    left = np.searchsorted(xo, xs - p["win_km"] / 2, side="left")
    right = np.searchsorted(xo, xs + p["win_km"] / 2, side="right")
    counts = right - left
    require(int(counts.sum()) * zs.size <= 5000000,
            "计算规模超过 500 万个观测点与棱柱组合，请减少数据、缩小窗口或增大扫描间距")
    values = np.full((zs.size, xs.size), np.nan)
    constant_columns = 0
    for ix, x0 in enumerate(xs):
        if counts[ix] < p["min_pts"]:
            continue
        index = slice(left[ix], right[ix])
        observed = yo[index]
        if np.std(observed) < 1e-6:
            constant_columns += 1
            continue
        for iz, z0 in enumerate(zs):
            modeled = prism_response(xo[index], x0, z0, p, beta)
            if np.all(np.isfinite(modeled)) and np.std(modeled) >= 1e-9:
                values[iz, ix] = np.corrcoef(modeled, observed)[0, 1]
    valid = np.isfinite(values)
    require(valid.any(), "没有可计算的相关系数：请检查观测点数、窗口宽度、常量曲线与地磁方向", "NO_VALID_CORRELATION")
    diagnostics = ["相关系数表示观测与模型异常形态的相似程度，不是磁性体存在概率；本方法采用海平面观测和均匀感应磁化假设。"]
    missing = int((~valid).sum())
    if missing:
        diagnostics.append(f"{missing} 个网格节点无有效相关系数，保留为空白；未进行最近邻填充。")
    if constant_columns:
        diagnostics.append(f"{constant_columns} 个窗口内观测值近似常量，无法计算 Pearson 相关系数。")
    if p["smooth"]:
        diagnostics.append(f"已对有效数据分段施加高斯平滑（σ={p['smooth']:g} 格）；平滑不跨越无效列。")
    diagnostics.append("海底及基底数据仅用于叠加显示，不参与正演或相关计算；上传的地质界面未做裁剪或修改。")
    return {
        "method": "magnetic-correlation", "xs": xs, "zs": zs,
        "correlation": np.clip(smooth_valid_segments(values, p["smooth"]), -1, 1),
        "bearing": beta, "params": p, "diagnostics": diagnostics,
        "windowPointCounts": counts, "validNodeCount": int(valid.sum()),
        "undefinedNodeCount": missing, "trackName": data["track"]["name"],
        "units": {"distance": "km", "depth": "km", "magneticAnomaly": "nT", "bearing": "degrees-clockwise-from-north"},
        "provenance": {"methodVersion": "openacad-magnetic-1", "parameters": p,
                       "algorithm": "step_w7_corrimaging.py: harmonic prism forward model + local Pearson correlation",
                       "missingValues": "null; no interpolation across undefined columns"},
    }
