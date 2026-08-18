#!/usr/bin/env bash
#
# Restricted server-side command for the MFMS Production API.  This file is
# installed on the server and invoked only through a dedicated forced-command
# SSH key.  It deliberately has no Production, proxy, ODK, or scheduler path.
#
set -Eeuo pipefail

umask 077

blocked() {
  echo "PRODUCTION_BACKEND_DEPLOY_BLOCKED=$1" >&2
  return 1
}

[[ $# -eq 0 ]] || blocked "arguments are not accepted"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Production SSH user is muthu"

for required_command in \
  awk basename cat chmod cmp curl date docker flock git grep id install mkdir mktemp mv \
  python3 rm sed seq sha256sum sleep sort ss tr wc
do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

readonly backend_repository="ayemuthu1963-beep/muthu-harvest-dashboard"
readonly backend_repo_dir="/home/muthu/muthu-harvest-dashboard-production-release"
readonly backend_release_ref="refs/heads/production-release"
readonly backend_live_container="harvest-api"
readonly frontend_container="mfms-v0-preview-web"
readonly proxy_container="central-nginx-1"
readonly production_network="harvest-net"
readonly approved_production_ipv4="172.19.0.2"
readonly approved_production_subnet="172.19.0.0/16"
readonly approved_production_gateway="172.19.0.1"
readonly approved_production_dynamic_pool="172.19.128.0/17"
readonly production_url="https://muthufarms.com"
readonly database_name="mfms_server_prod"
readonly live_port="8001"
readonly candidate_port="8002"
readonly state_dir="/home/muthu/.local/state/mfms-production-github"
readonly state_file="$state_dir/last-successful-backend-switch"
readonly lock_file="$state_dir/deployment.lock"
readonly worker_secret_file="$state_dir/worker-management-signing.env"
readonly database_backup_dir="$state_dir/database-backups"
readonly database_backup_credential_file="/etc/mfms-production/backup/mfms_backup.env"
readonly database_backup_role="mfms_backup"
readonly database_backup_postgres_major="16"
readonly database_backup_restore_readiness_timeout_seconds="120"
readonly database_backup_restore_stability_probes="3"
readonly database_backup_restore_stability_interval_seconds="2"
readonly database_backup_baseline_migration="db/migrations/20260814_operator_settings_v2.sql"
readonly database_backup_baseline_migration_sha256="bdd4d1e4dcf067a73b84880b19a4dc6d3241aa9b557c0a303f40dfd725ab6846"
readonly database_url_override_file="/home/muthu/mfms_secrets/database-roles/prod-app.database_url"
readonly approved_restart_policy="unless-stopped"
readonly approved_production_well_odk_cutoff="2026-07-21T06:06:53+05:30"
readonly approved_temp_mount_source="/tmp"
readonly approved_temp_mount_target="/host-tmp"
readonly approved_storage_mount_source="/home/muthu/mfms_data/production/motor-screenshot-analysis"
readonly approved_storage_mount_target="/var/lib/mfms/motor-screenshot-analysis"
readonly expected_mount_contract="bind|$approved_storage_mount_source|$approved_storage_mount_target|true
bind|$approved_temp_mount_source|$approved_temp_mount_target|true"
readonly expected_port_bindings='{"8000/tcp":[{"HostIp":"127.0.0.1","HostPort":"8001"}]}'
readonly approved_rollback_current_revision="94b28f17702e409e13d25e288fc5cd4b9bbef545"
readonly approved_rollback_current_container_id="969d9cab57c47c06716b3e94d858f3a56cd145a39280ca41c417b497647fef47"
readonly approved_rollback_current_image_id="sha256:55b070597e6ee195f50226e7a0e4834a2e64986b20c5d53fa758ee925f45f512"
readonly approved_rollback_current_environment_sha256="90213d0772f3fa45c40987748bc4b1815cdb55fb24e701ecd4a2bcc941e81e12"
readonly approved_rollback_target_revision="515638139232c76992a7c7ceaadd8e191e444176"
readonly approved_rollback_target_container="harvest-api-pre-github-2026081802-20260818T050946Z"
readonly approved_rollback_target_container_id="38aaed2a9555f4f51df06efab59972886c58225ed0d88035e4b075243b289e1c"
readonly approved_rollback_target_image_id="sha256:fbe824766b16ebdc2e85f6ed814c4b10bc7f9b4bc0a285945c07e544861b1fe8"
readonly approved_rollback_target_environment_sha256="15da2029147713e2795ddc3d746cc57eed46cd9d090af189f864390d3a56dff9"
readonly approved_rollback_state_sha256="112fc3e7b302ec5636cd237b0dcd0f70b9f85d97f162dcaa2f1795fc52d6b6c2"
readonly approved_irrigation_settings_migration="db/migrations/20260818_production_irrigation_plan_settings.sql"
readonly approved_irrigation_settings_sha256="87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1"
readonly approved_irrigation_audit_migration="db/migrations/20260818_production_irrigation_plan_persistence_v2.sql"
readonly approved_irrigation_audit_sha256="5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9"

[[ "$production_url" == "https://muthufarms.com" ]] \
  || blocked "the public target is not Production"

install -d -m 700 "$state_dir"
exec 9>"$lock_file"
flock -n 9 || blocked "another Production deployment or rollback is already running"

operation=""
candidate_revision=""
expected_current_revision=""
run_id=""
readonly deploy_command_pattern='^deploy-production-backend ([0-9a-f]{40}) ([0-9]+)$'
readonly rollback_command_pattern='^rollback-production-backend ([0-9a-f]{40}) ([0-9]+)$'
readonly rollback_dry_run_command_pattern='^dry-run-production-backend-rollback ([0-9a-f]{40}) ([0-9]+)$'
readonly credential_cutover_command_pattern='^cutover-production-database-role ([0-9a-f]{40}) ([0-9]+)$'

original_command=${SSH_ORIGINAL_COMMAND:-}
if [[ "$original_command" =~ $deploy_command_pattern ]]; then
  operation="deploy"
  candidate_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
elif [[ "$original_command" =~ $rollback_command_pattern ]]; then
  operation="rollback"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
elif [[ "$original_command" =~ $rollback_dry_run_command_pattern ]]; then
  operation="rollback-dry-run"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
elif [[ "$original_command" =~ $credential_cutover_command_pattern ]]; then
  operation="credential-cutover"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
else
  blocked "the SSH key accepts only an exact Production backend deploy, rollback, rollback dry run, or database-role cutover command"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
work_dir=$(mktemp -d "$state_dir/backend-work.XXXXXX")
source_dir="$work_dir/source"
environment_file="$work_dir/backend.env"
migration_plan="$work_dir/migrations.plan"
openapi_plan="$work_dir/openapi.plan"
before_unrelated="$work_dir/unrelated.before"
after_unrelated="$work_dir/unrelated.after"
: > "$migration_plan"
: > "$openapi_plan"

candidate_container=""
transaction_backup=""
replacement_origin=""
original_container_id=""
original_image_id=""
original_image_tag=""
original_network_ip=""
original_revision=""
frontend_id_before=""
frontend_image_before=""
proxy_digest_before=""
proxy_target_count_before=""
cron_digest_before=""
database_backup_file=""
database_backup_sha256=""
database_backup_bytes=""
database_backup_temporary=""
database_backup_restore_container=""
database_backup_restore_volume=""
database_backup_restore_postgres_major=""
database_backup_verified="false"
database_backup_restore_verified="false"
transaction_active=0
automatic_restore_result="not-required"
rollback_database_before="$work_dir/rollback-database.before.json"
rollback_database_after="$work_dir/rollback-database.after.json"

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1")" == "true" ]]
}

network_ip_for_container() {
  docker inspect \
    --format "{{with index .NetworkSettings.Networks \"$production_network\"}}{{.IPAddress}}{{end}}" \
    "$1"
}

mount_contract_for_container() {
  local container=$1
  docker inspect \
    --format '{{json .Mounts}}' \
    "$container" \
    | python3 -c 'import json,sys; mounts=json.load(sys.stdin); print("\n".join(sorted("{}|{}|{}|{}".format(item["Type"], item["Source"], item["Destination"], str(item["RW"]).lower()) for item in mounts)))'
}

environment_sha256_for_container() {
  local container=$1
  docker inspect --format '{{json .Config.Env}}' "$container" \
    | python3 -c 'import hashlib,json,sys; values=sorted(json.load(sys.stdin) or []); print(hashlib.sha256(("\n".join(values)+"\n").encode()).hexdigest())'
}

assert_approved_mount_contract() {
  local container=$1 contract
  contract=$(mount_contract_for_container "$container")
  [[ "$contract" == "$expected_mount_contract" ]] \
    || blocked "Production backend mount contract differs from the approved persistent storage and /tmp bind mounts"
}

disconnect_production_network() {
  local container=$1
  if [[ -n "$(network_ip_for_container "$container")" ]]; then
    docker network disconnect "$production_network" "$container"
  fi
}

