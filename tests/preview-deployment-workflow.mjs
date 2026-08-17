import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"

const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")

const preflightWorkflow = readText(".github/workflows/preview-server-preflight.yml")
const deployWorkflow = readText(".github/workflows/preview-server-deploy.yml")
const rollbackWorkflow = readText(".github/workflows/preview-server-rollback.yml")
const releaseSignalWorkflow = readText(".github/workflows/preview-release-candidate.yml")
const preflightScript = readText("scripts/preview-server-preflight.sh")
const deployScript = readText("scripts/preview-server-deploy.sh")
const previewDockerfile = readText("Dockerfile.preview")
const gitAttributes = readText(".gitattributes")
const manifest = JSON.parse(
  readFileSync("deploy/preview-release-manifest.json", "utf8"),
)

const manualWorkflows = [preflightWorkflow, rollbackWorkflow]

if (process.platform !== "win32") {
  assert.equal(statSync("scripts/preview-server-preflight.sh").mode & 0o777, 0o755)
  assert.equal(statSync("scripts/preview-server-deploy.sh").mode & 0o777, 0o755)
}
assert.equal(gitAttributes, "*.sh text eol=lf\n")

for (const workflow of manualWorkflows) {
  assert.match(workflow, /^\s*workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule|workflow_run):/m)
  assert.match(workflow, /^permissions:\n\s+contents: read$/m)
  assert.match(workflow, /^\s+name: Preview$/m)
  assert.match(workflow, /^\s+url: https:\/\/preview\.muthufarms\.com\/$/m)
  assert.match(workflow, /^\s+group: mfms-preview-server$/m)
  assert.match(workflow, /StrictHostKeyChecking=yes/)
  assert.match(workflow, /BatchMode=yes/)
  assert.doesNotMatch(workflow, /ssh-keyscan/)
  assert.doesNotMatch(workflow, /https:\/\/muthufarms\.com(?:\/|['"])/)

  for (const action of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    const reference = action[1].split("@")[1]
    assert.match(reference, /^[0-9a-f]{40}$/, `Action is not immutable: ${action[1]}`)
  }
}

assert.match(deployWorkflow, /^\s*workflow_dispatch:/m)
assert.match(
  deployWorkflow,
  /^\s*workflow_run:\n\s+workflows:\n\s+- Preview release candidate\n\s+types:\n\s+- completed\n\s+branches:\n\s+- preview-release$/m,
)
assert.doesNotMatch(deployWorkflow, /^\s*(push|pull_request|schedule):/m)
assert.match(deployWorkflow, /^permissions:\n\s+contents: read$/m)
assert.match(deployWorkflow, /^\s+name: Preview$/m)
assert.match(deployWorkflow, /^\s+url: https:\/\/preview\.muthufarms\.com\/$/m)
assert.match(deployWorkflow, /^\s+group: mfms-preview-server$/m)
assert.match(deployWorkflow, /StrictHostKeyChecking=yes/)
assert.match(deployWorkflow, /BatchMode=yes/)
assert.doesNotMatch(deployWorkflow, /ssh-keyscan/)
assert.doesNotMatch(deployWorkflow, /https:\/\/muthufarms\.com(?:\/|['"])/)

for (const action of deployWorkflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
  const reference = action[1].split("@")[1]
  assert.match(reference, /^[0-9a-f]{40}$/, `Action is not immutable: ${action[1]}`)
}

assert.match(releaseSignalWorkflow, /^name: Preview release candidate$/m)
assert.match(
  releaseSignalWorkflow,
  /^\s*push:\n\s+branches:\n\s+- preview-release\n\s+paths:\n\s+- deploy\/preview-release-manifest\.json$/m,
)
assert.doesNotMatch(releaseSignalWorkflow, /^\s*(workflow_dispatch|workflow_run|pull_request|schedule):/m)
assert.match(releaseSignalWorkflow, /^permissions:\n\s+contents: read$/m)
assert.match(releaseSignalWorkflow, /^\s+group: mfms-preview-release-signal$/m)
assert.match(releaseSignalWorkflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/preview-release" \]\]/)
assert.match(releaseSignalWorkflow, /\[\[ "\$CANDIDATE_REVISION" =~ \^\[0-9a-f\]\{40\}\$ \]\]/)
assert.doesNotMatch(
  releaseSignalWorkflow,
  /(?:environment:|secrets\.|ssh(?:-|_|\b)|curl\b|actions\/checkout|deploy-preview|rollback-preview)/i,
)
assert.doesNotMatch(releaseSignalWorkflow, /https:\/\/muthufarms\.com(?:\/|['"])/)

assert.match(preflightWorkflow, /\[\[ "\$CONFIRMATION" == "INSPECT PREVIEW ONLY" \]\]/)
assert.match(preflightWorkflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
assert.match(preflightWorkflow, /^\s+needs: authorize$/m)
assert.match(preflightWorkflow, /persist-credentials: false/)
assert.match(
  preflightWorkflow,
  /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/,
)
assert.match(
  preflightWorkflow,
  /actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/,
)

for (const variableName of ["PREVIEW_SSH_HOST", "PREVIEW_SSH_USER"]) {
  assert.match(preflightWorkflow, new RegExp(`vars\\.${variableName}`))
  assert.doesNotMatch(preflightWorkflow, new RegExp(`secrets\\.${variableName}`))
}
for (const secretName of [
  "PREVIEW_SSH_PRIVATE_KEY",
  "PREVIEW_SSH_KNOWN_HOSTS",
]) {
  assert.match(preflightWorkflow, new RegExp(`secrets\\.${secretName}`))
}

for (const workflow of [deployWorkflow, rollbackWorkflow]) {
  assert.match(workflow, /PREVIEW_DEPLOY_SSH_PRIVATE_KEY: \$\{\{ secrets\.PREVIEW_DEPLOY_SSH_PRIVATE_KEY \}\}/)
  assert.match(workflow, /\[\[ "\$PREVIEW_SSH_HOST" == "168\.144\.179\.221" \]\]/)
  assert.match(workflow, /\[\[ "\$PREVIEW_SSH_USER" == "muthu" \]\]/)
  assert.match(workflow, /ssh-keygen -F "\$PREVIEW_SSH_HOST"/)
  assert.match(workflow, /PasswordAuthentication=no/)
  assert.match(workflow, /KbdInteractiveAuthentication=no/)
  assert.match(workflow, /ssh -T/)
  assert.match(workflow, /production_touched=0/)
  assert.match(
    workflow,
    /actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/,
  )
}

assert.doesNotMatch(rollbackWorkflow, /secrets\.PREVIEW_SSH_PRIVATE_KEY/)

assert.match(deployWorkflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
assert.match(deployWorkflow, /\[\[ "\$CONFIRMATION" == "DEPLOY PREVIEW ONLY" \]\]/)
assert.match(deployWorkflow, /\[\[ "\$WORKFLOW_RUN_CONCLUSION" == "success" \]\]/)
assert.match(deployWorkflow, /\[\[ "\$WORKFLOW_RUN_HEAD_BRANCH" == "preview-release" \]\]/)
assert.match(deployWorkflow, /\$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
assert.match(deployWorkflow, /Candidate is not the exact preview-release head/)
assert.doesNotMatch(deployWorkflow, /push\)\n/)
assert.doesNotMatch(
  deployWorkflow,
  /^\s+current_revision:\n\s+description: Exact 40-character revision currently running on Preview$/m,
)
assert.match(
  deployWorkflow,
  /PREVIEW_SSH_PRIVATE_KEY: \$\{\{ secrets\.PREVIEW_SSH_PRIVATE_KEY \}\}/,
)
assert.match(deployWorkflow, /name: Discover the exact live Preview revision/)
assert.match(deployWorkflow, /READ_ONLY_PREFLIGHT=PASS/)
assert.match(deployWorkflow, /frontend_image_revision/)
assert.match(
  deployWorkflow,
  /CANDIDATE_REVISION: \$\{\{ needs\.authorize\.outputs\.candidate_revision \}\}/,
)
assert.match(
  deployWorkflow,
  /CURRENT_REVISION: \$\{\{ steps\.live\.outputs\.current_revision \}\}/,
)
assert.match(deployWorkflow, /deploy-preview \$CANDIDATE_REVISION \$CURRENT_REVISION \$GITHUB_RUN_ID/)
assert.match(deployWorkflow, /PREVIEW_DEPLOYMENT=PASS/)
assert.doesNotMatch(deployWorkflow, /actions\/checkout/)

assert.match(rollbackWorkflow, /\[\[ "\$CONFIRMATION" == "ROLL BACK PREVIEW" \]\]/)
assert.match(rollbackWorkflow, /rollback-preview \$CURRENT_REVISION \$GITHUB_RUN_ID/)
assert.match(rollbackWorkflow, /PREVIEW_ROLLBACK=PASS/)

assert.match(preflightScript, /root SSH access is prohibited/)
assert.match(preflightScript, /the approved Preview SSH user is muthu/)
assert.match(preflightScript, /the SSH key is restricted to the Preview preflight command/)
assert.match(preflightScript, /READ_ONLY_PREFLIGHT=PASS/)
assert.match(preflightScript, /production_containers_touched=0/)
assert.match(preflightScript, /backend_containers_changed=0/)
assert.match(preflightScript, /database_operations=0/)
assert.match(preflightScript, /odk_operations=0/)
assert.match(preflightScript, /scheduler_operations=0/)
assert.match(preflightScript, /proxy_configuration_operations=0/)

for (const prohibited of [
  /docker\s+(rm|stop|kill|restart|run|create|rename|update)\b/,
  /docker\s+compose\s+(up|down|restart)\b/,
  /\bsudo\b/,
  /\b(crontab\s+-r|systemctl\s+(stop|restart)|service\s+\S+\s+(stop|restart))\b/,
]) {
  assert.doesNotMatch(preflightScript, prohibited)
}

assert.match(deployScript, /readonly preview_url="https:\/\/preview\.muthufarms\.com"/)
assert.match(
  deployScript,
  /readonly central_login_url="https:\/\/auth\.muthufarms\.com\/login"/,
)
assert.doesNotMatch(deployScript, /https:\/\/muthufarms\.com(?:\/|['"])/)
assert.match(deployScript, /readonly release_ref="refs\/heads\/preview-release"/)
assert.match(deployScript, /readonly live_container="mfms-pilot-web"/)
assert.match(deployScript, /readonly backend_container="harvest-api-pilot"/)
assert.match(deployScript, /readonly proxy_container="central-nginx-1"/)
assert.match(deployScript, /readonly live_port="3015"/)
assert.match(deployScript, /readonly candidate_port="3016"/)
assert.match(deployScript, /\bss\b/)
assert.match(deployScript, /deploy_command_pattern='\^deploy-preview /)
assert.match(deployScript, /rollback_command_pattern='\^rollback-preview /)
assert.match(deployScript, /candidate is not the exact preview-release head/)
assert.match(deployScript, /candidate does not contain the live Preview baseline/)
assert.match(deployScript, /Preview candidate port \$candidate_port is already allocated/)
assert.match(deployScript, /--ip "\$original_network_ip"/)
assert.match(deployScript, /Preview frontend network address changed/)
assert.match(deployScript, /AUTOMATIC_RESTORE=/)
assert.match(deployScript, /wait_for_public_preview_guard/)
assert.match(deployScript, /public Preview authentication guard is unavailable/)
assert.match(deployScript, /public Preview authentication guard failed/)
assert.match(deployScript, /public Preview rollback authentication guard failed/)
assert.match(deployScript, /parsed\.netloc == login\.netloc == "auth\.muthufarms\.com"/)
assert.match(deployScript, /parse_qsl\(parsed\.query, keep_blank_values=True\)/)
assert.match(deployScript, /public_guard_result="303-central-login"/)
assert.match(deployScript, /public_preview_guard=\$public_guard_result/)
assert.match(deployScript, /assert_preview_environment_banner/)
assert.match(deployScript, /candidate Preview environment banner is invalid/)
assert.match(deployScript, /replacement Preview environment banner is invalid/)
assert.match(deployScript, /data-mfms-environment=\"preview\"/)
assert.match(deployScript, /data-mfms-database=\"mfms_server_uat\"/)
assert.match(deployScript, /NEXT_PUBLIC_MFMS_ENV=preview/)
assert.match(deployScript, /NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=mfms_server_uat/)
assert.doesNotMatch(deployScript, /wait_for_version "\$preview_url"/)
assert.doesNotMatch(deployScript, /smoke_routes "\$preview_url"/)
assert.doesNotMatch(
  deployScript,
  /docker rename "\$transaction_backup" "\$live_container" >\/dev\/null 2>&1 \|\| return 0/,
)
assert.match(deployScript, /snapshot_unrelated_containers/)
assert.match(deployScript, /POSTGRES_DB=mfms_server_uat/)
assert.match(deployScript, /MFMS_TARGET_DATABASE=mfms_server_uat/)
assert.match(deployScript, /proxy configuration changed/)
assert.match(deployScript, /Preview schedules changed/)
assert.match(deployScript, /readonly worker_secret_file="\$state_dir\/worker-management-signing\.env"/)
assert.match(deployScript, /readonly installed_deploy_script="\/home\/muthu\/bin\/mfms-preview-github-deploy"/)
assert.match(
  deployScript,
  /cmp -s "\$installed_deploy_script" "\$source_dir\/scripts\/preview-server-deploy\.sh"/,
)
assert.match(deployScript, /installed Preview deploy script does not match the approved candidate/)
assert.match(deployScript, /live_mount_count=\$\(docker inspect --format '\{\{len \.Mounts\}\}' "\$live_container"\)/)
assert.match(deployScript, /"\$operation" == "deploy" && "\$live_mount_count" == "0"/)
assert.match(deployScript, /PREVIEW_PM_TILES_REPAIR=required/)
assert.match(deployScript, /MFMS_ACTOR_ASSERTION_SECRET=\[0-9a-f\]\{64\}/)
assert.match(deployScript, /worker_actor_assertion=server-local/)
assert.match(deployScript, /proxy_target_count_before=\$\(proxy_target_count\)/)
assert.match(deployScript, /production_touched=0/)
assert.match(deployScript, /PREVIEW_DEPLOYMENT=PASS/)
assert.match(deployScript, /PREVIEW_ROLLBACK=PASS/)
assert.doesNotMatch(deployScript, /docker\s+compose\b/)
assert.doesNotMatch(deployScript, /\bsudo\b/)
assert.doesNotMatch(deployScript, /nginx\s+-s\s+reload/)
assert.doesNotMatch(deployScript, /crontab\s+-[er]/)
assert.match(deployScript, /orthomosaic_host_dir="\/home\/muthu\/mfms-preview-map-data\/orthomosaic"/)
assert.match(deployScript, /orthomosaic_sha256="0db33c684af256b0c121201c449125c2becb109a6d1f83ec40e1acb259a12849"/)
assert.match(deployScript, /--mount "type=bind,src=\$orthomosaic_host_dir,dst=\$orthomosaic_container_dir,readonly"/)
assert.match(deployScript, /assert_pmtiles_range "http:\/\/127\.0\.0\.1:\$candidate_port"/)
assert.match(deployScript, /docker network disconnect "\$preview_network" "\$container"/)

assert.equal(
  (previewDockerfile.match(/ARG NEXT_PUBLIC_MFMS_ENV=preview/g) ?? []).length,
  2,
)
assert.equal(
  (previewDockerfile.match(/ARG NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=mfms_server_uat/g) ?? []).length,
  2,
)
assert.equal(
  (previewDockerfile.match(/ENV NEXT_PUBLIC_MFMS_ENV=\$NEXT_PUBLIC_MFMS_ENV/g) ?? []).length,
  2,
)
assert.equal(
  (previewDockerfile.match(/ENV NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=\$NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL/g) ?? []).length,
  2,
)

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Preview")
assert.equal(manifest.target_url, "https://preview.muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Replace the Farm Map faucet icon with a dedicated map and location-pin icon",
)
assert.equal(manifest.base_commit, "ec763d202f215097d7ef354a09e02b1c1178e311")
assert.deepEqual(manifest.protected_invariants, {
  production: "unchanged",
  backend: "unchanged",
  database: "unchanged",
  odk: "unchanged",
  schedules: "unchanged",
  proxy_configuration: "unchanged",
})
const expectedReleasePaths = [
  "deploy/approved-change-scope.txt",
  "deploy/preview-release-manifest.json",
  "lib/mfms-navigation.ts",
  "public/mfms/icons/farm-map.svg",
  "tests/preview-deployment-workflow.mjs",
]
assert.deepEqual(manifest.allowed_paths, expectedReleasePaths)

const smokeScript = readText("scripts/test-preview-release.sh")
assert.match(smokeScript, /check \/admin\/tree-lifecycle "Tree Lifecycle \/ Sapling Status"/)
assert.match(smokeScript, /check \/coconut-harvest\/live-counter "Harvest Live Counter"/)

console.log("Preview deployment, rollback, preflight, and automatic trigger tests passed.")
