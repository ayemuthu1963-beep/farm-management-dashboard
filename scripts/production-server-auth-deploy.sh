#!/usr/bin/env bash
#
# One-attempt Production auth controller for the reviewed Intelligence release.
# It is intentionally bound to one current container, one target image/revision,
# and one semantic-session transition.  It never builds an image or changes
# Nginx, databases, application containers, users, roles, or credentials.
#
set -Eeuo pipefail

umask 077

blocked() {
  echo "PRODUCTION_AUTH_DEPLOY_BLOCKED=$1" >&2
  return 1
}

[[ $# -eq 1 ]] || blocked "exactly one operation is required"
readonly operation=$1
[[ "$operation" == validate || "$operation" == deploy || "$operation" == rollback ]] \
  || blocked "operation must be validate, deploy, or rollback"
[[ "$(id -u)" -ne 0 ]] || blocked "root execution is prohibited"
[[ "$(id -un)" == muthu ]] || blocked "the approved Production account is muthu"

for command_name in \
  awk bash cat chmod chown cmp curl date docker flock grep id install jq mkdir \
  mv python3 rm sed seq sha256sum sleep stat wc
do
  command -v "$command_name" >/dev/null 2>&1 \
    || blocked "required command is unavailable: $command_name"
done

readonly live_container=mfms-auth
readonly candidate_container=mfms-auth-candidate-intelligence-922d4b30-attempt2
readonly prior_failed_container=mfms-auth-failed-aa1a345-20260915T115331Z
readonly prior_failed_id=27def50df4076e9f53016733192828c1679d3a74224737fd39642b032362afee
readonly current_container_id=894a61c5f6302e183ca95c193e41538e7554b85546f4c0020262b33c787b8f83
readonly current_image=sha256:4d7cb4c30ecc7a2e974674b5b0bbe816d8dc59aebfc1addc69873b8ae47caaab
readonly current_revision=79cf46e75fcca318a136a1e1c7fe173de6dc3026
readonly target_image=sha256:359398ec487f58763b560435ea05e49ad813fe3f6958f7d0cecc48840d93a972
readonly target_revision=aa1a345e4946038eb0a3cba7d9e626fe4f21c46c
readonly target_merge=922d4b30f3e4724475d7b7010fe5ac295fc3c948
readonly target_tree=373c45d73f11a353550f4d64ca7aca16839d2a98
readonly production_network=harvest-net
readonly production_ip=172.19.128.2
readonly preview_container=mfms-auth-preview
readonly preview_id=f28448290a62dec3d9fe2d6d36b54e7a0328b9d81ae42317d7671380a002ad3e
readonly nginx_container=central-nginx-1
readonly nginx_id=2a8b67f1de23a44510f6d6906af7eae5e7e53fd7c17506b0cc0be623f67bb23a
readonly nginx_image=sha256:bec890a488322edffce9d88a98103ca68ba9fc865c528fc3b2fa1ec13ff92091
readonly nginx_effective_sha=6a2dc3abc45a94d099e929b0878cce451874155d1168f80d4d6494a2b76784e9
readonly production_auth_include_sha=4f51ccb9d1c6f7bbb5fbc06cf5e190a8e505ad4a74c3259fa67996ffa62447b3
readonly preview_auth_include_sha=134a306a48014a14a216ecfbd82edfd36d7b4b174a22c119c252baf2d59d8ba9
readonly data_dir=/home/muthu/mfms_data/auth
readonly users_file=$data_dir/users.json
readonly sessions_file=$data_dir/sessions.json
readonly audit_file=$data_dir/audit.jsonl
readonly users_sha=0bf0e35e8bd76c3cc29d99cc8d9f08022fa8eb68c4a4017b649c1049a88f0571
readonly request_secret=/home/muthu/mfms_secrets/auth-phase6-20260808T150451Z/auth-request-secret
readonly vault_secret=/home/muthu/mfms_secrets/auth-rich-admin/password-vault-key
readonly signing_secret=/home/muthu/mfms_secrets/auth-production-intelligence-aa1a345-20260915/browser-session-signing-key
readonly session_guard=/home/muthu/.local/libexec/mfms-production-auth-session-guard
readonly expected_session_guard_sha=e8afb4bb0dcb41d71dcafdc83609cc65ba7241ebdb8de8ad1042191f4aedb386
readonly state_root=/home/muthu/.local/state/mfms-auth-deployments
readonly state_dir=$state_root/intelligence-access-922d4b30-semantic-attempt2
readonly release_state=$state_dir/release.env
readonly deployment_lock=/home/muthu/.local/state/mfms-production-github/deployment.lock
readonly auth_lock=$state_root/deployment.lock
readonly prior_state=/home/muthu/.local/state/mfms-auth-deployments/intelligence-access-aa1a345-20260915
readonly prior_deploy_script=/home/muthu/.local/state/mfms-auth-deployments/deploy-production-auth-aa1a345.sh
readonly prior_deploy_script_sha=1cfe08fb9a075064d729aab56ae4f5ca3762e709934d8efbf365b7305ff65fe8
readonly prior_release_sha=c61ccba7732d34d5bbfdce6284e3268f5e6ff52667e6195c4f789087aca701dc
readonly prior_rollback_sha=8d4da7b36c286ff5cf7afcc08f6bfe8d0b64fa2d0ef2f5ec3c25e32e5bbe6ca1
readonly idle_ms=43200000

container_revision() {
  docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$1"
}

container_env() {
  local container=$1 key=$2
  docker inspect "$container" | jq -r --arg key "$key" \
    '.[0].Config.Env | map(select(startswith($key + "="))) | if length == 1 then .[0] | split("=")[1:] | join("=") else "" end'
}

assert_file_contract() {
  local path=$1 label=$2
  [[ -f "$path" && ! -L "$path" ]] || blocked "$label is unavailable"
  [[ "$(stat -c '%a|%U:%G' "$path")" == '600|muthu:muthu' ]] \
    || blocked "$label permissions drifted"
}

assert_prior_failure_evidence() {
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Status}}|{{.State.ExitCode}}|{{.RestartCount}}' "$prior_failed_container")" \
      == "$prior_failed_id|$target_image|exited|0|0" ]] \
    || blocked "the retained prior failed candidate drifted"
  [[ "$(container_revision "$prior_failed_container")" == "$target_revision" ]] \
    || blocked "the retained prior failed candidate revision drifted"
  [[ "$(docker inspect "$prior_failed_container" | jq -r '.[0].NetworkSettings.Networks|length')" == 0 ]] \
    || blocked "the retained prior failed candidate network state drifted"
  [[ "$(sha256sum "$prior_deploy_script" | awk '{print $1}')" == "$prior_deploy_script_sha" ]] \
    || blocked "the retained prior deployment script drifted"
  [[ "$(sha256sum "$prior_state/release.env" | awk '{print $1}')" == "$prior_release_sha" ]] \
    || blocked "the retained prior release evidence drifted"
  [[ "$(sha256sum "$prior_state/rollback-production-auth.sh" | awk '{print $1}')" == "$prior_rollback_sha" ]] \
    || blocked "the retained prior rollback evidence drifted"
}

