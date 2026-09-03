#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

blocked() {
  echo "PREVIEW_DEPLOY_BLOCKED=$1" >&2
  return 1
}

[[ $# -eq 0 ]] || blocked "arguments are not accepted"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Preview SSH user is muthu"

for required_command in \
  awk cat chmod cmp crontab curl date docker flock git grep id install mktemp mv \
  python3 rm sed seq sha256sum sleep sort ss tr
do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

readonly repo_url="https://github.com/ayemuthu1963-beep/farm-management-dashboard.git"
readonly release_ref="refs/heads/preview-release"
readonly live_container="mfms-pilot-web"
readonly backend_container="harvest-api-pilot"
readonly proxy_container="central-nginx-1"
readonly preview_network="harvest-net"
readonly preview_url="https://preview.muthufarms.com"
readonly central_login_url="https://auth.muthufarms.com/login"
readonly live_port="3015"
readonly candidate_port="3016"
readonly orthomosaic_host_dir="/home/muthu/mfms-preview-map-data/orthomosaic"
readonly orthomosaic_container_dir="/app/public/map-data/orthomosaic"
readonly orthomosaic_archive="Muthu_Farms_Full_Orthomosaic_2026_WebMercator_Z16-Z22_WebP88.pmtiles"
readonly orthomosaic_sha256="0db33c684af256b0c121201c449125c2becb109a6d1f83ec40e1acb259a12849"
readonly state_dir="/home/muthu/.local/state/mfms-preview-github"
readonly state_file="$state_dir/last-successful-frontend-switch"
readonly lock_file="$state_dir/deployment.lock"
readonly worker_secret_file="$state_dir/worker-management-signing.env"
readonly installed_deploy_script="/home/muthu/bin/mfms-preview-github-deploy"

[[ "$preview_url" == "https://preview.muthufarms.com" ]] \
  || blocked "the public target is not Preview"

install -d -m 700 "$state_dir"
exec 9>"$lock_file"
flock -n 9 || blocked "another Preview deployment or rollback is already running"

operation=""
candidate_revision=""
expected_current_revision=""
run_id=""
readonly deploy_command_pattern='^deploy-preview ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9]+)$'
readonly rollback_command_pattern='^rollback-preview ([0-9a-f]{40}) ([0-9]+)$'

original_command=${SSH_ORIGINAL_COMMAND:-}
if [[ "$original_command" =~ $deploy_command_pattern ]]; then
  operation="deploy"
  candidate_revision=${BASH_REMATCH[1]}
  expected_current_revision=${BASH_REMATCH[2]}
  run_id=${BASH_REMATCH[3]}
elif [[ "$original_command" =~ $rollback_command_pattern ]]; then
  operation="rollback"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
else
  blocked "the SSH key accepts only an exact Preview deploy or rollback command"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
work_dir=$(mktemp -d "$state_dir/work.XXXXXX")
source_dir="$work_dir/source"
environment_file="$work_dir/frontend.env"
before_unrelated="$work_dir/unrelated.before"
after_unrelated="$work_dir/unrelated.after"

candidate_container=""
transaction_backup=""
replacement_origin=""
original_container_id=""
original_image_id=""
original_image_tag=""
original_reported_revision=""
original_revision=""
original_network_ip=""
backend_id_before=""
backend_image_before=""
cron_digest_before=""
proxy_digest_before=""
proxy_target_count_before=""
worker_secret_loaded=0
transaction_active=0
automatic_restore_result="not-required"
public_guard_result=""

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

disconnect_preview_network() {
  local container=$1
  # A stopped container can retain a network endpoint while Docker reports an
  # empty IP address. Always request disconnection so the fixed Preview IP is
  # released before a replacement is attached.
  docker network disconnect "$preview_network" "$container" >/dev/null 2>&1 || true
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
      docker network connect --ip "$expected_ip" "$preview_network" "$container" \
        >/dev/null 2>&1 || {
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

image_revision_for_container() {
  local container=$1 image_id
  image_id=$(docker inspect --format '{{.Image}}' "$container")
  docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id"
}

image_environment_for_container() {
  local container=$1 image_id
  image_id=$(docker inspect --format '{{.Image}}' "$container")
  docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$image_id"
}

snapshot_unrelated_containers() {
  local id name
  docker ps -aq | while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    name=$(docker inspect --format '{{.Name}}' "$id")
    name=${name#/}
    case "$name" in
      "$live_container"|"$live_container"-candidate-*|"$live_container"-pre-*)
        continue
        ;;
    esac
    docker inspect --format '{{.Id}}|{{.Name}}|{{.Image}}|{{.State.Running}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}' "$id"
  done | LC_ALL=C sort
}

cron_digest() {
  (crontab -l 2>/dev/null || true) | sha256sum | awk '{print $1}'
}

proxy_digest() {
  docker exec "$proxy_container" sh -c \
    'for file in /etc/nginx/conf.d/*.conf; do [ -f "$file" ] && cat "$file"; done' \
    | sha256sum | awk '{print $1}'
}

proxy_target_count() {
  docker exec "$proxy_container" sh -c \
    "grep -R -F 'proxy_pass http://mfms-pilot-web:3000' /etc/nginx/conf.d 2>/dev/null | wc -l" \
    | tr -d '[:space:]'
}

wait_for_version() {
  local base_url=$1 expected_revision=$2 payload attempt
  for attempt in $(seq 1 60); do
    if payload=$(curl -fsS --max-time 10 "$base_url/api/version" 2>/dev/null); then
      if python3 -c \
        'import json,sys; data=json.load(sys.stdin); valid=(data.get("git_commit")==sys.argv[1] and data.get("environment")=="Preview" and data.get("public_environment")=="preview" and data.get("database")=="mfms_server_uat"); raise SystemExit(0 if valid else 1)' \
        "$expected_revision" <<<"$payload"; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

orthomosaic_mount_for_container() {
  docker inspect --format \
    '{{range .Mounts}}{{if eq .Destination "/app/public/map-data/orthomosaic"}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{end}}{{end}}' \
    "$1"
}

assert_pmtiles_range() {
  local base_url=$1 headers result
  headers=$(mktemp "$work_dir/pmtiles-range.XXXXXX")
  result=$(curl -sS --max-time 20 \
    -H 'Range: bytes=0-511' \
    -D "$headers" \
    -o /dev/null \
    -w '%{http_code}|%{size_download}' \
    "$base_url/map-data/orthomosaic/$orthomosaic_archive") || {
      rm -f "$headers"
      return 1
    }
  if [[ "$result" != "206|512" ]] \
    || ! grep -Eiq '^Accept-Ranges:[[:space:]]*bytes[[:space:]]*$' "$headers" \
    || ! grep -Eiq '^Content-Range:[[:space:]]*bytes[[:space:]]+0-511/[0-9]+[[:space:]]*$' "$headers"; then
    rm -f "$headers"
    return 1
  fi
  rm -f "$headers"
}

assert_preview_environment_banner() {
  local base_url=$1 body
  body=$(mktemp "$work_dir/environment-banner.XXXXXX")
  if ! curl -fsS --max-time 20 "$base_url/worker-management/query" -o "$body"; then
    rm -f "$body"
    return 1
  fi
  if ! grep -Fq 'data-mfms-environment="preview"' "$body" \
    || ! grep -Fq 'data-mfms-database="mfms_server_uat"' "$body" \
    || ! grep -Fq 'PREVIEW / UAT - Database: mfms_server_uat - TEST DATA / TEST ACTIONS ONLY' "$body" \
    || grep -Fq 'CONFIGURATION MISMATCH' "$body"; then
    rm -f "$body"
    return 1
  fi
  rm -f "$body"
}

wait_for_public_preview_guard() {
  local headers status location attempt
  headers=$(mktemp "$work_dir/public-preview-guard.XXXXXX")
  for attempt in $(seq 1 30); do
    : > "$headers"
    status=$(curl -sS -o /dev/null -D "$headers" -w '%{http_code}' --max-time 10 \
      "$preview_url/api/version" 2>/dev/null || true)
    if [[ "$status" == "401" ]]; then
      public_guard_result="401"
      rm -f "$headers"
      return 0
    fi
    if [[ "$status" == "303" ]]; then
      location=$(awk '
        tolower(substr($0, 1, 9)) == "location:" {
          sub(/^[^:]*:[[:space:]]*/, "")
          sub(/\r$/, "")
          print
          exit
        }
      ' "$headers")
      if python3 - "$location" "$central_login_url" "$preview_url/api/version" <<'PY'
import sys
from urllib.parse import parse_qsl, urlsplit

location, expected_login, expected_return = sys.argv[1:]
parsed = urlsplit(location)
login = urlsplit(expected_login)
valid = (
    parsed.scheme == login.scheme == "https"
    and parsed.netloc == login.netloc == "auth.muthufarms.com"
    and parsed.path == login.path == "/login"
    and parsed.fragment == ""
    and parse_qsl(parsed.query, keep_blank_values=True) == [("next", expected_return)]
)
raise SystemExit(0 if valid else 1)
PY
      then
        public_guard_result="303-central-login"
        rm -f "$headers"
        return 0
      fi
    fi
    sleep 2
  done
  rm -f "$headers"
  return 1
}

smoke_routes() {
  local base_url=$1 failures=0 route marker body
  while IFS='|' read -r route marker; do
    body=$(mktemp "$work_dir/smoke.XXXXXX")
    if ! curl -fsS -L --max-time 20 "$base_url$route" -o "$body"; then
      failures=$((failures + 1))
    elif ! grep -Fqi "$marker" "$body"; then
      failures=$((failures + 1))
    elif grep -Eqi 'mfms_local_test|mock fallback|localhost:[0-9]+' "$body"; then
      failures=$((failures + 1))
    fi
    rm -f "$body"
  done <<'EOF'
/|DIGITAL FARM MANAGEMENT SYSTEM
/irrigation-management|Irrigation
/well-water|Well Water
/motor-runtime|Motor Runtime
/beetle-trap|Beetle Trap
/farm-map|Farm Map
/admin|Admin
EOF
  [[ "$failures" -eq 0 ]]
}

assert_candidate_port_available() {
  local listeners
  listeners=$(ss -H -ltn "sport = :$candidate_port" 2>/dev/null || true)
  [[ -z "$listeners" ]] \
    || blocked "Preview candidate port $candidate_port is already allocated"
}

append_worker_environment() {
  local worker_secret
  if [[ ! -e "$worker_secret_file" ]]; then
    if [[ "$operation" == "deploy" \
      && -f "$source_dir/app/api/worker-management/[[...path]]/route.ts" ]]; then
      blocked "Worker Management requires the server-local signing secret created by the backend release"
      return 1
    fi
    return 0
  fi
  python3 - "$worker_secret_file" <<'PY'
import os
import pathlib
import re
import stat
import sys

path = pathlib.Path(sys.argv[1])
metadata = path.lstat()
if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
    raise SystemExit("Worker signing secret must be a regular mode-0600 file")
if metadata.st_uid != os.getuid():
    raise SystemExit("Worker signing secret has the wrong owner")
lines = path.read_text(encoding="ascii").splitlines()
if len(lines) != 1 or not re.fullmatch(r"MFMS_ACTOR_ASSERTION_SECRET=[0-9a-f]{64}", lines[0]):
    raise SystemExit("Worker signing secret file is invalid")
PY
  worker_secret=$(awk -F= '$1 == "MFMS_ACTOR_ASSERTION_SECRET" {print $2}' "$worker_secret_file")
  printf 'MFMS_ACTOR_ASSERTION_SECRET=%s\nMFMS_TRUST_PROXY_ACTOR_HEADERS=true\nMFMS_WORKER_PROXY_DEFAULT_ROLE=admin\nMFMS_WORKER_LOCAL_ACTOR_ENABLED=false\n' \
    "$worker_secret" >> "$environment_file"
  worker_secret_loaded=1
}

write_environment_file() {
  local source_container=$1 target_revision=${2:-} target_timestamp=${3:-}
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$source_container" \
    | awk 'length($0) && $0 !~ /^(MFMS_GIT_COMMIT|MFMS_BUILD_TIMESTAMP|MFMS_BUILD_ENVIRONMENT|MFMS_ACTOR_ASSERTION_SECRET|MFMS_TRUST_PROXY_ACTOR_HEADERS|MFMS_WORKER_PROXY_DEFAULT_ROLE|MFMS_WORKER_LOCAL_ACTOR_ENABLED|MFMS_WORKER_LOCAL_ACTOR_USERNAME|MFMS_WORKER_LOCAL_ACTOR_ROLE)=/' \
    > "$environment_file"
  if [[ -n "$target_revision" ]]; then
    printf 'MFMS_GIT_COMMIT=%s\nMFMS_BUILD_TIMESTAMP=%s\nMFMS_BUILD_ENVIRONMENT=Preview\n' \
      "$target_revision" "$target_timestamp" >> "$environment_file"
  fi
  append_worker_environment
  chmod 600 "$environment_file"
  grep -Fqx 'MFMS_ENV=preview' "$environment_file" \
    || blocked "frontend environment is not Preview"
  grep -Fqx 'MFMS_TARGET_DATABASE=mfms_server_uat' "$environment_file" \
    || blocked "frontend database target is not UAT"
  grep -Fqx 'NEXT_PUBLIC_MFMS_ENV=preview' "$environment_file" \
    || blocked "public frontend environment is not Preview"
  grep -Fqx 'NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=mfms_server_uat' "$environment_file" \
    || blocked "public frontend database label is not UAT"
}

start_candidate() {
  local image=$1 revision=$2
  candidate_container="$live_container-candidate-$run_id-$timestamp"
  docker run -d \
    --log-driver json-file --log-opt max-size=20m --log-opt max-file=5 \
    --name "$candidate_container" \
    --network "$preview_network" \
    --restart no \
    -p "127.0.0.1:$candidate_port:3000" \
    --mount "type=bind,src=$orthomosaic_host_dir,dst=$orthomosaic_container_dir,readonly" \
    --env-file "$environment_file" \
    "$image" >/dev/null
  wait_for_version "http://127.0.0.1:$candidate_port" "$revision" \
    || blocked "candidate /api/version did not report the approved revision"
  smoke_routes "http://127.0.0.1:$candidate_port" \
    || blocked "candidate route smoke test failed"
  assert_pmtiles_range "http://127.0.0.1:$candidate_port" \
    || blocked "candidate PMTiles range request failed"
}

remove_candidate() {
  if [[ -n "$candidate_container" ]] && container_exists "$candidate_container"; then
    docker rm -f "$candidate_container" >/dev/null
  fi
  candidate_container=""
}

assert_live_contract() {
  local expected_revision=$1 expected_image_id=$2 expected_unrelated=$3
  container_exists "$live_container" || blocked "Preview frontend container is missing"
  container_running "$live_container" || blocked "Preview frontend container is not running"
  [[ "$(image_revision_for_container "$live_container")" == "$expected_revision" ]] \
    || blocked "Preview frontend revision does not match"
  [[ "$(image_environment_for_container "$live_container")" == "Preview" ]] \
    || blocked "Preview frontend image is not labelled Preview"
  [[ "$(docker inspect --format '{{.Image}}' "$live_container")" == "$expected_image_id" ]] \
    || blocked "Preview frontend image ID does not match"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$live_container")" == "unless-stopped" ]] \
    || blocked "Preview frontend restart policy changed"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$live_container")" == "$preview_network" ]] \
    || blocked "Preview frontend network changed"
  [[ "$(network_ip_for_container "$live_container")" == "$original_network_ip" ]] \
    || blocked "Preview frontend network address changed"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$live_container")" == \
      '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3015"}]}' ]] \
    || blocked "Preview frontend host port changed"
  [[ "$(docker inspect --format '{{len .Mounts}}' "$live_container")" == "1" ]] \
    || blocked "Preview frontend mount count changed"
  [[ "$(orthomosaic_mount_for_container "$live_container")" == \
      "bind|$orthomosaic_host_dir|$orthomosaic_container_dir|false" ]] \
    || blocked "Preview orthomosaic mount changed"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$live_container" \
    | grep -Fqx 'MFMS_TARGET_DATABASE=mfms_server_uat' \
    || blocked "Preview frontend no longer targets the UAT database"
  [[ "$(docker inspect --format '{{.Id}}' "$backend_container")" == "$backend_id_before" ]] \
    || blocked "Preview backend container changed"
  [[ "$(docker inspect --format '{{.Image}}' "$backend_container")" == "$backend_image_before" ]] \
    || blocked "Preview backend image changed"
  container_running "$backend_container" || blocked "Preview backend stopped"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$backend_container" \
    | grep -Fqx 'POSTGRES_DB=mfms_server_uat' \
    || blocked "Preview backend no longer targets the UAT database"
  [[ "$(cron_digest)" == "$cron_digest_before" ]] || blocked "Preview schedules changed"
  [[ "$(proxy_digest)" == "$proxy_digest_before" ]] || blocked "proxy configuration changed"
  [[ "$(proxy_target_count)" == "$proxy_target_count_before" ]] \
    || blocked "Preview proxy target count changed"
  snapshot_unrelated_containers > "$after_unrelated"
  cmp -s "$expected_unrelated" "$after_unrelated" \
    || blocked "a backend, Production, ODK, proxy, database, or unrelated container changed"
}

