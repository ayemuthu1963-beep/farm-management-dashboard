#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

blocked() {
  echo "ONE_TIME_PREVIEW_SWITCH_BLOCKED=$1" >&2
  return 1
}

readonly live_name="mfms-pilot-web"
readonly retained_name="mfms-pilot-web-rollback-phase2g-b3-20260817T1200Z"
readonly restoration_name="mfms-pilot-web-restore-9842f21-one-time-20260817"
readonly current_container_id="315da9cfecbaa4ed7e1568e556f4a04ef8480e8f39210ad37c168972719da0a6"
readonly current_image_id="sha256:2fc73dd136c30cb1be58c55e60f4f9fcffe9f084c248acb7808c5c62dc73a8d5"
readonly current_image_tag="mfms-v0-preview:github-9842f21-20260817T121915Z"
readonly current_revision="9842f21a4bb04ff4f1750790392dbfee0dc941d3"
readonly current_environment_sha256="71f50a9f6a33a2e5bf5590b7ea3439a59757f595f1cce2e9315a4a2c6c21e0cd"
readonly approved_container_id="418d9e1cc36cc6298c5f4036792418b478276bc5a7774819a9f2b83005263283"
readonly approved_image_id="sha256:4159d9e484855be68eacf32a41b895e311ff2957b56f3be05f39dfae133cf266"
readonly approved_image_tag="mfms-v0-preview:github-fc791df-20260817T112359Z"
readonly approved_revision="fc791dfb090874e8ba16408ee38f910f161c9a52"
readonly preview_network="harvest-net"
readonly current_network_ip="172.19.128.10"
readonly retained_network_ip="172.19.0.11"
readonly live_port="3015"
readonly expected_port_json='{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3015"}]}'
readonly preview_url="https://preview.muthufarms.com"
readonly backend_container="harvest-api-pilot"
readonly backend_container_id="b18ce1bde02dbff87c82223f6ad5e463ca6af14a1aa8c9b176197588d45955c5"
readonly backend_image_id="sha256:b8d3ab5188a97e03f99d4a5661ec283956fc80a81da3e0a38545bec702fe9193"
readonly database_container="harvest-db"
readonly database_container_id="78b9762c1e5aa028f991b14aaba28ae4886117660899ea64f86a8892b50e0e9f"
readonly database_image_id="sha256:35323f3b2b873522d20362e6ec6e9935e26194313c8636d05124c6fae9acd20d"
readonly state_dir="/home/muthu/.local/state/mfms-preview-github"
readonly preview_lock="$state_dir/deployment.lock"
readonly test_lock="/home/muthu/.local/state/mfms-test-github/deployment.lock"
readonly production_lock="/home/muthu/.local/state/mfms-production-github/deployment.lock"
readonly one_time_lock="$state_dir/one-time-irrigation-preview-switch.lock"
readonly execution_marker="$state_dir/one-time-irrigation-preview-switch-fc791df.executed"
readonly wait_timeout_seconds="5400"
readonly network_reclaim_attempts="180"

readonly -a approved_running_services=(
  central-enketo-1
  central-enketo_redis_cache-1
  central-enketo_redis_main-1
  central-mail-1
  central-nginx-1
  central-postgres14-1
  central-pyxform-1
  central-service-1
  harvest-api
  harvest-api-pilot
  harvest-api-test
  harvest-db
  mfms-auth
  mfms-harvest-counter-api
  mfms-harvest-counter-api-preview
  mfms-harvest-counter-api-test
  mfms-pilot-web
  mfms-test-upstream-bridge
  mfms-test-web
  mfms-v0-preview-web
  portainer
)

mode=${1:-}
expected_helper_sha256=${2:-}
[[ $# -eq 2 ]] || blocked "usage: $0 --dry-run|--execute|--restore-only EXPECTED_HELPER_SHA256"
[[ "$mode" == "--dry-run" || "$mode" == "--execute" || "$mode" == "--restore-only" ]] \
  || blocked "mode must be --dry-run, --execute, or --restore-only"
[[ "$expected_helper_sha256" =~ ^[0-9a-f]{64}$ ]] || blocked "helper SHA-256 is invalid"
[[ "$(sha256sum "$0" | awk '{print $1}')" == "$expected_helper_sha256" ]] \
  || blocked "helper SHA-256 differs from the reviewed artifact"
[[ "$(id -u)" -ne 0 ]] || blocked "root execution is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved server user is muthu"

for required_command in \
  awk cmp curl date docker flock grep id install mktemp paste pgrep python3 readlink \
  rm sed seq sha256sum sleep sort timeout tr wc
do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

temporary_live=0
restored=0
switch_locks_held=0
work_dir=""
protected_before=""

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1")" == "true" ]]
}

