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
assert.match(helper, /readonly coordinated_candidate_revision="9a577add2308b85637fcf05ee49b6274e19cc2dc"/)
assert.match(helper, /readonly coordinated_candidate_tree="e102fe82bdb6b009012933684c6db3d927f53a7a"/)
assert.match(helper, /readonly coordinated_backend_revision="94b28f17702e409e13d25e288fc5cd4b9bbef545"/)
assert.match(helper, /readonly coordinated_backend_container_id="969d9cab57c47c06716b3e94d858f3a56cd145a39280ca41c417b497647fef47"/)
assert.match(helper, /readonly coordinated_backend_image_id="sha256:55b070597e6ee195f50226e7a0e4834a2e64986b20c5d53fa758ee925f45f512"/)
assert.match(helper, /readonly coordinated_frontend_baseline_revision="e9833917c0a7fd190d933acb8cb234f60f5c8c65"/)
assert.match(helper, /readonly coordinated_frontend_baseline_container_id="2e8781b403c115b08a15faf0f88e75fca1faa8a6f055128365329e159a119436"/)
assert.match(helper, /readonly coordinated_frontend_baseline_image_id="sha256:6f3e81bef1f52c643e12c37a72b195d146a28e3f2eb6ca681cc6d9192b3081a8"/)
assert.match(helper, /readonly coordinated_frontend_baseline_ipv4="172\.19\.128\.7"/)
assert.match(helper, /mfms_server_prod-pre-94b28f17702e409e13d25e288fc5cd4b9bbef545-20260818T050946Z\.dump/)
assert.match(helper, /readonly coordinated_backup_bytes="1762112"/)
assert.match(helper, /readonly coordinated_backup_sha256="9ea00949fd57a579bbee1b6765f8faf7bc88268166bc05c5cc087088dcd47e13"/)
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

const coordinatedState = {
  candidate: "9a577add2308b85637fcf05ee49b6274e19cc2dc",
  tree: "e102fe82bdb6b009012933684c6db3d927f53a7a",
  backendRevision: "94b28f17702e409e13d25e288fc5cd4b9bbef545",
  backendContainer: "969d9cab57c47c06716b3e94d858f3a56cd145a39280ca41c417b497647fef47",
  backendImage: "sha256:55b070597e6ee195f50226e7a0e4834a2e64986b20c5d53fa758ee925f45f512",
  backupSha256: "9ea00949fd57a579bbee1b6765f8faf7bc88268166bc05c5cc087088dcd47e13",
  settingsSha256: "87e8171a9e2bcfa955c9ea904b2fea9f652da1a57b8326cfdf6fe31ab5287db1",
  auditSha256: "5f107665e1a8973c91c53c551aa038e099cea388e13f535a694d365896a335b9",
  frontendRevision: "e9833917c0a7fd190d933acb8cb234f60f5c8c65",
  frontendContainer: "2e8781b403c115b08a15faf0f88e75fca1faa8a6f055128365329e159a119436",
  frontendImage: "sha256:6f3e81bef1f52c643e12c37a72b195d146a28e3f2eb6ca681cc6d9192b3081a8",
  network: "harvest-net|172.19.128.7",
  endpointEvidence: "GET200|PUT200|GET200|PUT200",
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
assert.match(helper, /production-release-verification/)
assert.match(coordinatedValidation, /authenticated irrigation GET 200 evidence/)
assert.match(coordinatedValidation, /authenticated irrigation PUT 200 evidence/)
assert.match(coordinatedValidation, /\{"get", "put"\}\.issubset/)
assert.match(coordinatedValidation, /cmp -s "\$coordinated_database_before" "\$coordinated_database_after_read"/)
assert.match(deployFunction, /assert_coordinated_release_state_unchanged/)
assert.match(deployFunction, /deployment_kind=coordinated-frontend-after-backend/)
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
  writeFileSync(actualPath, "app/irrigation-management/page.tsx\n", "utf8")
  const manifest = {
    schema_version: 1,
    environment: "Production",
    target_url: "https://muthufarms.com",
    deployment_kind: "coordinated-frontend-after-backend",
    base_commit: coordinatedState.frontendRevision,
    preview_approved: {
      revision: "108314fee0f3ae0d7962e1a7f0d7b98866a75a5c",
      image_id: "sha256:d8cee1e9e591db1b1d35930ac0d89d1bf8b9e2ae2723722c5fe6e418832ec186",
      feature_revision: "04fd5664137809605721665cafd6ffaad4264ec9",
      verified_files: ["app/irrigation-management/page.tsx"],
    },
    protected_invariants: {
      preview: "unchanged",
      test: "unchanged",
      backend: "deployed-first-from-isolated-irrigation-candidate",
      database: "additive-production-irrigation-migrations-only",
      odk: "unchanged",
      schedules: "unchanged",
      proxy_configuration: "unchanged",
    },
    allowed_paths: ["app/irrigation-management/page.tsx"],
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
} finally {
  rmSync(validatorRoot, { recursive: true, force: true })
}

console.log("Production frontend deployment and rollback workflow tests passed.")
