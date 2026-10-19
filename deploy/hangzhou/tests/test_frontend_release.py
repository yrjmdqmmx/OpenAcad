import importlib.util
import builtins
import hashlib
import io
import json
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location('receiver_scoped', pathlib.Path(__file__).parents[1] / 'ci_receive.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class ScopedReleaseTests(unittest.TestCase):
    def test_manifest_forbids_worker_image_in_frontend_and_web_in_backend(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root/'web').mkdir(); (root/'web/index.html').write_text('web')
            h = {'sha': 'a'*40}
            image = 'ghcr.io/yrjmdqmmx/openacad-hz-worker@sha256:' + 'b'*64
            frontend = {'sha': h['sha'], 'mode': 'frontend', 'images': {}}
            self.assertEqual(r.validate_manifest('openacad', h, frontend, root), 'frontend')
            with self.assertRaises(ValueError): r.validate_manifest('openacad', h, {**frontend, 'images': {'worker': image}}, root)
            backend = {'sha': h['sha'], 'mode': 'backend', 'images': {'worker': image}}
            with self.assertRaises(ValueError): r.validate_manifest('openacad', h, backend, root)
            (root/'web/index.html').unlink(); (root/'web').rmdir()
            self.assertEqual(r.validate_manifest('openacad', h, backend, root), 'backend')
            with self.assertRaises(ValueError): r.validate_manifest('openacad', h, frontend, root)
            with self.assertRaises(ValueError): r.validate_manifest('openacad', h, {'sha': h['sha'], 'images': {'worker': image}}, root)

    def test_receiver_independently_rejects_omitted_runtime_changes(self):
        h = {'sha': 'a'*40, 'token': 'fixture', 'expected': {'backendRevision': 'b'*40, 'webRevision': 'c'*40}}
        for mode, tree_name in [('frontend', 'server'), ('backend', 'web')]:
            for changed in [False, True]:
                def github(c, token, route):
                    revision = route.rsplit('/', 1)[1]
                    if route.startswith('git/commits/'):
                        return {'tree': {'sha': revision}}
                    return {'tree': [{'path': tree_name, 'type': 'tree', 'sha': 'new' if changed and revision == h['sha'] else 'same'}]}
                with patch.object(r, 'github', side_effect=github):
                    if changed:
                        with self.assertRaises(ValueError): r.verify_scope({}, h, mode)
                    else:
                        r.verify_scope({}, h, mode)
        with patch.object(r, 'github', side_effect=[{'tree': {'sha': 'x'}}, {'truncated': True}]):
            with self.assertRaises(ValueError): r.verify_scope({}, h, 'frontend')

    def exercise_frontend(self, failure=None, maintenance=False):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); old = root/'old'; dest = root/'new'
            old.mkdir(); dest.mkdir(); (root/'shared').mkdir(); (root/'current').symlink_to(old)
            (old/'compose.yml').write_text('original compose')
            (old/'release.env').write_text('OPENACAD_IMAGE=original\nPRIVATE=fixture\n')
            expected = {'web': str(old), 'runtime': str(old), 'images': {'api':'original'}, 'containerIds': {'api':'unchanged-id'},
                        'configHashes': {'release.env': 'original'}, 'backendRevision': 'b'*40}
            h = {'sha': 'a'*40, 'expected': expected}
            c = {'root': str(root), 'url': 'https://example.invalid'}
            if maintenance: (root/'shared/maintenance').write_text('another-deployment')
            after = dict(expected)
            if failure == 'runtime': after['containerIds'] = {'api': 'restarted'}
            def ready(url):
                if 'version.json' in url:
                    return {'revision': 'wrong' if failure == 'web' else h['sha']}
                return {'status': 'ok', 'queue': failure != 'health', 'workers': 2}
            with patch.object(r, 'command') as command, patch.object(r, 'state', return_value=after), patch.object(r, 'ready', side_effect=ready):
                if failure or maintenance:
                    with self.assertRaises(RuntimeError): r.openacad_frontend_deploy(c, h, dest)
                    self.assertEqual((root/'current').resolve(), old.resolve())
                else:
                    r.openacad_frontend_deploy(c, h, dest)
                    self.assertEqual((root/'current').resolve(), dest.resolve())
                    self.assertEqual((dest/'REVISION').read_text(), h['sha'])
                    self.assertEqual((dest/'BACKEND_REVISION').read_text(), 'b'*40)
                    self.assertEqual((dest/'release.env').read_bytes(), (old/'release.env').read_bytes())
                    self.assertEqual((dest/'release.env').stat().st_mode & 0o777, 0o600)
                command.assert_not_called()  # No Compose, queue drain, Docker pull or restart.
            self.assertEqual((root/'shared/maintenance').exists(), maintenance)
            if maintenance: self.assertEqual((root/'shared/maintenance').read_text(), 'another-deployment')

    def test_frontend_switch_preserves_backend_and_does_not_pause_jobs(self): self.exercise_frontend()
    def test_bad_frontend_version_rolls_back_only_web(self): self.exercise_frontend('web')
    def test_failed_health_rolls_back_only_web(self): self.exercise_frontend('health')
    def test_unexpected_container_change_rolls_back_web(self): self.exercise_frontend('runtime')
    def test_frontend_does_not_clear_existing_maintenance(self): self.exercise_frontend(maintenance=True)

    def test_frontend_state_uses_runtime_receipt_before_new_receipt_exists(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d); old=root/'old'; new=root/'new'; old.mkdir(); new.mkdir(); (root/'current').symlink_to(new)
            (old/'compose.yml').write_text('compose'); (old/'release.env').write_text('env')
            (old/'BACKEND_REVISION').write_text('b'*40); (new/'REVISION').write_text('a'*40)
            (old/'receipt.json').write_text(json.dumps({'registrySources': {'worker':'immutable-image'}}))
            c={'root':str(root),'web':str(root),'services':{'api':'api','worker-one':'w1','worker-two':'w2','redis':'redis'}}
            def inspect(name):
                return {'Id':name+'-id','Image':name+'-image','Config':{'Labels':{'com.docker.compose.project.working_dir':str(old)}}}
            with patch.dict(r.CONFIG, {'openacad':c}), patch.object(r, 'inspect', side_effect=inspect):
                state=r.state('openacad')
            self.assertEqual(state['backendRevision'],'b'*40)
            self.assertEqual(state['webRevision'],'a'*40)
            self.assertEqual(state['registrySources']['worker'],'immutable-image')

    def test_backend_only_archive_has_no_frontend(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d); archive=root/'release.tar.gz'; unpack=root/'unpack'; unpack.mkdir()
            with tarfile.open(archive,'w:gz') as tf:
                body=b'{}'; entry=tarfile.TarInfo('manifest.json'); entry.size=len(body); tf.addfile(entry,io.BytesIO(body))
            r.extract(archive,unpack)
            self.assertFalse((unpack/'web').exists())

    def test_frontend_receiver_never_imports_images(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d); old=root/'old'; old.mkdir(); (root/'shared').mkdir(); (root/'releases').mkdir()
            (root/'current').symlink_to(old)
            (old/'compose.yml').write_text('compose'); (old/'release.env').write_text('env')
            expected={'web':str(old), 'runtime':str(old), 'images':{'api':'original'}, 'containerIds':{'api':'id'},
                      'configHashes':{}, 'backendRevision':'b'*40, 'registrySources':{'worker':'immutable-image'}}
            manifest={'sha':'a'*40, 'mode':'frontend', 'images':{}}
            archive=io.BytesIO()
            with tarfile.open(fileobj=archive,mode='w:gz') as tf:
                for name,body in [('manifest.json',json.dumps(manifest).encode()),('web/index.html',b'<h1>new</h1>')]:
                    entry=tarfile.TarInfo(name); entry.size=len(body); tf.addfile(entry,io.BytesIO(body))
            payload=archive.getvalue()
            header=dict(sha='a'*40,run='123',attempt='1',branch=r.BRANCH,repository='yrjmdqmmx/OpenAcad',token='fixture',username='fixture',
                        size=len(payload),sha256=hashlib.sha256(payload).hexdigest(),expected=expected)
            c={**r.CONFIG['openacad'],'root':str(root),'web':str(root),'services':{'api':'api'}}
            def github(c,token,route):
                if route.startswith('actions/runs/'):
                    return dict(head_sha=header['sha'],head_branch=r.BRANCH,path='.github/workflows/deploy-hangzhou.yml',event='push',status='in_progress')
                if route.startswith('git/commits/'): return {'tree':{'sha':'tree'}}
                if route.startswith('git/trees/'): return {'tree':[{'path':'server','type':'tree','sha':'unchanged'}]}
                return {'object':{'sha':header['sha']}}
            original_open=builtins.open
            def open_lock(path,*args,**kwargs):
                if str(path)=='/run/lock/hangzhou-ci-production.lock': path=root/'lock'
                return original_open(path,*args,**kwargs)
            importer=Mock()
            with patch.dict(r.CONFIG,{'openacad':c}), patch.dict('sys.modules',{'registry_import':importer}), \
                 patch.object(r,'github',side_effect=github), patch.object(r,'state',return_value=expected), \
                 patch.object(r,'inspect',return_value={'Image':'original','Id':'id'}), patch.object(r,'command') as command, \
                 patch.object(r,'ready',side_effect=lambda url: {'revision':header['sha']} if 'version.json' in url else {'status':'ok','queue':True,'workers':2}), \
                 patch('builtins.open',side_effect=open_lock), patch('builtins.print'):
                r.deploy('openacad',io.BytesIO(json.dumps(header).encode()+b'\n'+payload))
                importer.import_images.assert_not_called(); command.assert_not_called()
            receipt=json.loads((root/'current/receipt.json').read_text())
            self.assertEqual(receipt['mode'],'frontend')
            self.assertEqual(receipt['backendRevision'],'b'*40)
            self.assertEqual(receipt['registrySources'],expected['registrySources'])
            self.assertFalse((root/'shared/maintenance').exists())

    def test_backend_modes_preserve_or_update_web_and_restore_on_failure(self):
        for mode,fail in [('backend',False),('full',False),('backend',True)]:
            with self.subTest(mode=mode,fail=fail), tempfile.TemporaryDirectory() as d:
                root=pathlib.Path(d); old=root/'old'; dest=root/'new'; old.mkdir(); dest.mkdir()
                (root/'shared').mkdir(); (root/'current').symlink_to(old)
                (old/'compose.yml').write_text('compose'); (old/'release.env').write_text('OPENACAD_IMAGE=old\nKEEP=fixture\n')
                c={'root':str(root),'url':'https://example.invalid','services':{k:k for k in ['api','worker-one','worker-two','redis']}}
                expected={'web':str(old),'runtime':str(old),'webRevision':'b'*40,'images':{'redis':'redis-image'}}
                h={'sha':'a'*40,'run':'123','attempt':'1','expected':expected}; m={'mode':mode,'images':{'worker':'new-image'}}
                def command(args,**kwargs):
                    if args[:3]==['docker','image','inspect']: return json.dumps([{'Id':'new-image'}])
                    return '0'
                def inspect(name):
                    return {'State':{'Health':{'Status':'healthy'}},'Image':'redis-image' if name=='redis' else 'new-image'}
                def ready(url):
                    if 'version.json' in url: return {'revision':'b'*40 if mode=='backend' else h['sha']}
                    return {'status':'ok','queue':not fail,'workers':2}
                with patch.object(r,'command',side_effect=command) as calls, patch.object(r,'inspect',side_effect=inspect), \
                     patch.object(r,'ready',side_effect=ready), patch.object(r,'state',return_value=expected):
                    if fail:
                        with self.assertRaises(RuntimeError): r.openacad_deploy(c,h,m,dest)
                    else: r.openacad_deploy(c,h,m,dest)
                self.assertEqual((root/'current').resolve(),(old if fail else dest).resolve())
                self.assertFalse((root/'shared/maintenance').exists())
                self.assertEqual((dest/'BACKEND_REVISION').read_text(),h['sha'])
                self.assertEqual((dest/'REVISION').read_text(),'b'*40 if mode=='backend' else h['sha'])
                self.assertIn('KEEP=fixture',(dest/'release.env').read_text())
                updates=[call.args[0] for call in calls.call_args_list if '--no-deps' in call.args[0]]
                self.assertEqual(len(updates),2 if fail else 1)
                self.assertEqual(updates[-1][updates[-1].index('--project-directory')+1],str(old if fail else dest))


if __name__ == '__main__': unittest.main()