container_name() {
  docker inspect --format '{{.Name}}' "$1" | sed 's#^/##'
}

container_environment_sha256() {
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" \
    | LC_ALL=C sort \
    | sha256sum \
    | awk '{print $1}'
}

container_environment_value() {
  local container=$1 key=$2
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
    | awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}'
}

image_revision() {
  docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$1"
}

image_environment() {
  docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$1"
}

network_ip() {
  local container=$1
  docker inspect --format '{{json .NetworkSettings.Networks}}' "$container" \
    | python3 -c '
import json
import sys

network = (json.load(sys.stdin).get(sys.argv[1]) or {})
print(network.get("IPAddress") or "")
' "$preview_network"
}

network_requested_ip() {
  local container=$1
  docker inspect --format '{{json .NetworkSettings.Networks}}' "$container" \
    | python3 -c '
import json
import sys

network = (json.load(sys.stdin).get(sys.argv[1]) or {})
ipam = network.get("IPAMConfig") or {}
print(ipam.get("IPv4Address") or "")
' "$preview_network"
}

check_lock_available() {
  local lock=$1 label=$2
  if [[ -e "$lock" ]] && ! flock -n "$lock" true; then
    blocked "$label deployment lock is held"
  fi
}

active_deployment_process_count() {
  local self_path
  self_path=$(readlink -f "$0")
  { pgrep -af 'mfms-(preview|test|production).*(deploy|rollback)|deploy-(preview|test|production)' || true; } \
    | awk -v self_path="$self_path" '
        index($0, "pgrep -af") == 0 && index($0, self_path) == 0 { count += 1 }
        END { print count + 0 }
      '
}

validate_running_service_manifest() {
  local expected actual
  expected=$(printf '%s\n' "${approved_running_services[@]}" | LC_ALL=C sort)
  actual=$(docker ps --format '{{.Names}}' | LC_ALL=C sort)
  [[ "$actual" == "$expected" ]] || {
    echo "EXPECTED_RUNNING_SERVICES_BEGIN" >&2
    printf '%s\n' "$expected" >&2
    echo "EXPECTED_RUNNING_SERVICES_END" >&2
    echo "ACTUAL_RUNNING_SERVICES_BEGIN" >&2
    printf '%s\n' "$actual" >&2
    echo "ACTUAL_RUNNING_SERVICES_END" >&2
    blocked "running service identity differs from the approved 21-service manifest"
  }
  [[ "$(docker ps -q | wc -l | tr -d '[:space:]')" == "21" ]] \
    || blocked "running container count differs from 21"
  [[ "$(docker ps --filter health=unhealthy -q | wc -l | tr -d '[:space:]')" == "0" ]] \
    || blocked "an active unhealthy container exists"
  [[ "$(docker ps --filter status=restarting -q | wc -l | tr -d '[:space:]')" == "0" ]] \
    || blocked "an active restarting container exists"
}

validate_container_identity() {
  local container=$1 expected_id=$2 expected_image=$3 expected_revision=$4 expected_environment=$5
  container_exists "$container" || blocked "container is missing: $container"
  [[ "$(docker inspect --format '{{.Id}}' "$container")" == "$expected_id" ]] \
    || blocked "container ID differs: $container"
  [[ "$(docker inspect --format '{{.Image}}' "$container")" == "$expected_image" ]] \
    || blocked "image ID differs: $container"
  [[ "$(image_revision "$expected_image")" == "$expected_revision" ]] \
    || blocked "image revision differs: $container"
  [[ "$(image_environment "$expected_image")" == "$expected_environment" ]] \
    || blocked "image environment differs: $container"
}

