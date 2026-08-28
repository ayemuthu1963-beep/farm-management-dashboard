import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  JACKFRUIT_NUTMEG_PUMP_LITRES_PER_HOUR,
  STANDARD_PUMP_LITRES_PER_HOUR,
  pumpedLitresForRuntimeMinutes,
  pumpLitresPerHourForPlot,
} from "../lib/water-pump-rates.ts"
import {
  noRunsWithoutMeasuredRuntime,
  positiveMeasuredMotorRuntimeDays,
  projectPublicMotorNoRunRecords,
} from "../lib/motor-data.ts"
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
const irrigationUpstream = read("lib/irrigation-upstream.ts")
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
assert.match(motorRoute, /const projectedNoRunRecords = projectPublicMotorNoRunRecords/)
assert.match(motorRoute, /fetchAllMotorRuntimeEntries<RuntimeEntry>\(/)
assert.match(motorRoute, /responseLabel: "Motor Runtime API"/)
assert.doesNotMatch(motorRoute, /limit: "1000"/)
assert.match(motorRoute, /error instanceof MotorRuntimeUpstreamError/)
assert.match(motorRoute, /status: error\.status/)
assert.match(motorRoute, /NextResponse\.json\(error\.payload/)
assert.match(motorRoute, /const noRunRecords = noRunsWithoutMeasuredRuntime\([\s\S]*projectedNoRunRecords,[\s\S]*positiveMeasuredMotorRuntimeDays\(sortedEntries\)/)
assert.match(motorRoute, /noRunRecords\.filter\(\(record\) => record\.motorId === id\)/)
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
assert.match(irrigationRoute, /positiveMeasuredMotorRuntimeDays\(\[\.\.\.selectedRows, \.\.\.historyRows\]\)/)
assert.match(irrigationRoute, /buildData\([\s\S]*overlayNoRunRecords/)
assert.match(irrigationUpstream, /\/api\/motor-runtime\/entries/)
assert.doesNotMatch(irrigationUpstream, /\/api\/admin\/motor-runtime|management|analysis|import/i)
assert.match(charts, /<Legend content=\{<PerTreeLegend \/>\}/)
assert.match(harvestProxy, /rawSuffix === "status"/)
assert.match(harvestProxy, /NextResponse\.json/)
assert.match(motorRoute, /remarks: `Not run — \$\{formatKnownZeroDisplayReason\(record\.reason\)\}`/)
assert.match(motorRoute, /waterLifted: 0/)
assert.match(motorRoute, /confirmed_no_run_count: noRunRecords\.length/)
assert.match(motorRoute, /const operationalDates = Array\.from\(new Set\(\[/)
assert.match(motorRoute, /\.\.\.sortedEntries\.map\(\(entry\) => entry\.entry_date\)/)
assert.match(motorRoute, /\.\.\.noRunRecords\.map\(\(record\) => record\.date\)/)
assert.match(motorRoute, /first_entry_date: operationalDates\[0\] \?\? null/)
assert.match(motorRoute, /latest_entry_date: operationalDates\.at\(-1\) \?\? null/)
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
assert.deepEqual(
  noRunsWithoutMeasuredRuntime(publicNoRunRecords, [{ date: "2026-08-25", motorId: "M2" }]),
  [],
  "Motor Runtime suppresses a synthesized no-run row when that Motor/date has measured runtime",
)
assert.deepEqual(
  noRunsWithoutMeasuredRuntime(publicNoRunRecords, [{ date: "2026-08-25", motorId: "M1" }]),
  publicNoRunRecords,
  "a different Motor measurement does not suppress a valid no-run row",
)
const conflictingAdminAuditRecords = [
  { ...adminRecord("2026-08-25", 101), motor_id: "motor-1", reason: "M1 conflict" },
  { ...adminRecord("2026-08-25", 102), motor_id: "motor-2", reason: "M2 valid" },
]
const conflictingAdminAuditSnapshot = structuredClone(conflictingAdminAuditRecords)
const conflictNoRuns = projectPublicMotorNoRunRecords(conflictingAdminAuditRecords)
const positiveRuntimeDays = positiveMeasuredMotorRuntimeDays([
  { entry_date: "2026-08-25", motor_no: 1, total_minutes: 60 },
  { entry_date: "2026-08-25", motor_no: 1, total_minutes: 15 },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: 0 },
  { entry_date: "2026-08-25", motor_no: 2 },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: Number.NaN },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: "60" },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: -1 },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: 60, voided_at: "2026-08-25T10:00:00Z" },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: 60, workflow_status: "rejected" },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: 60, workflow_status: "draft" },
  { entry_date: "2026-08-25", motor_no: 2, total_minutes: 60, workflow_status: 123 },
  { entry_date: "2026-08-27", motor_no: 2, total_minutes: 60, workflow_status: "published" },
  { entry_date: "25/08/2026", motor_no: 2, total_minutes: 60 },
  { entry_date: "2026-08-25", motor_no: 4, total_minutes: 60 },
  { entry_date: "2026-08-26", motor_no: 3, total_minutes: 30 },
  null,
])
assert.deepEqual(positiveRuntimeDays, [
  { date: "2026-08-25", motorId: "M1" },
  { date: "2026-08-25", motorId: "M1" },
  { date: "2026-08-27", motorId: "M2" },
  { date: "2026-08-26", motorId: "M3" },
], "only positive canonical runtime rows become conflict evidence")
assert.deepEqual(
  noRunsWithoutMeasuredRuntime(conflictNoRuns, positiveRuntimeDays),
  [conflictNoRuns[1]],
  "an M1 runtime conflict suppresses only the M1/date no-run and preserves an unrelated valid M2 no-run",
)
assert.deepEqual(
  noRunsWithoutMeasuredRuntime(conflictNoRuns, positiveMeasuredMotorRuntimeDays([
    { entry_date: "2026-08-25", motor_no: 1, total_minutes: 0 },
    { entry_date: "2026-08-25", motor_no: 2, total_minutes: null },
  ])),
  conflictNoRuns,
  "zero and missing runtime are not proof that a Motor operated",
)
assert.deepEqual(conflictingAdminAuditRecords, conflictingAdminAuditSnapshot, "conflict filtering does not mutate authenticated Admin audit records")
assert.deepEqual(conflictingAdminAuditRecords.map(({ id, remarks, source, entered_by, created_at, voided_by, voided_at }) => ({
  id, remarks, source, entered_by, created_at, voided_by, voided_at,
})), conflictingAdminAuditSnapshot.map(({ id, remarks, source, entered_by, created_at, voided_by, voided_at }) => ({
  id, remarks, source, entered_by, created_at, voided_by, voided_at,
})), "complete Admin-only audit fields remain byte-for-byte unchanged")
assert.deepEqual(logCalls, [])
const serializedPublicResponse = JSON.stringify({ noRunRecords: publicNoRunRecords })
for (const value of Object.values(sentinels)) assert.doesNotMatch(serializedPublicResponse, new RegExp(value))
assert.doesNotMatch(serializedPublicResponse, /VOIDED_REASON_SENTINEL/)
assert.match(motorRoute, /projectPublicMotorNoRunRecords\(Array\.isArray\(rawNoRunPayload\) \? rawNoRunPayload : \[\]\)/)
assert.match(motorRoute, /noRunRecords\.filter\(\(record\) => record\.motorId === id\)/)
assert.match(motorRoute, /record\.date === date && record\.motorId === id/)
assert.doesNotMatch(motorRoute, /confirmed_no_run_count: projectedNoRunRecords\.length/)
assert.doesNotMatch(motorRoute, /noRunRecords: projectedNoRunRecords/)
assert.doesNotMatch(motorRoute, /first_entry_date: sortedEntries|latest_entry_date: sortedEntries/)
assert.doesNotMatch(motorRoute, /record\.(?:id|entered_by|created_at|updated_at|remarks|source|voided_by|voided_at|audit_timestamp)/)
assert.match(motorRoute, /headers: \{ "Cache-Control": "no-store" \}/)
assert.match(adminNoRunRoute, /return new NextResponse\(response\.body/)
assert.match(adminNoRunRoute, /"Cache-Control": "private, no-store"/)
assert.doesNotMatch(adminNoRunRoute, /projectPublicMotorNoRunRecords/)
assert.doesNotMatch(adminNoRunRoute, /noRunsWithoutMeasuredRuntime|positiveMeasuredMotorRuntimeDays/, "the authenticated Admin audit path is not conflict-filtered")
assert.match(managementApi, /entered_by: string/)
assert.match(managementApi, /created_at: string/)
assert.match(managementApi, /voided_by: string \| null/)
assert.match(managementApi, /voided_at: string \| null/)
assert.match(noRunPanel, /record\.remarks \|\| "—"/)
assert.match(noRunPanel, /record\.entered_by/)
assert.match(noRunPanel, /auditTime\(record\.created_at\)/)

console.log("Motor Runtime and shared water-pump rate regression passed")
