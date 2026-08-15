#!/usr/bin/env bash
#
# Restricted server-side command for the MFMS Test API.  This file is
# installed on the server and invoked only through a dedicated forced-command
# SSH key.  It deliberately has no Production, proxy, ODK, or scheduler path.
#
set -Eeuo pipefail

umask 077

blocked() {
  echo "TEST_BACKEND_DEPLOY_BLOCKED=$1" >&2
  return 1
}

[[ $# -eq 0 ]] || blocked "arguments are not accepted"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Test SSH user is muthu"

for required_command in \
  awk basename cat chmod cmp curl date docker flock git grep id install mkdir mktemp mv \
  python3 rm sed seq sha256sum sleep sort ss tr wc
do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

readonly backend_repository="ayemuthu1963-beep/muthu-harvest-dashboard"
readonly backend_repo_dir="/home/muthu/muthu-harvest-dashboard-test-release"
readonly backend_release_ref="refs/heads/test-release"
readonly backend_live_container="harvest-api-test"
readonly frontend_container="mfms-test-web"
readonly proxy_container="central-nginx-1"
readonly test_network="harvest-net"
readonly test_url="https://test.muthufarms.com"
readonly database_name="mfms_server_test"
readonly live_port="8025"
readonly candidate_port="8026"
readonly state_dir="/home/muthu/.local/state/mfms-test-github"
readonly state_file="$state_dir/last-successful-backend-switch"
readonly lock_file="$state_dir/deployment.lock"
readonly worker_secret_file="$state_dir/worker-management-signing.env"
readonly database_backup_dir="$state_dir/database-backups"
readonly database_url_override_file="/home/muthu/mfms_secrets/database-roles/test-app.database_url"
readonly approved_restart_policy="unless-stopped"
readonly approved_test_well_odk_cutoff="2026-08-08T02:27:07.271Z"
readonly approved_temp_mount_source="/tmp"
readonly approved_temp_mount_target="/host-tmp"
readonly approved_storage_mount_source="/home/muthu/mfms_data/test/motor-screenshot-analysis"
readonly approved_storage_mount_target="/var/lib/mfms/motor-screenshot-analysis"
readonly expected_mount_contract="bind|$approved_storage_mount_source|$approved_storage_mount_target|true
bind|$approved_temp_mount_source|$approved_temp_mount_target|true"
readonly expected_port_bindings='{"8000/tcp":[{"HostIp":"127.0.0.1","HostPort":"8025"}]}'

[[ "$test_url" == "https://test.muthufarms.com" ]] \
  || blocked "the public target is not Test"

install -d -m 700 "$state_dir"
exec 9>"$lock_file"
flock -n 9 || blocked "another Test deployment or rollback is already running"

operation=""
candidate_revision=""
expected_current_revision=""
run_id=""
readonly deploy_command_pattern='^deploy-test-backend ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9]+)$'
readonly rollback_command_pattern='^rollback-test-backend ([0-9a-f]{40}) ([0-9]+)$'
readonly credential_cutover_command_pattern='^cutover-test-database-role ([0-9a-f]{40}) ([0-9]+)$'

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
elif [[ "$original_command" =~ $credential_cutover_command_pattern ]]; then
  operation="credential-cutover"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
else
  blocked "the SSH key accepts only an exact Test backend deploy, rollback, or database-role cutover command"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
work_dir=$(mktemp -d "$state_dir/backend-work.XXXXXX")
source_dir="$work_dir/source"
environment_file="$work_dir/backend.env"
migration_plan="$work_dir/migrations.plan"
migration_mode_file="$work_dir/migration.mode"
openapi_plan="$work_dir/openapi.plan"
before_unrelated="$work_dir/unrelated.before"
after_unrelated="$work_dir/unrelated.after"

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
database_migration_mode=""
transaction_active=0
automatic_restore_result="not-required"

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1")" == "true" ]]
}

network_ip_for_container() {
  docker inspect \
    --format "{{with index .NetworkSettings.Networks \"$test_network\"}}{{.IPAddress}}{{end}}" \
    "$1"
}