validate_current_restoration_target() {
  validate_container_identity \
    "$current_container_id" "$current_container_id" "$current_image_id" "$current_revision" Preview
  [[ "$(container_name "$current_container_id")" == "$live_name" ]] \
    || blocked "current Preview container name differs"
  container_running "$current_container_id" || blocked "current Preview container is not running"
  [[ "$(docker inspect --format '{{.Config.Image}}' "$current_container_id")" == "$current_image_tag" ]] \
    || blocked "current Preview image tag differs"
  [[ "$(container_environment_sha256 "$current_container_id")" == "$current_environment_sha256" ]] \
    || blocked "current Preview environment SHA-256 differs"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$current_container_id")" == "$expected_port_json" ]] \
    || blocked "current Preview port binding differs"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$current_container_id")" == "$preview_network" ]] \
    || blocked "current Preview network mode differs"
  [[ "$(network_ip "$current_container_id")" == "$current_network_ip" ]] \
    || blocked "current Preview live IP differs"
  [[ "$(network_requested_ip "$current_container_id")" == "$current_network_ip" ]] \
    || blocked "current Preview fixed IP differs"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$current_container_id")" == "unless-stopped" ]] \
    || blocked "current Preview restart policy differs"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$current_container_id")" == "0" ]] \
    || blocked "current Preview restart count is nonzero"
}

validate_retained_approved_target() {
  validate_container_identity \
    "$approved_container_id" "$approved_container_id" "$approved_image_id" "$approved_revision" Preview
  [[ "$(container_name "$approved_container_id")" == "$retained_name" ]] \
    || blocked "retained approved container name differs"
  ! container_running "$approved_container_id" || blocked "retained approved container is unexpectedly running"
  [[ "$(docker inspect --format '{{.Config.Image}}' "$approved_container_id")" == "$approved_image_tag" ]] \
    || blocked "retained approved image tag differs"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$approved_container_id")" == "$expected_port_json" ]] \
    || blocked "retained approved port binding differs"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$approved_container_id")" == "$preview_network" ]] \
    || blocked "retained approved network mode differs"
  [[ "$(network_requested_ip "$approved_container_id")" == "$retained_network_ip" ]] \
    || blocked "retained approved fixed IP differs"
  [[ "$(container_environment_value "$approved_container_id" MFMS_ENV)" == "preview" ]] \
    || blocked "retained approved MFMS_ENV is not Preview"
  [[ "$(container_environment_value "$approved_container_id" MFMS_TARGET_DATABASE)" == "mfms_server_uat" ]] \
    || blocked "retained approved database target is not UAT"
  [[ "$(container_environment_value "$approved_container_id" HARVEST_API_BASE_URL)" == "http://harvest-api-pilot:8000" ]] \
    || blocked "retained approved backend target differs"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$approved_container_id")" == "unless-stopped" ]] \
    || blocked "retained approved restart policy differs"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$approved_container_id")" == "0" ]] \
    || blocked "retained approved restart count is nonzero"
}

validate_protected_services() {
  [[ "$(docker inspect --format '{{.Id}}' "$backend_container")" == "$backend_container_id" ]] \
    || blocked "Preview backend container ID differs"
  [[ "$(docker inspect --format '{{.Image}}' "$backend_container")" == "$backend_image_id" ]] \
    || blocked "Preview backend image differs"
  container_running "$backend_container" || blocked "Preview backend is not running"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$backend_container")" == "0" ]] \
    || blocked "Preview backend restart count is nonzero"
  [[ "$(docker inspect --format '{{.Id}}' "$database_container")" == "$database_container_id" ]] \
    || blocked "database container ID differs"
  [[ "$(docker inspect --format '{{.Image}}' "$database_container")" == "$database_image_id" ]] \
    || blocked "database image differs"
  container_running "$database_container" || blocked "database is not running"
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$database_container")" == "healthy" ]] \
    || blocked "database is not healthy"
}

validate_no_candidates() {
  [[ "$(docker ps -a --format '{{.Names}}' | grep -Ec '^(mfms-pilot-web|mfms-v0-preview-web)-candidate-' || true)" == "0" ]] \
    || blocked "a Preview or Production frontend candidate container exists"
  ! container_exists "$restoration_name" || blocked "the one-time restoration container name already exists"
}

snapshot_protected_containers() {
  local id name
  docker ps -aq | while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    name=$(container_name "$id")
    case "$name" in
      mfms-pilot-web*|mfms-v0-preview-web*)
        continue
        ;;
    esac
    docker inspect --format '{{.Id}}|{{.Name}}|{{.Image}}|{{.State.Running}}|{{.RestartCount}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}' "$id"
  done | LC_ALL=C sort
}

validate_protected_snapshot() {
  [[ -n "$protected_before" && -f "$protected_before" ]] || blocked "protected-container baseline is unavailable"
  cmp -s "$protected_before" <(snapshot_protected_containers) \
    || blocked "a protected backend, database, ODK, Test, infrastructure, or unrelated container changed"
}

