#!/usr/bin/env python3
"""Plan checks from actual deployed revisions, not merely the latest push.

Unmapped web/runtime files widen web checks; they never imply a worker rebuild.
The worker Docker context is server/, so only that tree (or an explicit manual
rebuild) can request a new worker. Paths are passed to subprocesses as arguments.
"""
import argparse
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAGNETIC = ('magnetic-correlation.spec.ts', 'font-first-load.spec.ts')
SMOKE = ('workflow.spec.ts', 'font-first-load.spec.ts')
GROUPS = [
    (('web/src/styles/app.css', 'web/src/components/Editor.tsx', 'web/src/components/Inspector.tsx',
      'web/src/components/LayersPanel.tsx', 'web/src/components/ChartBoundary.tsx', 'web/src/App.tsx',
      'web/src/core/history.ts', 'web/src/core/storage.ts', 'web/src/core/project.ts'),
     ('workflow.spec.ts', 'project-navigation.spec.ts', 'template-layout-quality.spec.ts',
      'magnetic-correlation.spec.ts', 'ordination-editor.spec.ts', 'font-first-load.spec.ts'),
     ('tests/project.test.ts', 'tests/control-audit.test.tsx', 'tests/magnetic-readiness.test.ts')),
    (('web/src/components/MagneticDataPanel.tsx', 'web/src/styles/magnetic.css',
      'web/src/templates/magnetic/', 'web/public/examples/magnetic-correlation/'),
     MAGNETIC, ('src/templates/magnetic/magnetic.test.tsx', 'tests/magnetic-readiness.test.ts')),
    (('web/src/components/HomePage.tsx', 'web/src/components/TuyanCarousel.tsx',
      'web/src/components/ResearchCarousel.tsx', 'web/src/components/useScreenshotCarousel.ts',
      'web/src/styles/home.css', 'web/src/styles/tuyan-carousel.css', 'web/src/styles/research-carousel.css'),
     ('platform-home.spec.ts', 'research-carousel.spec.ts', 'carousel-catalog.spec.ts', 'font-first-load.spec.ts'),
     ('src/core/catalog.test.ts',)),
    (('web/src/components/Catalog.tsx', 'web/src/components/LibraryPages.tsx', 'web/src/styles/navigation.css'),
     ('workflow.spec.ts', 'project-navigation.spec.ts', 'carousel-catalog.spec.ts'), ('src/core/catalog.test.ts', 'tests/project.test.ts')),
    (('web/src/components/TemplateDetail.tsx', 'web/src/styles/template-detail.css',
      'web/src/templates/detailGuides.ts', 'web/src/templates/detailExamples.ts'),
     ('template-details.spec.ts', 'font-first-load.spec.ts'), ('tests/template-detail.test.tsx',)),
    (('web/src/bio/',), ('bio-tools.spec.ts',), ('tests/bio-abif.test.ts', 'src/bio/ko.test.ts')),
    (('web/src/components/ExportDialog.tsx', 'web/src/core/svgFonts.ts', 'web/src/core/exportReadiness.ts',
      'web/src/styles/font-faces.css', 'web/src/styles/ui-font-faces.css', 'web/public/fonts/',
      'scripts/build-', 'scripts/verify-webfonts.mjs', 'scripts/font-delivery-requirements.txt'),
     ('export-fonts.spec.ts', 'font-first-load.spec.ts', 'workflow.spec.ts', 'magnetic-correlation.spec.ts'),
     ('tests/project.test.ts', 'tests/magnetic-readiness.test.ts')),
    (('web/src/components/DataPanel.tsx', 'web/src/components/AnalysisPanel.tsx', 'web/src/core/api.ts'),
     ('workflow.spec.ts', 'magnetic-correlation.spec.ts', 'bio-tools.spec.ts', 'ordination-editor.spec.ts'),
     ('tests/project.test.ts', 'src/core/api.test.ts', 'tests/magnetic-readiness.test.ts')),
    (('web/src/templates/tree/',), ('template-control-quality.spec.ts', 'template-quality.spec.ts', 'workflow.spec.ts'),
     ('tests/tree.test.tsx', 'tests/tree-branch-style.test.tsx')),
    (('web/src/templates/ordination/',), ('ordination-editor.spec.ts', 'workflow.spec.ts'), ('tests/ordination.test.tsx',)),
]