mount_contract_for_container() {
  local container=$1
  docker inspect \
    --format '{{json .Mounts}}' \
    "$container" \
    | python3 -c 'import json,sys; mounts=json.load(sys.stdin); print("\n".join(sorted("{}|{}|{}|{}".format(item["Type"], item["Source"], item["Destination"], str(item["RW"]).lower()) for item in mounts)))'
}

assert_approved_mount_contract() {
  local container=$1 contract
  contract=$(mount_contract_for_container "$container")
  [[ "$contract" == "$expected_mount_contract" ]] \
    || blocked "Test backend mount contract differs from the approved persistent storage and /tmp bind mounts"
}

disconnect_test_network() {
  local container=$1
  if [[ -n "$(network_ip_for_container "$container")" ]]; then
    docker network disconnect "$test_network" "$container"
  fi
}

ensure_test_network_ip() {
  local container=$1 expected_ip=$2 current_ip attempt
  # Docker can retain a just-disconnected fixed-IP lease for more than
  # 30 seconds while its endpoint cleanup settles. Keep retrying within the
  # guarded transaction instead of abandoning a healthy rollback image.
  for attempt in $(seq 1 120); do
    current_ip=$(network_ip_for_container "$container")
    if [[ -n "$current_ip" && "$current_ip" != "$expected_ip" ]]; then
      docker network disconnect "$test_network" "$container" >/dev/null 2>&1 || true
      current_ip=""
    fi
    if [[ -z "$current_ip" ]]; then
      # Renamed rollback containers retain their approved IPAM address. Docker
      # rejects an explicit --ip reconnect for that saved endpoint, but a
      # normal reconnect restores the same address and is verified below.
      docker network connect "$test_network" "$container" \
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

ensure_test_network_attachment() {
  local container=$1 current_ip attempt
  for attempt in $(seq 1 30); do
    current_ip=$(network_ip_for_container "$container")
    [[ -n "$current_ip" ]] && return 0
    docker network connect "$test_network" "$container" >/dev/null 2>&1 || true
    current_ip=$(network_ip_for_container "$container")
    [[ -n "$current_ip" ]] && return 0
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
    "grep -R -F 'proxy_pass http://mfms-test-web:3000' /etc/nginx/conf.d 2>/dev/null | wc -l" \
    | tr -d '[:space:]'
}

assert_candidate_port_available() {
  local listeners
  listeners=$(ss -H -ltn "sport = :$candidate_port" 2>/dev/null || true)
  [[ -z "$listeners" ]] \
    || blocked "Test backend candidate port $candidate_port is already allocated"
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
        'import json,sys; payload=json.load(sys.stdin); raise SystemExit(0 if payload.get("git_commit") == sys.argv[1] and payload.get("environment") == "Test" else 1)' \
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
    raise SystemExit("Test database URL override must be a regular mode-0600 file")
if metadata.st_uid != os.getuid():
    raise SystemExit("Test database URL override has the wrong owner")
lines = path.read_text(encoding="ascii").splitlines()
if len(lines) != 1 or not lines[0].startswith("DATABASE_URL="):
    raise SystemExit("Test database URL override has invalid structure")
value = lines[0].split("=", 1)[1]
parsed = urlsplit(value.replace("postgresql+psycopg://", "postgresql://", 1))
if (
    parsed.scheme != "postgresql"
    or parsed.username != "mfms_test_app"
    or not parsed.password
    or parsed.hostname != "harvest-db"
    or parsed.port != 5432
    or parsed.path != "/mfms_server_test"
    or parsed.query
    or parsed.fragment
):
    raise SystemExit("Test database URL override does not match the approved isolated target")
PY
}

write_environment_file() {
  local source_container=$1 target_revision=${2:-} worker_secret
  ensure_worker_signing_secret
  ensure_database_url_override
  worker_secret=$(awk -F= '$1 == "MFMS_ACTOR_ASSERTION_SECRET" {print $2}' "$worker_secret_file")
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$source_container" \
    | awk 'length($0) && $0 !~ /^(DATABASE_URL|MFMS_GIT_COMMIT|MFMS_BUILD_TIMESTAMP|MFMS_BUILD_ENVIRONMENT|MFMS_TEST_WELL_ODK_CUTOFF|MFMS_WORKER_MANAGEMENT_ENABLED|MFMS_ACTOR_ASSERTION_SECRET|MFMS_ACTOR_ASSERTION_MAX_AGE_SECONDS|MFMS_LOCAL_ACTOR_ENABLED|MFMS_LOCAL_ACTOR_USERNAME|MFMS_LOCAL_ACTOR_ROLE)=/' \
    > "$environment_file"
  cat "$database_url_override_file" >> "$environment_file"
  [[ -n "$(grep -E '^DATABASE_URL=' "$environment_file" || true)" ]] \
    || blocked "Test backend has no DATABASE_URL environment entry"
  if [[ -n "$target_revision" ]]; then
    printf 'MFMS_GIT_COMMIT=%s\nMFMS_BUILD_TIMESTAMP=%s\nMFMS_BUILD_ENVIRONMENT=Test\nMFMS_TEST_WELL_ODK_CUTOFF=%s\n' \
      "$target_revision" "$timestamp" "$approved_test_well_odk_cutoff" >> "$environment_file"
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
  container_exists "$backend_live_container" || blocked "Test backend container is missing"
  container_running "$backend_live_container" || blocked "Test backend container is not running"
  container_exists "$frontend_container" || blocked "Test frontend container is missing"
  container_running "$frontend_container" || blocked "Test frontend container is not running"
  container_exists "$proxy_container" || blocked "Test proxy container is missing"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$backend_live_container")" == "$test_network" ]] \
    || blocked "Test backend is not on the Test network"
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$backend_live_container")" == "$expected_port_bindings" ]] \
    || blocked "Test backend host port mapping differs from the approved $live_port mapping"
  assert_approved_mount_contract "$backend_live_container"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$backend_live_container")" == "$approved_restart_policy" ]] \
    || blocked "Test backend restart policy changed"
  [[ "$(docker ps -a --format '{{.Names}}' | grep -Ec '^harvest-api-test-candidate-' || true)" -eq 0 ]] \
    || blocked "a stale Test backend candidate container exists"

  original_container_id=$(docker inspect --format '{{.Id}}' "$backend_live_container")
  original_image_id=$(docker inspect --format '{{.Image}}' "$backend_live_container")
  original_image_tag=$(docker inspect --format '{{.Config.Image}}' "$backend_live_container")
  original_network_ip=$(network_ip_for_container "$backend_live_container")
  [[ -n "$original_network_ip" ]] || blocked "Test backend has no Test network address"
  original_revision=$(live_revision)
  frontend_id_before=$(docker inspect --format '{{.Id}}' "$frontend_container")
  frontend_image_before=$(docker inspect --format '{{.Image}}' "$frontend_container")
  proxy_digest_before=$(proxy_digest)
  proxy_target_count_before=$(proxy_target_count)
  cron_digest_before=$(cron_digest)
  [[ "$proxy_target_count_before" =~ ^[1-9][0-9]*$ ]] \
    || blocked "Test proxy has no approved frontend target"
  assert_database_target "$backend_live_container"
  snapshot_unrelated_containers > "$before_unrelated"
}

