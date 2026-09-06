"""Exercise the real deployment script against isolated command substitutes.

No Docker daemon, Nginx service, network or /opt directory is used. Only the
fixed deployment root in a temporary copy of update.sh is replaced.
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest


UPDATE_SCRIPT = Path(__file__).resolve().parents[1] / "update.sh"


class UpdateRollbackTests(unittest.TestCase):
    def run_release_failure(self, *, recovery_failure=False):
        with tempfile.TemporaryDirectory(prefix="openacad-update-test-") as temporary:
            directory = Path(temporary)
            root = directory / "openacad"
            for version in ("old", "new"):
                release = root / "releases" / version
                (release / "web").mkdir(parents=True)
                (release / "web" / "index.html").write_text(version)
                (release / "compose.yml").write_text("name: openacad\nservices: {}\n")
                (release / "release.env").write_text(f"OPENACAD_IMAGE=openacad:{version}\n")
            previous = root / "releases" / "old"
            candidate = root / "releases" / "new"
            (root / "current").symlink_to(previous)
            script = directory / "update.sh"
            script.write_text(UPDATE_SCRIPT.read_text().replace("/opt/openacad", str(root)))
            commands = directory / "commands"
            commands.mkdir()
            shim = commands / "command-substitute"
            shim.write_text(f"#!{sys.executable}\n" + textwrap.dedent("""\
                import json
                import os
                from pathlib import Path
                import sys

                name = Path(sys.argv[0]).name
                args = sys.argv[1:]
                with open(os.environ['OPENACAD_TEST_EVENTS'], 'a') as output:
                    output.write(json.dumps({'command': name, 'args': args}) + '\\n')
                if name == 'docker':
                    if args[0] == 'compose':
                        release = Path(args[args.index('-f') + 1]).parent.name
                        action = args[args.index('-f') + 2:]
                        if action[0] == 'up':
                            if release == 'new':
                                print('No such image: openacad:new', file=sys.stderr)
                                sys.exit(42)
                            if os.environ['OPENACAD_TEST_RECOVERY_FAILS'] == '1':
                                print('Old release cannot start', file=sys.stderr)
                                sys.exit(43)
                        elif action[0] == 'exec':
                            print('0')  # No queued or running user jobs.
                        elif action[0] == 'ps':
                            print(release + '-' + action[-1])
                        else:
                            raise AssertionError('Unexpected compose action: ' + repr(action))
                    elif args[0] == 'inspect':
                        print('healthy')
                    else:
                        raise AssertionError('Unexpected docker command: ' + repr(args))
                elif name == 'nginx':
                    assert args == ['-t'], args
                elif name == 'systemctl':
                    assert args == ['reload', 'nginx'], args
                elif name == 'curl':
                    assert args[-1] == 'http://127.0.0.1:13310/api/health', args
                else:
                    raise AssertionError('Unexpected command: ' + name)
                """))
            shim.chmod(0o755)
            for command in ("docker", "nginx", "systemctl", "curl"):
                (commands / command).symlink_to(shim)
            event_file = directory / "events.jsonl"
            environment = os.environ.copy()
            environment.update({
                "PATH": str(commands) + os.pathsep + os.defpath,
                "OPENACAD_TEST_EVENTS": str(event_file),
                "OPENACAD_TEST_RECOVERY_FAILS": "1" if recovery_failure else "0",
            })
            result = subprocess.run(
                [shutil.which("bash"), str(script), str(candidate)],
                env=environment, capture_output=True, text=True, timeout=20,
            )
            events = [json.loads(line) for line in event_file.read_text().splitlines()]
            compose_up = [
                Path(event["args"][event["args"].index("-f") + 1]).parent.name
                for event in events
                if event["command"] == "docker" and event["args"][0] == "compose"
                and event["args"][event["args"].index("-f") + 2] == "up"
            ]
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(compose_up, ["new", "old"], result.stderr)
            self.assertEqual((root / "current").resolve(), previous.resolve())
            self.assertIn("发布检查失败", result.stderr)
            self.assertEqual((root / "shared" / "maintenance").exists(), recovery_failure)
            if recovery_failure:
                self.assertIn("之前版本尚未恢复健康", result.stderr)
                self.assertNotIn("之前版本已恢复。", result.stderr)
                self.assertFalse(any(event["command"] == "nginx" for event in events))
            else:
                self.assertIn("之前版本已恢复。", result.stderr)
                health_checks = [event for event in events if event["command"] == "docker" and event["args"][0] == "inspect"]
                self.assertEqual({event["args"][-1] for event in health_checks}, {"old-api", "old-worker-one", "old-worker-two"})
                self.assertEqual([event["command"] for event in events[-3:]], ["curl", "nginx", "systemctl"])

    def test_candidate_start_failure_restores_old_release_and_clears_maintenance(self):
        self.run_release_failure()

    def test_failed_recovery_keeps_maintenance_and_does_not_reload_nginx(self):
        self.run_release_failure(recovery_failure=True)


if __name__ == "__main__":
    unittest.main()