restore_original_frontend() {
  local live_id="" recovery_name=""
  automatic_restore_result="failed"
  if container_exists "$live_container"; then
    live_id=$(docker inspect --format '{{.Id}}' "$live_container")
    if [[ "$live_id" != "$original_container_id" ]]; then
      docker stop --time 30 "$live_container" >/dev/null 2>&1 || true
      disconnect_preview_network "$live_container" >/dev/null 2>&1 || true
      if [[ -n "$replacement_origin" ]]; then
        if ! docker rename "$live_container" "$replacement_origin" >/dev/null 2>&1; then
          recovery_name="$replacement_origin-recovery-$timestamp"
          docker rename "$live_container" "$recovery_name" >/dev/null 2>&1 \
            || docker rm -f "$live_container" >/dev/null 2>&1 \
            || true
        fi
      else
        docker rm -f "$live_container" >/dev/null 2>&1 || true
      fi
    fi
  fi
  if [[ -n "$transaction_backup" ]] && container_exists "$transaction_backup"; then
    docker rename "$transaction_backup" "$live_container" >/dev/null 2>&1 || return 1
  fi
  if container_exists "$live_container"; then
    ensure_preview_network_ip "$live_container" "$original_network_ip" \
      >/dev/null 2>&1 || return 1
    docker start "$live_container" >/dev/null 2>&1 || return 1
    if wait_for_version "http://127.0.0.1:$live_port" "$original_reported_revision" \
      && smoke_routes "http://127.0.0.1:$live_port" \
      && wait_for_public_preview_guard; then
      automatic_restore_result="pass"
    fi
  fi
}

