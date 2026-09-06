"""RQ persistence always follows the lifetime of the task capability."""
from rq.job import Job
from rq.results import Result

# The final command in the same Redis transaction closes the race with DELETE:
# revocation wins even when a parent worker still holds an old Job in memory.
_CAP_LIFETIME = """
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then
    for i = 2, 5 do redis.call('DEL', KEYS[i]) end
    for i = 6, #KEYS do redis.call('ZREM', KEYS[i], ARGV[1]) end
else
    for i = 2, 5 do redis.call('PEXPIRE', KEYS[i], ttl) end
end
return ttl
"""


class CapabilityJob(Job):
    def discard_input(self):
        # A fetched Job may not yet have deserialized its function/arguments.
        _ = self.func_name
        self.args = ()
        self.kwargs = {}
        self.failure_ttl = max(0, self.connection.ttl('openacad:cap:' + self.id))
        self.result_ttl = self.failure_ttl

    def enforce_lifetime(self, pipeline):
        keys = [
            'openacad:cap:' + self.id, self.key, Result.get_key(self.id),
            self.dependents_key, self.dependencies_key,
            self.failed_job_registry.key, self.finished_job_registry.key,
            f'rq:canceled:{self.origin}',
        ]
        pipeline.eval(_CAP_LIFETIME, len(keys), *keys, self.id)

    def _handle_failure(self, exc_string, pipeline, worker_name=''):
        # Also called by StartedJobRegistry when a whole worker/container dies.
        self.discard_input()
        if self.failure_ttl > 0:
            super()._handle_failure('任务中断或超时，原始输入已清除', pipeline, worker_name)
        self.enforce_lifetime(pipeline)

    def _handle_success(self, result_ttl, pipeline, worker_name=''):
        self.discard_input()
        super()._handle_success(self.result_ttl, pipeline, worker_name)
        self.enforce_lifetime(pipeline)
