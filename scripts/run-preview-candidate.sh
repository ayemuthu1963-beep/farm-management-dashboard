#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --dry-run|--execute PURPOSE FRONTEND_IMAGE BACKEND_IMAGE [TIMESTAMP]" >&2
}
[[ $# -ge 4 ]] || { usage; exit 2; }
mode=$1 purpose=$2 frontend_image=$3 backend_image=$4 timestamp=${5:-$(date +%Y%m%d-%H%M%S)}
[[ "$mode" == --dry-run || "$mode" == --execute ]] || { usage; exit 2; }
[[ "$frontend_image" != *:latest && "$frontend_image" != *:preview && "$frontend_image" != *:current && "$frontend_image" != *:stable ]] || { echo "Mutable image tag blocked" >&2; exit 1; }
[[ "$backend_image" != *:latest && "$backend_image" != *:preview && "$backend_image" != *:current && "$backend_image" != *:stable ]] || { echo "Mutable image tag blocked" >&2; exit 1; }

front_name="mfms-pilot-web-candidate-$timestamp"
back_name="harvest-api-pilot-candidate-$timestamp"
cat <<EOF
Candidate plan:
- purpose: $purpose
- frontend: $front_name, 127.0.0.1:3016 -> 3000
- backend: $back_name, 127.0.0.1:8016 -> 8000
- network: harvest-net
- database: mfms_server_uat
- public proxy: unchanged
- scheduled jobs: disabled (candidate containers never install host cron)
- ODK imports: prohibited
EOF
[[ "$mode" == --dry-run ]] && exit 0
[[ "${CANDIDATE_APPROVED:-}" == YES ]] || { echo "Execution requires CANDIDATE_APPROVED=YES" >&2; exit 1; }
[[ -f "${FRONTEND_ENV_FILE:-}" && -f "${BACKEND_ENV_FILE:-}" ]] || { echo "Candidate env files are required and must remain outside version control" >&2; exit 1; }
docker run -d --name "$back_name" --network harvest-net --restart no -p 127.0.0.1:8016:8000 --env-file "$BACKEND_ENV_FILE" "$backend_image"
docker run -d --name "$front_name" --network harvest-net --restart no -p 127.0.0.1:3016:3000 --env-file "$FRONTEND_ENV_FILE" -e HARVEST_API_BASE_URL="http://$back_name:8000" "$frontend_image"
echo "Run scripts/test-preview-release.sh http://127.0.0.1:3016 before any public replacement."
echo "After testing: docker rm -f $front_name $back_name"
