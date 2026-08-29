import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const workerRosterVerifiedFiles = [
  "components/worker-management/weekly-settlement.tsx",
  "lib/worker-management-roster.ts",
  "tests/worker-management.mjs",
]
const workerRosterProductionAdaptations = [
  "components/worker-management/weekly-wage-table-preview.tsx",
  "deploy/production-release-manifest.json",
  "tests/farm-calendar-production-promotion.mjs",
]
const workerHistoryVerifiedFiles = [
  "lib/worker-management-api.ts",
  "lib/worker-management-format.ts",
  "lib/worker-management-types.ts",
  "tests/worker-management.mjs",
]
const workerHistoryProductionAdaptations = [
  "components/worker-management/weekly-wage-table-preview.tsx",
  "deploy/production-release-manifest.json",
  "tests/farm-calendar-production-promotion.mjs",
]

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Promote Preview-verified Worker history, closed-week protection, and frozen opening-balance projection",
)
assert.equal(manifest.base_commit, "949661e3a0bd26111d5be0ea6db90e17cbcffcaa")
assert.deepEqual(manifest.preview_approved, {
  revision: "363f9d7814260db4b3f859f08fcccbbe9b34e398",
  image_id: "sha256:4570c0565f4c122a3c23d29b0046723900c0bb31c0fd456d13ee07160706b738",
  feature_revision: "81121da96e0908d36df2af737773cadd90379caa",
  verified_files: workerHistoryVerifiedFiles,
  production_adaptations: workerHistoryProductionAdaptations,
})
assert.deepEqual(manifest.preserved_worker_roster_order, {
  release_merge: "669f9fdc0db52c695a616cb84e3a701ee6602d54",
  candidate_head: "a0c8bfd400b8a9c13acdd70b1fb5d2fa9b103089",
  preview_revision: "af09ed8bea4c5949e600abcf705cd38ad7f7c09b",
  preview_image_id: "sha256:14cf934f6056c85d3a31dc7bc1ad57c7d8e81cee1e96a2d0be882529f510d03b",
  preview_feature_revision: "1074d0e7d572200497d79ac437d1babffd4ab02a",
  verified_files: workerRosterVerifiedFiles,
  production_adaptations: workerRosterProductionAdaptations,
})
assert.deepEqual(manifest.protected_invariants, {
  preview: "unchanged",
  test: "unchanged",
  backend: "unchanged",
  database: "unchanged",
  odk: "unchanged",
  schedules: "unchanged",
  proxy_configuration: "unchanged",
})
assert.deepEqual(
  manifest.allowed_paths,
  [...new Set([
    ...workerHistoryVerifiedFiles,
    ...workerHistoryProductionAdaptations,
  ])].sort(),
  "The Production release allowlist must exactly match the verified files and adaptations",
)

const workerManagement = mfmsNavigationItems.find((item) => item.id === "worker-management")
assert.ok(workerManagement)
assert.equal(workerManagement.href, "/worker-management")
assert.equal(workerManagement.status, "active")
assert.equal(workerManagement.ctaLabel, "Open Worker Management")

const workerWageTable = read("components/worker-management/weekly-wage-table-preview.tsx")
assert.match(workerWageTable, /Weekly wage sheet saved to the Production database\./)
assert.match(workerWageTable, /normaliseWeeklyWageEntry/)
assert.match(workerWageTable, /const workerRates = approvedWorkerRoster/)
assert.match(workerWageTable, /sort\(compareApprovedWorkerRoster\)/)
assert.match(workerWageTable, /fetchWorkWeeks/)
assert.match(workerWageTable, /selectedWeek\.readOnly/)
assert.match(workerWageTable, /settlement\?\.opening_signed_balance/)
assert.doesNotMatch(workerWageTable, /carryForwardPreviousBalances/)
assert.doesNotMatch(workerWageTable, /const missingApprovedRows = createInitialRows\(\)/)
assert.doesNotMatch(workerWageTable, /saved to the Preview database/)

assert.equal(
  sha256("public/mfms/icons/farm-map.svg"),
  "bf303b913b00660f88f45ab19838ce47b4b149971a4d7a7f0493ca72b28050a9",
  "The Farm Map SVG differs from the supplied Preview-approved icon",
)

const farmMap = mfmsNavigationItems.find((item) => item.id === "farm-map")
assert.ok(farmMap)
assert.equal(farmMap.label, "Farm Map")
assert.equal(farmMap.description, "Combined drone orthomosaic view of the farm")
assert.equal(farmMap.ctaLabel, "Open Map")
assert.equal(farmMap.href, "/farm-map")
assert.equal(farmMap.dashboardIcon, "/mfms/icons/farm-map.svg")
assert.equal(farmMap.showOnDashboard, true)
assert.doesNotMatch(farmMap.dashboardIcon, /(?:tap|faucet|pipeline)/i)
assert.deepEqual(
  mfmsNavigationItems
    .filter((item) => item.dashboardIcon === "/mfms/icons/farm-map.svg")
    .map((item) => item.id),
  ["farm-map"],
)

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

console.log("Worker Management and preserved Production promotion contracts: PASS")