wait_for_version() {
  local expected=$1 payload attempt
  for attempt in $(seq 1 90); do
    if payload=$(curl -fsS --max-time 10 "http://127.0.0.1:$live_port/api/version" 2>/dev/null); then
      if python3 -c '
import json
import sys

payload = json.loads(sys.argv[1])
raise SystemExit(0 if payload.get("git_commit") == sys.argv[2] and payload.get("environment") == "Preview" else 1)
' "$payload" "$expected"; then
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

wait_for_public_preview() {
  local status attempt
  for attempt in $(seq 1 60); do
    status=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$preview_url/" 2>/dev/null || true)
    case "$status" in
      200|301|302|303|307|401)
        return 0
        ;;
    esac
    sleep 1
  done
  return 1
}

disconnect_network() {
  docker network disconnect -f "$preview_network" "$1" >/dev/null 2>&1 || true
}

ensure_network_ip() {
  local container=$1 expected_ip=$2 attempt
  for attempt in $(seq 1 "$network_reclaim_attempts"); do
    [[ "$(network_ip "$container")" == "$expected_ip" || "$(network_requested_ip "$container")" == "$expected_ip" ]] \
      && return 0
    disconnect_network "$container"
    if docker network connect --ip "$expected_ip" "$preview_network" "$container" >/dev/null 2>&1; then
      [[ "$(network_ip "$container")" == "$expected_ip" || "$(network_requested_ip "$container")" == "$expected_ip" ]] \
        && return 0
    fi
    sleep 1
  done
  return 1
}

announce_preview_identity() {
  docker run --rm -i \
    --network "container:$live_name" \
    --entrypoint python \
    "$backend_image_id" - <<'PY'
import fcntl
import socket
import struct
import time

interface = "eth0"
with open(f"/sys/class/net/{interface}/address", encoding="ascii") as handle:
    mac_text = handle.read().strip()
mac = bytes.fromhex(mac_text.replace(":", ""))

probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    address = fcntl.ioctl(
        probe.fileno(),
        0x8915,
        struct.pack("256s", interface.encode("ascii")[:15]),
    )[20:24]
finally:
    probe.close()

ethernet = b"\xff" * 6 + mac + struct.pack("!H", 0x0806)
arp_prefix = struct.pack("!HHBB", 1, 0x0800, 6, 4)
zero_mac = b"\x00" * 6
request = ethernet + arp_prefix + struct.pack("!H", 1) + mac + address + zero_mac + address
reply = ethernet + arp_prefix + struct.pack("!H", 2) + mac + address + b"\xff" * 6 + address

raw = socket.socket(socket.AF_PACKET, socket.SOCK_RAW)
try:
    raw.bind((interface, 0))
    for _ in range(3):
        raw.send(request)
        raw.send(reply)
        time.sleep(0.2)
finally:
    raw.close()
PY
}

acquire_switch_locks() {
  exec 8>"$preview_lock"
  flock -n 8 || blocked "Preview deployment lock became held"
  exec 7>"$test_lock"
  flock -n 7 || blocked "Test deployment lock became held"
  switch_locks_held=1
}

release_switch_locks() {
  if [[ "$switch_locks_held" -eq 1 ]]; then
    flock -u 7 || true
    flock -u 8 || true
    exec 7>&-
    exec 8>&-
    switch_locks_held=0
  fi
}

reacquire_switch_locks_for_restoration() {
  local attempt
  release_switch_locks
  exec 8>"$preview_lock"
  exec 7>"$test_lock"
  for attempt in $(seq 1 300); do
    if flock -n 8; then
      if flock -n 7; then
        switch_locks_held=1
        return 0
      fi
      flock -u 8 || true
    fi
    sleep 1
  done
  return 1
}

