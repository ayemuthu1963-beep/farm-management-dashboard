import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const page = readFileSync(new URL("../app/coconut-counting/page.tsx", import.meta.url), "utf8")
const api = readFileSync(new URL("../lib/coconut-counting-api.ts", import.meta.url), "utf8")

test("Coconut Counting contract exposes nullable Cycle and Plot metadata", () => {
  assert.match(api, /harvest_cycle: number \| null/)
  assert.match(api, /plot: 1 \| 2 \| null/)
})

test("desktop session table uses the requested Cycle and Plot column order", () => {
  const tableHead = page.slice(page.indexOf("<thead"), page.indexOf("</thead>"))
  const headings = [...tableHead.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").trim(),
  )

  assert.deepEqual(headings.slice(0, 11), [
    "Cycle",
    "Plot",
    "Harvest date",
    "Status",
    "Entries",
    "Grade A",
    "Grade B",
    "Combined",
    "Physical",
    "Harvested",
    "Last sync",
  ])
  assert.equal(headings[11], "View")
  assert.match(page, /formatNumber\(session\.harvest_cycle\)/)
  assert.match(page, /formatNumber\(session\.plot\)/)
})

test("Cycle and Plot remain visible on mobile cards and in complete session data", () => {
  assert.match(page, /sm:grid-cols-6/)
  assert.match(page, /label: "Cycle", value: formatNumber\(session\.harvest_cycle\)/)
  assert.match(page, /label: "Plot", value: formatNumber\(session\.plot\)/)
})
