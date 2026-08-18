#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

blocked() {
  echo "PRODUCTION_DEPLOY_BLOCKED=$1" >&2
  return 1
}

[[ $# -eq 0 ]] || blocked "arguments are not accepted"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Production SSH user is muthu"

for required_command in \
  awk cat chmod cmp crontab curl date docker flock git grep id install mktemp mv \
  python3 rm sed seq sha256sum sleep sort ss systemctl tr
do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

readonly repo_url="https://github.com/ayemuthu1963-beep/farm-management-dashboard.git"
readonly release_ref="refs/heads/production-release"
readonly live_container="mfms-v0-preview-web"
readonly preview_container="mfms-pilot-web"
readonly backend_container="harvest-api"
readonly proxy_container="central-nginx-1"
readonly production_network="harvest-net"
readonly production_url="https://muthufarms.com"
readonly central_login_url="https://auth.muthufarms.com/login"
readonly live_port="3014"
readonly candidate_port="3013"
readonly expected_running_containers="21"
readonly network_reclaim_attempts="180"
readonly state_dir="/home/muthu/.local/state/mfms-production-github"
readonly state_file="$state_dir/last-successful-frontend-switch"
readonly lock_file="$state_dir/deployment.lock"
readonly worker_secret_file="$state_dir/worker-management-signing.env"
readonly coordinated_candidate_revision="9a577add2308b85637fcf05ee49b6274e19cc2dc"
readonly coordinated_candidate_tree="e102fe82bdb6b009012933684c6db3d927f53a7a"
readonly coordinated_backend_revision="94b28f17702e409e13d25e288fc5cd4b9bbef545"
readonly coordinated_backend_container_id="969d9cab57c47c06716b3e94d858f3a56cd145a39280ca41c417b497647fef47"
readonly coordinated_backend_image_id="sha256:55b070597e6ee195f50226e7a0e4834a2e64986b20c5d53fa758ee925f45f512"
readonly coordinated_backend_environment_sha256="90213d0772f3fa45c40987748bc4b1815cdb55fb24e701ecd4a2bcc941e81e12"
readonly coordinated_backup_path="/home/muthu/.local/state/mfms-production-github/database-backups/mfms_server_prod-pre-94b28f17702e409e13d25e288fc5cd4b9bbef545-20260818T050946Z.dump"
readonly coordinated_backup_bytes="1762112"
readonly coordinated_backup_sha256="9ea00949fd57a579bbee1b6765f8faf7bc88268166bc05c5cc087088dcd47e13"
readonly coordinated_settings_migration="db/migrations/20260818_production_irrigation_plan_settings.sql"
readonly coordinated_settings_sha256="87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1"
readonly coordinated_audit_migration="db/migrations/20260818_production_irrigation_plan_persistence_v2.sql"
readonly coordinated_audit_sha256="5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9"
readonly coordinated_frontend_baseline_revision="e9833917c0a7fd190d933acb8cb234f60f5c8c65"
readonly coordinated_frontend_baseline_container_id="2e8781b403c115b08a15faf0f88e75fca1faa8a6f055128365329e159a119436"
readonly coordinated_frontend_baseline_image_id="sha256:6f3e81bef1f52c643e12c37a72b195d146a28e3f2eb6ca681cc6d9192b3081a8"
readonly coordinated_frontend_baseline_environment_sha256="530e3be8c0957715d98b4253b2b7d50c39f5115b85d8e70543ac7f3cb09883d7"
readonly coordinated_frontend_baseline_ipv4="172.19.128.7"
readonly coordinated_verification_actor="production-release-verification"

[[ "$production_url" == "https://muthufarms.com" ]] \
  || blocked "the public target is not Production"

install -d -m 700 "$state_dir"
exec 9>"$lock_file"
flock -n 9 || blocked "another Production deployment or rollback is already running"

operation=""
candidate_revision=""
expected_current_revision=""
run_id=""
readonly deploy_command_pattern='^deploy-production-frontend ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9]+)$'
readonly rollback_command_pattern='^rollback-production-frontend ([0-9a-f]{40}) ([0-9]+)$'
readonly preflight_command_pattern='^preflight-production-frontend ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9]+)$'

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
elif [[ "$original_command" =~ $preflight_command_pattern ]]; then
  operation="preflight"
  candidate_revision=${BASH_REMATCH[1]}
  expected_current_revision=${BASH_REMATCH[2]}
  run_id=${BASH_REMATCH[3]}
else
  blocked "the SSH key accepts only an exact Production deploy, preflight, or rollback command"
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
preview_approved_revision=""
preview_approved_image_id=""
preview_feature_revision=""
preview_verified_file_count=""
candidate_tree=""
coordinated_database_before="$work_dir/coordinated-database.before.json"
coordinated_database_after_read="$work_dir/coordinated-database.after-read.json"
coordinated_database_after_deploy="$work_dir/coordinated-database.after-deploy.json"

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1")" == "true" ]]
}

network_ip_for_container() {
  local container=$1
  # A stopped container has no runtime IPAddress even after a successful
  # static network attachment. Docker records the requested address in
  # IPAMConfig until the container starts. Parse Docker's JSON because its Go
  # template formatter renders that stopped-container value as "invalid IP".
  docker inspect \
    --format '{{json .NetworkSettings.Networks}}' \
    "$container" \
    | python3 -c '
import json
import sys

networks = json.load(sys.stdin)
network = networks.get(sys.argv[1]) or {}
ipam = network.get("IPAMConfig") or {}
print(network.get("IPAddress") or ipam.get("IPv4Address") or "")
' "$production_network"
}

disconnect_production_network() {
  local container=$1
  docker network disconnect -f "$production_network" "$container" >/dev/null 2>&1 || true
}

