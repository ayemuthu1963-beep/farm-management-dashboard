import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const farmMapVerifiedFiles = [
  "app/farm-map/page.tsx",
  "components/maps/farm-map-analytics.tsx",
  "components/maps/farm-map-client.tsx",
  "components/maps/farm-map-orthomosaic.tsx",
  "components/maps/farm-map-tree-search.tsx",
  "lib/farm-map-analytics.ts",
  "lib/farm-map-layer.ts",
  "lib/farm-map-trees.ts",
  "public/map-data/vector/jackfruit-trees-ffbcd4efe04a955b.geojson",
  "public/map-data/vector/nutmeg-trees-92968dc1573b3b2e.geojson",
  "tests/farm-map-three-crops.mjs"
]
const farmMapProductionAdaptations = [
  "app/layout.tsx",
  "deploy/production-release-manifest.json",
  "package.json",
  "pnpm-lock.yaml",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/farm-map-coconut-trees.mjs",
  "tests/tree-number-autocomplete.mjs"
]

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Display 3433 Coconut, Jackfruit and Nutmeg trees on the Preview-accepted full-farm orthomosaic",
)
assert.equal(manifest.base_commit, "9b63ab23165786495a38241f455f868f56043bec")
assert.deepEqual(manifest.preview_approved, {
  revision: "4f3780d564a4490dcee9841d9fa145fec6e5afe1",
  image_id: "sha256:01c20e14535b3937c6c0f62eb2ae682bab608194aff635d016687525f4b6b1f6",
  feature_revision: "b5b3ad81ae97bc75e7d8d426e7324c006fad71fe",
  verified_files: farmMapVerifiedFiles,
  production_adaptations: farmMapProductionAdaptations,
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
    ...farmMapVerifiedFiles,
    ...farmMapProductionAdaptations,
  ])].sort(),
  "The Production release allowlist must exactly match the verified files and adaptations",
)

const vercel = JSON.parse(read("vercel.json"))
assert.deepEqual(vercel.git.deploymentEnabled, {
  "codex/coconut-counting-production-correction-20260831": false,
})

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
assert.match(page, /publicEnvironmentIdentity/)
assert.match(page, /fertiliserDatabaseDescription/)
assert.match(page, /fertiliserLiveBadge/)
assert.doesNotMatch(page, /source: "mfms_server_uat"/)
assert.doesNotMatch(page, /No valid non-expired stock is available/)
assert.doesNotMatch(page, /uses only non-expired eligible stock/)
assert.doesNotMatch(page, /Expired, inactive, and zero-balance batches are excluded/)
assert.doesNotMatch(page, /Insufficient eligible stock/)

console.log("Farm Map release and preserved Production promotion contracts: PASS")