assert_shared_invariants() {
  [[ "$(docker image inspect --format '{{.Id}}' "$target_image")" == "$target_image" ]] \
    || blocked "the tested target image is unavailable"
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$target_image")" == "$target_revision" ]] \
    || blocked "the tested target image revision is wrong"
  [[ "$(sha256sum "$session_guard" | awk '{print $1}')" == "$expected_session_guard_sha" ]] \
    || blocked "the installed semantic session guard is not the reviewed file"
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}' "$preview_container")" \
      == "$preview_id|$target_image|healthy|0" ]] \
    || blocked "Preview auth identity or health drifted"
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}' "$nginx_container")" \
      == "$nginx_id|$nginx_image|healthy|0" ]] \
    || blocked "Nginx identity or health drifted"
  # nginx writes diagnostics to stderr and the effective configuration to stdout.
  # Docker's multiplexing may reorder the two streams, so hash stdout only.
  [[ "$(docker exec "$nginx_container" nginx -T 2>/dev/null | sha256sum | awk '{print $1}')" == "$nginx_effective_sha" ]] \
    || blocked "effective Nginx configuration drifted"
  [[ "$(docker exec "$nginx_container" sha256sum /etc/nginx/auth/mfms-auth-server.conf | awk '{print $1}')" == "$production_auth_include_sha" ]] \
    || blocked "Production auth routing drifted"
  [[ "$(docker exec "$nginx_container" sha256sum /etc/nginx/auth/mfms-auth-preview-server.conf | awk '{print $1}')" == "$preview_auth_include_sha" ]] \
    || blocked "Preview auth routing drifted"
  [[ "$(sha256sum "$users_file" | awk '{print $1}')" == "$users_sha" ]] \
    || blocked "Production user store drifted"
  for path in "$users_file" "$sessions_file" "$audit_file"; do
    assert_file_contract "$path" "Production auth store"
  done
  for path in "$request_secret" "$vault_secret" "$signing_secret"; do
    assert_file_contract "$path" "Production auth secret"
  done
  [[ "$(wc -c < "$signing_secret")" -ge 48 ]] \
    || blocked "Production browser signing key is too short"
  assert_prior_failure_evidence
}

