import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getPreviewAdminWriteSafetyErrors } from "../lib/preview-admin-write-safety.ts"
import { PUMP_LITRES_PER_HOUR, cropLitresPerTreePerHour } from "../lib/irrigation-data.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const livePreviewEnv = {
  MFMS_ENV: "preview",
  MFMS_ENABLE_LOCAL_WRITE_GUARD: "true",
  MFMS_TARGET_DATABASE: "mfms_server_uat",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_uat",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api-pilot",
  MFMS_LOCAL_WRITE_BACKEND_PORT: "8000",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api-pilot",
  MFMS_ALLOWED_BACKEND_PORT: "8000",
}

assert.deepEqual(
  getPreviewAdminWriteSafetyErrors(livePreviewEnv, "http://harvest-api-pilot:8000"),
  [],
)
assert.deepEqual(
  getPreviewAdminWriteSafetyErrors({ ...livePreviewEnv, MFMS_ENV: "uat" }, "http://harvest-api-pilot:8000"),
  [],
)

for (const [label, env, url] of [
  ["guard disabled", { ...livePreviewEnv, MFMS_ENABLE_LOCAL_WRITE_GUARD: "false" }, "http://harvest-api-pilot:8000"],
  ["production environment", { ...livePreviewEnv, MFMS_ENV: "production" }, "http://harvest-api-pilot:8000"],
  ["production database", { ...livePreviewEnv, MFMS_TARGET_DATABASE: "harvest", MFMS_LOCAL_WRITE_DATABASE: "harvest" }, "http://harvest-api-pilot:8000"],
  ["wrong host", { ...livePreviewEnv }, "http://harvest-api:8000"],
  ["wrong port", { ...livePreviewEnv }, "http://harvest-api-pilot:8001"],
  ["URL credentials", { ...livePreviewEnv }, "http://user:secret@harvest-api-pilot:8000"],
  ["expanded host allowlist", { ...livePreviewEnv, MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api-pilot,harvest-api" }, "http://harvest-api-pilot:8000"],
]) {
  assert.ok(getPreviewAdminWriteSafetyErrors(env, url).length > 0, `${label} must fail closed`)
}

const adminLanding = read("app/admin/page.tsx")
assert.match(adminLanding, /Operational Entry Pages/)
for (const route of ["/admin/motor-runtime", "/admin/well-water", "/admin/beetle-trap"]) {
  assert.match(adminLanding, new RegExp(route.replaceAll("/", "\\/")))
}

const motorPage = read("app/admin/motor-runtime/page.tsx")
const motorClient = read("components/admin/motor-runtime-admin-client.tsx")
const motorRoute = read("app/api/admin/motor-runtime/entries/route.ts")
assert.match(motorPage, /PreviewAdminNotice/)
assert.match(motorPage, /limit=20/)
assert.match(motorPage, /loadError/)
assert.match(motorPage, /getPreviewAdminTargetSafetyErrors/)
assert.match(motorClient, /Recent Motor Runtime Entries/)
assert.match(motorClient, /Plot 2 East/)
assert.match(motorClient, /motorNo: 3, valveNo: 13/)
assert.match(motorClient, /motorNo: 3, valveNo: 14/)
assert.match(motorClient, /motorNo: 3, valveNo: 15/)
assert.match(motorClient, /Runtime cannot be 0 hours and 0 minutes/)
assert.match(motorClient, /router\.refresh\(\)/)
assert.match(motorClient, /onSubmit=/)
assert.doesNotMatch(motorClient, /assets\/admin\/.*_icon\.png/)
assert.match(motorRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(motorRoute, /getPreviewAdminTargetSafetyErrors/)
assert.match(motorRoute, /Runtime cannot be 0 hours and 0 minutes/)
assert.match(motorRoute, /was entered more than once/)
assert.match(motorRoute, /invalid Motor Runtime save confirmation/)
assert.match(motorRoute, /Plot2_East:3/)
assert.match(motorRoute, /Jack_Fruit:3/)
assert.match(motorRoute, /export async function GET\(\)/)

const wellPage = read("app/admin/well-water/page.tsx")
const wellClient = read("components/admin/well-water-admin-client.tsx")
const wellSettingsRoute = read("app/api/admin/well-water/settings/route.ts")
const wellReadingsRoute = read("app/api/admin/well-water/readings/route.ts")
assert.match(wellPage, /PreviewAdminNotice/)
assert.match(wellPage, /api\/well-water\/summary/)
assert.match(wellPage, /api\/well-water\/settings/)
assert.match(wellPage, /getPreviewAdminTargetSafetyErrors/)
assert.match(wellClient, /North Well Settings/)
assert.match(wellClient, /South Well Settings/)
assert.match(wellClient, /Latest North Well Reading/)
assert.match(wellClient, /Latest South Well Reading/)
assert.match(wellClient, /Total Well Readings/)
assert.match(wellClient, /Well Settings Admin/)
assert.match(wellClient, /Manual Reading \/ Correction/)
assert.match(wellClient, /Correction Reading ID/)
assert.match(wellClient, /manual:well-water:/)
assert.match(wellClient, /onSubmit=/)
assert.doesNotMatch(wellClient, /<form action=/)
assert.ok((wellClient.match(/router\.refresh\(\)/g) ?? []).length >= 2)
assert.match(wellSettingsRoute, /api\/well-water\/settings/)
assert.match(wellSettingsRoute, /non-preserving Well Settings confirmation/)
assert.match(wellSettingsRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(wellReadingsRoute, /api\/well-water\/readings/)
assert.match(wellReadingsRoute, /Inches must be between 0 and 11/)
assert.match(wellReadingsRoute, /method: isCorrection \? "PATCH" : "POST"/)
assert.match(wellReadingsRoute, /manual:well-water:/)
assert.match(wellReadingsRoute, /getPreviewAdminWriteSafetyErrors/)

const beetlePage = read("app/admin/beetle-trap/page.tsx")
const beetleClient = read("components/admin/beetle-trap-admin-client.tsx")
const beetleSummaryRoute = read("app/api/admin/beetle-trap/route.ts")
const beetleResetRoute = read("app/api/admin/beetle-trap/pheromone-reset/route.ts")
const beetleLocationRoute = read("app/api/admin/beetle-trap/trap-location/route.ts")
const beetleCountsRoute = read("app/api/admin/beetle-trap/counts/route.ts")
assert.match(beetlePage, /PreviewAdminNotice/)
assert.match(beetlePage, /api\/beetle-trap\/dashboard/)
assert.match(beetlePage, /api\/beetle-trap\/locations/)
assert.match(beetlePage, /getPreviewAdminTargetSafetyErrors/)
assert.doesNotMatch(beetlePage, /totalTraps:\s*0/)
assert.match(beetleClient, /Save Pheromone Reset/)
assert.match(beetleClient, /Change Trap Type Only/)
assert.match(beetleClient, /Amend Trap Location/)
assert.match(beetleClient, /New Trap/)
assert.match(beetleClient, /Current Trap Locations/)
assert.equal((beetleClient.match(/router\.refresh\(\)/g) ?? []).length, 3)
assert.match(beetleClient, /onSubmit=/)
assert.doesNotMatch(beetleClient, /<form action=/)
assert.match(beetleSummaryRoute, /api\/beetle-trap\/dashboard/)
assert.match(beetleSummaryRoute, /api\/beetle-trap\/locations/)
assert.match(beetleSummaryRoute, /getPreviewAdminTargetSafetyErrors/)
assert.match(beetleSummaryRoute, /malformed Beetle Trap location data/)
assert.match(beetleResetRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(beetleResetRoute, /Asia\/Kolkata/)
assert.match(beetleLocationRoute, /Coordinates appear reversed/)
assert.match(beetleLocationRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(beetleLocationRoute, /Location amendments must never alter the existing trap type/)
assert.match(beetleLocationRoute, /invalid trap admin save confirmation/)
assert.match(beetleCountsRoute, /api\/beetle-trap\/counts/)
assert.doesNotMatch(beetleCountsRoute, /getPreviewAdminWriteSafetyErrors/)

const runtimeMinutes = 150
const runtimeHours = runtimeMinutes / 60
assert.equal(runtimeHours, 2.5)
assert.equal(runtimeHours * PUMP_LITRES_PER_HOUR, 125_000)
assert.equal(runtimeHours * cropLitresPerTreePerHour.Coconut, 250)
assert.equal(runtimeHours * cropLitresPerTreePerHour.Nutmeg, 200)
assert.equal(runtimeHours * cropLitresPerTreePerHour.Jackfruit, 150)

console.log("Preview admin entry workflow invariants: PASS")