ensure_production_network_ip() {
  local container=$1 expected_ip=$2 current_ip attempt
  # Docker's bridge IPAM can retain a just-disconnected static address for
  # longer than 30 seconds. Keep the transaction locked and retry for up to
  # three minutes so rollback and automatic restoration do not fail during
  # that eventual-consistency window.
  for attempt in $(seq 1 "$network_reclaim_attempts"); do
    current_ip=$(network_ip_for_container "$container")
    [[ "$current_ip" == "$expected_ip" ]] && return 0
    # Historical containers can retain a stale endpoint record even when
    # Docker reports no active IP. Clear it before reclaiming the established
    # address used by the shared nginx upstream.
    docker network disconnect -f "$production_network" "$container" >/dev/null 2>&1 || true
    docker network connect --ip "$expected_ip" "$production_network" "$container" \
      >/dev/null 2>&1 || {
        sleep 1
        continue
      }
    current_ip=$(network_ip_for_container "$container")
    [[ "$current_ip" == "$expected_ip" ]] && return 0
    sleep 1
  done
  return 1
}

announce_production_network_identity() {
  local helper_image
  helper_image=$(docker inspect --format '{{.Image}}' "$backend_container")
  docker run --rm -i \
    --network "container:$live_container" \
    --entrypoint python \
    "$helper_image" - <<'PY'
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

print(f"gratuitous_arp=PASS ip={socket.inet_ntoa(address)} mac={mac_text}")
PY
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

environment_sha256_for_container() {
  local container=$1
  docker inspect --format '{{json .Config.Env}}' "$container" \
    | python3 -c 'import hashlib,json,sys; values=sorted(json.load(sys.stdin) or []); print(hashlib.sha256(("\n".join(values)+"\n").encode()).hexdigest())'
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
  docker exec "$proxy_container" sh -c '
    upstream_count=$(grep -R -E "^[[:space:]]*server[[:space:]]+mfms-v0-preview-web:3000;" /etc/nginx/conf.d 2>/dev/null | wc -l | tr -d "[:space:]")
    route_count=$(grep -R -E "^[[:space:]]*proxy_pass[[:space:]]+http://mfms_production_frontend;" /etc/nginx/conf.d 2>/dev/null | wc -l | tr -d "[:space:]")
    if [ "$upstream_count" -eq 1 ] && [ "$route_count" -ge 1 ]; then
      printf "%s\n" "$route_count"
    else
      printf "0\n"
    fi
  ' \
    | tr -d '[:space:]'
}

wait_for_version() {
  local base_url=$1 expected_revision=$2 payload attempt
  for attempt in $(seq 1 60); do
    if payload=$(curl -fsS --max-time 10 "$base_url/api/version" 2>/dev/null); then
      if python3 -c \
        'import json,sys; data=json.load(sys.stdin); raise SystemExit(0 if data.get("git_commit")==sys.argv[1] and data.get("environment")=="Production" else 1)' \
        "$expected_revision" <<<"$payload"; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

wait_for_public_production_guard() {
  local headers status location attempt
  headers=$(mktemp "$work_dir/public-production-guard.XXXXXX")
  for attempt in $(seq 1 30); do
    : > "$headers"
    status=$(curl -sS -o /dev/null -D "$headers" -w '%{http_code}' --max-time 10 \
      "$production_url/api/version" 2>/dev/null || true)
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
      if python3 - "$location" "$central_login_url" "$production_url/api/version" <<'PY'
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
    || blocked "Production candidate port $candidate_port is already allocated"
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
    printf 'MFMS_GIT_COMMIT=%s\nMFMS_BUILD_TIMESTAMP=%s\nMFMS_BUILD_ENVIRONMENT=Production\n' \
      "$target_revision" "$target_timestamp" >> "$environment_file"
  fi
  append_worker_environment
  chmod 600 "$environment_file"
  grep -Fqx 'MFMS_ENV=production' "$environment_file" \
    || blocked "frontend environment is not Production"
  grep -Fqx 'MFMS_TARGET_DATABASE=mfms_server_prod' "$environment_file" \
    || blocked "frontend database target is not UAT"
}

start_candidate() {
  local image=$1 revision=$2
  candidate_container="$live_container-candidate-$run_id-$timestamp"
  docker run -d \
    --name "$candidate_container" \
    --network "$production_network" \
    --restart no \
    -p "127.0.0.1:$candidate_port:3000" \
    --env-file "$environment_file" \
    "$image" >/dev/null
  wait_for_version "http://127.0.0.1:$candidate_port" "$revision" \
    || blocked "candidate /api/version did not report the approved revision"
  smoke_routes "http://127.0.0.1:$candidate_port" \
    || blocked "candidate route smoke test failed"
}

remove_candidate() {
  if [[ -n "$candidate_container" ]] && container_exists "$candidate_container"; then
    docker rm -f "$candidate_container" >/dev/null
  fi
  candidate_container=""
}

assert_live_contract() {
  local expected_revision=$1 expected_image_id=$2 expected_unrelated=$3
  container_exists "$live_container" || blocked "Production frontend container is missing"
  container_running "$live_container" || blocked "Production frontend container is not running"
  [[ "$(image_revision_for_container "$live_container")" == "$expected_revision" ]] \
    || blocked "Production frontend revision does not match"
  [[ "$(image_environment_for_container "$live_container")" == "Production" ]] \
    || blocked "Production frontend image is not labelled Production"
  [[ "$(docker inspect --format '{{.Image}}' "$live_container")" == "$expected_image_id" ]] \
    || blocked "Production frontend image ID does not match"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$live_container")" == "unless-stopped" ]] \
    || blocked "Production frontend restart policy changed"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$live_container")" == "$production_network" ]] \
    || blocked "Production frontend network changed"
  [[ "$(network_ip_for_container "$live_container")" == "$original_network_ip" ]] \
    || blocked "Production frontend network address changed"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$live_container")" == \
      '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3014"}]}' ]] \
    || blocked "Production frontend host port changed"
  [[ "$(docker inspect --format '{{len .Mounts}}' "$live_container")" == "0" ]] \
    || blocked "Production frontend mounts changed"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$live_container" \
    | grep -Fqx 'MFMS_TARGET_DATABASE=mfms_server_prod' \
    || blocked "Production frontend no longer targets the Production database"
  [[ "$(docker inspect --format '{{.Id}}' "$backend_container")" == "$backend_id_before" ]] \
    || blocked "Production backend container changed"
  [[ "$(docker inspect --format '{{.Image}}' "$backend_container")" == "$backend_image_before" ]] \
    || blocked "Production backend image changed"
  container_running "$backend_container" || blocked "Production backend stopped"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$backend_container" \
    | grep -Fqx 'POSTGRES_DB=mfms_server_prod' \
    || blocked "Production backend no longer targets the Production database"
  [[ "$(cron_digest)" == "$cron_digest_before" ]] || blocked "Production schedules changed"
  [[ "$(proxy_digest)" == "$proxy_digest_before" ]] || blocked "proxy configuration changed"
  [[ "$(proxy_target_count)" == "$proxy_target_count_before" ]] \
    || blocked "Production proxy target count changed"
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
      disconnect_production_network "$live_container" >/dev/null 2>&1 || true
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
    ensure_production_network_ip "$live_container" "$original_network_ip" \
      >/dev/null 2>&1 || return 1
    docker start "$live_container" >/dev/null 2>&1 || return 1
    announce_production_network_identity >/dev/null 2>&1 || return 1
    if wait_for_version "http://127.0.0.1:$live_port" "$original_reported_revision" \
      && smoke_routes "http://127.0.0.1:$live_port" \
      && wait_for_public_production_guard; then
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
  echo "PRODUCTION_TRANSACTION_ERROR=operation=$operation status=$status" >&2
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
  local failed_units running_id
  failed_units=$(systemctl --failed --no-legend --plain | sed '/^[[:space:]]*$/d' | wc -l | tr -d '[:space:]')
  [[ "$failed_units" == "0" ]] || blocked "the server has failed systemd units"
  [[ "$(docker ps -q | wc -l | tr -d '[:space:]')" == "$expected_running_containers" ]] \
    || blocked "the running container count is not the approved baseline"
  [[ "$(docker ps --filter health=unhealthy -q | wc -l | tr -d '[:space:]')" == "0" ]] \
    || blocked "an unhealthy container exists"
  while IFS= read -r running_id; do
    [[ -n "$running_id" ]] || continue
    [[ "$(docker inspect --format '{{.RestartCount}}' "$running_id")" == "0" ]] \
      || blocked "a running container has a nonzero restart count"
  done < <(docker ps -q)
  for maintenance_lock in \
    /home/muthu/.local/state/mfms-preview-github/deployment.lock \
    /home/muthu/.local/state/mfms-test-github/deployment.lock
  do
    [[ ! -e "$maintenance_lock" ]] || flock -n "$maintenance_lock" true \
      || blocked "another MFMS deployment or rollback is active"
  done
  container_exists "$live_container" || blocked "Production frontend container is missing"
  container_running "$live_container" || blocked "Production frontend container is not running"
  container_exists "$backend_container" || blocked "Production backend container is missing"
  container_running "$backend_container" || blocked "Production backend container is not running"
  container_exists "$proxy_container" || blocked "Production proxy container is missing"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$live_container")" == "$production_network" ]] \
    || blocked "live frontend is not on the Production network"
  [[ "$(image_environment_for_container "$live_container")" == "Production" ]] \
    || blocked "live frontend image is not labelled Production"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$live_container")" == \
      '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3014"}]}' ]] \
    || blocked "live frontend is not bound to the approved Production port"
  [[ "$(docker ps -a --format '{{.Names}}' | grep -Ec '^mfms-v0-preview-web-candidate-' || true)" -eq 0 ]] \
    || blocked "a stale Production candidate container exists"
  [[ "$(network_ip_for_container "$backend_container")" == "172.19.0.2" ]] \
    || blocked "Production harvest-api does not own 172.19.0.2"
  docker network inspect "$production_network" --format '{{json .}}' | python3 -c '
