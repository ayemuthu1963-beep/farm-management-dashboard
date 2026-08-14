import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  JACKFRUIT_NUTMEG_PUMP_LITRES_PER_HOUR,
  STANDARD_PUMP_LITRES_PER_HOUR,
  pumpedLitresForRuntimeMinutes,
  pumpLitresPerHourForPlot,
} from "../lib/water-pump-rates.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const motorRoute = read("app/api/motor-runtime/dashboard/route.ts")
const motorTable = read("components/motor/motor-table.tsx")
const motorTrend = read("components/motor/motor-irrigation-trend.tsx")
const motorPage = read("app/motor-runtime/page.tsx")
const motorStatusCards = read("components/motor/motor-status-cards.tsx")
const operatorSettings = read("lib/operator-settings.ts")
const irrigationRoute = read("app/api/irrigation-management/route.ts")
const charts = read("components/irrigation/irrigation-charts-hybrid.tsx")
const harvestProxy = read("app/api/admin/harvest-sync/[[...path]]/route.ts")

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
assert.match(motorRoute, /totalWaterLitres: dayEntries\.reduce/)
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

console.log("Motor Runtime and shared water-pump rate regression passed")
