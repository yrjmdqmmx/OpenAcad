import httpx
import pytest
from fastapi.testclient import TestClient
from app import bio

KO_RECORD = """ENTRY       K00001                      KO
PATHWAY     map00010  Glycolysis / Gluconeogenesis
            map00620  Pyruvate metabolism
            map00010  Glycolysis / Gluconeogenesis
BRITE       Enzymes [BR:ko01000]
             04131 Membrane trafficking
///
ENTRY       K00002                      KO
NAME        A real entry without a PATHWAY field in this simulated response
///
"""
PATH_RECORD = """ENTRY       map00010                    Pathway
CLASS       Metabolism; Carbohydrate metabolism
///
ENTRY       map00620                    Pathway
CLASS       Metabolism; Carbohydrate metabolism
///
"""


@pytest.fixture(autouse=True)
def clean_cache():
    bio._cache.clear()
    yield
    bio._cache.clear()


def test_records_multiple_continuations_and_invalid_responses():
    rows = bio.flat_records(KO_RECORD)
    assert len(rows["K00001"]["PATHWAY"]) == 3
    assert bio.flat_records("") == {}
    for text in ("<html>error</html>", "ENTRY       K00001 KO\n", "ENTRY       K00001 KO\n///\nerror"):
        with pytest.raises(ValueError):
            bio.flat_records(text)


def test_one_to_many_dedup_provenance_and_classification(monkeypatch):
    calls = []
    def get(path):
        calls.append(path)
        return (PATH_RECORD if "path:" in path else KO_RECORD), "2026-09-07T11:00:00Z"
    monkeypatch.setattr(bio, "fetch_kegg", get)
    data = bio.query_kos(["K00001", "K00002", "K99999"])
    first, no_path, absent = data["results"]
    assert [p["id"] for p in first["pathways"]] == ["map00010", "map00620"]
    assert first["pathways"][0]["classification"] == "Metabolism; Carbohydrate metabolism"
    assert first["pathways"][0]["classSourceUrl"].startswith("https://rest.kegg.jp/get/path:")
    assert first["fetchedAt"] == "2026-09-07T11:00:00Z"
    assert no_path["status"] == absent["status"] == "unmatched"
    assert "未列出" in no_path["message"] and "未返回" in absent["message"]
    assert len(calls) == 2
    assert bio.query_kos(["K00001"])["results"][0] == first
    assert len(calls) == 2


@pytest.mark.parametrize("error", [httpx.ConnectError("offline"), httpx.ReadTimeout("slow"), ValueError("bad body"), httpx.HTTPStatusError("limit", request=httpx.Request("GET", bio.BASE), response=httpx.Response(429))])
def test_failure_is_not_unmatched_and_previous_success_survives(monkeypatch, error):
    prior = {"ko": "K00001", "status": "matched", "pathways": [{"id": "map00010", "name": "Glycolysis"}], "sourceUrl": bio.BASE, "fetchedAt": "2026-09-07", "message": ""}
    bio.cached_put("ko:K00001", prior)
    def fail(path):
        raise error
    monkeypatch.setattr(bio, "fetch_kegg", fail)
    data = bio.query_kos(["K00001", "K00844"])
    assert data["results"][0]["status"] == "matched"
    assert data["results"][1]["status"] == "failed"
    assert data["results"][0]["pathways"][0]["name"] == "Glycolysis"
    assert data["warnings"]
    assert bio.cached_get("ko:K00844") is None


def test_auxiliary_classification_failure_retains_matches(monkeypatch):
    def get(path):
        if "path:" in path:
            raise httpx.ConnectError("offline")
        return KO_RECORD, "2026-09-07T11:00:00Z"
    monkeypatch.setattr(bio, "fetch_kegg", get)
    result = bio.query_kos(["K00001"])
    assert result["results"][0]["status"] == "matched"
    assert result["results"][0]["pathways"][0]["classification"] == ""
    assert result["warnings"]


def test_api_limits_only_ko_and_does_not_accept_arbitrary_destinations(monkeypatch):
    monkeypatch.setattr(bio, "fetch_kegg", lambda path: ("", "2026-09-07T11:00:00Z"))
    client = TestClient(bio.dev_app)
    assert client.post("/api/bio/ko-pathways", json={"ids": ["K00001"]}).status_code == 200
    for body in ({"ids": []}, {"ids": ["K00001"] * 11}, {"ids": ["../private"]}, {"ids": ["K00001"], "url": "http://localhost"}, {"ids": ["k00001"]}):
        assert client.post("/api/bio/ko-pathways", json=body).status_code == 422


def test_cache_expires_and_keeps_original_fetched_at(monkeypatch):
    clock = [0.0]
    monkeypatch.setattr(bio.time, "monotonic", lambda: clock[0])
    bio.cached_put("ko:K00001", {"fetchedAt": "old"})
    clock[0] = 10
    assert bio.cached_get("ko:K00001")["fetchedAt"] == "old"
    clock[0] = bio.TTL + 1
    assert bio.cached_get("ko:K00001") is None


def test_pacing_for_all_upstream_requests(monkeypatch):
    clock, sleeps, calls = [0.0], [], []
    monkeypatch.setattr(bio, "_next_request", 0.0)
    monkeypatch.setattr(bio.time, "monotonic", lambda: clock[0])
    def sleep(amount):
        sleeps.append(amount)
        clock[0] += amount
    monkeypatch.setattr(bio.time, "sleep", sleep)
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url):
            calls.append(clock[0])
            return httpx.Response(200, text="", request=httpx.Request("GET", url))
    monkeypatch.setattr(bio.httpx, "Client", Client)
    for _ in range(4):
        bio.fetch_kegg("get/ko:K00001")
    assert calls == [0, 0.5, 1.0, 1.5]
