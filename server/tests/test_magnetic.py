"""Real prism-model and missing-data tests (no mocked numerical engine)."""
import copy

import harmonica as hm
import numpy as np
import pytest

from app.analysis import run_analysis
from app.errors import AnalysisError
from app.magnetic import smooth_valid_segments, track_bearing
from app.models import JobRequest


def source_payload():
    # A vertical field, E-W survey, and a real buried prism centred at x=30,
    # z=4 km. Its own response must correlate exactly at the matching node.
    x = np.arange(0, 60.01, .5)
    zeros = np.zeros_like(x)
    _, _, bu = hm.prism_magnetic(
        (x * 1000, zeros, zeros), [[20000, 40000, -500000, 500000, -5000, -3000]],
        (np.array([0.0]), np.array([0.0]), np.array([-1.0])), field="b", parallel=False,
    )
    return {"kind": "analysis", "method": "magnetic-correlation", "data": {
        "curve": [{"dist_km": float(a), "mag_nT": float(b)} for a, b in zip(x, -bu)],
        "profile": [{"s_km": 0, "bathy_m": -100, "basement_km": 3},
                    {"s_km": 60, "bathy_m": -1000, "basement_km": 6}],
        "track": {"name": "synthetic-prism", "poly": [[120, 0], [121, 0]]},
    }, "params": {"axis_len": 60, "scan_dx": 20, "scan_z0": 2, "scan_z1": 6,
                   "scan_dz": 2, "th_km": 2, "win_km": 60, "min_pts": 10,
                   "smooth": 0, "inc": 90, "dec": 0, "strike_ext_km": 500}}


def test_real_prism_has_unit_correlation_at_true_location_and_depth():
    payload = source_payload()
    snapshot = copy.deepcopy(payload)
    JobRequest.model_validate(payload)
    result = run_analysis(payload)
    data = result["data"]
    assert data["xs"] == [10, 30, 50] and data["zs"] == [2, 4, 6]
    assert data["correlation"][1][1] == pytest.approx(1, abs=1e-12)
    assert np.unravel_index(np.nanargmax(data["correlation"]), (3, 3)) == (1, 1)
    assert data["bearing"] == pytest.approx(90)
    assert data["validNodeCount"] == 9 and data["undefinedNodeCount"] == 0
    assert result["provenance"]["packages"]["harmonica"] == "0.7.0"
    assert result["provenance"]["parameters"]["scan_dx"] == 20
    assert "概率" in "".join(note["message"] for note in result["diagnostics"])
    assert payload == snapshot  # Includes unmodified uploaded geological lines.


def test_pearson_is_signed_and_offset_scale_invariant():
    payload = source_payload()
    for row in payload["data"]["curve"]:
        row["mag_nT"] = -3 * row["mag_nT"] + 450
    data = run_analysis(payload)["data"]
    assert data["correlation"][1][1] == pytest.approx(-1, abs=1e-12)


def test_insufficient_observation_columns_stay_null_after_smoothing():
    payload = source_payload()
    payload["data"]["curve"] = [row for row in payload["data"]["curve"] if row["dist_km"] <= 20]
    payload["params"].update(axis_len=100, win_km=20, smooth=1.2)
    data = run_analysis(payload)["data"]
    assert data["windowPointCounts"] == [41, 1, 0, 0, 0]
    assert data["undefinedNodeCount"] == 12
    assert all(row[0] is not None and row[1:] == [None] * 4 for row in data["correlation"])


def test_smoothing_cannot_bridge_a_missing_column_or_fill_an_internal_hole():
    x = np.array([[1, 1, np.nan, -1, -1], [1, np.nan, np.nan, -1, -1]], float)
    y = smooth_valid_segments(x, 2)
    np.testing.assert_array_equal(np.isnan(x), np.isnan(y))
    np.testing.assert_allclose(y[np.isfinite(x) & (x > 0)], 1)
    np.testing.assert_allclose(y[np.isfinite(x) & (x < 0)], -1)


@pytest.mark.parametrize("mutation,match", [
    (lambda p: p["params"].update(scan_z0=.5), "棱柱顶面"),
    (lambda p: p["params"].update(scan_dx=True), "有限数字"),
    (lambda p: p["params"].update(inc=float("nan")), "有限数字"),
    (lambda p: p["params"].update(min_pts=3.5), "整数"),
    (lambda p: p["params"].update(code="eval(...)"), "未知"),
    (lambda p: p["params"].update(scan_dx=.25, scan_dz=.25, scan_z1=100), "12000"),
    (lambda p: p["data"]["curve"][0].update(mag_nT=float("inf")), "有限数字"),
    (lambda p: p["data"]["curve"][0].update(dist_km=.5), "不能重复"),
    (lambda p: p["data"]["curve"].reverse(), "严格递增"),
    (lambda p: p["data"].pop("profile"), "profile"),
    (lambda p: p["data"]["profile"][0].pop("basement_km"), "缺少列"),
    (lambda p: p["data"]["profile"][-1].update(s_km=61), "超过剖面长度"),
    (lambda p: p["data"]["profile"][-1].update(basement_km=.5), "海底上方"),
    (lambda p: p["data"]["track"].update(poly=[[120, 20], [120, 20]]), "首尾位置"),
    (lambda p: p["data"]["track"].update(poly=[[120, 91], [121, 20]]), "纬度"),
])
def test_invalid_physical_or_nonfinite_inputs_are_rejected(mutation, match):
    payload = source_payload()
    mutation(payload)
    with pytest.raises(AnalysisError, match=match):
        run_analysis(payload)


def test_constant_curve_is_a_failed_analysis_instead_of_a_fabricated_image():
    payload = source_payload()
    for row in payload["data"]["curve"]:
        row["mag_nT"] = 3
    with pytest.raises(AnalysisError) as error:
        run_analysis(payload)
    assert error.value.detail["code"] == "NO_VALID_CORRELATION"


def test_wgs84_bearing_cardinal_directions():
    assert track_bearing({"name": "north", "poly": [[0, 0], [0, 1]]}) == pytest.approx(0)
    assert track_bearing({"name": "west", "poly": [[0, 0], [-1, 0]]}) == pytest.approx(270)
