import assert from "node:assert/strict"

import {
  buildWellDashboardData,
  toChartData,
} from "../lib/well-data.ts"

const payload = {
  summary: {
    total_readings: 2,
    first_reading_date: "2026-07-13",
    latest_reading_date: "2026-07-13",
  },
  north_rows: [
    {
      reading_id: 3,
      reading_date: "2026-07-13",
      reading_time: "06:00:00+05:30",
      well_code: "well1",
      well_name: "North Well",
      feet: 34,
      inches: 3,
      total_inches: 411,
      previous_total_inches: null,
      change_inches: null,
      pumped_out_liters: 0,
      recharge_liters: 0,
      capacity_liters: 1128270,
      liters_per_inch: 1650,
      total_depth_inches: null,
      calculation_method: "CAPACITY_MINUS_TAPE",
      reference_offset_inches: null,
      level_feet_decimal: 34.25,
    },
    {
      reading_id: 4,
      reading_date: "2026-07-13",
      reading_time: "18:00:00+05:30",
      well_code: "well1",
      well_name: "North Well",
      feet: 34,
      inches: 5,
      total_inches: 413,
      previous_total_inches: 411,
      change_inches: 2,
      pumped_out_liters: 3300,
      recharge_liters: 0,
      capacity_liters: 1128270,
      liters_per_inch: 1650,
      total_depth_inches: null,
      calculation_method: "CAPACITY_MINUS_TAPE",
      reference_offset_inches: null,
      level_feet_decimal: 34.42,
    },
  ],
  south_rows: [
    {
      reading_id: 1,
      reading_date: "2026-07-13",
      reading_time: "06:00:00+05:30",
      well_code: "well2",
      well_name: "South Well",
      feet: 52,
      inches: 6,
      total_inches: 630,
      previous_total_inches: null,
      change_inches: null,
      pumped_out_liters: 125000,
      recharge_liters: 75000,
      capacity_liters: 632531,
      liters_per_inch: 1300,
      total_depth_inches: 954,
      calculation_method: "REMAINING_COLUMN_CAPPED",
      reference_offset_inches: null,
      level_feet_decimal: 52.5,
    },
    {
      reading_id: 2,
      reading_date: "2026-07-13",
      reading_time: "18:00:00+05:30",
      well_code: "well2",
      well_name: "South Well",
      feet: 53,
      inches: 0,
      total_inches: 636,
      previous_total_inches: 630,
      change_inches: 6,
      pumped_out_liters: 225000,
      recharge_liters: 110000,
      capacity_liters: 632531,
      liters_per_inch: 1300,
      total_depth_inches: 954,
      calculation_method: "REMAINING_COLUMN_CAPPED",
      reference_offset_inches: null,
      level_feet_decimal: 53,
    },
  ],
}

const dashboard = buildWellDashboardData(payload)
const [southRecord] = dashboard.southWellRecords
const [northRecord] = dashboard.northWellRecords

assert.equal(southRecord.morningWater, 421200)
assert.equal(southRecord.eveningWater, 413400)
assert.equal(southRecord.morningWaterDisplay, "4,21,200")
assert.equal(southRecord.eveningWaterDisplay, "4,13,400")
assert.equal(southRecord.remarks, "Live Data")
assert.equal(southRecord.waterPumpedOut, 7800)
assert.equal(southRecord.rechargedSinceYesterday, null)

const southStats = dashboard.summaryStats.filter((stat) => stat.wellId === "south")
assert.equal(southStats.length, 4)
assert.deepEqual(southStats.map((stat) => stat.value), [421200, 413400, 7800, 0])
assert.ok(southStats.every((stat) => stat.warning === undefined))

const [southChartPoint] = toChartData(dashboard.southWellRecords)
assert.equal(southChartPoint.morningWater, 421200)
assert.equal(southChartPoint.eveningWater, 413400)
assert.equal(southChartPoint.pumpedOut, 7800)
assert.equal(southChartPoint.recharged, null)

assert.equal(northRecord.morningWater, 450120)
assert.equal(northRecord.eveningWater, 446820)
assert.equal(northRecord.waterPumpedOut, 3300)
assert.equal(northRecord.rechargedSinceYesterday, null)

console.log("South Well calculation regression passed")
