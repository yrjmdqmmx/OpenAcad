import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'deploy' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


scope = load('change_scope')
runner = load('run_web_checks')


class ScopeTests(unittest.TestCase):
    def test_magnetic_upload_uses_only_related_checks_and_no_worker(self):
        p = scope.classify(['web/src/components/MagneticDataPanel.tsx', 'web/src/styles/magnetic.css', 'web/e2e/magnetic-correlation.spec.ts'])
        self.assertEqual(p['mode'], 'frontend')
        self.assertFalse(p['backend']); self.assertFalse(p['full_web'])
        self.assertEqual(p['browser_files'], sorted(scope.MAGNETIC))
        checks = runner.commands(p)
        self.assertIn(['npx', 'playwright', 'test', *['e2e/' + name for name in sorted(scope.MAGNETIC)]], checks)
        self.assertNotIn(['npm', 'test'], checks)

    def test_backend_only_skips_all_web_checks(self):
        p = scope.classify(['server/app/magnetic.py', 'server/requirements.lock'])
        self.assertEqual(p['mode'], 'backend')
        self.assertFalse(p['web_checks']); self.assertEqual(runner.commands(p), [])

    def test_server_context_changes_are_never_hidden_by_docs_or_evidence_rules(self):
        for path in ['server/.dockerignore', 'server/tests/evidence/data.csv', 'server/app/README.md']:
            self.assertTrue(scope.classify([path])['backend'], path)

    def test_mixed_and_shared_changes(self):
        p = scope.classify(['server/app/main.py', 'web/src/core/types.ts'])
        self.assertEqual(p['mode'], 'full'); self.assertTrue(p['full_web'])
        self.assertEqual(runner.commands(p)[-1], ['npx', 'playwright', 'test'])
        p = scope.classify(['web/package-lock.json'])
        self.assertTrue(p['full_web']); self.assertFalse(p['backend'])

    def test_known_ui_areas_stay_scoped(self):
        for path in ['web/src/components/HomePage.tsx', 'web/src/bio/Ab1Viewer.tsx', 'web/src/components/ExportDialog.tsx', 'web/src/components/TemplateDetail.tsx']:
            p = scope.classify([path])
            self.assertEqual(p['mode'], 'frontend', path)
            self.assertFalse(p['full_web'], path); self.assertTrue(p['browser_files'], path)

    def test_docs_and_test_only_do_not_publish(self):
        p = scope.classify(['README.md', 'docs/deployment/note.md', 'tests/artifacts/report.json'])
        self.assertEqual(p['mode'], 'none'); self.assertFalse(p['web_checks'])
        p = scope.classify(['web/e2e/magnetic-correlation.spec.ts'])
        self.assertEqual(p['mode'], 'none'); self.assertTrue(p['web_checks'])

    def test_tooling_does_not_rebuild_a_unchanged_worker(self):
        p = scope.classify(['.github/workflows/deploy-hangzhou.yml', 'deploy/hangzhou/ci_receive.py'])
        self.assertEqual(p['mode'], 'frontend'); self.assertTrue(p['tooling'])
        self.assertFalse(p['backend']); self.assertFalse(p['full_web'])
        self.assertEqual(p['browser_files'], sorted(scope.SMOKE))

    def test_worker_is_compared_to_its_own_deployed_revision(self):
        p = scope.classify(['web/src/styles/magnetic.css'], ['server/app/main.py', 'web/src/styles/magnetic.css'])
        self.assertEqual(p['mode'], 'full')

    def test_backend_plus_previously_unreleased_web_tests_preserves_provenance(self):
        p = scope.classify(['web/e2e/workflow.spec.ts', 'server/app/main.py'])
        self.assertEqual(p['mode'], 'full')

    def test_explicit_manual_overrides_are_separate(self):
        self.assertFalse(scope.classify([], force_web=True)['backend'])
        self.assertEqual(scope.classify([], force_worker=True)['mode'], 'backend')

    def test_missing_test_widens_instead_of_skipping(self):
        for name in ['web/e2e/deleted.spec.ts', 'web/tests/deleted.test.ts']:
            p = scope.classify([name])
            self.assertTrue(p['browser_checks'])
            self.assertTrue(p['full_web'])
            self.assertEqual(runner.commands(p)[-1], ['npx', 'playwright', 'test'])

    def test_all_mapped_suites_exist(self):
        for _, browsers, units in scope.GROUPS:
            for path in [*['e2e/' + p for p in browsers], *units]:
                self.assertTrue((ROOT / 'web' / path).is_file(), path)

    def test_git_range_covers_failed_release_and_both_sides_of_rename(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.DEVNULL, text=True).strip()
            git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Scope Test')
            (root / 'server').mkdir(); (root / 'server/app.py').write_text('old')
            git('add', '.'); git('commit', '-m', 'deployed'); base = git('rev-parse', 'HEAD')
            (root / 'server/app.py').write_text('unreleased backend')
            git('commit', '-am', 'failed release')
            (root / 'web/src/styles').mkdir(parents=True)
            (root / 'web/src/styles/magnetic.css').write_text('a{}')
            git('add', '.'); git('commit', '-m', 'UI only push'); head = git('rev-parse', 'HEAD')
            self.assertEqual(scope.classify(scope.changed(base, head, root))['mode'], 'full')
            git('mv', 'web/src/styles/magnetic.css', 'web/src/styles/app.css'); git('commit', '-m', 'rename to global')
            paths = scope.changed(head, git('rev-parse', 'HEAD'), root)
            self.assertIn('web/src/styles/magnetic.css', paths); self.assertIn('web/src/styles/app.css', paths)
            self.assertIn('template-layout-quality.spec.ts', scope.classify(paths)['browser_files'])
            with self.assertRaises(ValueError): scope.changed('main', head, root)
            with self.assertRaises(subprocess.CalledProcessError): scope.changed('0' * 40, head, root)


if __name__ == '__main__': unittest.main()