import ipaddress
import json
import sys

network = json.load(sys.stdin)
configs = network.get("IPAM", {}).get("Config", [])
if not any(
    item.get("Subnet") == "172.19.0.0/16"
    and item.get("Gateway") == "172.19.0.1"
    and item.get("IPRange") == "172.19.128.0/17"
    for item in configs
):
    raise SystemExit(1)
fixed = ipaddress.ip_address("172.19.0.2")
dynamic = ipaddress.ip_network("172.19.128.0/17")
if fixed in dynamic:
    raise SystemExit(1)
owners = [
    endpoint
    for endpoint in network.get("Containers", {}).values()
    if str(endpoint.get("IPv4Address", "")).split("/", 1)[0] == "172.19.0.2"
]
raise SystemExit(0 if len(owners) == 1 and owners[0].get("Name") == "harvest-api" else 1)
' \
    || blocked "Production Docker IPAM contract is invalid"
  for database_contract in \
    'harvest-api|mfms_prod_app|mfms_server_prod' \
    'harvest-api-pilot|mfms_uat_app|mfms_server_uat' \
    'harvest-api-test|mfms_test_app|mfms_server_test'
  do
    IFS='|' read -r api_container expected_role expected_database <<<"$database_contract"
    container_exists "$api_container" || blocked "database-isolated API container is missing: $api_container"
    container_running "$api_container" || blocked "database-isolated API container is stopped: $api_container"
    docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_container" \
      | python3 -c '
import sys
from urllib.parse import urlsplit

