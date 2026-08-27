import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const verifiedFiles = [
  "app/api/worker-management/[[...path]]/route.ts",
  "app/worker-management/daily-attendance/page.tsx",
  "app/worker-management/dashboard/page.tsx",
  "app/worker-management/loan-register/page.tsx",
  "app/worker-management/page.tsx",
  "app/worker-management/query/page.tsx",
  "app/worker-management/weekly-settlement/page.tsx",
  "app/worker-management/workers/page.tsx",
  "components/worker-management/daily-attendance.tsx",
  "components/worker-management/daily-wage-entry.tsx",
  "components/worker-management/loan-register.tsx",
  "components/worker-management/weekly-settlement.tsx",
  "components/worker-management/worker-dashboard.tsx",
  "components/worker-management/worker-directory.tsx",
  "components/worker-management/worker-module-shell.tsx",
  "components/worker-management/worker-offline-provider.tsx",
  "components/worker-management/worker-query.tsx",
  "components/worker-management/worker-ui.tsx",
  "lib/worker-management-api.ts",
  "lib/worker-management-constants.ts",
  "lib/worker-management-format.ts",
  "lib/worker-management-offline.ts",
  "lib/worker-management-signing.ts",
  "lib/worker-management-types.ts",
  "lib/worker-wage-excel.ts",
  "public/worker-management-sw.js",
  "public/worker-management.webmanifest",
  "tests/worker-management-offline.mjs",
  "tests/worker-wage-excel.mjs",
]
const productionAdaptations = [
  "app/globals.css",
  "app/worker-management/daily-attendance/layout.tsx",
  "app/worker-management/dashboard/layout.tsx",
  "app/worker-management/layout.tsx",
  "app/worker-management/loan-register/layout.tsx",
  "app/worker-management/query/layout.tsx",
  "app/worker-management/weekly-settlement/layout.tsx",
  "app/worker-management/workers/layout.tsx",
  "components/worker-management/weekly-wage-table-preview.tsx",
  "deploy/production-release-manifest.json",
  "lib/mfms-navigation.ts",
  "package.json",
  "pnpm-lock.yaml",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/worker-management.mjs",
]
const motorVerifiedFiles = [
  "app/api/motor-runtime/dashboard/route.ts",
  "app/motor-runtime/page.tsx",
  "components/admin/motor-not-run-panel.tsx",
  "components/admin/motor-runtime-management-client.tsx",
  "components/motor/motor-table.tsx",
  "lib/motor-data.ts",
  "lib/motor-runtime-management-api.ts",
]
const motorProductionAdaptations = [
  "deploy/production-release-manifest.json",
  "tests/motor-runtime-water-pumped.mjs",
  "tests/motor-screenshot-analysis-real-workflow.mjs",
]

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Release preserved Worker Management plus Preview-verified explicit Motor Not Run records",
)
assert.equal(manifest.base_commit, "104da2e13744853fc14fcc70b1df66637601fbf3")
assert.deepEqual(manifest.preview_approved, {
  revision: "5cd080d427d22f55a2c5a0e32a819ace361b70cb",
  image_id: "sha256:0fe5e580423969f74429b3385ee0d64d4b41220db9a4e44384d4d93a4d7e9bb3",
  feature_revision: "297bdcbd26d7b59b68806a27f2acd6ee621e3ab4",
  verified_files: motorVerifiedFiles,
  production_adaptations: motorProductionAdaptations,
})
assert.deepEqual(manifest.preserved_worker_management, {
  release_merge: "7e2b31287cad84b118a7b2d39ccc3edb6276d67b",
  candidate_head: "84b8fcc7f172a3657ef487540ed2a598641eb296",
  preview_revision: "ac996cd91ee0e90dd805bd0172efa61d6666b22a",
  preview_image_id: "sha256:021989b84ccf1c1ba21224ea54156927f61ab6deb913e921d1e11e3a0ab7b4f0",
  preview_feature_revision: "52da897f1f4782fd285ae25ca225d7b09ca74b1a",
  verified_files: verifiedFiles,
  production_adaptations: productionAdaptations,
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
    ...verifiedFiles,
    ...productionAdaptations,
    ...motorVerifiedFiles,
    ...motorProductionAdaptations,
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
assert.match(workerWageTable, /function approvedAccountCode/)
assert.match(workerWageTable, /const missingApprovedRows = createInitialRows\(\)/)
assert.match(workerWageTable, /farmScheme: "TWO_OPTION"/)
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
