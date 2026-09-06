import datetime as dt
from types import SimpleNamespace
import fakeredis
from rq.results import Result
from rq.registry import FailedJobRegistry, StartedJobRegistry
from rq.job import JobStatus
from app.jobs import queue
from app.job_state import CapabilityJob
from app.worker import OpenAcadWorker
from app import worker_health
from test_analysis import payload


def queued(conn):
    job = queue(conn).enqueue('app.jobs.execute', payload('pca'), job_timeout=300, failure_ttl=3600, result_ttl=3600)
    conn.set('openacad:cap:'+job.id, 'capability metadata', ex=37)
    job.started_at = dt.datetime.now(dt.timezone.utc)
    return job


def test_parent_failure_clears_old_payload_and_uses_remaining_capability():
    conn = fakeredis.FakeRedis()
    job = queued(conn)
    parent = CapabilityJob.fetch(job.id, connection=conn, serializer=job.serializer)
    assert parent.args[0]['data']['tables']
    worker = OpenAcadWorker([queue(conn)], connection=conn, job_class=CapabilityJob, serializer=job.serializer)
    worker.handle_job_failure(parent, queue(conn), exc_string='old parent state')
    saved = CapabilityJob.fetch(job.id, connection=conn, serializer=job.serializer)
    assert not saved.args and saved.kwargs == {}
    assert 0 < conn.ttl(saved.key) <= 37
    assert 0 < conn.ttl(Result.get_key(saved.id)) <= 37
    assert conn.pttl(saved.key) <= conn.pttl('openacad:cap:'+saved.id) + 10


def test_cancelled_parent_failure_does_not_recreate_job_or_result():
    conn = fakeredis.FakeRedis()
    job = queued(conn)
    parent = CapabilityJob.fetch(job.id, connection=conn, serializer=job.serializer)
    conn.delete('openacad:cap:'+job.id)
    job.cancel(); job.delete()
    worker = OpenAcadWorker([queue(conn)], connection=conn, job_class=CapabilityJob, serializer=job.serializer)
    worker._stopped_job_id = job.id
    worker.handle_job_failure(parent, queue(conn))
    assert not conn.exists(job.key) and not conn.exists(Result.get_key(job.id))
    assert conn.zscore(FailedJobRegistry(queue=queue(conn)).key, job.id) is None


def test_revocation_between_parent_preparation_and_pipeline_commit_wins():
    conn = fakeredis.FakeRedis()
    job = queued(conn)
    with conn.pipeline() as pipeline:
        job._handle_failure('failure', pipeline)
        conn.delete('openacad:cap:'+job.id)
        pipeline.execute()
    assert not conn.exists(job.key) and not conn.exists(Result.get_key(job.id))


def test_late_success_after_cancel_does_not_recreate_result():
    conn = fakeredis.FakeRedis()
    job = queued(conn); job._result = {'real_result': 7}
    with conn.pipeline() as pipeline:
        job._handle_success(3600, pipeline)
        conn.delete('openacad:cap:'+job.id)
        pipeline.execute()
    assert not conn.exists(job.key) and not conn.exists(Result.get_key(job.id))


def test_abandoned_registry_uses_capability_job_cleanup():
    conn = fakeredis.FakeRedis()
    job = queued(conn)
    registry = queue(conn).started_job_registry
    assert registry.job_class is CapabilityJob
    # RQ's abandoned recovery calls this Job hook without a live parent worker.
    recovered = registry.job_class.fetch(job.id, connection=conn, serializer=job.serializer)
    with conn.pipeline() as pipeline:
        recovered.set_status(JobStatus.FAILED, pipeline=pipeline)
        recovered._handle_failure('AbandonedJobError', pipeline)
        pipeline.execute()
    saved = CapabilityJob.fetch(job.id, connection=conn, serializer=job.serializer)
    assert not saved.args and conn.ttl(saved.key) <= 37


def test_worker_health_rejects_other_host_dead_pid_and_stale_heartbeat(monkeypatch):
    now = dt.datetime.now(dt.timezone.utc)
    def fake(host='current', age=0, pid=12, state='idle'):
        return SimpleNamespace(hostname=host, pid=pid, last_heartbeat=now-dt.timedelta(seconds=age), get_state=lambda refresh=False:state)
    seen = [fake(host='old-container'), fake(age=150), fake(pid=9999), fake(state='starting')]
    monkeypatch.setattr(worker_health.Worker, 'all', lambda **kwargs:seen)
    conn = fakeredis.FakeRedis()
    assert not worker_health.healthy_here(conn, hostname='current', pid_exists=lambda p:p==12)
    seen.append(fake(age=50))
    assert worker_health.healthy_here(conn, hostname='current', pid_exists=lambda p:p==12)
