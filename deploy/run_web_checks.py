#!/usr/bin/env python3
"""Run the selected existing suites; refuse a selected suite that disappeared."""
import argparse
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]


def commands(plan, web=ROOT / 'web'):
    if not plan['web_checks']:
        return []
    checks = [['npm', 'run', 'build']]
    if plan['full_web']:
        return checks + [['npm', 'test'], ['npx', 'playwright', 'test']]
    # Deleted/renamed tests widen checks instead of silently leaving a gap.
    units = plan['unit_files']
    browsers = ['e2e/' + name for name in plan['browser_files']]
    if any(not (web / name).is_file() for name in units + browsers):
        return checks + [['npm', 'test'], ['npx', 'playwright', 'test']]
    if units:
        checks.append(['npm', 'test', '--', *units])
    if browsers:
        checks.append(['npx', 'playwright', 'test', *browsers])
    return checks


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', default='release-plan.json')
    args = parser.parse_args()
    for command in commands(json.loads(pathlib.Path(args.plan).read_text())):
        print(json.dumps(command), flush=True)
        subprocess.run(command, cwd=ROOT / 'web', check=True)
