import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")

const deploy = readText(".github/workflows/production-backend-deploy.yml")
const rollback = readText(".github/workflows/production-backend-rollback.yml")
const gate = readText("scripts/production-server-backend-deploy.sh")
const backupRoleRemediation = readText("scripts/production-backup-role-remediate.py")

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

const exactHistoricalRollback = {
  currentRevision: "94b28f17702e409e13d25e288fc5cd4b9bbef545",
  currentContainer: "969d9cab57c47c06716b3e94d858f3a56cd145a39280ca41c417b497647fef47",
  currentImage: "sha256:55b070597e6ee195f50226e7a0e4834a2e64986b20c5d53fa758ee925f45f512",
  currentEnvironment: "90213d0772f3fa45c40987748bc4b1815cdb55fb24e701ecd4a2bcc941e81e12",
  targetRevision: "515638139232c76992a7c7ceaadd8e191e444176",
  targetContainer: "38aaed2a9555f4f51df06efab59972886c58225ed0d88035e4b075243b289e1c",
  targetImage: "sha256:fbe824766b16ebdc2e85f6ed814c4b10bc7f9b4bc0a285945c07e544861b1fe8",
  targetEnvironment: "15da2029147713e2795ddc3d746cc57eed46cd9d090af189f864390d3a56dff9",
}
const historicalRollbackAccepted = (state) => Object.entries(exactHistoricalRollback)
  .every(([key, value]) => state[key] === value)
assert.equal(historicalRollbackAccepted(exactHistoricalRollback), true)
for (const key of Object.keys(exactHistoricalRollback)) {
  assert.equal(historicalRollbackAccepted({ ...exactHistoricalRollback, [key]: "0".repeat(64) }), false)
}
for (const value of Object.values(exactHistoricalRollback)) {
  assert.match(gate, new RegExp(value.replaceAll(".", "\\.")))
}

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
assert.match(gate, /exec pg_dump[\s\S]*?--format=custom/)
assert.match(gate, /pg_restore --list/)
assert.match(gate, /readonly database_backup_credential_file="\/etc\/mfms-production\/backup\/mfms_backup\.env"/)
assert.match(gate, /readonly database_backup_role="mfms_backup"/)
assert.match(gate, /readonly database_backup_postgres_major="16"/)
assert.match(gate, /readonly database_backup_restore_tmpfs_size_bytes="2147483648"/)
assert.match(gate, /Production backup credential owner UID is invalid/)
assert.match(gate, /permissions must be exactly 0640 and non-writable by group\/others/)
assert.match(gate, /must contain exactly MFMS_BACKUP_PASSWORD/)
assert.match(gate, /Production backup role is not login-capable/)
assert.match(gate, /Production backup connection resolved to the wrong database/)
assert.match(gate, /missing_schema_usage/)
assert.match(gate, /missing_table_select/)
assert.match(gate, /missing_sequence_select/)
assert.match(gate, /--network none/)
assert.match(gate, /type=tmpfs,target=\/var\/lib\/postgresql\/data,tmpfs-size=\$database_backup_restore_tmpfs_size_bytes,tmpfs-mode=0700/)
assert.match(gate, /Production backup restore tmpfs capacity or mode is invalid/)
assert.doesNotMatch(gate, /docker volume create|database_backup_restore_volume|type=volume,source=/)
assert.match(gate, /PostgreSQL init process complete; ready for start up\./)
assert.match(gate, /comm == "postgres" and command_line\.split\(" ", 1\)\[0\] == "postgres" and postmaster_pid == "1"/)
assert.match(gate, /RESTORE_READINESS_PROBE=/)
assert.match(gate, /RESTORE_READINESS_STABLE=/)
assert.match(gate, /pg_postmaster_start_time\(\)/)
assert.match(gate, /database_backup_restore_verified="true"/)
assert.match(gate, /A validated Production database backup is required before migration/)
assert.match(gate, /A verified isolated Production database restore is required before migration/)
assert.match(gate, /com\.muthufarms\.mfms\.source-contract/)
assert.match(gate, /database_migrations=forward-only/)
assert.match(gate, /database_role=mfms_prod_app/)
assert.match(gate, /PRODUCTION_BACKEND_DEPLOYMENT=PASS/)
assert.match(gate, /PRODUCTION_BACKEND_ROLLBACK=PASS/)
assert.doesNotMatch(gate, /mfms_server_uat|harvest-api-pilot|production\.muthufarms\.com/)
assert.doesNotMatch(gate, /docker\s+compose\b|\bsudo\b|nginx\s+-s\s+reload|crontab\s+-[er]/)

