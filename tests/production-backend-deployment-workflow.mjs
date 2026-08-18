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
assert.match(deploy, /database_migrations=forward-only/)
assert.match(deploy, /frontend_unchanged=true/)
assert.match(deploy, /PRODUCTION_BACKEND_DEPLOYMENT=PASS/)

assert.match(rollback, /ROLL BACK PRODUCTION BACKEND/)
assert.match(rollback, /rollback-production-backend \$CURRENT_REVISION \$GITHUB_RUN_ID/)
assert.match(rollback, /database_migrations=forward-only-retained/)
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
assert.match(gate, /readonly approved_production_ipv4="172\.19\.0\.2"/)
assert.match(gate, /readonly approved_production_dynamic_pool="172\.19\.128\.0\/17"/)
assert.match(gate, /readonly database_url_override_file="\/home\/muthu\/mfms_secrets\/database-roles\/prod-app\.database_url"/)
assert.match(gate, /parsed\.username != "mfms_prod_app"/)
assert.match(gate, /server mfms-v0-preview-web:3000;/)
assert.match(gate, /deploy\/production-backend-release\.json/)
assert.match(gate, /backend-with-forward-only-migrations/)
assert.match(gate, /Production migration release must contain a declared migration/)
assert.match(gate, /Production migration release has an empty migration plan/)
assert.match(gate, /actual = hashlib\.sha256\(content\)\.hexdigest\(\)/)
assert.match(gate, /if actual != checksum:/)
assert.match(gate, /pg_dump --format=custom/)
assert.match(gate, /pg_restore --list/)
assert.match(gate, /com\.muthufarms\.mfms\.source-contract/)
assert.match(gate, /database_migrations=forward-only/)
assert.match(gate, /database_role=mfms_prod_app/)
assert.match(gate, /PRODUCTION_BACKEND_DEPLOYMENT=PASS/)
assert.match(gate, /PRODUCTION_BACKEND_ROLLBACK=PASS/)
assert.doesNotMatch(gate, /mfms_server_uat|harvest-api-pilot|production\.muthufarms\.com/)
assert.doesNotMatch(gate, /docker\s+compose\b|\bsudo\b|nginx\s+-s\s+reload|crontab\s+-[er]/)

const exactReleaseApproval = {
  candidate: "94b28f17702e409e13d25e288fc5cd4b9bbef545",
  tree: "f889f6ad2c97662bd935c3fdfa1add1614836fc3",
  paths: {
    ".env.example": {
      blob: "d4485596e32dd37aff86b4bcede1a1ec0034ade4",
      sha256: "896a4746e01e263518d8966f8586e2bc187e473aad5a087e0e9511625b509615",
    },
    "docker-compose.yml": {
      blob: "839a5adc66376d41ef80993abedda33d10c14f25",
      sha256: "c0165614281b7b81f33cb252907f313a25bc613a8e6bf0c3346e632d98396247",
    },
    "scripts/verify_production_deployment_contract.py": {
      blob: "cd107bbe56de0a75cd147ffcbd7952d25c0ecf03",
      sha256: "63e9ffdcda9d3486cc5084ec1c8c9066490e2fdf905afcdb01a90e78697b1e1d",
    },
  },
  migrationHashes: {
    settings: "87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1",
    persistenceV2: "5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9",
  },
}
const releaseSpecificDecision = ({ path, candidate, tree, blob, sha256 }) => {
  const approval = exactReleaseApproval.paths[path]
  return approval != null
    && candidate === exactReleaseApproval.candidate
    && tree === exactReleaseApproval.tree
    && blob === approval.blob
    && sha256 === approval.sha256
}
const exactPathApprovals = Object.entries(exactReleaseApproval.paths).map(([path, hashes]) => ({
  path,
  candidate: exactReleaseApproval.candidate,
  tree: exactReleaseApproval.tree,
  ...hashes,
}))

for (const approval of exactPathApprovals) {
  assert.equal(releaseSpecificDecision(approval), true)
  assert.equal(releaseSpecificDecision({ ...approval, blob: "0".repeat(40) }), false)
  assert.equal(releaseSpecificDecision({ ...approval, sha256: "0".repeat(64) }), false)
}
assert.equal(releaseSpecificDecision({ ...exactPathApprovals[0], tree: "0".repeat(40) }), false)
assert.equal(releaseSpecificDecision({ ...exactPathApprovals[0], path: "unexpected.txt" }), false)
assert.equal(releaseSpecificDecision({ ...exactPathApprovals[0], candidate: "0".repeat(40) }), false)

for (const value of [
  exactReleaseApproval.candidate,
  exactReleaseApproval.tree,
  ...Object.values(exactReleaseApproval.paths).flatMap(({ blob, sha256 }) => [blob, sha256]),
]) {
  assert.match(gate, new RegExp(value.replaceAll(".", "\\.")))
}
assert.match(gate, /approval is None or candidate != approval\["candidate"\]/)
assert.match(gate, /if tree != release_specific_tree:/)
assert.match(gate, /if blob != approval\["blob"\]/)
assert.match(gate, /hashlib\.sha256\(content\)\.hexdigest\(\) == approval\["sha256"\]/)
assert.match(gate, /if allowed\.fullmatch\(path\) or release_specific_path_approved\(path\):/)

