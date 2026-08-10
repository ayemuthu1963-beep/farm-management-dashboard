import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [page, header, syncRoute, markerRoute, mapArea] = await Promise.all([
  readFile(new URL("../app/beetle-trap/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-trap-header-actions.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/beetle-trap/sync/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/beetle-trap/markers/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-trap-map-area.tsx", import.meta.url), "utf8"),
])

assert.match(header, /Sync ODK Now/)
assert.match(header, /disabled=\{isSyncing\}/)
assert.match(header, /animate-spin/)
assert.match(header, /Latest successful sync:/)
assert.match(header, /router\.refresh\(\)/)
assert.match(header, /BEETLE_TRAP_DATA_UPDATED_EVENT/)
assert.match(syncRoute, /\/api\/admin\/beetle-trap\/sync/)
assert.match(syncRoute, /Preview\/UAT/)
assert.match(syncRoute, /x-mfms-user/)
assert.match(syncRoute, /basicAuthenticatedUsername/)
assert.match(syncRoute, /getAuthenticatedUserAssertionHeaders/)
assert.doesNotMatch(syncRoute, /ODK_API_PASSWORD|ODK_API_USERNAME/)
assert.match(markerRoute, /inspection_records/)
assert.match(mapArea, /inspectionRecords/)
assert.match(mapArea, /Cumulative Beetle Count Since Reset/)
assert.match(mapArea, />Date</)
assert.match(mapArea, />Beetle Count</)
for (const removedField of [
  "Trap Type:",
  "Latest Inspection Date:",
  "Latest Count:",
  "Records Count:",
  "Cumulative Count Start Date:",
  "Pheromone Lure Installed Date:",
]) {
  assert.doesNotMatch(mapArea, new RegExp(removedField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}

assert.ok(page.indexOf("<BeetleTrapMapArea>") < page.indexOf("<BeetleStatusTiles"))
assert.ok(mapArea.indexOf("{children}") < mapArea.indexOf("<TrapTable markers={markers} />"))
assert.match(page, /plot_1_rhinoceros/)
assert.match(page, /plot_1_red_palm_weevil/)
assert.match(page, /plot_2_rhinoceros/)
assert.match(page, /plot_2_red_palm_weevil/)
assert.match(page, /rowSpan=\{2\}>Date<\/th>/)
assert.match(page, /colSpan=\{2\}>Plot 1<\/th>/)
assert.match(page, /colSpan=\{2\}>Plot 2<\/th>/)
assert.match(page, /min-w-\[760px\]/)

console.log("Beetle Trap Preview/UAT amendment frontend contracts passed.")