prepare_backend_source() {
  local origin_url
  [[ -d "$backend_repo_dir/.git" || -f "$backend_repo_dir/.git" ]] \
    || blocked "authoritative Test backend checkout is missing"
  [[ "$(git -C "$backend_repo_dir" branch --show-current)" == "test-release" ]] \
    || blocked "authoritative backend checkout is not on test-release"
  [[ -z "$(git -C "$backend_repo_dir" status --short)" ]] \
    || blocked "authoritative backend checkout is not clean"
  origin_url=$(git -C "$backend_repo_dir" remote get-url origin)
  case "$origin_url" in
    "git@github.com:$backend_repository.git"|"git@github.com-mfms-preview-backend:$backend_repository.git"|"https://github.com/$backend_repository.git"|"https://github.com/$backend_repository")
      ;;
    *)
      blocked "authoritative backend checkout origin is not approved"
      ;;
  esac
  git -C "$backend_repo_dir" fetch --quiet --no-tags origin \
    "+$backend_release_ref:refs/remotes/origin/test-release"
  local remote_revision
  remote_revision=$(git -C "$backend_repo_dir" rev-parse refs/remotes/origin/test-release)
  [[ "$remote_revision" == "$candidate_revision" ]] \
    || blocked "candidate is not the exact test-release head"
  git -C "$backend_repo_dir" cat-file -e "$original_revision^{commit}" \
    || blocked "live backend revision is absent from the authoritative checkout"
  git -C "$backend_repo_dir" merge-base --is-ancestor "$original_revision" "$candidate_revision" \
    || blocked "candidate does not contain the live Test backend revision"

  git clone --quiet --no-checkout "$backend_repo_dir" "$source_dir"
  git -C "$source_dir" checkout --quiet --detach "$candidate_revision"
  [[ -z "$(git -C "$source_dir" status --short)" ]] \
    || blocked "candidate backend checkout is not clean"
}

