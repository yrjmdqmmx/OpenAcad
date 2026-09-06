import os
import signal
import subprocess
import sys
from .errors import AnalysisError


def run_process(args, *, input=None, timeout=240, cwd=None):
    parent_pid = os.getpid()
    def die_with_parent():
        # RQ may kill the work horse on cancel/timeout. Do not orphan R/Inkscape.
        import ctypes
        ctypes.CDLL(None).prctl(1, signal.SIGKILL)
        # PID 1 is a legitimate API/test parent inside a container.
        if os.getppid() != parent_pid:
            os._exit(1)
    proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=cwd, start_new_session=True,
                            preexec_fn=die_with_parent if sys.platform == "linux" else None)
    try:
        stdout, stderr = proc.communicate(input=input, timeout=timeout)
    except BaseException:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()
        raise
    if proc.returncode:
        raise AnalysisError("计算进程未能完成，请检查输入数据和算法条件", "COMPUTATION_FAILED")
    return stdout, stderr
