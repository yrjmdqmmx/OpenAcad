#!/usr/bin/env python3
"""Private Docker-save archive delta. Never calls Docker or deploys a service.

All archive files are streamed through SHA-256; extraction never follows links.
Only layer content may be reused. Every target metadata file travels in delta.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import tarfile
import tempfile

MAX_FILES = 10000
MAX_BYTES = 32 * 1024**3
MAX_MEMBER = 8 * 1024**3
MAX_JSON = 8 * 1024**2
SHA = re.compile(r'^[0-9a-f]{64}$')
BLOB = re.compile(r'^blobs/sha256/([0-9a-f]{64})$')
LEGACY = re.compile(r'^[0-9a-f]{64}/(?:layer\.tar|json|VERSION)$')
CONFIG = re.compile(r'^[0-9a-f]{64}\.json$')
MANIFEST_TYPES = {'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'}
INDEX_TYPES = {'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'}
LAYER_TYPES = {'application/vnd.oci.image.layer.v1.tar', 'application/vnd.oci.image.layer.v1.tar+gzip', 'application/vnd.docker.image.rootfs.diff.tar', 'application/vnd.docker.image.rootfs.diff.tar.gzip'}
CONFIG_TYPES = {'application/vnd.oci.image.config.v1+json', 'application/vnd.docker.container.image.v1+json'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def path_name(name):
    require(isinstance(name, str) and name and not any(c in name for c in ('\\', '\x00', '\r', '\n')), '不安全归档路径')
    p = PurePosixPath(name)
    require(not p.is_absolute() and '..' not in p.parts and name == p.as_posix() and p.parts[0] != '.', '归档路径必须是规范相对路径：' + name)
    return name


def known_image_name(name):
    return name in ('manifest.json', 'repositories', 'index.json', 'oci-layout') or BLOB.fullmatch(name) or LEGACY.fullmatch(name) or CONFIG.fullmatch(name)


def image_id(value):
    require(isinstance(value, str) and value.startswith('sha256:') and SHA.fullmatch(value[7:]), '预期镜像 ID 必须是 sha256: 加 64 位十六进制')
    return value


def digest_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024**2), b''):
            digest.update(chunk)
    return digest.hexdigest()


def digest_json(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()


def read_json(path):
    require(path.stat().st_size <= MAX_JSON, 'JSON 元数据超过大小上限')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'JSON 元数据包含重复键')
            result[key] = value
        return result
    def invalid(value):
        raise ValueError('JSON 元数据包含非有限值：' + value)
    return json.loads(path.read_text(), object_pairs_hook=unique, parse_constant=invalid)


def extract_checked(archive, directory, *, delta=False):
    files, total, members = {}, 0, 0
    with tarfile.open(archive, 'r|*') as stream:
        for member in stream:
            members += 1
            require(members <= MAX_FILES, '归档成员数量超过上限')
            name = path_name(member.name.rstrip('/') if member.isdir() else member.name)
            if member.isdir():
                continue
            require(member.isfile(), '归档只允许常规文件与目录，不允许链接或设备：' + name)
            require(name not in files, '归档包含重复文件：' + name)
            require(len(files) < MAX_FILES and 0 <= member.size <= MAX_MEMBER, '归档成员数量或大小超过上限')
            total += member.size
            require(total <= MAX_BYTES, '归档总大小超过 32 GiB 上限')
            if delta:
                require(name == 'openacad-delta.json' or name.startswith('payload/'), '未知增量成员：' + name)
            else:
                require(known_image_name(name), '不支持的镜像归档成员：' + name)
            target = directory / name
            target.parent.mkdir(parents=True, exist_ok=True)
            digest, count = hashlib.sha256(), 0
            source = stream.extractfile(member)
            require(source is not None, '无法读取归档成员：' + name)
            with target.open('xb') as output:
                for chunk in iter(lambda: source.read(1024**2), b''):
                    count += len(chunk)
                    require(count <= member.size, '成员实际内容超过声明大小')
                    digest.update(chunk)
                    output.write(chunk)
            require(count == member.size, '归档成员内容不完整：' + name)
            actual = digest.hexdigest()
            match = BLOB.fullmatch(name.removeprefix('payload/') if delta else name)
            require(not match or match[1] == actual, '内容地址 blob 的 SHA-256 不匹配：' + name)
            files[name] = {'name':name, 'size':count, 'sha256':actual}
    require(files, '归档为空')
    return files


def validate_inventory(value):
    require(isinstance(value, dict) and value.get('schemaVersion') == 1, '不支持的基线清单版本')
    image_id(value.get('imageId'))
    files = value.get('files')
    require(isinstance(files, list) and 0 < len(files) <= MAX_FILES, '基线清单成员列表无效')
    result = {}
    for entry in files:
        name = path_name(entry['name'])
        require(known_image_name(name), '清单包含不支持的镜像成员：' + name)
        require(name not in result and isinstance(entry.get('size'), int) and 0 <= entry['size'] <= MAX_MEMBER and isinstance(entry.get('sha256'), str) and SHA.fullmatch(entry['sha256']), '基线清单成员字段无效或重复')
        match = BLOB.fullmatch(name)
        require(not match or match[1] == entry['sha256'], '基线 blob 地址与实际 SHA 不一致')
        result[name] = {'name':name, 'size':entry['size'], 'sha256':entry['sha256']}
    require(sum(f['size'] for f in result.values()) <= MAX_BYTES, '基线清单总大小超过上限')
    return result


def validate_image(directory, files, expected):
    expected = image_id(expected)
    def load(name):
        require(name in files, '镜像缺少元数据：' + name)
        return read_json(directory / name)
    def ref(name):
        path_name(name)
        require(name in files, '镜像缺少 config/layer/blob：' + name)
        return files[name]
    def desc(value):
        require(isinstance(value, dict), 'OCI descriptor 必须是对象')
        digest = image_id(value.get('digest'))
        name = 'blobs/sha256/' + digest[7:]
        entry = ref(name)
        require(entry['size'] == value.get('size'), 'OCI descriptor 大小不匹配：' + name)
        return name
    images, attestations, runnable_manifests = [], [], set()
    root_digests = []
    seen = set()
    def inspect_descriptor(value, depth=0):
        require(depth <= 8, 'OCI 索引嵌套过深')
        name = desc(value)
        if name in seen:
            return
        seen.add(name)
        typ = value.get('mediaType')
        document = load(name)
        require(document.get('schemaVersion') == 2, '未知 OCI schemaVersion')
        if typ in INDEX_TYPES:
            require(isinstance(document.get('manifests'), list) and document['manifests'], 'OCI index 缺少 manifests')
            for child in document['manifests']:
                inspect_descriptor(child, depth+1)
        else:
            require(typ in MANIFEST_TYPES, '不支持的 OCI manifest mediaType：' + str(typ))
            attestation = document.get('artifactType') == 'application/vnd.docker.attestation.manifest.v1+json' or value.get('annotations', {}).get('vnd.docker.reference.type') == 'attestation-manifest'
            if attestation:
                require(document.get('config', {}).get('mediaType') in CONFIG_TYPES | {'application/vnd.oci.empty.v1+json'}, '未知 attestation config mediaType')
                attestation_config = desc(document['config'])
                require(isinstance(load(attestation_config), dict), 'Attestation config 不是 JSON 对象')
                require(isinstance(document.get('layers'), list) and document['layers'], 'Attestation 缺少载荷')
                for layer in document['layers']:
                    require(layer.get('mediaType') == 'application/vnd.in-toto+json', '未知 attestation layer mediaType')
                    require(isinstance(load(desc(layer)), dict), 'Attestation 载荷不是 JSON 对象')
                subjects = []
                if document.get('subject'):
                    subjects.append(desc(document['subject']))
                reference = value.get('annotations', {}).get('vnd.docker.reference.digest')
                if reference:
                    image_id(reference)
                    subjects.append('blobs/sha256/' + reference[7:])
                require(subjects, 'Attestation 未声明所对应的镜像 manifest')
                attestations.extend(subjects)
                return
            require(document.get('config', {}).get('mediaType') in CONFIG_TYPES, '不支持的 OCI config mediaType')
            config = desc(document['config'])
            layers, compression = [], []
            require(isinstance(document.get('layers'), list), 'OCI manifest 缺少 layers')
            for layer in document['layers']:
                require(layer.get('mediaType') in LAYER_TYPES, '不支持的 OCI layer mediaType：' + str(layer.get('mediaType')))
                layers.append(desc(layer))
                compression.append(layer['mediaType'].endswith('gzip'))
            images.append((config, layers, compression))
            runnable_manifests.add(name)
    if 'oci-layout' in files or 'index.json' in files:
        require(load('oci-layout').get('imageLayoutVersion') == '1.0.0', '不支持的 OCI layout 版本')
        index = load('index.json')
        require(index.get('schemaVersion') == 2 and isinstance(index.get('manifests'), list) and index['manifests'], 'OCI index 无效')
        require(len(index['manifests']) == 1, '顶层 OCI index 必须只指定一个镜像根')
        root_digests = [index['manifests'][0].get('digest')]
        for item in index['manifests']:
            inspect_descriptor(item)
    docker_images, tags = [], []
    if 'manifest.json' in files:
        manifest = load('manifest.json')
        require(isinstance(manifest, list) and len(manifest) == 1, '只支持单镜像 Docker save 归档')
        entry = manifest[0]
        tags = entry.get('RepoTags') or []
        require(isinstance(tags, list) and all(isinstance(tag, str) for tag in tags), 'Docker RepoTags 格式无效')
        config, layers = entry.get('Config'), entry.get('Layers')
        require(isinstance(config, str) and isinstance(layers, list), 'Docker manifest 缺少 Config/Layers')
        ref(config)
        for name in layers:
            ref(name)
        docker_images.append((config, layers, [False] * len(layers)))
    require(images or docker_images, '未知归档格式：缺少 Docker manifest 或 OCI index')
    require(len(images) <= 1, '只支持单平台单镜像 OCI 归档')
    require(all(subject in runnable_manifests for subject in attestations), 'Attestation 引用未对应唯一可运行镜像')
    if images and docker_images:
        require(images[0][:2] == docker_images[0][:2], 'OCI 与 Docker manifest 的 config/layers 不一致')
    config, layers, compressed = (images or docker_images)[0]
    config_digest = 'sha256:' + ref(config)['sha256']
    require(expected in [config_digest, *root_digests], 'config 或唯一 OCI 根 SHA-256 与预期镜像 ID 不一致，禁止发行')
    config_json = load(config)
    diff_ids = config_json.get('rootfs', {}).get('diff_ids')
    require(config_json.get('rootfs', {}).get('type') == 'layers' and isinstance(diff_ids, list) and len(diff_ids) == len(layers), 'config rootfs.diff_ids 与 layers 不对应')
    for name, compressed_layer, wanted in zip(layers, compressed, diff_ids):
        image_id(wanted)
        actual = ref(name)['sha256']
        if compressed_layer:
            digest, count = hashlib.sha256(), 0
            with gzip.open(directory / name, 'rb') as stream:
                for chunk in iter(lambda: stream.read(1024**2), b''):
                    count += len(chunk)
                    require(count <= MAX_MEMBER, '解压层超过大小上限')
                    digest.update(chunk)
            actual = digest.hexdigest()
        require('sha256:' + actual == wanted, '层内容与 config diff_id 不匹配：' + name)
    runtime_config = config_json.get('config') or {}
    require(isinstance(runtime_config, dict), '镜像 Config 必须是对象')
    kind = 'config' if expected == config_digest else 'oci-root'
    return {'imageId':expected, 'identityKind':kind, 'configDigest':config_digest,
        'acceptedExpectedIdentity':{'digest':expected, 'kind':kind}, 'topLevelDigest':root_digests[0] if root_digests else None,
        'architecture':config_json.get('architecture'), 'os':config_json.get('os'), 'rootfsDiffIds':diff_ids,
        'runtimeConfigKeys':sorted(runtime_config), 'runtimeConfigSha256':digest_json(runtime_config),
        'ociRootDigests':root_digests, 'attestationReferences':len(attestations),
        'format':'oci-docker' if images and docker_images else 'oci' if images else 'docker-legacy', 'layers':layers, 'config':config, 'repoTags':tags}


def write_archive(output, entries):
    output = Path(output)
    require(not os.path.lexists(output), '输出文件已存在，拒绝覆盖：' + str(output))
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + '.partial')
    require(not os.path.lexists(temporary), '发现未完成输出，请检查后移除：' + str(temporary))
    descriptor = None
    created_temporary = False
    try:
        mode = 'w:gz' if output.name.endswith('.gz') else 'w'
        options = {'compresslevel': 1} if mode == 'w:gz' else {}
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        created_temporary = True
        with os.fdopen(descriptor, 'wb') as destination:
            descriptor = None
            with tarfile.open(fileobj=destination, mode=mode, format=tarfile.PAX_FORMAT, **options) as archive:
                for name, path in entries:
                    name = path_name(name)
                    info = tarfile.TarInfo(name)
                    info.size, info.mode, info.mtime = path.stat().st_size, 0o644, 0
                    with path.open('rb') as source:
                        archive.addfile(info, source)
            destination.flush()
            os.fsync(destination.fileno())
        # Publish atomically without overwriting a path created concurrently.
        os.link(temporary, output)
        temporary.unlink()
    except BaseException:
        if descriptor is not None:
            os.close(descriptor)
        if created_temporary:
            temporary.unlink(missing_ok=True)
        raise


def inventory(args):
    with tempfile.TemporaryDirectory(prefix='openacad-image-inventory-') as temp:
        directory = Path(temp)
        files = extract_checked(args.archive, directory)
        validate_image(directory, files, args.expected_image_id)
        value = {'schemaVersion':1, 'archivePath':str(args.archive), 'archiveSha256':digest_file(args.archive), 'imageId':args.expected_image_id, 'files':list(files.values())}
        args.output.write_text(json.dumps(value, indent=2) + '\n')


def create(args):
    baseline = read_json(args.baseline_inventory)
    baseline_files = validate_inventory(baseline)
    by_content = {(f['size'], f['sha256']): name for name, f in baseline_files.items()}
    with tempfile.TemporaryDirectory(prefix='openacad-image-delta-') as temp:
        directory = Path(temp)
        files = extract_checked(args.target, directory)
        info = validate_image(directory, files, args.expected_image_id)
        entries, plan = [], []
        for name, entry in files.items():
            old = by_content.get((entry['size'], entry['sha256'])) if name in info['layers'] else None
            source = 'baseline' if old else 'delta'
            plan.append({**entry, 'source':source, **({'baselineName':old} if old else {})})
            if not old:
                entries.append(('payload/' + name, directory / name))
        manifest = {'schemaVersion':1, 'kind':'openacad-docker-save-delta', 'expectedImageId':args.expected_image_id,
            'baselineImageId':baseline['imageId'], 'baselineInventorySha256':digest_file(args.baseline_inventory),
            'baselineFiles':list(baseline_files.values()), 'targetArchiveSha256':digest_file(args.target), 'files':plan}
        metadata = directory / 'openacad-delta.json'
        metadata.write_text(json.dumps(manifest, indent=2) + '\n')
        write_archive(args.output, [('openacad-delta.json', metadata), *entries])
        report = {**info, 'sourceArchiveSha256':manifest['targetArchiveSha256'], 'deltaSha256':digest_file(args.output), 'deltaBytes':args.output.stat().st_size,
            'reusedFiles':sum(f['source']=='baseline' for f in plan), 'reusedBytes':sum(f['size'] for f in plan if f['source']=='baseline'),
            'payloadFiles':len(entries), 'payloadBytes':sum(f['size'] for f in plan if f['source']=='delta')}
        args.report.write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report))


def assemble(args):
    with tempfile.TemporaryDirectory(prefix='openacad-image-assemble-') as temp:
        directory = Path(temp)
        delta_dir, base_dir = directory / 'delta', directory / 'baseline'
        delta_files = extract_checked(args.delta, delta_dir, delta=True)
        require('openacad-delta.json' in delta_files, '增量缺少计划元数据')
        manifest = read_json(delta_dir / 'openacad-delta.json')
        require(manifest.get('schemaVersion') == 1 and manifest.get('kind') == 'openacad-docker-save-delta', '未知增量格式')
        require(manifest.get('expectedImageId') == args.expected_image_id, '增量目标镜像与命令指定 ID 不一致')
        wanted_base = validate_inventory({'schemaVersion':1, 'imageId':manifest.get('baselineImageId'), 'files':manifest.get('baselineFiles')})
        base_files = extract_checked(args.baseline, base_dir)
        require(base_files == wanted_base, '本地旧归档与已核实基线清单不同，禁止重组')
        validate_image(base_dir, base_files, manifest['baselineImageId'])
        plan = manifest.get('files')
        wanted_target = validate_inventory({'schemaVersion':1, 'imageId':args.expected_image_id, 'files':plan})
        joined = directory / 'joined'
        used_delta = {'openacad-delta.json'}
        for entry in plan:
            name = entry['name']
            if entry.get('source') == 'baseline':
                old = path_name(entry.get('baselineName'))
                require(old in base_files, '基线缺少重用成员：' + old)
                actual, source = base_files[old], base_dir / old
            else:
                require(entry.get('source') == 'delta', '未知增量成员来源')
                payload = 'payload/' + name
                require(payload in delta_files, '增量缺少成员：' + payload)
                used_delta.add(payload)
                actual, source = delta_files[payload], delta_dir / payload
            require(actual['size'] == entry['size'] and actual['sha256'] == entry['sha256'], '重组来源成员内容不匹配：' + name)
            target = joined / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.hardlink_to(source)
        require(set(delta_files) == used_delta, '增量包含计划之外的额外成员')
        info = validate_image(joined, wanted_target, args.expected_image_id)
        require(all(e['source'] != 'baseline' or e['name'] in info['layers'] for e in plan), '增量错误地重用了元数据；所有目标元数据必须随增量提供')
        write_archive(args.output, [(e['name'], joined/e['name']) for e in plan])
        report = {**info, 'reconstructedArchiveSha256':digest_file(args.output), 'archiveBytes':args.output.stat().st_size,
            'deltaSha256':digest_file(args.delta), 'filesVerified':len(plan), 'allFilesVerified':True,
            'dockerLoadVerified':False, 'nextRequiredCheck':'docker load 后读取实际 tag 的 docker image inspect JSON，使用 verify-loaded 核对 OCI 根/config 身份、RootFS、平台及 Config；未核对禁止发布'}
        args.report.write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report))


def verify_loaded(args):
    report = read_json(args.assembly_report)
    require(report.get('allFilesVerified') is True, '必须先完成全部成员重组校验')
    inspected = read_json(args.inspect_json)
    if isinstance(inspected, list):
        require(len(inspected) == 1, 'inspect JSON 必须只有实际加载 tag 对应的一个镜像')
        inspected = inspected[0]
    require(isinstance(inspected, dict), 'inspect JSON 结构无效')
    config_digest = image_id(report['configDigest'])
    top_digest = report.get('topLevelDigest')
    require(inspected.get('Id') in [config_digest, top_digest] and inspected.get('Id'), '已加载镜像 ID 不匹配已验证的 config 或 OCI 根')
    descriptor = inspected.get('Descriptor')
    if descriptor:
        require(top_digest and descriptor.get('digest') == top_digest, '已加载镜像 Descriptor.digest 与归档 OCI 根不符')
    require(inspected.get('Architecture') == report.get('architecture') and inspected.get('Os') == report.get('os'), '已加载镜像平台不匹配')
    require(inspected.get('RootFS', {}).get('Type') == 'layers' and inspected.get('RootFS', {}).get('Layers') == report['rootfsDiffIds'], '已加载镜像 RootFS 层内容不匹配')
    runtime = inspected.get('Config') or {}
    require(isinstance(runtime, dict), '已加载镜像 Config 结构无效')
    require(digest_json({k:runtime.get(k) for k in report['runtimeConfigKeys']}) == report['runtimeConfigSha256'], '已加载镜像 Config 字段（含 User/Env/Cmd/Labels）与归档不符')
    require(all(tag in (inspected.get('RepoTags') or []) for tag in report['repoTags']), '已加载镜像缺少归档声明的 tag')
    result = {'dockerLoadVerified':True, 'loadedId':inspected['Id'], 'configDigest':config_digest, 'topLevelDigest':top_digest,
        'acceptedExpectedIdentity':report['acceptedExpectedIdentity'], 'rootfsVerified':True, 'runtimeConfigVerified':True,
        'architecture':report.get('architecture'), 'os':report.get('os'), 'inspectJsonSha256':digest_file(args.inspect_json),
        'reconstructedArchiveSha256':report['reconstructedArchiveSha256']}
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('inventory')
    p.add_argument('--archive', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--expected-image-id', required=True)
    p.set_defaults(function=inventory)
    p = sub.add_parser('create')
    p.add_argument('--target', type=Path, required=True)
    p.add_argument('--baseline-inventory', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    p.add_argument('--expected-image-id', required=True)
    p.set_defaults(function=create)
    p = sub.add_parser('assemble')
    p.add_argument('--baseline', type=Path, required=True)
    p.add_argument('--delta', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    p.add_argument('--expected-image-id', required=True)
    p.set_defaults(function=assemble)
    p = sub.add_parser('verify-loaded')
    p.add_argument('--assembly-report', type=Path, required=True)
    p.add_argument('--inspect-json', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.set_defaults(function=verify_loaded)
    args = parser.parse_args()
    if hasattr(args, 'expected_image_id'):
        image_id(args.expected_image_id)
    try:
        args.function(args)
    except (ValueError, OSError, tarfile.TarError, json.JSONDecodeError, KeyError, TypeError, AttributeError) as error:
        parser.exit(1, '镜像归档校验失败：' + str(error) + '\n')


if __name__ == '__main__':
    main()
