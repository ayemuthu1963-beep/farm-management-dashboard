import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"

const preflightWorkflow = readFileSync(
  ".github/workflows/preview-server-preflight.yml",
  "utf8",
)
const deployWorkflow = readFileSync(
  ".github/workflows/preview-server-deploy.yml",
  "utf8",
)
const rollbackWorkflow = readFileSync(
  ".github/workflows/preview-server-rollback.yml",
  "utf8",
)
const preflightScript = readFileSync(
  "scripts/preview-server-preflight.sh",
  "utf8",
)
const deployScript = readFileSync(
  "scripts/preview-server-deploy.sh",
  "utf8",
)
const manifest = JSON.parse(
  readFileSync("deploy/preview-release-manifest.json", "utf8"),
)

const workflows = [preflightWorkflow, deployWorkflow, rollbackWorkflow]

assert.equal(statSync("scripts/preview-server-preflight.sh").mode & 0o777, 0o755)
assert.equal(statSync("scripts/preview-server-deploy.sh").mode & 0o777, 0o755)

for (const workflow of workflows) {
  assert.match(workflow, /^\s*workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule):/m)
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

assert.match(preflightWorkflow, /\[\[ "\$CONFIRMATION" == "INSPECT PREVIEW ONLY" \]\]/)
assert.match(preflightWorkflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
assert.match(preflightWorkflow, /^\s+needs: authorize$/m)
assert.match(preflightWorkflow, /persist-credentials: false/)
assert.match(
  preflightWorkflow,
  /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/,
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
  assert.doesNotMatch(workflow, /secrets\.PREVIEW_SSH_PRIVATE_KEY/)
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

assert.match(deployWorkflow, /\[\[ "\$CONFIRMATION" == "DEPLOY PREVIEW ONLY" \]\]/)
assert.match(deployWorkflow, /refs\/heads\/preview-release/)
assert.match(deployWorkflow, /merge-base --is-ancestor "\$CURRENT_REVISION" "\$CANDIDATE_REVISION"/)
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
assert.doesNotMatch(deployScript, /https:\/\/muthufarms\.com(?:\/|['"])/)
assert.match(deployScript, /readonly release_ref="refs\/heads\/preview-release"/)
assert.match(deployScript, /readonly live_container="mfms-pilot-web"/)
assert.match(deployScript, /readonly backend_container="harvest-api-pilot"/)
assert.match(deployScript, /readonly proxy_container="central-nginx-1"/)
assert.match(deployScript, /readonly live_port="3015"/)
assert.match(deployScript, /readonly candidate_port="3016"/)
assert.match(deployScript, /deploy_command_pattern='\^deploy-preview /)
assert.match(deployScript, /rollback_command_pattern='\^rollback-preview /)
assert.match(deployScript, /candidate is not the exact preview-release head/)
assert.match(deployScript, /candidate does not contain the live Preview baseline/)
assert.match(deployScript, /--ip "\$original_network_ip"/)
assert.match(deployScript, /Preview frontend network address changed/)
assert.match(deployScript, /AUTOMATIC_RESTORE=/)
assert.match(deployScript, /snapshot_unrelated_containers/)
assert.match(deployScript, /POSTGRES_DB=mfms_server_uat/)
assert.match(deployScript, /MFMS_TARGET_DATABASE=mfms_server_uat/)
assert.match(deployScript, /proxy configuration changed/)
assert.match(deployScript, /Preview schedules changed/)
assert.match(deployScript, /production_touched=0/)
assert.match(deployScript, /PREVIEW_DEPLOYMENT=PASS/)
assert.match(deployScript, /PREVIEW_ROLLBACK=PASS/)
assert.doesNotMatch(deployScript, /docker\s+compose\b/)
assert.doesNotMatch(deployScript, /\bsudo\b/)
assert.doesNotMatch(deployScript, /nginx\s+-s\s+reload/)
assert.doesNotMatch(deployScript, /crontab\s+-[er]/)

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Preview")
assert.equal(manifest.target_url, "https://preview.muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(manifest.base_commit, "024d68ff51b40a92c350414d43706370fc80f33e")
assert.deepEqual(manifest.protected_invariants, {
  production: "unchanged",
  backend: "unchanged",
  database: "unchanged",
  odk: "unchanged",
  schedules: "unchanged",
  proxy_configuration: "unchanged",
})
assert.deepEqual(manifest.allowed_paths, [...manifest.allowed_paths].sort())
assert.equal(new Set(manifest.allowed_paths).size, manifest.allowed_paths.length)
for (const requiredPath of [
  ".github/workflows/preview-server-deploy.yml",
  ".github/workflows/preview-server-preflight.yml",
  ".github/workflows/preview-server-rollback.yml",
  "app/api/irrigation-management/route.ts",
  "components/irrigation/irrigation-charts-hybrid.tsx",
  "deploy/preview-release-manifest.json",
  "lib/irrigation-data.ts",
  "scripts/preview-server-deploy.sh",
  "tests/irrigation-management-corrections.mjs",
]) {
  assert.ok(manifest.allowed_paths.includes(requiredPath), `Missing manifest path: ${requiredPath}`)
}

console.log("Preview deployment, rollback, and preflight workflow tests passed.")