restore_preview() {
  local approved_name current_name
  echo "AUTOMATIC_RESTORATION_BEGIN=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  reacquire_switch_locks_for_restoration \
    || { echo "PREVIEW_RESTORATION_FAILED=deployment locks could not be reacquired" >&2; return 1; }

  container_exists "$current_container_id" \
    || { echo "PREVIEW_RESTORATION_FAILED=current container is missing" >&2; return 1; }
  container_exists "$approved_container_id" \
    || { echo "PREVIEW_RESTORATION_FAILED=approved container is missing" >&2; return 1; }

  if container_running "$approved_container_id"; then
    docker stop --time 30 "$approved_container_id" >/dev/null || return 1
  fi
  disconnect_network "$approved_container_id"

  approved_name=$(container_name "$approved_container_id")
  if [[ "$approved_name" != "$retained_name" ]]; then
    ! container_exists "$retained_name" \
      || { echo "PREVIEW_RESTORATION_FAILED=retained name is occupied" >&2; return 1; }
    docker rename "$approved_container_id" "$retained_name" >/dev/null || return 1
  fi
  ensure_network_ip "$approved_container_id" "$retained_network_ip" \
    || { echo "PREVIEW_RESTORATION_FAILED=approved retained IP could not be restored" >&2; return 1; }

  current_name=$(container_name "$current_container_id")
  if [[ "$current_name" != "$live_name" ]]; then
    ! container_exists "$live_name" \
      || { echo "PREVIEW_RESTORATION_FAILED=live name is occupied" >&2; return 1; }
    docker rename "$current_container_id" "$live_name" >/dev/null || return 1
  fi
  disconnect_network "$current_container_id"
  ensure_network_ip "$current_container_id" "$current_network_ip" \
    || { echo "PREVIEW_RESTORATION_FAILED=current fixed IP could not be restored" >&2; return 1; }
  docker start "$current_container_id" >/dev/null || return 1
  announce_preview_identity >/dev/null 2>&1 || return 1
  wait_for_version "$current_revision" || return 1
  wait_for_public_preview || return 1

  [[ "$(container_name "$current_container_id")" == "$live_name" ]] || return 1
  [[ "$(docker inspect --format '{{.Image}}' "$current_container_id")" == "$current_image_id" ]] || return 1
  [[ "$(container_environment_sha256 "$current_container_id")" == "$current_environment_sha256" ]] || return 1
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$current_container_id")" == "$expected_port_json" ]] || return 1
  [[ "$(network_ip "$current_container_id")" == "$current_network_ip" ]] || return 1
  [[ "$(container_name "$approved_container_id")" == "$retained_name" ]] || return 1
  ! container_running "$approved_container_id" || return 1
  [[ "$(network_requested_ip "$approved_container_id")" == "$retained_network_ip" ]] || return 1
  validate_protected_services || return 1
  validate_running_service_manifest || return 1
  if [[ -n "$protected_before" && -f "$protected_before" ]]; then
    validate_protected_snapshot || return 1
  fi

  temporary_live=0
  restored=1
  echo "RESTORED_PREVIEW_CONTAINER_ID=$current_container_id"
  echo "RESTORED_PREVIEW_IMAGE_ID=$current_image_id"
  echo "RESTORED_PREVIEW_REVISION=$current_revision"
  echo "PREVIEW_RESTORATION=PASS"
  return 0
}

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  if [[ "$temporary_live" -eq 1 && "$restored" -eq 0 ]]; then
    if restore_preview; then
      echo "AUTOMATIC_RESTORATION=PASS"
    else
      echo "AUTOMATIC_RESTORATION=FAILED" >&2
      status=97
    fi
  fi
  release_switch_locks
  if [[ -n "$work_dir" && -d "$work_dir" ]]; then
    rm -rf -- "$work_dir"
  fi
  exit "$status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

validate_preconditions() {
  check_lock_available "$preview_lock" Preview
  check_lock_available "$test_lock" Test
  check_lock_available "$production_lock" Production
  [[ "$(active_deployment_process_count)" == "0" ]] \
    || blocked "an MFMS deployment or rollback process is active"
  validate_running_service_manifest
  validate_current_restoration_target
  validate_retained_approved_target
  validate_protected_services
  validate_no_candidates
  [[ ! -e "$execution_marker" ]] || blocked "the one-time switch execution marker already exists"
}

run_dry_run() {
  validate_preconditions
  echo "DRY_RUN_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HELPER_SHA256=$expected_helper_sha256"
  echo "RUNNING_SERVICE_COUNT=21"
  echo "CURRENT_CONTAINER_ID=$current_container_id"
  echo "CURRENT_IMAGE_ID=$current_image_id"
  echo "CURRENT_REVISION=$current_revision"
  echo "CURRENT_ENVIRONMENT_SHA256=$current_environment_sha256"
  echo "CURRENT_PORT=127.0.0.1:$live_port->3000"
  echo "CURRENT_NETWORK=$preview_network"
  echo "CURRENT_FIXED_IP=$current_network_ip"
  echo "APPROVED_CONTAINER_ID=$approved_container_id"
  echo "APPROVED_IMAGE_ID=$approved_image_id"
  echo "APPROVED_REVISION=$approved_revision"
  echo "APPROVED_ENVIRONMENT_SHA256=$(container_environment_sha256 "$approved_container_id")"
  echo "PREVIEW_BACKEND_ID=$backend_container_id"
  echo "PREVIEW_BACKEND_IMAGE_ID=$backend_image_id"
  echo "DATABASE_CONTAINER_ID=$database_container_id"
  echo "DATABASE_IMAGE_ID=$database_image_id"
  echo "PREVIEW_LOCK=available"
  echo "TEST_LOCK=available"
  echo "PRODUCTION_LOCK=available"
  echo "IMAGE_REBUILD=prohibited"
  echo "INSTALLED_HELPER_STATE=unchanged"
  echo "PREVIEW_DEPLOYMENT_STATE_FILE=unchanged"
  echo "ONE_TIME_PREVIEW_SWITCH_DRY_RUN=PASS"
}

