import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")

const deployWorkflow = readText(".github/workflows/preview-backend-deploy.yml")
const rollbackWorkflow = readText(".github/workflows/preview-backend-rollback.yml")
const deployScript = readText("scripts/preview-server-backend-deploy.sh")
const bootstrapScript = readText("scripts/bootstrap-preview-backend-state.sh")
const setupGuide = readText("docs/PREVIEW_BACKEND_RELEASE_SETUP.md")

const loaderPath = "scripts/load_worker_v2_uat_fixture.py"

function run(command, commandArguments, options = {}) {
  const result = spawnSync(command, commandArguments, {
    encoding: "utf8",
    ...options,
  })
  assert.equal(result.error, undefined, `${command} must be available`)
  return result
}

function git(repository, ...gitArguments) {
  const result = run("git", ["-C", repository, ...gitArguments])
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function write(repository, relativePath, contents) {
  const fullPath = join(repository, ...relativePath.split("/"))
  mkdirSync(join(fullPath, ".."), { recursive: true })
  writeFileSync(fullPath, contents, { encoding: "utf8" })
}

function commit(repository, message) {
  git(repository, "add", "-A")
  git(repository, "commit", "-m", message)
  return git(repository, "rev-parse", "HEAD")
}

const validatorStart = deployScript.indexOf(
  "<<'PY'\n",
  deployScript.indexOf("validate_release_descriptor()"),
)
const validatorEnd = deployScript.indexOf("\nPY\n}", validatorStart)
assert.notEqual(validatorStart, -1, "release descriptor validator must be embedded")
assert.notEqual(validatorEnd, -1, "release descriptor validator must have a complete heredoc")
const descriptorValidator = deployScript.slice(validatorStart + "<<'PY'\n".length, validatorEnd)

function baseDescriptor(approval = undefined) {
  const descriptor = {
    schema_version: 1,
    environment: "Preview",
    target_database: "mfms_server_uat",
    repository: "ayemuthu1963-beep/muthu-harvest-dashboard",
    release_branch: "preview-release",
    deployment_kind: "backend-with-forward-only-migrations",
    protected_invariants: {
      production: "unchanged",
      frontend: "unchanged",
      odk: "unchanged",
      schedules: "unchanged",
      proxy_configuration: "unchanged",
      database: "preview-migrations-only",
    },
    migrations: [],
    required_openapi_paths: ["/health"],
  }
  if (approval !== undefined) {
    descriptor.content_addressed_deletion_approvals = approval
  }
  return descriptor
}

function writeDescriptor(repository, descriptor) {
  write(repository, "deploy/preview-backend-release.json", `${JSON.stringify(descriptor, null, 2)}\n`)
}

function runDescriptorValidator(testCase, descriptor = testCase.descriptor) {
  writeDescriptor(testCase.repository, descriptor)
  const migrationPlan = join(testCase.repository, "migrations.plan")
  const openapiPlan = join(testCase.repository, "openapi.plan")
  return run(
    "python3",
    [
      "-",
      join(testCase.repository, "deploy", "preview-backend-release.json"),
      testCase.repository,
      testCase.current,
      testCase.candidate,
      migrationPlan,
      openapiPlan,
    ],
    { input: descriptorValidator },
  )
}

function createDeletionCase() {
  const repository = mkdtempSync(join(tmpdir(), "mfms-preview-deletion-guard-"))
  git(repository, "init")
  git(repository, "config", "user.name", "Preview Guard Test")
  git(repository, "config", "user.email", "preview-guard@example.invalid")
  write(repository, "README.md", "baseline\n")
  write(repository, loaderPath, "print('operational loader')\n")
  const current = commit(repository, "base with loader")
  const baseBlob = git(repository, "rev-parse", `${current}:${loaderPath}`)
  const baseBytes = run("git", ["-C", repository, "cat-file", "blob", baseBlob], {
    encoding: null,
  }).stdout
  git(repository, "rm", loaderPath)
  const removal = commit(repository, "remove loader")
  const approval = {
    operation: "delete",
    path: loaderPath,
    base_revision: current,
    base_git_blob: baseBlob,
    base_sha256: createHash("sha256").update(baseBytes).digest("hex"),
    removal_revision: removal,
  }
  writeDescriptor(repository, baseDescriptor([approval]))
  const candidate = commit(repository, "approve exact deletion")
  return {
    repository,
    current,
    removal,
    candidate,
    approval,
    descriptor: baseDescriptor([approval]),
  }
}

function withDeletionCase(callback) {
  const testCase = createDeletionCase()
  try {
    callback(testCase)
  } finally {
    rmSync(testCase.repository, { recursive: true, force: true })
  }
}

function createContentCase() {
  const repository = mkdtempSync(join(tmpdir(), "mfms-preview-content-guard-"))
  git(repository, "init")
  git(repository, "config", "user.name", "Preview Guard Test")
  git(repository, "config", "user.email", "preview-guard@example.invalid")
  write(repository, "README.md", "baseline\n")
  write(repository, loaderPath, "print('old verifier')\n")
  const current = commit(repository, "base with old verifier")
  write(repository, loaderPath, "print('reviewed verifier')\n")
  const sourceRevision = commit(repository, "reviewed verifier")
  const blob = git(repository, "rev-parse", `${sourceRevision}:${loaderPath}`)
  const bytes = run("git", ["-C", repository, "cat-file", "blob", blob], {
    encoding: null,
  }).stdout
  const approval = {
    repository: "ayemuthu1963-beep/muthu-harvest-dashboard",
    source_revision: sourceRevision,
    path: loaderPath,
    git_blob: blob,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }
  const descriptor = baseDescriptor()
  descriptor.content_addressed_path_approvals = [approval]
  writeDescriptor(repository, descriptor)
  const candidate = commit(repository, "approve reviewed verifier")
  return { repository, current, sourceRevision, candidate, approval, descriptor }
}

function withContentCase(callback) {
  const testCase = createContentCase()
  try {
    callback(testCase)
  } finally {
    rmSync(testCase.repository, { recursive: true, force: true })
  }
}

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

function gitFileMode(path) {
  const result = spawnSync("git", ["ls-files", "-s", "--", path], {
    encoding: "utf8",
  })
  assert.equal(result.error, undefined, "git must be available for mode checks")
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim().split(/\s+/, 1)[0]
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
  ".env.example",
  "docker-compose.yml",
  "api/Dockerfile",
  "api/requirements.txt",
  "api/app/main.py",
  "api/app/models/__init__.py",
  "api/app/models/worker_management.py",
  "api/app/repositories/worker_management.py",
  "api/app/routers/tree_lifecycle.py",
  "api/app/routers/worker_management.py",
  "api/app/services/worker_management.py",
  "api/app/services/worker_management_api.py",
  "api/app/services/worker_management_auth.py",
  "db/migrations/20260803_tree_lifecycle_saplings.sql",
  "db/rollbacks/20260810_worker_management.sql",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml",
  "README.md",
  "deploy/release-governance.json",
  "docs/MFMS_DATABASE_RELEASE_POLICY.md",
  "scripts/apply_preview_asset_register.py",
  "scripts/apply_preview_migrations.py",
  "scripts/sync_well_water_odk.py",
  "scripts/validate_release_governance.py",
  "deploy/preview-backend-release.json",
  "tests/test_preview_migrations.py",
]) {
  assert.equal(pythonFullmatch(allowedPattern, path), true, "must allow " + path)
}
assert.equal(pythonFullmatch(allowedPattern, ".github/workflows/preview-backend-deploy.yml"), false)
assert.equal(pythonFullmatch(allowedPattern, "db/rollbacks/drop_everything.sql"), false)
assert.equal(
  pythonFullmatch(allowedPattern, loaderPath),
  false,
  "the operational loader must not be added to the standard approved-path expression",
)

