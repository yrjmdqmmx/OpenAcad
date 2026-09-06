#!/usr/bin/env bash
# Prepared only. Run after the parent confirms the new production release.
set -euo pipefail
release=${1:?Usage: run-on-server.sh RELEASE FULL_SOURCE_SHA ACTUAL_DOCKER_IMAGE_ID}
source_sha=${2:?Missing source SHA}
image_id=${3:?Missing actual Docker image ID}
[[ "$release" =~ ^[A-Za-z0-9._-]+$ ]]
[[ "$source_sha" =~ ^[a-f0-9]{40}$ ]]
[[ "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]]
bundle=$(cd -- "$(dirname -- "$0")" && pwd)
cd "$bundle"
sha256sum --check SHA256SUMS
test "$(readlink -f /opt/openacad/current)" = "/opt/openacad/releases/$release"
test "$(docker image inspect "openacad-worker:$release" --format '{{.Id}}')" = "$image_id"
output="/opt/openacad/verification/$release/output"
install -d -m 0750 -o 10001 -g 10001 "$output"
test ! -e "$output/report.json"
test ! -e "$output/baseline/report.json"
docker run --rm --name "openacad-production-smoke-$release" \
  --read-only --tmpfs /tmp:size=64m,mode=1777 --cpus=0.5 --memory=256m \
  --pids-limit=96 --cap-drop ALL --security-opt no-new-privileges --init \
  --mount "type=bind,src=$bundle,dst=/verification,readonly" \
  --mount "type=bind,src=$output,dst=/verification-output" \
  --entrypoint python "openacad-worker:$release" \
  /verification/acceptance.py run --base-url https://openacad.xyz \
  --source /verification/frozen-production-smoke.py \
  --font-manifest /verification/expected-font-manifest.json \
  --output /verification-output --release "$release" \
  --source-revision "$source_sha" --image-id "$image_id"
