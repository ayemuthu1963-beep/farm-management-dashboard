#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

blocked() {
  echo "TEST_RELEASE_BLOCKED=$1" >&2
  return 1
}

[[ $# -eq 0 ]] || blocked "arguments are not accepted"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Test SSH user is muthu"

for required_command in \
  awk cmp curl date docker flock git grep id install mktemp mv python3 rm sed \
  seq sha256sum sleep sort
do
  command -v "$required_command" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $required_command"
done

readonly repo_url="https://github.com/ayemuthu1963-beep/farm-management-dashboard.git"
readonly release_ref="refs/heads/test-release"
readonly live_container="mfms-test-web"
readonly bridge_container="mfms-test-upstream-bridge"
readonly test_network="harvest-net"
readonly test_url="https://test.muthufarms.com"
readonly central_login_url="https://auth.muthufarms.com/login"
readonly live_port="3018"
readonly bridge_port="3019"
readonly candidate_port="3020"
readonly expected_bridge_ip="172.19.0.14"
readonly expected_database="mfms_server_test"
readonly expected_odk_project="24"
readonly expected_odk_url="https://odk.muthufarms.com"
readonly state_dir="/home/muthu/.local/state/mfms-test-github"
readonly state_file="$state_dir/last-successful-frontend-switch"
readonly lock_file="$state_dir/deployment.lock"

[[ "$test_url" == "https://test.muthufarms.com" ]] \
  || blocked "the public target is not Test"

install -d -m 700 "$state_dir"
exec 9>"$lock_file"
flock -n 9 || blocked "another Test deployment, rollback, or rehearsal is running"

operation=""
candidate_revision=""
expected_current_revision=""
run_id=""
readonly preflight_pattern='^preflight-test ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9]+)$'
readonly deploy_pattern='^deploy-test ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9]+)$'
readonly rollback_pattern='^rollback-test ([0-9a-f]{40}) ([0-9]+)$'
readonly rehearsal_pattern='^rehearse-test-health-failure ([0-9a-f]{40}) ([0-9]+)$'

original_command=${SSH_ORIGINAL_COMMAND:-}
if [[ "$original_command" =~ $preflight_pattern ]]; then
  operation="preflight"
  candidate_revision=${BASH_REMATCH[1]}
  expected_current_revision=${BASH_REMATCH[2]}
  run_id=${BASH_REMATCH[3]}
elif [[ "$original_command" =~ $deploy_pattern ]]; then
  operation="deploy"
  candidate_revision=${BASH_REMATCH[1]}
  expected_current_revision=${BASH_REMATCH[2]}
  run_id=${BASH_REMATCH[3]}
elif [[ "$original_command" =~ $rollback_pattern ]]; then
  operation="rollback"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
elif [[ "$original_command" =~ $rehearsal_pattern ]]; then
  operation="rehearse-health-failure"
  expected_current_revision=${BASH_REMATCH[1]}
  run_id=${BASH_REMATCH[2]}
else
  blocked "the SSH key accepts only exact Test preflight, deploy, rollback, or rehearsal commands"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
work_dir=$(mktemp -d "$state_dir/work.XXXXXX")
source_dir="$work_dir/source"
raw_environment_file="$work_dir/frontend.raw.env"
environment_file="$work_dir/frontend.env"
before_unrelated="$work_dir/unrelated.before"
after_unrelated="$work_dir/unrelated.after"

candidate_container=""
transaction_backup=""
transaction_active=0
original_revision=""
original_image_id=""
original_image_tag=""
automatic_restore_result="not-required"
public_guard_result=""

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1")" == "true" ]]
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

network_ip_for_container() {
  docker inspect \
    --format "{{with index .NetworkSettings.Networks \"$test_network\"}}{{.IPAddress}}{{end}}" \
    "$1"
}

environment_value() {
  local file=$1 key=$2
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}' "$file"
}