assert.match(deployScript, /NEXT_PUBLIC_API_BASE_URL/)
assert.match(
  deployScript,
  /\.env\.example": "a3b28d1c61868a87d19a3650a4a062b7547ccbb884c84279b0534e13aed426e9"/,
)
assert.match(
  deployScript,
  /docker-compose\.yml": "fc3987f71241d245a5f01acab20b4fc04f0fe9d8fc33e1ea17d8256825055117"/,
)

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
  assert.equal(gitFileMode(file), "100755", `${file} must be executable`)
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
assert.match(deployWorkflow, /database_backup_verified=true/)
assert.match(deployWorkflow, /database_backup_sha256=\[0-9a-f\]\{64\}/)
assert.match(deployWorkflow, /database_migrations=forward-only/)
assert.match(deployWorkflow, /worker_actor_assertion=server-local/)
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
assert.match(deployScript, /readonly approved_temp_mount_source="\/tmp"/)
assert.match(deployScript, /readonly approved_temp_mount_target="\/host-tmp"/)
assert.match(deployScript, /readonly approved_storage_mount_source="\/home\/muthu\/mfms_data\/preview\/motor-screenshot-analysis"/)
assert.match(deployScript, /readonly approved_storage_mount_target="\/var\/lib\/mfms\/motor-screenshot-analysis"/)
assert.match(deployScript, /readonly approved_intelligence_mount_source="\/home\/muthu\/\.local\/state\/mfms-preview-intelligence\/preview_service_key"/)
assert.match(deployScript, /readonly approved_intelligence_mount_target="\/run\/secrets\/mfms_intelligence_preview_key"/)
assert.match(deployScript, /readonly approved_ai_control_mount_source="\/home\/muthu\/\.local\/state\/mfms-preview-ai-control"/)
assert.match(deployScript, /readonly approved_ai_control_mount_target="\/var\/lib\/mfms\/ai-control"/)
assert.match(deployScript, /bind\|\$approved_ai_control_mount_source\|\$approved_ai_control_mount_target\|true/)
assert.match(deployScript, /bind\|\$approved_intelligence_mount_source\|\$approved_intelligence_mount_target\|false/)
assert.equal(
  (deployScript.match(/--mount "type=bind,source=\$approved_ai_control_mount_source,target=\$approved_ai_control_mount_target"/g) || []).length,
  3,
)
assert.equal(
  (deployScript.match(/--mount "type=bind,source=\$approved_intelligence_mount_source,target=\$approved_intelligence_mount_target,readonly"/g) || []).length,
  3,
)
assert.match(deployScript, /readonly approved_preview_well_odk_cutoff="2026-07-21T06:06:53\+05:30"/)
assert.match(deployScript, /assert_approved_mount_contract/)
assert.match(deployScript, /ensure_preview_network_attachment/)
assert.match(deployScript, /backend rollback could not attach to the Preview network/)
assert.match(deployScript, /assert_live_contract "\$rollback_revision" "\$replacement_id" false false/)
assert.match(deployScript, /deploy_command_pattern='\^deploy-preview-backend /)
assert.match(deployScript, /rollback_command_pattern='\^rollback-preview-backend /)
assert.match(deployScript, /candidate is not the exact preview-release head/)
assert.match(deployScript, /candidate does not contain the live Preview backend revision/)
assert.match(deployScript, /authoritative backend checkout origin is not approved/)
assert.match(deployScript, /backend candidate health endpoint failed/)
assert.match(deployScript, /backend candidate version endpoint failed/)
assert.match(deployScript, /: > "\$migration_plan"/)
assert.match(deployScript, /: > "\$openapi_plan"/)
assert.match(deployScript, /apply_preview_migrations\.py/)
assert.match(deployScript, /ensure_worker_signing_secret/)
assert.match(deployScript, /database-roles\/uat-app\.database_url/)
assert.match(deployScript, /parsed\.username != "mfms_uat_app"/)
assert.match(deployScript, /NEXT_PUBLIC_API_BASE_URL/)
assert.match(deployScript, /MFMS_WORKER_MANAGEMENT_ENABLED=true/)
assert.match(deployScript, /MFMS_ACTOR_ASSERTION_SECRET=\[0-9a-f\]\{64\}/)
assert.match(deployScript, /create_preview_database_backup/)
assert.match(deployScript, /pg_dump --format=custom/)
assert.match(deployScript, /pg_restore --list/)
assert.match(deployScript, /database_backup_verified=true/)
assert.match(deployScript, /database_backup_sha256=/)
assert.match(deployScript, /proxy_target_count_before/)
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
assert.match(setupGuide, /Worker Management release-control update/)
assert.match(setupGuide, /database_backup_verified=true/)
assert.match(setupGuide, /server-local/)

assert.match(deployScript, /content_addressed_deletion_approvals/)
assert.match(deployScript, /content_addressed_path_approvals/)
assert.match(deployScript, /may contain at most 1 entry/)
assert.match(deployScript, /content-addressed deletion approvals are Preview-only/)
assert.match(deployScript, /authoritative backend checkout does not contain complete Git history/)

withDeletionCase((testCase) => {
  const result = runDescriptorValidator(testCase)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, new RegExp(`content_addressed_deletion_approved=${loaderPath}`))
})

withContentCase((testCase) => {
  const result = runDescriptorValidator(testCase)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, new RegExp(`content_addressed_path_approved=${loaderPath}`))
})

