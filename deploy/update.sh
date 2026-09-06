#!/usr/bin/env bash
set -euo pipefail
release_dir=${1:?用法：update.sh /opt/openacad/releases/版本}
[[ "$release_dir" == /opt/openacad/releases/* && -f "$release_dir/compose.yml" && -f "$release_dir/release.env" && -f "$release_dir/web/index.html" ]] || { echo '发行目录结构不完整'; exit 1; }
mkdir -p /opt/openacad/shared
touch /opt/openacad/shared/maintenance
previous_dir=$(readlink -f /opt/openacad/current 2>/dev/null || true)
compose() { local directory=$1; shift; docker compose --env-file "$directory/release.env" -f "$directory/compose.yml" "$@"; }
wait_health() {
  local directory=$1
  for attempt in $(seq 1 36); do
    local ready=true
    for service in api worker-one worker-two; do
      local cid status
      cid=$(compose "$directory" ps -q "$service")
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$cid" 2>/dev/null || true)
      [[ "$status" == healthy ]] || ready=false
    done
    if [[ "$ready" == true ]] && curl -fsS --max-time 10 http://127.0.0.1:13310/api/health >/dev/null; then return 0; fi
    sleep 5
  done
  return 1
}
rollback() {
  trap - ERR
  echo '发布检查失败，正在恢复之前的 OpenAcad 版本。' >&2
  if [[ -n "$previous_dir" && -f "$previous_dir/compose.yml" ]]; then
    if compose "$previous_dir" up -d --remove-orphans && wait_health "$previous_dir"; then
      ln -sfn "$previous_dir" /opt/openacad/current
      if nginx -t && systemctl reload nginx; then rm -f /opt/openacad/shared/maintenance; echo '之前版本已恢复。' >&2; else echo 'Nginx 检查未通过，保留维护标记，请检查配置。' >&2; fi
    else echo '之前版本尚未恢复健康，保留维护标记，请查看 OpenAcad 容器日志。' >&2; fi
  else
    compose "$release_dir" down || true
    rm -f /opt/openacad/shared/maintenance
    echo '首次安装未完成，本次 OpenAcad 容器已停止。' >&2
  fi
  exit 1
}
trap rollback ERR
if [[ -n "$previous_dir" && -f "$previous_dir/compose.yml" ]]; then
  drained=false
  for attempt in $(seq 1 70); do
    count=$(compose "$previous_dir" exec -T api python -c 'from app.jobs import connection,queue; c=connection(); q=queue(c); print(q.count+q.started_job_registry.count)')
    if [[ "$count" == 0 ]]; then drained=true; break; fi
    sleep 5
  done
  [[ "$drained" == true ]] || { echo '仍有计算任务，已中止更新'; false; }
fi
compose "$release_dir" up -d --remove-orphans
wait_health "$release_dir"
ln -sfn "$release_dir" /opt/openacad/current
nginx -t
systemctl reload nginx
rm -f /opt/openacad/shared/maintenance
trap - ERR
printf '发布完成：%s\n' "$release_dir"
