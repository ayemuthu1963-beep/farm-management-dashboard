import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"


const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")
const deploy = readText(".github/workflows/production-frontend-deploy.yml")
const rollback = readText(".github/workflows/production-frontend-rollback.yml")
const helper = readText("scripts/production-server-deploy.sh")

for (const workflow of [deploy, rollback]) {
  assert.match(workflow, /^\s*workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule|workflow_run):/m)
  assert.match(workflow, /^permissions:\n\s+contents: read$/m)
  assert.match(workflow, /^\s+group: mfms-production-server$/m)
  assert.match(workflow, /^\s+name: Production$/m)
  assert.match(workflow, /PRODUCTION_FRONTEND_DEPLOY_SSH_PRIVATE_KEY/)
  assert.match(workflow, /StrictHostKeyChecking=yes/)
  assert.match(workflow, /BatchMode=yes/)
  assert.match(workflow, /PasswordAuthentication=no/)
  assert.match(workflow, /KbdInteractiveAuthentication=no/)
  assert.match(workflow, /ServerAliveInterval=20/)
  assert.match(workflow, /ServerAliveCountMax=30/)
  assert.match(workflow, /TCPKeepAlive=yes/)
  assert.match(workflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
  for (const action of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    assert.match(action[1].split("@")[1], /^[0-9a-f]{40}$/)
  }
}

assert.match(deploy, /DEPLOY PRODUCTION FRONTEND ONLY/)
assert.match(deploy, /deploy-production-frontend \$CANDIDATE_REVISION \$EXPECTED_CURRENT_REVISION \$GITHUB_RUN_ID/)
assert.match(deploy, /production_source_matches_preview=true/)
assert.match(deploy, /preview_approved_image_id=sha256/)
assert.match(deploy, /production_frontend_touched=1/)
assert.match(rollback, /ROLL BACK PRODUCTION FRONTEND/)
assert.match(rollback, /rollback-production-frontend \$CURRENT_REVISION \$GITHUB_RUN_ID/)

