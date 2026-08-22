import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  EXPECTED_COCONUT_PLOT_COUNTS,
  motorPlotDisplayLabels,
  pipelineZoneDisplayCodes,
  plotNameForTreeNo,
} from "../lib/plot-identity.ts"
import { detailedQueryClassifications } from "../lib/coconut-harvest-data.ts"
import { fertiliserLocationDisplay, fertiliserLocationOptions } from "../lib/fertiliser-data.ts"
import { zoneConfigs } from "../lib/irrigation-data.ts"
import {
  initialDripOutputRows,
  initialMotorRunScheduleRows,
  parseDripOutputRows,
  parseMotorRunScheduleRows,
} from "../lib/irrigation-plan.ts"

assert.equal(plotNameForTreeNo("1"), "Plot 2")
assert.equal(plotNameForTreeNo("999.9"), "Plot 2")
assert.equal(plotNameForTreeNo("1000"), "Other")
assert.equal(plotNameForTreeNo("1000.1"), "Other")
assert.equal(plotNameForTreeNo("1001"), "Plot 1")
assert.equal(plotNameForTreeNo("2162.1"), "Plot 1")
assert.equal(plotNameForTreeNo("invalid"), "Other")
assert.deepEqual(EXPECTED_COCONUT_PLOT_COUNTS, { "Plot 1": 1_163, "Plot 2": 954 })

const coordinateAsset = JSON.parse(await readFile(
  "public/map-data/coordinates/Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026.geojson",
  "utf8",
))
const derivedCounts = coordinateAsset.features.reduce((counts, feature) => {
  const plot = plotNameForTreeNo(feature.properties.treeNo)
  assert.notEqual(plot, "Other")
  counts[plot] += 1
  return counts
}, { "Plot 1": 0, "Plot 2": 0 })
assert.deepEqual(derivedCounts, EXPECTED_COCONUT_PLOT_COUNTS)

assert.equal(detailedQueryClassifications.plot1.includes("Century Maker"), false)
assert.equal(detailedQueryClassifications.plot2.includes("Century Maker"), true)
assert.equal(fertiliserLocationDisplay("Plot 1"), "Plot 2")
assert.equal(fertiliserLocationDisplay("Plot 2"), "Plot 1")
assert.deepEqual(fertiliserLocationOptions.slice(0, 2), [
  { value: "Plot 1", label: "Plot 2" },
  { value: "Plot 2", label: "Plot 1" },
])

assert.deepEqual(
  [zoneConfigs.P1E.plot, ...zoneConfigs.P1E.configuredMotorValves],
  ["Plot2_East", "Motor 1 Valve 1", "Motor 2 Valve 7", "Motor 3 Valve 13"],
)
assert.deepEqual(
  [zoneConfigs.P2E.plot, ...zoneConfigs.P2E.configuredMotorValves],
  ["Plot1_East", "Motor 1 Valve 3", "Motor 2 Valve 9"],
)
assert.deepEqual(zoneConfigs.NM.overlaps, ["P2E", "P1W"])
assert.equal(motorPlotDisplayLabels.Plot2_East, "Plot 1 East")
assert.equal(motorPlotDisplayLabels.Plot1_East, "Plot 2 East")

assert.deepEqual(initialDripOutputRows().map(({ zoneId, zone }) => [zoneId, zone]), [
  ["zone-p2e", "P1E"],
  ["zone-p2w", "P1W"],
  ["zone-p1e", "P2E"],
  ["zone-p1w", "P2W"],
  ["zone-nm", "NM"],
  ["zone-jf", "JF"],
])
assert.deepEqual(initialMotorRunScheduleRows().map(({ scheduleId, plot }) => [scheduleId, plot]), [
  ["schedule-m1-p1e", "P2E"],
  ["schedule-m1-p1w", "P2W"],
  ["schedule-m1-nm", "NM"],
  ["schedule-m2-p2w", "P1W"],
  ["schedule-m3-p2e", "P1E"],
  ["schedule-m3-jf", "JF"],
])

const legacyDripRows = initialDripOutputRows().map((row) => ({ ...row, zone: "legacy" }))
assert.deepEqual(parseDripOutputRows(legacyDripRows).map((row) => row.zone), ["P1E", "P1W", "P2E", "P2W", "NM", "JF"])
const legacyScheduleRows = initialMotorRunScheduleRows().map((row) => ({ ...row, plot: "legacy" }))
assert.deepEqual(parseMotorRunScheduleRows(legacyScheduleRows).map((row) => row.plot), ["P2E", "P2W", "NM", "P1W", "P1E", "JF"])

assert.deepEqual(pipelineZoneDisplayCodes, {
  P1W: "P2W",
  P1E: "P2E",
  P2W: "P1W",
  P2E: "P1E",
  JF: "JF",
  NM: "NM",
})

console.log("Plot identity, tree range, valve, irrigation and pipeline contracts: PASS")
