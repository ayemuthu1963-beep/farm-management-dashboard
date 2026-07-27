#!/usr/bin/env bash
set -euo pipefail

ssh_target=${MFMS_SSH_TARGET:-muthu@168.144.179.221}
frontend_repo=${1:-$(pwd)}
backend_repo=${2:-../muthu-harvest-dashboard-preview-release}
failures=0

pass() { echo "PASS|$1|$2"; }
fail() { echo "FAIL|$1|$2" >&2; failures=$((failures + 1)); }
assert_file() { local label=$1 file=$2 pattern=$3; grep -Eq "$pattern" "$file" && pass "$label" "$pattern" || fail "$label" "$pattern"; }
remote() { ssh -o BatchMode=yes "$ssh_target" "$1"; }

database=$(remote "docker exec harvest-api-pilot python -c 'from urllib.parse import urlparse; from app.config import get_settings; print(urlparse(get_settings().database_url).path.lstrip(chr(47)))'")
[[ "$database" == mfms_server_uat ]] && pass database "$database" || fail database "$database"

cron=$(remote "crontab -l")
[[ $(grep -Fc run_preview_harvest_sync.sh <<<"$cron" || true) -eq 0 ]] && pass harvest_cron disabled || fail harvest_cron enabled
[[ $(grep -Fxc '30 3,13 * * * /home/muthu/muthu-harvest-dashboard/scripts/run_preview_well_water_sync.sh >> /home/muthu/mfms_logs/preview_well_water_sync.log 2>&1' <<<"$cron" || true) -eq 1 ]] && pass well_water_cron twice_daily || fail well_water_cron drift
[[ $(grep -Fxc '30 6 * * * /home/muthu/muthu-harvest-dashboard/scripts/run_preview_beetle_sync.sh >> /home/muthu/mfms_logs/preview_beetle_sync.log 2>&1' <<<"$cron" || true) -eq 1 ]] && pass beetle_cron daily || fail beetle_cron drift

assert_file harvest_project "$backend_repo/api/app/routers/harvest_sync_admin.py" '^PROJECT_ID = 17$'
assert_file harvest_form "$backend_repo/api/app/routers/harvest_sync_admin.py" 'FORM_ID = "mfms_preview_harvest_test_v1"'
assert_file well_water_project "$backend_repo/api/app/config.py" 'odk_well_water_project_id: str = "15"'
assert_file beetle_project "$backend_repo/api/app/routers/beetle_trap.py" 'PROJECT_ID.*16|project_id.*16'
assert_file detailed_endpoint "$backend_repo/api/app/routers/dashboard.py" '@router.get\\("/detailed-query"\\)'
assert_file detailed_no_n_plus_one "$frontend_repo/lib/coconut-harvest-api.ts" '/api/detailed-query'
assert_file century_maker "$frontend_repo/lib/coconut-harvest-data.ts" 'Century Maker'
assert_file timeout_recovery "$frontend_repo/app/coconut-harvest/detailed-query/page.tsx" '45_000'
assert_file manual_sync "$frontend_repo/app/admin/harvest-cycle/page.tsx" 'Manual ODK Harvest Sync'
assert_file preview_label "$frontend_repo/components/admin/preview-admin-notice.tsx" 'PREVIEW / UAT'
assert_file irrigation_zones "$frontend_repo/app/irrigation-management/page.tsx" 'Nutmeg'
assert_file fertiliser_tabs "$frontend_repo/app/fertiliser-management/page.tsx" 'Requirements|Stock|Transactions'

cycle=$(remote "docker exec harvest-api-pilot python -c 'import psycopg; from app.config import get_settings; c=psycopg.connect(get_settings().database_url); print(c.execute(\"select harvest_cycle,harvest_status,harvest_start_date,harvest_end_date from harvest_cycles where harvest_cycle=%s\",(\"19\",)).fetchone())'")
grep -q "Open.*None" <<<"$cycle" && pass cycle19_open "$cycle" || fail cycle19_open "$cycle"
tree893=$(remote "docker exec harvest-api-pilot python -c 'import psycopg; from app.config import get_settings; c=psycopg.connect(get_settings().database_url); print(c.execute(\"select count(*) from tree_master where tree_no=%s\",(\"893\",)).fetchone()[0])'")
[[ "$tree893" == 0 ]] && pass tree893 excluded || fail tree893 "tree_master_count=$tree893"

[[ $failures -eq 0 ]] || { echo "LIVE-DATA CONTRACT TEST FAILED — $failures CONTRACT(S)" >&2; exit 1; }
echo "LIVE-DATA CONTRACT TEST PASSED"
