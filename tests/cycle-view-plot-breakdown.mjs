import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  applyCyclePlotBreakdown,
  buildCyclePlotBreakdown,
  cycleNeedsPlotBreakdown,
  parseCyclePlotCsv,
} from "../lib/cycle-view-plot-breakdown.ts"

const cycleViewPage = readFileSync(new URL("../app/coconut-harvest/cycle-view/page.tsx", import.meta.url), "utf8")

const cycle = {
  cycle: 20,
  startDate: "2026-08-29",
  endDate: "2026-09-11",
  status: "Locked",
  trees: 4,
  bunches: 7,
  nuts: 20,
  salePrice: 36.75,
  totalSale: 735,
}

const sourceRows = [
  { treeNo: "001", harvestDate: "2026-08-30", totalBunches: 1, totalNuts: 3 },
  { treeNo: "1000.1", harvestDate: "2026-09-02", totalBunches: 2, totalNuts: 7 },
  { treeNo: "1001", harvestDate: "2026-08-29", totalBunches: 1, totalNuts: 0 },
  { treeNo: "1001.1", harvestDate: "2026-09-05", totalBunches: 1, totalNuts: 4 },
  { treeNo: "2250.1", harvestDate: "2026-09-11", totalBunches: 2, totalNuts: 6 },
]

test("only cycles 19 and 20 receive plot breakdown rows", () => {
  assert.equal(cycleNeedsPlotBreakdown(18), false)
  assert.equal(cycleNeedsPlotBreakdown(19), true)
  assert.equal(cycleNeedsPlotBreakdown(20), true)
  assert.equal(cycleNeedsPlotBreakdown(21), false)
})

test("TreeNo boundaries, decimal trees, ODK dates, and totals split correctly", () => {
  const [plot1, plot2] = buildCyclePlotBreakdown(cycle, sourceRows)

  assert.deepEqual(plot1, {
    plot: "Plot 1",
    startDate: "2026-08-30",
    endDate: "2026-09-02",
    trees: 2,
    bunches: 3,
    nuts: 10,
    totalSale: 368,
  })
  assert.deepEqual(plot2, {
    plot: "Plot 2",
    startDate: "2026-08-29",
    endDate: "2026-09-11",
    trees: 2,
    bunches: 4,
    nuts: 10,
    totalSale: 367,
  })
  assert.equal(plot1.trees + plot2.trees, cycle.trees)
  assert.equal(plot1.bunches + plot2.bunches, cycle.bunches)
  assert.equal(plot1.nuts + plot2.nuts, cycle.nuts)
  assert.equal(plot1.totalSale + plot2.totalSale, cycle.totalSale)
})

test("malformed, non-canonical, and out-of-range TreeNos are rejected instead of omitted", () => {
  for (const treeNo of ["", "abc", "0", "1.0", "1000.999", "2250.2", "2251", "-1", "1001x"]) {
    assert.throws(
      () => buildCyclePlotBreakdown({ ...cycle, trees: 1, bunches: 1, nuts: 1 }, [
        { treeNo, harvestDate: "2026-09-01", totalBunches: 1, totalNuts: 1 },
      ]),
      /Invalid TreeNo|outside Plot 1\/Plot 2 range/,
    )
  }
})

test("plot figures must reconcile to the authoritative cycle totals", () => {
  assert.throws(
    () => buildCyclePlotBreakdown({ ...cycle, nuts: 21 }, sourceRows),
    /Cycle 20 plot totals do not reconcile/,
  )
})

test("cycle CSV parsing scopes records by cycle and preserves quoted newlines", () => {
  const csv = [
    "tree_no,harvest_date,total_bunches,total_nuts,remarks,harvest_cycle",
    '999,2026-09-01,1,3,"first line',
    'second line",20',
    "1001,2026-09-02,2,7,,20",
    "1002,2026-09-03,4,9,,19",
  ].join("\r\n")

  assert.deepEqual(parseCyclePlotCsv(csv, 20), [
    { treeNo: "999", harvestDate: "2026-09-01", totalBunches: 1, totalNuts: 3 },
    { treeNo: "1001", harvestDate: "2026-09-02", totalBunches: 2, totalNuts: 7 },
  ])
})

test("target cycles fail closed if the required export shape is unavailable", () => {
  assert.equal(parseCyclePlotCsv("tree_no,total_nuts\n1,4", 20), null)
  assert.equal(
    parseCyclePlotCsv("tree_no,harvest_date,total_bunches,total_nuts\n1,2026-09-01,1,4", 20),
    null,
  )
  assert.throws(
    () => applyCyclePlotBreakdown(cycle, null),
    /Cycle 20 plot breakdown is unavailable/,
  )
  assert.deepEqual(applyCyclePlotBreakdown({ ...cycle, cycle: 18 }, null), { ...cycle, cycle: 18 })
})

test("an empty plot shows blank dates and zero totals", () => {
  const onePlotCycle = { ...cycle, trees: 1, bunches: 1, nuts: 2, totalSale: 73.5 }
  const [plot1, plot2] = buildCyclePlotBreakdown(onePlotCycle, [
    { treeNo: "35.1", harvestDate: "2026-09-01", totalBunches: 1, totalNuts: 2 },
  ])

  assert.equal(plot1.totalSale + plot2.totalSale, onePlotCycle.totalSale)
  assert.deepEqual(plot2, {
    plot: "Plot 2",
    startDate: "",
    endDate: "",
    trees: 0,
    bunches: 0,
    nuts: 0,
    totalSale: 0,
  })
})

test("plot rows remain subordinate row headers and only total rows are interactive", () => {
  const childRows = cycleViewPage.slice(
    cycleViewPage.indexOf("{r.plotRows?.map"),
    cycleViewPage.indexOf("</Fragment>"),
  )

  assert.match(cycleViewPage, /<Fragment key=\{r\.cycle\}>/)
  assert.match(childRows, /<th scope="row"/)
  assert.match(childRows, /\{plotRow\.plot\}/)
  assert.doesNotMatch(childRows, /role="button"|tabIndex=|onClick=|onKeyDown=/)
})
