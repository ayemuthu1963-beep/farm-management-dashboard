import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"

const deployWorkflow = readFileSync(
  ".github/workflows/preview-backend-deploy.yml",
  "utf8",
)
const rollbackWorkflow = readFileSync(
  ".github/workflows/preview-backend-rollback.yml",
  "utf8",
)
const deployScript = readFileSync(
  "scripts/preview-server-backend-deploy.sh",
  "utf8",
)
const bootstrapScript = readFileSync(
  "scripts/bootstrap-preview-backend-state.sh",
  "utf8",
)
const setupGuide = readFileSync("docs/PREVIEW_BACKEND_RELEASE_SETUP.md", "utf8")

for (const file of [
  "scripts/preview-server-backend-deploy.sh",
  "scripts/bootstrap-preview-backend-state.sh",
]) {
  assert.equal(statSync(file).mode & 0o777, 0o755, `${file} must be executable`)
}

for (const workflow of [deployWorkflow, rollbackWorkflow]) {
  assert.match(workflow, /^\s*workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule|workflow_run):/m)
  assert.match(workflow, /^permissions:\n\s+contents: read$/m)
  assert.match(workflow, /^\s+name: Preview$/m)
  assert.match(workflow, /^\s+url: https:\/\/preview\.muthufarms\.com\/$/m)
  assert.match(workflow, /^\s+group: mfms-preview-server$/m)
  assert.match(workflow, /PREVIEW_BACKEND_DEPLOY_SSH_PRIVATE_KEY/)
  assert.match(workflow, /StrictHostKeyChecking=yes/)
  assert.match(workflow, /BatchMode=yes/)
  assert.match(workflow, /PasswordAuthentication=no/)
  assert.match(workflow, /KbdInteractiveAuthentication=no/)
  assert.match(workflow, /ssh-keygen -F "\$PREVIEW_SSH_HOST"/)
  assert.match(workflow, /\[\[ "\$PREVIEW_SSH_HOST" == "168\.144\.179\.221" \]\]/)
  assert.match(workflow, /\[\[ "\$PREVIEW_SSH_USER" == "muthu" \]\]/)
  assert.match(workflow, /production_touched=0/)
  assert.doesNotMatch(workflow, /ssh-keyscan/)
  assert.doesNotMatch(workflow, /https:\/\/muthufarms\.com(?:\/|['"])/)

  for (const action of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    const reference = action[1].split("@")[1]
    assert.match(reference, /^[0-9a-f]{40}$/, `Action is not immutable: ${action[1]}`)
  }
}

assert.match(deployWorkflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
assert.match(deployWorkflow, /\[\[ "\$CONFIRMATION" == "DEPLOY PREVIEW BACKEND ONLY" \]\]/)
assert.match(deployWorkflow, /deploy-preview-backend \$CANDIDATE_REVISION \$GITHUB_RUN_ID/)
assert.match(deployWorkflow, /database=mfms_server_uat/)
assert.match(deployWorkflow, /database_migrations=forward-only/)
assert.match(deployWorkflow, /frontend_unchanged=true/)
assert.match(deployWorkflow, /PREVIEW_BACKEND_DEPLOYMENT=PASS/)

assert.match(rollbackWorkflow, /\[\[ "\$CONFIRMATION" == "ROLL BACK PREVIEW BACKEND" \]\]/)
assert.match(rollbackWorkflow, /rollback-preview-backend \$CURRENT_REVISION \$GITHUB_RUN_ID/)
assert.match(rollbackWorkflow, /database_migrations=forward-only-not-reversed/)
assert.match(rollbackWorkflow, /PREVIEW_BACKEND_ROLLBACK=PASS/)

assert.match(deployScript, /root SSH access is prohibited/)
assert.match(deployScript, /the approved Preview SSH user is muthu/)
assert.match(deployScript, /readonly backend_live_container="harvest-api-pilot"/)
assert.match(deployScript, /readonly frontend_container="mfms-pilot-web"/)
assert.match(deployScript, /readonly preview_network="harvest-net"/)
assert.match(deployScript, /readonly database_name="mfms_server_uat"/)
assert.match(deployScript, /readonly live_port="8001"/)
assert.match(deployScript, /readonly candidate_port="8016"/)
assert.match(deployScript, /deploy_command_pattern='\^deploy-preview-backend /)
assert.match(deployScript, /rollback_command_pattern='\^rollback-preview-backend /)
assert.match(deployScript, /candidate is not the exact preview-release head/)
assert.match(deployScript, /candidate does not contain the live Preview backend revision/)
assert.match(deployScript, /authoritative backend checkout origin is not approved/)
assert.match(deployScript, /backend candidate health endpoint failed/)
assert.match(deployScript, /backend candidate version endpoint failed/)
assert.match(deployScript, /apply_preview_migrations\.py/)
assert.match(deployScript, /database_migrations=forward-only/)
assert.match(deployScript, /DATABASE_MIGRATIONS_ROLLED_BACK=false/)
assert.match(deployScript, /frontend_unchanged=true/)
assert.match(deployScript, /odk_unchanged=true/)
assert.match(deployScript, /schedules_unchanged=true/)
assert.match(deployScript, /proxy_configuration_unchanged=true/)
assert.match(deployScript, /production_touched=0/)
assert.match(deployScript, /PREVIEW_BACKEND_DEPLOYMENT=PASS/)
assert.match(deployScript, /PREVIEW_BACKEND_ROLLBACK=PASS/)
assert.doesNotMatch(deployScript, /docker\s+compose\b/)
assert.doesNotMatch(deployScript, /\bsudo\b/)
assert.doesNotMatch(deployScript, /nginx\s+-s\s+reload/)
assert.doesNotMatch(deployScript, /crontab\s+-[er]/)

assert.match(bootstrapScript, /usage: \$0 CURRENT_BACKEND_COMMIT/)
assert.match(bootstrapScript, /live backend image label does not match CURRENT_BACKEND_COMMIT/)
assert.match(bootstrapScript, /PREVIEW_BACKEND_BOOTSTRAP=PASS/)
assert.doesNotMatch(bootstrapScript, /docker\s+(stop|restart|run|rm|rename)\b/)

assert.match(setupGuide, /PREVIEW_BACKEND_DEPLOY_SSH_PRIVATE_KEY/)
assert.match(setupGuide, /mfms-preview-backend-deploy/)
assert.match(setupGuide, /mfms_server_uat/)
assert.match(setupGuide, /Production is\s+not part of this process/)

console.log("Preview backend deployment and rollback workflow tests passed.")
