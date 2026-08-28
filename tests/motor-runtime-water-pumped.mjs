import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  JACKFRUIT_NUTMEG_PUMP_LITRES_PER_HOUR,
  STANDARD_PUMP_LITRES_PER_HOUR,
  pumpedLitresForRuntimeMinutes,
  pumpLitresPerHourForPlot,
} from "../lib/water-pump-rates.ts"
import { projectPublicMotorNoRunRecords } from "../lib/motor-data.ts"
import {
  canApplyNoRunMutationCompletion,
  canVoidNoRunRecord,
  createLatestNoRunRequestGuard,
  failedNoRunDate,
  loadedNoRunDate,
  loadingNoRunDate,
  visibleNoRunRecords,
} from "../lib/motor-runtime-management-api.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const motorRoute = read("app/api/motor-runtime/dashboard/route.ts")
const motorTable = read("components/motor/motor-table.tsx")
const motorTrend = read("components/motor/motor-irrigation-trend.tsx")
const motorDates = read("components/motor/motor-date-range-selector.tsx")
const motorStatusCards = read("components/motor/motor-status-cards.tsx")
const motorPage = read("app/motor-runtime/page.tsx")
const operatorSettings = read("lib/operator-settings.ts")
const irrigationRoute = read("app/api/irrigation-management/route.ts")
const charts = read("components/irrigation/irrigation-charts-hybrid.tsx")
const harvestProxy = read("app/api/admin/harvest-sync/[[...path]]/route.ts")
const noRunPanel = read("components/admin/motor-not-run-panel.tsx")
const managementApi = read("lib/motor-runtime-management-api.ts")
const adminNoRunRoute = read("app/api/admin/motor-runtime/management/[...path]/route.ts")

assert.equal(STANDARD_PUMP_LITRES_PER_HOUR, 50_000)
assert.equal(JACKFRUIT_NUTMEG_PUMP_LITRES_PER_HOUR, 36_000)
assert.equal(pumpLitresPerHourForPlot("Plot1_West"), 50_000)
assert.equal(pumpLitresPerHourForPlot("Jack_Fruit"), 36_000)
assert.equal(pumpLitresPerHourForPlot("Nutmeg"), 36_000)
assert.equal(pumpLitresPerHourForPlot("Nutmug"), 36_000)
assert.equal(pumpedLitresForRuntimeMinutes(120, "Plot2_East"), 100_000)
assert.equal(pumpedLitresForRuntimeMinutes(120, "Jack_Fruit"), 72_000)
assert.equal(pumpedLitresForRuntimeMinutes(171, "Nutmug"), 102_600)

