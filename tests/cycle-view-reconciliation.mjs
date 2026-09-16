import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  formatReconciliationNumber,
  formatReconciliationPercent,
  reconciliationNumber,
} from "../lib/coconut-counting-reconciliation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const component = read("components/coconut/cycle-reconciliation-table.tsx")
const page = read("app/coconut-harvest/cycle-view/page.tsx")
const readRoute = read("app/api/coconut-harvest/cycle-reconciliation/route.ts")
const writeRoute = read("app/api/coconut-counting-admin/cycles/[cycle]/plots/[plot]/harvested/route.ts")
const harvestApi = read("lib/coconut-harvest-api.ts")

test("Excel column order and formulas are explicit in the permanent harvest table", () => {
  const labels = [
    "Cycle",
    "Plot",
    "Harvest date",
    "Status",
    "Entries",
    "Grade A",
    "Grade B",
    "Count B",
    "Combined",
    "Physical",
    "Rejection",
    "Harvested",
    "Last sync",
  ]
  let cursor = component.indexOf("<thead>")
  for (const label of labels) {
    const next = component.indexOf(`>${label}<`, cursor)
    assert.ok(next > cursor, `${label} must follow the prior Excel column`)
    cursor = next
  }

  assert.match(component, /Grade B = Count B × 2/)
  assert.match(component, /Combined = Grade A \+ Count B/)
  assert.match(component, /Physical = Grade A \+ Grade B/)
  assert.match(component, /Rejection = Harvested − Physical/)
  assert.match(component, />Total \{summary\.plot\}</)
  assert.match(component, />Percentage</)
})

test("Harvested is editable only on each Cycle and Plot total with concurrency protection", () => {
  assert.equal((component.match(/<HarvestedEditor summary=\{summary\}/g) ?? []).length, 2)
  assert.match(component, /expected_revision: summary\.harvested_revision/)
  assert.match(component, /Reason for correction/)
  assert.match(component, /summary\.harvested_revision > 0/)
  assert.match(writeRoute, /getAdminTargetSafetyErrors/)
  assert.match(writeRoute, /getAuthenticatedUserAssertionHeaders/)
  assert.match(writeRoute, /expectedRevision > 0 && !reason/)
  assert.match(writeRoute, /AbortSignal\.timeout\(15_000\)/)
})

test("Cycle filter and all-future-cycle modes use the backend reconciliation endpoint", () => {
  assert.match(page, /cycle=\{tableCycle\}/)
  assert.match(page, /setTableCycle\(Number\(cycle\)\)/)
  assert.match(page, /setTableCycle\(null\)/)
  assert.match(page, /reconciliationCycleOptions, \.\.\.harvestCycleOptions/)
  assert.match(page, /onCyclesLoaded=\{handleReconciliationCyclesLoaded\}/)
  assert.match(component, /payload\.cycles\.map\(\(item\) => item\.harvest_cycle\)/)
  assert.match(readRoute, /api\/coconut-counting\/reconciliation/)
  assert.match(readRoute, /target\.searchParams\.set\("harvest_cycle"/)
  assert.doesNotMatch(component, /harvest_cycle === 20|cycle === 20|Cycle 20/)
  assert.doesNotMatch(harvestApi, /applyCyclePlotBreakdown|fetchCyclePlotSourceRows/)
})

test("counts and Excel percentages format without hiding discrepancies", () => {
  assert.equal(reconciliationNumber("10791"), 10791)
  assert.equal(formatReconciliationNumber(10802), "10,802")
  assert.equal(formatReconciliationPercent(55.59155711905203), "56%")
  assert.equal(formatReconciliationPercent(44.30660988705795), "44%")
  assert.equal(formatReconciliationPercent(0.10183299389002038), "0%")
  assert.equal(formatReconciliationNumber(-11), "-11")
  assert.match(component, /number < 0 \? "font-bold text-destructive"/)
})

test("legacy sessions without Cycle or Plot are disclosed", () => {
  assert.match(component, /unassigned_session_count/)
  assert.match(component, /legacy session\(s\) have no Cycle or Plot and are excluded until assigned/)
})
