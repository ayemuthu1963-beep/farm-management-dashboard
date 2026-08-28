import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

import {
  applyScheduledKnownZerosToTrend,
  applyScheduledKnownZerosToZones,
  formatKnownZeroActual,
  formatKnownZeroDisplayReason,
  noRunReasonForAllMotors,
} from "../lib/known-zero-data.ts"
import { emptyIrrigationData } from "../lib/irrigation-data.ts"
import {
  noRunsWithoutMeasuredRuntime,
  positiveMeasuredMotorRuntimeDays,
  projectPublicMotorNoRunRecords,
} from "../lib/motor-data.ts"
import {
  pipelineAssertionRole,
  PipelineIdentityError,
  resolveTrustedPipelineIdentity,
} from "../lib/irrigation-pipeline-identity.ts"
import { WorkerBffError } from "../lib/worker-management-signing.ts"
import {
  buildWellDashboardData,
  buildWellWaterCsv,
  emptyWellDashboardData,
  hasWellWaterExportData,
  toChartData,
} from "../lib/well-data.ts"

const activeNoRuns = projectPublicMotorNoRunRecords([
  { operation_date: "2026-08-25", motor_id: "motor-1", status: "Not Run", reason: " Heavy rain ", voided_at: null },
  { operation_date: "2026-08-25", motor_id: "motor-2", status: "Not Run", reason: "Heavy rain", voided_at: null },
  { operation_date: "2026-08-25", motor_id: "motor-3", status: "Not Run", reason: "Heavy rain", voided_at: null },
  { operation_date: "2026-08-26", motor_id: "motor-1", status: "Not Run", reason: "Heavy rain", voided_at: null },
  { operation_date: "2026-08-26", motor_id: "motor-2", status: "Not Run", reason: "Heavy rain", voided_at: null },
  { operation_date: "2026-08-26", motor_id: "motor-3", status: "Not Run", reason: "Heavy rain", voided_at: null },
  { operation_date: "2026-08-26", motor_id: "motor-1", status: "Not Run", reason: "Voided duplicate", voided_at: "2026-08-27T01:00:00Z" },
])

assert.equal(activeNoRuns.length, 6)
assert.deepEqual(Object.keys(activeNoRuns[0]), ["date", "motorId", "motorName", "status", "reason", "runtime", "water"])
assert.equal(noRunReasonForAllMotors(activeNoRuns, "2026-08-25", ["M1", "M2"]), "Heavy rain")
assert.equal(noRunReasonForAllMotors(activeNoRuns, "2026-08-26", ["M1"]), "Heavy rain")
assert.equal(formatKnownZeroActual("Heavy rain"), "0 L/tree — Not run: Heavy rain")
assert.equal(formatKnownZeroActual("rains"), "0 L/tree — Not run: Heavy rain")
assert.equal(formatKnownZeroActual("Heavy Rains"), "0 L/tree — Not run: Heavy rain")
assert.equal(formatKnownZeroActual("heavy rain"), "0 L/tree — Not run: Heavy rain")
assert.equal(formatKnownZeroDisplayReason("rains / Heavy Rains"), "Heavy rain")
assert.equal(formatKnownZeroDisplayReason("rains / Power failure"), "Heavy rain / Power failure")
assert.equal(formatKnownZeroDisplayReason("rains / Pump/valve fault"), "Heavy rain / Pump/valve fault")
assert.equal(formatKnownZeroDisplayReason("N/A"), "N/A")
assert.equal(formatKnownZeroDisplayReason("Pump/valve fault"), "Pump/valve fault")
assert.equal(formatKnownZeroDisplayReason("rains/Heavy Rains"), "rains/Heavy Rains")
assert.equal(formatKnownZeroDisplayReason("Heavy Rains / Power outage"), "Heavy rain / Power outage")
assert.equal(formatKnownZeroDisplayReason("Power failure / Generator fault"), "Power failure / Generator fault")
assert.equal(formatKnownZeroDisplayReason("Power failure / Power failure"), "Power failure")
assert.equal(formatKnownZeroDisplayReason("  Power outage  "), "Power outage")
const preservedReason = projectPublicMotorNoRunRecords([
  { operation_date: "2026-08-25", motor_id: "motor-1", status: "Not Run", reason: "Heavy Rains", voided_at: null },
])[0]
assert.equal(preservedReason.reason, "Heavy Rains", "the public projection preserves the stored reason")
assert.equal(formatKnownZeroDisplayReason(preservedReason.reason), "Heavy rain", "only displayed text is standardized")

const compoundReasons = projectPublicMotorNoRunRecords([
  { operation_date: "2026-08-25", motor_id: "motor-1", status: "Not Run", reason: "rains", voided_at: null },
  { operation_date: "2026-08-25", motor_id: "motor-2", status: "Not Run", reason: "Heavy Rains", voided_at: null },
])
const compoundStoredReason = noRunReasonForAllMotors(compoundReasons, "2026-08-25", ["M1", "M2"])
assert.equal(compoundStoredReason, "rains / Heavy Rains", "joined source reasons remain unchanged")
assert.equal(formatKnownZeroDisplayReason(compoundStoredReason), "Heavy rain")
assert.deepEqual(
  compoundReasons.map((record) => ({ keys: Object.keys(record), reason: record.reason })),
  [
    { keys: ["date", "motorId", "motorName", "status", "reason", "runtime", "water"], reason: "rains" },
    { keys: ["date", "motorId", "motorName", "status", "reason", "runtime", "water"], reason: "Heavy Rains" },
  ],
  "the seven-field public projection and raw reason values remain unchanged",
)

const missingPoint = {
  date: "2026-08-24", displayDate: "24 Aug", totalWaterLitres: null, totalRuntimeHours: null,
  P1E: null, P1W: null, P2E: null, P2W: null, JF: null, NM: null,
}
const trendPoint = (date, values = {}) => ({
  ...missingPoint,
  date,
  displayDate: date,
  ...values,
})
const zoneIds = ["P1E", "P1W", "P2E", "P2W", "JF", "NM"]
const scheduledAssignmentsByDate = new Map([
  ["2026-08-24", {}],
  ["2026-08-25", { P1E: "M1", P2W: "M2" }],
  ["2026-08-26", { P1E: "M1", P2W: "M2" }],
  ["2026-08-27", { P1E: "M1", P2W: "M2" }],
  ["2026-08-28", { P1E: "M1", P2W: "M2" }],
  ["2026-08-29", { P1E: "M1", P2W: "M2" }],
  ["2026-08-30", { P1E: "M1" }],
  ["2026-08-31", { P1E: "M1" }],
  ["2026-09-01", { P1E: "M2" }],
  ["2026-09-02", { P1E: "M2" }],
  ["2026-09-03", { P1E: null }],
  ["2026-09-04", { P1E: "M2", P2W: "M3" }],
  ["2026-09-05", { P1E: "M2", P2W: "M3" }],
])
const scheduleForZoneDate = (zoneId, date) => {
  if (date === "2026-09-06") {
    return { kind: "unavailable", litres: null, display: "Unavailable", motorId: null }
  }
  const assignments = scheduledAssignmentsByDate.get(date) ?? {}
  return Object.hasOwn(assignments, zoneId)
    ? { kind: "scheduled", litres: 96, display: "96 L/Tree", motorId: assignments[zoneId] }
    : { kind: "not-scheduled", litres: null, display: "Not scheduled", motorId: null }
}

