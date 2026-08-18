import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import { irrigationEnvironmentCopy } from "../lib/public-environment.ts"

for (const [environment, database, databaseName, liveDataBadge] of [
  ["preview", "mfms_server_uat", "Preview database", "LIVE PREVIEW DATABASE DATA"],
  ["production", "mfms_server_prod", "Production database", "LIVE PRODUCTION DATABASE DATA"],
  ["test", "mfms_server_test", "Test database", "LIVE TEST DATABASE DATA"],
]) {
  assert.deepEqual(irrigationEnvironmentCopy(environment, database), {
    databaseName,
    liveDataBadge,
  })
}

assert.deepEqual(irrigationEnvironmentCopy("preview", "mfms_server_prod"), {
  databaseName: "Unknown database",
  liveDataBadge: "LIVE UNKNOWN DATABASE DATA",
})

const page = await readFile("app/irrigation-management/page.tsx", "utf8")
const map = await readFile("components/irrigation/irrigation-map-with-details.tsx", "utf8")
const plan = await readFile("components/irrigation/irrigation-plan-tables.tsx", "utf8")

assert.match(map, /<Panel title="Farm Irrigation Table"/)
assert.doesNotMatch(map, /<Panel title="Farm Irrigation Map"/)
assert.match(page, /process\.env\.NEXT_PUBLIC_MFMS_ENV/)
assert.match(page, /process\.env\.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL/)
assert.match(page, /irrigationEnvironment\.liveDataBadge/)
assert.match(plan, /stored in the \{irrigationEnvironment\.databaseName\}\./)
assert.doesNotMatch(`${page}\n${plan}`, /stored in the Preview database|LIVE PREVIEW DATABASE DATA/)

console.log("irrigation environment copy tests passed")