cleanup() {
  set +e
  remove_candidate
  if [[ -n "$work_dir" && "$work_dir" == "$state_dir"/work.* ]]; then
    rm -rf "$work_dir"
  fi
}

on_error() {
  local status=$?
  trap - ERR
  echo "PREVIEW_TRANSACTION_ERROR=operation=$operation status=$status" >&2
  exit "$status"
}

on_exit() {
  local status=$?
  trap - ERR EXIT HUP INT TERM
  set +e
  if [[ "$status" -ne 0 && "$transaction_active" -eq 1 ]]; then
    restore_original_frontend
    echo "AUTOMATIC_RESTORE=$automatic_restore_result" >&2
  fi
  cleanup
  exit "$status"
}

trap on_error ERR
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

validate_common_live_state() {
  local live_mount_count
  container_exists "$live_container" || blocked "Preview frontend container is missing"
  container_running "$live_container" || blocked "Preview frontend container is not running"
  container_exists "$backend_container" || blocked "Preview backend container is missing"
  container_running "$backend_container" || blocked "Preview backend container is not running"
  container_exists "$proxy_container" || blocked "Preview proxy container is missing"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$live_container")" == "$preview_network" ]] \
    || blocked "live frontend is not on the Preview network"
  [[ "$(image_environment_for_container "$live_container")" == "Preview" ]] \
    || blocked "live frontend image is not labelled Preview"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$live_container")" == \
      '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3015"}]}' ]] \
    || blocked "live frontend is not bound to the approved Preview port"
  [[ "$(docker ps -a --format '{{.Names}}' | grep -Ec '^mfms-pilot-web-candidate-' || true)" -eq 0 ]] \
    || blocked "a stale Preview candidate container exists"
  [[ -f "$orthomosaic_host_dir/$orthomosaic_archive" ]] \
    || blocked "approved Preview PMTiles archive is missing"
  [[ "$(sha256sum "$orthomosaic_host_dir/$orthomosaic_archive" | awk '{print $1}')" == \
      "$orthomosaic_sha256" ]] \
    || blocked "approved Preview PMTiles hash changed"
  live_mount_count=$(docker inspect --format '{{len .Mounts}}' "$live_container")
  if [[ "$live_mount_count" == "1" ]]; then
    [[ "$(orthomosaic_mount_for_container "$live_container")" == \
        "bind|$orthomosaic_host_dir|$orthomosaic_container_dir|false" ]] \
      || blocked "live frontend orthomosaic mount is invalid"
  elif [[ "$operation" == "deploy" && "$live_mount_count" == "0" ]]; then
    echo "PREVIEW_PM_TILES_REPAIR=required"
  else
    blocked "live frontend mount count is invalid"
  fi

  original_container_id=$(docker inspect --format '{{.Id}}' "$live_container")
  original_image_id=$(docker inspect --format '{{.Image}}' "$live_container")
  original_image_tag=$(docker inspect --format '{{.Config.Image}}' "$live_container")
  original_reported_revision=$(image_revision_for_container "$live_container")
  original_revision=$original_reported_revision
  original_network_ip=$(network_ip_for_container "$live_container")
  if [[ "$original_revision" =~ ^([0-9a-f]{7,39})-project23$ ]]; then
    original_revision=${BASH_REMATCH[1]}
  fi
  if [[ "$original_revision" =~ ^[0-9a-f]{40}$ ]]; then
    [[ "$original_revision" == "$expected_current_revision" ]] \
      || blocked "live Preview revision differs from the approved current revision"
  elif [[ "$original_revision" =~ ^[0-9a-f]{7,39}$ ]] \
    && [[ "${expected_current_revision:0:${#original_revision}}" == "$original_revision" ]]; then
    original_revision=$expected_current_revision
  else
    blocked "live Preview revision is invalid or does not match the approved current revision"
  fi
  python3 - "$original_network_ip" <<'PY' \
    || blocked "live Preview network address is invalid"
