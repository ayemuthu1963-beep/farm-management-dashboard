#!/usr/bin/env bash
set -Eeuo pipefail

blocked() {
  echo "PREVIEW_DEPLOY_PROGRAM_REPAIR_BLOCKED=$1" >&2
  exit 1
}

[[ "${SSH_ORIGINAL_COMMAND:-}" == "bash -s --" ]] \
  || blocked "the repair must use the restricted Preview command"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Preview SSH user is muthu"
[[ "${EXPECTED_OLD_SHA:-}" =~ ^[0-9a-f]{64}$ ]] \
  || blocked "the expected old program digest is invalid"
[[ "${EXPECTED_NEW_SHA:-}" =~ ^[0-9a-f]{64}$ ]] \
  || blocked "the expected new program digest is invalid"
[[ -n "${PROGRAM_BASE64:-}" ]] || blocked "the trusted replacement program is missing"

for required_command in awk base64 bash chmod cp date dirname id mktemp mv rm sha256sum stat; do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

readonly candidates=(
  "/home/muthu/muthu-harvest-dashboard/scripts/preview-server-deploy.sh"
  "/home/muthu/farm-management-dashboard/scripts/preview-server-deploy.sh"
  "/home/muthu/coconut-harvest/scripts/preview-server-deploy.sh"
  "/home/muthu/.local/bin/preview-server-deploy.sh"
  "/home/muthu/bin/preview-server-deploy.sh"
)

matches=()
for candidate in "${candidates[@]}"; do
  [[ -f "$candidate" && ! -L "$candidate" ]] || continue
  digest=$(sha256sum "$candidate" | awk '{print $1}')
  echo "candidate_program=$candidate digest=$digest"
  if [[ "$digest" == "$EXPECTED_OLD_SHA" ]]; then
    matches+=("$candidate")
  fi
done

[[ "${#matches[@]}" -eq 1 ]] \
  || blocked "exactly one trusted installed deploy program must match the approved old digest"

target=${matches[0]}
mode=$(stat -c '%a' "$target")
[[ "$mode" =~ ^[0-7]{3,4}$ ]] || blocked "installed deploy program mode is invalid"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$target.before-short-revision-guard-$timestamp"
temporary=$(mktemp "$(dirname "$target")/.preview-server-deploy.repair.XXXXXX")

cleanup() {
  rm -f "$temporary"
}
trap cleanup EXIT

printf '%s' "$PROGRAM_BASE64" | base64 --decode > "$temporary"
chmod "$mode" "$temporary"
bash -n "$temporary"
[[ "$(sha256sum "$temporary" | awk '{print $1}')" == "$EXPECTED_NEW_SHA" ]] \
  || blocked "replacement deploy program digest does not match the reviewed source"

cp --preserve=mode "$target" "$backup"
mv "$temporary" "$target"
temporary=""

bash -n "$target"
[[ "$(sha256sum "$target" | awk '{print $1}')" == "$EXPECTED_NEW_SHA" ]] \
  || blocked "installed deploy program failed final digest verification"

echo "server_program_path=$target"
echo "backup_program_path=$backup"
echo "old_program_digest=$EXPECTED_OLD_SHA"
echo "new_program_digest=$EXPECTED_NEW_SHA"
echo "production_touched=0"
echo "backend_containers_changed=0"
echo "database_operations=0"
echo "odk_operations=0"
echo "scheduler_operations=0"
echo "proxy_configuration_operations=0"
echo "PREVIEW_DEPLOY_PROGRAM_REPAIR=PASS"
