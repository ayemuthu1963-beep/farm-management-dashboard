import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "coordinated-frontend-after-backend")
assert.equal(
  manifest.release_note,
  "Allow expired fertiliser stock in Outgoing Stock and Adjustment Out",
)
assert.equal(manifest.base_commit, "11d2a1493a7546328b5d7c2ee1bb002d7df0249b")
assert.deepEqual(manifest.preview_approved, {
  revision: "00ac7059f2110ea14b44508c5d4e6412d9bd8f1e",
  image_id: "sha256:b0e5301a08386cf1defb78be947f8b07b95b85c43dee0b3895d0228affbc0220",
  feature_revision: "a2948d51b6d85a6edc8c8577b52bdd03185cc7f4",
  verified_files: [
    "tests/fertiliser-master-management.mjs",
  ],
  production_adaptations: [
    "app/fertiliser-management/page.tsx",
    "deploy/production-release-manifest.json",
    "tests/farm-calendar-production-promotion.mjs",
  ],
})
assert.deepEqual(manifest.protected_invariants, {
  preview: "unchanged",
  test: "unchanged",
  backend: "deployed-first-from-isolated-fertiliser-candidate",
  database: "unchanged",
  odk: "unchanged",
  schedules: "unchanged",
  proxy_configuration: "unchanged",
})

assert.equal(
  sha256("tests/fertiliser-master-management.mjs"),
  "49696b7a5c89979d01d0501e45fdaeda8a079a057d51e7e803d5b5d4ea388c2b",
  "The focused fertiliser regression test differs from the Preview-approved file",
)

assert.deepEqual(manifest.allowed_paths, [
  "app/fertiliser-management/page.tsx",
  "deploy/production-release-manifest.json",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/fertiliser-master-management.mjs",
])

const page = read("app/fertiliser-management/page.tsx")
const adjustmentTypeHandler = page.split("const handleAdjustmentTypeChange", 2)[1].split("const handleRequirementProductChange", 1)[0]

assert.match(page, /earliest expiry first, including expired batches; null-expiry batches last/)
assert.match(page, /Expired batches are included and allocated first by FEFO/)
assert.match(page, /Adjustment Out includes expired stock and allocates the oldest expiry first/)
assert.match(page, /adjustmentType !== "ADJUSTMENT_OUT".*eligible_available_quantity/)
assert.match(adjustmentTypeHandler, /value !== "ADJUSTMENT_OUT"/)
assert.match(adjustmentTypeHandler, /eligible_available_quantity/)
assert.match(page, /const mfmsEnvironmentLabel = process\.env\.NEXT_PUBLIC_MFMS_ENV_BANNER/)
assert.match(page, /const mfmsDatabaseLabel = process\.env\.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL/)
assert.doesNotMatch(page, /source: "mfms_server_uat"/)
assert.doesNotMatch(page, /No valid non-expired stock is available/)
assert.doesNotMatch(page, /uses only non-expired eligible stock/)
assert.doesNotMatch(page, /Expired, inactive, and zero-balance batches are excluded/)
assert.doesNotMatch(page, /Insufficient eligible stock/)

console.log("Expired fertiliser stock Preview-to-Production contract checks: PASS")
