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
assert.match(motorTable, /Water Pumped/)
assert.match(irrigationRoute, /runtimeWater\(minutes, zoneId\)/)
assert.match(charts, /<Legend content=\{<PerTreeLegend \/>\}/)
assert.match(harvestProxy, /rawSuffix === "status"/)
assert.match(harvestProxy, /NextResponse\.json/)

console.log("Motor Runtime and shared water-pump rate regression passed")