const extraNoRuns = projectPublicMotorNoRunRecords([
  ["2026-08-27", "motor-2"],
  ["2026-08-28", "motor-1"],
  ["2026-08-31", "motor-1"],
  ["2026-09-01", "motor-2"],
  ["2026-09-02", "motor-1"],
  ["2026-09-03", "motor-1"],
  ["2026-09-03", "motor-2"],
  ["2026-09-04", "motor-2"],
  ["2026-09-05", "motor-2"],
  ["2026-09-05", "motor-3"],
].map(([operation_date, motor_id]) => ({
  operation_date,
  motor_id,
  status: "Not Run",
  reason: "Heavy rain",
  voided_at: null,
})))
const scheduleAwareNoRuns = [...activeNoRuns, ...extraNoRuns]

const trend = applyScheduledKnownZerosToTrend([
  missingPoint,
  trendPoint("2026-08-25", {
    totalWaterLitres: 75_000,
    totalRuntimeHours: 1.5,
    P1E: 100,
    P2W: 50,
  }),
  trendPoint("2026-08-26", {
  }),
  trendPoint("2026-08-27", {
    totalWaterLitres: 50_000,
    totalRuntimeHours: 1,
    P1E: 100,
  }),
  trendPoint("2026-08-28"),
  trendPoint("2026-08-29", {
    totalWaterLitres: 50_000,
    totalRuntimeHours: 1,
    P1E: 100,
  }),
  trendPoint("2026-08-30", {
    totalWaterLitres: 50_000,
    totalRuntimeHours: 1,
    P1E: 100,
  }),
  trendPoint("2026-08-31"),
  trendPoint("2026-09-01"),
  trendPoint("2026-09-02"),
  trendPoint("2026-09-03"),
  trendPoint("2026-09-04"),
  trendPoint("2026-09-05", {
    totalWaterLitres: 50_000,
    totalRuntimeHours: 1,
    P1E: 100,
  }),
  trendPoint("2026-09-06", {
    totalWaterLitres: 50_000,
    totalRuntimeHours: 1,
    P1E: 100,
  }),
], scheduleAwareNoRuns, scheduleForZoneDate, zoneIds)

assert.deepEqual(trend[0], missingPoint, "dates without a schedule or data remain gaps")
assert.equal(trend[1].totalWaterLitres, 75_000, "all measured scheduled zones retain the measured aggregate")
assert.equal(trend[1].totalRuntimeHours, 1.5)
assert.equal(trend[2].P1E, 0, "a scheduled active no-run remains a zone-level genuine zero")
assert.equal(trend[2].P2W, 0)
assert.equal(trend[2].P1W, null, "an unscheduled zone remains a gap")
assert.equal(trend[2].totalWaterLitres, 0, "all scheduled zones confirmed no-run produce a genuine zero aggregate")
assert.equal(trend[2].totalRuntimeHours, 0)
assert.equal(trend[3].P1E, 100, "a measured scheduled zone is never overwritten")
assert.equal(trend[3].P2W, 0)
assert.equal(trend[3].totalWaterLitres, 50_000, "a complete measurement and known-zero mixture remains numeric")
assert.equal(trend[3].totalRuntimeHours, 1)
assert.equal(trend[4].P1E, 0, "zone-level known-zero survives an incomplete aggregate")
assert.equal(trend[4].P2W, null)
assert.equal(trend[4].totalWaterLitres, null, "a known zero plus a scheduled missing zone remains an aggregate gap")
assert.equal(trend[4].totalRuntimeHours, null)
assert.equal(trend[5].P1E, 100)
assert.equal(trend[5].P2W, null)
assert.equal(trend[5].totalWaterLitres, null, "a measurement plus a scheduled missing zone remains an aggregate gap")
assert.equal(trend[5].totalRuntimeHours, null)
assert.equal(trend[6].P1E, 100)
assert.equal(trend[6].P2W, null, "an unscheduled missing zone stays a zone-level gap")
assert.equal(trend[6].totalWaterLitres, 50_000, "unscheduled missing zones do not block a complete scheduled aggregate")
assert.equal(trend[6].totalRuntimeHours, 1)
assert.equal(trend[7].P1E, 0, "the original Motor assignment plus its matching no-run produces a zone zero")
assert.equal(trend[8].P1E, 0, "a reassigned zone uses the new Motor's matching no-run")
assert.equal(trend[8].totalWaterLitres, 0)
assert.equal(trend[9].P1E, null, "the old Motor's no-run cannot zero a reassigned zone")
assert.equal(trend[9].totalWaterLitres, null)
assert.equal(trend[10].P1E, null, "a missing or invalid Motor assignment remains unknown")
assert.equal(trend[10].totalWaterLitres, null)
assert.equal(trend[11].P1E, 0, "a correctly attributed reassigned zone remains a genuine zone-level zero")
assert.equal(trend[11].P2W, null)
assert.equal(trend[11].totalWaterLitres, null, "a partial aggregate after reassignment remains a gap")
assert.equal(trend[12].P1E, 100)
assert.equal(trend[12].P2W, 0)
assert.equal(trend[12].totalWaterLitres, 50_000, "measurements plus correctly attributed zeros produce a complete numeric aggregate")
assert.equal(trend[12].totalRuntimeHours, 1)
assert.equal(trend[13].P1E, 100, "an existing measurement remains visible while schedule attribution is unavailable")
assert.equal(trend[13].totalWaterLitres, null, "an unavailable persisted schedule cannot falsely complete a partial aggregate")
assert.equal(trend[13].totalRuntimeHours, null)

