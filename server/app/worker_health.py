"""Healthcheck for the worker in this container, not an old Redis registration."""
import datetime as dt
import os
import socket
from rq import Worker
from redis.exceptions import RedisError
from .jobs import connection, queue

MAX_HEARTBEAT_AGE = 90


def fresh_workers(conn):
    now = dt.datetime.now(dt.timezone.utc)
    workers = []
    for worker in Worker.all(connection=conn, queue=queue(conn)):
        heartbeat = worker.last_heartbeat
        if heartbeat is None:
            continue
        if heartbeat.tzinfo is None:
            heartbeat = heartbeat.replace(tzinfo=dt.timezone.utc)
        age = (now - heartbeat).total_seconds()
        if -5 <= age <= MAX_HEARTBEAT_AGE and worker.get_state() in ('idle', 'busy'):
            workers.append(worker)
    return workers


def healthy_here(conn, hostname=None, pid_exists=None):
    hostname = hostname or socket.gethostname()
    if pid_exists is None:
        def pid_exists(pid):
            try:
                os.kill(pid, 0)
                return True
            except (ProcessLookupError, PermissionError):
                return False
    return any(worker.hostname == hostname and isinstance(worker.pid, int) and worker.pid > 0 and pid_exists(worker.pid) for worker in fresh_workers(conn))


def main():
    try:
        ready = healthy_here(connection())
    except (RedisError, ValueError, TypeError):
        ready = False
    print('本容器计算进程正常' if ready else '本容器计算进程尚未就绪')
    raise SystemExit(0 if ready else 1)


if __name__ == '__main__':
    main()