ensure_production_network_ip() {
  local container=$1 expected_ip=$2 current_ip attempt
  for attempt in $(seq 1 30); do
    current_ip=$(network_ip_for_container "$container")
    if [[ -n "$current_ip" && "$current_ip" != "$expected_ip" ]]; then
      docker network disconnect "$production_network" "$container" >/dev/null 2>&1 || true
      current_ip=""
    fi
    if [[ -z "$current_ip" ]]; then
      docker network connect --ip "$expected_ip" "$production_network" "$container" \
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

ensure_production_network_attachment() {
  local container=$1 current_ip attempt
  for attempt in $(seq 1 30); do
    current_ip=$(network_ip_for_container "$container")
    [[ -n "$current_ip" ]] && return 0
    docker network connect "$production_network" "$container" >/dev/null 2>&1 || true
    current_ip=$(network_ip_for_container "$container")
    [[ -n "$current_ip" ]] && return 0
    sleep 1
  done
  return 1
}

assert_production_ipam_contract() {
  local network_subnet network_gateway network_dynamic_pool
  network_subnet=$(docker network inspect \
    --format '{{(index .IPAM.Config 0).Subnet}}' "$production_network")
  network_gateway=$(docker network inspect \
    --format '{{(index .IPAM.Config 0).Gateway}}' "$production_network")
  network_dynamic_pool=$(docker network inspect \
    --format '{{(index .IPAM.Config 0).IPRange}}' "$production_network")
  [[ "$network_subnet" == "$approved_production_subnet" ]] \
    || blocked "Production network subnet differs from $approved_production_subnet"
  [[ "$network_gateway" == "$approved_production_gateway" ]] \
    || blocked "Production network gateway differs from $approved_production_gateway"
  [[ "$network_dynamic_pool" == "$approved_production_dynamic_pool" ]] \
    || blocked "Production network dynamic pool differs from $approved_production_dynamic_pool"
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

database_for_container() {
  local container=$1
  docker exec "$container" python -c \
    'from urllib.parse import urlparse; from app.config import get_settings; print(urlparse(get_settings().database_url).path.lstrip("/"))'
}

assert_database_target() {
  local container=$1 reported
  reported=$(database_for_container "$container")
  [[ "$reported" == "$database_name" ]] \
    || blocked "backend database is $reported rather than $database_name"
  reported=$(docker exec "$container" python -c \
    'import psycopg; from app.config import get_settings; c=psycopg.connect(get_settings().database_url); print(c.execute("select current_database()").fetchone()[0])')
  [[ "$reported" == "$database_name" ]] \
    || blocked "database connection resolved to $reported rather than $database_name"
}

snapshot_unrelated_containers() {
  local id name
  docker ps -aq | while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    name=$(docker inspect --format '{{.Name}}' "$id")
    name=${name#/}
    case "$name" in
      "$backend_live_container"|"$backend_live_container"-candidate-*|"$backend_live_container"-pre-*)
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
    "grep -R -F 'server mfms-v0-preview-web:3000;' /etc/nginx/conf.d 2>/dev/null | wc -l" \
    | tr -d '[:space:]'
}

assert_candidate_port_available() {
  local listeners
  listeners=$(ss -H -ltn "sport = :$candidate_port" 2>/dev/null || true)
  [[ -z "$listeners" ]] \
    || blocked "Production backend candidate port $candidate_port is already allocated"
}

wait_for_health() {
  local base_url=$1 attempt body
  for attempt in $(seq 1 60); do
    if body=$(curl -fsS --max-time 10 "$base_url/health" 2>/dev/null); then
      if python3 -c \
        'import json,sys; payload=json.load(sys.stdin); raise SystemExit(0 if payload.get("status") == "ok" else 1)' \
        <<<"$body"; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

wait_for_backend_version() {
  local base_url=$1 expected_revision=$2 attempt body
  for attempt in $(seq 1 60); do
    if body=$(curl -fsS --max-time 10 "$base_url/api/backend-version" 2>/dev/null); then
      if python3 -c \
        'import json,sys; payload=json.load(sys.stdin); raise SystemExit(0 if payload.get("git_commit") == sys.argv[1] and payload.get("environment") == "Production" else 1)' \
        "$expected_revision" <<<"$body"; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

ensure_worker_signing_secret() {
  if [[ ! -e "$worker_secret_file" ]]; then
    python3 - "$worker_secret_file" <<'PY'
import os
import pathlib
import secrets
import sys

target = pathlib.Path(sys.argv[1])
temporary = target.with_name(f".{target.name}.{secrets.token_hex(8)}.tmp")
descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
try:
    with os.fdopen(descriptor, "w", encoding="ascii", newline="\n") as handle:
        handle.write(f"MFMS_ACTOR_ASSERTION_SECRET={secrets.token_hex(32)}\n")
    os.replace(temporary, target)
finally:
    if temporary.exists():
        temporary.unlink()
PY
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
}

ensure_database_url_override() {
  python3 - "$database_url_override_file" <<'PY'
import os
import pathlib
import stat
import sys
from urllib.parse import urlsplit

path = pathlib.Path(sys.argv[1])
metadata = path.lstat()
if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
    raise SystemExit("Production database URL override must be a regular mode-0600 file")
if metadata.st_uid != os.getuid():
    raise SystemExit("Production database URL override has the wrong owner")
lines = path.read_text(encoding="ascii").splitlines()
if len(lines) != 1 or not lines[0].startswith("DATABASE_URL="):
    raise SystemExit("Production database URL override has invalid structure")
value = lines[0].split("=", 1)[1]
parsed = urlsplit(value.replace("postgresql+psycopg://", "postgresql://", 1))
if (
    parsed.scheme != "postgresql"
    or parsed.username != "mfms_prod_app"
    or not parsed.password
    or parsed.hostname != "harvest-db"
    or parsed.port != 5432
    or parsed.path != "/mfms_server_prod"
    or parsed.query
    or parsed.fragment
):
    raise SystemExit("Production database URL override does not match the approved isolated target")
PY
}

write_environment_file() {
  local source_container=$1 target_revision=${2:-} worker_secret
  ensure_worker_signing_secret
  ensure_database_url_override
  worker_secret=$(awk -F= '$1 == "MFMS_ACTOR_ASSERTION_SECRET" {print $2}' "$worker_secret_file")
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$source_container" \
    | awk 'length($0) && $0 !~ /^(DATABASE_URL|MFMS_GIT_COMMIT|MFMS_BUILD_TIMESTAMP|MFMS_BUILD_ENVIRONMENT|MFMS_PRODUCTION_WELL_ODK_CUTOFF|MFMS_WORKER_MANAGEMENT_ENABLED|MFMS_ACTOR_ASSERTION_SECRET|MFMS_ACTOR_ASSERTION_MAX_AGE_SECONDS|MFMS_LOCAL_ACTOR_ENABLED|MFMS_LOCAL_ACTOR_USERNAME|MFMS_LOCAL_ACTOR_ROLE)=/' \
    > "$environment_file"
  cat "$database_url_override_file" >> "$environment_file"
  [[ -n "$(grep -E '^DATABASE_URL=' "$environment_file" || true)" ]] \
    || blocked "Production backend has no DATABASE_URL environment entry"
  if [[ -n "$target_revision" ]]; then
    printf 'MFMS_GIT_COMMIT=%s\nMFMS_BUILD_TIMESTAMP=%s\nMFMS_BUILD_ENVIRONMENT=Production\nMFMS_PRODUCTION_WELL_ODK_CUTOFF=%s\n' \
      "$target_revision" "$timestamp" "$approved_production_well_odk_cutoff" >> "$environment_file"
  fi
  printf 'MFMS_WORKER_MANAGEMENT_ENABLED=true\nMFMS_ACTOR_ASSERTION_SECRET=%s\nMFMS_ACTOR_ASSERTION_MAX_AGE_SECONDS=120\nMFMS_LOCAL_ACTOR_ENABLED=false\n' \
    "$worker_secret" >> "$environment_file"
  chmod 600 "$environment_file"
}

read_state_value() {
  local key=$1 value
  value=$(awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}' "$state_file")
  [[ $(grep -Ec "^${key}=" "$state_file") -eq 1 ]] \
    || blocked "backend rollback state key is invalid: $key"
  printf '%s\n' "$value"
}

live_revision() {
  local revision
  if [[ -f "$state_file" ]]; then
    revision=$(read_state_value deployed_revision)
  else
    revision=$(image_revision_for_container "$backend_live_container")
  fi
  [[ "$revision" =~ ^[0-9a-f]{40}$ ]] \
    || blocked "live backend revision is unavailable; bootstrap the backend release state first"
  printf '%s\n' "$revision"
}

validate_common_live_state() {
  assert_production_ipam_contract
  container_exists "$backend_live_container" || blocked "Production backend container is missing"
  container_running "$backend_live_container" || blocked "Production backend container is not running"
  container_exists "$frontend_container" || blocked "Production frontend container is missing"
  container_running "$frontend_container" || blocked "Production frontend container is not running"
  container_exists "$proxy_container" || blocked "Production proxy container is missing"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$backend_live_container")" == "$production_network" ]] \
    || blocked "Production backend is not on the Production network"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$backend_live_container")" == "$expected_port_bindings" ]] \
    || blocked "Production backend host port mapping differs from the approved $live_port mapping"
  assert_approved_mount_contract "$backend_live_container"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$backend_live_container")" == "$approved_restart_policy" ]] \
    || blocked "Production backend restart policy changed"
  [[ "$(docker ps -a --format '{{.Names}}' | grep -Ec '^harvest-api-candidate-' || true)" -eq 0 ]] \
    || blocked "a stale Production backend candidate container exists"

  original_container_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
  original_image_id=$(docker inspect --format '{{.Image}}' "$backend_live_container")
  original_image_tag=$(docker inspect --format '{{.Config.Image}}' "$backend_live_container")
  original_network_ip=$(network_ip_for_container "$backend_live_container")
  [[ "$original_network_ip" == "$approved_production_ipv4" ]] \
    || blocked "Production backend must own fixed address $approved_production_ipv4"
  original_revision=$(live_revision)
  frontend_id_before=$(docker inspect --format '{{.Id}}' "$frontend_container")
  frontend_image_before=$(docker inspect --format '{{.Image}}' "$frontend_container")
  proxy_digest_before=$(proxy_digest)
  proxy_target_count_before=$(proxy_target_count)
  cron_digest_before=$(cron_digest)
  [[ "$proxy_target_count_before" =~ ^[1-9][0-9]*$ ]] \
    || blocked "Production proxy has no approved frontend target"
  assert_database_target "$backend_live_container"
  snapshot_unrelated_containers > "$before_unrelated"
}