assert.match(helper, /readonly release_ref="refs\/heads\/production-release"/)
assert.match(helper, /readonly live_container="mfms-v0-preview-web"/)
assert.match(helper, /readonly preview_container="mfms-pilot-web"/)
assert.match(helper, /readonly backend_container="harvest-api"/)
assert.match(helper, /readonly live_port="3014"/)
assert.match(helper, /readonly candidate_port="3013"/)
assert.match(helper, /readonly expected_running_containers="21"/)
assert.match(helper, /172\.19\.0\.2/)
assert.match(helper, /172\.19\.128\.0\/17/)
assert.match(helper, /mfms_prod_app\|mfms_server_prod/)
assert.match(helper, /mfms_uat_app\|mfms_server_uat/)
assert.match(helper, /mfms_test_app\|mfms_server_test/)
assert.match(helper, /systemctl --failed/)
assert.match(helper, /candidate is not the exact production-release head/)
assert.match(helper, /candidate does not contain the live Production baseline/)
assert.match(helper, /deploy\/production-release-manifest\.json/)
assert.match(helper, /live Preview image differs from the approved artifact/)
assert.match(helper, /Production source differs from Preview-approved file/)
assert.match(helper, /preview_feature_revision/)
assert.match(helper, /production_source_matches_preview=true/)
assert.match(helper, /coordinated-frontend-after-backend/)
assert.match(helper, /readonly coordinated_preview_revision="00ac7059f2110ea14b44508c5d4e6412d9bd8f1e"/)
assert.match(helper, /readonly coordinated_preview_feature_revision="a2948d51b6d85a6edc8c8577b52bdd03185cc7f4"/)
assert.match(helper, /readonly coordinated_preview_merge_base="a2948d51b6d85a6edc8c8577b52bdd03185cc7f4"/)
assert.match(helper, /readonly coordinated_candidate_revision="98f2a8b685b89b1f144b3a7918f8365328ab6831"/)
assert.match(helper, /readonly coordinated_candidate_tree="df66d0dd2c93b9baa321741acd4fec5ab5bddbc9"/)
assert.match(helper, /readonly coordinated_backend_revision="42aa24242565ef27c4aa434a579824e44e74e1ee"/)
assert.match(helper, /readonly coordinated_backend_container_id="016b4a1ed493ca712bf581b39136ba9c46802f9be7ff95ccaa59865ab5d6d607"/)
assert.match(helper, /readonly coordinated_backend_image_id="sha256:12661b0f748414b6314206070f881524d2c91b7dd0c19a7d726900e220486287"/)
assert.match(helper, /readonly coordinated_backend_environment_sha256="d4f79adfac2a47311efa4fc94e39ef966d46a5007486bfab088c52407b6f315a"/)
assert.match(helper, /readonly coordinated_frontend_baseline_revision="11d2a1493a7546328b5d7c2ee1bb002d7df0249b"/)
assert.match(helper, /readonly coordinated_frontend_baseline_container_id="7f701efa397478d20f74e7a07bf1be74dfe57ff3fccbeb287c55f6c51e8c2753"/)
assert.match(helper, /readonly coordinated_frontend_baseline_image_id="sha256:f4b44f015e09af5b40af98ee86b468e762f8a3ee7e124e3f85923edbed815eba"/)
assert.match(helper, /readonly coordinated_frontend_baseline_environment_sha256="ccedcc9c454bc1f4e5d13572d0458ddf75d64d29fd132a9a216aebeaccddd65b"/)
assert.match(helper, /readonly coordinated_frontend_baseline_ipv4="172\.19\.128\.7"/)
assert.match(helper, /mfms_server_prod-pre-42aa24242565ef27c4aa434a579824e44e74e1ee-20260819T001045Z\.dump/)
assert.match(helper, /readonly coordinated_backup_bytes="1775062"/)
assert.match(helper, /readonly coordinated_backup_sha256="3958e3f213c39d6a02a85c89152f72d841d7f4dc810f27e661d9d4ec6dff046a"/)
assert.match(helper, /87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1/)
assert.match(helper, /5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9/)
assert.match(helper, /server\[\[:space:\]\]\+mfms-v0-preview-web:3000/)
assert.match(helper, /proxy_pass\[\[:space:\]\]\+http:\/\/mfms_production_frontend/)
assert.match(helper, /path is outside the approved Production frontend source scope/)
assert.match(helper, /docker build/)
assert.match(helper, /--pull=false/)
assert.match(helper, /AUTOMATIC_RESTORE=/)
assert.match(helper, /PRODUCTION_DEPLOYMENT=PASS/)
assert.match(helper, /PRODUCTION_ROLLBACK=PASS/)
assert.doesNotMatch(helper, /docker\s+compose\b/)
assert.doesNotMatch(helper, /\bsudo\b/)
assert.doesNotMatch(helper, /nginx\s+-s\s+reload/)
assert.doesNotMatch(helper, /certbot/)
assert.doesNotMatch(helper, /production_touched=0/)

const approvedVerifiedFiles = [
  "tests/fertiliser-master-management.mjs",
]
const approvedProductionAdaptations = [
  "app/fertiliser-management/page.tsx",
  "deploy/production-release-manifest.json",
  "tests/farm-calendar-production-promotion.mjs",
]
const approvedAllowedPaths = [
  "app/fertiliser-management/page.tsx",
  "deploy/production-release-manifest.json",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/fertiliser-master-management.mjs",
]
const approvedRuntimePaths = [
  "app/fertiliser-management/page.tsx",
]
const approvedProvenanceRows = [
  "tests/fertiliser-master-management.mjs|e6ced2c6d369e4790e15e25406321302601ed9be|e6ced2c6d369e4790e15e25406321302601ed9be|49696b7a5c89979d01d0501e45fdaeda8a079a057d51e7e803d5b5d4ea388c2b|49696b7a5c89979d01d0501e45fdaeda8a079a057d51e7e803d5b5d4ea388c2b",
]

