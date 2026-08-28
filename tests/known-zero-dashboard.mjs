import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  applyScheduledKnownZerosToTrend,
  formatKnownZeroActual,
  formatKnownZeroDisplayReason,
  knownZeroReasonsForZoneDate,
  noRunReasonForAllMotors,
} from "../lib/known-zero-data.ts"
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
assert.equal(knownZeroReasonsForZoneDate(activeNoRuns, "2026-08-26").P1E, "Heavy rain")
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
const knownZeroPoint = {
  ...missingPoint,
  date: "2026-08-25",
  displayDate: "25 Aug",
  knownZeroReasons: knownZeroReasonsForZoneDate(activeNoRuns, "2026-08-25"),
}
const actualPoint = {
  ...knownZeroPoint,
  date: "2026-08-27",
  displayDate: "27 Aug",
  totalWaterLitres: 50_000,
  totalRuntimeHours: 1,
  P1E: 100,
}
const trend = applyScheduledKnownZerosToTrend(
  [missingPoint, knownZeroPoint, actualPoint],
  (zoneId, date) => date !== "2026-08-24" && ["P1E", "P2W"].includes(zoneId),
)
assert.deepEqual(trend[0], missingPoint, "missing dates remain gaps")
assert.equal(trend[1].P1E, 0)
assert.equal(trend[1].P2W, 0)
assert.equal(trend[1].P1W, null, "an unscheduled zone remains a gap")
assert.equal(trend[1].totalWaterLitres, 0)
assert.equal(trend[1].totalRuntimeHours, 0)
assert.equal(trend[2].P1E, 100, "measured runtime is never overwritten")
assert.equal(trend[2].totalWaterLitres, 50_000)

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
const wellTable = readFileSync(new URL("../components/farm/well-table.tsx", import.meta.url), "utf8")
assert.match(wellRoute, /fetchPublicMotorNoRunRecords/)
assert.match(irrigationRoute, /fetchPublicMotorNoRunRecords/)
assert.match(wellTable, /Not run: \{formatKnownZeroDisplayReason\(record\.knownZeroReason\)\}/)

console.log("Known-zero versus missing dashboard regression passed")
