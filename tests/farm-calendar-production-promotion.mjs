import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Include today in irrigation and water dashboard defaults, leaving missing values blank",
)
assert.equal(manifest.base_commit, "25937caa78a65201ba569e2a839ba8b9ca8582bd")
assert.deepEqual(manifest.preview_approved, {
  revision: "7cf302811f87f4db4be3248131289ac72aba54b7",
  image_id: "sha256:b3f4a156e539fd4d867bf0e8b70a13f66f152594fb80f0e83be0243d791164ae",
  feature_revision: "dde91ecec3ad92d5e8b4546db993e1815e5fe0f2",
  verified_files: [
    "app/api/irrigation-management/route.ts",
    "app/api/motor-runtime/dashboard/route.ts",
    "components/farm/date-range-selector.tsx",
    "components/farm/well-chart.tsx",
    "components/farm/well-table.tsx",
    "components/irrigation/irrigation-charts-hybrid.tsx",
    "components/irrigation/irrigation-map-with-details.tsx",
    "components/motor/motor-date-range-selector.tsx",
    "components/motor/motor-irrigation-trend.tsx",
    "lib/irrigation-data.ts",
    "lib/irrigation-period.ts",
    "lib/irrigation-schedule-comparison.ts",
    "lib/motor-data.ts",
    "lib/well-data.ts",
  ],
  production_adaptations: [
    "deploy/production-release-manifest.json",
    "tests/farm-calendar-production-promotion.mjs",
    "tests/irrigation-management-corrections.mjs",
    "tests/motor-runtime-water-pumped.mjs",
    "tests/well-water-authoritative-daily-values.mjs",
    "tests/well-water-page-corrections.mjs",
  ],
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

assert.equal(
  sha256("public/mfms/icons/farm-map.svg"),
  "bf303b913b00660f88f45ab19838ce47b4b149971a4d7a7f0493ca72b28050a9",
  "The Farm Map SVG differs from the supplied Preview-approved icon",
)

assert.deepEqual(manifest.allowed_paths, [
  "app/api/irrigation-management/route.ts",
  "app/api/motor-runtime/dashboard/route.ts",
  "components/farm/date-range-selector.tsx",
  "components/farm/well-chart.tsx",
  "components/farm/well-table.tsx",
  "components/irrigation/irrigation-charts-hybrid.tsx",
  "components/irrigation/irrigation-map-with-details.tsx",
  "components/motor/motor-date-range-selector.tsx",
  "components/motor/motor-irrigation-trend.tsx",
  "deploy/production-release-manifest.json",
  "lib/irrigation-data.ts",
  "lib/irrigation-period.ts",
  "lib/irrigation-schedule-comparison.ts",
  "lib/motor-data.ts",
  "lib/well-data.ts",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/irrigation-management-corrections.mjs",
  "tests/motor-runtime-water-pumped.mjs",
  "tests/well-water-authoritative-daily-values.mjs",
  "tests/well-water-page-corrections.mjs",
])

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

console.log("Dashboard date defaults and preserved Production promotion contracts: PASS")
