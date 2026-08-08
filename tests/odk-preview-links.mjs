import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const config = read("lib/odk-preview.ts")

assert.match(config, /PREVIEW_FIELD_COLLECTOR_PROJECT_ID = "23"/)
assert.match(config, /formId: "mfms_preview_well_water_test_v1"/)
assert.match(config, /publishedVersion: "20260723\.2"/)
assert.match(config, /formId: "mfms_preview_beetle_test_v1"/)
assert.match(config, /publishedVersion: "20260723\.1"/)
assert.match(config, /projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID/)
assert.match(config, /formId: "mfms_preview_harvest_test_v1"/)
assert.match(config, /publishedVersion: "20260827\.2"/)

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

const link = read("components/odk/odk-central-link.tsx")
const card = read("components/odk/preview-odk-source-card.tsx")
assert.match(link, /target="_blank"/)
assert.match(link, /rel="noopener noreferrer"/)
assert.match(card, /ODK Collect App User/)
assert.match(card, /authorised administration and submission review/)

console.log("ODK Preview link contract passed")