validate_release_descriptor() {
  local descriptor="$source_dir/deploy/test-backend-release.json"
  [[ -f "$descriptor" ]] || blocked "Test backend release descriptor is missing"
  python3 - "$descriptor" "$source_dir" "$original_revision" "$candidate_revision" \
    "$migration_plan" "$migration_mode_file" "$openapi_plan" <<'PY'
import hashlib
import json
import pathlib
import re
import sys

descriptor_path, source_text, current, candidate, migrations_output, migration_mode_output, openapi_output = sys.argv[1:]
source = pathlib.Path(source_text).resolve()
data = json.loads(pathlib.Path(descriptor_path).read_text(encoding="utf-8"))

deployment_kind = data.get("deployment_kind")
if deployment_kind == "backend-no-database-change":
    expected_database_invariant = "unchanged"
    migration_mode = "none"
elif deployment_kind == "backend-with-forward-only-migrations":
    expected_database_invariant = "test-migrations-only"
    migration_mode = "forward-only"
else:
    raise SystemExit("backend release descriptor deployment kind is invalid")

expected_invariants = {
    "production": "unchanged",
    "frontend": "unchanged",
    "odk": "unchanged",
    "schedules": "unchanged",
    "proxy_configuration": "unchanged",
    "database": expected_database_invariant,
}
if data.get("schema_version") != 1:
    raise SystemExit("invalid backend release descriptor schema")
if data.get("environment") != "Test":
    raise SystemExit("backend release descriptor is not Test")
if data.get("target_database") != "mfms_server_test":
    raise SystemExit("backend release descriptor is not limited to mfms_server_test")
if data.get("repository") != "ayemuthu1963-beep/muthu-harvest-dashboard":
    raise SystemExit("backend release descriptor repository is invalid")
if data.get("release_branch") != "test-release":
    raise SystemExit("backend release descriptor branch is invalid")
if data.get("protected_invariants") != expected_invariants:
    raise SystemExit("backend release descriptor protected invariants are incomplete")

migrations = data.get("migrations")
if not isinstance(migrations, list):
    raise SystemExit("backend release descriptor migrations must be a list")
if migration_mode == "none" and migrations:
    raise SystemExit("a no-database-change release cannot declare migrations")
if migration_mode == "forward-only" and not migrations:
    raise SystemExit("a forward-only release must declare at least one migration")
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
    r"^(?:api/(?:Dockerfile|requirements\.txt|app/(?:[^/]+\.py|routers/[^/]+\.py|"
    r"models/[^/]+\.py|repositories/[^/]+\.py|services/[^/]+\.py))|"
    r"db/migrations/[0-9][A-Za-z0-9_.-]*\.sql|"
    r"db/rollbacks/[0-9][A-Za-z0-9_.-]*\.sql|"
    r"\.github/workflows/ci\.yml|"
    r"scripts/(?:apply_test_migrations|import_access_csv|import_historical_clean_csv|"
    r"import_manual_harvest_csv|odk_sync_placeholder|sync_preview_harvest_odk|"
    r"sync_well_water_odk)\.py|"
    r"scripts/run_preview_(?:beetle|harvest|well_water)_sync\.sh|"
    r"deploy/test-backend-release\.json|"
    r"tests/[^/]+)$"
)
if not changed:
    raise SystemExit("backend candidate contains no changes from the live revision")
