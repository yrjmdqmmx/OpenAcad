import hashlib
import os
import subprocess
from redis import Redis
from rq import Queue, get_current_job
from rq.serializers import JSONSerializer
from .analysis import run_analysis
from .errors import AnalysisError


def connection():
    return Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), socket_connect_timeout=3, socket_timeout=5)


def queue(conn=None):
    return Queue("openacad", connection=conn if conn is not None else connection(), serializer=JSONSerializer)


def execute(payload):
    try:
        if payload["kind"] == "analysis":
            result = run_analysis(payload)
        else:
            from .export import render
            result = render(payload)
        return {"ok": True, "result": result}
    except AnalysisError as error:
        return {"ok": False, "error": error.detail}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": {"code": "TIMEOUT", "message": "计算超时，请减少数据量或计算次数后重试"}}
    except Exception:
        # Do not persist a traceback containing research data or expose internals.
        return {"ok": False, "error": {"code": "INTERNAL_ERROR", "message": "任务未能完成，请检查输入数据；如仍失败，请提供任务编号以便排查"}}
    finally:
        job = get_current_job()
        if job is not None:
            # Results can be recovered during TTL; original input does not need to remain in Redis.
            job.args = ()
            job.kwargs = {}
            remaining = job.connection.ttl(f"openacad:cap:{job.id}")
            job.result_ttl = max(1, remaining)
            job.failure_ttl = max(1, remaining)
            job.save()


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()