const fullyMeasuredValues = {
  totalWaterLitres: 210_000,
  totalRuntimeHours: 6,
  P1E: 10,
  P1W: 20,
  P2E: 30,
  P2W: 40,
  JF: 50,
  NM: 60,
}
const zeroMeasuredValues = {
  totalWaterLitres: 0,
  totalRuntimeHours: 0,
  P1E: 0,
  P1W: 0,
  P2E: 0,
  P2W: 0,
  JF: 0,
  NM: 0,
}
const precedenceNoRuns = projectPublicMotorNoRunRecords([
  ["2026-09-11", "motor-1"],
  ["2026-09-12", "motor-2"],
  ["2026-09-14", "motor-1"],
  ["2026-09-14", "motor-2"],
  ["2026-09-15", "motor-1"],
].map(([operation_date, motor_id]) => ({
  operation_date,
  motor_id,
  status: "Not Run",
  reason: "Heavy rain",
  voided_at: null,
})))
const precedenceAssignmentsByDate = new Map([
  ["2026-09-07", { P1E: "M1", P1W: "M2" }],
  ["2026-09-12", { P1E: "M1", P2W: "M2" }],
  ["2026-09-13", { P1E: "M1", P2W: "M2" }],
  ["2026-09-14", { P1E: "M1", P2W: "M2" }],
  ["2026-09-15", { P1E: "M1" }],
])
const precedenceScheduleForZoneDate = (zoneId, date) => {
  if (["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"].includes(date)) {
    return { kind: "unavailable", litres: null, display: "Unavailable", motorId: null }
  }
  const assignments = precedenceAssignmentsByDate.get(date) ?? {}
  return Object.hasOwn(assignments, zoneId)
    ? { kind: "scheduled", litres: 96, display: "96 L/Tree", motorId: assignments[zoneId] }
    : { kind: "not-scheduled", litres: null, display: "Not scheduled", motorId: null }
}
const precedenceTrend = applyScheduledKnownZerosToTrend([
  trendPoint("2026-09-07", fullyMeasuredValues),
  trendPoint("2026-09-08", fullyMeasuredValues),
  trendPoint("2026-09-09", zeroMeasuredValues),
  trendPoint("2026-09-10", { totalWaterLitres: 50_000, totalRuntimeHours: 1, P1E: 100 }),
  trendPoint("2026-09-11"),
  trendPoint("2026-09-12", { totalWaterLitres: 50_000, totalRuntimeHours: 1, P1E: 100 }),
  trendPoint("2026-09-13", { totalWaterLitres: 50_000, totalRuntimeHours: 1, P1E: 100 }),
  trendPoint("2026-09-14"),
  trendPoint("2026-09-15", { totalWaterLitres: 50_000, totalRuntimeHours: 1, P1E: 100 }),
], precedenceNoRuns, precedenceScheduleForZoneDate, zoneIds)

assert.equal(precedenceTrend[0].totalWaterLitres, 210_000, "fully measured totals remain numeric when the schedule is available")
assert.equal(precedenceTrend[0].totalRuntimeHours, 6)
assert.equal(precedenceTrend[1].totalWaterLitres, 210_000, "fully measured totals do not require schedule availability")
assert.equal(precedenceTrend[1].totalRuntimeHours, 6)
assert.equal(precedenceTrend[2].totalWaterLitres, 0, "a fully measured genuine zero survives a schedule outage")
assert.equal(precedenceTrend[2].totalRuntimeHours, 0)
assert.equal(precedenceTrend[3].totalWaterLitres, null, "a partial measurement remains a gap when the schedule is unavailable")
assert.equal(precedenceTrend[3].totalRuntimeHours, null)
assert.equal(precedenceTrend[4].totalWaterLitres, null, "a no-run record cannot complete a point without its persisted schedule")
assert.equal(precedenceTrend[4].totalRuntimeHours, null)
assert.equal(precedenceTrend[5].P1E, 100)
assert.equal(precedenceTrend[5].P2W, 0)
assert.equal(precedenceTrend[5].totalWaterLitres, 50_000, "a valid attributed zero can complete a partial measured point")
assert.equal(precedenceTrend[5].totalRuntimeHours, 1)
assert.equal(precedenceTrend[6].P1E, 100)
assert.equal(precedenceTrend[6].P2W, null)
assert.equal(precedenceTrend[6].totalWaterLitres, null, "an unaccounted scheduled zone keeps the aggregate unknown")
assert.equal(precedenceTrend[6].totalRuntimeHours, null)
assert.equal(precedenceTrend[7].P1E, 0)
assert.equal(precedenceTrend[7].P2W, 0)
assert.equal(precedenceTrend[7].totalWaterLitres, 0, "all scheduled zones correctly confirmed no-run produce a genuine zero")
assert.equal(precedenceTrend[7].totalRuntimeHours, 0)
assert.equal(precedenceTrend[8].P1E, 100, "a matching no-run never overwrites an actual measurement")
assert.equal(precedenceTrend[8].totalWaterLitres, 50_000)
assert.equal(precedenceTrend[8].totalRuntimeHours, 1)

const conflictDate = "2026-10-01"
const conflictingNoRuns = projectPublicMotorNoRunRecords([
  [conflictDate, "motor-1", "Conflicting M1 no-run"],
  [conflictDate, "motor-2", "Valid M2 no-run"],
].map(([operation_date, motor_id, reason]) => ({
  operation_date,
  motor_id,
  status: "Not Run",
  reason,
  voided_at: null,
})))
const conflictingNoRunsSnapshot = structuredClone(conflictingNoRuns)
const filteredConflictNoRuns = noRunsWithoutMeasuredRuntime(
  conflictingNoRuns,
  positiveMeasuredMotorRuntimeDays([
    { entry_date: conflictDate, motor_no: 1, total_minutes: 60 },
  ]),
)
const conflictScheduleForZoneDate = (zoneId, date) => {
  if (date !== conflictDate) return { kind: "not-scheduled", litres: null, display: "Not scheduled", motorId: null }
  if (zoneId === "P1E") return { kind: "scheduled", litres: 96, display: "96 L/Tree", motorId: "M1" }
  if (zoneId === "P2W") return { kind: "scheduled", litres: 96, display: "96 L/Tree", motorId: "M2" }
  return { kind: "not-scheduled", litres: null, display: "Not scheduled", motorId: null }
}
const [mixedConflictTrend] = applyScheduledKnownZerosToTrend(
  [trendPoint(conflictDate)],
  filteredConflictNoRuns,
  conflictScheduleForZoneDate,
  zoneIds,
)
assert.equal(mixedConflictTrend.P1E, null, "positive M1 runtime rejects the conflicting M1 synthesized zero")
assert.equal(mixedConflictTrend.P2W, 0, "an M1 conflict does not invalidate a valid M2 known zero")
assert.equal(mixedConflictTrend.totalWaterLitres, null, "the unresolved scheduled M1 zone keeps the farm aggregate unknown")
assert.equal(mixedConflictTrend.totalRuntimeHours, null)
const [measuredConflictTrend] = applyScheduledKnownZerosToTrend(
  [trendPoint(conflictDate, { totalWaterLitres: 50_000, totalRuntimeHours: 1, P1E: 100 })],
  filteredConflictNoRuns,
  conflictScheduleForZoneDate,
  zoneIds,
)
assert.equal(measuredConflictTrend.P1E, 100, "an actual M1 zone measurement remains authoritative during a runtime conflict")
assert.equal(measuredConflictTrend.P2W, 0)
assert.equal(measuredConflictTrend.totalWaterLitres, 50_000)
const zeroRuntimeNoRuns = noRunsWithoutMeasuredRuntime(
  conflictingNoRuns,
  positiveMeasuredMotorRuntimeDays([
    { entry_date: conflictDate, motor_no: 1, total_minutes: 0 },
    { entry_date: conflictDate, motor_no: 2, total_minutes: null },
  ]),
)
const [zeroRuntimeTrend] = applyScheduledKnownZerosToTrend(
  [trendPoint(conflictDate)],
  zeroRuntimeNoRuns,
  conflictScheduleForZoneDate,
  zoneIds,
)
assert.equal(zeroRuntimeTrend.P1E, 0, "zero runtime does not falsely suppress a valid M1 known zero")
assert.equal(zeroRuntimeTrend.P2W, 0, "missing runtime does not falsely suppress a valid M2 known zero")
assert.equal(zeroRuntimeTrend.totalWaterLitres, 0)
assert.deepEqual(conflictingNoRuns, conflictingNoRunsSnapshot, "derived irrigation conflict filtering does not mutate Admin-visible no-run records")