capture_test_environment() {
  local container=$1 revision=$2 build_timestamp=$3
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
    > "$raw_environment_file"
  sed -E \
    '/^(MFMS_ENV|MFMS_GIT_COMMIT|MFMS_BUILD_TIMESTAMP|MFMS_BUILD_ENVIRONMENT|NEXT_PUBLIC_MFMS_ENV|NEXT_PUBLIC_MFMS_ENV_BANNER)=/d' \
    "$raw_environment_file" > "$environment_file"
  {
    printf 'MFMS_ENV=test\n'
    printf 'MFMS_GIT_COMMIT=%s\n' "$revision"
    printf 'MFMS_BUILD_TIMESTAMP=%s\n' "$build_timestamp"
    printf 'MFMS_BUILD_ENVIRONMENT=Test\n'
    printf 'NEXT_PUBLIC_MFMS_ENV=test\n'
    printf 'NEXT_PUBLIC_MFMS_ENV_BANNER=TEST / ACCEPTANCE - NOT PRODUCTION\n'
  } >> "$environment_file"
  chmod 600 "$environment_file"

  [[ "$(environment_value "$environment_file" MFMS_ENV)" == "test" ]] \
    || blocked "MFMS_ENV is not exactly test"
  [[ "$(environment_value "$environment_file" NEXT_PUBLIC_MFMS_ENV)" == "test" ]] \
    || blocked "NEXT_PUBLIC_MFMS_ENV is not exactly test"
  [[ "$(environment_value "$environment_file" MFMS_TARGET_DATABASE)" == "$expected_database" ]] \
    || blocked "MFMS_TARGET_DATABASE is not the exact Test database"
  [[ "$(environment_value "$environment_file" MFMS_LOCAL_WRITE_DATABASE)" == "$expected_database" ]] \
    || blocked "MFMS_LOCAL_WRITE_DATABASE is not the exact Test database"
  [[ "$(environment_value "$environment_file" NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL)" == "$expected_database" ]] \
    || blocked "the public database label is not the exact Test database"
  [[ "$(environment_value "$environment_file" NEXT_PUBLIC_ODK_PROJECT_ID)" == "$expected_odk_project" ]] \
    || blocked "the public ODK project is not the exact Test project"
  [[ "$(environment_value "$environment_file" NEXT_PUBLIC_ODK_CENTRAL_URL)" == "$expected_odk_url" ]] \
    || blocked "the public ODK URL is not the approved Test URL"

  for database_key in MFMS_TARGET_DATABASE MFMS_LOCAL_WRITE_DATABASE; do
    case "$(environment_value "$environment_file" "$database_key")" in
      mfms_server_prod|harvest|production|mfms_production|prod)
        blocked "a Production database alias is present in the Test runtime environment"
        ;;
    esac
  done
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
    docker inspect --format \
      '{{.Id}}|{{.Name}}|{{.Image}}|{{.State.Running}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}' \
      "$id"
  done | LC_ALL=C sort
}

