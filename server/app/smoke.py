"""Exercise a running API and real RQ worker without printing capabilities."""
import math
import os
import time
import httpx


def main():
    client = httpx.Client(base_url=os.getenv("OPENACAD_API_URL", "http://127.0.0.1:8000"), timeout=10)
    assert client.get("/api/health").status_code == 200
    completed = []
    for method in ("pca", "lm", "invalid-cell"):
        payload = {"kind":"analysis", "method":method, "data":{"tables":[{"id":"smoke", "role":"matrix", "columns":["样本", "x", "y"], "rows":[[f"样本{i}", i, 2*i+3+math.sin(i)*.1] for i in range(12)]}]}, "params":{}}
        if method == "invalid-cell":
            payload["method"] = "pca"
            payload["data"]["tables"][0]["rows"][2][1] = "非数字"
        response = client.post("/api/jobs", json=payload)
        assert response.status_code == 202, response.text
        task = response.json(); path = "/api/jobs/" + task["id"]
        headers = {"Authorization": "Bearer " + task["token"]}
        assert client.get(path).status_code == 404
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            state = client.get(path, headers=headers).json()
            if state["status"] in ("finished", "failed"):
                break
            time.sleep(.2)
        if method == "invalid-cell":
            assert state["status"] == "failed" and state["error"]["row"] == 4 and state["error"]["column"] == "x"
        else:
            assert state["status"] == "finished", state
            assert state["result"]["data"].get("scores") or state["result"]["data"].get("series")
        assert client.delete(path, headers=headers).status_code == 200
        assert client.get(path, headers=headers).status_code == 404
        completed.append(method)
    print("真实 Redis/RQ/API 完成：健康状态、随机凭证、PCA、R 回归、查询、删除与撤销凭证；" + ",".join(completed))


if __name__ == "__main__":
    main()