expected_role, expected_database = sys.argv[1:]
environment = dict(line.rstrip("\n").split("=", 1) for line in sys.stdin if "=" in line)
value = environment.get("DATABASE_URL", "").replace("postgresql+psycopg://", "postgresql://", 1)
parsed = urlsplit(value)
valid = (
    environment.get("POSTGRES_DB") == expected_database
    and parsed.scheme == "postgresql"
    and parsed.username == expected_role
    and parsed.hostname == "harvest-db"
    and parsed.port == 5432
    and parsed.path == f"/{expected_database}"
)
raise SystemExit(0 if valid else 1)
' "$expected_role" "$expected_database" \
      || blocked "database target or role isolation changed: $api_container"
  done
  for api_health in \
    http://127.0.0.1:8001/health \
    http://127.0.0.1:8015/health \
    http://127.0.0.1:8025/health
  do
    curl -fsS --max-time 10 "$api_health" >/dev/null \
      || blocked "an MFMS API health endpoint failed"
  done

  original_container_id=$(docker inspect --format '{{.Id}}' "$live_container")
  original_image_id=$(docker inspect --format '{{.Image}}' "$live_container")
  original_image_tag=$(docker inspect --format '{{.Config.Image}}' "$live_container")
  original_reported_revision=$(image_revision_for_container "$live_container")
  original_revision=$original_reported_revision
  original_network_ip=$(network_ip_for_container "$live_container")
  if [[ "$original_revision" =~ ^([0-9a-f]{7,39})-project22$ ]]; then
    original_revision=${BASH_REMATCH[1]}
  fi
  if [[ "$original_revision" =~ ^[0-9a-f]{40}$ ]]; then
    [[ "$original_revision" == "$expected_current_revision" ]] \
      || blocked "live Production revision differs from the approved current revision"
  elif [[ "$original_revision" =~ ^[0-9a-f]{7,39}$ ]] \
    && [[ "${expected_current_revision:0:${#original_revision}}" == "$original_revision" ]]; then
    original_revision=$expected_current_revision
  else
    blocked "live Production revision is invalid or does not match the approved current revision"
  fi
  python3 - "$original_network_ip" <<'PY' \
    || blocked "live Production network address is invalid"
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
    || blocked "Production proxy has no approved frontend target"
  snapshot_unrelated_containers > "$before_unrelated"
  wait_for_public_production_guard \
    || blocked "public Production authentication guard is unavailable"
}

