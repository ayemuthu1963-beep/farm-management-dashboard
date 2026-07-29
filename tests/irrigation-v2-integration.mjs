import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const page = read("app/irrigation-management/page.tsx")
const route = read("app/api/irrigation-management/route.ts")
const period = read("components/irrigation/irrigation-period-selector.tsx")
const charts = read("components/irrigation/irrigation-charts-hybrid.tsx")
const map = read("components/irrigation/irrigation-map-v2.tsx")
const status = read("components/irrigation/zone-status-cards.tsx")
const summary = read("components/irrigation/irrigation-summary-cards.tsx")
const table = read("components/irrigation/irrigation-zone-table.tsx")
const types = read("lib/irrigation-data.ts")
const visuals = read("components/irrigation/irrigation-zone-visuals.ts")

for (const label of ["Today", "Yesterday", "Last 7 Days", "Custom Date Range"]) {
  assert.match(period, new RegExp(`label: \"${label}\"`))
}
assert.doesNotMatch(period, /Current Cycle/)
assert.match(period, /onRefresh/)
assert.match(period, /onExport/)
assert.match(period, /period=custom&startDate=/)

for (const zone of ["P1E", "P1W", "P2E", "P2W", "JF", "NM"]) {
  assert.match(visuals, new RegExp(`${zone}:`))
}
assert.match(map, /const firstRow = zones\.slice\(0, 4\)/)
assert.match(map, /const secondRow = zones\.slice\(4, 6\)/)
assert.doesNotMatch(map, /Coconut|Sunrise|Sunset|TreePine|TreeDeciduous/)
assert.match(status, /irrigationZoneVisuals/)

for (const title of [
  "Total Water Pumped — Date Wise",
  "Daily Irrigation Trend",
  "Water Per Tree Trend",
]) {
  assert.match(charts, new RegExp(title))
}
assert.match(charts, /<LineChart data=\{trend\}/)
for (const key of ["P1EPerTree", "P1WPerTree", "P2EPerTree", "P2WPerTree", "JFPerTree", "NMPerTree"]) {
  assert.match(charts, new RegExp(key))
  assert.match(types, new RegExp(`${key}: number`))
}
assert.match(route, /cropWaterFigure\(zoneId, minutes\)\.litresPerTree/)

assert.match(table, /title="Irrigation by Zone"/)
for (const heading of ["Water Supplied", "Water per Tree", "Status"]) {
  assert.match(table, new RegExp(heading))
}
assert.doesNotMatch(summary, /Avg Water per Tree/)
assert.doesNotMatch(page, /Selected Zone Details/)
assert.doesNotMatch(charts, /Runtime and Water Pumped by Zone|Water Supplied by Zone/)

assert.match(page, /source !== "live"/)
assert.match(page, /Export to Excel|exportZoneData/)
assert.match(page, /Use Refresh to retry/)
assert.match(charts, /No live irrigation records for the selected period/)
assert.match(table, /Loading live zone totals/)

const workingRouteSources = [page, route, period, charts, map, status, summary, table, types, visuals]
for (const source of workingRouteSources) {
  assert.doesNotMatch(source, /mockZones|mockData|irrigation-mock-data/)
}

console.log("Irrigation V2 live integration checks passed")
