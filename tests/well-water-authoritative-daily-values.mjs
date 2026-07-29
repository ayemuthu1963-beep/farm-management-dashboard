import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  buildWellDashboardData,
  buildWellWaterCsv,
  formatSignedLitres,
  toChartData,
} from "../lib/well-data.ts"

const northDays = [
  {
    date: "2026-07-26",
    well_id: "north",
    well_code: "well1",
    well_name: "North Well",
    morning_water_liters: 448470,
    evening_water_liters: 446820,
    motor_runtime_minutes: 74,
    water_pumped_out_liters: 61666.666666666664,
    observed_storage_change_liters: -1650,
    difference_in_morning_readings_litres: 25000,
    remarks: "Live Data",
    reading_count: 2,
    morning_reading_id: 88,
    evening_reading_id: 90,
    capacity_liters: 1128270,
    liters_per_inch: 1650,
    calculation_method: "CAPACITY_MINUS_TAPE",
  },
  {
    date: "2026-07-25",
    well_id: "north",
    well_code: "well1",
    well_name: "North Well",
    morning_water_liters: 448470,
    evening_water_liters: null,
    motor_runtime_minutes: 0,
    water_pumped_out_liters: 0,
    observed_storage_change_liters: null,
    difference_in_morning_readings_litres: null,
    remarks: "Evening reading unavailable",
    reading_count: 1,
    morning_reading_id: 84,
    evening_reading_id: null,
    capacity_liters: 1128270,
    liters_per_inch: 1650,
    calculation_method: "CAPACITY_MINUS_TAPE",
  },
]

const southDays = [
  {
    date: "2026-07-26",
    well_id: "south",
    well_code: "well2",
    well_name: "South Well",
    morning_water_liters: 404300,
    evening_water_liters: 395200,
    motor_runtime_minutes: 180,
    water_pumped_out_liters: 150000,
    observed_storage_change_liters: -9100,
    difference_in_morning_readings_litres: -1300,
    remarks: "Live Data",
    reading_count: 2,
    morning_reading_id: 87,
    evening_reading_id: 89,
    capacity_liters: 632531,
    liters_per_inch: 1300,
    calculation_method: "REMAINING_COLUMN_CAPPED",
  },
]

const payload = {
  summary: {
    total_readings: 5,
    first_reading_date: "2026-07-25",
    latest_reading_date: "2026-07-26",
    selected_start_date: "2026-07-25",
    selected_end_date: "2026-07-26",
    calendar_days: 2,
  },
  daily_rows: [...northDays, ...southDays],
  north_rows: northDays,
  south_rows: southDays,
}

const dashboard = buildWellDashboardData(payload)
const [northRecord, northSingleReading] = dashboard.northWellRecords
const [southRecord] = dashboard.southWellRecords

assert.equal(Math.round(northRecord.waterPumpedOut), 61667)
assert.equal(Math.round(southRecord.waterPumpedOut), 150000)
assert.equal(northRecord.motorRuntimeMinutes, 74)
assert.equal(northRecord.morningWater, 448470)
assert.equal(northRecord.eveningWater, 446820)
assert.equal(northRecord.differenceInMorningReadings, 25000)
assert.equal(southRecord.differenceInMorningReadings, -1300)

assert.equal(northSingleReading.morningWaterDisplay, "4,48,470")
assert.equal(northSingleReading.eveningWaterDisplay, "—")
assert.equal(northSingleReading.differenceInMorningReadings, null)
assert.equal(formatSignedLitres(25000, true), "+25,000 L")
assert.equal(formatSignedLitres(-25000, true), "−25,000 L")
assert.equal(formatSignedLitres(0, true), "0 L")
assert.equal(formatSignedLitres(null, true), "—")

const northStats = dashboard.summaryStats.filter((stat) => stat.wellId === "north")
assert.equal(Math.round(northStats.find((stat) => stat.label === "Total Pumped Out").value), 61667)
assert.equal(
  northStats.find((stat) => stat.label === "Difference in Morning Readings").value,
  25000,
)

const northChart = toChartData(dashboard.northWellRecords)
assert.equal(northChart.at(-1).pumpedOut, northRecord.waterPumpedOut)
assert.equal(
  northChart.at(-1).morningDifference,
  northRecord.differenceInMorningReadings,
)

const csv = buildWellWaterCsv(dashboard)
assert.match(csv, /Difference in Morning Readings \(Litres\)/)
assert.match(csv, /"25000"/)
assert.match(csv, /"-1300"/)
assert.doesNotMatch(csv, /Estimated Recharge/i)

const source = readFileSync(new URL("../lib/well-data.ts", import.meta.url), "utf8")
assert.doesNotMatch(source, /morningWater\s*-\s*eveningWater/)
assert.doesNotMatch(source, /eveningWater\s*-\s*morningWater/)
assert.doesNotMatch(source, /50_?000/)
assert.match(source, /row\.water_pumped_out_liters/)
assert.match(source, /row\.difference_in_morning_readings_litres/)
assert.doesNotMatch(source, /estimated.?recharge/i)

console.log("Well Water authoritative daily-value frontend regression passed")