validate_coordinated_backup() {
  python3 - "$coordinated_backup_path" "$coordinated_backup_bytes" <<'PY_COORDINATED_BACKUP'
import pathlib
import stat
import sys

path = pathlib.Path(sys.argv[1])
expected_bytes = int(sys.argv[2])
metadata = path.lstat()
if not stat.S_ISREG(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
    raise SystemExit("coordinated Production backup is not a regular file")
if stat.S_IMODE(metadata.st_mode) != 0o600:
    raise SystemExit("coordinated Production backup permissions changed")
if metadata.st_size != expected_bytes:
    raise SystemExit("coordinated Production backup size changed")
PY_COORDINATED_BACKUP
  [[ "$(sha256sum "$coordinated_backup_path" | awk '{print $1}')" == "$coordinated_backup_sha256" ]] \
    || blocked "coordinated Production backup checksum changed"
}

snapshot_coordinated_database_state() {
  local output=$1
  docker exec -i "$backend_container" python - > "$output" \
    "$coordinated_settings_migration" "$coordinated_settings_sha256" \
    "$coordinated_audit_migration" "$coordinated_audit_sha256" \
    "$coordinated_verification_actor" <<'PY_COORDINATED_DATABASE'
import hashlib
import json
import os
import sys

import psycopg
from psycopg.rows import dict_row

settings_name, settings_hash, audit_name, audit_hash, verification_actor = sys.argv[1:]


def digest(rows):
    payload = json.dumps(rows, default=str, separators=(",", ":"), sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()


connection = psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)
try:
    with connection.cursor() as cursor:
        cursor.execute("SET TRANSACTION READ ONLY")
        cursor.execute("SELECT current_database()")
        database = cursor.fetchone()["current_database"]
        cursor.execute("SELECT * FROM mfms_production_schema_migrations ORDER BY migration_name")
        ledger = cursor.fetchall()
        cursor.execute("SELECT * FROM mfms_irrigation_plan_settings ORDER BY setting_key")
        settings = cursor.fetchall()
        cursor.execute("SELECT * FROM mfms_irrigation_plan_audit ORDER BY audit_id")
        audit = cursor.fetchall()
        cursor.execute("""
            SELECT tgname, tgenabled
            FROM pg_trigger
            WHERE tgrelid = 'mfms_irrigation_plan_audit'::regclass
              AND NOT tgisinternal
            ORDER BY tgname
        """)
        triggers = cursor.fetchall()
finally:
    connection.rollback()
    connection.close()

irrigation_ledger = [
    {"migration_name": row["migration_name"], "sha256": row["sha256"]}
    for row in ledger
    if row["migration_name"] in {settings_name, audit_name}
]
put_audit_evidence = {
    key: sum(
        1 for row in audit
        if row["setting_key"] == key
        and row["actor"] == verification_actor
        and row["action"] == "save"
        and row["previous_payload"] == row["new_payload"]
    )
    for key in ("drip-output", "motor-run-schedule")
}
print(json.dumps({
    "database": database,
    "ledger_count": len(ledger),
    "ledger_sha256": digest(ledger),
    "irrigation_ledger": irrigation_ledger,
    "settings_count": len(settings),
    "settings_sha256": digest(settings),
    "audit_count": len(audit),
    "audit_sha256": digest(audit),
    "put_audit_evidence": put_audit_evidence,
    "triggers": triggers,
    "trigger_sha256": digest(triggers),
}, default=str, separators=(",", ":"), sort_keys=True))
PY_COORDINATED_DATABASE
  [[ -s "$output" ]] || blocked "coordinated database evidence is empty"
  python3 - "$output" \
    "$coordinated_settings_migration" "$coordinated_settings_sha256" \
    "$coordinated_audit_migration" "$coordinated_audit_sha256" <<'PY_VALIDATE_COORDINATED_DATABASE'
import json
import pathlib
import re
import sys

path, settings_name, settings_hash, audit_name, audit_hash = sys.argv[1:]
evidence = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
if evidence.get("database") != "mfms_server_prod":
    raise SystemExit("coordinated database evidence resolved to the wrong database")
expected_ledger = [
    {"migration_name": audit_name, "sha256": audit_hash},
    {"migration_name": settings_name, "sha256": settings_hash},
]
if evidence.get("irrigation_ledger") != expected_ledger or evidence.get("ledger_count") != 3:
    raise SystemExit("coordinated irrigation migration ledger is missing or changed")
if evidence.get("settings_count") != 2:
    raise SystemExit("coordinated irrigation settings table is missing or changed")
if evidence.get("put_audit_evidence") != {"drip-output": 1, "motor-run-schedule": 1}:
    raise SystemExit("coordinated authenticated PUT audit evidence is missing or changed")
if evidence.get("triggers") != [{"tgenabled": "O", "tgname": "mfms_irrigation_plan_audit_no_change"}]:
    raise SystemExit("coordinated append-only audit protection trigger is missing or changed")
for key in ("ledger_sha256", "settings_sha256", "audit_sha256", "trigger_sha256"):
    if re.fullmatch(r"[0-9a-f]{64}", str(evidence.get(key, ""))) is None:
        raise SystemExit(f"coordinated database evidence has an invalid {key}")
PY_VALIDATE_COORDINATED_DATABASE
}

probe_authenticated_irrigation_get() {
  local path=$1
  docker exec -i "$backend_container" python - "$path" <<'PY_AUTHENTICATED_IRRIGATION_GET'
import base64
import hashlib
import hmac
import json
import sys
import time
from urllib.request import Request, urlopen

from app.config import get_settings

path = sys.argv[1]
actor = "production-frontend-coordinated-guard"
settings = get_settings()
timestamp = str(int(time.time()))
canonical = "\n".join((timestamp, "GET", path, actor))
signature = hmac.new(
    settings.api_admin_password.encode("utf-8"),
    canonical.encode("utf-8"),
    hashlib.sha256,
).hexdigest()
basic = base64.b64encode(
    f"{settings.api_admin_username}:{settings.api_admin_password}".encode("utf-8")
).decode("ascii")
request = Request(
    "http://127.0.0.1:8000" + path,
    headers={
        "Authorization": "Basic " + basic,
        "X-MFMS-Authenticated-User": actor,
        "X-MFMS-Authenticated-User-Timestamp": timestamp,
        "X-MFMS-Authenticated-User-Signature": signature,
    },
)
with urlopen(request, timeout=10) as response:
    payload = json.load(response)
    if response.status != 200 or not isinstance(payload.get("rows"), list) or len(payload["rows"]) != 6:
        raise SystemExit("authenticated irrigation GET contract failed")
print(f"authenticated_endpoint=GET {path} 200")
PY_AUTHENTICATED_IRRIGATION_GET
}

verify_authenticated_irrigation_endpoint_evidence() {
  local backend_logs="$work_dir/coordinated-backend.log" path
  curl -fsS --max-time 10 http://127.0.0.1:8001/openapi.json \
    | python3 -c '
import json
import sys

paths = json.load(sys.stdin).get("paths", {})
required = (
    "/api/operator-settings/irrigation-plan/drip-output",
    "/api/operator-settings/irrigation-plan/motor-run-schedule",
)
raise SystemExit(0 if all({"get", "put"}.issubset(paths.get(path, {})) for path in required) else 1)
' || blocked "coordinated backend OpenAPI is missing an irrigation GET or PUT operation"
  for path in \
    /api/operator-settings/irrigation-plan/drip-output \
    /api/operator-settings/irrigation-plan/motor-run-schedule
  do
    probe_authenticated_irrigation_get "$path" \
      || blocked "coordinated authenticated irrigation GET failed: $path"
  done
  docker logs "$backend_container" > "$backend_logs" 2>&1
  for path in \
    /api/operator-settings/irrigation-plan/drip-output \
    /api/operator-settings/irrigation-plan/motor-run-schedule
  do
    grep -Fq "\"GET $path HTTP/1.1\" 200 OK" "$backend_logs" \
      || blocked "coordinated authenticated irrigation GET 200 evidence is missing: $path"
    grep -Fq "\"PUT $path HTTP/1.1\" 200 OK" "$backend_logs" \
      || blocked "coordinated authenticated irrigation PUT 200 evidence is missing: $path"
  done
}

validate_exact_coordinated_release_state() {
  [[ "$candidate_revision" == "$coordinated_candidate_revision" ]] \
    || blocked "coordinated frontend candidate revision is not approved"
  [[ "$candidate_tree" == "$coordinated_candidate_tree" ]] \
    || blocked "coordinated frontend candidate tree is not approved"
  [[ "$original_revision" == "$coordinated_frontend_baseline_revision" ]] \
    || blocked "coordinated frontend baseline revision changed"
  [[ "$original_container_id" == "$coordinated_frontend_baseline_container_id" ]] \
    || blocked "coordinated frontend baseline container changed"
  [[ "$original_image_id" == "$coordinated_frontend_baseline_image_id" ]] \
    || blocked "coordinated frontend baseline image changed"
  [[ "$original_network_ip" == "$coordinated_frontend_baseline_ipv4" ]] \
    || blocked "coordinated frontend baseline fixed address changed"
  [[ "$(environment_sha256_for_container "$live_container")" == "$coordinated_frontend_baseline_environment_sha256" ]] \
    || blocked "coordinated frontend baseline environment changed"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$live_container")" == "0" ]] \
    || blocked "coordinated frontend baseline has restarted"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$live_container")" == "unless-stopped" ]] \
    || blocked "coordinated frontend baseline restart policy changed"
  [[ "$(docker inspect --format '{{len .Mounts}}' "$live_container")" == "0" ]] \
    || blocked "coordinated frontend baseline mount contract changed"

  [[ "$backend_id_before" == "$coordinated_backend_container_id" ]] \
    || blocked "coordinated backend container changed"
  [[ "$backend_image_before" == "$coordinated_backend_image_id" ]] \
    || blocked "coordinated backend image changed"
  [[ "$(image_revision_for_container "$backend_container")" == "$coordinated_backend_revision" ]] \
    || blocked "coordinated backend revision changed"
  [[ "$(environment_sha256_for_container "$backend_container")" == "$coordinated_backend_environment_sha256" ]] \
    || blocked "coordinated backend environment changed"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$backend_container")" == "0" ]] \
    || blocked "coordinated backend has restarted"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$backend_container")" == "unless-stopped" ]] \
    || blocked "coordinated backend restart policy changed"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$backend_container")" == "$production_network" ]] \
    || blocked "coordinated backend network changed"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$backend_container")" == \
      '{"8000/tcp":[{"HostIp":"127.0.0.1","HostPort":"8001"}]}' ]] \
    || blocked "coordinated backend port contract changed"
  docker inspect --format '{{json .Mounts}}' "$backend_container" | python3 -c '
