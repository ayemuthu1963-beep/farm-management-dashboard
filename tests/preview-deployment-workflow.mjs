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
const releaseSignalWorkflow = readFileSync(
  ".github/workflows/preview-release-candidate.yml",
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

const manualWorkflows = [preflightWorkflow, rollbackWorkflow]

assert.equal(statSync("scripts/preview-server-preflight.sh").mode & 0o777, 0o755)
assert.equal(statSync("scripts/preview-server-deploy.sh").mode & 0o777, 0o755)

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
assert.match(deployScript, /public_preview_guard=401/)
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
assert.equal(manifest.base_commit, "d4b262b4c43318cdc5bdafa1271bea60dbb5d8ee")
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
  "app/well-water/page.tsx",
  "components/farm/date-range-selector.tsx",
  "components/farm/summary-cards.tsx",
  "components/farm/well-section.tsx",
  "deploy/preview-release-manifest.json",
  "tests/preview-deployment-workflow.mjs",
  "tests/well-water-page-corrections.mjs",
]) {
  assert.ok(manifest.allowed_paths.includes(requiredPath), `Missing manifest path: ${requiredPath}`)
}

console.log("Preview deployment, rollback, preflight, and automatic trigger tests passed.")