assert_current_auth() {
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}' "$live_container")" \
      == "$current_container_id|$current_image|running|healthy|0" ]] \
    || blocked "current Production auth identity or health drifted"
  [[ "$(container_revision "$live_container")" == "$current_revision" ]] \
    || blocked "current Production auth revision drifted"
  [[ "$(docker inspect "$live_container" | jq -r '.[0].NetworkSettings.Networks["harvest-net"].IPAddress')" == "$production_ip" ]] \
    || blocked "current Production auth network address drifted"
  [[ "$(docker inspect "$live_container" | jq -c '.[0].Mounts|map({Type,Source,Destination,RW})|sort_by(.Destination,.Source,.Type,.RW)')" \
      == '[{"Type":"bind","Source":"/home/muthu/mfms_data/auth","Destination":"/data","RW":true},{"Type":"bind","Source":"/home/muthu/mfms_secrets/auth-phase6-20260808T150451Z/auth-request-secret","Destination":"/run/secrets/auth-request-secret","RW":false},{"Type":"bind","Source":"/home/muthu/mfms_secrets/auth-rich-admin/password-vault-key","Destination":"/run/secrets/password-vault-key","RW":false}]' ]] \
    || blocked "current Production auth mounts drifted"
}

assert_target_auth() {
  local container=$1 expected_network=$2
  [[ "$(docker inspect --format '{{.Image}}|{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}' "$container")" \
      == "$target_image|running|healthy|0" ]] \
    || blocked "target Production auth identity or health drifted"
  [[ "$(container_revision "$container")" == "$target_revision" ]] \
    || blocked "target Production auth revision drifted"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.LogConfig.Type}}|{{index .HostConfig.LogConfig.Config "max-size"}}|{{index .HostConfig.LogConfig.Config "max-file"}}' "$container")" \
      == 'unless-stopped|json-file|20m|5' ]] \
    || blocked "target Production auth runtime policy drifted"
  [[ "$(docker inspect "$container" | jq -c '.[0].Mounts|map({Type,Source,Destination,RW})|sort_by(.Destination,.Source,.Type,.RW)')" \
      == '[{"Type":"bind","Source":"/home/muthu/mfms_data/auth","Destination":"/data","RW":true},{"Type":"bind","Source":"/home/muthu/mfms_secrets/auth-phase6-20260808T150451Z/auth-request-secret","Destination":"/run/secrets/auth-request-secret","RW":false},{"Type":"bind","Source":"/home/muthu/mfms_secrets/auth-production-intelligence-aa1a345-20260915/browser-session-signing-key","Destination":"/run/secrets/browser-session-signing-key","RW":false},{"Type":"bind","Source":"/home/muthu/mfms_secrets/auth-rich-admin/password-vault-key","Destination":"/run/secrets/password-vault-key","RW":false}]' ]] \
    || blocked "target Production auth mounts drifted"
  while IFS='=' read -r key value; do
    [[ "$(container_env "$container" "$key")" == "$value" ]] \
      || blocked "target Production auth environment drifted"
  done <<'ENVIRONMENT'
