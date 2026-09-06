import argparse
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('image_delta', Path(__file__).parents[1] / 'image_delta.py')
delta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delta)


def sha(data): return hashlib.sha256(data).hexdigest()
def encoded(value): return json.dumps(value, separators=(',', ':')).encode()
def tar_bytes(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as tar:
        for name, data in files.items():
            info=tarfile.TarInfo(name); info.size=len(data);tar.addfile(info,io.BytesIO(data))
    return output.getvalue()
def archive(path, files): path.write_bytes(gzip.compress(tar_bytes(files)))


def image(style, payloads, label='new', compressed=False):
    layers = [tar_bytes({'simulated.txt':payload}) for payload in payloads]
    config = encoded({'architecture':'amd64','os':'linux','config':{'Labels':{'version':label}},'rootfs':{'type':'layers','diff_ids':['sha256:'+sha(layer) for layer in layers]}})
    identity = 'sha256:'+sha(config)
    if style == 'legacy':
        name=sha(config)+'.json';files={name:config};names=[]
        for i,layer in enumerate(layers):
            base=sha(('legacy-'+str(i)+label).encode());names.append(base+'/layer.tar')
            files.update({base+'/layer.tar':layer,base+'/json':b'{}',base+'/VERSION':b'1.0'})
        files['manifest.json']=encoded([{'Config':name,'Layers':names,'RepoTags':['openacad-worker:verified']}])
        files['repositories']=b'{}'
        return files,identity
    def descriptor(data, typ): return {'mediaType':typ,'digest':'sha256:'+sha(data),'size':len(data)}
    layer_blobs=[gzip.compress(layer,mtime=0) if compressed else layer for layer in layers]
    conf=descriptor(config,'application/vnd.oci.image.config.v1+json')
    descriptors=[descriptor(layer,'application/vnd.oci.image.layer.v1.tar'+('+gzip' if compressed else '')) for layer in layer_blobs]
    manifest=encoded({'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':conf,'layers':descriptors})
    files={'blobs/sha256/'+sha(data):data for data in [config,manifest,*layer_blobs]}
    files['oci-layout']=encoded({'imageLayoutVersion':'1.0.0'})
    files['index.json']=encoded({'schemaVersion':2,'manifests':[descriptor(manifest,'application/vnd.oci.image.manifest.v1+json')]})
    files['manifest.json']=encoded([{'Config':'blobs/sha256/'+sha(config),'Layers':['blobs/sha256/'+sha(layer) for layer in layer_blobs],'RepoTags':['openacad-worker:verified']}])
    return files,identity


class DeltaTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()
    def build(self, style='oci', compressed=False):
        old,old_id=image(style,[b'shared',b'old'],'old',compressed)
        new,new_id=image(style,[b'shared',b'new'],'new',compressed)
        baseline,target=self.root/'old.gz',self.root/'new.gz';archive(baseline,old);archive(target,new)
        inventory=self.root/'baseline.json';delta.inventory(argparse.Namespace(archive=baseline,output=inventory,expected_image_id=old_id))
        packet=self.root/'delta.gz';report=self.root/'delta-report.json'
        delta.create(argparse.Namespace(target=target,baseline_inventory=inventory,expected_image_id=new_id,output=packet,report=report))
        return old,new,baseline,target,packet,new_id
    def test_roundtrip_oci_and_legacy(self):
        for style,compressed in [('oci',False),('oci',True),('legacy',False)]:
            with self.subTest(style=style,compressed=compressed):
                with tempfile.TemporaryDirectory(dir=self.root) as folder:
                    previous=self.root;self.root=Path(folder)
                    old,new,baseline,target,packet,new_id=self.build(style,compressed)
                    output=self.root/'rebuilt.tar.gz';report=self.root/'assembly.json'
                    delta.assemble(argparse.Namespace(baseline=baseline,delta=packet,expected_image_id=new_id,output=output,report=report))
                    with tarfile.open(output) as tar: actual={m.name:tar.extractfile(m).read() for m in tar if m.isfile()}
                    self.assertEqual(actual,new)
                    info=json.loads((self.root/'delta-report.json').read_text());self.assertEqual(info['reusedFiles'],1)
                    self.assertFalse(json.loads(report.read_text())['dockerLoadVerified'])
                    with tarfile.open(packet) as tar:
                        plan=json.load(tar.extractfile('openacad-delta.json'))['files']
                    self.assertTrue(all(e['name'].endswith('layer.tar') or e['name'].startswith('blobs/sha256/') for e in plan if e['source']=='baseline'))
                    self.root=previous
    def test_wrong_image_id_rejected(self):
        files,identity=image('oci',[b'a']);path=self.root/'image.gz';archive(path,files)
        with self.assertRaisesRegex(ValueError,'预期镜像'):
            delta.inventory(argparse.Namespace(archive=path,output=self.root/'no.json',expected_image_id='sha256:'+'0'*64))
        self.assertFalse((self.root/'no.json').exists())
    def test_dangling_output_or_partial_link_is_rejected(self):
        source=self.root/'payload';source.write_bytes(b'simulated')
        for suffix in ['', '.partial']:
            output=self.root/('output'+str(len(suffix))+'.tar')
            link=output.with_name(output.name+suffix)
            missing=self.root/('do-not-create'+str(len(suffix)))
            link.symlink_to(missing)
            with self.assertRaises(ValueError):delta.write_archive(output,[('manifest.json',source)])
            self.assertFalse(missing.exists())
    def test_concurrent_partial_is_not_deleted(self):
        source=self.root/'payload';source.write_bytes(b'simulated');output=self.root/'output.tar';partial=self.root/'output.tar.partial'
        def raced_open(*args):
            partial.write_bytes(b'other process')
            raise FileExistsError('concurrent writer')
        with patch.object(delta.os,'open',side_effect=raced_open):
            with self.assertRaises(FileExistsError):delta.write_archive(output,[('manifest.json',source)])
        self.assertEqual(partial.read_bytes(),b'other process')
    def test_missing_config_and_manifest_order_mismatch_rejected(self):
        for missing in [True,False]:
            files,identity=image('oci',[b'a',b'b']);manifest=json.loads(files['manifest.json'])
            if missing:del files[manifest[0]['Config']]
            else:manifest[0]['Layers'].reverse();files['manifest.json']=encoded(manifest)
            path=self.root/f'invalid-{missing}.gz';archive(path,files)
            with self.assertRaisesRegex(ValueError,'缺少|不一致'):
                delta.inventory(argparse.Namespace(archive=path,output=self.root/'no.json',expected_image_id=identity))
    def test_oci_manifest_identity_is_distinct_from_config(self):
        files,config_id=image('oci',[b'a']);top_id=json.loads(files['index.json'])['manifests'][0]['digest']
        self.assertNotEqual(config_id,top_id);path=self.root/'root-id.tar';archive(path,files)
        actual=delta.extract_checked(path,self.root/'root-id')
        result=delta.validate_image(self.root/'root-id',actual,top_id)
        self.assertEqual(result['configDigest'],config_id)
        self.assertEqual(result['topLevelDigest'],top_id)
        self.assertEqual(result['acceptedExpectedIdentity'],{'digest':top_id,'kind':'oci-root'})
    def test_verify_loaded_checks_both_engine_identities_and_runtime(self):
        old,new,baseline,target,packet,identity=self.build()
        report_path=self.root/'assembly.json'
        delta.assemble(argparse.Namespace(baseline=baseline,delta=packet,expected_image_id=identity,output=self.root/'out.tar',report=report_path))
        report=json.loads(report_path.read_text());config=json.loads(new[report['config']])
        inspected={'Id':report['topLevelDigest'],'Descriptor':{'digest':report['topLevelDigest']},'Architecture':'amd64','Os':'linux','RootFS':{'Type':'layers','Layers':report['rootfsDiffIds']},'RepoTags':report['repoTags'],'Config':config['config']}
        path=self.root/'inspect.json'
        for engine in ['oci','legacy']:
            item=json.loads(json.dumps(inspected))
            if engine=='legacy':item['Id']=identity;del item['Descriptor']
            path.write_text(json.dumps([item]))
            out=self.root/(engine+'.json')
            delta.verify_loaded(argparse.Namespace(assembly_report=report_path,inspect_json=path,output=out))
            self.assertTrue(json.loads(out.read_text())['dockerLoadVerified'])
        for field in ['Id','Descriptor','RootFS','Config','Architecture']:
            item=json.loads(json.dumps(inspected))
            if field=='Id':item[field]='sha256:'+'0'*64
            elif field=='Descriptor':item[field]={'digest':'sha256:'+'0'*64}
            elif field=='RootFS':item[field]['Layers'].reverse()
            elif field=='Config':item[field]['Labels']['version']='wrong-image'
            else:item[field]='arm64'
            path.write_text(json.dumps([item]))
            with self.assertRaises(ValueError):delta.verify_loaded(argparse.Namespace(assembly_report=report_path,inspect_json=path,output=self.root/'forbidden.json'))
        self.assertFalse((self.root/'forbidden.json').exists())
    def test_blob_hash_mismatch_rejected(self):
        files,_=image('oci',[b'a']);name=next(n for n in files if n.startswith('blobs/'));files[name]+=b'corrupt';path=self.root/'bad.gz';archive(path,files)
        with self.assertRaisesRegex(ValueError,'SHA-256'):
            delta.extract_checked(path,self.root/'x')
    def test_missing_blob_and_wrong_diff_id_rejected(self):
        for missing in [True,False]:
            files,identity=image('legacy',[b'a']);config=next(n for n in files if n.endswith('.json') and '/' not in n and n!='manifest.json')
            if missing:
                del files[next(n for n in files if n.endswith('layer.tar'))]
            else:
                name=next(n for n in files if n.endswith('layer.tar'));files[name]=tar_bytes({'simulated.txt':b'changed'})
            path=self.root/f'bad-{missing}.gz';archive(path,files)
            with self.assertRaisesRegex(ValueError,'缺少|diff_id'):
                delta.inventory(argparse.Namespace(archive=path,output=self.root/'no.json',expected_image_id=identity))
    def test_path_link_and_duplicate_rejected(self):
        for variant in ['../escape','link','duplicate']:
            path=self.root/(variant.replace('/','_')+'.tar')
            with tarfile.open(path,'w') as tar:
                info=tarfile.TarInfo('../escape' if variant=='../escape' else 'manifest.json')
                if variant=='link': info.type=tarfile.SYMTYPE;info.linkname='/etc/passwd';tar.addfile(info)
                else:
                    info.size=2;tar.addfile(info,io.BytesIO(b'[]'))
                    if variant=='duplicate':tar.addfile(info,io.BytesIO(b'[]'))
            with self.assertRaises(ValueError):delta.extract_checked(path,self.root/('extract-'+variant.replace('/','_')))
    def test_baseline_tampering_and_missing_delta_rejected_without_output(self):
        old,new,baseline,target,packet,identity=self.build()
        with tarfile.open(packet) as tar: parts={m.name:tar.extractfile(m).read() for m in tar}
        payload=next(n for n in parts if n.startswith('payload/'));del parts[payload]
        bad=self.root/'missing.gz';archive(bad,parts)
        output=self.root/'forbidden.tar'
        with self.assertRaises(ValueError):delta.assemble(argparse.Namespace(baseline=baseline,delta=bad,expected_image_id=identity,output=output,report=self.root/'report.json'))
        self.assertFalse(output.exists())
        old['repositories']=b'{"changed":true}';archive(baseline,old)
        with self.assertRaisesRegex(ValueError,'基线清单'):
            delta.assemble(argparse.Namespace(baseline=baseline,delta=packet,expected_image_id=identity,output=output,report=self.root/'report.json'))
        self.assertFalse(output.exists())


if __name__=='__main__': unittest.main()
