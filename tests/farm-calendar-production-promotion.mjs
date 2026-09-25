import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const previewVerifiedFiles = [
  "app/api/coconut-counting-admin/cycles/[cycle]/plots/[plot]/harvested/route.ts",
  "app/api/coconut-counting/reconciliation/route.ts",
  "app/coconut-counting/page.tsx",
  "components/coconut-counting/harvested-editor.tsx",
  "components/coconut-counting/reconciliation-table.tsx",
  "lib/coconut-counting-reconciliation-api.ts",
  "lib/coconut-counting-reconciliation.ts",
  "lib/coconut-counting-write-gate.ts",
  "tests/coconut-counting-cycle-plot.mjs",
]
const productionAdaptations = [
  "deploy/production-release-manifest.json",
  "lib/coconut-counting-write-policy.ts",
  "package.json",
  "tests/coconut-counting-reconciliation.mjs",
  "tests/farm-calendar-production-promotion.mjs",
]

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Deploy deterministic Coconut Counting reconciliation and preserve the restored Cycle View",
)
assert.equal(manifest.base_commit, "e166016b12b4faf2a51bd94f4791cb91ac68072c")
assert.deepEqual(manifest.preview_approved, {
  revision: "ed727cc9f5fc89c8fdb2fdd667111a1be2433fff",
  image_id: "sha256:99bd923b7524ec22f40f51f630440f025b691262331b21da223b4b728fd011c2",
  feature_revision: "ed727cc9f5fc89c8fdb2fdd667111a1be2433fff",
  verified_files: previewVerifiedFiles,
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
    ...previewVerifiedFiles,
    ...productionAdaptations,
  ])].sort(),
  "The Production release allowlist must exactly match the verified files and adaptations",
)

const harvestedWritePolicy = read("lib/coconut-counting-write-policy.ts")
assert.match(
  harvestedWritePolicy,
  /COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL\s*=\s*\n\s*"APPROVE_MFMS_COCONUT_COUNTING_HARVESTED_WRITES_V1" as const/,
  "Production must carry the exact reviewed source approval for Harvested writes",
)
assert.doesNotMatch(
  harvestedWritePolicy,
  /PREVIEW_SOURCE_POLICY__PRODUCTION_HARVESTED_WRITES_DISABLED/,
  "Production must not retain Preview's disabled write-policy marker",
)

const preservedCycleViewSha256 = {
  "app/coconut-harvest/cycle-view/page.tsx": "52d30349241a198664219eaadb01d3bc69d54ae79c3181ea8c9ab722adc4abb6",
  "lib/coconut-harvest-api.ts": "d05788fd536c442e50260212739bb0a9fbe42aff05b564bbf3b2ae1c455adba6",
  "lib/coconut-harvest-data.ts": "433af9a7b3dd28f60270b3713ac1cd5197ef9d25f24dc06a8724853fb52a4bb3",
  "lib/cycle-view-plot-breakdown.ts": "43243e17681cab0f2eb9fce3824301c2166bc401eddbac80979bf91f7b7cb1e6",
  "tests/cycle-view-plot-breakdown.mjs": "fe5b3eb4c3138b5f14e46d3037aa7b31609e86634c30727892ba1785c5654788",
}
for (const [path, expected] of Object.entries(preservedCycleViewSha256)) {
  assert.equal(sha256(path), expected, `The restored Cycle View contract changed: ${path}`)
  assert.equal(
    manifest.allowed_paths.includes(path),
    false,
    `The Coconut Counting release must not allow changes to Cycle View: ${path}`,
  )
}

const vercel = JSON.parse(read("vercel.json"))
assert.deepEqual(vercel.git.deploymentEnabled, {
  "codex/coconut-counting-production-correction-20260831": false,
  "codex/production-home-session-20260918": false,
  "codex/production-home-session-controls-20260918": false,
  "codex/frontend-alignment-ed62dfa-20260925-a7f3": false,
  "codex/intelligence-rate-limit-response-20260924": false,
  "production-release": false,
  "codex/beetle-lure-comparison-20260925": false,
    "codex/beetle-lure-visual-release-20260925": false,
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

console.log("Coconut Counting reconciliation release and restored Cycle View contracts: PASS")
