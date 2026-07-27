#!/usr/bin/env bash
set -euo pipefail

manifest=${1:-deploy/preview-baseline.json}
ssh_target=${MFMS_SSH_TARGET:-muthu@168.144.179.221}
critical=0
unverified=0

json_value() {
  python - "$manifest" "$1" <<'PY'
import json,sys
value=json.load(open(sys.argv[1],encoding="utf-8"))
for part in sys.argv[2].split("."): value=value[part]
print(value)
PY
}
remote() { ssh -o BatchMode=yes "$ssh_target" "$1"; }
check() {
  local name=$1 expected=$2 actual=$3 severity=${4:-critical}
  if [[ "$expected" == "$actual" ]]; then echo "MATCH|$name|$actual"; else echo "DRIFT|$name|expected=$expected|actual=$actual"; [[ "$severity" == critical ]] && critical=$((critical + 1)); fi
}

live_front_tag=$(remote "docker inspect mfms-pilot-web --format '{{.Config.Image}}'")
live_front_id=$(remote "docker inspect mfms-pilot-web --format '{{.Image}}'")
live_back_tag=$(remote "docker inspect harvest-api-pilot --format '{{.Config.Image}}'")
live_back_id=$(remote "docker inspect harvest-api-pilot --format '{{.Image}}'")
live_db=$(remote "docker exec harvest-api-pilot python -c 'from urllib.parse import urlparse; from app.config import get_settings; print(urlparse(get_settings().database_url).path.lstrip(chr(47)))'")
cron=$(remote "crontab -l")
proxy=$(remote "docker exec central-nginx-1 grep -F 'proxy_pass http://mfms-pilot-web:3000' /etc/nginx/conf.d/odk.conf | wc -l")

check frontend_image "$(json_value frontend_image)" "$live_front_tag"
check frontend_image_id "$(json_value frontend_image_id)" "$live_front_id"
check backend_image "$(json_value backend_image)" "$live_back_tag"
check backend_image_id "$(json_value backend_image_id)" "$live_back_id"
check database "$(json_value database)" "$live_db"
check harvest_auto_sync disabled "$([[ $(grep -Fc run_preview_harvest_sync.sh <<<"$cron" || true) -eq 0 ]] && echo disabled || echo enabled)"
check well_water_cron "30 3,13 * * *" "$(grep run_preview_well_water_sync.sh <<<"$cron" | awk '{print $1,$2,$3,$4,$5}')"
check beetle_cron "30 6 * * *" "$(grep run_preview_beetle_sync.sh <<<"$cron" | awk '{print $1,$2,$3,$4,$5}')"
check frontend_proxy 1 "$proxy"
check well_wrapper executable "$(remote "test -x /home/muthu/muthu-harvest-dashboard/scripts/run_preview_well_water_sync.sh && echo executable || echo not-executable")"
check beetle_wrapper executable "$(remote "test -x /home/muthu/muthu-harvest-dashboard/scripts/run_preview_beetle_sync.sh && echo executable || echo not-executable")"
check harvest_wrapper executable "$(remote "test -x /home/muthu/muthu-harvest-dashboard/scripts/run_preview_harvest_sync.sh && echo executable || echo not-executable")"

root_record="$(dirname "$manifest")/root-crontab-verification.txt"
if [[ -f "$root_record" ]] && grep -Fqx 'VERIFIED — ROOT HAS NO CRONTAB' "$root_record"; then
  echo "MATCH|root_crontab|VERIFIED — ROOT HAS NO CRONTAB"
elif remote "crontab -u root -l >/dev/null 2>&1"; then
  echo "MATCH|root_crontab|inspected"
else
  echo "UNVERIFIED DUE TO PRIVILEGE|root_crontab"
  unverified=1
fi
echo "SUMMARY|critical_drift=$critical|unverified=$unverified"
[[ $critical -eq 0 ]] || { echo "DEPLOYMENT BLOCKED — CRITICAL PREVIEW CONFIGURATION DRIFT" >&2; exit 1; }