const coordinatedState = {
  candidate: "98f2a8b685b89b1f144b3a7918f8365328ab6831",
  tree: "df66d0dd2c93b9baa321741acd4fec5ab5bddbc9",
  backendRevision: "42aa24242565ef27c4aa434a579824e44e74e1ee",
  backendContainer: "016b4a1ed493ca712bf581b39136ba9c46802f9be7ff95ccaa59865ab5d6d607",
  backendImage: "sha256:12661b0f748414b6314206070f881524d2c91b7dd0c19a7d726900e220486287",
  backupSha256: "3958e3f213c39d6a02a85c89152f72d841d7f4dc810f27e661d9d4ec6dff046a",
  settingsSha256: "87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1",
  auditSha256: "5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9",
  frontendRevision: "11d2a1493a7546328b5d7c2ee1bb002d7df0249b",
  frontendContainer: "7f701efa397478d20f74e7a07bf1be74dfe57ff3fccbeb287c55f6c51e8c2753",
  frontendImage: "sha256:f4b44f015e09af5b40af98ee86b468e762f8a3ee7e124e3f85923edbed815eba",
  network: "harvest-net|172.19.128.7",
  endpointEvidence: "FERTILISER_GET200|FEFO|EXPIRED|NULL_LAST|ZERO_EXCLUDED|INACTIVE_EXCLUDED",
}
const coordinatedStateAccepted = (state) => Object.entries(coordinatedState)
  .every(([key, value]) => state[key] === value)
assert.equal(coordinatedStateAccepted(coordinatedState), true)
for (const key of Object.keys(coordinatedState)) {
  assert.equal(coordinatedStateAccepted({ ...coordinatedState, [key]: "changed" }), false)
}

const preflightFunction = helper.slice(helper.indexOf("preflight_production()"), helper.indexOf("deploy_production()"))
const coordinatedValidation = helper.slice(
  helper.indexOf("validate_coordinated_backup()"),
  helper.indexOf("validate_release_manifest()"),
)
const deployFunction = helper.slice(helper.indexOf("deploy_production()"), helper.indexOf("rollback_production()"))
assert.match(helper, /preflight-production-frontend \(\[0-9a-f\]\{40\}\) \(\[0-9a-f\]\{40\}\) \(\[0-9\]\+\)/)
assert.match(preflightFunction, /prepare_production_candidate/)
assert.match(preflightFunction, /traffic_switch=not-performed/)
assert.match(preflightFunction, /database_writes=none/)
assert.match(preflightFunction, /backend_replacement=none/)
assert.doesNotMatch(preflightFunction, /docker (?:build|run|start|stop|rename|rm)|curl[^\n]*-X\s*(?:PUT|POST|PATCH|DELETE)/)
assert.match(coordinatedValidation, /SET TRANSACTION READ ONLY/)
assert.match(coordinatedValidation, /mfms_production_schema_migrations/)
assert.match(coordinatedValidation, /mfms_irrigation_plan_settings/)
assert.match(coordinatedValidation, /mfms_irrigation_plan_audit/)
assert.match(coordinatedValidation, /mfms_irrigation_plan_audit_no_change/)
for (const table of [
  "fertiliser_categories",
  "fertiliser_products",
  "fertiliser_stock_batches",
  "fertiliser_stock_transactions",
  "fertiliser_transaction_allocations",
]) {
  assert.match(coordinatedValidation, new RegExp(table))
}
assert.match(coordinatedValidation, /authenticated fertiliser stock GET 200 evidence/)
assert.match(coordinatedValidation, /expired active positive-balance batch/)
assert.match(coordinatedValidation, /expired-before-later FEFO case/)
assert.match(coordinatedValidation, /dated-before-null FEFO case/)
assert.match(coordinatedValidation, /zero-balance exclusion case/)
assert.match(coordinatedValidation, /inactive product exclusion case/)
assert.match(coordinatedValidation, /eligible_available_quantity/)
assert.match(coordinatedValidation, /SET TRANSACTION READ ONLY/)
assert.doesNotMatch(coordinatedValidation, /urlopen\([^)]*data\s*=/)
assert.match(coordinatedValidation, /cmp -s "\$coordinated_database_before" "\$coordinated_database_after_read"/)
assert.match(deployFunction, /assert_coordinated_release_state_unchanged/)
assert.match(deployFunction, /deployment_kind=coordinated-frontend-after-backend/)
assert.match(deployFunction, /coordinated_fertiliser_data_fingerprint_verified=true/)
assert.match(deployFunction, /coordinated_fertiliser_api_verified=true/)
assert.match(helper, /cmp -s "\$coordinated_database_before" "\$coordinated_database_after_deploy"/)
assert.doesNotMatch(coordinatedValidation, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i)
assert.doesNotMatch(deployFunction, /apply_migrations|pg_dump|pg_restore|docker stop[^\n]*harvest-api|docker rename[^\n]*harvest-api/)