assert_exact_historical_application_rollback() {
  local rollback_container rollback_revision rollback_image_id state_migrations
  [[ "$expected_current_revision" == "$approved_rollback_current_revision" ]] \
    || blocked "rollback is not for the exact approved current Production revision"
  [[ "$original_revision" == "$approved_rollback_current_revision" ]] \
    || blocked "live Production revision is not the approved rollback source"
  [[ "$original_container_id" == "$approved_rollback_current_container_id" ]] \
    || blocked "live Production container is not the approved rollback source"
  [[ "$original_image_id" == "$approved_rollback_current_image_id" ]] \
    || blocked "live Production image is not the approved rollback source"
  [[ "$(environment_sha256_for_container "$backend_live_container")" == "$approved_rollback_current_environment_sha256" ]] \
    || blocked "live Production backend environment differs from the approved rollback source"
  [[ "$(sha256sum "$state_file" | awk '{print $1}')" == "$approved_rollback_state_sha256" ]] \
    || blocked "Production backend rollback state differs from the approved release record"

  rollback_container=$(read_state_value rollback_container)
  rollback_revision=$(read_state_value rollback_revision)
  rollback_image_id=$(read_state_value rollback_image_id)
  state_migrations=$(read_state_value database_migrations)
  [[ "$rollback_container" == "$approved_rollback_target_container" ]] \
    || blocked "recorded rollback container is not the approved historical target"
  [[ "$rollback_revision" == "$approved_rollback_target_revision" ]] \
    || blocked "recorded rollback revision is not the approved historical target"
  [[ "$rollback_image_id" == "$approved_rollback_target_image_id" ]] \
    || blocked "recorded rollback image is not the approved historical target"
  [[ "$state_migrations" == "forward-only" ]] \
    || blocked "forward-only migration state is not retained"
  container_exists "$rollback_container" || blocked "approved historical rollback container is missing"
  ! container_running "$rollback_container" || blocked "approved historical rollback container is unexpectedly running"
  [[ "$(docker inspect --format '{{.Id}}' "$rollback_container")" == "$approved_rollback_target_container_id" ]] \
    || blocked "approved historical rollback container identity changed"
  [[ "$(docker inspect --format '{{.Image}}' "$rollback_container")" == "$approved_rollback_target_image_id" ]] \
    || blocked "approved historical rollback image changed"
  [[ "$(image_revision_for_container "$rollback_container")" == "$approved_rollback_target_revision" ]] \
    || blocked "approved historical rollback revision changed"
  [[ "$(image_environment_for_container "$rollback_container")" == "Production" ]] \
    || blocked "approved historical rollback image is not labelled Production"
  [[ "$(environment_sha256_for_container "$rollback_container")" == "$approved_rollback_target_environment_sha256" ]] \
    || blocked "approved historical rollback environment changed"
  [[ "$(docker inspect --format '{{.RestartCount}}' "$rollback_container")" == "0" ]] \
    || blocked "approved historical rollback container has restarted"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$rollback_container")" == "$production_network" ]] \
    || blocked "approved historical rollback network mode changed"
  [[ -z "$(network_ip_for_container "$rollback_container")" ]] \
    || blocked "approved historical rollback container is unexpectedly attached to Production"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$rollback_container")" == "$expected_port_bindings" ]] \
    || blocked "approved historical rollback port contract changed"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$rollback_container")" == "$approved_restart_policy" ]] \
    || blocked "approved historical rollback restart policy changed"
  assert_approved_mount_contract "$rollback_container"
  wait_for_health "http://127.0.0.1:$live_port" \
    || blocked "current Production backend is not healthy enough for the approved rollback"
}

snapshot_rollback_database_evidence() {
  local container=$1 output=$2
  docker exec -i "$container" python - > "$output" <<'PY_ROLLBACK_DATABASE_EVIDENCE'
import hashlib
import json
import os

import psycopg
from psycopg.rows import dict_row


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
        trigger = cursor.fetchall()
finally:
    connection.rollback()
    connection.close()

print(json.dumps({
    "database": database,
    "ledger_count": len(ledger),
    "ledger_sha256": digest(ledger),
    "irrigation_ledger": [
        {"migration_name": row.get("migration_name"), "sha256": row.get("sha256")}
        for row in ledger
        if row.get("migration_name") in {
            "db/migrations/20260818_production_irrigation_plan_settings.sql",
            "db/migrations/20260818_production_irrigation_plan_persistence_v2.sql",
        }
    ],
    "settings_count": len(settings),
    "settings_sha256": digest(settings),
    "audit_count": len(audit),
    "audit_sha256": digest(audit),
    "trigger_count": len(trigger),
    "trigger_sha256": digest(trigger),
}, separators=(",", ":"), sort_keys=True))
PY_ROLLBACK_DATABASE_EVIDENCE
  [[ -s "$output" ]] || blocked "rollback database evidence is empty"
  python3 - "$output" \
    "$approved_irrigation_settings_migration" "$approved_irrigation_settings_sha256" \
    "$approved_irrigation_audit_migration" "$approved_irrigation_audit_sha256" <<'PY_VALIDATE_ROLLBACK_DATABASE_EVIDENCE'
import json
import pathlib
import re
import sys

path, settings_name, settings_hash, audit_name, audit_hash = sys.argv[1:]
evidence = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
if evidence.get("database") != "mfms_server_prod":
    raise SystemExit("rollback database evidence resolved to the wrong database")
for key in ("ledger_count", "settings_count", "audit_count", "trigger_count"):
    value = evidence.get(key)
    if not isinstance(value, int) or value < 0:
        raise SystemExit(f"rollback database evidence has an invalid {key}")
for key in ("ledger_sha256", "settings_sha256", "audit_sha256", "trigger_sha256"):
    if not re.fullmatch(r"[0-9a-f]{64}", str(evidence.get(key, ""))):
        raise SystemExit(f"rollback database evidence has an invalid {key}")
if evidence["settings_count"] != 2 or evidence["trigger_count"] != 1:
    raise SystemExit("rollback database evidence is missing the irrigation settings or protection trigger")
expected_irrigation_ledger = [
    {"migration_name": audit_name, "sha256": audit_hash},
    {"migration_name": settings_name, "sha256": settings_hash},
]
if evidence.get("irrigation_ledger") != expected_irrigation_ledger:
    raise SystemExit("rollback database evidence has an unexpected irrigation migration ledger")
PY_VALIDATE_ROLLBACK_DATABASE_EVIDENCE
}

prepare_backend_source() {
  local origin_url
  [[ -d "$backend_repo_dir/.git" || -f "$backend_repo_dir/.git" ]] \
    || blocked "authoritative Production backend checkout is missing"
  [[ "$(git -C "$backend_repo_dir" branch --show-current)" == "production-release" ]] \
    || blocked "authoritative backend checkout is not on production-release"
  [[ -z "$(git -C "$backend_repo_dir" status --short)" ]] \
    || blocked "authoritative backend checkout is not clean"
  origin_url=$(git -C "$backend_repo_dir" remote get-url origin)
  case "$origin_url" in
    "git@github.com:$backend_repository.git"|"git@github.com-mfms-production-backend:$backend_repository.git"|"https://github.com/$backend_repository.git"|"https://github.com/$backend_repository")
      ;;
    *)
      blocked "authoritative backend checkout origin is not approved"
      ;;
  esac
  git -C "$backend_repo_dir" fetch --quiet --no-tags origin \
    "+$backend_release_ref:refs/remotes/origin/production-release"
  local remote_revision
  remote_revision=$(git -C "$backend_repo_dir" rev-parse refs/remotes/origin/production-release)
  [[ "$remote_revision" == "$candidate_revision" ]] \
    || blocked "candidate is not the exact production-release head"
  git -C "$backend_repo_dir" cat-file -e "$original_revision^{commit}" \
    || blocked "live backend revision is absent from the authoritative checkout"
  git -C "$backend_repo_dir" merge-base --is-ancestor "$original_revision" "$candidate_revision" \
    || blocked "candidate does not contain the live Production backend revision"

  git clone --quiet --no-checkout "$backend_repo_dir" "$source_dir"
  git -C "$source_dir" checkout --quiet --detach "$candidate_revision"
  [[ -z "$(git -C "$source_dir" status --short)" ]] \
    || blocked "candidate backend checkout is not clean"
}