AUTH_DATA_DIR=/data
AUTH_PUBLIC_HOST=auth.muthufarms.com
AUTH_ADMIN_HOST=admin.muthufarms.com
AUTH_COOKIE_DOMAIN=muthufarms.com
AUTH_SESSION_COOKIE_NAME=__Secure-mfms_session
AUTH_LOGIN_CSRF_COOKIE_NAME=__Host-mfms_login_csrf
AUTH_SESSION_SIGNING_KEY_FILE=/run/secrets/browser-session-signing-key
AUTH_SESSION_ISSUER=mfms-auth-production
AUTH_SESSION_AUDIENCE=mfms-production
AUTH_SESSION_ENVIRONMENT=production
AUTH_ACCEPT_LEGACY_PRODUCTION_SESSIONS=true
AUTH_LEGACY_PRODUCTION_DATA_DIR=/data
AUTH_REQUEST_SECRET_FILE=/run/secrets/auth-request-secret
AUTH_PASSWORD_VAULT_KEY_FILE=/run/secrets/password-vault-key
AUTH_OWNER_PASSWORD_REVEAL_ENABLED=true
SESSION_IDLE_HOURS=12
SESSION_ABSOLUTE_DAYS=7
ENVIRONMENT
  [[ "$(docker inspect "$container" | jq -r '.[0].NetworkSettings.Networks|keys|join(",")')" == "$expected_network" ]] \
    || blocked "target Production auth network scope drifted"
  if [[ "$expected_network" == "$production_network" ]]; then
    [[ "$(docker inspect "$container" | jq -r '.[0].NetworkSettings.Networks["harvest-net"].IPAddress')" == "$production_ip" ]] \
      || blocked "target Production auth network address drifted"
  fi
}

assert_no_attempt_state() {
  [[ ! -e "$state_dir" ]] || blocked "the one-time semantic auth attempt was already consumed"
  [[ ! $(docker ps -a --format '{{.Names}}') =~ (^|[[:space:]])${candidate_container}($|[[:space:]]) ]] \
    || blocked "the fresh candidate name is already in use"
}

write_release_state() {
  local rollback_name=$1 t0=$2
  cat > "$release_state" <<STATE
ATTEMPT_STATUS=started
CURRENT_CONTAINER_ID=$current_container_id
CURRENT_IMAGE=$current_image
CURRENT_REVISION=$current_revision
TARGET_IMAGE=$target_image
TARGET_REVISION=$target_revision
TARGET_MERGE=$target_merge
TARGET_TREE=$target_tree
ROLLBACK_NAME=$rollback_name
T0_UTC=$t0
STATE
  chmod 600 "$release_state"
}

mark_attempt() {
  local status=$1
  sed -i "s/^ATTEMPT_STATUS=.*/ATTEMPT_STATUS=$status/" "$release_state"
}

wait_for_health() {
  local container=$1
  for _ in $(seq 1 60); do
    local status
    status=$(docker inspect --format '{{.State.Health.Status}}' "$container")
    [[ "$status" == healthy ]] && return 0
    [[ "$status" == unhealthy ]] && return 1
    sleep 1
  done
  return 1
}

