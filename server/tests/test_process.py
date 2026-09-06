import sys
from app.process import run_process


def test_child_process_including_container_pid_one():
    # CI runs pytest directly as container PID 1; it must not be treated as an orphan.
    output, _ = run_process([sys.executable, "-c", "print('child ready')"], timeout=5)
    assert output.strip() == "child ready"