validate_release_descriptor() {
  local descriptor="$source_dir/deploy/production-backend-release.json"
  [[ -f "$descriptor" ]] || blocked "Production backend release descriptor is missing"
  python3 - "$descriptor" "$source_dir" "$original_revision" "$candidate_revision" \
    "$migration_plan" "$openapi_plan" <<'PY'
import hashlib
import json
import pathlib
import re
import sys

descriptor_path, source_text, current, candidate, migrations_output, openapi_output = sys.argv[1:]
source = pathlib.Path(source_text).resolve()
data = json.loads(pathlib.Path(descriptor_path).read_text(encoding="utf-8"))

expected_invariants = {
    "database": "production-migrations-only",
    "frontend": "unchanged",
    "odk": "unchanged",
    "schedules": "unchanged",
    "proxy_configuration": "unchanged",
    "test": "unchanged",
    "preview": "unchanged",
}
if data.get("schema_version") != 1:
    raise SystemExit("invalid backend release descriptor schema")
if data.get("environment") != "Production":
    raise SystemExit("backend release descriptor is not Production")
if data.get("target_database") != "mfms_server_prod":
    raise SystemExit("backend release descriptor is not limited to mfms_server_prod")
if data.get("repository") != "ayemuthu1963-beep/muthu-harvest-dashboard":
    raise SystemExit("backend release descriptor repository is invalid")
if data.get("release_branch") != "production-release":
    raise SystemExit("backend release descriptor branch is invalid")
if data.get("deployment_kind") != "backend-with-forward-only-migrations":
    raise SystemExit("backend release descriptor deployment kind is invalid")
if data.get("protected_invariants") != expected_invariants:
    raise SystemExit("backend release descriptor protected invariants are incomplete")

migrations = data.get("migrations")
if not isinstance(migrations, list):
    raise SystemExit("backend release descriptor migrations must be a list")
if not migrations:
    raise SystemExit("Production migration release must contain a declared migration")
safe_migration = re.compile(r"^db/migrations/[0-9][A-Za-z0-9_.-]*\.sql$")
seen = set()
plan = []
for item in migrations:
    if not isinstance(item, dict):
        raise SystemExit("backend release descriptor migration entry is invalid")
    path = item.get("path")
    checksum = item.get("sha256")
    if not isinstance(path, str) or not safe_migration.fullmatch(path) or path in seen:
        raise SystemExit(f"invalid migration path: {path!r}")
    if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
        raise SystemExit(f"invalid migration checksum for {path}")
    content = (source / path).read_bytes()
    actual = hashlib.sha256(content).hexdigest()
    if actual != checksum:
        raise SystemExit(f"migration checksum mismatch: {path}")
    seen.add(path)
    plan.append((path, checksum))

required_paths = data.get("required_openapi_paths")
if not isinstance(required_paths, list) or not required_paths:
    raise SystemExit("backend release descriptor required_openapi_paths is empty")
openapi_paths = []
for path in required_paths:
    if not isinstance(path, str) or not re.fullmatch(r"/(?:health|api(?:/[A-Za-z0-9_.{}-]+)*)", path):
        raise SystemExit(f"invalid OpenAPI path: {path!r}")
    if path not in openapi_paths:
        openapi_paths.append(path)

# The candidate may alter application code and explicitly listed migration
# files, but never deployment, environment, scheduler, proxy, or ODK plumbing.
import subprocess
changed = subprocess.check_output(
    ["git", "-C", str(source), "diff", "--name-only", f"{current}..{candidate}"], text=True
).splitlines()
allowed = re.compile(
    r"^(?:\.github/(?:CODEOWNERS|pull_request_template\.md|workflows/ci\.yml)|"
    r"README\.md|"
    r"api/(?:Dockerfile|requirements\.txt|app/(?:[^/]+\.py|routers/[^/]+\.py|"
    r"models/[^/]+\.py|repositories/[^/]+\.py|services/[^/]+\.py))|"
    r"db/migrations/[0-9][A-Za-z0-9_.-]*\.sql|"
    r"db/rollbacks/[0-9][A-Za-z0-9_.-]*\.sql|"
    r"deploy/(?:production-backend-release|release-governance)\.json|"
    r"docs/MFMS_DATABASE_RELEASE_POLICY\.md|"
    r"scripts/(?:apply_production_asset_register|apply_production_migrations|import_access_csv|"
    r"import_historical_clean_csv|import_manual_harvest_csv|odk_sync_placeholder|"
    r"sync_production_harvest_odk|sync_well_water_odk|validate_production_release|validate_release_governance)\.py|"
    r"scripts/run_production_(?:beetle|harvest|well_water)_sync\.sh|"
    r"tests/[^/]+)$"
)
release_specific_tree = "f889f6ad2c97662bd935c3fdfa1add1614836fc3"
release_specific = {
    ".env.example": {
        "candidate": "94b28f17702e409e13d25e288fc5cd4b9bbef545",
        "blob": "d4485596e32dd37aff86b4bcede1a1ec0034ade4",
        "sha256": "896a4746e01e263518d8966f8586e2bc187e473aad5a087e0e9511625b509615",
    },
    "docker-compose.yml": {
        "candidate": "94b28f17702e409e13d25e288fc5cd4b9bbef545",
        "blob": "839a5adc66376d41ef80993abedda33d10c14f25",
        "sha256": "c0165614281b7b81f33cb252907f313a25bc613a8e6bf0c3346e632d98396247",
    },
    "scripts/verify_production_deployment_contract.py": {
        "candidate": "94b28f17702e409e13d25e288fc5cd4b9bbef545",
        "blob": "cd107bbe56de0a75cd147ffcbd7952d25c0ecf03",
        "sha256": "63e9ffdcda9d3486cc5084ec1c8c9066490e2fdf905afcdb01a90e78697b1e1d",
    },
}


def release_specific_path_approved(path):
    approval = release_specific.get(path)
    if approval is None or candidate != approval["candidate"]:
        return False
    tree = subprocess.check_output(
        ["git", "-C", str(source), "rev-parse", f"{candidate}^{{tree}}"], text=True
    ).strip()
    if tree != release_specific_tree:
        return False
    blob = subprocess.check_output(
        ["git", "-C", str(source), "rev-parse", f"{candidate}:{path}"], text=True
    ).strip()
    if blob != approval["blob"]:
        return False
    content = subprocess.check_output(
        ["git", "-C", str(source), "cat-file", "blob", blob]
    )
    return hashlib.sha256(content).hexdigest() == approval["sha256"]


if not changed:
    raise SystemExit("backend candidate contains no changes from the live revision")
for path in changed:
    if allowed.fullmatch(path) or release_specific_path_approved(path):
        continue
    raise SystemExit(f"backend candidate contains an unapproved path: {path}")

pathlib.Path(migrations_output).write_text(
    "".join(f"{path}|{checksum}\n" for path, checksum in plan), encoding="utf-8"
)
pathlib.Path(openapi_output).write_text("".join(f"{path}\n" for path in openapi_paths), encoding="utf-8")
PY
}

build_image() {
  new_image="muthu-harvest-dashboard-harvest-api:production-${candidate_revision:0:7}-$timestamp"
  docker build \
    --pull=false \
    --file "$source_dir/api/Dockerfile" \
    --build-arg "MFMS_GIT_COMMIT=$candidate_revision" \
    --build-arg "MFMS_BUILD_TIMESTAMP=$timestamp" \
    --build-arg "MFMS_BUILD_ENVIRONMENT=Production" \
    --tag "$new_image" \
    "$source_dir" >/dev/null
  new_image_id=$(docker image inspect --format '{{.Id}}' "$new_image")
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$new_image")" == "$candidate_revision" ]] \
    || blocked "built backend image revision label is invalid"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$new_image")" == "Production" ]] \
    || blocked "built backend image is not labelled Production"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.source-contract"}}' "$new_image")" == "git-complete" ]] \
    || blocked "built backend image does not declare the complete Git source contract"
}