import ipaddress
import sys

address = ipaddress.ip_address(sys.argv[1])
raise SystemExit(0 if address.version == 4 and not address.is_unspecified else 1)
PY
  backend_id_before=$(docker inspect --format '{{.Id}}' "$backend_container")
  backend_image_before=$(docker inspect --format '{{.Image}}' "$backend_container")
  cron_digest_before=$(cron_digest)
  proxy_digest_before=$(proxy_digest)
  proxy_target_count_before=$(proxy_target_count)
  [[ "$proxy_target_count_before" =~ ^[1-9][0-9]*$ ]] \
    || blocked "Preview proxy has no approved frontend target"
  snapshot_unrelated_containers > "$before_unrelated"
  wait_for_public_preview_guard \
    || blocked "public Preview authentication guard is unavailable"
}

validate_release_manifest() {
  local manifest="$source_dir/deploy/preview-release-manifest.json"
  local actual_paths="$work_dir/actual-paths.txt"
  [[ -f "$manifest" ]] || blocked "Preview release manifest is missing"
  git -C "$source_dir" diff --name-only "$original_revision..$candidate_revision" \
    | LC_ALL=C sort -u > "$actual_paths"
  [[ -s "$actual_paths" ]] || blocked "candidate contains no changes from live Preview"
  python3 - "$manifest" "$actual_paths" "$original_revision" <<'PY'
import json
import pathlib
import re
import sys

manifest_path, actual_path, current = sys.argv[1:]
data = json.loads(pathlib.Path(manifest_path).read_text(encoding="utf-8"))

expected_invariants = {
    "production": "unchanged",
    "backend": "unchanged",
    "database": "unchanged",
    "odk": "unchanged",
    "schedules": "unchanged",
    "proxy_configuration": "unchanged",
}

if data.get("schema_version") != 1:
    raise SystemExit("invalid manifest schema")
if data.get("environment") != "Preview":
    raise SystemExit("manifest environment is not Preview")
if data.get("target_url") != "https://preview.muthufarms.com":
    raise SystemExit("manifest target URL is not Preview")
if data.get("deployment_kind") != "frontend-only":
    raise SystemExit("manifest is not frontend-only")
if data.get("base_commit") != current:
    raise SystemExit("manifest base does not match live Preview")
if data.get("protected_invariants") != expected_invariants:
    raise SystemExit("manifest protected invariants are incomplete")

allowed = data.get("allowed_paths")
if not isinstance(allowed, list) or not allowed:
    raise SystemExit("manifest allowed_paths is empty")
if len(allowed) != len(set(allowed)):
    raise SystemExit("manifest allowed_paths contains duplicates")
for path in allowed:
    if not isinstance(path, str) or not path or path.startswith("/") or ".." in path.split("/"):
        raise SystemExit("manifest contains an invalid path")
    if re.search(r"(^|/)(\.env($|\.)|docker-compose[^/]*|migrations?)(/|$)", path):
        raise SystemExit(f"hard-forbidden deployment path: {path}")
    if path.startswith(".github/workflows/production") or path.startswith("deploy/production"):
        raise SystemExit(f"Production path is forbidden: {path}")

actual = [line for line in pathlib.Path(actual_path).read_text(encoding="utf-8").splitlines() if line]
unexpected = sorted(set(actual) - set(allowed))
missing = sorted(set(allowed) - set(actual))
if unexpected or missing:
    print("manifest scope mismatch", file=sys.stderr)
    for path in unexpected:
        print(f"unexpected={path}", file=sys.stderr)
    for path in missing:
        print(f"missing={path}", file=sys.stderr)
    raise SystemExit(1)
PY
}

