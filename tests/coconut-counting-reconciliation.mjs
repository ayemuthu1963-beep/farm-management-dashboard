import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  calculateWorkbookValues,
  formatReconciliationNumber,
  formatReconciliationPercent,
} from "../lib/coconut-counting-reconciliation.ts"
import { isHarvestCycleWriteAllowed } from "../lib/coconut-counting-write-gate.ts"
import { getAdminTargetSafetyErrors } from "../lib/preview-admin-write-safety.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const component = read("components/coconut-counting/reconciliation-table.tsx")
const editor = read("components/coconut-counting/harvested-editor.tsx")
const page = read("app/coconut-counting/page.tsx")
const readRoute = read("app/api/coconut-counting/reconciliation/route.ts")
const writeRoute = read("app/api/coconut-counting-admin/cycles/[cycle]/plots/[plot]/harvested/route.ts")
const cycleView = read("app/coconut-harvest/cycle-view/page.tsx")
const harvestApi = read("lib/coconut-harvest-api.ts")

const safePreviewWriteEnvironment = {
  MFMS_ENV: "preview",
  NEXT_PUBLIC_MFMS_ENV: "preview",
  MFMS_ENABLE_LOCAL_WRITE_GUARD: "true",
  MFMS_TARGET_DATABASE: "mfms_server_uat",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_uat",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api-pilot",
  MFMS_LOCAL_WRITE_BACKEND_PORT: "8000",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api-pilot",
  MFMS_ALLOWED_BACKEND_PORT: "8000",
}

test("workbook table has Cycle selector and exactly twelve Excel columns", () => {
  const tableHead = component.slice(component.indexOf("<thead>"), component.indexOf("</thead>"))
  const headings = [...tableHead.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").trim(),
  )
  assert.deepEqual(headings, [
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
  ])
  assert.doesNotMatch(tableHead, />Cycle</)
  assert.match(component, /<select[\s\S]*value=\{selectedCycle \?\? ""\}/)
  assert.match(component, /cycleOptions\.map\(\(cycle\) =>/)
})

test("selected Cycle drives an exact reconciliation request and complete-cycle rows", () => {
  assert.match(component, /fetch\(`\/api\/coconut-counting\/reconciliation\?cycle=\$\{cycle\}`/)
  assert.match(component, /const cycleData = data\?\.cycles\[0\] \?\? null/)
  assert.match(component, /cycleData\.plots\.map/)
  assert.match(component, /plotSessions\(cycleData, summary\.plot\)\.map/)
  assert.doesNotMatch(component, /CoconutCountingDashboardData|dashboard\.sessions|data\.sessions/)
  assert.match(readRoute, /api\/coconut-counting\/reconciliation/)
  assert.match(readRoute, /target\.searchParams\.set\("harvest_cycle"/)
  assert.doesNotMatch(component, /Cycle 20|harvest_cycle === 20|cycle === 20/)
})

test("Excel formulas, blank subtotal Entries and percentages are explicit", () => {
  assert.deepEqual(calculateWorkbookValues(1083, 430), {
    gradeA: 1083,
    countB: 430,
    gradeB: 860,
    combined: 1513,
    physical: 1943,
  })
  assert.equal(formatReconciliationNumber(10802), "10,802")
  assert.equal(formatReconciliationPercent(55.59155711905203), "56%")
  assert.match(component, /Grade B = Count B × 2/)
  assert.match(component, /Combined = Grade A \+ Count B/)
  assert.match(component, /Physical = Grade A \+ Grade B/)
  assert.match(component, /Rejection = Harvested − Physical/)
  assert.match(component, /<th scope="row"[^>]*>Total \{summary\.plot\}<\/th>[\s\S]*?<td[^>]*> <\/td>/)
  assert.match(component, /<th scope="row"[^>]*>Percentage<\/th>[\s\S]*?colSpan=\{3\}[^>]*> <\/td>/)
  assert.doesNotMatch(component, /summary\.last_sync/)
  assert.match(component, /hour12: true/)
})

test("manual Harvested is Cycle/Plot scoped, audited and collision-safe", () => {
  assert.match(editor, /expected_revision: summary\.harvested_revision/)
  assert.match(editor, /summary\.harvested_revision > 0/)
  assert.match(editor, /Reason for correction/)
  assert.match(editor, /idPrefix/)
  assert.match(component, /idPrefix="mobile"/)
  assert.match(component, /idPrefix="desktop"/)
  assert.match(writeRoute, /getAdminTargetSafetyErrors/)
  assert.match(writeRoute, /getAuthenticatedUserAssertionHeaders/)
  assert.match(writeRoute, /MFMS_HARVEST_CYCLE_WRITES_ENABLED/)
  assert.doesNotMatch(writeRoute, /MFMS_ENABLE_PREVIEW_HARVEST_CYCLE_WRITES/)
  assert.match(writeRoute, /expectedRevision > 0 && !reason/)
})

test("manual Harvested rollout gate defaults safely when the dedicated flag is absent", () => {
  const safeTargetErrors = getAdminTargetSafetyErrors(
    safePreviewWriteEnvironment,
    "http://harvest-api-pilot:8000",
  )
  assert.deepEqual(safeTargetErrors, [])
  assert.equal(isHarvestCycleWriteAllowed(undefined, safeTargetErrors), true)
  assert.equal(isHarvestCycleWriteAllowed("true", safeTargetErrors), true)
  assert.equal(isHarvestCycleWriteAllowed(" TRUE ", safeTargetErrors), true)

  for (const explicitKillSwitch of ["false", "enabled", "1", ""]) {
    assert.equal(isHarvestCycleWriteAllowed(explicitKillSwitch, safeTargetErrors), false)
  }

  const unsafeTargetErrors = getAdminTargetSafetyErrors(
    { ...safePreviewWriteEnvironment, MFMS_LOCAL_WRITE_DATABASE: "mfms_server_prod" },
    "http://harvest-api-pilot:8000",
  )
  assert.ok(unsafeTargetErrors.length > 0)
  assert.equal(isHarvestCycleWriteAllowed(undefined, unsafeTargetErrors), false)
  assert.equal(isHarvestCycleWriteAllowed("true", unsafeTargetErrors), false)
})

test("filtered session history remains separate and Cycle View remains restored", () => {
  assert.ok(page.indexOf("<CoconutCountingReconciliationTable />") < page.indexOf("<FilterForm filters={filters} />"))
  assert.match(page, /filters apply only to the session summary and detail records below/)
  assert.match(page, /<SessionTable data=\{dashboard\} filters=\{filters\} \/>/)
  assert.match(page, /<SessionDetail detail=\{detail\} \/>/)
  assert.match(page, /CoconutCountingSessionControls/)
  assert.match(cycleView, /plotRows\?\.map/)
  assert.match(harvestApi, /fetchCyclePlotSourceRows/)
  assert.match(harvestApi, /applyCyclePlotBreakdown/)
  assert.doesNotMatch(cycleView, /CoconutCountingReconciliationTable/)
})