const p1eZone = emptyIrrigationData.zones.find((zone) => zone.id === "P1E")
assert.ok(p1eZone)
const [displayedP1e] = applyScheduledKnownZerosToZones([{
  ...p1eZone,
  fiveDayHistory: [
    { date: "2026-08-31", displayDate: "31 Aug", totalMinutes: 0, perTreeLitres: null, status: "No Record" },
    { date: "2026-09-01", displayDate: "01 Sep", totalMinutes: 0, perTreeLitres: null, status: "No Record" },
    { date: "2026-09-02", displayDate: "02 Sep", totalMinutes: 0, perTreeLitres: null, status: "No Record" },
    { date: "2026-09-03", displayDate: "03 Sep", totalMinutes: 0, perTreeLitres: null, status: "No Record" },
    { date: "2026-09-05", displayDate: "05 Sep", totalMinutes: 60, perTreeLitres: 100, status: "Irrigated" },
  ],
}], scheduleAwareNoRuns, scheduleForZoneDate)
assert.equal(displayedP1e.fiveDayHistory[0].knownZeroReason, "Heavy rain")
assert.equal(displayedP1e.fiveDayHistory[1].knownZeroReason, "Heavy rain")
assert.equal(displayedP1e.fiveDayHistory[2].knownZeroReason, undefined, "a different Motor's no-run leaves the zone display unknown")
assert.equal(displayedP1e.fiveDayHistory[3].knownZeroReason, undefined, "invalid assignment leaves the zone display unknown")
assert.equal(displayedP1e.fiveDayHistory[4].perTreeLitres, 100, "a measurement remains unchanged")
assert.equal(displayedP1e.fiveDayHistory[4].knownZeroReason, undefined, "a matching no-run never annotates an actual zone measurement")

const northRow = {
  date: "2026-08-25", well_id: "north", well_code: "well1", well_name: "North Well",
  morning_water_liters: 448470, evening_water_liters: 446820, motor_runtime_minutes: 0,
  water_pumped_out_liters: null, observed_storage_change_liters: -1650,
  difference_in_morning_readings_litres: 25000, remarks: "Live readings retained", reading_count: 2,
  morning_reading_id: 88, evening_reading_id: 90, capacity_liters: 1128270,
  liters_per_inch: 1650, calculation_method: "CAPACITY_MINUS_TAPE",
}
const publicNoRunsFor = (date, motorIds) => projectPublicMotorNoRunRecords(motorIds.map((motor_id) => ({
  operation_date: date,
  motor_id,
  status: "Not Run",
  reason: "Heavy rain",
  voided_at: null,
})))
const buildNorthWellDay = (
  date,
  waterPumpedOut,
  noRunRecords,
  rowOverrides = {},
  totalReadings = 2,
) => buildWellDashboardData({
  summary: {
    total_readings: totalReadings,
    first_reading_date: date,
    latest_reading_date: date,
    selected_start_date: date,
    selected_end_date: date,
    calendar_days: 1,
    pumped_out_totals_liters: { north: waterPumpedOut ?? 0, south: 0, both: waterPumpedOut ?? 0 },
  },
  daily_rows: [{ ...northRow, ...rowOverrides, date, water_pumped_out_liters: waterPumpedOut }],
  north_rows: [],
  south_rows: [],
  motor_no_run_records: noRunRecords,
})
const measuredPositiveWell = buildNorthWellDay(
  "2026-09-16",
  12_345,
  publicNoRunsFor("2026-09-16", ["motor-1", "motor-2"]),
)
const measuredZeroWell = buildNorthWellDay(
  "2026-09-17",
  0,
  publicNoRunsFor("2026-09-17", ["motor-1", "motor-2"]),
)
const synthesizedZeroWell = buildNorthWellDay(
  "2026-09-18",
  null,
  publicNoRunsFor("2026-09-18", ["motor-1", "motor-2"]),
)
const parsedMissingWell = buildNorthWellDay(
  "2026-09-22",
  "",
  publicNoRunsFor("2026-09-22", ["motor-1", "motor-2"]),
)
const incompleteNoRunWell = buildNorthWellDay(
  "2026-09-19",
  null,
  publicNoRunsFor("2026-09-19", ["motor-1"]),
)
const wrongMotorNoRunWell = buildNorthWellDay(
  "2026-09-20",
  null,
  publicNoRunsFor("2026-09-20", ["motor-3"]),
)
const missingWell = buildNorthWellDay("2026-09-21", null, [])
const placeholderMeasuredPositiveWell = buildNorthWellDay(
  "2026-09-23",
  54_321,
  publicNoRunsFor("2026-09-23", ["motor-1", "motor-2"]),
  { reading_count: 0 },
  0,
)
const placeholderMeasuredZeroWell = buildNorthWellDay(
  "2026-09-24",
  0,
  publicNoRunsFor("2026-09-24", ["motor-1", "motor-2"]),
  { reading_count: 0 },
  0,
)
const placeholderSynthesizedZeroWell = buildNorthWellDay(
  "2026-09-25",
  null,
  publicNoRunsFor("2026-09-25", ["motor-1", "motor-2"]),
  { reading_count: 0 },
  0,
)
const placeholderIncompleteWell = buildNorthWellDay(
  "2026-09-26",
  null,
  publicNoRunsFor("2026-09-26", ["motor-1"]),
  { reading_count: 0 },
  0,
)
const placeholderWrongMotorWell = buildNorthWellDay(
  "2026-09-27",
  null,
  publicNoRunsFor("2026-09-27", ["motor-3"]),
  { reading_count: 0 },
  0,
)
const inconsistentMetadataMeasuredWell = buildNorthWellDay(
  "2026-09-28",
  7_654,
  publicNoRunsFor("2026-09-28", ["motor-1", "motor-2"]),
  { reading_count: null },
  0,
)
const nonFiniteCompleteNoRunWell = buildNorthWellDay(
  "2026-09-29",
  "not-a-number",
  publicNoRunsFor("2026-09-29", ["motor-1", "motor-2"]),
  { reading_count: 0 },
  0,
)
const positiveRuntimeConflictNoRuns = publicNoRunsFor("2026-09-30", ["motor-1", "motor-2"])
const positiveRuntimeConflictNoRunsSnapshot = structuredClone(positiveRuntimeConflictNoRuns)
const positiveRuntimeConflictWell = buildNorthWellDay(
  "2026-09-30",
  null,
  positiveRuntimeConflictNoRuns,
  { motor_runtime_minutes: 60, reading_count: 0 },
  0,
)
const stringPositiveRuntimeConflictWell = buildNorthWellDay(
  "2026-10-01",
  null,
  publicNoRunsFor("2026-10-01", ["motor-1", "motor-2"]),
  { motor_runtime_minutes: "60", reading_count: 0 },
  0,
)
const measuredWithPositiveRuntimeWell = buildNorthWellDay(
  "2026-10-02",
  9_876,
  publicNoRunsFor("2026-10-02", ["motor-1", "motor-2"]),
  { motor_runtime_minutes: 60 },
)
const measuredZeroWithPositiveRuntimeWell = buildNorthWellDay(
  "2026-10-03",
  0,
  publicNoRunsFor("2026-10-03", ["motor-1", "motor-2"]),
  { motor_runtime_minutes: 60 },
)
const missingRuntimeCompleteNoRunWell = buildNorthWellDay(
  "2026-10-04",
  null,
  publicNoRunsFor("2026-10-04", ["motor-1", "motor-2"]),
  { motor_runtime_minutes: null, reading_count: 0 },
  0,
)

