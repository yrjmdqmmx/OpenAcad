set -eu
test "$(readlink -f /opt/openacad/current)" = /opt/openacad/releases/1.0.0-23d5bb0
test "$(docker image inspect openacad-worker:1.0.0-23d5bb0 --format '{{.Id}}')" = sha256:cec91c1f008073236405713073ff14011102d9913fecea48fbdcadfb0134d168
printf '%s\n' '744ac93024a8e687a963a36b4d47884fc786dcfd618fa9807e341307beec6580  /opt/openacad/verification/production-smoke-744ac930.py' | sha256sum --check
install -d -m 0750 -o 10001 -g 10001 /opt/openacad/verification/1.0.0-23d5bb0/output
test ! -e /opt/openacad/verification/1.0.0-23d5bb0/output/report.json
docker run --rm --name openacad-production-smoke-23d5bb0-final --read-only --tmpfs /tmp:size=64m,mode=1777 --cpus=0.5 --memory=256m --pids-limit=96 --cap-drop ALL --security-opt no-new-privileges --init --mount type=bind,src=/opt/openacad/verification/production-smoke-744ac930.py,dst=/verification.py,readonly --mount type=bind,src=/opt/openacad/verification/1.0.0-23d5bb0/output,dst=/verification-output --entrypoint python openacad-worker:1.0.0-23d5bb0 /verification.py https://openacad.xyz --output /verification-output --min-workers 2 --timeout 240 --skip-independent-open
