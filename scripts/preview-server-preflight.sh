#!/usr/bin/env bash
set -euo pipefail

blocked() {
  echo "PREFLIGHT_BLOCKED=$1" >&2
  exit 1
}

[[ $# -eq 0 ]] || blocked "arguments are not accepted"
[[ "$(id -u)" -ne 0 ]] || blocked "root SSH access is prohibited"
[[ "$(id -un)" == "muthu" ]] || blocked "the approved Preview SSH user is muthu"

command -v docker >/dev/null 2>&1 || blocked "docker is unavailable"
docker info >/dev/null 2>&1 || blocked "the Preview user cannot inspect docker"

frontend_container="mfms-pilot-web"
backend_container="harvest-api-pilot"
proxy_container="central-nginx-1"

for container_name in "$frontend_container" "$backend_container"; do
  docker container inspect "$container_name" >/dev/null 2>&1 \
    || blocked "required Preview container is missing: $container_name"
  [[ "$(docker inspect --format '{{.State.Running}}' "$container_name")" == "true" ]] \
    || blocked "required Preview container is not running: $container_name"
done

inspect_container() {
  local label=$1
  local container_name=$2
  local environment_keys

  environment_keys=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_name" \
    | sed -E 's/=.*$//' \
    | LC_ALL=C sort \
    | paste -sd, -)

  echo "${label}_container=$container_name"
  echo "${label}_container_id=$(docker inspect --format '{{.Id}}' "$container_name")"
  echo "${label}_running=$(docker inspect --format '{{.State.Running}}' "$container_name")"
  echo "${label}_image_tag=$(docker inspect --format '{{.Config.Image}}' "$container_name")"
  echo "${label}_image_id=$(docker inspect --format '{{.Image}}' "$container_name")"
  echo "${label}_image_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$container_name")")"
  echo "${label}_image_environment=$(docker image inspect --format '{{index .Config.Labels "com.muthufarms.mfms.environment"}}' "$(docker inspect --format '{{.Image}}' "$container_name")")"
  echo "${label}_restart_policy=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container_name")"
  echo "${label}_network_mode=$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_name")"
  echo "${label}_networks=$(docker inspect --format '{{range $name, $config := .NetworkSettings.Networks}}{{$name}},{{end}}' "$container_name")"
  echo "${label}_ports=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container_name")"
  echo "${label}_readonly_rootfs=$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_name")"
  echo "${label}_runtime_user=$(docker inspect --format '{{.Config.User}}' "$container_name")"
  echo "${label}_working_dir=$(docker inspect --format '{{.Config.WorkingDir}}' "$container_name")"
  echo "${label}_mount_destinations=$(docker inspect --format '{{range .Mounts}}{{.Type}}:{{.Destination}},{{end}}' "$container_name")"
  echo "${label}_environment_keys=$environment_keys"
  echo "${label}_compose_project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container_name")"
  echo "${label}_compose_service=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$container_name")"
}

echo "preflight_user=$(id -un)"
echo "docker_server_version=$(docker version --format '{{.Server.Version}}')"
inspect_container frontend "$frontend_container"
inspect_container backend "$backend_container"

candidate_count=$(docker ps -a --format '{{.Names}}' \
  | grep -Ec '^(mfms-pilot-web|harvest-api-pilot)-candidate-' || true)
rollback_count=$(docker ps -a --format '{{.Names}}' \
  | grep -Ec '^(mfms-pilot-web|harvest-api-pilot)-pre-' || true)
echo "candidate_container_count=$candidate_count"
echo "retained_rollback_container_count=$rollback_count"

if docker container inspect "$proxy_container" >/dev/null 2>&1; then
  proxy_matches=$(docker exec "$proxy_container" sh -c \
    "grep -R -F 'proxy_pass http://mfms-pilot-web:3000' /etc/nginx/conf.d 2>/dev/null | wc -l" \
    | tr -d '[:space:]')
  echo "preview_proxy_container=$proxy_container"
  echo "preview_proxy_target_matches=$proxy_matches"
else
  echo "preview_proxy_container=not-found"
  echo "preview_proxy_target_matches=unverified"
fi

user_cron=$(crontab -l 2>/dev/null || true)
echo "preview_harvest_schedule_occurrences=$(grep -Fc 'run_preview_harvest_sync.sh' <<<"$user_cron" || true)"
echo "preview_well_water_schedule_occurrences=$(grep -Fc 'run_preview_well_water_sync.sh' <<<"$user_cron" || true)"
echo "preview_beetle_schedule_occurrences=$(grep -Fc 'run_preview_beetle_sync.sh' <<<"$user_cron" || true)"

echo "production_containers_touched=0"
echo "backend_containers_changed=0"
echo "database_operations=0"
echo "odk_operations=0"
echo "scheduler_operations=0"
echo "proxy_configuration_operations=0"
echo "READ_ONLY_PREFLIGHT=PASS"
