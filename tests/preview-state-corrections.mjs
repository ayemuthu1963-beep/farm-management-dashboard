import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const cycleClient = readFileSync(
  resolve(root, "components/admin/harvest-cycle-admin-client.tsx"),
  "utf8",
)

assert.doesNotMatch(cycleClient, /useState\("19"\)/)
assert.doesNotMatch(cycleClient, /useState\("2026-07-25"\)/)
assert.match(cycleClient, /function nextCycleNumber\(/)
assert.match(cycleClient, /Math\.max\(\.\.\.numericCycles\)/)
assert.match(cycleClient, /function nextCycleStartDate\(/)
assert.match(cycleClient, /nextDay\.setUTCDate\(nextDay\.getUTCDate\(\) \+ 1\)/)
assert.match(cycleClient, /was marked Locked\./)
assert.doesNotMatch(cycleClient, /was marked Completed\./)
assert.match(cycleClient, /No Harvest Cycle is currently Open\./)
assert.match(cycleClient, /disabled=\{!openCycle \|\| isSavingClose \|\| isRefreshing\}/)
assert.equal(
  (cycleClient.match(/disabled=\{!openCycle\}/g) ?? []).length,
  4,
  "every close-cycle input must be disabled when no cycle is Open",
)

console.log("Preview harvest cycle state corrections tests passed.")