write_state() {
  local deployed_revision=$1 deployed_image_id=$2 deployed_image_tag=$3
  local rollback_container=$4 rollback_revision=$5 rollback_image_id=$6 rollback_image_tag=$7
  local temporary_state
  temporary_state=$(mktemp "$state_dir/state.XXXXXX")
  cat > "$temporary_state" <<EOF
deployed_revision=$deployed_revision
deployed_image_id=$deployed_image_id
deployed_image_tag=$deployed_image_tag
rollback_container=$rollback_container
rollback_revision=$rollback_revision
rollback_image_id=$rollback_image_id
rollback_image_tag=$rollback_image_tag
run_id=$run_id
updated_at=$timestamp
EOF
  chmod 600 "$temporary_state"
  mv "$temporary_state" "$state_file"
}

read_state_value() {
  local key=$1 value
  value=$(awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}' "$state_file")
  [[ $(grep -Ec "^${key}=" "$state_file") -eq 1 ]] || blocked "rollback state key is invalid: $key"
  printf '%s\n' "$value"
}

deploy_preview() {
  local remote_release new_image new_image_id
  remote_release=$(git ls-remote "$repo_url" "$release_ref" | awk 'NR == 1 {print $1}')
  [[ "$remote_release" == "$candidate_revision" ]] \
    || blocked "candidate is not the exact preview-release head"

  validate_common_live_state
  assert_candidate_port_available
  git clone --filter=blob:none --no-checkout "$repo_url" "$source_dir" >/dev/null 2>&1
  git -C "$source_dir" fetch --no-tags origin "+$release_ref:refs/remotes/origin/preview-release" >/dev/null 2>&1
  [[ "$(git -C "$source_dir" rev-parse refs/remotes/origin/preview-release)" == "$candidate_revision" ]] \
    || blocked "cloned preview-release head differs from approval"
  git -C "$source_dir" checkout --detach "$candidate_revision" >/dev/null 2>&1
  git -C "$source_dir" merge-base --is-ancestor "$original_revision" "$candidate_revision" \
    || blocked "candidate does not contain the live Preview baseline"
  [[ -z "$(git -C "$source_dir" status --short)" ]] || blocked "candidate checkout is not clean"
  cmp -s "$installed_deploy_script" "$source_dir/scripts/preview-server-deploy.sh" \
    || blocked "installed Preview deploy script does not match the approved candidate"
  validate_release_manifest

  new_image="mfms-v0-preview:github-${candidate_revision:0:7}-$timestamp"
  docker build \
    --pull=false \
    --file "$source_dir/Dockerfile.preview" \
    --build-arg "MFMS_GIT_COMMIT=$candidate_revision" \
    --build-arg "MFMS_BUILD_TIMESTAMP=$timestamp" \
    --build-arg "MFMS_BUILD_ENVIRONMENT=Preview" \
    --build-arg "NEXT_PUBLIC_MFMS_ENV=preview" \
    --build-arg "NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=mfms_server_uat" \
    --build-arg "NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED=true" \
    --tag "$new_image" \
    "$source_dir" >/dev/null
  new_image_id=$(docker image inspect --format '{{.Id}}' "$new_image")
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$new_image")" == "$candidate_revision" ]] \
    || blocked "built image revision label is invalid"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$new_image")" == "Preview" ]] \
    || blocked "built image is not labelled Preview"

  write_environment_file "$live_container" "$candidate_revision" "$timestamp"
  start_candidate "$new_image" "$candidate_revision"
  assert_preview_environment_banner "http://127.0.0.1:$candidate_port" \
    || blocked "candidate Preview environment banner is invalid"
  remove_candidate

  transaction_backup="$live_container-pre-github-$run_id-$timestamp"
  transaction_active=1
  docker stop --time 30 "$live_container" >/dev/null
  disconnect_preview_network "$live_container"
  docker rename "$live_container" "$transaction_backup"
  docker run -d \
    --log-driver json-file --log-opt max-size=20m --log-opt max-file=5 \
    --name "$live_container" \
    --network "$preview_network" \
    --ip "$original_network_ip" \
    --restart unless-stopped \
    -p "127.0.0.1:$live_port:3000" \
    --mount "type=bind,src=$orthomosaic_host_dir,dst=$orthomosaic_container_dir,readonly" \
    --env-file "$environment_file" \
    "$new_image" >/dev/null

  wait_for_version "http://127.0.0.1:$live_port" "$candidate_revision" \
    || blocked "replacement /api/version failed"
  smoke_routes "http://127.0.0.1:$live_port" || blocked "replacement local smoke test failed"
  assert_pmtiles_range "http://127.0.0.1:$live_port" \
    || blocked "replacement PMTiles range request failed"
  assert_preview_environment_banner "http://127.0.0.1:$live_port" \
    || blocked "replacement Preview environment banner is invalid"
  wait_for_public_preview_guard || blocked "public Preview authentication guard failed"
  assert_live_contract "$candidate_revision" "$new_image_id" "$before_unrelated"

  trap '' HUP INT TERM
  write_state \
    "$candidate_revision" "$new_image_id" "$new_image" \
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "deployment_environment=Preview"
  echo "deployment_url=$preview_url"
  echo "public_preview_guard=$public_guard_result"
  echo "previous_revision=$original_revision"
  echo "deployed_revision=$candidate_revision"
  echo "deployed_image=$new_image"
  echo "deployed_image_id=$new_image_id"
  echo "rollback_container=$transaction_backup"
  if [[ "$worker_secret_loaded" -eq 1 ]]; then
    echo "worker_actor_assertion=server-local"
  fi
  echo "backend_unchanged=true"
  echo "database_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "production_touched=0"
  echo "PREVIEW_DEPLOYMENT=PASS"
}

