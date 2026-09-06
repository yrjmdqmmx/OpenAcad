import fakeredis
from fastapi.testclient import TestClient
from rq import SimpleWorker
from rq.serializers import JSONSerializer
from app import main
from app.jobs import queue
from test_analysis import payload


def test_capability_lifecycle(monkeypatch):
    conn = fakeredis.FakeRedis()
    monkeypatch.setattr(main, "connection", lambda: conn)
    client = TestClient(main.app)
    reply = client.post("/api/jobs", json=payload("pca"))
    assert reply.status_code == 202
    task = reply.json(); path = "/api/jobs/" + task["id"]
    assert client.get(path).status_code == 404
    assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 404
    auth = {"Authorization": "Bearer " + task["token"]}
    assert client.get(path, headers=auth).json()["status"] == "queued"
    SimpleWorker([queue(conn)], connection=conn, serializer=JSONSerializer).work(burst=True)
    r = client.get(path, headers=auth).json()
    assert r["status"] == "finished" and r["result"]["data"]["scores"]
    assert "token" not in r and task["token"].encode() not in conn.get("openacad:cap:"+task["id"])
    assert client.delete(path, headers=auth).status_code == 200
    assert client.get(path, headers=auth).status_code == 404


def test_schema_chinese_errors():
    client = TestClient(main.app)
    result = client.post("/api/jobs", json={"kind": "bad"})
    assert result.status_code == 422
    assert result.json()["error"]["message"] == "请检查请求字段"
