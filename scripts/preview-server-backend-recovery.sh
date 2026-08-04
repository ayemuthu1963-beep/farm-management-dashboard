#!/usr/bin/env bash
#
# One-time, Preview-only adoption of the already-running ab6a78 backend into
# the backend controller's approved single-mount runtime contract. This is an
# administrator recovery program, not a general deployment route.
#
set -Eeuo pipefail

readonly expected_revision="ab6a78ba7869c2d18fd4dba2f7022febd38e7b77"
readonly expected_image_id="sha256:2d7e405460d75863009ba18877c657a6d818c9dfa4ddf97831ce6c6af1de385a"
readonly expected_image_tag="muthu-harvest-dashboard-harvest-api:preview-ab6a78b-20260804T124337Z"
readonly expected_stale_state_revision="4a4ac5aec9480ecc7eb902fad822fb6a2f11e87b"
readonly expected_stale_state_image_id="sha256:4783bc6edc47d52cd5ad5f518f97946721c7a057278696f16bf5b83249f2cbe9"
readonly expected_stale_state_run_id="30877563746"
readonly adopt_confirmation="RESTORE PREVIEW BACKEND TO APPROVED ONE MOUNT"
readonly rollback_confirmation="ROLL BACK PREVIEW BACKEND RECOVERY"

readonly backend_live_container="harvest-api-pilot"
readonly frontend_container="mfms-pilot-web"
readonly proxy_container="central-nginx-1"
readonly preview_network="harvest-net"
readonly database_name="mfms_server_uat"
readonly live_port="8015"
readonly candidate_port="8016"
readonly approved_restart_policy="no"
readonly approved_mount_source="/tmp"
readonly approved_mount_target="/host-tmp"
readonly screenshot_mount_source="/home/muthu/mfms_data/preview/motor-screenshot-analysis"
readonly screenshot_mount_target="/var/lib/mfms/motor-screenshot-analysis"
readonly expected_live_port_bindings='{"8000/tcp":[{"HostIp":"127.0.0.1","HostPort":"8015"}]}'
readonly expected_candidate_port_bindings='{"8000/tcp":[{"HostIp":"127.0.0.1","HostPort":"8016"}]}'

readonly state_dir="/home/muthu/.local/state/mfms-preview-github"
readonly state_file="$state_dir/last-successful-backend-switch"
readonly lock_file="$state_dir/deployment.lock"
readonly recovery_root="$state_dir/backend-recoveries"

operation=""
recovery_run_id=""
timestamp=""
work_dir=""
environment_file=""
checkpoint_dir=""
candidate_container=""
transaction_active=0
transaction_original_id=""
transaction_original_name=""
transaction_original_ip=""
transaction_original_profile=""
replacement_origin=""
state_changed=0
automatic_restore_result="not-required"

blocked() {
  echo "PREVIEW_BACKEND_RECOVERY_BLOCKED=$1" >&2
  return 1
}

require_exact_revision() {
  [[ "${1:-}" == "$expected_revision" ]] \
    || blocked "expected revision did not match the reviewed live Preview revision"
}

require_exact_image_id() {
  [[ "${1:-}" == "$expected_image_id" ]] \
    || blocked "expected image ID did not match the reviewed live Preview image"
}

require_recovery_run_id() {
  [[ "${1:-}" =~ ^recovery-[0-9]{8}T[0-9]{6}Z-[a-z0-9-]{1,40}$ ]] \
    || blocked "recovery run identifier is invalid"
}

validate_mounts_json() {
  local profile=$1 mounts_json=$2
  python3 -c '
import json
import sys

profile = sys.argv[1]
mounts = json.loads(sys.stdin.read())
projected = sorted(
    [
        {
            "Type": item.get("Type"),
            "Source": item.get("Source"),
            "Destination": item.get("Destination"),
            "Mode": item.get("Mode", ""),
            "RW": item.get("RW"),
            "Name": item.get("Name", ""),
            "Propagation": item.get("Propagation", ""),
        }
        for item in mounts
    ],
    key=lambda item: json.dumps(item, sort_keys=True),
)
approved = {
    "Type": "bind",
    "Source": "/tmp",
    "Destination": "/host-tmp",
    "Mode": "",
    "RW": True,
    "Name": "",
    "Propagation": "rprivate",
}
screenshot = {
    "Type": "bind",
    "Source": "/home/muthu/mfms_data/preview/motor-screenshot-analysis",
    "Destination": "/var/lib/mfms/motor-screenshot-analysis",
    "Mode": "",
    "RW": True,
    "Name": "",
    "Propagation": "rprivate",
}
expected = sorted(
    [approved] if profile == "approved" else [approved, screenshot],
    key=lambda item: json.dumps(item, sort_keys=True),
)
if profile not in {"approved", "legacy"} or projected != expected:
    raise SystemExit(1)
' "$profile" <<<"$mounts_json" \
    || blocked "container mount set does not match the exact $profile recovery contract"
}