const manifestValidatorMatch = helper.match(/<<'PY_RELEASE_MANIFEST'\n([\s\S]*?)\nPY_RELEASE_MANIFEST/)
assert.ok(manifestValidatorMatch)
const validatorRoot = mkdtempSync(join(tmpdir(), "mfms-coordinated-frontend-"))
try {
  const validatorPath = join(validatorRoot, "validate.py")
  const manifestPath = join(validatorRoot, "manifest.json")
  const actualPath = join(validatorRoot, "actual.txt")
  writeFileSync(validatorPath, `${manifestValidatorMatch[1]}\n`, "utf8")
  writeFileSync(actualPath, `${approvedAllowedPaths.join("\n")}\n`, "utf8")
  const manifest = {
    schema_version: 1,
    environment: "Production",
    target_url: "https://muthufarms.com",
    deployment_kind: "coordinated-frontend-after-backend",
    base_commit: coordinatedState.frontendRevision,
    preview_approved: {
      revision: "00ac7059f2110ea14b44508c5d4e6412d9bd8f1e",
      image_id: "sha256:b0e5301a08386cf1defb78be947f8b07b95b85c43dee0b3895d0228affbc0220",
      feature_revision: "a2948d51b6d85a6edc8c8577b52bdd03185cc7f4",
      verified_files: approvedVerifiedFiles,
      production_adaptations: approvedProductionAdaptations,
    },
    protected_invariants: {
      preview: "unchanged",
      test: "unchanged",
      backend: "deployed-first-from-isolated-fertiliser-candidate",
      database: "unchanged",
      odk: "unchanged",
      schedules: "unchanged",
      proxy_configuration: "unchanged",
    },
    allowed_paths: approvedAllowedPaths,
  }
  const validateManifest = (payload, candidate = coordinatedState.candidate, tree = coordinatedState.tree) => {
    writeFileSync(manifestPath, JSON.stringify(payload), "utf8")
    return spawnSync("python3", [
      validatorPath,
      manifestPath,
      actualPath,
      coordinatedState.frontendRevision,
      candidate,
      tree,
    ], { encoding: "utf8" })
  }
  assert.equal(validateManifest(manifest).status, 0)
  assert.notEqual(validateManifest(manifest, "0".repeat(40)).status, 0)
  assert.notEqual(validateManifest(manifest, coordinatedState.candidate, "0".repeat(40)).status, 0)
  assert.notEqual(validateManifest({ ...manifest, base_commit: "0".repeat(40) }).status, 0)
  assert.notEqual(validateManifest({
    ...manifest,
    protected_invariants: { ...manifest.protected_invariants, backend: "unchanged" },
  }).status, 0)
  assert.notEqual(validateManifest({
    ...manifest,
    preview_approved: { ...manifest.preview_approved, revision: "0".repeat(40) },
  }).status, 0)
  assert.notEqual(validateManifest({
    ...manifest,
    preview_approved: { ...manifest.preview_approved, feature_revision: "0".repeat(40) },
  }).status, 0)
  assert.notEqual(validateManifest({
    ...manifest,
    preview_approved: { ...manifest.preview_approved, verified_files: approvedVerifiedFiles.slice(0, -1) },
  }).status, 0)
  assert.notEqual(validateManifest({
    ...manifest,
    preview_approved: { ...manifest.preview_approved, production_adaptations: approvedProductionAdaptations.slice(0, -1) },
  }).status, 0)
} finally {
  rmSync(validatorRoot, { recursive: true, force: true })
}

