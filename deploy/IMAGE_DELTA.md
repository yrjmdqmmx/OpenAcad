# 私有镜像增量发行

此流程复用已完整保存的旧 Docker 归档内容，不重新构建应用，不发布服务，不需要把 GitHub 凭据传给服务器。只有手动 `workflow_dispatch` 会运行增量工作流。

1.0.0 历史来源（用于复现旧发行，不是后续版本的默认来源）：构建运行 `34044909758`，源码 `23d5bb098d4b1a6d8551f3de8fe6e88893807f91`，目标 CI config digest `sha256:f5a6ac07b01aca00c5e0f5a849db06bd50286ea02335b40b26991aaf985612d4`。基线清单为 `docs/deployment/evidence/baseline-archive.json`，对应香港服务器的旧归档 `/opt/openacad/releases/openacad-worker.tar.gz`。该文件必须是完整旧归档，不能替换成下载未完成的新归档。

1. 提交工具、手动工作流与基线清单后，在当前私有仓库手动触发 `worker-delta.yml`。工作流保留的默认参数属于上述 1.0.0 历史发行。每次新发行都必须显式填写当次成功的 `source_run`、完整 `source_sha` 和对应 CI config digest `expected_image_id`；最新已部署值见[正式发布记录](../docs/deployment/production-record.md)。它核对原构建属于当前私有仓库、来自 `verify.yml`、完整成功且源码 SHA 相同，然后下载该运行的 `worker-image`。
2. 下载新运行的私有 `worker-image-delta` 附件。包含 `openacad-worker.delta.tar.gz`、`delta-report.json`、来源记录和重组脚本。核对压缩包 SHA-256 等于 `delta-report.json` 的 `deltaSha256`；不要公开附件或临时下载链接。
3. 将增量文件和 `image_delta.py` 放到本次发行的独立目录，在服务器运行下列重组命令。建议通过 `TMPDIR` 指定有至少 5 GiB 空闲空间的同一文件系统临时目录；不挂载其他应用数据。脚本会暂存已校验成员，以硬链接组成目标视图，最后原子生成输出；失败不会留下可误用的目标归档。

先按当前构建报告设置 `OPENACAD_EXPECTED_CONFIG_DIGEST`；下面的参数表示 CI config digest，不是 containerd 的 OCI 根 ID。

```sh
python3 image_delta.py assemble \
  --baseline /opt/openacad/releases/openacad-worker.tar.gz \
  --delta openacad-worker.delta.tar.gz \
  --expected-image-id "$OPENACAD_EXPECTED_CONFIG_DIGEST" \
  --output openacad-worker-reconstructed.tar \
  --report reconstruction-report.json
```

4. 重组报告应为 `allFilesVerified: true`，但它仍明确标记 `dockerLoadVerified: false`。加载后核对**归档携带的 tag**，不能只查询服务器原本可能已有的某个镜像 ID：

```sh
docker load --input openacad-worker-reconstructed.tar
docker image inspect openacad-worker:verified > loaded-image-inspect.json
python3 image_delta.py verify-loaded \
  --assembly-report reconstruction-report.json \
  --inspect-json loaded-image-inspect.json \
  --output loaded-image-verification.json
```

`OPENACAD_EXPECTED_CONFIG_DIGEST` 必须先设置为本次成功构建的 `sha256:…` config digest，并与本次增量来源记录逐字相等，不能沿用历史发行值。传统 Docker 的 `.Id` 常为 config digest，containerd 存储引擎可能返回 OCI manifest/index digest；两者不可混称。报告分别给出 `configDigest`、`topLevelDigest` 与 `acceptedExpectedIdentity`。`verify-loaded` 同时核对实加载 tag 的 Id/Descriptor、RootFS 全部 diff_ids、架构/系统和镜像 Config 字段哈希（含 User/Env/Cmd/Labels），必须返回 `dockerLoadVerified: true`，才可另行标记发行 tag 并执行既有部署流程。本工具不执行加载、标记、部署或删除旧镜像。

校验包含：归档路径和类型、重复成员、内容地址 SHA-256、全部基线成员实测 SHA、所有目标元数据、config ID、OCI descriptor 引用与大小、Docker/OCI 层顺序一致性以及每层解压内容对应的 `rootfs.diff_ids`。支持标准 BuildKit attestation 元数据及其 subject 引用、OCI 裸层与 gzip 层，以及传统 Docker save 的 `<layer-id>/layer.tar`；未知格式、多平台归档、链接/设备节点会明确失败。

新基线可用 `image_delta.py inventory --archive ... --expected-image-id ... --output ...` 生成实际 SHA 清单。只有真实层可复用；传统层即使路径不同，也只按实际内容 SHA 和大小复用。增量不是完整 Docker 归档，禁止直接 `docker load` 或将部分文件标为发行完成。

回归验证：`python3 -m unittest discover -s deploy/tests -v`。重组归档的压缩字节和外层 tar 头可能与原始附件不同；逐成员内容、配置 ID 与加载后的 Docker 镜像 ID 才是此流程的等价性证据。
