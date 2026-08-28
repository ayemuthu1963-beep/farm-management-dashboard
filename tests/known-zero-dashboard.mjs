import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  applyScheduledKnownZerosToTrend,
  applyScheduledKnownZerosToZones,
  formatKnownZeroActual,
  formatKnownZeroDisplayReason,
  noRunReasonForAllMotors,
} from "../lib/known-zero-data.ts"
import { emptyIrrigationData } from "../lib/irrigation-data.ts"
import { projectPublicMotorNoRunRecords } from "../lib/motor-data.ts"
import { buildWellDashboardData, toChartData } from "../lib/well-data.ts"

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

const northRow = {
  date: "2026-08-25", well_id: "north", well_code: "well1", well_name: "North Well",
  morning_water_liters: 448470, evening_water_liters: 446820, motor_runtime_minutes: 0,
  water_pumped_out_liters: null, observed_storage_change_liters: -1650,
  difference_in_morning_readings_litres: 25000, remarks: "Live readings retained", reading_count: 2,
  morning_reading_id: 88, evening_reading_id: 90, capacity_liters: 1128270,
  liters_per_inch: 1650, calculation_method: "CAPACITY_MINUS_TAPE",
}
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
assert.match(wellRoute, /fetchPublicMotorNoRunRecords/)
assert.match(irrigationRoute, /fetchPublicMotorNoRunRecords/)
assert.match(irrigationRoute, /motorNoRunRecords: \[\.\.\.noRunRecords\]/)
assert.doesNotMatch(irrigationRoute, /knownZeroReasonsForZoneDate/)
assert.doesNotMatch(knownZeroSource, /ZONE_SCHEDULE_MOTOR_IDS/)
assert.doesNotMatch(knownZeroSource, /P1E:\s*"M1"|P2W:\s*"M2"|P2E:\s*"M3"/, "no fixed zone-to-Motor fallback remains")
assert.match(wellTable, /Not run: \{formatKnownZeroDisplayReason\(record\.knownZeroReason\)\}/)

console.log("Known-zero versus missing dashboard regression passed")