rollback_preview() {
  local deployed_revision deployed_image_id deployed_image_tag
  local rollback_container rollback_revision rollback_image_id rollback_image_tag
  local replacement_id rollback_reported_revision rollback_revision_for_match
  [[ -f "$state_file" ]] || blocked "no successful GitHub Preview deployment is recorded"
  validate_common_live_state

  deployed_revision=$(read_state_value deployed_revision)
  deployed_image_id=$(read_state_value deployed_image_id)
  deployed_image_tag=$(read_state_value deployed_image_tag)
  rollback_container=$(read_state_value rollback_container)
  rollback_revision=$(read_state_value rollback_revision)
  rollback_image_id=$(read_state_value rollback_image_id)
  rollback_image_tag=$(read_state_value rollback_image_tag)

  [[ "$deployed_revision" =~ ^[0-9a-f]{40}$ && "$rollback_revision" =~ ^[0-9a-f]{40}$ ]] \
    || blocked "rollback state revisions are invalid"
  [[ "$deployed_image_id" =~ ^sha256:[0-9a-f]{64}$ && "$rollback_image_id" =~ ^sha256:[0-9a-f]{64}$ ]] \
    || blocked "rollback state image IDs are invalid"
  [[ "$rollback_container" =~ ^mfms-pilot-web-pre-(github|rollback)-[0-9]+-[0-9]{8}T[0-9]{6}Z$ ]] \
    || blocked "rollback container name is invalid"
  [[ "$deployed_revision" == "$expected_current_revision" && "$original_revision" == "$deployed_revision" ]] \
    || blocked "current Preview does not match the recorded rollback state"
  [[ "$original_image_id" == "$deployed_image_id" ]] \
    || blocked "current Preview image does not match the recorded rollback state"
  container_exists "$rollback_container" || blocked "recorded rollback container is missing"
  ! container_running "$rollback_container" || blocked "recorded rollback container is unexpectedly running"
  [[ "$(docker inspect --format '{{.Image}}' "$rollback_container")" == "$rollback_image_id" ]] \
    || blocked "rollback container image ID changed"
  rollback_reported_revision=$(image_revision_for_container "$rollback_container")
  rollback_revision_for_match=$rollback_reported_revision
  if [[ "$rollback_revision_for_match" =~ ^([0-9a-f]{7,39})-project23$ ]]; then
    rollback_revision_for_match=${BASH_REMATCH[1]}
  fi
  if [[ "$rollback_revision_for_match" =~ ^[0-9a-f]{40}$ ]]; then
    [[ "$rollback_revision_for_match" == "$rollback_revision" ]] \
      || blocked "rollback container revision changed"
  elif [[ "$rollback_revision_for_match" =~ ^[0-9a-f]{7,39}$ ]] \
    && [[ "${rollback_revision:0:${#rollback_revision_for_match}}" == "$rollback_revision_for_match" ]]; then
    :
  else
    blocked "rollback container revision is invalid"
  fi

  write_environment_file "$rollback_container"
  start_candidate "$rollback_image_id" "$rollback_reported_revision"
  remove_candidate

  transaction_backup="$live_container-pre-rollback-$run_id-$timestamp"
  replacement_origin="$rollback_container"
  transaction_active=1
  docker stop --time 30 "$live_container" >/dev/null
  disconnect_preview_network "$live_container"
  docker rename "$live_container" "$transaction_backup"
  docker rename "$rollback_container" "$live_container"
  ensure_preview_network_ip "$live_container" "$original_network_ip" \
    || blocked "rollback replacement could not preserve the Preview network address"
  docker start "$live_container" >/dev/null
  replacement_id=$(docker inspect --format '{{.Image}}' "$live_container")

  wait_for_version "http://127.0.0.1:$live_port" "$rollback_reported_revision" \
    || blocked "rollback replacement /api/version failed"
  smoke_routes "http://127.0.0.1:$live_port" || blocked "rollback local smoke test failed"
  wait_for_public_preview_guard || blocked "public Preview rollback authentication guard failed"
  assert_live_contract "$rollback_reported_revision" "$replacement_id" "$before_unrelated"

  trap '' HUP INT TERM
  write_state \
    "$rollback_revision" "$replacement_id" "$rollback_image_tag" \
    "$transaction_backup" "$deployed_revision" "$deployed_image_id" "$deployed_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "rollback_environment=Preview"
  echo "rollback_url=$preview_url"
  echo "public_preview_guard=$public_guard_result"
  echo "previous_revision=$deployed_revision"
  echo "restored_revision=$rollback_revision"
  echo "rollback_container_retained=$transaction_backup"
  echo "backend_unchanged=true"
  echo "database_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "production_touched=0"
  echo "PREVIEW_ROLLBACK=PASS"
}

case "$operation" in
  deploy)
    deploy_preview
    ;;
  rollback)
    rollback_preview
    ;;
esac
