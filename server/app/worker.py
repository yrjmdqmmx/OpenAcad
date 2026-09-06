from rq import Worker
from rq.serializers import JSONSerializer
from .jobs import connection, queue
from .job_state import CapabilityJob


class OpenAcadWorker(Worker):
    def handle_job_failure(self, job, queue, started_job_registry=None, exc_string=''):
        # The parent still has the pre-fork payload after a SIGKILL or OOM.
        job.discard_input()
        return super().handle_job_failure(job, queue, started_job_registry, exc_string)


if __name__ == "__main__":
    conn = connection()
    OpenAcadWorker([queue(conn)], connection=conn, serializer=JSONSerializer, job_class=CapabilityJob, worker_ttl=60).work(with_scheduler=False)
