#!/usr/bin/env bash
# One-time local administrator utility.  It is never exposed through the
# GitHub Actions SSH key; it only records a verified existing Preview API as
# the first rollback baseline for the restricted backend deploy program.
set -Eeuo pipefail

blocked() {
  echo "PREVIEW_BACKEND_BOOTSTRAP_BLOCKED=$1" >&2
  exit 1
}

[[ $# -eq 1 ]] || blocked "usage: $0 CURRENT_BACKEND_COMMIT"
current_revision=$1
[[ "$current_revision" =~ ^[0-9a-f]{40}$ ]] \
  || blocked "CURRENT_BACKEND_COMMIT must be an exact lowercase commit SHA"
[[ "$(id -u)" -ne 0 ]] || blocked "root execution is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Preview user is muthu"

readonly backend_repo_dir="/home/muthu/muthu-harvest-dashboard-preview-release"
readonly backend_live_container="harvest-api-pilot"
readonly state_dir="/home/muthu/.local/state/mfms-preview-github"
readonly state_file="$state_dir/last-successful-backend-switch"
readonly lock_file="$state_dir/deployment.lock"

command -v docker >/dev/null 2>&1 || blocked "docker is unavailable"
command -v git >/dev/null 2>&1 || blocked "git is unavailable"
container_id=$(docker inspect --format '{{.Id}}' "$backend_live_container" 2>/dev/null) \
  || blocked "Preview backend container is missing"
[[ "$(docker inspect --format '{{.State.Running}}' "$backend_live_container")" == "true" ]] \
  || blocked "Preview backend is not running"
[[ -d "$backend_repo_dir/.git" || -f "$backend_repo_dir/.git" ]] \
  || blocked "authoritative Preview backend checkout is missing"

image_id=$(docker inspect --format '{{.Image}}' "$backend_live_container")
image_tag=$(docker inspect --format '{{.Config.Image}}' "$backend_live_container")
image_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id")
[[ "$image_revision" == "$current_revision" ]] \
  || blocked "live backend image label does not match CURRENT_BACKEND_COMMIT"
git -C "$backend_repo_dir" cat-file -e "$current_revision^{commit}" \
  || blocked "CURRENT_BACKEND_COMMIT is absent from the authoritative backend checkout"

install -d -m 700 "$state_dir"
exec 9>"$lock_file"
flock -n 9 || blocked "another Preview deployment or rollback is already running"
[[ ! -e "$state_file" ]] || blocked "backend release state already exists; do not bootstrap twice"

temporary_state=$(mktemp "$state_dir/backend-state.XXXXXX")
cat > "$temporary_state" <<EOF
deployed_revision=$current_revision
deployed_image_id=$image_id
deployed_image_tag=$image_tag
rollback_container=none
rollback_revision=none
rollback_image_id=none
rollback_image_tag=none
run_id=bootstrap
updated_at=$(date -u +%Y%m%dT%H%M%SZ)
database_migrations=forward-only
EOF
chmod 600 "$temporary_state"
mv "$temporary_state" "$state_file"

echo "bootstrap_environment=Preview"
echo "bootstrap_component=backend"
echo "bootstrap_backend_revision=$current_revision"
echo "bootstrap_backend_container=$container_id"
echo "production_touched=0"
echo "PREVIEW_BACKEND_BOOTSTRAP=PASS"