for path in changed:
    if not allowed.fullmatch(path):
        raise SystemExit(f"backend candidate contains an unapproved path: {path}")

pathlib.Path(migrations_output).write_text(
    "".join(f"{path}|{checksum}\n" for path, checksum in plan), encoding="utf-8"
)
pathlib.Path(migration_mode_output).write_text(f"{migration_mode}\n", encoding="utf-8")
pathlib.Path(openapi_output).write_text("".join(f"{path}\n" for path in openapi_paths), encoding="utf-8")
PY
  database_migration_mode=$(<"$migration_mode_file")
  [[ "$database_migration_mode" == "none" || "$database_migration_mode" == "forward-only" ]] \
    || blocked "backend release migration mode is invalid"
}

build_image() {
  new_image="muthu-harvest-dashboard-harvest-api:test-${candidate_revision:0:7}-$timestamp"
  docker build \
    --pull=false \
    --file "$source_dir/api/Dockerfile" \
    --build-arg "MFMS_GIT_COMMIT=$candidate_revision" \
    --build-arg "MFMS_BUILD_TIMESTAMP=$timestamp" \
    --build-arg "MFMS_BUILD_ENVIRONMENT=Test" \
    --tag "$new_image" \
    "$source_dir" >/dev/null
  new_image_id=$(docker image inspect --format '{{.Id}}' "$new_image")
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$new_image")" == "$candidate_revision" ]] \
    || blocked "built backend image revision label is invalid"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$new_image")" == "Test" ]] \
    || blocked "built backend image is not labelled Test"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.source-contract"}}' "$new_image")" == "git-complete" ]] \
    || blocked "built backend image does not declare the complete Git source contract"
}