import json
import sys

mounts = {
    (item.get("Type"), item.get("Source"), item.get("Destination"), item.get("RW"))
    for item in json.load(sys.stdin)
}
expected = {
    ("bind", "/tmp", "/host-tmp", True),
    ("bind", "/home/muthu/mfms_data/production/motor-screenshot-analysis", "/var/lib/mfms/motor-screenshot-analysis", True),
}
raise SystemExit(0 if mounts == expected else 1)
' || blocked "coordinated backend mount contract changed"

  validate_coordinated_backup
  snapshot_coordinated_database_state "$coordinated_database_before"
  verify_authenticated_irrigation_endpoint_evidence
  snapshot_coordinated_database_state "$coordinated_database_after_read"
  cmp -s "$coordinated_database_before" "$coordinated_database_after_read" \
    || blocked "coordinated read-only endpoint preflight changed the Production database"
}

assert_coordinated_release_state_unchanged() {
  [[ "$(docker inspect --format '{{.Id}}' "$backend_container")" == "$coordinated_backend_container_id" ]] \
    || blocked "coordinated frontend deployment replaced the backend"
  [[ "$(docker inspect --format '{{.Image}}' "$backend_container")" == "$coordinated_backend_image_id" ]] \
    || blocked "coordinated frontend deployment changed the backend image"
  [[ "$(environment_sha256_for_container "$backend_container")" == "$coordinated_backend_environment_sha256" ]] \
    || blocked "coordinated frontend deployment changed backend credentials or environment"
  [[ "$(network_ip_for_container "$backend_container")" == "172.19.0.2" ]] \
    || blocked "coordinated frontend deployment changed the backend fixed address"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$backend_container")" == "0" ]] \
    || blocked "coordinated frontend deployment restarted the backend"
  validate_coordinated_backup
  snapshot_coordinated_database_state "$coordinated_database_after_deploy"
  cmp -s "$coordinated_database_before" "$coordinated_database_after_deploy" \
    || blocked "coordinated frontend deployment changed the Production database"
}

