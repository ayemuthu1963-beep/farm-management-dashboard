import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"


const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const [
  identity,
  harvest,
  well,
  beetle,
  motorManagement,
  motorImports,
  motorEntries,
  cycleOpen,
  cycleClose,
  cycleSale,
] = await Promise.all([
  read("lib/mfms-admin-identity.ts"),
  read("app/api/admin/harvest-sync/[[...path]]/route.ts"),
  read("app/api/admin/well-water/sync/route.ts"),
  read("app/api/admin/beetle-trap/sync/route.ts"),
  read("app/api/admin/motor-runtime/management/[...path]/route.ts"),
  read("app/api/motor-screenshot-analysis/[...path]/route.ts"),
  read("app/api/admin/motor-runtime/entries/route.ts"),
  read("app/api/admin/harvest-cycle/open/route.ts"),
  read("app/api/admin/harvest-cycle/close/route.ts"),
  read("app/api/admin/harvest-cycle/sale-details/route.ts"),
])

assert.match(identity, /x-mfms-user/)
assert.match(identity, /MFMS_TRUST_PROXY_ACTOR_HEADERS/)
assert.match(identity, /X-MFMS-Authenticated-User-Signature/)
for (const route of [harvest, well, beetle, motorManagement, motorImports, motorEntries, cycleOpen, cycleClose, cycleSale]) {
  assert.match(route, /getAuthenticatedUserAssertionHeaders/)
}

assert.match(harvest, /getAdminTargetSafetyErrors/)
assert.match(harvest, /rawSuffix === "manual-import"/)
assert.match(well, /MFMS administrator authentication is required/)
assert.match(beetle, /getAdminTargetSafetyErrors/)

assert.match(motorManagement, /getAdminTargetSafetyErrors/)
assert.doesNotMatch(motorManagement, /writes are disabled in this frontend environment/)
assert.match(motorImports, /targetPath !== "excel-imports"/)
assert.match(motorImports, /targetPath\.startsWith\("excel-imports\/"\)/)
assert.match(motorImports, /screenshot OCR and text writes remain disabled/)

for (const cycleRoute of [cycleOpen, cycleClose, cycleSale]) {
  assert.match(cycleRoute, /MFMS_HARVEST_CYCLE_WRITES_ENABLED/)
  assert.match(cycleRoute, /getAdminTargetSafetyErrors/)
  assert.doesNotMatch(cycleRoute, /MFMS_ENABLE_PREVIEW_HARVEST_CYCLE_WRITES/)
}

console.log("Production input remediation contracts: PASS")