start_isolated_candidate() {
  docker run -d \
    --name "$candidate_container" \
    --network none \
    --restart unless-stopped \
    --log-driver json-file --log-opt max-size=20m --log-opt max-file=5 \
    --label org.opencontainers.image.revision="$target_revision" \
    --label mfms.production-auth-attempt=semantic-922d4b30-attempt2 \
    -e NODE_ENV=production -e PORT=8090 -e AUTH_DATA_DIR=/data \
    -e AUTH_PUBLIC_HOST=auth.muthufarms.com -e AUTH_ADMIN_HOST=admin.muthufarms.com \
    -e AUTH_COOKIE_DOMAIN=muthufarms.com \
    -e AUTH_SESSION_COOKIE_NAME=__Secure-mfms_session \
    -e AUTH_LOGIN_CSRF_COOKIE_NAME=__Host-mfms_login_csrf \
    -e AUTH_SESSION_SIGNING_KEY_FILE=/run/secrets/browser-session-signing-key \
    -e AUTH_SESSION_ISSUER=mfms-auth-production -e AUTH_SESSION_AUDIENCE=mfms-production \
    -e AUTH_SESSION_ENVIRONMENT=production \
    -e AUTH_ACCEPT_LEGACY_PRODUCTION_SESSIONS=true \
    -e AUTH_LEGACY_PRODUCTION_DATA_DIR=/data \
    -e AUTH_REQUEST_SECRET_FILE=/run/secrets/auth-request-secret \
    -e AUTH_PASSWORD_VAULT_KEY_FILE=/run/secrets/password-vault-key \
    -e AUTH_OWNER_PASSWORD_REVEAL_ENABLED=true \
    -e SESSION_IDLE_HOURS=12 -e SESSION_ABSOLUTE_DAYS=7 \
    -v "$data_dir:/data" \
    -v "$request_secret:/run/secrets/auth-request-secret:ro" \
    -v "$vault_secret:/run/secrets/password-vault-key:ro" \
    -v "$signing_secret:/run/secrets/browser-session-signing-key:ro" \
    "$target_image" >/dev/null
}

restore_original_auth() {
  local rollback_name=$1
  set +e
  local rollback_ok=1
  local failed_source=
  if docker ps -a --format '{{.Names}}' | grep -qx "$candidate_container"; then
    failed_source=$candidate_container
  elif docker ps -a --format '{{.Names}}' | grep -qx "$live_container" \
    && [[ "$(docker inspect --format '{{.Image}}' "$live_container" 2>/dev/null)" == "$target_image" ]]; then
    failed_source=$live_container
  fi
  if [[ -n "$failed_source" ]]; then
    docker stop --time 30 "$failed_source" >/dev/null 2>&1 || rollback_ok=0
    docker network disconnect "$production_network" "$failed_source" >/dev/null 2>&1 || true
    local failed_name="mfms-auth-failed-semantic-922d4b30-$(date -u +%Y%m%dT%H%M%SZ)"
    docker rename "$failed_source" "$failed_name" >/dev/null 2>&1 || rollback_ok=0
  fi
  if [[ -f "$state_dir/manifest.json" && -f "$state_dir/sessions.t0.backup" ]]; then
    python3 "$session_guard" restore --sessions "$sessions_file" --state "$state_dir" >/dev/null 2>&1 || rollback_ok=0
  fi
  if docker ps -a --format '{{.Names}}' | grep -qx "$rollback_name"; then
    docker rename "$rollback_name" "$live_container" >/dev/null 2>&1 || rollback_ok=0
    docker network connect --ip "$production_ip" "$production_network" "$live_container" >/dev/null 2>&1 || rollback_ok=0
    docker start "$live_container" >/dev/null 2>&1 || rollback_ok=0
    wait_for_health "$live_container" || rollback_ok=0
  elif docker ps -a --format '{{.Names}}' | grep -qx "$live_container" \
    && [[ "$(docker inspect --format '{{.Image}}' "$live_container" 2>/dev/null)" == "$current_image" ]]; then
    docker network connect --ip "$production_ip" "$production_network" "$live_container" >/dev/null 2>&1 || true
    docker start "$live_container" >/dev/null 2>&1 || rollback_ok=0
    wait_for_health "$live_container" || rollback_ok=0
  else
    rollback_ok=0
  fi
  [[ -f "$release_state" ]] && mark_attempt failed >/dev/null 2>&1 || true
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}' "$live_container" 2>/dev/null)" \
      == "$current_container_id|$current_image|healthy|0" ]] || rollback_ok=0
  [[ "$(container_revision "$live_container" 2>/dev/null)" == "$current_revision" ]] || rollback_ok=0
  (set -e; assert_prior_failure_evidence) >/dev/null 2>&1 || rollback_ok=0
  if [[ "$rollback_ok" -eq 1 ]]; then
    echo PRODUCTION_AUTH_AUTOMATIC_ROLLBACK=PASS >&2
  else
    echo PRODUCTION_AUTH_AUTOMATIC_ROLLBACK=FAILED >&2
  fi
  set -e
  return "$((1 - rollback_ok))"
}