create_test_database_backup() {
  local database_host database_container network_snapshot temporary_backup backup_list
  database_host=$(docker exec "$backend_live_container" python -c \
    'from urllib.parse import urlparse; from app.config import get_settings; print(urlparse(get_settings().database_url).hostname or "")')
  [[ "$database_host" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] \
    || blocked "Test database host is invalid"

  network_snapshot="$work_dir/test-network.json"
  docker network inspect "$test_network" > "$network_snapshot"
  database_container=$(python3 - "$network_snapshot" "$test_network" "$database_host" <<'PY'
import json
import subprocess
import sys

snapshot_path, network_name, database_host = sys.argv[1:]
network = json.load(open(snapshot_path, encoding="utf-8"))
if len(network) != 1:
    raise SystemExit("Test network lookup is ambiguous")
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
    raise SystemExit("Test database container lookup did not return exactly one running container")
print(matches[0])
PY
  )
  [[ -n "$database_container" ]] || blocked "Test database container is unavailable"
  docker exec "$database_container" sh -c \
    'command -v pg_dump >/dev/null && command -v pg_restore >/dev/null && test -n "${POSTGRES_USER:-}"' \
    || blocked "Test database container lacks the required backup tools or user"

  install -d -m 700 "$database_backup_dir"
  temporary_backup=$(mktemp "$database_backup_dir/.${database_name}.XXXXXX")
  backup_list="$work_dir/database-backup.list"
  if ! docker exec "$database_container" sh -c \
    'exec pg_dump --format=custom --compress=9 --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$1"' \
    sh "$database_name" > "$temporary_backup"; then
    rm -f "$temporary_backup"
    blocked "Test database backup failed"
    return 1
  fi
  chmod 600 "$temporary_backup"
  if [[ ! -s "$temporary_backup" ]] \
    || ! docker exec -i "$database_container" sh -c 'exec pg_restore --list' \
      < "$temporary_backup" > "$backup_list" \
    || [[ ! -s "$backup_list" ]]; then
    rm -f "$temporary_backup"
    blocked "Test database backup verification failed"
    return 1
  fi

  database_backup_file="$database_backup_dir/${database_name}-pre-${candidate_revision}-${timestamp}.dump"
  [[ ! -e "$database_backup_file" ]] || {
    rm -f "$temporary_backup"
    blocked "Test database backup target already exists"
    return 1
  }
  mv "$temporary_backup" "$database_backup_file"
  database_backup_sha256=$(sha256sum "$database_backup_file" | awk '{print $1}')
  database_backup_bytes=$(wc -c < "$database_backup_file" | tr -d '[:space:]')
  [[ "$database_backup_sha256" =~ ^[0-9a-f]{64}$ && "$database_backup_bytes" =~ ^[1-9][0-9]*$ ]] \
    || blocked "Test database backup evidence is invalid"
}

apply_migrations() {
  local migration checksum
  while IFS='|' read -r migration checksum; do
    [[ -n "$migration" && -n "$checksum" ]] || continue
    docker run --rm \
      --network "$test_network" \
      --env-file "$environment_file" \
      "$new_image" \
      python /app/scripts/apply_test_migrations.py \
        --confirm-test-uat \
        --migration "$migration" \
        --expected-sha256 "$checksum"
  done < "$migration_plan"
}

verify_migrations() {
  local migration checksum
  while IFS='|' read -r migration checksum; do
    [[ -n "$migration" && -n "$checksum" ]] || continue
    docker run --rm \
      --network "$test_network" \
      --env-file "$environment_file" \
      "$new_image" \
      python /app/scripts/apply_test_migrations.py \
        --confirm-test-uat \
        --verify \
        --migration "$migration" \
        --expected-sha256 "$checksum"
  done < "$migration_plan"
}

start_candidate() {
  local require_version_endpoint=${1:-true}
  local require_openapi_plan=${2:-true}
  candidate_container="$backend_live_container-candidate-$run_id-$timestamp"
  docker run -d \
    --name "$candidate_container" \
    --network "$test_network" \
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
  container_exists "$backend_live_container" || blocked "Test backend container is missing after switch"
  container_running "$backend_live_container" || blocked "Test backend container is not running after switch"
  [[ "$(docker inspect --format '{{.Image}}' "$backend_live_container")" == "$expected_image_id" ]] \
    || blocked "Test backend image ID does not match"
  [[ "$(image_revision_for_container "$backend_live_container")" == "$expected_revision" ]] \
    || blocked "Test backend revision does not match"
  [[ "$(image_environment_for_container "$backend_live_container")" == "Test" ]] \
    || blocked "Test backend image is not labelled Test"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$backend_live_container")" == "$approved_restart_policy" ]] \
    || blocked "Test backend restart policy changed"
  [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$backend_live_container")" == "$test_network" ]] \
    || blocked "Test backend network changed"
  if [[ "$require_same_network_ip" == "true" ]]; then
    [[ "$(network_ip_for_container "$backend_live_container")" == "$original_network_ip" ]] \
      || blocked "Test backend network address changed"
  else
    [[ -n "$(network_ip_for_container "$backend_live_container")" ]] \
      || blocked "Test backend is not attached to the Test network"
  fi
  [[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$backend_live_container")" == "$expected_port_bindings" ]] \
    || blocked "Test backend host port changed"
  assert_approved_mount_contract "$backend_live_container"
  [[ "$(docker inspect --format '{{.Id}}' "$frontend_container")" == "$frontend_id_before" ]] \
    || blocked "Test frontend container changed"
  [[ "$(docker inspect --format '{{.Image}}' "$frontend_container")" == "$frontend_image_before" ]] \
    || blocked "Test frontend image changed"
  [[ "$(proxy_digest)" == "$proxy_digest_before" ]] || blocked "proxy configuration changed"
  [[ "$(cron_digest)" == "$cron_digest_before" ]] || blocked "Test schedules changed"
  [[ "$(proxy_target_count)" == "$proxy_target_count_before" ]] \
    || blocked "Test proxy target count changed"
  assert_database_target "$backend_live_container"
  wait_for_health "http://127.0.0.1:$live_port" || blocked "replacement backend health endpoint failed"
  if [[ "$require_version_endpoint" == "true" ]]; then
    wait_for_backend_version "http://127.0.0.1:$live_port" "$expected_revision" \
      || blocked "replacement backend version endpoint failed"
  fi
  snapshot_unrelated_containers > "$after_unrelated"
  cmp -s "$before_unrelated" "$after_unrelated" \
    || blocked "a frontend, Production, ODK, proxy, scheduler, or unrelated container changed"
}

