import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"
import {
  isDependentWorkerAccount,
  pairedDependentAccountCode,
} from "../lib/worker-balance-relationships.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const workerVerifiedFiles = [
  "components/worker-management/weekly-settlement.tsx",
  "lib/worker-balance-relationships.ts",
  "tests/worker-management.mjs",
  "tests/worker-wage-excel.mjs",
]
const workerProductionAdaptations = [
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
  "Promote Preview-accepted Worker balance carry-forward and historical read-only enforcement",
)
assert.equal(manifest.base_commit, "11228336667da252daf489f9ca4b20f2102bd9eb")
assert.deepEqual(manifest.preview_approved, {
  revision: "1d944e272d078899ef4b0c42a3e05cffd6a0c1c9",
  image_id: "sha256:da232fe4aab13452fd60a4648468ffb74ed5d3cdfd666de8736498dc7401c0c6",
  feature_revision: "3a7461860939288e183323688811bb50e1959a1e",
  prerequisite_feature_revision: "692f6a47fa65e998037db0ae6daff3107446e09d",
  matched_backend_revision: "28b180eb714d0526f69b3a37a58f615d8ba3d00c",
  verified_files: workerVerifiedFiles,
  production_adaptations: workerProductionAdaptations,
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
  [...new Set([...workerVerifiedFiles, ...workerProductionAdaptations])].sort(),
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

assert.equal(isDependentWorkerAccount("6"), true)
assert.equal(isDependentWorkerAccount("10"), true)
assert.equal(isDependentWorkerAccount("5"), false)
assert.equal(pairedDependentAccountCode("3"), "10")
assert.equal(pairedDependentAccountCode("5"), "6")
assert.equal(pairedDependentAccountCode("8"), null)

const settlement = read("components/worker-management/weekly-settlement.tsx")
assert.match(settlement, /money\(item\.opening_signed_balance\)/)
assert.match(settlement, /pairedDependentAccountCode\(row\.account_code\)/)
assert.match(settlement, /isDependentWorkerAccount\(row\.account_code\)/)
assert.match(settlement, /data\?\.week\.is_read_only !== true/)
assert.doesNotMatch(settlement, /current_signed_balance\) - signedCash/)
assert.doesNotMatch(settlement, /dependentWorkerNames/)

const workerWageTable = read("components/worker-management/weekly-wage-table-preview.tsx")
assert.match(workerWageTable, /Weekly wage sheet saved to the Production database\./)
assert.match(workerWageTable, /normaliseWeeklyWageEntry/)
assert.match(workerWageTable, /const workerRates = approvedWorkerRoster/)
assert.match(workerWageTable, /sort\(compareApprovedWorkerRoster\)/)
assert.match(workerWageTable, /fetchWorkWeeks/)
assert.match(workerWageTable, /selectedWeek\.readOnly/)
assert.match(workerWageTable, /settlement\?\.opening_signed_balance/)
assert.match(workerWageTable, /pairedDependentAccountCode\(row\.accountCode\)/)
assert.match(workerWageTable, /isDependentWorkerAccount\(row\.accountCode\)/)
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

console.log("Worker carry-forward and preserved Production promotion contracts: PASS")