const provenanceValidatorMatch = helper.match(
  /<<'PY_COORDINATED_CONTENT_PROVENANCE'\n([\s\S]*?)\nPY_COORDINATED_CONTENT_PROVENANCE/,
)
assert.ok(provenanceValidatorMatch)
const provenanceRoot = mkdtempSync(join(tmpdir(), "mfms-content-provenance-"))
try {
  const validatorPath = join(provenanceRoot, "validate.py")
  const evidencePath = join(provenanceRoot, "evidence.tsv")
  const runtimePath = join(provenanceRoot, "runtime.txt")
  writeFileSync(validatorPath, `${provenanceValidatorMatch[1]}\n`, "utf8")
  const exactIdentity = [
    "coordinated-frontend-after-backend",
    "00ac7059f2110ea14b44508c5d4e6412d9bd8f1e",
    coordinatedState.candidate,
    coordinatedState.tree,
    "a2948d51b6d85a6edc8c8577b52bdd03185cc7f4",
    "a2948d51b6d85a6edc8c8577b52bdd03185cc7f4",
  ]
  const validateProvenance = ({
    identity = exactIdentity,
    rows = approvedProvenanceRows,
    runtime = approvedRuntimePaths,
  } = {}) => {
    writeFileSync(evidencePath, `${rows.join("\n")}\n`, "utf8")
    writeFileSync(runtimePath, `${runtime.join("\n")}\n`, "utf8")
    return spawnSync("python3", [
      validatorPath,
      ...identity,
      evidencePath,
      runtimePath,
    ], { encoding: "utf8" })
  }

  assert.equal(validateProvenance().status, 0)

  const changedByte = [...approvedProvenanceRows]
  changedByte[0] = changedByte[0].replace(
    "49696b7a5c89979d01d0501e45fdaeda8a079a057d51e7e803d5b5d4ea388c2b",
    "09696b7a5c89979d01d0501e45fdaeda8a079a057d51e7e803d5b5d4ea388c2b",
  )
  assert.notEqual(validateProvenance({ rows: changedByte }).status, 0)
  assert.notEqual(validateProvenance({ rows: approvedProvenanceRows.slice(0, -1) }).status, 0)
  assert.notEqual(validateProvenance({
    rows: [...approvedProvenanceRows, `extra.tsx|${"a".repeat(40)}|${"a".repeat(40)}|${"b".repeat(64)}|${"b".repeat(64)}`],
  }).status, 0)
  assert.notEqual(validateProvenance({
    rows: [approvedProvenanceRows[0].replace("tests/fertiliser-master-management.mjs", "tests/fertiliser-renamed.mjs")],
  }).status, 0)
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const changedIdentity = [...exactIdentity]
    changedIdentity[index] = index === 0 ? "frontend-only" : "0".repeat(40)
    assert.notEqual(validateProvenance({ identity: changedIdentity }).status, 0)
  }
  assert.notEqual(validateProvenance({ runtime: approvedRuntimePaths.slice(0, -1) }).status, 0)
  assert.notEqual(validateProvenance({ runtime: [...approvedRuntimePaths, "app/unapproved.tsx"] }).status, 0)
} finally {
  rmSync(provenanceRoot, { recursive: true, force: true })
}

const manifestFunction = helper.slice(
  helper.indexOf("validate_release_manifest()"),
  helper.indexOf("write_state()"),
)
assert.match(manifestFunction, /if \[\[ "\$candidate_revision" == "\$coordinated_candidate_revision" \]\]; then\n\s+validate_exact_coordinated_content_provenance\n\s+else\n\s+git -C "\$source_dir" merge-base --is-ancestor/)
assert.match(helper, /<\(git -C "\$source_dir" cat-file blob "\$preview_blob"\)/)
assert.match(helper, /<\(git -C "\$source_dir" cat-file blob "\$candidate_blob"\)/)
assert.doesNotMatch(manifestFunction, /if \[\[ "\$candidate_revision" != "\$coordinated_candidate_revision" \]\]; then\s+git -C "\$source_dir" merge-base --is-ancestor/)

console.log("Production frontend deployment and rollback workflow tests passed.")