write_state() {
  local deployed_revision=$1 deployed_image_id=$2 deployed_image_tag=$3
  local rollback_container=$4 rollback_revision=$5 rollback_image_id=$6 rollback_image_tag=$7
  local migration_mode=$8
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
database_migrations=$migration_mode
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
      disconnect_test_network "$backend_live_container" >/dev/null 2>&1 || true
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
    ensure_test_network_attachment "$backend_live_container" \
      >/dev/null 2>&1 || return 1
    docker start "$backend_live_container" >/dev/null 2>&1 || return 1
    if wait_for_health "http://127.0.0.1:$live_port"; then
      automatic_restore_result="pass"
    fi
  fi
}

cleanup() {
  set +e
  remove_candidate
  if [[ "$work_dir" == "$state_dir"/backend-work.* ]]; then
    rm -rf "$work_dir"
  fi
}

on_error() {
  local status=$?
  trap - ERR
  echo "TEST_BACKEND_TRANSACTION_ERROR=operation=$operation status=$status" >&2
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
  [[ "$original_revision" == "$expected_current_revision" ]] \
    || blocked "current Test backend revision does not match the guarded deployment input"
  assert_candidate_port_available
  prepare_backend_source
  validate_release_descriptor
  build_image
  write_environment_file "$backend_live_container" "$candidate_revision"
  create_test_database_backup

  # Migration SQL is restricted to additive, forward-compatible changes.  The
  # verified custom-format database backup above is retained before any schema
  # update. The prior Test API stays live while the additive schema is
  # updated and the candidate is tested.
  apply_migrations
  start_candidate
  remove_candidate

  transaction_backup="$backend_live_container-pre-github-$run_id-$timestamp"
  transaction_active=1
  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_test_network "$backend_live_container"
  docker rename "$backend_live_container" "$transaction_backup"
  docker run -d \
    --name "$backend_live_container" \
    --network "$test_network" \
    --ip "$original_network_ip" \
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
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag" \
    "$database_migration_mode"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "deployment_environment=Test"
  echo "deployment_component=backend"
  echo "deployment_url=$test_url"
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
  echo "database_migrations=$database_migration_mode"
  echo "worker_actor_assertion=server-local"
  echo "frontend_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "production_touched=0"
  echo "TEST_BACKEND_DEPLOYMENT=PASS"
}

credential_cutover_backend() {
  validate_common_live_state
  [[ "$original_revision" == "$expected_current_revision" ]] \
    || blocked "current Test backend revision does not match the database-role cutover input"
  assert_candidate_port_available
  candidate_revision="$original_revision"
  new_image="$original_image_id"
  new_image_id="$original_image_id"
  database_migration_mode="none"
  write_environment_file "$backend_live_container" "$original_revision"
  start_candidate true false
  remove_candidate

  transaction_backup="$backend_live_container-pre-database-role-$run_id-$timestamp"
  transaction_active=1
  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_test_network "$backend_live_container"
  docker rename "$backend_live_container" "$transaction_backup"
  docker run -d \
    --name "$backend_live_container" \
    --network "$test_network" \
    --ip "$original_network_ip" \
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
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag" \
    "none"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "credential_environment=Test"
  echo "credential_component=backend"
  echo "application_revision_unchanged=$original_revision"
  echo "application_image_unchanged=$original_image_id"
  echo "rollback_container=$transaction_backup"
  echo "database=$database_name"
  echo "database_role=mfms_test_app"
  echo "database_migrations=none"
  echo "production_touched=0"
  echo "preview_touched=0"
  echo "TEST_DATABASE_ROLE_CUTOVER=PASS"
}

