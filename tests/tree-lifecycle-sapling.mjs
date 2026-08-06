import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  SAPLING_MONTHS,
  completedMonthsSincePlanted,
  resolveTreeLifecycleStatus,
} from "../lib/tree-lifecycle.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

assert.equal(SAPLING_MONTHS, 36)
assert.equal(completedMonthsSincePlanted("2023-08-03", "2026-08-02"), 35)
assert.equal(completedMonthsSincePlanted("2023-08-03", "2026-08-03"), 36)
assert.equal(completedMonthsSincePlanted("2025-02-28", "2026-02-27"), 11)
assert.equal(completedMonthsSincePlanted("2025-02-28", "2026-02-28"), 12)

assert.equal(resolveTreeLifecycleStatus("2023-08-03", "2026-08-02"), "Sapling")
assert.equal(resolveTreeLifecycleStatus("2023-08-03", "2026-08-03"), "Harvest Tree")
assert.equal(resolveTreeLifecycleStatus("2025-01-01", "2025-03-01", "FORCE_HARVEST"), "Harvest Tree")
assert.equal(resolveTreeLifecycleStatus(null, "2026-08-03"), "Harvest Tree")

const classifications = read("lib/coconut-harvest-data.ts")
assert.match(classifications, /"Future Better"/)
assert.match(classifications, /"Bench Player",\r?\n\s*"Future Better"/)

const performancePage = read("app/coconut-harvest/tree-performance/page.tsx")
assert.match(performancePage, /Plantation Date/)
assert.match(performancePage, /Months Since Planted/)
assert.match(performancePage, /isFutureBetter/)

const harvestApi = read("lib/coconut-harvest-api.ts")
assert.match(harvestApi, /fetchTreeLifecycleSaplings/)
assert.match(harvestApi, /\/api\/tree-lifecycle/)
assert.match(harvestApi, /mergeFutureBetterPerformance/)
assert.match(harvestApi, /Saplings under 36 completed months/)
assert.match(harvestApi, /detail\.lifecycle_status === "Sapling"/)
assert.match(harvestApi, /function lifecycleSaplingPlot/)
assert.match(harvestApi, /inferPlotFromTreeNumber\(sapling\.tree_no\)/)
assert.match(harvestApi, /lifecycleSaplingPlot\(sapling\) === plot/)
assert.match(harvestApi, /category: isFutureBetter \? "Future Better" : cleanCategory/)

const adminPage = read("app/admin/page.tsx")
assert.match(adminPage, /Tree Lifecycle \/ Saplings/)
assert.match(adminPage, /\/admin\/tree-lifecycle/)

const lifecycleRoute = read("app/api/admin/tree-lifecycle/route.ts")
assert.match(lifecycleRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(lifecycleRoute, /REPLACEMENT_PLANTED/)
assert.match(lifecycleRoute, /PROMOTE_EARLY_HARVEST/)
assert.match(lifecycleRoute, /RESTORE_AUTOMATIC/)

const lifecycleConsole = read("components/admin/tree-lifecycle-admin-client.tsx")
assert.match(lifecycleConsole, /Replacement → Make Sapling/)
assert.match(lifecycleConsole, /Early Bearing → Harvest Tree/)
assert.match(lifecycleConsole, /Return to Automatic Rule/)
assert.match(lifecycleConsole, /Previous harvest history is retained but excluded before the current planting date/)
assert.match(lifecycleConsole, /Import Plantation Dates from Excel/)
assert.match(lifecycleConsole, /Months Since Planted/)
assert.match(lifecycleConsole, /Validate Workbook/)

const importValidationRoute = read("app/api/admin/tree-lifecycle/import/validate/route.ts")
assert.match(importValidationRoute, /getPreviewAdminTargetSafetyErrors/)
assert.match(importValidationRoute, /tree-lifecycle\/import\/validate/)

const importApplyRoute = read("app/api/admin/tree-lifecycle/import/apply/route.ts")
assert.match(importApplyRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(importApplyRoute, /tree-lifecycle\/import\/apply/)

console.log("Tree lifecycle and Sapling / Future Better invariants: PASS")