const measuredPositiveRecord = measuredPositiveWell.northWellRecords[0]
const measuredZeroRecord = measuredZeroWell.northWellRecords[0]
const synthesizedZeroRecord = synthesizedZeroWell.northWellRecords[0]
assert.equal(measuredPositiveRecord.waterPumpedOut, 12_345, "a matching no-run cannot overwrite positive pumped-water measurement")
assert.equal(measuredPositiveRecord.knownZeroReason, undefined, "measured pumped water retains measured provenance")
assert.equal(toChartData(measuredPositiveWell.northWellRecords)[0].pumpedOut, 12_345, "the Well Water trend preserves the measured value")
assert.match(buildWellWaterCsv(measuredPositiveWell), /"12345"/)
assert.doesNotMatch(buildWellWaterCsv(measuredPositiveWell), /Not run:/, "the Well Water table export preserves measured provenance")
assert.equal(measuredZeroRecord.waterPumpedOut, 0, "numeric measured zero is authoritative and is not treated as missing")
assert.equal(measuredZeroRecord.knownZeroReason, undefined)
assert.equal(toChartData(measuredZeroWell.northWellRecords)[0].pumpedOut, 0)
assert.equal(synthesizedZeroRecord.waterPumpedOut, 0, "a complete matching no-run basis synthesizes zero when measurement is missing")
assert.equal(synthesizedZeroRecord.knownZeroReason, "Heavy rain")
assert.equal(toChartData(synthesizedZeroWell.northWellRecords)[0].pumpedOut, 0)
assert.equal(parsedMissingWell.northWellRecords[0].waterPumpedOut, 0, "an empty API value is parsed as missing before valid synthesis")
assert.equal(parsedMissingWell.northWellRecords[0].knownZeroReason, "Heavy rain")
assert.equal(incompleteNoRunWell.northWellRecords[0].waterPumpedOut, null, "an incomplete no-run basis remains unknown")
assert.equal(incompleteNoRunWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(wrongMotorNoRunWell.northWellRecords[0].waterPumpedOut, null, "a wrong-Motor no-run basis remains unknown")
assert.equal(wrongMotorNoRunWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(missingWell.northWellRecords[0].waterPumpedOut, null, "missing measurement without no-run remains unknown")
assert.equal(toChartData(missingWell.northWellRecords)[0].pumpedOut, null, "unknown Well Water values remain chart gaps")
assert.equal(placeholderMeasuredPositiveWell.northWellRecords[0].waterPumpedOut, 54_321, "reading_count zero cannot discard a positive pumped measurement")
assert.equal(placeholderMeasuredPositiveWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(toChartData(placeholderMeasuredPositiveWell.northWellRecords)[0].pumpedOut, 54_321, "the chart preserves a placeholder-day measurement")
assert.match(buildWellWaterCsv(placeholderMeasuredPositiveWell), /"54321"/)
assert.doesNotMatch(buildWellWaterCsv(placeholderMeasuredPositiveWell), /Not run:/)
assert.equal(placeholderMeasuredZeroWell.northWellRecords[0].waterPumpedOut, 0, "reading_count zero cannot discard a measured numeric zero")
assert.equal(placeholderMeasuredZeroWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(toChartData(placeholderMeasuredZeroWell.northWellRecords)[0].pumpedOut, 0)
assert.equal(placeholderSynthesizedZeroWell.northWellRecords[0].waterPumpedOut, 0, "a genuinely missing placeholder-day measurement may use a complete known-zero basis")
assert.equal(placeholderSynthesizedZeroWell.northWellRecords[0].knownZeroReason, "Heavy rain")
assert.equal(toChartData(placeholderSynthesizedZeroWell.northWellRecords)[0].pumpedOut, 0)
assert.equal(placeholderIncompleteWell.northWellRecords[0].waterPumpedOut, null, "incomplete placeholder-day attribution remains unknown")
assert.equal(placeholderIncompleteWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(toChartData(placeholderIncompleteWell.northWellRecords)[0].pumpedOut, null)
assert.equal(placeholderWrongMotorWell.northWellRecords[0].waterPumpedOut, null, "wrong-Motor placeholder-day attribution remains unknown")
assert.equal(placeholderWrongMotorWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(inconsistentMetadataMeasuredWell.northWellRecords[0].waterPumpedOut, 7_654, "inconsistent reading metadata cannot overwrite a finite measurement")
assert.equal(inconsistentMetadataMeasuredWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(nonFiniteCompleteNoRunWell.northWellRecords[0].waterPumpedOut, 0, "a non-finite pumped value is genuinely missing and may use complete known-zero attribution")
assert.equal(nonFiniteCompleteNoRunWell.northWellRecords[0].knownZeroReason, "Heavy rain")
const positiveRuntimeConflictRecord = positiveRuntimeConflictWell.northWellRecords[0]
assert.equal(positiveRuntimeConflictRecord.motorRuntimeMinutes, 60)
assert.equal(positiveRuntimeConflictRecord.waterPumpedOut, null, "missing pumped water plus positive relevant runtime rejects a conflicting known zero")
assert.equal(positiveRuntimeConflictRecord.knownZeroReason, undefined, "a rejected known zero cannot display its no-run reason")
assert.equal(toChartData(positiveRuntimeConflictWell.northWellRecords)[0].pumpedOut, null, "the Well Water chart retains a gap after conflict rejection")
assert.doesNotMatch(buildWellWaterCsv(positiveRuntimeConflictWell), /Not run:|Conflicting/, "the Well Water CSV exposes neither a synthesized zero nor rejected no-run provenance")
assert.doesNotMatch(buildWellWaterCsv(positiveRuntimeConflictWell), /"0"/, "the Well Water CSV does not synthesize a numeric zero after conflict rejection")
assert.equal(stringPositiveRuntimeConflictWell.northWellRecords[0].waterPumpedOut, null, "a finite numeric-string runtime is positive conflict evidence")
assert.equal(measuredWithPositiveRuntimeWell.northWellRecords[0].waterPumpedOut, 9_876, "a finite pumped measurement remains authoritative over runtime and no-run data")
assert.equal(measuredWithPositiveRuntimeWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(measuredZeroWithPositiveRuntimeWell.northWellRecords[0].waterPumpedOut, 0, "measured numeric zero remains authoritative over runtime and no-run data")
assert.equal(measuredZeroWithPositiveRuntimeWell.northWellRecords[0].knownZeroReason, undefined)
assert.equal(missingRuntimeCompleteNoRunWell.northWellRecords[0].waterPumpedOut, 0, "missing runtime is not positive conflict evidence and preserves complete known-zero synthesis")
assert.equal(missingRuntimeCompleteNoRunWell.northWellRecords[0].knownZeroReason, "Heavy rain")
assert.deepEqual(positiveRuntimeConflictNoRuns, positiveRuntimeConflictNoRunsSnapshot, "Well Water conflict rejection does not mutate the seven-field Admin-audit projection input")
assert.equal(hasWellWaterExportData(placeholderMeasuredPositiveWell), true, "a finite placeholder-day measurement enables export even when totalReadings is zero")
assert.equal(hasWellWaterExportData(placeholderMeasuredZeroWell), true, "a measured numeric zero enables export")
assert.equal(hasWellWaterExportData(placeholderSynthesizedZeroWell), true, "a valid synthesized zero enables export")
assert.match(buildWellWaterCsv(placeholderSynthesizedZeroWell), /"0"/)
assert.match(buildWellWaterCsv(placeholderSynthesizedZeroWell), /"Not run: Heavy rain"/)
assert.equal(hasWellWaterExportData(placeholderIncompleteWell), false, "unknown placeholder rows do not enable export")
assert.equal(hasWellWaterExportData(placeholderWrongMotorWell), true, "a valid South-well synthesized zero keeps the whole dashboard exportable")
assert.equal(hasWellWaterExportData({
  ...placeholderWrongMotorWell,
  southWellRecords: [],
}), false, "wrong-Motor North-well attribution alone does not enable export")
assert.equal(hasWellWaterExportData(inconsistentMetadataMeasuredWell), true, "conflicting metadata cannot hide a finite exportable measurement")
assert.equal(hasWellWaterExportData(nonFiniteCompleteNoRunWell), true, "complete synthesis after a non-finite value remains exportable")
assert.equal(hasWellWaterExportData(positiveRuntimeConflictWell), false, "a rejected synthesized zero does not make an otherwise placeholder dashboard exportable")
assert.equal(hasWellWaterExportData(missingWell), true, "existing real readings retain the established export behavior")
assert.equal(hasWellWaterExportData(emptyWellDashboardData), false, "an empty dashboard keeps export disabled")

const wellDashboard = buildWellDashboardData({
  summary: {
    total_readings: 2, first_reading_date: "2026-08-25", latest_reading_date: "2026-08-25",
    selected_start_date: "2026-08-24", selected_end_date: "2026-08-27", calendar_days: 4,
    pumped_out_totals_liters: { north: 0, south: 0, both: 0 },
  },
  daily_rows: [northRow], north_rows: [northRow], south_rows: [], motor_no_run_records: activeNoRuns,
})
const northKnownZero = wellDashboard.northWellRecords.find((record) => record.date === "25/08/2026")
const northKnownZeroNextDay = wellDashboard.northWellRecords.find((record) => record.date === "26/08/2026")
const northMissing = wellDashboard.northWellRecords.find((record) => record.date === "27/08/2026")
const southKnownZero = wellDashboard.southWellRecords.find((record) => record.date === "25/08/2026")
assert.equal(northKnownZero.morningWater, 448470)
assert.equal(northKnownZero.eveningWater, 446820)
assert.equal(northKnownZero.waterPumpedOut, 0)
assert.equal(northKnownZero.knownZeroReason, "Heavy rain")
assert.equal(northKnownZeroNextDay.waterPumpedOut, 0)
assert.equal(northKnownZeroNextDay.knownZeroReason, "Heavy rain")
assert.equal(northMissing.waterPumpedOut, null)
assert.equal(northMissing.knownZeroReason, undefined)
assert.equal(southKnownZero.waterPumpedOut, 0)
assert.equal(southKnownZero.knownZeroReason, "Heavy rain")
assert.equal(toChartData(wellDashboard.northWellRecords).find((point) => point.date === "25/08/2026").pumpedOut, 0)
assert.equal(toChartData(wellDashboard.northWellRecords).find((point) => point.date === "27/08/2026").pumpedOut, null)

const wellRoute = readFileSync(new URL("../app/api/well-water/dashboard/route.ts", import.meta.url), "utf8")
const irrigationRoute = readFileSync(new URL("../app/api/irrigation-management/route.ts", import.meta.url), "utf8")
const knownZeroSource = readFileSync(new URL("../lib/known-zero-data.ts", import.meta.url), "utf8")
const wellTable = readFileSync(new URL("../components/farm/well-table.tsx", import.meta.url), "utf8")
const wellPage = readFileSync(new URL("../app/well-water/page.tsx", import.meta.url), "utf8")
assert.match(wellRoute, /fetchPublicMotorNoRunRecords/)
assert.match(wellRoute, /fetchAllMotorRuntimeEntries/)
assert.match(wellRoute, /const noRunRecords = noRunsWithoutMeasuredRuntime\([\s\S]*projectedNoRunRecords,[\s\S]*positiveMeasuredMotorRuntimeDays\(runtimeEntries\)/)
assert.match(wellRoute, /motor_no_run_records: noRunRecords/)
assert.match(irrigationRoute, /fetchPublicMotorNoRunRecords/)
assert.match(irrigationRoute, /motorNoRunRecords: \[\.\.\.noRunRecords\]/)
assert.doesNotMatch(irrigationRoute, /knownZeroReasonsForZoneDate/)
assert.doesNotMatch(knownZeroSource, /ZONE_SCHEDULE_MOTOR_IDS/)
assert.doesNotMatch(knownZeroSource, /P1E:\s*"M1"|P2W:\s*"M2"|P2E:\s*"M3"/, "no fixed zone-to-Motor fallback remains")
assert.match(wellTable, /Not run: \{formatKnownZeroDisplayReason\(record\.knownZeroReason\)\}/)
assert.match(wellTable, /record\.knownZeroReason \?[\s\S]*: record\.isPlaceholder && record\.waterPumpedOut === null \? "" : formatLitres\(record\.waterPumpedOut\)/, "the Well Water table preserves finite placeholder-day measurements and only blanks unknown values")
assert.match(wellPage, /disabled=\{isLoading \|\| !hasWellWaterExportData\(data\)\}/, "the Well Water export gate uses populated dashboard data")
assert.doesNotMatch(wellPage, /data\.totalReadings === 0/, "export availability is not based only on the summary reading count")

// Consolidated cross-surface decision table for the twelve known-zero and
// identity invariants. The focused assertions above retain detailed failure
// messages; this table proves the same effective operational dataset is used
// consistently at each public surface.
const decisionNoRuns = projectPublicMotorNoRunRecords([
  { operation_date: "2026-11-01", motor_id: "motor-1", status: "Not Run", reason: "Heavy rain", voided_at: null },
  { operation_date: "2026-11-01", motor_id: "motor-2", status: "Not Run", reason: "Power failure", voided_at: null },
])
const decisionNoRunsSnapshot = structuredClone(decisionNoRuns)
const runtimeDecisionCases = [
  { name: "positive runtime rejects the matching no-run", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: 1 }], expected: ["M2"] },
  { name: "zero runtime preserves no-runs", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: 0 }], expected: ["M1", "M2"] },
  { name: "missing runtime preserves no-runs", rows: [{ entry_date: "2026-11-01", motor_no: 1 }], expected: ["M1", "M2"] },
  { name: "invalid runtime preserves no-runs", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: "60" }], expected: ["M1", "M2"] },
  { name: "voided runtime preserves no-runs", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: 60, voided_at: "2026-11-01T01:00:00Z" }], expected: ["M1", "M2"] },
  { name: "rejected runtime preserves no-runs", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: 60, workflow_status: "rejected" }], expected: ["M1", "M2"] },
  { name: "invalid managed lifecycle preserves no-runs", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: 60, workflow_status: 123 }], expected: ["M1", "M2"] },
  { name: "published managed runtime rejects the matching no-run", rows: [{ entry_date: "2026-11-01", motor_no: 1, total_minutes: 60, workflow_status: "published" }], expected: ["M2"] },
]
const runtimeDecisionRowsSnapshot = structuredClone(runtimeDecisionCases.map((decision) => decision.rows))
for (const decision of runtimeDecisionCases) {
  assert.deepEqual(
    noRunsWithoutMeasuredRuntime(decisionNoRuns, positiveMeasuredMotorRuntimeDays(decision.rows)).map((record) => record.motorId),
    decision.expected,
    decision.name,
  )
}
assert.deepEqual(decisionNoRuns, decisionNoRunsSnapshot, "the decision table never mutates no-run source data")
assert.deepEqual(runtimeDecisionCases.map((decision) => decision.rows), runtimeDecisionRowsSnapshot, "the decision table never mutates runtime source data")