rollback_backend() {
  local deployed_revision deployed_image_id deployed_image_tag
  local rollback_container rollback_revision rollback_image_id rollback_image_tag replacement_id
  local rollback_database_migration_mode rollback_report_migration_mode
  [[ -f "$state_file" ]] || blocked "no successful Test backend deployment is recorded"
  validate_common_live_state
  [[ "$expected_current_revision" == "$original_revision" ]] \
    || blocked "current Test backend does not match the requested rollback revision"

  deployed_revision=$(read_state_value deployed_revision)
  deployed_image_id=$(read_state_value deployed_image_id)
  deployed_image_tag=$(read_state_value deployed_image_tag)
  rollback_container=$(read_state_value rollback_container)
  rollback_revision=$(read_state_value rollback_revision)
  rollback_image_id=$(read_state_value rollback_image_id)
  rollback_image_tag=$(read_state_value rollback_image_tag)
  rollback_database_migration_mode=$(read_state_value database_migrations)
  [[ "$rollback_database_migration_mode" == "none" || "$rollback_database_migration_mode" == "forward-only" ]] \
    || blocked "recorded backend migration mode is invalid"
  [[ "$deployed_revision" == "$original_revision" ]] \
    || blocked "current Test backend does not match recorded rollback state"
  [[ "$original_image_id" == "$deployed_image_id" ]] \
    || blocked "current Test backend image does not match recorded rollback state"
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
  start_candidate false false
  remove_candidate

  transaction_backup="$backend_live_container-pre-rollback-$run_id-$timestamp"
  replacement_origin="$rollback_container"
  transaction_active=1
  docker stop --time 30 "$backend_live_container" >/dev/null
  disconnect_test_network "$backend_live_container"
  docker rename "$backend_live_container" "$transaction_backup"
  docker rename "$rollback_container" "$backend_live_container"
  ensure_test_network_attachment "$backend_live_container" \
    || blocked "backend rollback could not attach to the Test network"
  docker start "$backend_live_container" >/dev/null
  replacement_id=$(docker inspect --format '{{.Image}}' "$backend_live_container")

  assert_live_contract "$rollback_revision" "$replacement_id" false false
  trap '' HUP INT TERM
  write_state \
    "$rollback_revision" "$replacement_id" "$rollback_image_tag" \
    "$transaction_backup" "$deployed_revision" "$deployed_image_id" "$deployed_image_tag" \
    "$rollback_database_migration_mode"
  transaction_active=0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "rollback_environment=Test"
  echo "rollback_component=backend"
  echo "rollback_url=$test_url"
  echo "previous_backend_revision=$deployed_revision"
  echo "restored_backend_revision=$rollback_revision"
  echo "rollback_container_retained=$transaction_backup"
  if [[ "$rollback_database_migration_mode" == "none" ]]; then
    rollback_report_migration_mode="none"
  else
    rollback_report_migration_mode="forward-only-not-reversed"
  fi
  echo "database_migrations=$rollback_report_migration_mode"
  echo "frontend_unchanged=true"
  echo "odk_unchanged=true"
  echo "schedules_unchanged=true"
  echo "proxy_configuration_unchanged=true"
  echo "production_touched=0"
  echo "TEST_BACKEND_ROLLBACK=PASS"
}

case "$operation" in
  deploy)
    deploy_backend
    ;;
  rollback)
    rollback_backend
    ;;
  credential-cutover)
    credential_cutover_backend
    ;;
esac
