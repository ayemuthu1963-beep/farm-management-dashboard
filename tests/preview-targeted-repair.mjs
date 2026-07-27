import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const admin = read("app/admin/page.tsx")
const adminNotice = read("components/admin/preview-admin-notice.tsx")
const wellDates = read("components/farm/date-range-selector.tsx")
const fertiliserPage = read("app/fertiliser-management/page.tsx")
const fertiliserApi = read("lib/fertiliser-api.ts")

assert.doesNotMatch(admin, /LOCAL TEST|mfms_local_test/)
assert.match(admin, /getPreviewEnvironmentLabel/)
assert.match(adminNotice, /PREVIEW \/ UAT/)
assert.match(adminNotice, /MFMS_TARGET_DATABASE/)

assert.doesNotMatch(wellDates, /2026-07-02|2026-07-06/)
assert.match(wellDates, /Asia\/Kolkata/)
assert.match(wellDates, /getDefaultWellDateRange/)
assert.match(wellDates, /shiftIsoDate\(endDate, -\(count - 1\)\)/)

for (const state of [
  "incomingStockErrors",
  "outgoingStockErrors",
  "stockAdjustmentErrors",
  "futureRequirementErrors",
]) {
  assert.match(fertiliserPage, new RegExp(`const \\[${state},`))
}
assert.doesNotMatch(fertiliserPage, /\bformErrors\b/)
assert.match(fertiliserPage, /productId <= 0/)
assert.match(fertiliserPage, /value=\{product\.productId \?\? product\.id\}/)
assert.match(fertiliserPage, /ID \{product\.productId\}/)
assert.match(fertiliserPage, /ID \{product\.product_id\}/)

assert.match(fertiliserApi, /Incoming stock save failed/)
assert.match(fertiliserApi, /Stock adjustment failed/)
assert.match(fertiliserApi, /Future requirement save failed/)
assert.match(fertiliserApi, /detailMessage/)

console.log("Preview targeted repair frontend invariants: PASS")