const aggregateDecisionCases = [
  { name: "complete measured aggregate", point: precedenceTrend[0], water: 210_000, runtime: 6 },
  { name: "complete measured aggregate without schedule", point: precedenceTrend[1], water: 210_000, runtime: 6 },
  { name: "fully measured numeric zero", point: precedenceTrend[2], water: 0, runtime: 0 },
  { name: "partial measurement without schedule", point: precedenceTrend[3], water: null, runtime: null },
  { name: "known zero without schedule", point: precedenceTrend[4], water: null, runtime: null },
  { name: "complete measured and known-zero mixture", point: precedenceTrend[5], water: 50_000, runtime: 1 },
  { name: "partial scheduled aggregate", point: precedenceTrend[6], water: null, runtime: null },
  { name: "complete all-zero aggregate", point: precedenceTrend[7], water: 0, runtime: 0 },
]
for (const decision of aggregateDecisionCases) {
  assert.equal(decision.point.totalWaterLitres, decision.water, `${decision.name}: water`)
  assert.equal(decision.point.totalRuntimeHours, decision.runtime, `${decision.name}: runtime`)
}
assert.equal(displayedP1e.fiveDayHistory[1].knownZeroReason, "Heavy rain", "the zone table uses the same reassigned-Motor known zero as the trend")
assert.equal(trend[8].P1E, 0, "the trend uses the reassigned persisted Motor")
assert.equal(displayedP1e.fiveDayHistory[2].knownZeroReason, undefined, "the zone table rejects a wrong-Motor no-run")
assert.equal(trend[9].P1E, null, "the trend rejects the same wrong-Motor no-run")
const conflictTableZones = ["P1E", "P2W"].map((zoneId) => {
  const zone = emptyIrrigationData.zones.find((candidate) => candidate.id === zoneId)
  assert.ok(zone)
  return {
    ...zone,
    fiveDayHistory: [{ date: conflictDate, displayDate: "01 Oct", totalMinutes: 0, perTreeLitres: null, status: "No Record" }],
  }
})
const [conflictM1Zone, conflictM2Zone] = applyScheduledKnownZerosToZones(
  conflictTableZones,
  filteredConflictNoRuns,
  conflictScheduleForZoneDate,
)
assert.equal(conflictM1Zone.fiveDayHistory[0].knownZeroReason, undefined, "the irrigation table rejects the same positive-runtime M1 conflict as the trend")
assert.equal(conflictM2Zone.fiveDayHistory[0].knownZeroReason, "Valid M2 no-run", "the irrigation table preserves the same independent M2 zero as the trend")
assert.equal(mixedConflictTrend.P1E, null)
assert.equal(mixedConflictTrend.P2W, 0)