deploy_production_auth() {
  assert_no_attempt_state
  assert_shared_invariants
  assert_current_auth
  install -d -m 700 "$state_dir"
  local rollback_name="mfms-auth-pre-semantic-922d4b30-$(date -u +%Y%m%dT%H%M%SZ)"
  local transaction_active=0
  local t0_utc t0_ms observed_ms
  write_release_state "$rollback_name" pending

  rollback_on_error() {
    local status=$?
    if [[ "$transaction_active" -eq 1 ]]; then
      restore_original_auth "$rollback_name" || true
    else
      mark_attempt failed >/dev/null 2>&1 || true
    fi
    exit "$status"
  }
  trap rollback_on_error ERR

  transaction_active=1
  docker stop --time 30 "$live_container" >/dev/null
  docker network disconnect "$production_network" "$live_container"
  docker rename "$live_container" "$rollback_name"

  t0_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  t0_ms=$(date -u +%s%3N)
  sed -i "s/^T0_UTC=.*/T0_UTC=$t0_utc/" "$release_state"
  python3 "$session_guard" snapshot \
    --sessions "$sessions_file" --users "$users_file" --audit "$audit_file" \
    --state "$state_dir" --cutoff-ms "$t0_ms" --idle-ms "$idle_ms" \
    --require-active-user harsha

  start_isolated_candidate
  wait_for_health "$candidate_container" \
    || blocked "the fresh isolated auth candidate did not become healthy"
  assert_target_auth "$candidate_container" none

  observed_ms=$(date -u +%s%3N)
  python3 "$session_guard" compare \
    --sessions "$sessions_file" --users "$users_file" --audit "$audit_file" \
    --state "$state_dir" --observed-ms "$observed_ms"
  [[ "$(sha256sum "$users_file" | awk '{print $1}')" == "$users_sha" ]] \
    || blocked "Production users changed during guarded startup"
  assert_prior_failure_evidence

  docker network disconnect none "$candidate_container"
  docker rename "$candidate_container" "$live_container"
  docker network connect --ip "$production_ip" "$production_network" "$live_container"
  assert_target_auth "$live_container" "$production_network"
  [[ "$(curl -fsS -o /dev/null -w '%{http_code}' https://auth.muthufarms.com/login)" == 200 ]] \
    || blocked "public Production login failed"
  [[ "$(curl -sS -o /dev/null -w '%{http_code}' https://muthufarms.com/)" == 303 ]] \
    || blocked "public Production authentication guard failed"
  assert_shared_invariants
  [[ "$(docker inspect --format '{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}' "$rollback_name")" \
      == "$current_image|healthy|0" || \
      "$(docker inspect --format '{{.Image}}|{{.State.Status}}|{{.RestartCount}}' "$rollback_name")" \
      == "$current_image|exited|0" ]] \
    || blocked "retained original auth rollback container is invalid"
  mark_attempt passed
  transaction_active=0
  trap - ERR
  echo "PRODUCTION_AUTH_REVISION=$target_revision"
  echo "PRODUCTION_AUTH_IMAGE=$target_image"
  echo "PRODUCTION_AUTH_ROLLBACK_CONTAINER=$rollback_name"
  echo "PRODUCTION_AUTH_TARGET_MERGE=$target_merge"
  echo "PRODUCTION_AUTH_TARGET_TREE=$target_tree"
  echo PRODUCTION_AUTH_SEMANTIC_SESSION_GUARD=PASS
  echo PRODUCTION_AUTH_DEPLOY=PASS
  echo PREVIEW_AUTH_UNCHANGED=YES
  echo NGINX_CHANGED=0
  echo DATABASE_CHANGED=0
}

