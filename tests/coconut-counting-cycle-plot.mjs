import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const page = readFileSync(new URL("../app/coconut-counting/page.tsx", import.meta.url), "utf8")
const api = readFileSync(new URL("../lib/coconut-counting-api.ts", import.meta.url), "utf8")

test("Coconut Counting contract exposes nullable Cycle and Plot metadata", () => {
  assert.match(api, /harvest_cycle: number \| null/)
  assert.match(api, /plot: 1 \| 2 \| null/)
})

test("desktop session table starts with Cycle, Plot, then Harvest date", () => {
  const tableHead = page.slice(page.indexOf("<thead"), page.indexOf("</thead>"))
  const cycle = tableHead.indexOf(">Cycle</th>")
  const plot = tableHead.indexOf(">Plot</th>")
  const harvestDate = tableHead.indexOf(">Harvest date</th>")

  assert.ok(cycle >= 0)
  assert.ok(cycle < plot)
  assert.ok(plot < harvestDate)
  assert.match(page, /formatNumber\(session\.harvest_cycle\)/)
  assert.match(page, /formatNumber\(session\.plot\)/)
})

test("Cycle and Plot remain visible on mobile cards and in complete session data", () => {
  assert.match(page, /sm:grid-cols-6/)
  assert.match(page, /label: "Cycle", value: formatNumber\(session\.harvest_cycle\)/)
  assert.match(page, /label: "Plot", value: formatNumber\(session\.plot\)/)
})