const wellDecisionCases = [
  { name: "finite positive measurement", data: measuredPositiveWell, expected: 12_345, reason: undefined, csvReason: false },
  { name: "finite numeric-zero measurement", data: measuredZeroWell, expected: 0, reason: undefined, csvReason: false },
  { name: "missing measurement plus valid known zero", data: synthesizedZeroWell, expected: 0, reason: "Heavy rain", csvReason: true },
  { name: "missing measurement plus incomplete attribution", data: incompleteNoRunWell, expected: null, reason: undefined, csvReason: false },
  { name: "missing measurement plus positive runtime conflict", data: positiveRuntimeConflictWell, expected: null, reason: undefined, csvReason: false },
]
for (const decision of wellDecisionCases) {
  const tableRecord = decision.data.northWellRecords[0]
  const chartPoint = toChartData(decision.data.northWellRecords)[0]
  const csv = buildWellWaterCsv(decision.data)
  const csvRow = csv.split("\r\n").find((row) => row.includes(`"${tableRecord.date}"`))
  assert.ok(csvRow, `${decision.name}: CSV row`)
  const csvPumpedOut = csvRow.split(",")[4]
  assert.equal(tableRecord.waterPumpedOut, decision.expected, `${decision.name}: table`)
  assert.equal(chartPoint.pumpedOut, decision.expected, `${decision.name}: chart`)
  assert.equal(csvPumpedOut, decision.expected === null ? '""' : `"${decision.expected}"`, `${decision.name}: CSV value`)
  assert.equal(tableRecord.knownZeroReason, decision.reason, `${decision.name}: provenance`)
  assert.equal(csv.includes("Not run: Heavy rain"), decision.csvReason, `${decision.name}: CSV provenance`)
}