for (const [field, value, expected] of [
  ["source_revision", "0".repeat(40), /Git verification failed/],
  ["git_blob", "0".repeat(40), /Git blob changed/],
  ["sha256", "0".repeat(64), /SHA-256 changed/],
]) {
  withContentCase((testCase) => {
    const descriptor = structuredClone(testCase.descriptor)
    descriptor.content_addressed_path_approvals[0][field] = value
    const result = runDescriptorValidator(testCase, descriptor)
    assert.notEqual(result.status, 0, `${field} mismatch must fail`)
    assert.match(result.stderr, expected)
  })
}

withContentCase((testCase) => {
  const descriptor = structuredClone(testCase.descriptor)
  descriptor.content_addressed_path_approvals[0].path = "scripts/*.py"
  const result = runDescriptorValidator(testCase, descriptor)
  assert.notEqual(result.status, 0, "wildcard content approval must fail")
  assert.match(result.stderr, /invalid content-addressed deletion path/)
})

withContentCase((testCase) => {
  const descriptor = structuredClone(testCase.descriptor)
  descriptor.environment = "Production"
  descriptor.target_database = "mfms_server_prod"
  descriptor.release_branch = "production-release"
  const result = runDescriptorValidator(testCase, descriptor)
  assert.notEqual(result.status, 0, "Production content approval must fail")
  assert.match(result.stderr, /not Preview|Preview-only/)
})