require_empty_storage() {
  local path=$1
  [[ "$path" == "$screenshot_mount_source" || "${MFMS_RECOVERY_LIBRARY_ONLY:-}" == "1" ]] \
    || blocked "screenshot storage path is not the reviewed Preview path"
  [[ -d "$path" && ! -L "$path" ]] \
    || blocked "motor-screenshot storage directory is absent or is a symbolic link"
  [[ -z "$(find "$path" -xdev -type f -print -quit)" ]] \
    || blocked "motor-screenshot storage directory is not empty"
}

validate_feature_flags_json() {
  local flags_json=$1
  python3 -c '
import json
import sys

actual = json.loads(sys.stdin.read())
expected = {
    "storage_root_matches": True,
    "upload_enabled": False,
    "vision_enabled": False,
    "credential_configured": False,
}
if actual != expected:
    raise SystemExit(1)
' <<<"$flags_json" \
    || blocked "motor screenshot upload, Vision, credential, or storage-root configuration differs from the reviewed disabled state"
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1")" == "true" ]]
}

network_ip_for_container() {
  docker inspect \
    --format "{{with index .NetworkSettings.Networks \"$preview_network\"}}{{.IPAddress}}{{end}}" \
    "$1"
}

mounts_json_for_container() {
  docker inspect --format '{{json .Mounts}}' "$1"
}

image_revision_for_container() {
  local image_id
  image_id=$(docker inspect --format '{{.Image}}' "$1")
  docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id"
}

image_environment_for_container() {
  local image_id
  image_id=$(docker inspect --format '{{.Image}}' "$1")
  docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$image_id"
}

assert_port_bindings() {
  local container=$1 expected=$2
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container")" == "$expected" ]] \
    || blocked "backend port binding differs from the reviewed Preview binding"
}

assert_container_contract() {
  local container=$1 profile=$2 expected_port_json=$3 expected_ip=${4:-}
  container_exists "$container" || blocked "required Preview backend container is missing"
  container_running "$container" || blocked "required Preview backend container is not running"
  [[ "$(docker inspect --format '{{.Image}}' "$container")" == "$expected_image_id" ]] \
    || blocked "Preview backend image ID changed"
  [[ "$(image_revision_for_container "$container")" == "$expected_revision" ]] \
    || blocked "Preview backend revision changed"
  [[ "$(image_environment_for_container "$container")" == "Preview" ]] \
    || blocked "backend image environment label is not Preview"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container")" == "$approved_restart_policy" ]] \
    || blocked "Preview backend restart policy changed"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" == "$preview_network" ]] \
    || blocked "Preview backend network changed"
  assert_port_bindings "$container" "$expected_port_json"
  validate_mounts_json "$profile" "$(mounts_json_for_container "$container")"
  if [[ -n "$expected_ip" ]]; then
    [[ "$(network_ip_for_container "$container")" == "$expected_ip" ]] \
      || blocked "Preview backend network address changed"
  fi
}

feature_flags_json() {
  docker exec -i "$1" python - <<'PY'
import json
from app.config import get_settings

s = get_settings()
print(json.dumps({
    "storage_root_matches": s.motor_screenshot_storage_root == "/var/lib/mfms/motor-screenshot-analysis",
    "upload_enabled": bool(s.motor_screenshot_upload_enabled),
    "vision_enabled": bool(s.motor_screenshot_google_vision_enabled),
    "credential_configured": bool(s.google_application_credentials.strip()),
}, sort_keys=True))
PY
}

assert_disabled_features() {
  validate_feature_flags_json "$(feature_flags_json "$1")"
}

assert_database_target() {
  docker exec -i "$1" python - <<'PY'
from urllib.parse import urlparse
import psycopg
from app.config import get_settings

s = get_settings()
if urlparse(s.database_url).path.lstrip("/") != "mfms_server_uat":
    raise SystemExit(1)
with psycopg.connect(s.database_url) as conn:
    if conn.execute("select current_database()").fetchone()[0] != "mfms_server_uat":
        raise SystemExit(1)
PY
}

