import datetime as dt
import hmac
import json
import os
import secrets
from pathlib import Path
from uuid import UUID, uuid4
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from rq import Worker
from rq.command import send_stop_job_command
from rq.exceptions import NoSuchJobError, InvalidJobOperation
from rq.job import Job
from rq.serializers import JSONSerializer
from rq.results import Result
from .jobs import connection, queue, digest
from .models import JobRequest
from .worker_health import fresh_workers

app = FastAPI(title="OpenAcad 开放学术", version="1.0.0", docs_url=None, redoc_url=None)
TTL = int(os.getenv("JOB_TTL_SECONDS", "3600"))
TIMEOUT = int(os.getenv("JOB_TIMEOUT_SECONDS", "300"))


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    errors = []
    for e in error.errors():
        errors.append({"field": ".".join(str(x) for x in e["loc"]), "message": str(e.get("ctx", {}).get("error", "字段缺失、格式不正确或超出允许范围"))})
    return JSONResponse(status_code=422, content={"error": {"code": "INVALID_REQUEST", "message": "请检查请求字段", "fields": errors}})


@app.exception_handler(RedisError)
async def redis_error(request, error):
    return JSONResponse(status_code=503, content={"error": {"code": "QUEUE_UNAVAILABLE", "message": "任务队列暂时不可用，请稍后重试"}})


@app.middleware("http")
async def bounded_body(request: Request, call_next):
    if request.method == "POST":
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 25_000_000:
                return JSONResponse(status_code=413, content={"error": {"code": "TOO_LARGE", "message": "请求不能超过 25 MB，请减少数据量"}})
        request._body = bytes(body)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    try:
        conn = connection()
        conn.ping()
        workers = fresh_workers(conn)
        ready = len(workers) > 0
        return JSONResponse(status_code=200 if ready else 503, content={"status": "ok" if ready else "degraded", "queue": True, "workers": len(workers), "message": "服务正常" if ready else "计算进程尚未就绪"})
    except RedisError:
        return JSONResponse(status_code=503, content={"status": "degraded", "queue": False, "workers": 0, "message": "任务队列暂时不可用"})


@app.post("/api/jobs", status_code=202)
def submit(payload: JobRequest):
    if Path(os.getenv("OPENACAD_MAINTENANCE_FILE", "/run/openacad/maintenance")).exists():
        raise HTTPException(status_code=503, detail="网站正在更新，暂时不接收新任务；已有任务仍可查看和取消，请稍后重试")
    conn = connection()
    if queue(conn).count >= 100:
        raise HTTPException(status_code=503, detail="当前等待任务过多，请稍后重试")
    job_id, token = str(uuid4()), secrets.token_urlsafe(32)
    now = dt.datetime.now(dt.timezone.utc)
    expires = (now + dt.timedelta(seconds=TTL)).isoformat()
    key = f"openacad:cap:{job_id}"
    conn.set(key, json.dumps({"hash": digest(token), "createdAt": now.isoformat(), "expiresAt": expires}), ex=TTL)
    try:
        queue(conn).enqueue("app.jobs.execute", payload.model_dump(), job_id=job_id, description="OpenAcad 统计任务" if payload.kind == "analysis" else "OpenAcad 图片导出", job_timeout=TIMEOUT, ttl=TTL, result_ttl=TTL, failure_ttl=TTL)
    except Exception:
        conn.delete(key)
        raise
    return {"id": job_id, "token": token, "status": "queued", "expiresAt": expires}


def authorized(job_id, request):
    missing = HTTPException(status_code=404, detail="任务不存在、已过期或访问凭证不正确")
    try:
        UUID(job_id)
    except ValueError:
        raise missing
    token = request.headers.get("Authorization", "")
    if not token.startswith("Bearer "):
        raise missing
    conn = connection()
    raw = conn.get(f"openacad:cap:{job_id}")
    if raw is None:
        raise missing
    meta = json.loads(raw)
    if not hmac.compare_digest(meta["hash"], digest(token[7:])):
        raise missing
    try:
        job = Job.fetch(job_id, connection=conn, serializer=JSONSerializer)
    except NoSuchJobError:
        raise missing
    return conn, job, meta


@app.get("/api/jobs/{job_id}")
def status(job_id: str, request: Request):
    conn, job, meta = authorized(job_id, request)
    state = job.get_status(refresh=True).value
    output = {"id": job_id, "status": state, "createdAt": meta["createdAt"], "expiresAt": meta["expiresAt"]}
    if state == "finished":
        result = job.return_value()
        if result and result.get("ok"):
            output["result"] = result["result"]
        else:
            output.update(status="failed", error=(result or {}).get("error", {"code": "NO_RESULT", "message": "任务未返回结果，请重试"}))
    elif state in ("failed", "stopped"):
        output.update(status="failed", error={"code": "WORKER_FAILED", "message": "任务中断或超时，请减少数据量后重试"})
    elif state not in ("queued", "started", "canceled"):
        output["status"] = "queued"
    return output


@app.delete("/api/jobs/{job_id}")
def remove(job_id: str, request: Request):
    conn, job, meta = authorized(job_id, request)
    was_running = job.get_status(refresh=True).value == "started"
    # Revoke first: any concurrent worker persistence must honor this deletion.
    conn.delete(f"openacad:cap:{job_id}")
    if was_running:
        try:
            send_stop_job_command(conn, job_id)
        except Exception:
            pass  # Capability and persisted input/result are still revoked immediately.
    try:
        job.cancel()
        job.delete()
    except InvalidJobOperation:
        pass  # A concurrent worker may already have removed this revoked job.
    with conn.pipeline() as pipe:
        pipe.delete(job.key, job.dependents_key, job.dependencies_key, Result.get_key(job_id))
        pipe.lrem(queue(conn).key, 0, job_id)
        for registry in ("failed", "finished", "canceled"):
            pipe.zrem(f"rq:{registry}:{job.origin}", job_id)
        pipe.execute()
    return {"id": job_id, "status": "canceled"}
