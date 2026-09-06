#!/usr/bin/env bash
set -euo pipefail
release_dir=${1:?用法：update.sh /opt/openacad/releases/版本}
[[ "$release_dir" == /opt/openacad/releases/* && -f "$release_dir/compose.yml" && -f "$release_dir/release.env" && -f "$release_dir/web/index.html" ]] || { echo '发行目录结构不完整'; exit 1; }
mkdir -p /opt/openacad/shared
touch /opt/openacad/shared/maintenance
previous_dir=$(readlink -f /opt/openacad/current 2>/dev/null || true)
rollback() {
  if [[ -n "$previous_dir" && -f "$previous_dir/compose.yml" ]]; then
    ln -sfn "$previous_dir" /opt/openacad/current
    docker compose --env-file "$previous_dir/release.env" -f "$previous_dir/compose.yml" up -d --remove-orphans
    nginx -t && systemctl reload nginx
  else
    docker compose --env-file "$release_dir/release.env" -f "$release_dir/compose.yml" down
  fi
  rm -f /opt/openacad/shared/maintenance
}
trap rollback ERR
if [[ -n "$previous_dir" && -f "$previous_dir/compose.yml" ]]; then
  drained=false
  for attempt in $(seq 1 70); do
    count=$(docker compose --env-file "$previous_dir/release.env" -f "$previous_dir/compose.yml" exec -T api python -c 'from app.jobs import connection,queue; from rq.registry import StartedJobRegistry; c=connection(); q=queue(c); print(q.count+StartedJobRegistry(name=q.name,connection=c).count)')
    if [[ "$count" == 0 ]]; then drained=true; break; fi
    sleep 5
  done
  [[ "$drained" == true ]] || { echo '仍有计算任务，已中止更新'; false; }
fi
docker compose --env-file "$release_dir/release.env" -f "$release_dir/compose.yml" up -d --remove-orphans
healthy=false
for attempt in $(seq 1 36); do
  if curl -fsS http://127.0.0.1:13310/api/health | python3 -c 'import json,sys; s=json.load(sys.stdin); sys.exit(0 if s.get("workers",0)>=2 and s.get("status")=="ok" else 1)'; then healthy=true; break; fi
  sleep 5
done
[[ "$healthy" == true ]] || { echo '新版本健康检查未通过，正在恢复'; false; }
ln -sfn "$release_dir" /opt/openacad/current
nginx -t
systemctl reload nginx
rm -f /opt/openacad/shared/maintenance
trap - ERR
printf '发布完成：%s\n' "$release_dir"