validate_database_backup_credential_state() {
  python3 - "$database_backup_credential_file" 0 "$(id -g)" 0 <<'PY_DATABASE_BACKUP_CREDENTIAL_VALIDATION'
import pathlib
import stat
import sys

path = pathlib.Path(sys.argv[1])
expected_owner_uid = int(sys.argv[2])
expected_runner_gid = int(sys.argv[3])
expected_root_gid = int(sys.argv[4])


def require_directory(target: pathlib.Path, owner_uid: int, group_gid: int, mode: int) -> None:
    metadata = target.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise SystemExit(f"Backup credential parent is not a real directory: {target}")
    if metadata.st_uid != owner_uid or metadata.st_gid != group_gid:
        raise SystemExit(f"Backup credential parent ownership is invalid: {target}")
    actual_mode = stat.S_IMODE(metadata.st_mode)
    if actual_mode != mode or actual_mode & 0o022:
        raise SystemExit(f"Backup credential parent permissions are invalid: {target}")


require_directory(path.parent.parent, expected_owner_uid, expected_root_gid, 0o755)
require_directory(path.parent, expected_owner_uid, expected_runner_gid, 0o750)

metadata = path.lstat()
if not stat.S_ISREG(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
    raise SystemExit("Production backup credential must be a regular non-symlink file")
if metadata.st_uid != expected_owner_uid:
    raise SystemExit("Production backup credential owner UID is invalid")
if metadata.st_gid != expected_runner_gid:
    raise SystemExit("Production backup credential group is not the deployment runner private group")
actual_mode = stat.S_IMODE(metadata.st_mode)
if actual_mode != 0o640 or actual_mode & 0o022:
    raise SystemExit("Production backup credential permissions must be exactly 0640 and non-writable by group/others")

lines = path.read_bytes().splitlines()
prefix = b"MFMS_BACKUP_PASSWORD="
if len(lines) != 1 or not lines[0].startswith(prefix):
    raise SystemExit("Production backup credential must contain exactly MFMS_BACKUP_PASSWORD")
value = lines[0][len(prefix):]
if not value or b"\x00" in value or b"\n" in value or b"\r" in value:
    raise SystemExit("Production backup credential value is invalid")
PY_DATABASE_BACKUP_CREDENTIAL_VALIDATION
}

read_database_backup_password() {
  validate_database_backup_credential_state
  python3 - "$database_backup_credential_file" <<'PY_DATABASE_BACKUP_PASSWORD_READ'
import pathlib
import sys

line = pathlib.Path(sys.argv[1]).read_bytes().splitlines()[0]
sys.stdout.buffer.write(line.split(b"=", 1)[1])
PY_DATABASE_BACKUP_PASSWORD_READ
}

run_database_backup_psql() {
  local database_container=$1 sql=$2 backup_password status
  backup_password=$(read_database_backup_password)
  if printf '%s\n' "$backup_password" | docker exec -i "$database_container" sh -c '
    IFS= read -r PGPASSWORD
    [ -n "$PGPASSWORD" ] || exit 81
    export PGPASSWORD
    exec psql \
      --host=127.0.0.1 \
      --port=5432 \
      --username="$1" \
      --dbname="$2" \
      --no-password \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="$3"
  ' sh "$database_backup_role" "$database_name" "$sql"; then
    status=0
  else
    status=$?
  fi
  unset backup_password
  return "$status"
}

validate_database_backup_access_report() {
  local report_file=$1
  python3 - "$report_file" "$database_name" "$database_backup_role" "$database_backup_postgres_major" <<'PY_DATABASE_BACKUP_ACCESS_VALIDATION'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
expected_database = sys.argv[2]
expected_role = sys.argv[3]
expected_major = int(sys.argv[4])
payload = json.loads(path.read_text(encoding="utf-8"))

expected_keys = {
    "database",
    "role",
    "role_exists",
    "role_can_login",
    "role_superuser",
    "role_createdb",
    "role_createrole",
    "role_replication",
    "role_bypassrls",
    "server_major",
    "connect_allowed",
    "missing_schema_usage",
    "missing_table_select",
    "missing_sequence_select",
    "large_objects",
    "rls_tables",
}
if set(payload) != expected_keys:
    raise SystemExit("Production backup access report has an unexpected structure")
if payload["database"] != expected_database:
    raise SystemExit("Production backup connection resolved to the wrong database")
if payload["role"] != expected_role or payload["role_exists"] is not True:
    raise SystemExit("Production backup connection resolved to the wrong role")
if payload["role_can_login"] is not True:
    raise SystemExit("Production backup role is not login-capable")
for attribute in ("role_superuser", "role_createdb", "role_createrole", "role_replication", "role_bypassrls"):
    if payload[attribute] is not False:
        raise SystemExit(f"Production backup role has an unapproved attribute: {attribute}")
if payload["server_major"] != expected_major:
    raise SystemExit("Production PostgreSQL major version is not approved")
if payload["connect_allowed"] is not True:
    raise SystemExit("Production backup role lacks CONNECT")
for counter in (
    "missing_schema_usage",
    "missing_table_select",
    "missing_sequence_select",
    "large_objects",
    "rls_tables",
):
    if payload[counter] != 0:
        raise SystemExit(f"Production backup role cannot produce a complete logical backup: {counter}")
PY_DATABASE_BACKUP_ACCESS_VALIDATION
}

verify_database_backup_access() {
  local database_container=$1 access_report="$work_dir/database-backup-access.json" sql
  sql=$(cat <<'SQL_DATABASE_BACKUP_ACCESS'
WITH backup_role AS (
    SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    FROM pg_roles
    WHERE rolname = current_user
)
SELECT json_build_object(
    'database', current_database(),
    'role', current_user,
    'role_exists', (SELECT count(*) = 1 FROM backup_role),
    'role_can_login', coalesce((SELECT rolcanlogin FROM backup_role), false),
    'role_superuser', coalesce((SELECT rolsuper FROM backup_role), false),
    'role_createdb', coalesce((SELECT rolcreatedb FROM backup_role), false),
    'role_createrole', coalesce((SELECT rolcreaterole FROM backup_role), false),
    'role_replication', coalesce((SELECT rolreplication FROM backup_role), false),
    'role_bypassrls', coalesce((SELECT rolbypassrls FROM backup_role), false),
    'server_major', current_setting('server_version_num')::integer / 10000,
    'connect_allowed', has_database_privilege(current_user, current_database(), 'CONNECT'),
    'missing_schema_usage', (
        SELECT count(*) FROM pg_namespace n
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND NOT has_schema_privilege(current_user, n.oid, 'USAGE')
    ),
    'missing_table_select', (
        SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND NOT has_table_privilege(current_user, c.oid, 'SELECT')
    ),
    'missing_sequence_select', (
        SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND c.relkind = 'S'
          AND NOT has_sequence_privilege(current_user, c.oid, 'SELECT')
    ),
    'large_objects', (SELECT count(*) FROM pg_largeobject_metadata),
    'rls_tables', (
        SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND c.relkind IN ('r', 'p') AND c.relrowsecurity
    )
)::text;
SQL_DATABASE_BACKUP_ACCESS
  )
  if ! run_database_backup_psql "$database_container" "$sql" > "$access_report"; then
    rm -f "$access_report"
    blocked "Production backup role authentication or privilege query failed"
    return 1
  fi
  [[ -s "$access_report" ]] || blocked "Production backup access report is empty"
  validate_database_backup_access_report "$access_report"
}

wait_for_stable_database_backup_restore() {
  local restore_container=$1 expected_container_id=$2
  python3 - \
    "$restore_container" \
    "$expected_container_id" \
    "$database_name" \
    "$database_backup_postgres_major" \
    "$database_backup_restore_readiness_timeout_seconds" \
    "$database_backup_restore_stability_probes" \
    "$database_backup_restore_stability_interval_seconds" \
    <<'PY_DATABASE_BACKUP_FINAL_READINESS'
import subprocess
import sys
import time


class ReadinessFailure(RuntimeError):
    pass


def run_command(args):
    return subprocess.run(args, capture_output=True, text=True, check=False)


def emit(message):
    print(message, flush=True)


def inspect_container(container, expected_id):
    result = run_command([
        "docker",
        "inspect",
        "--format",
        "{{.Id}}|{{.State.Status}}|{{.RestartCount}}",
        container,
    ])
    if result.returncode != 0:
        raise ReadinessFailure("container_inspect_failed")
    parts = result.stdout.strip().split("|")
    if len(parts) != 3:
        raise ReadinessFailure("container_state_invalid")
    identity, status, restart_text = parts
    if identity != expected_id:
        raise ReadinessFailure("container_identity_changed")
    try:
        restart_count = int(restart_text)
    except ValueError as exc:
        raise ReadinessFailure("container_restart_count_invalid") from exc
    if status != "running":
        raise ReadinessFailure(f"container_not_running_{status}")
    if restart_count != 0:
        raise ReadinessFailure("container_restarted")
    return identity


def final_postgres_process(container):
    result = run_command([
        "docker",
        "exec",
        container,
        "sh",
        "-c",
        "comm=$(cat /proc/1/comm 2>/dev/null || true); "
        "cmdline=$(xargs -0 echo </proc/1/cmdline 2>/dev/null || true); "
        "postmaster_pid=$(sed -n '1p' /var/lib/postgresql/data/postmaster.pid 2>/dev/null || true); "
        "printf '%s|%s|%s\\n' \"$comm\" \"$cmdline\" \"$postmaster_pid\"",
    ])
    if result.returncode != 0:
        return False, "exec_failed"
    parts = result.stdout.strip().split("|", 2)
    if len(parts) != 3:
        return False, "process_state_invalid"
    comm, command_line, postmaster_pid = parts
    is_final = comm == "postgres" and command_line.split(" ", 1)[0] == "postgres" and postmaster_pid == "1"
    return is_final, comm or "unknown"


def initialization_complete(container):
    result = run_command(["docker", "logs", container])
    if result.returncode != 0:
        raise ReadinessFailure("container_logs_unavailable")
    return "PostgreSQL init process complete; ready for start up." in (result.stdout + result.stderr)


def main():
    if len(sys.argv) != 8:
        raise SystemExit("restore readiness arguments are invalid")
    container, expected_id, expected_database = sys.argv[1:4]
    expected_major = int(sys.argv[4])
    timeout_seconds = int(sys.argv[5])
    required_probes = int(sys.argv[6])
    stability_interval = float(sys.argv[7])
    if timeout_seconds < 1 or required_probes < 3 or stability_interval <= 0:
        raise SystemExit("restore readiness limits are invalid")

    deadline = time.monotonic() + timeout_seconds
    last_phase = None
    target_database_created = False
    stable_probes = 0
    stable_start_time = None

    try:
        while time.monotonic() < deadline:
            inspect_container(container, expected_id)
            marker_seen = initialization_complete(container)
            is_final, pid1_name = final_postgres_process(container)

            if not marker_seen or not is_final:
                phase = f"initializing marker={str(marker_seen).lower()} pid1={pid1_name}"
                if phase != last_phase:
                    emit(f"RESTORE_READINESS_TRANSITION={phase}")
                    last_phase = phase
                time.sleep(1)
                continue

            if last_phase != "final-postgres":
                emit("RESTORE_READINESS_TRANSITION=final-postgres marker=true pid1=postgres")
                last_phase = "final-postgres"

            inspect_container(container, expected_id)
            ready = run_command([
                "docker",
                "exec",
                container,
                "pg_isready",
                "--username=postgres",
                "--dbname=postgres",
            ])
            if ready.returncode != 0:
                stable_probes = 0
                stable_start_time = None
                emit("RESTORE_READINESS_RESET=pg_isready_failed")
                time.sleep(1)
                continue

            if not target_database_created:
                created = run_command([
                    "docker",
                    "exec",
                    container,
                    "createdb",
                    "--username=postgres",
                    "--template=template0",
                    expected_database,
                ])
                if created.returncode != 0:
                    raise ReadinessFailure("restore_database_create_failed")
                target_database_created = True
                emit(f"RESTORE_READINESS_DATABASE={expected_database}")

            inspect_container(container, expected_id)
            probe = run_command([
                "docker",
                "exec",
                container,
                "psql",
                "--username=postgres",
                f"--dbname={expected_database}",
                "--no-psqlrc",
                "--tuples-only",
                "--no-align",
                "--field-separator=|",
                "--set=ON_ERROR_STOP=1",
                "--command=SELECT current_database(), current_setting('server_version_num'), pg_postmaster_start_time() IS NOT NULL, pg_postmaster_start_time();",
            ])
            if probe.returncode != 0:
                stable_probes = 0
                stable_start_time = None
                emit("RESTORE_READINESS_RESET=sql_probe_failed")
                time.sleep(stability_interval)
                continue

            values = probe.stdout.strip().split("|", 3)
            if len(values) != 4:
                stable_probes = 0
                stable_start_time = None
                emit("RESTORE_READINESS_RESET=sql_probe_invalid")
                time.sleep(stability_interval)
                continue
            actual_database, version_text, start_time_present, postmaster_start_time = values
            try:
                actual_major = int(version_text) // 10000
            except ValueError:
                actual_major = -1
            if (
                actual_database != expected_database
                or actual_major != expected_major
                or start_time_present != "t"
                or not postmaster_start_time
            ):
                raise ReadinessFailure("sql_probe_identity_mismatch")

            inspect_container(container, expected_id)
            still_final, _ = final_postgres_process(container)
            if not still_final:
                raise ReadinessFailure("final_postgres_process_changed")

            if stable_start_time != postmaster_start_time:
                if stable_start_time is not None:
                    emit("RESTORE_READINESS_RESET=postmaster_start_time_changed")
                stable_start_time = postmaster_start_time
                stable_probes = 0
            stable_probes += 1
            emit(f"RESTORE_READINESS_PROBE={stable_probes}/{required_probes}")
            if stable_probes >= required_probes:
                inspect_container(container, expected_id)
                emit(
                    "RESTORE_READINESS_STABLE="
                    f"database={expected_database} major={expected_major} probes={stable_probes} "
                    "identity=unchanged restarts=0"
                )
                return
            time.sleep(stability_interval)
        raise ReadinessFailure("stable_final_server_timeout")
    except ReadinessFailure as exc:
        emit(
            "RESTORE_READINESS_FAILURE="
            f"reason={exc} phase={last_phase or 'unknown'} probes={stable_probes}/{required_probes}"
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
PY_DATABASE_BACKUP_FINAL_READINESS
}

verify_database_backup_restore() {
  local database_container=$1 dump_file=$2 database_image restore_report restore_container_id
  database_image=$(docker inspect --format '{{.Image}}' "$database_container")
  [[ "$database_image" =~ ^sha256:[0-9a-f]{64}$ ]] \
    || blocked "Production database image identity is invalid"

  database_backup_restore_container="mfms-production-backup-restore-${run_id}-${timestamp}"
  database_backup_restore_volume="${database_backup_restore_container}-data"
  [[ -z "$(docker ps -aq --filter "name=^/${database_backup_restore_container}$")" ]] \
    || blocked "Production backup restore container name already exists"
  [[ -z "$(docker volume ls -q --filter "name=^${database_backup_restore_volume}$")" ]] \
    || blocked "Production backup restore volume name already exists"
  docker volume create \
    --label "com.muthufarms.mfms.purpose=production-backup-restore" \
    --label "com.muthufarms.mfms.run-id=$run_id" \
    "$database_backup_restore_volume" >/dev/null
  [[ "$(docker volume inspect --format '{{.Name}}' "$database_backup_restore_volume")" \
      == "$database_backup_restore_volume" ]] \
    || blocked "Production backup restore volume identity is invalid"
  [[ "$(docker volume inspect --format '{{index .Labels "com.muthufarms.mfms.purpose"}}|{{index .Labels "com.muthufarms.mfms.run-id"}}' \
      "$database_backup_restore_volume")" == "production-backup-restore|$run_id" ]] \
    || blocked "Production backup restore volume labels are invalid"
  docker run --rm \
    --network none \
    --restart no \
    --entrypoint sh \
    --mount "type=volume,source=$database_backup_restore_volume,target=/var/lib/postgresql/data,volume-nocopy" \
    "$database_image" \
    -ec 'test -z "$(find /var/lib/postgresql/data -mindepth 1 -maxdepth 1 -print -quit)"' \
    || blocked "Production backup restore volume is not empty"
  docker run -d \
    --name "$database_backup_restore_container" \
    --network none \
    --restart no \
    --shm-size 256m \
    --mount "type=volume,source=$database_backup_restore_volume,target=/var/lib/postgresql/data,volume-nocopy" \
    --env POSTGRES_HOST_AUTH_METHOD=trust \
    "$database_image" >/dev/null
  restore_container_id=$(docker inspect --format '{{.Id}}' "$database_backup_restore_container")
  [[ "$restore_container_id" =~ ^[0-9a-f]{64}$ ]] \
    || blocked "Production backup restore container identity is invalid"
  wait_for_stable_database_backup_restore \
    "$database_backup_restore_container" "$restore_container_id"
  database_backup_restore_postgres_major="$database_backup_postgres_major"
  docker exec -i "$database_backup_restore_container" \
    pg_restore --exit-on-error --no-owner --no-privileges \
      --username=postgres --dbname="$database_name" < "$dump_file"

  restore_report="$work_dir/database-backup-restore.json"
  docker exec "$database_backup_restore_container" \
    psql --username=postgres --dbname="$database_name" --no-psqlrc --tuples-only --no-align \
      --set=ON_ERROR_STOP=1 --command="
        SELECT json_build_object(
          'database', current_database(),
          'harvest_records', to_regclass('public.harvest_records') IS NOT NULL,
          'motor_runtime_entries', to_regclass('public.motor_runtime_entries') IS NOT NULL,
          'mfms_motor_operator_settings', to_regclass('public.mfms_motor_operator_settings') IS NOT NULL,
          'mfms_irrigation_targets', to_regclass('public.mfms_irrigation_targets') IS NOT NULL,
          'well_water_readings', to_regclass('public.well_water_readings') IS NOT NULL,
          'migration_ledger', to_regclass('public.mfms_production_schema_migrations') IS NOT NULL,
          'ledger_count', (SELECT count(*) FROM mfms_production_schema_migrations),
          'baseline_migration_count', (
            SELECT count(*) FROM mfms_production_schema_migrations
            WHERE migration_name = '$database_backup_baseline_migration'
              AND sha256 = '$database_backup_baseline_migration_sha256'
          )
        )::text;
      " > "$restore_report"
  python3 - "$restore_report" "$database_name" <<'PY_DATABASE_BACKUP_RESTORE_VALIDATION'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
if payload["database"] != sys.argv[2]:
    raise SystemExit("Restored backup has the wrong database identity")
for relation in (
    "harvest_records",
    "motor_runtime_entries",
    "mfms_motor_operator_settings",
    "mfms_irrigation_targets",
    "well_water_readings",
    "migration_ledger",
):
    if payload.get(relation) is not True:
        raise SystemExit(f"Restored backup is missing baseline relation: {relation}")
if payload.get("ledger_count") != 1 or payload.get("baseline_migration_count") != 1:
    raise SystemExit("Restored backup migration ledger does not match the approved Production baseline")
PY_DATABASE_BACKUP_RESTORE_VALIDATION

  docker rm -f "$database_backup_restore_container" >/dev/null
  database_backup_restore_container=""
  docker volume rm "$database_backup_restore_volume" >/dev/null
  database_backup_restore_volume=""
  database_backup_restore_verified="true"
}

assert_validated_database_backup() {
  [[ "$database_backup_verified" == "true" ]] \
    || blocked "A validated Production database backup is required before migration"
  [[ "$database_backup_restore_verified" == "true" ]] \
    || blocked "A verified isolated Production database restore is required before migration"
  [[ -f "$database_backup_file" && -s "$database_backup_file" ]] \
    || blocked "Validated Production database backup evidence is missing"
  [[ "$(sha256sum "$database_backup_file" | awk '{print $1}')" == "$database_backup_sha256" ]] \
    || blocked "Validated Production database backup checksum changed"
}

create_production_database_backup() {
  local database_host database_container network_snapshot backup_list backup_password status
  database_host=$(docker exec "$backend_live_container" python -c \
    'from urllib.parse import urlparse; from app.config import get_settings; print(urlparse(get_settings().database_url).hostname or "")')
  [[ "$database_host" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] \
    || blocked "Production database host is invalid"

  network_snapshot="$work_dir/production-network.json"
  docker network inspect "$production_network" > "$network_snapshot"
  database_container=$(python3 - "$network_snapshot" "$production_network" "$database_host" <<'PY'
import json
import subprocess
import sys

snapshot_path, network_name, database_host = sys.argv[1:]
network = json.load(open(snapshot_path, encoding="utf-8"))
if len(network) != 1:
    raise SystemExit("Production network lookup is ambiguous")
matches = []
for container_id, member in (network[0].get("Containers") or {}).items():
    details = json.loads(subprocess.check_output(["docker", "inspect", container_id], text=True))[0]
    network_details = (details.get("NetworkSettings", {}).get("Networks", {}) or {}).get(network_name, {})
    identities = {
        str(member.get("Name") or ""),
        str(details.get("Name") or "").lstrip("/"),
        *(network_details.get("Aliases") or []),
    }
    if database_host in identities and details.get("State", {}).get("Running") is True:
        matches.append(str(details.get("Name") or "").lstrip("/"))
if len(matches) != 1:
    raise SystemExit("Production database container lookup did not return exactly one running container")
print(matches[0])
PY
  )
  [[ -n "$database_container" ]] || blocked "Production database container is unavailable"
  docker exec "$database_container" sh -c \
    'command -v pg_dump >/dev/null && command -v pg_restore >/dev/null && command -v psql >/dev/null && command -v pg_isready >/dev/null' \
    || blocked "Production database container lacks the required PostgreSQL backup tools"

  validate_database_backup_credential_state
  verify_database_backup_access "$database_container"

  install -d -m 700 "$database_backup_dir"
  database_backup_temporary=$(mktemp "$database_backup_dir/.${database_name}.XXXXXX")
  backup_list="$work_dir/database-backup.list"
  backup_password=$(read_database_backup_password)
  if printf '%s\n' "$backup_password" | docker exec -i "$database_container" sh -c '
    IFS= read -r PGPASSWORD
    [ -n "$PGPASSWORD" ] || exit 82
    export PGPASSWORD
    exec pg_dump \
      --host=127.0.0.1 \
      --port=5432 \
      --username="$1" \
      --dbname="$2" \
      --no-password \
      --format=custom \
      --compress=9 \
      --no-owner \
      --no-privileges
  ' sh "$database_backup_role" "$database_name" > "$database_backup_temporary"; then
    status=0
  else
    status=$?
  fi
  unset backup_password
  if [[ "$status" -ne 0 ]]; then
    rm -f "$database_backup_temporary"
    database_backup_temporary=""
    blocked "Production database backup failed"
    return 1
  fi
  chmod 600 "$database_backup_temporary"
  if [[ ! -s "$database_backup_temporary" ]] \
    || ! python3 - "$database_backup_temporary" <<'PY_DATABASE_BACKUP_FORMAT'
import pathlib
import sys

raise SystemExit(0 if pathlib.Path(sys.argv[1]).read_bytes()[:5] == b"PGDMP" else 1)
PY_DATABASE_BACKUP_FORMAT
  then
    rm -f "$database_backup_temporary"
    database_backup_temporary=""
    blocked "Production database backup is empty or not custom format"
    return 1
  fi
  if ! docker exec -i "$database_container" sh -c 'exec pg_restore --list' \
      < "$database_backup_temporary" > "$backup_list" \
    || [[ ! -s "$backup_list" ]]; then
    rm -f "$database_backup_temporary"
    database_backup_temporary=""
    blocked "Production database backup listing verification failed"
    return 1
  fi

  verify_database_backup_restore "$database_container" "$database_backup_temporary"
  [[ "$database_backup_restore_verified" == "true" ]] \
    || blocked "Production database backup restore verification did not complete"

  database_backup_file="$database_backup_dir/${database_name}-pre-${candidate_revision}-${timestamp}.dump"
  [[ ! -e "$database_backup_file" && ! -L "$database_backup_file" ]] || {
    rm -f "$database_backup_temporary"
    database_backup_temporary=""
    blocked "Production database backup target already exists"
    return 1
  }
  mv "$database_backup_temporary" "$database_backup_file"
  database_backup_temporary=""
  database_backup_sha256=$(sha256sum "$database_backup_file" | awk '{print $1}')
  database_backup_bytes=$(wc -c < "$database_backup_file" | tr -d '[:space:]')
  [[ "$database_backup_sha256" =~ ^[0-9a-f]{64}$ && "$database_backup_bytes" =~ ^[1-9][0-9]*$ ]] \
    || blocked "Production database backup evidence is invalid"
  database_backup_verified="true"
}

apply_migrations() {
  local path checksum
  assert_validated_database_backup
  [[ -s "$migration_plan" ]] \
    || blocked "Production migration release has an empty migration plan"
  while IFS='|' read -r path checksum; do
    [[ -n "$path" && -n "$checksum" ]] \
      || blocked "Production migration plan entry is incomplete"
    docker run --rm \
      --network "$production_network" \
      --env-file "$environment_file" \
      "$new_image" \
      python /app/scripts/apply_production_migrations.py \
        --confirm-production \
        --migration "$path" \
        --expected-sha256 "$checksum"
  done < "$migration_plan"
}

verify_migrations() {
  local path checksum
  [[ -s "$migration_plan" ]] \
    || blocked "Production migration release has an empty migration plan"
  while IFS='|' read -r path checksum; do
    [[ -n "$path" && -n "$checksum" ]] \
      || blocked "Production migration verification entry is incomplete"
    docker run --rm \
      --network "$production_network" \
      --env-file "$environment_file" \
      "$new_image" \
      python /app/scripts/apply_production_migrations.py \
        --confirm-production \
        --migration "$path" \
        --expected-sha256 "$checksum" \
        --verify
  done < "$migration_plan"
}

start_candidate() {
  local require_version_endpoint=${1:-true}
  local require_openapi_plan=${2:-true}
  candidate_container="$backend_live_container-candidate-$run_id-$timestamp"
  docker run -d \
    --name "$candidate_container" \
    --network "$production_network" \
    --restart no \
    -p "127.0.0.1:$candidate_port:8000" \
    --mount "type=bind,source=$approved_storage_mount_source,target=$approved_storage_mount_target" \
    --mount "type=bind,source=$approved_temp_mount_source,target=$approved_temp_mount_target" \
    --env-file "$environment_file" \
    "$new_image" >/dev/null
  wait_for_health "http://127.0.0.1:$candidate_port" \
    || blocked "backend candidate health endpoint failed"
  if [[ "$require_version_endpoint" == "true" ]]; then
    wait_for_backend_version "http://127.0.0.1:$candidate_port" "$candidate_revision" \
      || blocked "backend candidate version endpoint failed"
  fi
  if [[ "$require_openapi_plan" == "true" ]]; then
    python3 - "$openapi_plan" "http://127.0.0.1:$candidate_port/openapi.json" <<'PY'
import json
import sys
from urllib.request import urlopen

expected = [line.strip() for line in open(sys.argv[1], encoding="utf-8") if line.strip()]
with urlopen(sys.argv[2], timeout=10) as response:
    paths = set(json.load(response).get("paths", {}))
missing = [path for path in expected if path not in paths]
if missing:
    raise SystemExit(f"candidate OpenAPI is missing required paths: {', '.join(missing)}")
PY
    verify_migrations
  fi
}

remove_candidate() {
  if [[ -n "$candidate_container" ]] && container_exists "$candidate_container"; then
    docker rm -f "$candidate_container" >/dev/null
  fi
  candidate_container=""
}

assert_live_contract() {
  local expected_revision=$1 expected_image_id=$2 require_version_endpoint=${3:-true}
  local require_same_network_ip=${4:-true}
  container_exists "$backend_live_container" || blocked "Production backend container is missing after switch"
  container_running "$backend_live_container" || blocked "Production backend container is not running after switch"
  [[ "$(docker inspect --format '{{.Image}}' "$backend_live_container")" == "$expected_image_id" ]] \
    || blocked "Production backend image ID does not match"
  [[ "$(image_revision_for_container "$backend_live_container")" == "$expected_revision" ]] \
    || blocked "Production backend revision does not match"
  [[ "$(image_environment_for_container "$backend_live_container")" == "Production" ]] \
    || blocked "Production backend image is not labelled Production"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$backend_live_container")" == "$approved_restart_policy" ]] \
    || blocked "Production backend restart policy changed"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$backend_live_container")" == "$production_network" ]] \
    || blocked "Production backend network changed"
  [[ "$(network_ip_for_container "$backend_live_container")" == "$approved_production_ipv4" ]] \
    || blocked "Production backend does not own fixed address $approved_production_ipv4"
  if [[ "$require_same_network_ip" == "true" ]]; then
    [[ "$(network_ip_for_container "$backend_live_container")" == "$original_network_ip" ]] \
      || blocked "Production backend network address changed"
  else
    [[ -n "$(network_ip_for_container "$backend_live_container")" ]] \
      || blocked "Production backend is not attached to the Production network"
  fi
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$backend_live_container")" == "$expected_port_bindings" ]] \
    || blocked "Production backend host port changed"
  assert_approved_mount_contract "$backend_live_container"
  [[ "$(docker inspect --format '{{.Id}}' "$frontend_container")" == "$frontend_id_before" ]] \
    || blocked "Production frontend container changed"
  [[ "$(docker inspect --format '{{.Image}}' "$frontend_container")" == "$frontend_image_before" ]] \
    || blocked "Production frontend image changed"
  [[ "$(proxy_digest)" == "$proxy_digest_before" ]] || blocked "proxy configuration changed"
  [[ "$(cron_digest)" == "$cron_digest_before" ]] || blocked "Production schedules changed"
  [[ "$(proxy_target_count)" == "$proxy_target_count_before" ]] \
    || blocked "Production proxy target count changed"
  assert_database_target "$backend_live_container"
  wait_for_health "http://127.0.0.1:$live_port" || blocked "replacement backend health endpoint failed"
  if [[ "$require_version_endpoint" == "true" ]]; then
    wait_for_backend_version "http://127.0.0.1:$live_port" "$expected_revision" \
      || blocked "replacement backend version endpoint failed"
  fi
  snapshot_unrelated_containers > "$after_unrelated"
  cmp -s "$before_unrelated" "$after_unrelated" \
    || blocked "a frontend, Test, Preview, ODK, proxy, scheduler, or unrelated container changed"
}