validate_release_manifest() {
  local manifest="$source_dir/deploy/production-release-manifest.json"
  local actual_paths="$work_dir/actual-paths.txt"
  local preview_contract="$work_dir/preview-contract.txt"
  local preview_path
  local -a preview_contract_lines
  [[ -f "$manifest" ]] || blocked "Production release manifest is missing"
  git -C "$source_dir" diff --name-only "$original_revision..$candidate_revision" \
    | LC_ALL=C sort -u > "$actual_paths"
  [[ -s "$actual_paths" ]] || blocked "candidate contains no changes from live Production"
  python3 - "$manifest" "$actual_paths" "$original_revision" "$candidate_revision" "$candidate_tree" \
    > "$preview_contract" <<'PY_RELEASE_MANIFEST'
import json
import pathlib
import re
import sys

manifest_path, actual_path, current, candidate, candidate_tree = sys.argv[1:]
data = json.loads(pathlib.Path(manifest_path).read_text(encoding="utf-8"))

frontend_only_invariants = {
    "preview": "unchanged",
    "test": "unchanged",
    "backend": "unchanged",
    "database": "unchanged",
    "odk": "unchanged",
    "schedules": "unchanged",
    "proxy_configuration": "unchanged",
}
coordinated_invariants = {
    "preview": "unchanged",
    "test": "unchanged",
    "backend": "deployed-first-from-isolated-irrigation-candidate",
    "database": "additive-production-irrigation-migrations-only",
    "odk": "unchanged",
    "schedules": "unchanged",
    "proxy_configuration": "unchanged",
}
approved_coordinated_candidate = "9a577add2308b85637fcf05ee49b6274e19cc2dc"
approved_coordinated_tree = "e102fe82bdb6b009012933684c6db3d927f53a7a"

if data.get("schema_version") != 1:
    raise SystemExit("invalid manifest schema")
if data.get("environment") != "Production":
    raise SystemExit("manifest environment is not Production")
if data.get("target_url") != "https://muthufarms.com":
    raise SystemExit("manifest target URL is not Production")
if data.get("base_commit") != current:
    raise SystemExit("manifest base does not match live Production")
deployment_kind = data.get("deployment_kind")
if deployment_kind == "frontend-only":
    if data.get("protected_invariants") != frontend_only_invariants:
        raise SystemExit("frontend-only manifest protected invariants are incomplete")
elif deployment_kind == "coordinated-frontend-after-backend":
    if candidate != approved_coordinated_candidate or candidate_tree != approved_coordinated_tree:
        raise SystemExit("coordinated frontend mode is not approved for this candidate and tree")
    if data.get("protected_invariants") != coordinated_invariants:
        raise SystemExit("coordinated frontend manifest protected invariants are incomplete")
else:
    raise SystemExit("manifest deployment kind is invalid")

preview = data.get("preview_approved")
if not isinstance(preview, dict):
    raise SystemExit("Preview approval contract is missing")
preview_revision = preview.get("revision")
preview_image_id = preview.get("image_id")
feature_revision = preview.get("feature_revision")
verified_files = preview.get("verified_files")
if not isinstance(preview_revision, str) or re.fullmatch(r"[0-9a-f]{40}", preview_revision) is None:
    raise SystemExit("Preview approval revision is invalid")
if not isinstance(preview_image_id, str) or re.fullmatch(r"sha256:[0-9a-f]{64}", preview_image_id) is None:
    raise SystemExit("Preview approval image ID is invalid")
if not isinstance(feature_revision, str) or re.fullmatch(r"[0-9a-f]{40}", feature_revision) is None:
    raise SystemExit("Preview feature revision is invalid")
if not isinstance(verified_files, list) or not verified_files:
    raise SystemExit("Preview verified file list is empty")
if len(verified_files) != len(set(verified_files)):
    raise SystemExit("Preview verified file list contains duplicates")
for path in verified_files:
    if not isinstance(path, str) or not path or path.startswith("/") or ".." in path.split("/"):
        raise SystemExit("Preview verified file path is invalid")

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
    if path != "deploy/production-release-manifest.json":
        safe_source = re.fullmatch(
            r"(?:app|components|hooks|lib|public|styles|tests)/[^/].*|"
            r"(?:components\.json|eslint\.config\.mjs|next\.config\.mjs|"
            r"package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|"
            r"postcss\.config\.mjs|tsconfig\.json)",
            path,
        )
        if safe_source is None:
            raise SystemExit(f"path is outside the approved Production frontend source scope: {path}")

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

if not set(verified_files).issubset(set(actual)):
    raise SystemExit("Preview verified files must be changed by the Production candidate")

print(preview_revision)
print(preview_image_id)
print(feature_revision)
for path in verified_files:
    print(path)
PY_RELEASE_MANIFEST

  mapfile -t preview_contract_lines < "$preview_contract"
  [[ "${#preview_contract_lines[@]}" -ge 4 ]] \
    || blocked "Preview approval contract is incomplete"
  preview_approved_revision=${preview_contract_lines[0]}
  preview_approved_image_id=${preview_contract_lines[1]}
  preview_feature_revision=${preview_contract_lines[2]}
  preview_verified_file_count=$((${#preview_contract_lines[@]} - 3))

  container_exists "$preview_container" || blocked "Preview frontend container is missing"
  container_running "$preview_container" || blocked "Preview frontend container is not running"
  [[ "$(docker inspect --format '{{.Image}}' "$preview_container")" == "$preview_approved_image_id" ]] \
    || blocked "live Preview image differs from the approved artifact"
  [[ "$(image_revision_for_container "$preview_container")" == "$preview_approved_revision" ]] \
    || blocked "live Preview revision differs from the approved artifact"

  git -C "$source_dir" fetch --no-tags origin \
    "$preview_approved_revision" "$preview_feature_revision" >/dev/null 2>&1
  git -C "$source_dir" merge-base --is-ancestor \
    "$preview_feature_revision" "$preview_approved_revision" \
    || blocked "Preview approval does not contain the verified feature revision"
  for preview_path in "${preview_contract_lines[@]:3}"; do
    git -C "$source_dir" cat-file -e "$preview_approved_revision:$preview_path" \
      || blocked "Preview-approved file is unavailable: $preview_path"
    cmp "$source_dir/$preview_path" \
      <(git -C "$source_dir" show "$preview_approved_revision:$preview_path") \
      || blocked "Production source differs from Preview-approved file: $preview_path"
  done
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

prepare_production_candidate() {
  local remote_release
  remote_release=$(git ls-remote "$repo_url" "$release_ref" | awk 'NR == 1 {print $1}')
  [[ "$remote_release" == "$candidate_revision" ]] \
    || blocked "candidate is not the exact production-release head"

  validate_common_live_state
  assert_candidate_port_available
  git clone --filter=blob:none --no-checkout "$repo_url" "$source_dir" >/dev/null 2>&1
  git -C "$source_dir" fetch --no-tags origin "+$release_ref:refs/remotes/origin/production-release" >/dev/null 2>&1
  [[ "$(git -C "$source_dir" rev-parse refs/remotes/origin/production-release)" == "$candidate_revision" ]] \
    || blocked "cloned production-release head differs from approval"
  git -C "$source_dir" checkout --detach "$candidate_revision" >/dev/null 2>&1
  git -C "$source_dir" merge-base --is-ancestor "$original_revision" "$candidate_revision" \
    || blocked "candidate does not contain the live Production baseline"
  [[ -z "$(git -C "$source_dir" status --short)" ]] || blocked "candidate checkout is not clean"
  candidate_tree=$(git -C "$source_dir" rev-parse "$candidate_revision^{tree}")
  validate_release_manifest
  if [[ "$candidate_revision" == "$coordinated_candidate_revision" ]]; then
    validate_exact_coordinated_release_state
  fi
}

preflight_production() {
  [[ "$candidate_revision" == "$coordinated_candidate_revision" ]] \
    || blocked "the coordinated frontend preflight is approved only for the exact irrigation candidate"
  prepare_production_candidate
  echo "preflight_environment=Production"
  echo "preflight_component=frontend"
  echo "preflight_deployment_kind=coordinated-frontend-after-backend"
  echo "preflight_candidate_revision=$candidate_revision"
  echo "preflight_candidate_tree=$candidate_tree"
  echo "preflight_current_frontend_revision=$original_revision"
  echo "preflight_current_frontend_container=$original_container_id"
  echo "preflight_current_frontend_image=$original_image_id"
  echo "preflight_backend_revision=$coordinated_backend_revision"
  echo "preflight_backend_container=$backend_id_before"
  echo "preflight_backend_image=$backend_image_before"
  echo "preflight_backup_path=$coordinated_backup_path"
  echo "preflight_backup_bytes=$coordinated_backup_bytes"
  echo "preflight_backup_sha256=$coordinated_backup_sha256"
  echo "preflight_authenticated_irrigation_operations=4"
  echo "preflight_database_evidence_sha256=$(sha256sum "$coordinated_database_before" | awk '{print $1}')"
  echo "database_writes=none"
  echo "backend_replacement=none"
  echo "traffic_switch=not-performed"
  echo "PRODUCTION_FRONTEND_PREFLIGHT=PASS"
}

deploy_production() {
  local new_image new_image_id
  prepare_production_candidate

  new_image="mfms-dashboard:production-github-${candidate_revision:0:7}-$timestamp"
  docker build \
    --pull=false \
    --file "$source_dir/Dockerfile.preview" \
    --build-arg "MFMS_GIT_COMMIT=$candidate_revision" \
    --build-arg "MFMS_BUILD_TIMESTAMP=$timestamp" \
    --build-arg "MFMS_BUILD_ENVIRONMENT=Production" \
    --tag "$new_image" \
    "$source_dir" >/dev/null
  new_image_id=$(docker image inspect --format '{{.Id}}' "$new_image")
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$new_image")" == "$candidate_revision" ]] \
    || blocked "built image revision label is invalid"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$new_image")" == "Production" ]] \
    || blocked "built image is not labelled Production"

  write_environment_file "$live_container" "$candidate_revision" "$timestamp"
  start_candidate "$new_image" "$candidate_revision"
  remove_candidate

  transaction_backup="$live_container-pre-github-$run_id-$timestamp"
  transaction_active=1
  docker stop --time 30 "$live_container" >/dev/null
  disconnect_production_network "$live_container"
  docker rename "$live_container" "$transaction_backup"
  docker run -d \
    --name "$live_container" \
    --network "$production_network" \
    --ip "$original_network_ip" \
    --restart unless-stopped \
    -p "127.0.0.1:$live_port:3000" \
    --env-file "$environment_file" \
    "$new_image" >/dev/null

  announce_production_network_identity \
    || blocked "replacement could not announce the Production network identity"

  wait_for_version "http://127.0.0.1:$live_port" "$candidate_revision" \
    || blocked "replacement /api/version failed"
  smoke_routes "http://127.0.0.1:$live_port" || blocked "replacement local smoke test failed"
  wait_for_public_production_guard || blocked "public Production authentication guard failed"
  assert_live_contract "$candidate_revision" "$new_image_id" "$before_unrelated"
  if [[ "$candidate_revision" == "$coordinated_candidate_revision" ]]; then
    assert_coordinated_release_state_unchanged
  fi

  trap '' HUP INT TERM
  write_state \
    "$candidate_revision" "$new_image_id" "$new_image" \
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "deployment_environment=Production"
  echo "deployment_url=$production_url"
  echo "public_production_guard=$public_guard_result"
  echo "previous_revision=$original_revision"
  echo "deployed_revision=$candidate_revision"
  echo "deployed_image=$new_image"
  echo "deployed_image_id=$new_image_id"
  echo "preview_approved_revision=$preview_approved_revision"
  echo "preview_approved_image_id=$preview_approved_image_id"
  echo "preview_feature_revision=$preview_feature_revision"
  echo "preview_verified_file_count=$preview_verified_file_count"
  echo "production_source_matches_preview=true"
  if [[ "$candidate_revision" == "$coordinated_candidate_revision" ]]; then
    echo "deployment_kind=coordinated-frontend-after-backend"
    echo "coordinated_backend_verified=true"
    echo "coordinated_backup_verified=true"
    echo "coordinated_migrations_verified=true"
    echo "coordinated_endpoints_verified=true"
  fi
  echo "rollback_container=$transaction_backup"
  if [[ "$worker_secret_loaded" -eq 1 ]]; then
    echo "worker_actor_assertion=server-local"
  fi
  echo "backend_unchanged=true"
  echo "database_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "preview_touched=0"
  echo "test_touched=0"
  echo "production_frontend_touched=1"
  echo "PRODUCTION_DEPLOYMENT=PASS"
}

