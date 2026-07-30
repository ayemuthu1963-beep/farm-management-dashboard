import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const component = readFileSync(resolve(root, "components/admin/harvest-sync-admin-client.tsx"), "utf8")
const proxy = readFileSync(resolve(root, "app/api/admin/harvest-sync/[[...path]]/route.ts"), "utf8")
const harvestCyclePage = readFileSync(resolve(root, "app/admin/harvest-cycle/page.tsx"), "utf8")
const harvestCycleDuplicates = readFileSync(
  resolve(root, "components/admin/harvest-cycle-duplicate-tree-entries.tsx"),
  "utf8",
)

assert.match(component, /Exact Duplicates — Automatically Resolved/)
assert.match(component, /exact_duplicate_group_count/)
assert.match(component, /exact_duplicate_superseded_count/)
assert.match(component, /exact_duplicate_retained_count/)
assert.match(component, /SUPERSEDED_EXACT_DUPLICATE/)
assert.match(component, /item\.classification === "DUPLICATE_REVIEW_REQUIRED"/)
assert.doesNotMatch(
  component,
  /\["DUPLICATE_REVIEW_REQUIRED",\s*"SUPERSEDED_EXACT_DUPLICATE"\]\.includes/,
  "Automatically resolved rows must not appear in the discrepancy list",
)
assert.match(component, /Download Pre-Import Audit CSV/)
assert.match(component, /\/audit\.csv/)
assert.match(component, /Review Final Import Set/)
assert.match(component, /Confirm Final Batch Import/)
assert.match(component, /confirmation_token/)
assert.match(component, /No Harvest record is inserted during scanning/)
assert.match(component, /PREVIEW REVIEW MODE — HARVEST IMPORT DISABLED/)
assert.match(component, /status\?\.importEnabled !== true/)
assert.match(component, /Harvest Import Disabled/)
assert.match(component, /Open Scan/)
assert.match(component, /Harvest Date/)
assert.match(component, /Tree Number Search/)
assert.match(component, /Natural ascending/)
assert.match(component, /CONFLICT_GROUP_PAGE_SIZE/)
assert.match(component, /ODK Instance/)
assert.match(component, /Submitter \/ Device/)
assert.match(component, /Single-Submission Records — Visible in Review Set/)
assert.match(component, /Cross-Date Cycle Safety Review/)
assert.match(component, /Cycle Safety Reviews/)
assert.match(component, /Save Supervisor Selection/)
assert.match(component, /decision: "SELECT_SUBMISSION"/)
assert.match(proxy, /response\.arrayBuffer\(\)/, "CSV proxying must preserve non-JSON responses")
assert.match(harvestCyclePage, /HARVEST_CYCLE_FETCH_ATTEMPTS = 2/)
assert.match(harvestCyclePage, /HARVEST_CYCLE_RETRY_DELAY_MS = 250/)
assert.match(harvestCyclePage, /response\.status < 500/)
assert.match(harvestCyclePage, /HarvestCycleDuplicateTreeEntries/)
assert.match(harvestCycleDuplicates, /APPROVED_DUPLICATE_SCAN_ID = 5/)
assert.match(harvestCycleDuplicates, /DISPLAY_ROW_LIMIT = 80/)
assert.match(harvestCycleDuplicates, /DUPLICATE_REVIEW_REQUIRED/)
assert.match(harvestCycleDuplicates, /SUPERSEDED/)
assert.match(harvestCycleDuplicates, /title="Duplicate Tree Entries"/)
for (const heading of ["Date", "Tree", "ODK Time", "B1", "B2", "B3", "Nuts", "Status", "Default Latest"]) {
  assert.match(harvestCycleDuplicates, new RegExp(`>${heading}<`))
}

console.log("Harvest Sync exact-duplicate UI contract checks passed.")