wait_for_version() {
  local base_url=$1 expected_revision=$2 attempts=${3:-60} payload attempt
  for attempt in $(seq 1 "$attempts"); do
    if payload=$(curl -fsS --max-time 10 "$base_url/api/version" 2>/dev/null); then
      if python3 -c \
        'import json,sys; data=json.load(sys.stdin); raise SystemExit(0 if data.get("git_commit")==sys.argv[1] and data.get("environment")=="Test" else 1)' \
        "$expected_revision" <<<"$payload"; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

smoke_routes() {
  local base_url=$1
  curl -fsS --max-time 15 "$base_url/" >/dev/null
  curl -fsS --max-time 15 "$base_url/api/version" >/dev/null
}

wait_for_bridge() {
  local expected_revision=$1 attempt
  for attempt in $(seq 1 30); do
    if wait_for_version "http://127.0.0.1:$bridge_port" "$expected_revision" 1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_public_test_guard() {
  local headers status location attempt
  headers=$(mktemp "$work_dir/public-test-guard.XXXXXX")
  for attempt in $(seq 1 30); do
    : > "$headers"
    status=$(curl -sS -o /dev/null -D "$headers" -w '%{http_code}' --max-time 10 \
      "$test_url/api/version" 2>/dev/null || true)
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
      if [[ "$location" == "$central_login_url"* ]]; then
        public_guard_result="303-auth-redirect"
        rm -f "$headers"
        return 0
      fi
    fi
    sleep 2
  done
  rm -f "$headers"
  return 1
}

validate_common_live_state() {
  container_exists "$live_container" || blocked "the Test frontend container is missing"
  container_running "$live_container" || blocked "the Test frontend container is not running"
  container_exists "$bridge_container" || blocked "the Test-only upstream bridge is missing"
  container_running "$bridge_container" || blocked "the Test-only upstream bridge is not running"
  [[ "$(network_ip_for_container "$bridge_container")" == "$expected_bridge_ip" ]] \
    || blocked "the Test-only upstream bridge address changed"
  [[ "$(docker port "$live_container" 3000/tcp)" == "127.0.0.1:$live_port" ]] \
    || blocked "the Test frontend host port changed"
  [[ "$(docker port "$bridge_container" 3000/tcp)" == "127.0.0.1:$bridge_port" ]] \
    || blocked "the Test bridge diagnostic port changed"

  original_image_id=$(docker inspect --format '{{.Image}}' "$live_container")
  original_image_tag=$(docker inspect --format '{{.Config.Image}}' "$live_container")
  original_revision=$(image_revision_for_container "$live_container")
  [[ "$original_revision" =~ ^[0-9a-f]{40}$ ]] \
    || blocked "the live Test image has no exact revision label"
  [[ "$(image_environment_for_container "$live_container")" == "Test" ]] \
    || blocked "the live frontend image is not labelled Test"
  [[ -z "$expected_current_revision" || "$original_revision" == "$expected_current_revision" ]] \
    || blocked "the live Test revision differs from the approved current revision"

  capture_test_environment "$live_container" "$original_revision" "$timestamp"
  wait_for_version "http://127.0.0.1:$live_port" "$original_revision" 10 \
    || blocked "the local Test frontend identity check failed"
  wait_for_bridge "$original_revision" \
    || blocked "the Test-only upstream bridge identity check failed"
  wait_for_public_test_guard \
    || blocked "the public Test authentication guard is unavailable"
}

resolve_candidate() {
  local remote_release
  remote_release=$(git ls-remote "$repo_url" "$release_ref" | awk 'NR == 1 {print $1}')
  [[ "$remote_release" =~ ^[0-9a-f]{40}$ ]] \
    || blocked "test-release did not resolve to an exact revision"
  [[ "$remote_release" == "$candidate_revision" ]] \
    || blocked "candidate is not the exact test-release head"
}

checkout_candidate() {
  git clone --filter=blob:none --no-checkout "$repo_url" "$source_dir" >/dev/null 2>&1
  git -C "$source_dir" fetch --no-tags origin \
    "+$release_ref:refs/remotes/origin/test-release" >/dev/null 2>&1
  [[ "$(git -C "$source_dir" rev-parse refs/remotes/origin/test-release)" == "$candidate_revision" ]] \
    || blocked "cloned test-release head differs from approval"
  git -C "$source_dir" checkout --detach "$candidate_revision" >/dev/null 2>&1
  git -C "$source_dir" merge-base --is-ancestor "$original_revision" "$candidate_revision" \
    || blocked "candidate does not contain the live Test baseline"
  [[ -z "$(git -C "$source_dir" status --short)" ]] \
    || blocked "candidate checkout is not clean"
  [[ -f "$source_dir/Dockerfile.preview" ]] \
    || blocked "candidate does not contain the reviewed frontend Dockerfile"
}

start_candidate() {
  local image=$1 revision=$2 broken_environment=${3:-0}
  candidate_container="$live_container-candidate-$run_id-$timestamp"
  ! container_exists "$candidate_container" || blocked "candidate container already exists"
  if [[ "$broken_environment" -eq 1 ]]; then
    docker run -d \
      --name "$candidate_container" \
      --network "$test_network" \
      --restart no \
      -p "127.0.0.1:$candidate_port:3000" \
      --env-file "$environment_file" \
      -e MFMS_BUILD_ENVIRONMENT=HealthFailureRehearsal \
      "$image" >/dev/null
  else
    docker run -d \
      --name "$candidate_container" \
      --network "$test_network" \
      --restart no \
      -p "127.0.0.1:$candidate_port:3000" \
      --env-file "$environment_file" \
      "$image" >/dev/null
    wait_for_version "http://127.0.0.1:$candidate_port" "$revision" 60 \
      || blocked "candidate /api/version failed"
    smoke_routes "http://127.0.0.1:$candidate_port" \
      || blocked "candidate smoke test failed"
  fi
}

remove_candidate() {
  if [[ -n "$candidate_container" ]] && container_exists "$candidate_container"; then
    docker rm -f "$candidate_container" >/dev/null
  fi
  candidate_container=""
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
  [[ -f "$state_file" ]] || blocked "no successful guarded Test deployment is recorded"
  [[ "$(grep -Ec "^${key}=" "$state_file")" -eq 1 ]] \
    || blocked "rollback state key is invalid: $key"
  value=$(awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print}' "$state_file")
  printf '%s\n' "$value"
}

assert_unrelated_unchanged() {
  snapshot_unrelated_containers > "$after_unrelated"
  cmp -s "$before_unrelated" "$after_unrelated" \
    || blocked "a non-Test-frontend container changed during the operation"
}

restore_original_on_failure() {
  set +e
  if [[ "$transaction_active" -eq 1 ]]; then
    if container_exists "$live_container"; then
      docker rm -f "$live_container" >/dev/null 2>&1
    fi
    if [[ -n "$transaction_backup" ]] && container_exists "$transaction_backup"; then
      docker rename "$transaction_backup" "$live_container" >/dev/null 2>&1
      docker start "$live_container" >/dev/null 2>&1
      if wait_for_version "http://127.0.0.1:$live_port" "$original_revision" 30 \
        && wait_for_bridge "$original_revision"; then
        automatic_restore_result="PASS"
      else
        automatic_restore_result="FAILED"
      fi
    fi
    echo "TEST_AUTOMATIC_RESTORE=$automatic_restore_result" >&2
  fi
  set -e
}

on_exit() {
  local status=$?
  trap - EXIT
  remove_candidate || true
  if [[ "$status" -ne 0 ]]; then
    restore_original_on_failure || true
  fi
  rm -rf "$work_dir"
  exit "$status"
}
trap on_exit EXIT

run_preflight() {
  resolve_candidate
  validate_common_live_state
  snapshot_unrelated_containers > "$before_unrelated"
  assert_unrelated_unchanged
  echo "preflight_environment=Test"
  echo "preflight_url=$test_url"
  echo "current_revision=$original_revision"
  echo "candidate_revision=$candidate_revision"
  echo "database_identity=$expected_database"
  echo "bridge_identity=$bridge_container@$expected_bridge_ip"
  echo "production_touched=0"
  echo "TEST_PREFLIGHT=PASS"
}

deploy_test() {
  local new_image new_image_id
  resolve_candidate
  validate_common_live_state
  snapshot_unrelated_containers > "$before_unrelated"
  checkout_candidate

  new_image="mfms-dashboard:test-${candidate_revision:0:8}-$timestamp"
  docker build \
    --pull=false \
    --file "$source_dir/Dockerfile.preview" \
    --build-arg "MFMS_GIT_COMMIT=$candidate_revision" \
    --build-arg "MFMS_BUILD_TIMESTAMP=$timestamp" \
    --build-arg "MFMS_BUILD_ENVIRONMENT=Test" \
    --build-arg "NEXT_PUBLIC_MFMS_ENV=test" \
    --build-arg "NEXT_PUBLIC_MFMS_ENV_BANNER=TEST / ACCEPTANCE - NOT PRODUCTION" \
    --build-arg "NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=$expected_database" \
    --build-arg "NEXT_PUBLIC_ODK_PROJECT_ID=$expected_odk_project" \
    --build-arg "NEXT_PUBLIC_ODK_CENTRAL_URL=$expected_odk_url" \
    --tag "$new_image" \
    "$source_dir" >/dev/null
  new_image_id=$(docker image inspect --format '{{.Id}}' "$new_image")
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$new_image")" == "$candidate_revision" ]] \
    || blocked "built image revision label is invalid"
  [[ "$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$new_image")" == "Test" ]] \
    || blocked "built image is not labelled Test"

  capture_test_environment "$live_container" "$candidate_revision" "$timestamp"
  start_candidate "$new_image" "$candidate_revision"
  remove_candidate

  transaction_backup="$live_container-pre-github-$run_id-$timestamp"
  ! container_exists "$transaction_backup" || blocked "transaction backup already exists"
  transaction_active=1
  docker stop --time 30 "$live_container" >/dev/null
  docker rename "$live_container" "$transaction_backup"
  docker run -d \
    --name "$live_container" \
    --network "$test_network" \
    --restart unless-stopped \
    -p "127.0.0.1:$live_port:3000" \
    --env-file "$environment_file" \
    "$new_image" >/dev/null

  wait_for_version "http://127.0.0.1:$live_port" "$candidate_revision" 60 \
    || blocked "replacement /api/version failed"
  smoke_routes "http://127.0.0.1:$live_port" \
    || blocked "replacement local smoke test failed"
  wait_for_bridge "$candidate_revision" \
    || blocked "replacement did not become healthy through the Test-only bridge"
  wait_for_public_test_guard \
    || blocked "public Test authentication guard failed"
  assert_unrelated_unchanged

  write_state \
    "$candidate_revision" "$new_image_id" "$new_image" \
    "$transaction_backup" "$original_revision" "$original_image_id" "$original_image_tag"
  transaction_active=0

  echo "deployment_environment=Test"
  echo "deployment_url=$test_url"
  echo "public_test_guard=$public_guard_result"
  echo "previous_revision=$original_revision"
  echo "deployed_revision=$candidate_revision"
  echo "deployed_image_id=$new_image_id"
  echo "rollback_container=$transaction_backup"
  echo "database_identity=$expected_database"
  echo "shared_proxy_unchanged=true"
  echo "other_containers_unchanged=true"
  echo "production_touched=0"
  echo "TEST_DEPLOYMENT=PASS"
}

rollback_test() {
  local deployed_revision deployed_image_id deployed_image_tag
  local rollback_container rollback_revision rollback_image_id rollback_image_tag
  local restored_id

  validate_common_live_state
  snapshot_unrelated_containers > "$before_unrelated"
  deployed_revision=$(read_state_value deployed_revision)
  deployed_image_id=$(read_state_value deployed_image_id)
  deployed_image_tag=$(read_state_value deployed_image_tag)
  rollback_container=$(read_state_value rollback_container)
  rollback_revision=$(read_state_value rollback_revision)
  rollback_image_id=$(read_state_value rollback_image_id)
  rollback_image_tag=$(read_state_value rollback_image_tag)

  [[ "$deployed_revision" == "$expected_current_revision" && "$original_revision" == "$deployed_revision" ]] \
    || blocked "current Test does not match the recorded rollback state"
  [[ "$original_image_id" == "$deployed_image_id" ]] \
    || blocked "current Test image differs from the recorded deployment"
  [[ "$rollback_revision" =~ ^[0-9a-f]{40}$ ]] \
    || blocked "recorded rollback revision is invalid"
  [[ "$rollback_image_id" =~ ^sha256:[0-9a-f]{64}$ ]] \
    || blocked "recorded rollback image ID is invalid"
  [[ "$rollback_container" =~ ^mfms-test-web-pre-(github|rollback)-[0-9]+-[0-9]{8}T[0-9]{6}Z$ ]] \
    || blocked "recorded rollback container name is invalid"
  container_exists "$rollback_container" || blocked "recorded rollback container is missing"
  ! container_running "$rollback_container" || blocked "recorded rollback container is running"
  [[ "$(docker inspect --format '{{.Image}}' "$rollback_container")" == "$rollback_image_id" ]] \
    || blocked "recorded rollback container image changed"

  capture_test_environment "$live_container" "$rollback_revision" "$timestamp"
  start_candidate "$rollback_image_id" "$rollback_revision"
  remove_candidate

  transaction_backup="$live_container-pre-rollback-$run_id-$timestamp"
  ! container_exists "$transaction_backup" || blocked "rollback transaction backup already exists"
  transaction_active=1
  docker stop --time 30 "$live_container" >/dev/null
  docker rename "$live_container" "$transaction_backup"
  docker run -d \
    --name "$live_container" \
    --network "$test_network" \
    --restart unless-stopped \
    -p "127.0.0.1:$live_port:3000" \
    --env-file "$environment_file" \
    "$rollback_image_id" >/dev/null

  wait_for_version "http://127.0.0.1:$live_port" "$rollback_revision" 60 \
    || blocked "rollback replacement /api/version failed"
  smoke_routes "http://127.0.0.1:$live_port" \
    || blocked "rollback replacement smoke test failed"
  wait_for_bridge "$rollback_revision" \
    || blocked "rollback replacement failed through the Test-only bridge"
  wait_for_public_test_guard \
    || blocked "public Test rollback authentication guard failed"
  assert_unrelated_unchanged

  restored_id=$(docker inspect --format '{{.Image}}' "$live_container")
  write_state \
    "$rollback_revision" "$restored_id" "$rollback_image_tag" \
    "$transaction_backup" "$deployed_revision" "$deployed_image_id" "$deployed_image_tag"
  transaction_active=0
  docker rm "$rollback_container" >/dev/null

  echo "rollback_environment=Test"
  echo "rollback_url=$test_url"
  echo "public_test_guard=$public_guard_result"
  echo "previous_revision=$deployed_revision"
  echo "restored_revision=$rollback_revision"
  echo "rollback_container_retained=$transaction_backup"
  echo "database_identity=$expected_database"
  echo "shared_proxy_unchanged=true"
  echo "other_containers_unchanged=true"
  echo "production_touched=0"
  echo "TEST_ROLLBACK=PASS"
}

rehearse_health_failure() {
  validate_common_live_state
  snapshot_unrelated_containers > "$before_unrelated"
  capture_test_environment "$live_container" "$original_revision" "$timestamp"
  start_candidate "$original_image_id" "$original_revision" 1
  if wait_for_version "http://127.0.0.1:$candidate_port" "$original_revision" 5; then
    blocked "deliberately invalid candidate unexpectedly passed the Test identity check"
  fi
  remove_candidate
  assert_unrelated_unchanged
  wait_for_bridge "$original_revision" \
    || blocked "live Test changed during the failed-health-check rehearsal"
  echo "rehearsal_environment=Test"
  echo "rehearsal_failure=candidate-environment-identity"
  echo "live_revision_unchanged=$original_revision"
  echo "database_identity=$expected_database"
  echo "production_touched=0"
  echo "TEST_HEALTH_FAILURE_REHEARSAL=PASS"
}

case "$operation" in
  preflight) run_preflight ;;
  deploy) deploy_test ;;
  rollback) rollback_test ;;
  rehearse-health-failure) rehearse_health_failure ;;
esac