rollback_production() {
  local deployed_revision deployed_image_id deployed_image_tag
  local rollback_container rollback_revision rollback_image_id rollback_image_tag
  local replacement_id rollback_reported_revision rollback_revision_for_match
  [[ -f "$state_file" ]] || blocked "no successful GitHub Production deployment is recorded"
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
  [[ "$rollback_container" =~ ^mfms-v0-preview-web-pre-(github|rollback)-[0-9]+-[0-9]{8}T[0-9]{6}Z$ ]] \
    || blocked "rollback container name is invalid"
  [[ "$deployed_revision" == "$expected_current_revision" && "$original_revision" == "$deployed_revision" ]] \
    || blocked "current Production does not match the recorded rollback state"
  [[ "$original_image_id" == "$deployed_image_id" ]] \
    || blocked "current Production image does not match the recorded rollback state"
  container_exists "$rollback_container" || blocked "recorded rollback container is missing"
  ! container_running "$rollback_container" || blocked "recorded rollback container is unexpectedly running"
  [[ "$(docker inspect --format '{{.Image}}' "$rollback_container")" == "$rollback_image_id" ]] \
    || blocked "rollback container image ID changed"
  rollback_reported_revision=$(image_revision_for_container "$rollback_container")
  rollback_revision_for_match=$rollback_reported_revision
  if [[ "$rollback_revision_for_match" =~ ^([0-9a-f]{7,39})-project22$ ]]; then
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
  disconnect_production_network "$live_container"
  docker rename "$live_container" "$transaction_backup"
  docker rename "$rollback_container" "$live_container"
  ensure_production_network_ip "$live_container" "$original_network_ip" \
    || blocked "rollback replacement could not preserve the Production network address"
  docker start "$live_container" >/dev/null
  announce_production_network_identity \
    || blocked "rollback replacement could not announce the Production network identity"
  replacement_id=$(docker inspect --format '{{.Image}}' "$live_container")

  wait_for_version "http://127.0.0.1:$live_port" "$rollback_reported_revision" \
    || blocked "rollback replacement /api/version failed"
  smoke_routes "http://127.0.0.1:$live_port" || blocked "rollback local smoke test failed"
  wait_for_public_production_guard || blocked "public Production rollback authentication guard failed"
  assert_live_contract "$rollback_reported_revision" "$replacement_id" "$before_unrelated"

  trap '' HUP INT TERM
  write_state \
    "$rollback_revision" "$replacement_id" "$rollback_image_tag" \
    "$transaction_backup" "$deployed_revision" "$deployed_image_id" "$deployed_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "rollback_environment=Production"
  echo "rollback_url=$production_url"
  echo "public_production_guard=$public_guard_result"
  echo "previous_revision=$deployed_revision"
  echo "restored_revision=$rollback_revision"
  echo "rollback_container_retained=$transaction_backup"
  echo "backend_unchanged=true"
  echo "database_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "preview_touched=0"
  echo "test_touched=0"
  echo "production_frontend_touched=1"
  echo "PRODUCTION_ROLLBACK=PASS"
}

case "$operation" in
  deploy)
    deploy_production
    ;;
  preflight)
    preflight_production
    ;;
  rollback)
    rollback_production
    ;;
esac
