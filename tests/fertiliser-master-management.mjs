import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const page = read("app/fertiliser-management/page.tsx")
const api = read("lib/fertiliser-api.ts")
const adjustmentTypeHandler = page.split("const handleAdjustmentTypeChange", 2)[1].split("const handleRequirementProductChange", 1)[0]

assert.doesNotMatch(page, /Read-only in FERT-04|validateDisabledMasterForm|Validate Disabled Form/)
assert.match(page, /createFertiliserProduct/)
assert.match(page, /createFertiliserCategory/)
assert.match(page, /deactivateFertiliserProduct/)
assert.match(page, /restoreFertiliserProduct/)
assert.match(page, /deactivateFertiliserCategory/)
assert.match(page, /restoreFertiliserCategory/)
assert.match(page, /function ProductMasterTable/)
assert.match(page, /function CategoryMasterTable/)
assert.match(page, /Products with stock or open requirements cannot be deactivated/)
assert.match(page, /masterStatusFilter/)
assert.match(page, /earliest expiry first, including expired batches; null-expiry batches last/)
assert.match(page, /Expired batches are included and allocated first by FEFO/)
assert.match(page, /Adjustment Out includes expired stock and allocates the oldest expiry first/)
assert.match(page, /adjustmentType !== "ADJUSTMENT_OUT".*eligible_available_quantity/)
assert.match(adjustmentTypeHandler, /value !== "ADJUSTMENT_OUT"/)
assert.match(adjustmentTypeHandler, /eligible_available_quantity/)
assert.match(adjustmentTypeHandler, /setAdjustmentProductId\(""\)/)
assert.match(adjustmentTypeHandler, /setAdjustmentUnit\(""\)/)
assert.doesNotMatch(page, /No valid non-expired stock is available/)
assert.doesNotMatch(page, /uses only non-expired eligible stock/)
assert.doesNotMatch(page, /Expired, inactive, and zero-balance batches are excluded/)
assert.doesNotMatch(page, /Insufficient eligible stock/)

assert.match(api, /masterProducts/)
assert.match(api, /masterCategories/)
assert.match(api, /active_only=false/)
assert.match(api, /\/api\/fertiliser\/products\/\$\{productId\}\/deactivate/)
assert.match(api, /\/api\/fertiliser\/categories\/\$\{categoryId\}\/restore/)

console.log("Fertiliser Product and Category Master management invariants: PASS")