write_state() {
  local deployed_revision=$1 deployed_image_id=$2 deployed_image_tag=$3
  local rollback_container=$4 rollback_revision=$5 rollback_image_id=$6 rollback_image_tag=$7
  local temporary_state
  temporary_state=$(mktemp "$state_dir/backend-state.XXXXXX")
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
database_migrations=forward-only
EOF
  chmod 600 "$temporary_state"
  mv "$temporary_state" "$state_file"
}

restore_original_backend() {
  local live_id="" recovery_name=""
  automatic_restore_result="failed"
  if container_exists "$backend_live_container"; then
    live_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
    if [[ "$live_id" != "$original_container_id" ]]; then
      docker stop --time 30 "$backend_live_container" >/dev/null 2>&1 || true
      disconnect_production_network "$backend_live_container" >/dev/null 2>&1 || true
      if [[ -n "$replacement_origin" ]]; then
        docker rename "$backend_live_container" "$replacement_origin" >/dev/null 2>&1 || {
          recovery_name="$replacement_origin-recovery-$timestamp"
          docker rename "$backend_live_container" "$recovery_name" >/dev/null 2>&1 \
            || docker rm -f "$backend_live_container" >/dev/null 2>&1 \
            || true
        }
      else
        docker rm -f "$backend_live_container" >/dev/null 2>&1 || true
      fi
    fi
  fi
  if [[ -n "$transaction_backup" ]] && container_exists "$transaction_backup"; then
    docker rename "$transaction_backup" "$backend_live_container" >/dev/null 2>&1 || return 1
  fi
  if container_exists "$backend_live_container"; then
    ensure_production_network_ip "$backend_live_container" "$approved_production_ipv4" \
      >/dev/null 2>&1 || return 1
    docker start "$backend_live_container" >/dev/null 2>&1 || return 1
    if wait_for_health "http://127.0.0.1:$live_port"; then
      automatic_restore_result="pass"
    fi
  fi
}