rollback_production_auth() {
  [[ -f "$release_state" && ! -L "$release_state" ]] \
    || blocked "semantic auth release state is unavailable"
  # shellcheck disable=SC1090
  source "$release_state"
  [[ "$ATTEMPT_STATUS" == passed ]] || blocked "semantic auth release did not complete"
  [[ "$CURRENT_CONTAINER_ID" == "$current_container_id" && "$CURRENT_IMAGE" == "$current_image" && \
      "$CURRENT_REVISION" == "$current_revision" && "$TARGET_IMAGE" == "$target_image" && \
      "$TARGET_REVISION" == "$target_revision" && "$TARGET_MERGE" == "$target_merge" && \
      "$TARGET_TREE" == "$target_tree" ]] \
    || blocked "semantic auth release state is not the reviewed release"
  [[ "$ROLLBACK_NAME" =~ ^mfms-auth-pre-semantic-922d4b30-[0-9]{8}T[0-9]{6}Z$ ]] \
    || blocked "semantic auth rollback name is invalid"
  [[ "$(docker inspect --format '{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}' "$live_container")" \
      == "$target_image|healthy|0" ]] \
    || blocked "current auth is not the exact forward release"
  [[ "$(container_revision "$live_container")" == "$target_revision" ]] \
    || blocked "current auth revision is not the exact forward release"
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Status}}|{{.RestartCount}}' "$ROLLBACK_NAME")" \
      == "$current_container_id|$current_image|exited|0" ]] \
    || blocked "exact original auth rollback source is unavailable"
  assert_shared_invariants

  local forward_name="mfms-auth-forward-922d4b30-$(date -u +%Y%m%dT%H%M%SZ)"
  docker stop --time 30 "$live_container" >/dev/null
  docker network disconnect "$production_network" "$live_container"
  docker rename "$live_container" "$forward_name"
  docker rename "$ROLLBACK_NAME" "$live_container"
  docker network connect --ip "$production_ip" "$production_network" "$live_container"
  docker start "$live_container" >/dev/null
  wait_for_health "$live_container" || blocked "original Production auth rollback did not become healthy"
  [[ "$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}' "$live_container")" \
      == "$current_container_id|$current_image|healthy|0" ]] \
    || blocked "original Production auth rollback identity drifted"
  sed -i 's/^ATTEMPT_STATUS=.*/ATTEMPT_STATUS=rolled-back/' "$release_state"
  echo "PRODUCTION_AUTH_ROLLBACK_CONTAINER=$forward_name"
  echo PRODUCTION_AUTH_ROLLBACK=PASS
}

install -d -m 700 "$state_root"
exec 8>"$deployment_lock"
flock -n 8 || blocked "another MFMS Production deployment or rollback is active"
exec 9>"$auth_lock"
flock -n 9 || blocked "another Production auth deployment or rollback is active"

case "$operation" in
  validate)
    assert_no_attempt_state
    assert_shared_invariants
    assert_current_auth
    echo PRODUCTION_AUTH_CONTROLLER_VALIDATE=PASS
    echo AUTH_ROLLBACK_DRY_RUN=PASS
    echo traffic_switch=not-performed
    echo containers_changed=0
    echo auth_store_changed=0
    echo failed_evidence_changed=0
    echo nginx_changed=0
    echo database_changed=0
    ;;
  deploy) deploy_production_auth ;;
  rollback) rollback_production_auth ;;
esac