const generalAllowlist = gate.match(/allowed = re\.compile\([\s\S]*?\n\)/)?.[0] ?? ""
assert.doesNotMatch(generalAllowlist, /\\?\.env|dotfile/)
assert.doesNotMatch(generalAllowlist, /docker-compose|verify_production_deployment_contract/)

const completeCandidatePaths = [
  ".env.example",
  ".github/workflows/ci.yml",
  "api/app/routers/operator_settings.py",
  "db/migrations/20260817_irrigation_plan_persistence_v2.sql",
  "db/migrations/20260817_irrigation_plan_settings.sql",
  "db/migrations/20260818_production_irrigation_plan_persistence_v2.sql",
  "db/migrations/20260818_production_irrigation_plan_settings.sql",
  "db/rollbacks/20260817_irrigation_plan_persistence_v2.sql",
  "db/rollbacks/20260817_irrigation_plan_settings.sql",
  "db/rollbacks/20260818_production_irrigation_plan_persistence_v2.sql",
  "db/rollbacks/20260818_production_irrigation_plan_settings.sql",
  "deploy/production-backend-release.json",
  "docker-compose.yml",
  "scripts/apply_production_migrations.py",
  "scripts/validate_production_release.py",
  "scripts/verify_production_deployment_contract.py",
  "tests/run_production_irrigation_migration_integration.py",
  "tests/test_irrigation_plan_persistence_production.py",
  "tests/test_production_deployment_contract.py",
  "tests/test_production_migration_runner.py",
  "tests/test_production_source_release_contract.py",
]
const generalCandidatePath = /^(?:\.github\/(?:CODEOWNERS|pull_request_template\.md|workflows\/ci\.yml)|README\.md|api\/(?:Dockerfile|requirements\.txt|app\/(?:[^/]+\.py|routers\/[^/]+\.py|models\/[^/]+\.py|repositories\/[^/]+\.py|services\/[^/]+\.py))|db\/migrations\/[0-9][A-Za-z0-9_.-]*\.sql|db\/rollbacks\/[0-9][A-Za-z0-9_.-]*\.sql|deploy\/(?:production-backend-release|release-governance)\.json|docs\/MFMS_DATABASE_RELEASE_POLICY\.md|scripts\/(?:apply_production_asset_register|apply_production_migrations|import_access_csv|import_historical_clean_csv|import_manual_harvest_csv|odk_sync_placeholder|sync_production_harvest_odk|sync_well_water_odk|validate_production_release|validate_release_governance)\.py|scripts\/run_production_(?:beetle|harvest|well_water)_sync\.sh|tests\/[^/]+)$/
const remainingUnapproved = completeCandidatePaths.filter(
  (path) => !generalCandidatePath.test(path) && exactReleaseApproval.paths[path] == null,
)
assert.equal(completeCandidatePaths.length, 21)
assert.deepEqual(remainingUnapproved, [])
assert.deepEqual(
  completeCandidatePaths.filter((path) => !generalCandidatePath.test(path)),
  Object.keys(exactReleaseApproval.paths),
)

assert.deepEqual(exactReleaseApproval.migrationHashes, {
  settings: "87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1",
  persistenceV2: "5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9",
})

for (const contract of [
  /readonly live_port="8001"/,
  /readonly candidate_port="8002"/,
  /readonly approved_restart_policy="unless-stopped"/,
  /readonly approved_temp_mount_source="\/tmp"/,
  /readonly approved_temp_mount_target="\/host-tmp"/,
  /readonly approved_storage_mount_source="\/home\/muthu\/mfms_data\/production\/motor-screenshot-analysis"/,
  /readonly approved_storage_mount_target="\/var\/lib\/mfms\/motor-screenshot-analysis"/,
  /docker inspect --format '\{\{range \.Config\.Env\}\}\{\{println \.\}\}\{\{end\}\}' "\$source_container"/,
  /cat "\$database_url_override_file" >> "\$environment_file"/,
  /--ip "\$approved_production_ipv4"/,
  /-p "127\.0\.0\.1:\$live_port:8000"/,
  /--restart "\$approved_restart_policy"/,
  /wait_for_health "http:\/\/127\.0\.0\.1:\$live_port"/,
  /assert_approved_mount_contract "\$backend_live_container"/,
  /assert_database_target "\$backend_live_container"/,
]) {
  assert.match(gate, contract)
}

const mode = spawnSync("git", ["ls-files", "-s", "--", "scripts/production-server-backend-deploy.sh"], {
  encoding: "utf8",
})
assert.equal(mode.status, 0, mode.stderr)
assert.equal(mode.stdout.trim().split(/\s+/, 1)[0], "100755")

console.log("Production backend deploy and rollback workflow contracts passed.")