withContentCase((testCase) => {
  const result = runDescriptorValidator(testCase, baseDescriptor())
  assert.notEqual(result.status, 0, "removing the content approval must preserve standard rejection")
  assert.match(result.stderr, /backend candidate contains an unapproved path/)
})

withContentCase((testCase) => {
  git(testCase.repository, "checkout", "-B", "changed-content", testCase.candidate)
  write(testCase.repository, loaderPath, "print('changed after approval')\n")
  testCase.candidate = commit(testCase.repository, "change approved content")
  const result = runDescriptorValidator(testCase)
  assert.notEqual(result.status, 0, "changed candidate content must fail")
  assert.match(result.stderr, /Git blob changed/)
})

for (const [field, value, expected] of [
  ["base_revision", "0".repeat(40), /Git verification failed/],
  ["base_git_blob", "0".repeat(40), /base Git blob changed/],
  ["base_sha256", "0".repeat(64), /base SHA-256 changed/],
  ["removal_revision", "0".repeat(40), /Git verification failed/],
]) {
  withDeletionCase((testCase) => {
    const approval = { ...testCase.approval, [field]: value }
    const result = runDescriptorValidator(testCase, baseDescriptor([approval]))
    assert.notEqual(result.status, 0, `${field} mismatch must fail`)
    assert.match(result.stderr, expected)
  })
}

withDeletionCase((testCase) => {
  const approval = { ...testCase.approval, path: "scripts/*.py" }
  const result = runDescriptorValidator(testCase, baseDescriptor([approval]))
  assert.notEqual(result.status, 0, "wildcard deletion approval must fail")
  assert.match(result.stderr, /invalid content-addressed deletion path/)
})

withDeletionCase((testCase) => {
  const descriptor = baseDescriptor([testCase.approval])
  descriptor.environment = "Production"
  descriptor.target_database = "mfms_server_prod"
  descriptor.release_branch = "production-release"
  const result = runDescriptorValidator(testCase, descriptor)
  assert.notEqual(result.status, 0, "Production deletion approval must fail")
  assert.match(result.stderr, /not Preview|Preview-only/)
})

withDeletionCase((testCase) => {
  const descriptor = baseDescriptor([testCase.approval, { ...testCase.approval }])
  const result = runDescriptorValidator(testCase, descriptor)
  assert.notEqual(result.status, 0, "a second deletion approval must fail")
  assert.match(result.stderr, /at most 1/)
})