assert.match(motorRoute, /waterLifted: pumpedLitresForRuntimeMinutes/)
assert.match(motorRoute, /label: "Total Water Pumped"/)
assert.match(motorRoute, /const irrigationTrend = dateKeys\.map/)
assert.match(motorRoute, /selectedDateKeys\(startDate \?\? "", endDate \?\? ""\)/)
assert.match(motorRoute, /motorEntries\.length > 0 \? runtimeHours\(totalMinutes\) : confirmedNoRun \? 0 : null/)
assert.match(motorRoute, /dayEntries\.length > 0 \? runtimeHours\(totalMinutes\) : allMotorsConfirmedNoRun \? 0 : null/)
assert.match(motorDates, /const endDate = getFarmIsoDate\(0, now\)/)
assert.match(motorDates, /Math\.round\(\(end - start\) \/ 86_400_000\) \+ 1/)
assert.match(motorDates, /End Date = today\./)
assert.match(motorRoute, /totalWaterLitres: dayEntries\.length > 0/)
assert.match(motorRoute, /pumpedLitresForRuntimeMinutes\(entry\.total_minutes, entry\.plot\)/)
assert.match(motorTable, /Water Pumped/)
assert.match(motorTrend, /<Panel title="Daily Irrigation Trend">/)
assert.match(motorTrend, /yAxisId="water"/)
assert.match(motorTrend, /yAxisId="runtime"/)
assert.match(motorTrend, /dataKey="totalWaterLitres"/)
assert.match(motorTrend, /dataKey="totalRuntimeHours"/)
assert.match(motorPage, /<MotorIrrigationTrend data=\{data\.irrigationTrend\} \/>/)
assert.match(motorStatusCards, /<MotorSettings\s+motor=\{motor\}/)
assert.match(motorStatusCards, /Max Run Time :/)
assert.match(motorStatusCards, /RTC timer :/)
assert.match(motorStatusCards, /Current Setting :/)
assert.match(operatorSettings, /Array\.from\(\{ length: 4 \}/)
assert.match(motorStatusCards, /placeholder="HH"/)
assert.match(motorStatusCards, /placeholder="MM"/)
assert.match(motorStatusCards, /placeholder="\*\*\.\*"/)
assert.equal((motorStatusCards.match(/>3 Phase<\/span>/g) ?? []).length, 2)
assert.equal((motorStatusCards.match(/>2 Phase<\/span>/g) ?? []).length, 2)
assert.match(motorStatusCards, /xl:grid-cols-2 2xl:grid-cols-3/)
assert.match(motorStatusCards, /min-\[520px\]:grid-cols-\[minmax\(0,1\.45fr\)_minmax\(9rem,0\.75fr\)\]/)
assert.doesNotMatch(motorStatusCards, /@min-\[30rem\]/)
assert.match(irrigationRoute, /runtimeWater\(minutes, zoneId\)/)
assert.match(charts, /<Legend content=\{<PerTreeLegend \/>\}/)
assert.match(harvestProxy, /rawSuffix === "status"/)
assert.match(harvestProxy, /NextResponse\.json/)
assert.match(motorRoute, /remarks: `Not run — \$\{formatKnownZeroDisplayReason\(record\.reason\)\}`/)
assert.match(motorRoute, /waterLifted: 0/)
assert.match(motorRoute, /confirmed_no_run_count/)
assert.match(motorRoute, /noRunResponse\.status !== 404/)
assert.match(motorTable, /record\.status === "Not Run" \? "0 minutes"/)
assert.match(motorTable, /No data available for the selected period/)
assert.match(noRunPanel, /All Motors/)
assert.match(noRunPanel, /Date \(Asia\/Kolkata\)/)
assert.match(noRunPanel, /type="date" required disabled=\{mutating\}/)
assert.match(noRunPanel, /value="Not Run" readOnly/)
assert.match(noRunPanel, /placeholder="Heavy rain"/)
assert.match(noRunPanel, /Source: Manual Admin/)
assert.match(noRunPanel, /Entered by/)
assert.match(noRunPanel, /Audit timestamp \(IST\)/)
assert.match(managementApi, /createNoRunRecords/)
assert.match(managementApi, /voidNoRunRecord/)

const dateA = "2026-08-24"
const dateB = "2026-08-25"
const dateC = "2026-08-26"
const adminRecord = (date, id = 1) => ({
  id,
  operation_date: date,
  motor_id: "motor-1",
  status: "Not Run",
  reason: "Heavy rain",
  remarks: "ADMIN_REMARKS_RETAINED",
  source: "Manual_Admin",
  entered_by: "ADMIN_USERNAME_RETAINED",
  created_at: "2026-08-27T00:00:00Z",
  voided_by: null,
  voided_at: null,
})

const recordA = adminRecord(dateA)
let adminLoadState = loadedNoRunDate(dateA, [recordA])
assert.deepEqual(visibleNoRunRecords(adminLoadState, dateA), [recordA])
assert.equal(canVoidNoRunRecord(adminLoadState, dateA, recordA, null), true)

adminLoadState = loadingNoRunDate(dateB)
assert.deepEqual(visibleNoRunRecords(adminLoadState, dateB), [])
assert.equal(canVoidNoRunRecord(adminLoadState, dateB, recordA, null), false)
adminLoadState = failedNoRunDate(dateB, "DATE_B_LOAD_FAILED")
assert.deepEqual(visibleNoRunRecords(adminLoadState, dateB), [])
assert.equal(canVoidNoRunRecord(adminLoadState, dateB, recordA, null), false)
assert.equal(adminLoadState.error, "DATE_B_LOAD_FAILED")

const latestRequest = createLatestNoRunRequestGuard()
const requestA = latestRequest.begin(dateA)
const requestB = latestRequest.begin(dateB)
const requestC = latestRequest.begin(dateC)
let raceState = loadingNoRunDate(dateC)
const settle = (token, rows) => {
  if (latestRequest.isCurrent(token, dateC)) raceState = loadedNoRunDate(token.date, rows)
}
settle(requestB, [adminRecord(dateB, 2)])
settle(requestA, [adminRecord(dateA, 3)])
assert.deepEqual(visibleNoRunRecords(raceState, dateC), [])
settle(requestC, [adminRecord(dateC, 4)])
assert.deepEqual(visibleNoRunRecords(raceState, dateC).map((record) => record.operation_date), [dateC])
assert.deepEqual(visibleNoRunRecords(loadedNoRunDate(dateC, [adminRecord(dateA, 5)]), dateC), [])
assert.equal(latestRequest.isCurrent(requestA, dateC), false)
assert.equal(latestRequest.isCurrent(requestB, dateC), false)
assert.equal(latestRequest.isCurrent(requestC, dateC), true)

let mutationCompletionState = loadingNoRunDate(dateB)
if (canApplyNoRunMutationCompletion(dateA, dateB)) {
  mutationCompletionState = loadedNoRunDate(dateA, [recordA])
}
assert.equal(canApplyNoRunMutationCompletion(dateA, dateB), false)
assert.deepEqual(mutationCompletionState, loadingNoRunDate(dateB))
assert.equal(canVoidNoRunRecord(loadedNoRunDate(dateA, [recordA]), dateA, recordA, dateA), false)

assert.match(managementApi, /signal\?: AbortSignal/)
assert.match(managementApi, /cache: "no-store", signal/)
assert.match(noRunPanel, /activeLoadRef\.current\?\.abort\(\)/)
assert.match(noRunPanel, /requestGuardRef\.current\.invalidate\(\)/)
assert.match(noRunPanel, /requestGuardRef\.current\.isCurrent\(token, selectedDateRef\.current\)/)
assert.match(noRunPanel, /canApplyNoRunMutationCompletion\(originatingDate, selectedDateRef\.current\)/)
assert.match(noRunPanel, /No records or Void actions are shown until this date loads successfully\./)
assert.match(noRunPanel, /disabled=\{loading \|\| mutating\}/)
assert.doesNotMatch(noRunPanel, /disabled=\{busy\}/)
const immediateClear = noRunPanel.indexOf("setLoadState(loadingNoRunDate(nextDate))")
const selectedDateChange = noRunPanel.indexOf("setOperationDate(nextDate)")
assert.ok(immediateClear >= 0 && immediateClear < selectedDateChange)

const sentinels = {
  id: "PRIVATE_DATABASE_ID_SENTINEL",
  entered_by: "PRIVATE_ADMIN_USERNAME_SENTINEL",
  created_at: "PRIVATE_CREATED_TIMESTAMP_SENTINEL",
  updated_at: "PRIVATE_UPDATED_TIMESTAMP_SENTINEL",
  remarks: "PRIVATE_OPTIONAL_REMARKS_SENTINEL",
  source: "PRIVATE_SOURCE_SENTINEL",
  voided_by: "PRIVATE_VOID_USER_SENTINEL",
  voided_at: "PRIVATE_VOID_TIMESTAMP_SENTINEL",
  audit_timestamp: "PRIVATE_AUDIT_TIMESTAMP_SENTINEL",
  extra: "PRIVATE_BACKEND_EXTRA_SENTINEL",
}
const logCalls = []
const originalConsole = { log: console.log, warn: console.warn, error: console.error }
console.log = (...values) => logCalls.push(["log", ...values])
console.warn = (...values) => logCalls.push(["warn", ...values])
console.error = (...values) => logCalls.push(["error", ...values])
let publicNoRunRecords
try {
  publicNoRunRecords = projectPublicMotorNoRunRecords([
    {
      ...sentinels,
      operation_date: "2026-08-25",
      motor_id: "motor-2",
      status: "Not Run",
      reason: "Heavy rain",
      voided_at: null,
    },
    {
      ...sentinels,
      operation_date: "2026-08-26",
      motor_id: "motor-3",
      status: "Not Run",
      reason: "VOIDED_REASON_SENTINEL",
    },
  ])
} finally {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
}

assert.deepEqual(publicNoRunRecords, [{
  date: "2026-08-25",
  motorId: "M2",
  motorName: "Motor 2",
  status: "Not Run",
  reason: "Heavy rain",
  runtime: "0 minutes",
  water: "0 L",
}])
assert.deepEqual(Object.keys(publicNoRunRecords[0]), ["date", "motorId", "motorName", "status", "reason", "runtime", "water"])
assert.deepEqual(logCalls, [])
const serializedPublicResponse = JSON.stringify({ noRunRecords: publicNoRunRecords })
for (const value of Object.values(sentinels)) assert.doesNotMatch(serializedPublicResponse, new RegExp(value))
assert.doesNotMatch(serializedPublicResponse, /VOIDED_REASON_SENTINEL/)
assert.match(motorRoute, /projectPublicMotorNoRunRecords\(Array\.isArray\(rawNoRunPayload\) \? rawNoRunPayload : \[\]\)/)
assert.match(motorRoute, /noRunRecords\.filter\(\(record\) => record\.motorId === id\)/)
assert.match(motorRoute, /record\.date === date && record\.motorId === id/)
assert.doesNotMatch(motorRoute, /record\.(?:id|entered_by|created_at|updated_at|remarks|source|voided_by|voided_at|audit_timestamp)/)
assert.match(motorRoute, /headers: \{ "Cache-Control": "no-store" \}/)
assert.match(adminNoRunRoute, /return new NextResponse\(response\.body/)
assert.match(adminNoRunRoute, /"Cache-Control": "private, no-store"/)
assert.doesNotMatch(adminNoRunRoute, /projectPublicMotorNoRunRecords/)
assert.match(managementApi, /entered_by: string/)
assert.match(managementApi, /created_at: string/)
assert.match(managementApi, /voided_by: string \| null/)
assert.match(managementApi, /voided_at: string \| null/)
assert.match(noRunPanel, /record\.remarks \|\| "—"/)
assert.match(noRunPanel, /record\.entered_by/)
assert.match(noRunPanel, /auditTime\(record\.created_at\)/)

console.log("Motor Runtime and shared water-pump rate regression passed")
