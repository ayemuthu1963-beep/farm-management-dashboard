import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const component = readFileSync(resolve(root, "components/admin/harvest-sync-admin-client.tsx"), "utf8")
const proxy = readFileSync(resolve(root, "app/api/admin/harvest-sync/[[...path]]/route.ts"), "utf8")

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
assert.match(proxy, /response\.arrayBuffer\(\)/, "CSV proxying must preserve non-JSON responses")

console.log("Harvest Sync exact-duplicate UI contract checks passed.")