cleanup() {
  set +e
  if [[ -n "$database_backup_restore_container" \
      && "$database_backup_restore_container" == mfms-production-backup-restore-* \
      && -n "$(docker ps -aq --filter "name=^/${database_backup_restore_container}$")" ]]; then
    docker rm -f "$database_backup_restore_container" >/dev/null 2>&1 || true
  fi
  database_backup_restore_container=""
  if [[ -n "$database_backup_restore_volume" \
      && "$database_backup_restore_volume" == mfms-production-backup-restore-*-data \
      && -n "$(docker volume ls -q --filter "name=^${database_backup_restore_volume}$")" ]]; then
    docker volume rm -f "$database_backup_restore_volume" >/dev/null 2>&1 || true
  fi
  database_backup_restore_volume=""
  if [[ -n "$database_backup_temporary" \
      && "$database_backup_temporary" == "$database_backup_dir"/."$database_name".* ]]; then
    rm -f "$database_backup_temporary"
  fi
  database_backup_temporary=""
  remove_candidate
  if [[ "$work_dir" == "$state_dir"/backend-work.* ]]; then
    rm -rf "$work_dir"
  fi
}

on_error() {
  local status=$?
  trap - ERR
  echo "PRODUCTION_BACKEND_TRANSACTION_ERROR=operation=$operation status=$status" >&2
  exit "$status"
}