const extractEmbeddedPython = (marker) => {
  const match = gate.match(new RegExp(`<<'${marker}'\\n([\\s\\S]*?)\\n${marker}`))
  assert.ok(match, `Missing embedded Python marker ${marker}`)
  return match[1]
}
const runPython = (scriptPath, args) => spawnSync("python3", [scriptPath, ...args.map(String)], {
  encoding: "utf8",
})

const backupBlock = gate.slice(
  gate.indexOf("validate_database_backup_credential_state()"),
  gate.indexOf("verify_migrations()"),
)
assert.ok(backupBlock.length > 0)
assert.doesNotMatch(backupBlock, /\bPOSTGRES_USER\b|\bharvest_app\b|\bmfms_prod_app\b|\bmfms_cluster_admin\b/)
assert.doesNotMatch(backupBlock, /docker[^\n]*(?:--env|-e)[^\n]*(?:PASSWORD|MFMS_BACKUP)/i)
assert.doesNotMatch(backupBlock, /(?:echo|logger)[^\n]*backup_password/i)
assert.match(backupBlock, /printf '%s\\n' "\$backup_password" \| docker exec -i/)
assert.match(backupBlock, /unset backup_password/)
assert.match(backupBlock, /read_bytes\(\)\[:5\] == b"PGDMP"/)
assert.match(backupBlock, /rm -f "\$database_backup_temporary"/)
assert.match(backupBlock, /database_backup_temporary=""/)
assert.match(backupBlock, /pg_restore --exit-on-error --no-owner --no-privileges/)
assert.match(backupBlock, /mfms_production_schema_migrations/)
assert.match(backupBlock, /database_backup_baseline_migration_sha256/)
assert.doesNotMatch(backupBlock, /(?:PASSWORD|MFMS_BACKUP)[^\n]*RESTORE_READINESS/)

const readinessBlock = gate.slice(
  gate.indexOf("wait_for_stable_database_backup_restore()"),
  gate.indexOf("verify_database_backup_restore()"),
)
assert.ok(readinessBlock.length > 0)
assert.match(readinessBlock, /inspect_container\(container, expected_id\)/)
assert.match(readinessBlock, /restart_count != 0/)
assert.match(readinessBlock, /container_identity_changed/)
assert.match(readinessBlock, /container_not_running_/)
assert.match(readinessBlock, /stable_final_server_timeout/)
assert.match(readinessBlock, /required_probes < 3/)
assert.match(readinessBlock, /RESTORE_READINESS_RESET=sql_probe_failed/)
assert.match(readinessBlock, /RESTORE_READINESS_RESET=postmaster_start_time_changed/)
assert.doesNotMatch(readinessBlock, /pg_restore|pg_dump|MFMS_BACKUP_PASSWORD|PGPASSWORD/)

const backupFunction = gate.slice(
  gate.indexOf("create_production_database_backup()"),
  gate.indexOf("apply_migrations()"),
)
assert.match(backupFunction, /if \[\[ "\$status" -ne 0 \]\]; then\n\s+rm -f "\$database_backup_temporary"\n\s+database_backup_temporary=""/)
assert.match(backupFunction, /Production database backup is empty or not custom format[\s\S]*?return 1/)
assert.match(backupFunction, /Production database backup listing verification failed[\s\S]*?return 1/)
assert.ok(backupFunction.indexOf("verify_database_backup_restore") < backupFunction.indexOf('mv "$database_backup_temporary"'))
assert.ok(backupFunction.indexOf('mv "$database_backup_temporary"') < backupFunction.indexOf('database_backup_verified="true"'))
const restoreFunction = gate.slice(gate.indexOf("verify_database_backup_restore()"), gate.indexOf("assert_validated_database_backup()"))
assert.ok(restoreFunction.indexOf("wait_for_stable_database_backup_restore") < restoreFunction.indexOf("pg_restore --exit-on-error"))
assert.ok(restoreFunction.indexOf("tmpfs-size=$database_backup_restore_tmpfs_size_bytes") < restoreFunction.indexOf("wait_for_stable_database_backup_restore"))
assert.ok(restoreFunction.indexOf("TmpfsOptions") < restoreFunction.indexOf("wait_for_stable_database_backup_restore"))
const cleanupFunction = gate.slice(gate.indexOf("cleanup()"), gate.indexOf("on_error()"))
assert.match(cleanupFunction, /docker rm -f "\$database_backup_restore_container"/)
assert.doesNotMatch(cleanupFunction, /docker volume/)
const deployFunction = gate.slice(gate.indexOf("deploy_backend()"), gate.indexOf("credential_cutover_backend()"))
assert.ok(deployFunction.indexOf("create_production_database_backup") < deployFunction.indexOf("apply_migrations"))
assert.ok(deployFunction.indexOf("create_production_database_backup") < deployFunction.indexOf("start_candidate"))
assert.ok(deployFunction.indexOf("create_production_database_backup") < deployFunction.indexOf("docker stop"))
assert.match(gate.slice(gate.indexOf("apply_migrations()"), gate.indexOf("verify_migrations()")), /assert_validated_database_backup/)

