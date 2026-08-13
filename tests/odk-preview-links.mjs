import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const config = read("lib/odk-preview.ts")

assert.match(config, /process\.env\.NEXT_PUBLIC_ODK_PROJECT_ID/)
assert.match(config, /mfmsEnvironment === "test"[\s\S]*?\? "24"/)
assert.match(
  config,
  /"22": \{ wellWater: "20260808\.1", beetleTrap: "20260808\.1", harvest: "20260808\.1" \}/,
)
assert.match(
  config,
  /"23": \{ wellWater: "20260723\.2", beetleTrap: "20260723\.1", harvest: "20260827\.2" \}/,
)
assert.match(
  config,
  /"24": \{ wellWater: "20260808\.1", beetleTrap: "20260808\.1", harvest: "20260808\.1" \}/,
)
assert.match(config, /formId: "mfms_preview_well_water_test_v1"/)
assert.match(config, /NEXT_PUBLIC_ODK_WELL_WATER_FORM_VERSION/)
assert.match(config, /formId: "mfms_preview_beetle_test_v1"/)
assert.match(config, /NEXT_PUBLIC_ODK_BEETLE_TRAP_FORM_VERSION/)
assert.match(config, /projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID/)
assert.match(config, /formId: "mfms_preview_harvest_test_v1"/)
assert.match(config, /NEXT_PUBLIC_ODK_HARVEST_FORM_VERSION/)

const expectedPlacements = [
  ["app/well-water/page.tsx", 'form="wellWater"'],
  ["components/beetle/beetle-trap-header-actions.tsx", 'form="beetleTrap"'],
  ["app/admin/well-water/page.tsx", 'form="wellWater"'],
  ["app/admin/beetle-trap/page.tsx", 'form="beetleTrap"'],
  ["app/admin/harvest-sync/page.tsx", 'form="harvest"'],
]

for (const [path, marker] of expectedPlacements) {
  assert.ok(read(path).includes(marker), `${path} must use the central ODK source configuration`)
}

const harvestSyncPage = read("app/admin/harvest-sync/page.tsx")
const harvestSyncWorkspace = read("components/admin/harvest-manual-review-workspace.tsx")
assert.match(harvestSyncPage, /ODK Project:<\/span> \{previewOdkForms\.harvest\.projectId\}/)
assert.match(harvestSyncPage, /Form:<\/span> \{previewOdkForms\.harvest\.formId\}/)
assert.match(harvestSyncWorkspace, /status\?\.projectId \?\? previewOdkForms\.harvest\.projectId/)
assert.match(harvestSyncWorkspace, /status\?\.formId \?\? previewOdkForms\.harvest\.formId/)
assert.doesNotMatch(harvestSyncPage, /ODK Project:<\/span> 17/)
assert.doesNotMatch(harvestSyncWorkspace, /status\?\.projectId \?\? 17/)

const link = read("components/odk/odk-central-link.tsx")
const card = read("components/odk/preview-odk-source-card.tsx")
assert.match(link, /target="_blank"/)
assert.match(link, /rel="noopener noreferrer"/)
assert.match(card, /ODK Collect App User/)
assert.match(card, /authorised administration and submission review/)

console.log("ODK Preview link contract passed")
