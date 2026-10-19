#!/usr/bin/env python3
"""Resolve CI ranges and emit a reviewable, shared scope plan."""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess
from change_scope import ROOT, changed, classify


def enabled(inputs, name):
    return inputs.get(name) in (True, 'true')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--production', type=pathlib.Path)
    args = parser.parse_args()
    event = json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    inputs = event.get('inputs') or {}
    head = os.environ['GITHUB_SHA']
    state = None
    if args.production:
        state = json.loads(args.production.read_text())
        digest = hashlib.sha256((ROOT / 'deploy/hangzhou/ci_receive.py').read_bytes()).hexdigest()
        if state.get('receiverProtocol') != 2 or state.get('receiverSha256') != digest:
            raise SystemExit('Install the reviewed OpenAcad receiver before releasing this change')
        base, backend_base = state['webRevision'], state['backendRevision']
    else:
        base = event.get('pull_request', {}).get('base', {}).get('sha')
        if not base:
            base = subprocess.check_output(['git', 'rev-parse', head + '^'], cwd=ROOT, text=True).strip()
        backend_base = base
    plan = classify(changed(base, head), changed(backend_base, head),
                    force_web=bool(args.production) and (enabled(inputs, 'force_web') or enabled(inputs, 'full_web')),
                    force_worker=enabled(inputs, 'rebuild_worker') or enabled(inputs, 'archive_worker'), full_web=enabled(inputs, 'full_web'))
    plan.update(base=base, backend_base=backend_base, head=head)
    pathlib.Path('release-plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        for key in ('mode', 'web', 'backend', 'tooling', 'web_checks', 'browser_checks'):
            output.write(key + '=' + str(plan[key]).lower() + '\n')
        output.write('plan=' + json.dumps(plan) + '\n')
        if state:
            output.write('state=' + json.dumps(state) + '\n')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write('### Change-scoped plan\n\n')
        summary.write(f"Mode: **{plan['mode']}**; rebuild worker: **{plan['backend']}**\n\n")
        summary.write(f"Web base: `{base}`; backend base: `{backend_base}`\n\n")
        summary.write('Web checks: ' + ('full web regression' if plan['full_web'] else ', '.join(plan['browser_files']) or 'none') + '\n\n')
        summary.write('```json\n' + json.dumps(plan, indent=2) + '\n```\n')
    print(json.dumps(plan, indent=2))