const dryRunRollbackFunction = gate.slice(
  gate.indexOf("dry_run_backend_rollback()"),
  gate.indexOf("rollback_backend()"),
)
const rollbackFunction = gate.slice(gate.indexOf("rollback_backend()"), gate.indexOf('case "$operation"'))
const restoreOriginalFunction = gate.slice(gate.indexOf("restore_original_backend()"), gate.indexOf("cleanup()"))
assert.match(gate, /dry-run-production-backend-rollback \(\[0-9a-f\]\{40\}\) \(\[0-9\]\+\)/)
assert.match(dryRunRollbackFunction, /assert_exact_historical_application_rollback/)
assert.match(dryRunRollbackFunction, /snapshot_rollback_database_evidence/)
assert.match(dryRunRollbackFunction, /traffic_switch=not-performed/)
assert.match(dryRunRollbackFunction, /database_backup_operations=none/)
assert.match(dryRunRollbackFunction, /database_migration_operations=none/)
assert.doesNotMatch(dryRunRollbackFunction, /docker (?:run|start|stop|rename|rm)|create_production_database_backup|apply_migrations|verify_migrations/)
assert.match(rollbackFunction, /assert_exact_historical_application_rollback/)
assert.match(rollbackFunction, /start_candidate true false/)
assert.match(rollbackFunction, /cmp -s "\$rollback_database_before" "\$rollback_database_after"/)
assert.match(rollbackFunction, /application-only rollback changed the migration ledger, settings, audit history, or protection trigger/)
assert.match(rollbackFunction, /database_migrations=forward-only-retained/)
assert.match(rollbackFunction, /database_backup_operations=none/)
assert.match(rollbackFunction, /database_migration_operations=none/)
assert.doesNotMatch(rollbackFunction, /create_production_database_backup|apply_migrations|verify_migrations|pg_dump|pg_restore|DROP\s+(?:TABLE|TRIGGER)|database_backup_file/)
assert.ok(rollbackFunction.indexOf("start_candidate true false") < rollbackFunction.indexOf('transaction_active=1'))
assert.ok(rollbackFunction.indexOf('transaction_active=1') < rollbackFunction.indexOf('docker stop --time 30 "$backend_live_container"'))
assert.match(restoreOriginalFunction, /docker rename "\$transaction_backup" "\$backend_live_container"/)
assert.match(restoreOriginalFunction, /ensure_production_network_ip "\$backend_live_container" "\$approved_production_ipv4"/)
assert.match(restoreOriginalFunction, /docker start "\$backend_live_container"/)
assert.match(restoreOriginalFunction, /automatic_restore_result="pass"/)
assert.match(gate.slice(gate.indexOf("on_exit()"), gate.indexOf("deploy_backend()")), /transaction_active.*restore_original_backend/s)
assert.match(deployFunction, /validate_release_descriptor[\s\S]*?apply_migrations[\s\S]*?start_candidate/)
assert.doesNotMatch(deployFunction, /start_candidate true false/)
const databaseEvidenceFunction = gate.slice(
  gate.indexOf("snapshot_rollback_database_evidence()"),
  gate.indexOf("prepare_backend_source()"),
)
assert.match(databaseEvidenceFunction, /SET TRANSACTION READ ONLY/)
assert.match(databaseEvidenceFunction, /mfms_production_schema_migrations/)
assert.match(databaseEvidenceFunction, /mfms_irrigation_plan_settings/)
assert.match(databaseEvidenceFunction, /mfms_irrigation_plan_audit/)
assert.match(databaseEvidenceFunction, /pg_trigger/)
assert.match(databaseEvidenceFunction, /20260818_production_irrigation_plan_settings\.sql/)
assert.match(databaseEvidenceFunction, /20260818_production_irrigation_plan_persistence_v2\.sql/)
assert.match(gate, /87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1/)
assert.match(gate, /5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9/)

const readinessTests = spawnSync("python3", ["tests/test_production_backup_restore_readiness.py"], {
  encoding: "utf8",
})
assert.equal(readinessTests.status, 0, `${readinessTests.stdout}\n${readinessTests.stderr}`)

