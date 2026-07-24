import assert from "node:assert/strict"

import {
  SOUTH_WELL_CONFIGURATION_WARNING,
  buildWellDashboardData,
  toChartData,
} from "../lib/well-data.ts"

const payload = {
  summary: {
    total_readings: 2,
    first_reading_date: "2026-07-13",
    latest_reading_date: "2026-07-13",
  },
  north_rows: [],
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
      capacity_liters: 632500,
      liters_per_inch: 1300,
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
      capacity_liters: 632500,
      liters_per_inch: 1300,
      level_feet_decimal: 53,
    },
  ],
}

const dashboard = buildWellDashboardData(payload)
const [southRecord] = dashboard.southWellRecords

assert.equal(southRecord.morningWaterDisplay, SOUTH_WELL_CONFIGURATION_WARNING)
assert.equal(southRecord.eveningWaterDisplay, SOUTH_WELL_CONFIGURATION_WARNING)
assert.equal(southRecord.remarks, SOUTH_WELL_CONFIGURATION_WARNING)
assert.equal(southRecord.waterPumpedOut, null)
assert.equal(southRecord.rechargedSinceYesterday, null)

const southStats = dashboard.summaryStats.filter((stat) => stat.wellId === "south")
assert.equal(southStats.length, 4)
for (const stat of southStats) {
  assert.equal(stat.value, null)
  assert.equal(stat.warning, SOUTH_WELL_CONFIGURATION_WARNING)
}

const [southChartPoint] = toChartData(dashboard.southWellRecords)
assert.equal(southChartPoint.morningWater, null)
assert.equal(southChartPoint.eveningWater, null)
assert.equal(southChartPoint.pumpedOut, null)
assert.equal(southChartPoint.recharged, null)

console.log("South Well warning regression passed")