wait_for_health() {
  local base_url=$1 attempt body
  for attempt in $(seq 1 30); do
    if body=$(curl -fsS --max-time 10 "$base_url/health" 2>/dev/null) \
      && python3 -c 'import json,sys; raise SystemExit(0 if json.load(sys.stdin).get("status") == "ok" else 1)' <<<"$body"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_for_backend_version() {
  local base_url=$1 attempt body
  for attempt in $(seq 1 30); do
    if body=$(curl -fsS --max-time 10 "$base_url/api/backend-version" 2>/dev/null) \
      && python3 -c '
import json
import sys
p = json.load(sys.stdin)
raise SystemExit(0 if p.get("git_commit") == sys.argv[1] and p.get("environment") == "Preview" else 1)
' "$expected_revision" <<<"$body"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

assert_required_openapi_routes() {
  local base_url=$1 body
  body=$(curl -fsS --max-time 10 "$base_url/openapi.json") \
    || blocked "backend OpenAPI document is unavailable"
  python3 -c '
import json
import sys

required = {
    "/health",
    "/api/backend-version",
    "/api/tree-lifecycle",
    "/api/tree-lifecycle/actions",
    "/api/tree-lifecycle/import/validate",
    "/api/tree-lifecycle/import/apply",
    "/api/motor-screenshot-analysis/motors",
    "/api/motor-screenshot-analysis/uploads",
    "/api/motor-screenshot-analysis/text-imports",
    "/api/motor-screenshot-analysis/text-imports/{upload_id}",
    "/api/motor-screenshot-analysis/text-imports/{upload_id}/parse",
    "/api/motor-screenshot-analysis/usage",
    "/api/motor-screenshot-analysis/records",
    "/api/motor-screenshot-analysis/summary",
}
actual = set(json.load(sys.stdin).get("paths", {}))
missing = required - actual
raise SystemExit(1 if missing else 0)
' <<<"$body" || blocked "backend is missing a required lifecycle or motor-import route"
}

assert_application_contract() {
  local container=$1 base_url=$2
  wait_for_health "$base_url" || blocked "backend health check failed"
  wait_for_backend_version "$base_url" || blocked "backend version check failed"
  assert_database_target "$container" || blocked "backend database is not mfms_server_uat"
  assert_required_openapi_routes "$base_url"
  assert_disabled_features "$container"
}

snapshot_unrelated_containers() {
  local id name
  docker ps -aq | while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    name=$(docker inspect --format '{{.Name}}' "$id")
    name=${name#/}
    case "$name" in
      "$backend_live_container"|"$backend_live_container"-*)
        continue
        ;;
    esac
    docker inspect --format '{{.Id}}|{{.Name}}|{{.Image}}|{{.State.Running}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}' "$id"
  done | LC_ALL=C sort
}

proxy_digest() {
  docker exec "$proxy_container" sh -c \
    'for file in /etc/nginx/conf.d/*.conf; do [ -f "$file" ] && cat "$file"; done' \
    | sha256sum | awk '{print $1}'
}

cron_digest() {
  (crontab -l 2>/dev/null || true) | sha256sum | awk '{print $1}'
}

assert_frontend_and_proxy_available() {
  container_exists "$frontend_container" || blocked "Preview frontend container is missing"
  container_running "$frontend_container" || blocked "Preview frontend container is not running"
  container_exists "$proxy_container" || blocked "Preview proxy container is missing"
  [[ "$(docker exec "$proxy_container" sh -c "grep -R -F 'proxy_pass http://mfms-pilot-web:3000' /etc/nginx/conf.d 2>/dev/null | wc -l" | tr -d '[:space:]')" == "1" ]] \
    || blocked "Preview frontend proxy target is not unique"
}

assert_external_endpoints() {
  local preview_status production_status
  preview_status=$(curl -sS -L --max-time 20 -o /dev/null -w '%{http_code}' https://preview.muthufarms.com/)
  [[ "$preview_status" == "401" ]] \
    || blocked "Preview authentication gateway did not return the expected unauthenticated response"
  production_status=$(curl -sS -L --max-time 20 -o /dev/null -w '%{http_code}' https://muthufarms.com/)
  [[ "$production_status" == "200" ]] \
    || blocked "Production homepage did not return HTTP 200"
}

assert_candidate_port_available() {
  local listeners
  listeners=$(ss -H -ltn "sport = :$candidate_port" 2>/dev/null || true)
  [[ -z "$listeners" ]] || blocked "Preview backend candidate port is already allocated"
}

write_environment_file() {
  local source_container=$1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$source_container" > "$environment_file"
  [[ -s "$environment_file" ]] || blocked "Preview backend environment could not be captured privately"
  chmod 600 "$environment_file"
}

start_one_mount_container() {
  local name=$1 host_port=$2 network_ip=$3 image=$4
  local -a args=(
    run -d
    --name "$name"
    --network "$preview_network"
    --restart "$approved_restart_policy"
    -p "127.0.0.1:$host_port:8000"
    --mount "type=bind,source=$approved_mount_source,target=$approved_mount_target"
    --env-file "$environment_file"
  )
  if [[ -n "$network_ip" ]]; then
    args+=(--ip "$network_ip")
  fi
  args+=("$image")
  docker "${args[@]}" >/dev/null
}

start_legacy_candidate_container() {
  local name=$1 image=$2
  docker run -d \
    --name "$name" \
    --network "$preview_network" \
    --restart "$approved_restart_policy" \
    -p "127.0.0.1:$candidate_port:8000" \
    --mount "type=bind,source=$approved_mount_source,target=$approved_mount_target" \
    --mount "type=bind,source=$screenshot_mount_source,target=$screenshot_mount_target" \
    --env-file "$environment_file" \
    "$image" >/dev/null
}

disconnect_preview_network() {
  local container=$1
  if [[ -n "$(network_ip_for_container "$container")" ]]; then
    docker network disconnect "$preview_network" "$container"
  fi
}

ensure_preview_network_ip() {
  local container=$1 expected_ip=$2 current_ip attempt
  for attempt in $(seq 1 30); do
    current_ip=$(network_ip_for_container "$container")
    if [[ -n "$current_ip" && "$current_ip" != "$expected_ip" ]]; then
      docker network disconnect "$preview_network" "$container" >/dev/null 2>&1 || true
      current_ip=""
    fi
    if [[ -z "$current_ip" ]]; then
      docker network connect --ip "$expected_ip" "$preview_network" "$container" >/dev/null 2>&1 || {
        sleep 1
        continue
      }
      current_ip=$(network_ip_for_container "$container")
    fi
    [[ "$current_ip" == "$expected_ip" ]] && return 0
    sleep 1
  done
  return 1
}

validate_existing_state_file() {
  python3 - "$state_file" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
allowed = {
    "deployed_revision",
    "deployed_image_id",
    "deployed_image_tag",
    "rollback_container",
    "rollback_revision",
    "rollback_image_id",
    "rollback_image_tag",
    "run_id",
    "updated_at",
    "database_migrations",
}
records = {}
for raw in path.read_text(encoding="utf-8").splitlines():
    if "=" not in raw:
        raise SystemExit(1)
    key, value = raw.split("=", 1)
    if key not in allowed or key in records or not re.fullmatch(r"[A-Za-z0-9_./:@+-]+", value):
        raise SystemExit(1)
    records[key] = value
if set(records) != allowed:
    raise SystemExit(1)
PY
}

state_value() {
  local key=$1
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}' "$state_file"
}

assert_expected_pre_recovery_state() {
  [[ "$(state_value deployed_revision)" == "$expected_stale_state_revision" ]] \
    || blocked "guarded state revision differs from the audited pre-recovery state"
  [[ "$(state_value deployed_image_id)" == "$expected_stale_state_image_id" ]] \
    || blocked "guarded state image ID differs from the audited pre-recovery state"
  [[ "$(state_value run_id)" == "$expected_stale_state_run_id" ]] \
    || blocked "guarded state run identifier differs from the audited pre-recovery state"
  [[ "$(state_value database_migrations)" == "forward-only" ]] \
    || blocked "guarded state migration policy differs from the audited pre-recovery state"
}

create_checkpoint() {
  local original_container_id=$1 original_image_tag=$2 original_ip=$3 rollback_name=$4
  validate_existing_state_file || blocked "existing guarded state is not a recognized sanitized state file"
  assert_expected_pre_recovery_state
  install -d -m 700 "$recovery_root"
  [[ ! -e "$checkpoint_dir" ]] || blocked "recovery checkpoint already exists"
  install -d -m 700 "$checkpoint_dir"
  install -m 600 "$state_file" "$checkpoint_dir/state.before"
  mounts_json_for_container "$backend_live_container" > "$checkpoint_dir/mounts.before.json"
  chmod 600 "$checkpoint_dir/mounts.before.json"
  snapshot_unrelated_containers > "$checkpoint_dir/unrelated.before"
  chmod 600 "$checkpoint_dir/unrelated.before"
  cat > "$checkpoint_dir/metadata.before" <<EOF
recovery_run_id=$recovery_run_id
original_container_id=$original_container_id
original_image_id=$expected_image_id
original_image_tag=$original_image_tag
original_revision=$expected_revision
original_network_ip=$original_ip
original_port_bindings=$expected_live_port_bindings
original_restart_policy=$approved_restart_policy
original_mount_profile=legacy
retained_container_name=$rollback_name
frontend_container_id=$(docker inspect --format '{{.Id}}' "$frontend_container")
frontend_image_id=$(docker inspect --format '{{.Image}}' "$frontend_container")
proxy_digest=$(proxy_digest)
cron_digest=$(cron_digest)
EOF
  chmod 600 "$checkpoint_dir/metadata.before"
}

checkpoint_value() {
  local key=$1 file="$checkpoint_dir/metadata.before" value
  [[ -f "$file" ]] || blocked "recovery checkpoint metadata is missing"
  [[ "$(grep -Ec "^${key}=" "$file")" -eq 1 ]] \
    || blocked "recovery checkpoint key is invalid: $key"
  value=$(awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}' "$file")
  printf '%s\n' "$value"
}

write_reconciled_state() {
  local state_origin=$1 image_tag=$2
  local temporary_state
  temporary_state=$(mktemp "$state_dir/backend-recovery-state.XXXXXX")
  cat > "$temporary_state" <<EOF
deployed_revision=$expected_revision
deployed_image_id=$expected_image_id
deployed_image_tag=$image_tag
rollback_container=none
rollback_revision=none
rollback_image_id=none
rollback_image_tag=none
run_id=$recovery_run_id
updated_at=$timestamp
database_migrations=forward-only
state_origin=$state_origin
recovery_checkpoint=$checkpoint_dir
EOF
  chmod 600 "$temporary_state"
  mv "$temporary_state" "$state_file"
  state_changed=1
}

assert_reconciled_state_matches_live() {
  local live_image_id live_image_tag
  live_image_id=$(docker inspect --format '{{.Image}}' "$backend_live_container")
  live_image_tag=$(docker inspect --format '{{.Config.Image}}' "$backend_live_container")
  [[ "$(awk -F= '$1 == "deployed_revision" {print $2}' "$state_file")" == "$expected_revision" ]] \
    || blocked "reconciled state revision does not match the live backend"
  [[ "$(awk -F= '$1 == "deployed_image_id" {print $2}' "$state_file")" == "$live_image_id" ]] \
    || blocked "reconciled state image ID does not match the live backend"
  [[ "$(awk -F= '$1 == "deployed_image_tag" {sub(/^[^=]*=/, ""); print}' "$state_file")" == "$live_image_tag" ]] \
    || blocked "reconciled state image tag does not match the live backend"
  [[ "$(awk -F= '$1 == "run_id" {print $2}' "$state_file")" == "$recovery_run_id" ]] \
    || blocked "reconciled state recovery identifier is invalid"
}

restore_checkpoint_state() {
  local temporary_state
  [[ -f "$checkpoint_dir/state.before" ]] || return 1
  temporary_state=$(mktemp "$state_dir/backend-recovery-restore.XXXXXX") || return 1
  install -m 600 "$checkpoint_dir/state.before" "$temporary_state" || return 1
  mv "$temporary_state" "$state_file" || return 1
  state_changed=0
}

verify_unchanged_components() {
  local expected_frontend_id expected_frontend_image expected_proxy_digest expected_cron_digest
  expected_frontend_id=$(checkpoint_value frontend_container_id)
  expected_frontend_image=$(checkpoint_value frontend_image_id)
  expected_proxy_digest=$(checkpoint_value proxy_digest)
  expected_cron_digest=$(checkpoint_value cron_digest)
  [[ "$(docker inspect --format '{{.Id}}' "$frontend_container")" == "$expected_frontend_id" ]] \
    || blocked "Preview frontend container changed"
  [[ "$(docker inspect --format '{{.Image}}' "$frontend_container")" == "$expected_frontend_image" ]] \
    || blocked "Preview frontend image changed"
  [[ "$(proxy_digest)" == "$expected_proxy_digest" ]] || blocked "proxy configuration changed"
  [[ "$(cron_digest)" == "$expected_cron_digest" ]] || blocked "Preview schedules changed"
  snapshot_unrelated_containers > "$work_dir/unrelated.after"
  cmp -s "$checkpoint_dir/unrelated.before" "$work_dir/unrelated.after" \
    || blocked "a frontend, Production, ODK, proxy, scheduler, or unrelated container changed"
}

remove_candidate() {
  if [[ -n "$candidate_container" ]] && container_exists "$candidate_container"; then
    docker rm -f "$candidate_container" >/dev/null
  fi
  candidate_container=""
}

restore_transaction_original() {
  local live_id=""
  automatic_restore_result="failed"
  if container_exists "$backend_live_container"; then
    live_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
    if [[ "$live_id" != "$transaction_original_id" ]]; then
      docker stop --time 30 "$backend_live_container" >/dev/null 2>&1 || true
      disconnect_preview_network "$backend_live_container" >/dev/null 2>&1 || true
      if [[ -n "$replacement_origin" ]]; then
        docker rename "$backend_live_container" "$replacement_origin" >/dev/null 2>&1 \
          || docker rm -f "$backend_live_container" >/dev/null 2>&1 \
          || true
      else
        docker rm -f "$backend_live_container" >/dev/null 2>&1 || true
      fi
    fi
  fi
  if container_exists "$transaction_original_name"; then
    docker rename "$transaction_original_name" "$backend_live_container" >/dev/null 2>&1 || return 1
  fi
  ensure_preview_network_ip "$backend_live_container" "$transaction_original_ip" >/dev/null 2>&1 || return 1
  docker start "$backend_live_container" >/dev/null 2>&1 || return 1
  assert_container_contract \
    "$backend_live_container" "$transaction_original_profile" "$expected_live_port_bindings" "$transaction_original_ip" \
    >/dev/null 2>&1 || return 1
  assert_application_contract "$backend_live_container" "http://127.0.0.1:$live_port" >/dev/null 2>&1 || return 1
  if [[ "$state_changed" -eq 1 ]]; then
    restore_checkpoint_state >/dev/null 2>&1 || return 1
  fi
  automatic_restore_result="pass"
}

cleanup() {
  set +e
  remove_candidate
  if [[ -n "$work_dir" && "$work_dir" == "$state_dir"/backend-recovery-work.* ]]; then
    rm -rf "$work_dir"
  fi
}

on_error() {
  local status=$?
  trap - ERR
  echo "PREVIEW_BACKEND_RECOVERY_ERROR=operation=$operation status=$status" >&2
  exit "$status"
}

on_exit() {
  local status=$?
  trap - ERR EXIT HUP INT TERM
  set +e
  if [[ "$status" -ne 0 && "$transaction_active" -eq 1 ]]; then
    restore_transaction_original
    echo "AUTOMATIC_BACKEND_RESTORE=$automatic_restore_result" >&2
  fi
  cleanup
  exit "$status"
}

adopt_one_mount_contract() {
  local original_id original_image_tag original_ip rollback_name new_id new_image_tag
  require_empty_storage "$screenshot_mount_source"
  assert_frontend_and_proxy_available
  assert_container_contract "$backend_live_container" legacy "$expected_live_port_bindings"
  assert_application_contract "$backend_live_container" "http://127.0.0.1:$live_port"
  assert_candidate_port_available

  original_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
  original_image_tag=$(docker inspect --format '{{.Config.Image}}' "$backend_live_container")
  [[ "$original_image_tag" == "$expected_image_tag" ]] \
    || blocked "Preview backend image tag differs from the reviewed live image tag"
  [[ "$(docker image inspect --format '{{.Id}}' "$original_image_tag")" == "$expected_image_id" ]] \
    || blocked "reviewed live image tag no longer resolves to the exact expected image ID"
  original_ip=$(network_ip_for_container "$backend_live_container")
  [[ -n "$original_ip" ]] || blocked "Preview backend has no Preview network address"
  rollback_name="$backend_live_container-pre-recovery-$recovery_run_id"
  [[ ! "$rollback_name" =~ [^A-Za-z0-9_.-] ]] || blocked "recovery rollback name is invalid"
  ! container_exists "$rollback_name" || blocked "recovery rollback container already exists"

  create_checkpoint "$original_id" "$original_image_tag" "$original_ip" "$rollback_name"
  write_environment_file "$backend_live_container"

  candidate_container="$backend_live_container-recovery-candidate-$recovery_run_id"
  start_one_mount_container "$candidate_container" "$candidate_port" "" "$original_image_tag"
  assert_container_contract "$candidate_container" approved "$expected_candidate_port_bindings"
  assert_application_contract "$candidate_container" "http://127.0.0.1:$candidate_port"
  remove_candidate

  transaction_original_id="$original_id"
  transaction_original_name="$rollback_name"
  transaction_original_ip="$original_ip"
  transaction_original_profile="legacy"
  replacement_origin=""
  transaction_active=1

  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_preview_network "$backend_live_container"
  docker rename "$backend_live_container" "$rollback_name"
  start_one_mount_container "$backend_live_container" "$live_port" "$original_ip" "$original_image_tag"

  assert_container_contract "$backend_live_container" approved "$expected_live_port_bindings" "$original_ip"
  assert_application_contract "$backend_live_container" "http://127.0.0.1:$live_port"
  [[ "$(docker inspect --format '{{.Id}}' "$rollback_name")" == "$original_id" ]] \
    || blocked "retained pre-recovery container identity changed"
  ! container_running "$rollback_name" || blocked "retained pre-recovery container is unexpectedly running"
  validate_mounts_json legacy "$(mounts_json_for_container "$rollback_name")"
  verify_unchanged_components
  assert_external_endpoints

  new_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
  new_image_tag=$(docker inspect --format '{{.Config.Image}}' "$backend_live_container")
  [[ "$new_image_tag" == "$original_image_tag" ]] || blocked "replacement backend image tag changed"
  write_reconciled_state "preview-backend-recovery-adoption" "$new_image_tag"
  assert_reconciled_state_matches_live
  transaction_active=0

  echo "recovery_environment=Preview"
  echo "recovery_component=backend"
  echo "recovery_operation=adopt-one-mount"
  echo "recovery_run_id=$recovery_run_id"
  echo "previous_container_id=$original_id"
  echo "deployed_container_id=$new_id"
  echo "deployed_backend_revision=$expected_revision"
  echo "deployed_backend_image_id=$expected_image_id"
  echo "deployed_backend_image_tag=$new_image_tag"
  echo "live_mount_contract=bind|/tmp|/host-tmp|true"
  echo "retained_recovery_container=$rollback_name"
  echo "guarded_standard_rollback=disabled-until-next-successful-backend-deployment"
  echo "frontend_unchanged=true"
  echo "database_schema_changes=0"
  echo "database_data_changes=0"
  echo "odk_operations=0"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "production_touched=0"
  echo "manual_rollback_command=/home/muthu/.local/libexec/mfms-preview-backend-recovery rollback $expected_revision $recovery_run_id '$rollback_confirmation'"
  echo "PREVIEW_BACKEND_RECOVERY=PASS"
}

rollback_recovery() {
  local retained_name original_id original_ip image_tag current_id rollback_backup
  checkpoint_dir="$recovery_root/$recovery_run_id"
  [[ -d "$checkpoint_dir" ]] || blocked "recovery checkpoint does not exist"
  require_empty_storage "$screenshot_mount_source"
  retained_name=$(checkpoint_value retained_container_name)
  original_id=$(checkpoint_value original_container_id)
  original_ip=$(checkpoint_value original_network_ip)
  image_tag=$(checkpoint_value original_image_tag)
  [[ "$image_tag" == "$expected_image_tag" ]] \
    || blocked "checkpoint image tag differs from the reviewed live image tag"
  [[ "$retained_name" =~ ^harvest-api-pilot-pre-recovery-recovery-[0-9]{8}T[0-9]{6}Z-[a-z0-9-]{1,40}$ ]] \
    || blocked "retained recovery container name is invalid"
  container_exists "$retained_name" || blocked "retained pre-recovery container is missing"
  [[ "$(docker inspect --format '{{.Id}}' "$retained_name")" == "$original_id" ]] \
    || blocked "retained pre-recovery container identity changed"
  ! container_running "$retained_name" || blocked "retained pre-recovery container is unexpectedly running"
  validate_mounts_json legacy "$(mounts_json_for_container "$retained_name")"
  assert_container_contract "$backend_live_container" approved "$expected_live_port_bindings" "$original_ip"
  assert_application_contract "$backend_live_container" "http://127.0.0.1:$live_port"
  assert_candidate_port_available
  write_environment_file "$retained_name"

  candidate_container="$backend_live_container-recovery-rollback-candidate-$recovery_run_id"
  start_legacy_candidate_container "$candidate_container" "$image_tag"
  assert_container_contract "$candidate_container" legacy "$expected_candidate_port_bindings"
  assert_application_contract "$candidate_container" "http://127.0.0.1:$candidate_port"
  remove_candidate

  current_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
  rollback_backup="$backend_live_container-pre-recovery-rollback-$recovery_run_id-$timestamp"
  transaction_original_id="$current_id"
  transaction_original_name="$rollback_backup"
  transaction_original_ip="$original_ip"
  transaction_original_profile="approved"
  replacement_origin="$retained_name"
  transaction_active=1

  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_preview_network "$backend_live_container"
  docker rename "$backend_live_container" "$rollback_backup"
  docker rename "$retained_name" "$backend_live_container"
  ensure_preview_network_ip "$backend_live_container" "$original_ip" \
    || blocked "recovery rollback could not preserve the Preview network address"
  docker start "$backend_live_container" >/dev/null

  assert_container_contract "$backend_live_container" legacy "$expected_live_port_bindings" "$original_ip"
  assert_application_contract "$backend_live_container" "http://127.0.0.1:$live_port"
  verify_unchanged_components
  assert_external_endpoints
  write_reconciled_state "preview-backend-recovery-rollback" "$image_tag"
  assert_reconciled_state_matches_live
  transaction_active=0

  echo "recovery_environment=Preview"
  echo "recovery_component=backend"
  echo "recovery_operation=rollback"
  echo "recovery_run_id=$recovery_run_id"
  echo "restored_container_id=$original_id"
  echo "restored_backend_revision=$expected_revision"
  echo "restored_backend_image_id=$expected_image_id"
  echo "one_mount_container_retained=$rollback_backup"
  echo "frontend_unchanged=true"
  echo "database_schema_changes=0"
  echo "database_data_changes=0"
  echo "odk_operations=0"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "production_touched=0"
  echo "PREVIEW_BACKEND_RECOVERY_ROLLBACK=PASS"
}

main() {
  [[ $# -ge 1 ]] || blocked "operation is required"
  operation=$1
  shift
  [[ "$(id -u)" -ne 0 ]] || blocked "root execution is prohibited"
  [[ "$(id -un)" == "muthu" ]] || blocked "the approved Preview recovery user is muthu"

  for required_command in \
    awk cat chmod cmp crontab curl date docker find flock grep id install mktemp mv \
    python3 rm sed seq sha256sum sleep sort ss stat tr wc
  do
    command -v "$required_command" >/dev/null 2>&1 \
      || blocked "required command is unavailable: $required_command"
  done

  case "$operation" in
    adopt)
      [[ $# -eq 4 ]] || blocked "adopt requires REVISION IMAGE_ID RECOVERY_RUN_ID CONFIRMATION"
      require_exact_revision "$1"
      require_exact_image_id "$2"
      recovery_run_id=$3
      require_recovery_run_id "$recovery_run_id"
      [[ "$4" == "$adopt_confirmation" ]] || blocked "adoption confirmation phrase did not match"
      ;;
    rollback)
      [[ $# -eq 3 ]] || blocked "rollback requires REVISION RECOVERY_RUN_ID CONFIRMATION"
      require_exact_revision "$1"
      recovery_run_id=$2
      require_recovery_run_id "$recovery_run_id"
      [[ "$3" == "$rollback_confirmation" ]] || blocked "rollback confirmation phrase did not match"
      ;;
    *)
      blocked "operation must be adopt or rollback"
      ;;
  esac

  install -d -m 700 "$state_dir"
  exec 9>"$lock_file"
  flock -n 9 || blocked "another Preview backend deployment, rollback, or recovery is running"

  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  work_dir=$(mktemp -d "$state_dir/backend-recovery-work.XXXXXX")
  environment_file="$work_dir/backend.env"
  if [[ "$operation" == "adopt" ]]; then
    checkpoint_dir="$recovery_root/$recovery_run_id"
  fi

  trap on_error ERR
  trap on_exit EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  case "$operation" in
    adopt) adopt_one_mount_contract ;;
    rollback) rollback_recovery ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