const remediationTests = spawnSync("python3", ["tests/test_production_backup_role_remediation.py"], {
  encoding: "utf8",
})
assert.equal(remediationTests.status, 0, `${remediationTests.stdout}\n${remediationTests.stderr}`)
assert.match(backupRoleRemediation, /EXPECTED_DATABASE = "mfms_server_prod"/)
assert.match(backupRoleRemediation, /EXPECTED_LIVE_REVISION = "94b28f17702e409e13d25e288fc5cd4b9bbef545"/)
assert.match(backupRoleRemediation, /MFMS_BUILD_ENVIRONMENT/)
assert.match(backupRoleRemediation, /GRANT SELECT ON TABLE/)
assert.match(backupRoleRemediation, /GRANT SELECT ON SEQUENCE/)
assert.match(backupRoleRemediation, /ALTER DEFAULT PRIVILEGES IN SCHEMA public/)
assert.match(backupRoleRemediation, /application_rows_changed=0/)
assert.doesNotMatch(backupRoleRemediation, /DELETE|INSERT|UPDATE|TRUNCATE|DROP TABLE/i)

const accessValidator = extractEmbeddedPython("PY_DATABASE_BACKUP_ACCESS_VALIDATION")
const credentialValidator = extractEmbeddedPython("PY_DATABASE_BACKUP_CREDENTIAL_VALIDATION")
const validatorRoot = mkdtempSync(join(tmpdir(), "mfms-production-backup-validator-"))
try {
  const accessValidatorPath = join(validatorRoot, "validate_access.py")
  const credentialValidatorPath = join(validatorRoot, "validate_credential.py")
  writeFileSync(accessValidatorPath, `${accessValidator}\n`, "utf8")
  writeFileSync(credentialValidatorPath, `${credentialValidator}\n`, "utf8")

  const validAccess = {
    database: "mfms_server_prod",
    role: "mfms_backup",
    role_exists: true,
    role_can_login: true,
    role_superuser: false,
    role_createdb: false,
    role_createrole: false,
    role_replication: false,
    role_bypassrls: false,
    server_major: 16,
    connect_allowed: true,
    missing_schema_usage: 0,
    missing_table_select: 0,
    missing_sequence_select: 0,
    large_objects: 0,
    rls_tables: 0,
  }
  const accessReportPath = join(validatorRoot, "access.json")
  const validateAccess = (payload, database = "mfms_server_prod", role = "mfms_backup") => {
    writeFileSync(accessReportPath, JSON.stringify(payload), "utf8")
    return runPython(accessValidatorPath, [accessReportPath, database, role, 16])
  }
  assert.equal(validateAccess(validAccess).status, 0)
  assert.notEqual(validateAccess({ ...validAccess, role_can_login: false }).status, 0)
  assert.notEqual(validateAccess({ ...validAccess, database: "mfms_server_uat" }).status, 0)
  assert.notEqual(validateAccess({ ...validAccess, role: "harvest_app" }).status, 0)
  assert.notEqual(validateAccess({ ...validAccess, missing_table_select: 1 }).status, 0)

  if (process.platform !== "win32" && typeof process.getuid === "function" && typeof process.getgid === "function") {
    const ownerUid = process.getuid()
    const runnerGid = process.getgid()
    const rootDir = join(validatorRoot, "mfms-production")
    const backupDir = join(rootDir, "backup")
    const credentialPath = join(backupDir, "mfms_backup.env")
    mkdirSync(rootDir, { mode: 0o755 })
    mkdirSync(backupDir, { mode: 0o750 })
    chmodSync(rootDir, 0o755)
    chmodSync(backupDir, 0o750)
    writeFileSync(credentialPath, "MFMS_BACKUP_PASSWORD=test-only-value\n", { mode: 0o640 })
    chmodSync(credentialPath, 0o640)
    const validateCredential = (path = credentialPath, expectedUid = ownerUid) => runPython(
      credentialValidatorPath,
      [path, expectedUid, runnerGid, runnerGid],
    )

    assert.equal(validateCredential().status, 0)
    assert.notEqual(validateCredential(join(backupDir, "missing.env")).status, 0)
    assert.notEqual(validateCredential(credentialPath, ownerUid + 1).status, 0)
    chmodSync(credentialPath, 0o660)
    assert.notEqual(validateCredential().status, 0)
    chmodSync(credentialPath, 0o640)

    const symlinkPath = join(backupDir, "linked.env")
    symlinkSync(credentialPath, symlinkPath)
    assert.notEqual(validateCredential(symlinkPath).status, 0)

    writeFileSync(credentialPath, "WRONG_KEY=test-only-value\n", "utf8")
    chmodSync(credentialPath, 0o640)
    assert.notEqual(validateCredential().status, 0)
    writeFileSync(credentialPath, "MFMS_BACKUP_PASSWORD=test-only-value\nEXTRA=value\n", "utf8")
    chmodSync(credentialPath, 0o640)
    assert.notEqual(validateCredential().status, 0)
  }
} finally {
  rmSync(validatorRoot, { recursive: true, force: true })
}

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