const motorRoute = readFileSync(new URL("../app/api/motor-runtime/dashboard/route.ts", import.meta.url), "utf8")
const adminNoRunRoute = readFileSync(new URL("../app/api/admin/motor-runtime/management/[...path]/route.ts", import.meta.url), "utf8")
assert.match(motorRoute, /const noRunRecords = noRunsWithoutMeasuredRuntime\([\s\S]*positiveMeasuredMotorRuntimeDays\(sortedEntries\)/)
assert.match(motorRoute, /fetchAllMotorRuntimeEntries<RuntimeEntry>\(/, "Motor conflict filtering uses the complete paginated canonical runtime set")
assert.doesNotMatch(motorRoute, /limit: "1000"/)
assert.match(motorRoute, /noRunRecords\.filter\(\(record\) => record\.motorId === id\)/, "the Motor table uses effective records")
assert.match(motorRoute, /noRunRecords\.some\(\(record\) => record\.date === date && record\.motorId === id\)/, "Motor chart coverage uses effective records")
assert.match(motorRoute, /motorIds\.every\(\(id\) => noRunRecords\.some\(/, "aggregate coverage uses effective records")
assert.match(motorRoute, /confirmed_no_run_count: noRunRecords\.length/, "the public count uses effective records")
assert.match(motorRoute, /\n\s+noRunRecords,\n/, "the public list uses effective records")
assert.match(motorRoute, /\.\.\.noRunRecords\.map\(\(record\) => record\.date\)/, "coverage dates use effective records")
assert.match(motorRoute, /first_entry_date: operationalDates\[0\] \?\? null/)
assert.match(motorRoute, /latest_entry_date: operationalDates\.at\(-1\) \?\? null/)
assert.equal((motorRoute.match(/projectedNoRunRecords/g) ?? []).length, 2, "raw projected records are used only for declaration and conflict filtering")
assert.match(motorRoute, /headers: \{ "Cache-Control": "no-store" \}/)
assert.match(wellRoute, /const noRunRecords = noRunsWithoutMeasuredRuntime\([\s\S]*positiveMeasuredMotorRuntimeDays\(runtimeEntries\)/, "Well public metadata uses the same exact-Motor conflict filtering as its derived surfaces")
assert.match(wellRoute, /motor_no_run_records: noRunRecords/)
assert.match(wellRoute, /"Cache-Control": "no-store, max-age=0"/)
assert.doesNotMatch(adminNoRunRoute, /projectPublicMotorNoRunRecords|noRunsWithoutMeasuredRuntime|positiveMeasuredMotorRuntimeDays/, "Admin retains the complete unfiltered audit stream")
assert.deepEqual(Object.keys(decisionNoRuns[0]), ["date", "motorId", "motorName", "status", "reason", "runtime", "water"])

const require = createRequire(import.meta.url)
const ts = require("typescript")
const pipelineSigningSource = readFileSync(new URL("../lib/irrigation-pipeline-signing.ts", import.meta.url), "utf8")
const pipelineSigningOutput = ts.transpileModule(pipelineSigningSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const pipelineSigningModule = { exports: {} }
Function("require", "module", "exports", pipelineSigningOutput)((specifier) => {
  if (specifier === "@/lib/worker-management-signing") return { WorkerBffError }
  if (specifier === "@/lib/irrigation-pipeline-identity") {
    return { pipelineAssertionRole, PipelineIdentityError, resolveTrustedPipelineIdentity }
  }
  throw new Error(`Unexpected decision-table dependency: ${specifier}`)
}, pipelineSigningModule, pipelineSigningModule.exports)
const { resolvePipelineActor } = pipelineSigningModule.exports
const trustedHeaders = (role, environment = "production", permission = null) => {
  const headers = new Headers({
    "X-MFMS-User": "validated-user",
    "X-MFMS-Role": role,
    "X-MFMS-Environment": environment,
  })
  if (permission !== null) headers.set("X-MFMS-Permission", permission)
  return headers
}
const identityDecisionCases = [
  {
    name: "trusted development owner write",
    run: () => resolvePipelineActor(new Headers(), {
      MFMS_ENV: "development",
      MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
      MFMS_WORKER_LOCAL_ACTOR_USERNAME: "configured-local-owner",
      MFMS_WORKER_LOCAL_ACTOR_ROLE: "owner",
    }, "PUT"),
    expected: { username: "configured-local-owner", role: "admin", environment: "local" },
  },
  {
    name: "production owner without optional permission",
    run: () => resolvePipelineActor(trustedHeaders("owner"), { MFMS_ENV: "production", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" }, "PUT"),
    expected: { username: "validated-user", role: "admin", environment: "production" },
  },
]
for (const decision of identityDecisionCases) assert.deepEqual(decision.run(), decision.expected, decision.name)
const identityRejectionCases = [
  {
    name: "unsupported environment",
    status: 403,
    run: () => resolvePipelineActor(trustedHeaders("owner", "staging"), { MFMS_ENV: "staging", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" }, "GET"),
  },
  {
    name: "viewer write",
    status: 403,
    run: () => resolvePipelineActor(trustedHeaders("viewer"), { MFMS_ENV: "production", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" }, "PUT"),
  },
  {
    name: "trusted permission restricts owner write",
    status: 403,
    run: () => resolvePipelineActor(trustedHeaders("owner", "production", "read"), { MFMS_ENV: "production", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" }, "PUT"),
  },
  {
    name: "client cannot select development mode",
    status: 401,
    run: () => resolvePipelineActor(trustedHeaders("owner", "development", "write"), { MFMS_ENV: "production", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" }, "PUT"),
  },
]
for (const decision of identityRejectionCases) {
  assert.throws(decision.run, (error) => error instanceof WorkerBffError && error.status === decision.status, decision.name)
}

console.log("Known-zero versus missing dashboard regression passed")