on_exit() {
  local status=$?
  trap - ERR EXIT HUP INT TERM
  set +e
  if [[ "$status" -ne 0 && "$transaction_active" -eq 1 ]]; then
    restore_original_backend
    echo "AUTOMATIC_BACKEND_RESTORE=$automatic_restore_result" >&2
    echo "DATABASE_MIGRATIONS_ROLLED_BACK=false" >&2
  fi
  cleanup
  exit "$status"
}

trap on_error ERR
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

deploy_backend() {
  validate_common_live_state
  assert_candidate_port_available
  prepare_backend_source
  validate_release_descriptor
  build_image
  write_environment_file "$backend_live_container" "$candidate_revision"
  create_production_database_backup

  # The verified custom-format backup is retained before the checksum-pinned,
  # forward-only migration is applied and independently verified.
  apply_migrations
  start_candidate
  remove_candidate

  transaction_backup="$backend_live_container-pre-github-$run_id-$timestamp"
  transaction_active=1
  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_production_network "$backend_live_container"
  docker rename "$backend_live_container" "$transaction_backup"
  docker run -d \
    --name "$backend_live_container" \
    --network "$production_network" \
    --ip "$approved_production_ipv4" \
    --restart "$approved_restart_policy" \
    -p "127.0.0.1:$live_port:8000" \
    --mount "type=bind,source=$approved_storage_mount_source,target=$approved_storage_mount_target" \
    --mount "type=bind,source=$approved_temp_mount_source,target=$approved_temp_mount_target" \
    --env-file "$environment_file" \
    "$new_image" >/dev/null

  assert_live_contract "$candidate_revision" "$new_image_id"
  trap '' HUP INT TERM
  write_state \
    "$candidate_revision" "$new_image_id" "$new_image" \
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "deployment_environment=Production"
  echo "deployment_component=backend"
  echo "deployment_url=$production_url"
  echo "previous_backend_revision=$original_revision"
  echo "deployed_backend_revision=$candidate_revision"
  echo "deployed_backend_image=$new_image"
  echo "deployed_backend_image_id=$new_image_id"
  echo "rollback_container=$transaction_backup"
  echo "database=$database_name"
  echo "database_backup_path=$database_backup_file"
  echo "database_backup_sha256=$database_backup_sha256"
  echo "database_backup_bytes=$database_backup_bytes"
  echo "database_backup_verified=true"
  echo "database_backup_role=$database_backup_role"
  echo "database_backup_restore_postgres_major=$database_backup_restore_postgres_major"
  echo "database_backup_restore_verified=$database_backup_restore_verified"
  echo "database_migrations=forward-only"
  echo "worker_actor_assertion=server-local"
  echo "frontend_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "test_touched=0"
  echo "preview_touched=0"
  echo "PRODUCTION_BACKEND_DEPLOYMENT=PASS"
}

credential_cutover_backend() {
  validate_common_live_state
  [[ "$original_revision" == "$expected_current_revision" ]] \
    || blocked "current Production backend revision does not match the database-role cutover input"
  [[ "$original_network_ip" == "$approved_production_ipv4" ]] \
    || blocked "current Production backend does not own the approved fixed address"
  assert_candidate_port_available
  candidate_revision="$original_revision"
  new_image="$original_image_id"
  new_image_id="$original_image_id"
  write_environment_file "$backend_live_container" "$original_revision"
  start_candidate true false
  remove_candidate

  transaction_backup="$backend_live_container-pre-database-role-$run_id-$timestamp"
  transaction_active=1
  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_production_network "$backend_live_container"
  docker rename "$backend_live_container" "$transaction_backup"
  docker run -d \
    --name "$backend_live_container" \
    --network "$production_network" \
    --ip "$approved_production_ipv4" \
    --restart "$approved_restart_policy" \
    -p "127.0.0.1:$live_port:8000" \
    --mount "type=bind,source=$approved_storage_mount_source,target=$approved_storage_mount_target" \
    --mount "type=bind,source=$approved_temp_mount_source,target=$approved_temp_mount_target" \
    --env-file "$environment_file" \
    "$original_image_id" >/dev/null

  assert_live_contract "$original_revision" "$original_image_id"
  trap '' HUP INT TERM
  write_state \
    "$original_revision" "$original_image_id" "$original_image_tag" \
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "credential_environment=Production"
  echo "credential_component=backend"
  echo "application_revision_unchanged=$original_revision"
  echo "application_image_unchanged=$original_image_id"
  echo "rollback_container=$transaction_backup"
  echo "database=$database_name"
  echo "database_role=mfms_prod_app"
  echo "production_ipv4=$approved_production_ipv4"
  echo "database_migrations=none"
  echo "preview_touched=0"
  echo "test_touched=0"
  echo "PRODUCTION_DATABASE_ROLE_CUTOVER=PASS"
}

dry_run_backend_rollback() {
  [[ -f "$state_file" ]] || blocked "no successful Production backend deployment is recorded"
  validate_common_live_state
  assert_exact_historical_application_rollback
  assert_candidate_port_available
  snapshot_rollback_database_evidence "$backend_live_container" "$rollback_database_before"

  echo "rollback_dry_run_environment=Production"
  echo "rollback_dry_run_component=backend"
  echo "rollback_dry_run_current_revision=$original_revision"
  echo "rollback_dry_run_current_container=$original_container_id"
  echo "rollback_dry_run_current_image=$original_image_id"
  echo "rollback_dry_run_target_revision=$approved_rollback_target_revision"
  echo "rollback_dry_run_target_container=$approved_rollback_target_container_id"
  echo "rollback_dry_run_target_image=$approved_rollback_target_image_id"
  echo "rollback_dry_run_database_evidence_sha256=$(sha256sum "$rollback_database_before" | awk '{print $1}')"
  echo "rollback_dry_run_migration_plan=empty-approved-historical-application-only"
  echo "database_backup_operations=none"
  echo "database_migration_operations=none"
  echo "traffic_switch=not-performed"
  echo "current_backend_preserved=true"
  echo "PRODUCTION_BACKEND_ROLLBACK_DRY_RUN=PASS"
}

rollback_backend() {
  local deployed_revision deployed_image_id deployed_image_tag
  local rollback_container rollback_revision rollback_image_id rollback_image_tag replacement_id
  [[ -f "$state_file" ]] || blocked "no successful Production backend deployment is recorded"
  validate_common_live_state
  [[ "$expected_current_revision" == "$original_revision" ]] \
    || blocked "current Production backend does not match the requested rollback revision"
  assert_exact_historical_application_rollback
  snapshot_rollback_database_evidence "$backend_live_container" "$rollback_database_before"

  deployed_revision=$(read_state_value deployed_revision)
  deployed_image_id=$(read_state_value deployed_image_id)
  deployed_image_tag=$(read_state_value deployed_image_tag)
  rollback_container=$(read_state_value rollback_container)
  rollback_revision=$(read_state_value rollback_revision)
  rollback_image_id=$(read_state_value rollback_image_id)
  rollback_image_tag=$(read_state_value rollback_image_tag)
  [[ "$deployed_revision" == "$original_revision" ]] \
    || blocked "current Production backend does not match recorded rollback state"
  [[ "$original_image_id" == "$deployed_image_id" ]] \
    || blocked "current Production backend image does not match recorded rollback state"
  container_exists "$rollback_container" || blocked "recorded backend rollback container is missing"
  ! container_running "$rollback_container" || blocked "recorded backend rollback container is unexpectedly running"
  [[ "$(docker inspect --format '{{.Image}}' "$rollback_container")" == "$rollback_image_id" ]] \
    || blocked "backend rollback container image changed"
  [[ "$(image_revision_for_container "$rollback_container")" == "$rollback_revision" ]] \
    || blocked "backend rollback container revision changed"

  write_environment_file "$rollback_container" "$rollback_revision"
  assert_candidate_port_available
  new_image="$rollback_image_id"
  candidate_revision="$rollback_revision"
  # The exact historical application rollback intentionally has no forward
  # migration plan. Health and revision are tested without invoking migration
  # verification; every forward deployment still uses the required plan.
  start_candidate true false
  remove_candidate

  transaction_backup="$backend_live_container-pre-rollback-$run_id-$timestamp"
  replacement_origin="$rollback_container"
  transaction_active=1
  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_production_network "$backend_live_container"
  docker rename "$backend_live_container" "$transaction_backup"
  docker rename "$rollback_container" "$backend_live_container"
  ensure_production_network_ip "$backend_live_container" "$approved_production_ipv4" \
    || blocked "backend rollback could not restore fixed Production address $approved_production_ipv4"
  docker start "$backend_live_container" >/dev/null
  replacement_id=$(docker inspect --format '{{.Image}}' "$backend_live_container")

  assert_live_contract "$rollback_revision" "$replacement_id" false false
  snapshot_rollback_database_evidence "$backend_live_container" "$rollback_database_after"
  cmp -s "$rollback_database_before" "$rollback_database_after" \
    || blocked "application-only rollback changed the migration ledger, settings, audit history, or protection trigger"
  trap '' HUP INT TERM
  write_state \
    "$rollback_revision" "$replacement_id" "$rollback_image_tag" \
    "$transaction_backup" "$deployed_revision" "$deployed_image_id" "$deployed_image_tag"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "rollback_environment=Production"
  echo "rollback_component=backend"
  echo "rollback_url=$production_url"
  echo "previous_backend_revision=$deployed_revision"
  echo "restored_backend_revision=$rollback_revision"
  echo "rollback_container_retained=$transaction_backup"
  echo "database_migrations=forward-only-retained"
  echo "database_backup_operations=none"
  echo "database_migration_operations=none"
  echo "application_only_rollback=true"
  echo "rollback_database_evidence_sha256=$(sha256sum "$rollback_database_after" | awk '{print $1}')"
  echo "frontend_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "test_touched=0"
  echo "preview_touched=0"
  echo "PRODUCTION_BACKEND_ROLLBACK=PASS"
}

case "$operation" in
  deploy)
    deploy_backend
    ;;
  rollback)
    rollback_backend
    ;;
  rollback-dry-run)
    dry_run_backend_rollback
    ;;
  credential-cutover)
    credential_cutover_backend
    ;;
esac