withDeletionCase((testCase) => {
  const result = runDescriptorValidator(testCase, baseDescriptor())
  assert.notEqual(result.status, 0, "absence of the approval must preserve the old rejection")
  assert.match(result.stderr, /backend candidate contains an unapproved path/)
})

for (const replacement of ["restored", "directory", "case-variant", "renamed"]) {
  withDeletionCase((testCase) => {
    git(testCase.repository, "checkout", "-B", `replacement-${replacement}`, testCase.removal)
    if (replacement === "restored") {
      write(testCase.repository, loaderPath, "print('restored loader')\n")
    } else if (replacement === "directory") {
      write(testCase.repository, `${loaderPath}/child.txt`, "replacement\n")
    } else if (replacement === "case-variant") {
      write(testCase.repository, "scripts/Load_worker_v2_uat_fixture.py", "replacement\n")
    } else {
      const bytes = run(
        "git",
        ["-C", testCase.repository, "cat-file", "blob", testCase.approval.base_git_blob],
        { encoding: null },
      ).stdout
      const renamed = join(testCase.repository, "scripts", "renamed_worker_v2_uat_fixture.py")
      mkdirSync(join(renamed, ".."), { recursive: true })
      writeFileSync(renamed, bytes)
    }
    writeDescriptor(testCase.repository, testCase.descriptor)
    testCase.candidate = commit(testCase.repository, `${replacement} replacement`)
    const result = runDescriptorValidator(testCase)
    assert.notEqual(result.status, 0, `${replacement} replacement must fail`)
  })
}

if (process.platform !== "win32") {
  withDeletionCase((testCase) => {
    git(testCase.repository, "checkout", "-B", "replacement-symlink", testCase.removal)
    const target = join(testCase.repository, ...loaderPath.split("/"))
    mkdirSync(join(target, ".."), { recursive: true })
    symlinkSync("../README.md", target)
    writeDescriptor(testCase.repository, testCase.descriptor)
    testCase.candidate = commit(testCase.repository, "symlink replacement")
    const result = runDescriptorValidator(testCase)
    assert.notEqual(result.status, 0, "symlink replacement must fail")
  })
}

withDeletionCase((testCase) => {
  git(testCase.repository, "checkout", "-B", "replacement-submodule", testCase.removal)
  writeDescriptor(testCase.repository, testCase.descriptor)
  git(testCase.repository, "add", "deploy/preview-backend-release.json")
  git(
    testCase.repository,
    "update-index",
    "--add",
    "--cacheinfo",
    `160000,${testCase.current},${loaderPath}`,
  )
  git(testCase.repository, "commit", "-m", "submodule replacement")
  testCase.candidate = git(testCase.repository, "rev-parse", "HEAD")
  const result = runDescriptorValidator(testCase)
  assert.notEqual(result.status, 0, "submodule replacement must fail")
})

withDeletionCase((testCase) => {
  git(testCase.repository, "checkout", "-B", "replayed-deletion", testCase.removal)
  write(testCase.repository, loaderPath, "print('replayed loader')\n")
  commit(testCase.repository, "restore after approved removal")
  git(testCase.repository, "rm", loaderPath)
  writeDescriptor(testCase.repository, testCase.descriptor)
  testCase.candidate = commit(testCase.repository, "delete replayed loader")
  const result = runDescriptorValidator(testCase)
  assert.notEqual(result.status, 0, "restoration and replay after removal must fail")
  assert.match(result.stderr, /reintroduced/)
})

{
  const repository = mkdtempSync(join(tmpdir(), "mfms-preview-standard-path-"))
  try {
    git(repository, "init")
    git(repository, "config", "user.name", "Preview Guard Test")
    git(repository, "config", "user.email", "preview-guard@example.invalid")
    writeDescriptor(repository, baseDescriptor())
    write(repository, "README.md", "baseline\n")
    const current = commit(repository, "standard base")
    write(repository, "README.md", "allowed standard change\n")
    const candidate = commit(repository, "standard allowed change")
    const result = runDescriptorValidator({
      repository,
      current,
      candidate,
      descriptor: baseDescriptor(),
    })
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(repository, { recursive: true, force: true })
  }
}

console.log("Preview backend deployment and rollback workflow tests passed.")
