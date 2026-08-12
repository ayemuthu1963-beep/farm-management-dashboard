import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")

const deploy = readText(".github/workflows/production-backend-deploy.yml")
const rollback = readText(".github/workflows/production-backend-rollback.yml")
const gate = readText("scripts/production-server-backend-deploy.sh")

for (const workflow of [deploy, rollback]) {
  assert.match(workflow, /^\s*workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule|workflow_run):/m)
  assert.match(workflow, /^permissions:\n\s+contents: read$/m)
  assert.match(workflow, /^\s+name: Production$/m)
  assert.match(workflow, /^\s+url: https:\/\/muthufarms\.com\/$/m)
  assert.match(workflow, /^\s+group: mfms-production-server$/m)
  assert.match(workflow, /PRODUCTION_BACKEND_DEPLOY_SSH_PRIVATE_KEY/)
  assert.match(workflow, /StrictHostKeyChecking=yes/)
  assert.match(workflow, /BatchMode=yes/)
  assert.match(workflow, /PasswordAuthentication=no/)
  assert.match(workflow, /KbdInteractiveAuthentication=no/)
  assert.match(workflow, /\[\[ "\$PRODUCTION_SSH_HOST" == "168\.144\.179\.221" \]\]/)
  assert.match(workflow, /\[\[ "\$PRODUCTION_SSH_USER" == "muthu" \]\]/)
  assert.match(workflow, /test_touched=0/)
  assert.match(workflow, /preview_touched=0/)
  assert.doesNotMatch(workflow, /ssh-keyscan/)
  assert.doesNotMatch(workflow, /mfms_server_uat|production\.muthufarms\.com/)

  for (const action of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    const reference = action[1].split("@")[1]
    assert.match(reference, /^[0-9a-f]{40}$/, `Action is not immutable: ${action[1]}`)
  }
}

assert.match(deploy, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
assert.match(deploy, /DEPLOY PRODUCTION BACKEND ONLY/)
assert.match(deploy, /deploy-production-backend \$CANDIDATE_REVISION \$GITHUB_RUN_ID/)
assert.match(deploy, /database=mfms_server_prod/)
assert.match(deploy, /database_backup_verified=true/)
assert.match(deploy, /database_migrations=none/)
assert.match(deploy, /frontend_unchanged=true/)
assert.match(deploy, /PRODUCTION_BACKEND_DEPLOYMENT=PASS/)

assert.match(rollback, /ROLL BACK PRODUCTION BACKEND/)
assert.match(rollback, /rollback-production-backend \$CURRENT_REVISION \$GITHUB_RUN_ID/)
assert.match(rollback, /database_migrations=none/)
assert.match(rollback, /PRODUCTION_BACKEND_ROLLBACK=PASS/)

assert.match(gate, /root SSH access is prohibited/)
assert.match(gate, /readonly backend_repo_dir="\/home\/muthu\/muthu-harvest-dashboard-production-release"/)
assert.match(gate, /readonly backend_live_container="harvest-api"/)
assert.match(gate, /readonly frontend_container="mfms-v0-preview-web"/)
assert.match(gate, /readonly production_network="harvest-net"/)
assert.match(gate, /readonly production_url="https:\/\/muthufarms\.com"/)
assert.match(gate, /readonly database_name="mfms_server_prod"/)
assert.match(gate, /readonly live_port="8001"/)
assert.match(gate, /readonly candidate_port="8002"/)
assert.match(gate, /readonly approved_restart_policy="unless-stopped"/)
assert.match(gate, /deploy\/production-backend-release\.json/)
assert.match(gate, /backend-source-only-no-database-migrations/)
assert.match(gate, /source-only Production release must not contain database migrations/)
assert.match(gate, /\[\[ ! -s "\$migration_plan" \]\]/)
assert.match(gate, /pg_dump --format=custom/)
assert.match(gate, /pg_restore --list/)
assert.match(gate, /com\.muthufarms\.mfms\.source-contract/)
assert.match(gate, /database_migrations=none/)
assert.match(gate, /PRODUCTION_BACKEND_DEPLOYMENT=PASS/)
assert.match(gate, /PRODUCTION_BACKEND_ROLLBACK=PASS/)
assert.doesNotMatch(gate, /mfms_server_uat|harvest-api-pilot|production\.muthufarms\.com/)
assert.doesNotMatch(gate, /docker\s+compose\b|\bsudo\b|nginx\s+-s\s+reload|crontab\s+-[er]/)

const mode = spawnSync("git", ["ls-files", "-s", "--", "scripts/production-server-backend-deploy.sh"], {
  encoding: "utf8",
})
assert.equal(mode.status, 0, mode.stderr)
assert.equal(mode.stdout.trim().split(/\s+/, 1)[0], "100755")

console.log("Production backend deploy and rollback workflow contracts passed.")