run_execute() {
  validate_preconditions
  exec 9>"$one_time_lock"
  flock -n 9 || blocked "another one-time Preview switch is active"
  acquire_switch_locks
  check_lock_available "$production_lock" Production
  validate_running_service_manifest
  validate_current_restoration_target
  validate_retained_approved_target
  validate_protected_services
  validate_no_candidates

  work_dir=$(mktemp -d "$state_dir/one-time-irrigation-switch.XXXXXX")
  protected_before="$work_dir/protected.before"
  snapshot_protected_containers > "$protected_before"

  install -m 600 /dev/null "$execution_marker"
  printf 'helper_sha256=%s\nstarted_at=%s\ncurrent_container_id=%s\napproved_container_id=%s\n' \
    "$expected_helper_sha256" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$current_container_id" "$approved_container_id" > "$execution_marker"

  temporary_live=1
  docker stop --time 30 "$current_container_id" >/dev/null
  disconnect_network "$current_container_id"
  docker rename "$current_container_id" "$restoration_name" >/dev/null

  disconnect_network "$approved_container_id"
  docker rename "$approved_container_id" "$live_name" >/dev/null
  ensure_network_ip "$approved_container_id" "$current_network_ip" \
    || blocked "approved Preview container could not claim the preserved live IP"
  docker start "$approved_container_id" >/dev/null
  announce_preview_identity >/dev/null 2>&1 \
    || blocked "approved Preview container could not announce the live network identity"
  wait_for_version "$approved_revision" \
    || blocked "approved Preview /api/version is incompatible or unhealthy"
  wait_for_public_preview \
    || blocked "approved Preview public authentication guard is unavailable"

  [[ "$(container_name "$approved_container_id")" == "$live_name" ]] \
    || blocked "approved Preview did not receive the live container name"
  [[ "$(docker inspect --format '{{.Image}}' "$approved_container_id")" == "$approved_image_id" ]] \
    || blocked "approved Preview image changed after switch"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$approved_container_id")" == "$expected_port_json" ]] \
    || blocked "approved Preview port changed after switch"
  [[ "$(network_ip "$approved_container_id")" == "$current_network_ip" ]] \
    || blocked "approved Preview live IP changed after switch"
  validate_protected_services
  validate_running_service_manifest
  validate_protected_snapshot

  release_switch_locks
  check_lock_available "$preview_lock" Preview
  check_lock_available "$test_lock" Test
  check_lock_available "$production_lock" Production

  echo "TEMPORARY_PREVIEW_CONTAINER_ID=$approved_container_id"
  echo "TEMPORARY_PREVIEW_IMAGE_ID=$approved_image_id"
  echo "TEMPORARY_PREVIEW_REVISION=$approved_revision"
  echo "TEMPORARY_PREVIEW_READY=PASS"
  echo "WAITING_FOR_RESTORE_COMMAND=RESTORE"

  local command
  if ! IFS= read -r -t "$wait_timeout_seconds" command; then
    blocked "restore command timed out"
  fi
  [[ "$command" == "RESTORE" ]] || blocked "unexpected control command"
  restore_preview || blocked "mandatory Preview restoration failed"
  echo "ONE_TIME_PREVIEW_SWITCH_EXECUTION=PASS"
}

run_restore_only() {
  exec 9>"$one_time_lock"
  flock -n 9 || blocked "another one-time Preview switch is active"
  work_dir=$(mktemp -d "$state_dir/one-time-irrigation-restore.XXXXXX")
  temporary_live=1
  restore_preview || blocked "emergency Preview restoration failed"
  echo "ONE_TIME_PREVIEW_RESTORE_ONLY=PASS"
}

case "$mode" in
  --dry-run)
    run_dry_run
    ;;
  --execute)
    run_execute
    ;;
  --restore-only)
    run_restore_only
    ;;
esac
