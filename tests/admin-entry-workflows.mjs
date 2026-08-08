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
  NEXT_PUBLIC_MFMS_ENV: "preview",
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

const productionCandidateEnv = {
  ...livePreviewEnv,
  MFMS_ENV: "production-candidate",
  NEXT_PUBLIC_MFMS_ENV: "production-candidate",
  MFMS_TARGET_DATABASE: "mfms_server_prod_candidate",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_prod_candidate",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api-prod-candidate",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api-prod-candidate",
}
assert.deepEqual(
  getPreviewAdminWriteSafetyErrors(
    productionCandidateEnv,
    "http://harvest-api-prod-candidate:8000",
  ),
  [],
)

const productionEnv = {
  ...livePreviewEnv,
  MFMS_ENV: "production",
  NEXT_PUBLIC_MFMS_ENV: "production",
  MFMS_TARGET_DATABASE: "mfms_server_prod",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_prod",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api",
}
assert.deepEqual(
  getPreviewAdminWriteSafetyErrors(productionEnv, "http://harvest-api:8000"),
  [],
)

const testEnv = {
  ...livePreviewEnv,
  MFMS_ENV: "test",
  NEXT_PUBLIC_MFMS_ENV: "test",
  MFMS_TARGET_DATABASE: "mfms_server_test",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_test",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api-test",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api-test",
}
assert.deepEqual(
  getPreviewAdminWriteSafetyErrors(testEnv, "http://harvest-api-test:8000"),
  [],
)

for (const [label, env, url] of [
  ["guard disabled", { ...livePreviewEnv, MFMS_ENABLE_LOCAL_WRITE_GUARD: "false" }, "http://harvest-api-pilot:8000"],
  ["cross-environment database", { ...livePreviewEnv, MFMS_ENV: "production" }, "http://harvest-api-pilot:8000"],
  ["cross-environment public label", { ...productionEnv, NEXT_PUBLIC_MFMS_ENV: "preview" }, "http://harvest-api:8000"],
  ["unapproved production database", { ...productionEnv, MFMS_TARGET_DATABASE: "harvest", MFMS_LOCAL_WRITE_DATABASE: "harvest" }, "http://harvest-api:8000"],
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
const motorClient = read("components/admin/motor-runtime-management-client.tsx")
const motorRoute = read("app/api/admin/motor-runtime/entries/route.ts")
const motorManagementRoute = read("app/api/admin/motor-runtime/management/[...path]/route.ts")
const motorManagementApi = read("lib/motor-runtime-management-api.ts")
assert.match(motorPage, /PreviewAdminNotice/)
assert.match(motorPage, /MotorRuntimeManagementClient/)
assert.match(motorClient, /Motor Runtime Management/)
assert.match(motorClient, /Import Excel/)
assert.match(motorClient, /All Events/)
assert.match(motorClient, /Review Runs/)
assert.match(motorClient, /Runtime History/)
assert.match(motorClient, /Daily Summary/)
assert.match(motorClient, /Confirm Motor/)
assert.match(motorClient, /inferMotor/)
assert.match(motorClient, /editableFromWorkbookRun/)
assert.match(motorClient, /getExcelImport/)
assert.match(motorClient, /existing import reopened/)
assert.match(motorClient, /unresolved notification-event discrepancies kept out of Review Runs/)
assert.match(motorClient, /are not treated as additional workbook runs/)
assert.match(motorClient, /sourceRuntimeSeconds/)
assert.match(motorClient, /Calculations use the displayed HH:MM values exactly; seconds are ignored without rounding/)
assert.match(motorClient, /workbookRunWarnings/)
assert.doesNotMatch(motorClient, /warnings: run\.parser_warning \? \[run\.parser_warning\] : \[\]/)
assert.match(motorClient, /Actual ON/)
assert.match(motorClient, /Actual OFF\/cutoff/)
assert.match(motorClient, /OFF next day/)
assert.match(motorClient, /Save Draft/)
assert.match(motorClient, /Save to History/)
assert.match(motorClient, /Add next plot/)
assert.match(motorClient, /voidManagedSession/)
assert.match(motorClient, /Legacy Manual Record Correction/)
assert.match(motorClient, /updateLegacyRuntimeEntry/)
assert.match(motorClient, /voidLegacyRuntimeEntry/)
assert.doesNotMatch(motorClient, /assets\/admin\/.*_icon\.png/)
assert.match(motorRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(motorRoute, /getPreviewAdminTargetSafetyErrors/)
assert.match(motorRoute, /Runtime cannot be 0 hours and 0 minutes/)
assert.match(motorRoute, /was entered more than once/)
assert.match(motorRoute, /invalid Motor Runtime save confirmation/)
assert.match(motorRoute, /Plot2_East:3/)
assert.match(motorRoute, /Jack_Fruit:3/)
assert.match(motorRoute, /export async function GET\(request: Request\)/)
assert.match(motorManagementRoute, /getPreviewAdminTargetSafetyErrors/)
assert.match(motorManagementRoute, /Local Motor Runtime writes require a loopback backend/)
assert.match(motorManagementRoute, /X-Content-Type-Options/)
assert.match(motorManagementApi, /publishManagedSession/)
assert.match(motorManagementApi, /voidManagedSession/)

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
assert.equal(runtimeHours * cropLitresPerTreePerHour.Nutmeg, 150)
assert.equal(runtimeHours * cropLitresPerTreePerHour.Jackfruit, 150)

console.log("Preview admin entry workflow invariants: PASS")
