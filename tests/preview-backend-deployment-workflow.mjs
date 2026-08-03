import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
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

function pythonFullmatch(pattern, value) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import re, sys; print('MATCH' if re.fullmatch(sys.argv[1], sys.argv[2]) else 'NO_MATCH')",
      pattern,
      value,
    ],
    { encoding: "utf8" },
  )
  assert.equal(result.error, undefined, "python3 must be available for validator tests")
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim() === "MATCH"
}

const migrationPattern = deployScript.match(
  /^safe_migration = re\.compile\(r"([^"]+)"\)$/m,
)?.[1]
assert.ok(migrationPattern, "migration validator pattern must be present")
assert.equal(
  pythonFullmatch(
    migrationPattern,
    "db/migrations/20260803_tree_lifecycle_saplings.sql",
  ),
  true,
)
assert.equal(pythonFullmatch(migrationPattern, "db/migrations/not-a-migration.sql"), false)

const allowedStart = deployScript.indexOf("allowed = re.compile(\n")
const allowedEnd = deployScript.indexOf("\nif not changed:", allowedStart)
assert.notEqual(allowedStart, -1, "allowed backend path pattern must be present")
assert.notEqual(allowedEnd, -1, "allowed backend path pattern must be complete")
const allowedPattern = [...deployScript.slice(allowedStart, allowedEnd).matchAll(/r"([^"]+)"/g)]
  .map((match) => match[1])
  .join("")

for (const path of [
  "api/Dockerfile",
  "api/requirements.txt",
  "api/app/main.py",
  "api/app/routers/tree_lifecycle.py",
  "db/migrations/20260803_tree_lifecycle_saplings.sql",
  "scripts/apply_preview_migrations.py",
  "deploy/preview-backend-release.json",
  "tests/test_preview_migrations.py",
]) {
  assert.equal(pythonFullmatch(allowedPattern, path), true, "must allow " + path)
}
assert.equal(pythonFullmatch(allowedPattern, ".github/workflows/preview-backend-deploy.yml"), false)

function assertPythonPlanLines(label, source, expectedLines) {
  const result = spawnSync("python3", ["-c", source], { encoding: "utf8" })
  assert.equal(result.error, undefined, `${label} test requires python3`)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(
    JSON.parse(result.stdout),
    expectedLines,
    `${label} must be made of physical newline-delimited records`,
  )
}

const migrationPlanSeparator = deployScript.match(
  /""\.join\(f"\{path\}\|\{checksum\}(\\+)n" for path, checksum in plan\)/,
)?.[1]
assert.ok(migrationPlanSeparator, "migration plan writer must be present")
assert.equal(
  migrationPlanSeparator,
  "\\",
  "migration plan writer must use one Python newline escape",
)
assertPythonPlanLines(
  "migration plan",
  [
    "import json",
    'plan = [("db/migrations/one.sql", "checksum-one"), ("db/migrations/two.sql", "checksum-two")]',
    `value = "".join(f"{path}|{checksum}${migrationPlanSeparator}n" for path, checksum in plan)`,
    "print(json.dumps(value.splitlines()))",
  ].join("\n"),
  [
    "db/migrations/one.sql|checksum-one",
    "db/migrations/two.sql|checksum-two",
  ],
)

const openapiPlanSeparator = deployScript.match(
  /""\.join\(f"\{path\}(\\+)n" for path in openapi_paths\)/,
)?.[1]
assert.ok(openapiPlanSeparator, "OpenAPI plan writer must be present")
assert.equal(
  openapiPlanSeparator,
  "\\",
  "OpenAPI plan writer must use one Python newline escape",
)
assertPythonPlanLines(
  "OpenAPI plan",
  [
    "import json",
    'openapi_paths = ["/health", "/api/backend-version"]',
    `value = "".join(f"{path}${openapiPlanSeparator}n" for path in openapi_paths)`,
    "print(json.dumps(value.splitlines()))",
  ].join("\n"),
  ["/health", "/api/backend-version"],
)


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
assert.match(deployScript, /readonly live_port="8015"/)
assert.match(deployScript, /readonly candidate_port="8016"/)
assert.match(deployScript, /readonly approved_restart_policy="no"/)
assert.match(deployScript, /readonly approved_mount_source="\/tmp"/)
assert.match(deployScript, /readonly approved_mount_target="\/host-tmp"/)
assert.match(deployScript, /assert_approved_mount_contract/)
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
assert.match(bootstrapScript, /unlabelled live backend image tag does not match CURRENT_BACKEND_COMMIT/)
assert.match(bootstrapScript, /mfms-asset-register-api:github-/)
assert.match(bootstrapScript, /PREVIEW_BACKEND_BOOTSTRAP=PASS/)
assert.doesNotMatch(bootstrapScript, /docker\s+(stop|restart|run|rm|rename)\b/)

assert.match(setupGuide, /PREVIEW_BACKEND_DEPLOY_SSH_PRIVATE_KEY/)
assert.match(setupGuide, /mfms-preview-backend-deploy/)
assert.match(setupGuide, /mfms_server_uat/)
assert.match(setupGuide, /Production is\s+not part of this process/)
assert.match(setupGuide, /wc -l \/home\/muthu\/\.ssh\/mfms-preview-backend\.authorized_key/)
assert.doesNotMatch(setupGuide, /Set-Content -NoNewline/)
assert.match(setupGuide, /Set-Content -Path .* -Encoding ascii/)
assert.match(setupGuide, /mfms-preview-backend-repository-readonly/)
assert.match(setupGuide, /Host github\.com-mfms-preview-backend/)
assert.match(setupGuide, /Allow write access.*unchecked/)

console.log("Preview backend deployment and rollback workflow tests passed.")