def matches(path, patterns):
    return any(path.startswith(p) if p.endswith(('/', '-')) else path == p for p in patterns)


def ignored(path):
    return path.endswith('.md') or path.startswith(('docs/', 'tests/artifacts/')) or '/evidence/' in path


def classify(web_paths, backend_paths=None, *, force_web=False, force_worker=False, full_web=False):
    paths = sorted(set(web_paths))
    backend_paths = paths if backend_paths is None else backend_paths
    backend = force_worker or any(p.startswith('server/') for p in backend_paths)
    web = force_web
    tooling = False
    browsers, units = set(), set()
    reasons = []
    for p in paths:
        if ignored(p) or p.startswith('server/'):
            continue
        if p.startswith(('deploy/', '.github/workflows/')):
            # Verify the tooling and basic web flow without publishing unchanged
            # web bytes. An explicit force_web can exercise the release path.
            tooling = True
            browsers.update(SMOKE)
            units.add('tests/project.test.ts')
            continue
        if p.startswith('web/e2e/') and p.endswith('.spec.ts'):
            browsers.add(p.removeprefix('web/e2e/'))
            continue
        if p.startswith(('web/src/', 'web/tests/')) and re.search(r'\.test\.tsx?$', p):
            units.add(p.removeprefix('web/'))
            continue
        web = True
        group = next((g for g in GROUPS if matches(p, g[0])), None)
        if group:
            browsers.update(group[1]); units.update(group[2])
        else:
            full_web = True
            reasons.append('Shared or unmapped input: ' + p)
    if force_web and not browsers and not full_web:
        browsers.update(SMOKE); units.add('tests/project.test.ts')
    if backend and any(p.startswith('web/') for p in paths):
        web = True
        if not browsers and not full_web:
            browsers.update(SMOKE)
    missing = [p for p in [*units, *['e2e/' + name for name in browsers]] if not (ROOT / 'web' / p).is_file()]
    if missing:
        # Widen at planning time so CI also installs the browser dependencies.
        full_web = True
        reasons.append('Selected test missing: ' + ', '.join(sorted(missing)))
    mode = 'full' if web and backend else 'frontend' if web else 'backend' if backend else 'none'
    return dict(mode=mode, web=web, backend=backend, tooling=tooling,
                web_checks=bool(web or browsers or units or full_web), browser_checks=bool(browsers or full_web), full_web=full_web,
                browser_files=sorted(browsers), unit_files=sorted(units),
                changed_files=paths, backend_changed_files=sorted(set(backend_paths)), reasons=reasons)


def changed(base, head, cwd=ROOT):
    for ref in (base, head):
        if not re.fullmatch(r'[a-f0-9]{40}', ref):
            raise ValueError('Expected a complete source SHA; refusing an uncertain change range')
        subprocess.run(['git', 'cat-file', '-e', ref + '^{commit}'], cwd=cwd, check=True, capture_output=True)
    # No rename detection: both old and new paths must influence the scope.
    raw = subprocess.check_output(['git', 'diff', '--no-renames', '--name-only', '-z', base, head], cwd=cwd)
    return [p for p in raw.decode().split('\0') if p]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    parser.add_argument('--backend-base')
    parser.add_argument('--head', required=True)
    parser.add_argument('--force-web', action='store_true')
    parser.add_argument('--force-worker', action='store_true')
    parser.add_argument('--full-web', action='store_true')
    parser.add_argument('--output', default='release-plan.json')
    parser.add_argument('--github-output')
    args = parser.parse_args()
    backend_base = args.backend_base or args.base
    plan = classify(changed(args.base, args.head), changed(backend_base, args.head),
                    force_web=args.force_web, force_worker=args.force_worker, full_web=args.full_web)
    plan.update(base=args.base, backend_base=backend_base, head=args.head)
    pathlib.Path(args.output).write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    if args.github_output:
        with open(args.github_output, 'a') as output:
            for key in ('mode', 'web', 'backend', 'tooling', 'web_checks', 'browser_checks'):
                output.write(key + '=' + (str(plan[key]).lower()) + '\n')
            output.write('plan=' + json.dumps(plan, ensure_ascii=False) + '\n')
    print(json.dumps(plan, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
