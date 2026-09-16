import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const cycleViewVerifiedFiles = [
  "app/api/coconut-counting-admin/cycles/[cycle]/plots/[plot]/harvested/route.ts",
  "app/api/coconut-harvest/cycle-reconciliation/route.ts",
  "app/coconut-harvest/cycle-view/page.tsx",
  "components/coconut/cycle-reconciliation-table.tsx",
  "lib/coconut-counting-reconciliation.ts",
  "tests/cycle-view-reconciliation.mjs",
]
const cycleViewProductionAdaptations = [
  "deploy/production-release-manifest.json",
  "lib/coconut-harvest-api.ts",
  "lib/coconut-harvest-data.ts",
  "package.json",
  "tests/farm-calendar-production-promotion.mjs",
]

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Replace Cycle View harvest history with permanent Excel-format Cycle and Plot reconciliation",
)
assert.equal(manifest.base_commit, "e166016b12b4faf2a51bd94f4791cb91ac68072c")
assert.deepEqual(manifest.preview_approved, {
  revision: "4656d01e867eb9cb9f47242716071834db729d6c",
  image_id: "sha256:07a4863b254223e1773edbfb91065e5a57bba764656eb365d461c4419eee6f8c",
  feature_revision: "6d3bb7cb54c86c96d8b701080bcd3025db491058",
  verified_files: cycleViewVerifiedFiles,
  production_adaptations: cycleViewProductionAdaptations,
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
    ...cycleViewVerifiedFiles,
    ...cycleViewProductionAdaptations,
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

console.log("Cycle View plot breakdown release and preserved Production promotion contracts: PASS")
