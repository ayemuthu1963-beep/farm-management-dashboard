#!/usr/bin/env bash
set -euo pipefail

base_url=${1:-http://127.0.0.1:3015}
output=${2:-/tmp/mfms-preview-smoke.tsv}
auth_args=()
if [[ -n "${PREVIEW_HTTP_USER:-}" || -n "${PREVIEW_HTTP_PASSWORD:-}" ]]; then
  auth_args=(-u "${PREVIEW_HTTP_USER:-}:${PREVIEW_HTTP_PASSWORD:-}")
fi

printf 'route\thttp_status\tfinal_url\tseconds\texpected_marker\tmarker_result\n' > "$output"
failures=0

check() {
  local route=$1 marker=$2
  local body metrics status seconds final marker_result
  body=$(mktemp)
  metrics=$(curl -sS -L "${auth_args[@]}" -o "$body" -w '%{http_code}\t%{url_effective}\t%{time_total}' "$base_url$route" || true)
  status=$(cut -f1 <<<"$metrics"); final=$(cut -f2 <<<"$metrics"); seconds=$(cut -f3 <<<"$metrics")
  if grep -Fqi "$marker" "$body" && ! grep -Eqi 'mfms_local_test|mock fallback|localhost:[0-9]+' "$body"; then marker_result=PASS; else marker_result=FAIL; fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$route" "$status" "$final" "$seconds" "$marker" "$marker_result" >> "$output"
  [[ "$status" == 200 && "$marker_result" == PASS ]] || failures=$((failures + 1))
  rm -f "$body"
}

check / "DIGITAL FARM MANAGEMENT SYSTEM"
check /coconut-harvest "Coconut Harvest"
check /coconut-harvest/live-counter "Harvest Live Counter"
check /coconut-harvest/tree-view "Tree View"
check /coconut-harvest/cycle-view "Harvest Cycle"
check '/api/coconut-harvest/cycle-details?cycle=19' '"cycle":19'
check /coconut-harvest/tree-performance "Tree Performance"
check /coconut-harvest/detailed-query "Detailed Search and Filter"
check /coconut-harvest/tree-wise-query "Tree-wise Table Query"
check /jackfruit-monitoring "Jackfruit"
check /well-water "Well Water"
check /motor-runtime "Motor Runtime"
check /irrigation-management "Irrigation"
check /beetle-trap "Beetle Trap"
check /pipeline-layout "Pipeline"
check /farm-map "Farm Map"
check /fertiliser-management "Fertiliser"
check /inventory-management "Asset Register"
check /admin "Admin"
check /admin/tree-lifecycle "Tree Lifecycle / Sapling Status"
check /admin/harvest "Harvest"
check /admin/harvest-cycle "Manual ODK Harvest Sync"
check /admin/harvest-sync "Sync mode:"
check '/api/coconut-harvest/harvest-summary?harvest_cycle=19' '"harvestCycle":"19"'

cat "$output"
[[ $failures -eq 0 ]] || { echo "PREVIEW SMOKE TEST FAILED — $failures CRITICAL ROUTE(S)" >&2; exit 1; }
echo "PREVIEW SMOKE TEST PASSED"
