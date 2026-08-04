import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { buildTreeWiseQueryWorkbook } from "../lib/tree-wise-query-excel.ts"

const [page, apiRoute, apiClient, workbook, hub] = await Promise.all([
  readFile(new URL("../app/coconut-harvest/tree-wise-query/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/coconut-harvest/tree-wise-query/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/coconut-harvest-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/tree-wise-query-excel.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/coconut-harvest/page.tsx", import.meta.url), "utf8"),
])

assert.match(hub, /Tree-wise Table Query/)
assert.match(hub, /\/coconut-harvest\/tree-wise-query/)
assert.match(apiRoute, /fetchTreeWiseQueryData/)
assert.match(apiRoute, /includeNoRecord/)

assert.match(page, /const PAGE_SIZE = 100/)
assert.match(page, /overflow-x-auto/)
assert.match(page, /overflow-x-scroll/)
assert.match(page, /overscroll-x-contain/)
assert.match(page, /bodyClassName="min-w-0 max-w-full overflow-hidden"/)
assert.match(page, /aria-label="Scroll harvest cycles horizontally"/)
assert.match(page, /topScrollRef/)
assert.match(page, /cycleScrollRef/)
assert.match(page, /gridTemplateColumns: `\$\{leftWidth\}px minmax\(0, 1fr\) \$\{totalWidth\}px`/)
assert.match(page, /cycleColumnWidths\[measure\]/)
assert.match(page, /totalColumnWidths\[total\]/)
assert.match(page, /const cumulativeTotals = totals\.filter/)
assert.match(page, /rowSpan=\{2\}/)
assert.match(page, /Missed<br \/>Harvest/)
assert.doesNotMatch(page, /style=\{\{ right: `\$\{totalRight/)
assert.match(page, /Sort .* ascending/)
assert.match(page, /Sort .* descending/)
assert.match(page, /ChevronUp/)
assert.match(page, /ChevronDown/)
assert.match(page, /Select All/)
assert.match(page, /Clear All/)
assert.match(page, /Standard Preset/)
assert.match(page, /Include trees with no harvest record in selected cycles/)
assert.match(page, /Cycle columns/)
assert.match(page, /Tree columns/)
assert.match(page, /Cumulative totals/)
assert.match(page, /plot: "Plot"/)
assert.match(page, /classification: "Class"/)
assert.match(page, /reason: "Reason"/)
assert.match(page, /totalBunches: "Total Bun"/)
assert.match(page, /totalNuts: "Total Nuts"/)
assert.match(page, /totalSale: "Total Sale"/)
assert.match(page, /totalMissed: "Total Missed"/)
assert.match(page, /disabled=\{Boolean\(requiredMeasure && !measures\.includes\(requiredMeasure\)\)\}/)
assert.match(page, /data\.rows, cycles: data\.cycles, measures, metadata, totals/)
assert.match(page, /measures\.length > 0 \? data\.cycles\.map/)
assert.match(page, /disabled=\{exporting \|\| measures\.length === 0\}/)
assert.match(page, /bg-emerald-100\/90/, "Tree Number header must have a distinct background")
assert.match(page, /bg-sky-100\/90/, "cycle headers must have a distinct background")
assert.match(page, /bg-amber-100\/90/, "Totals header must have a distinct background")
assert.match(page, /bg-rose-100\/90/, "Missed Harvest header must have a distinct background")

assert.match(apiClient, /performance\.details\.map/)
assert.match(apiClient, /\.\.\.matrixRows\.map/)
assert.match(apiClient, /if \(!filters\.includeNoRecord && !byCycle\) continue/)
assert.match(apiClient, /if \(!value\.hasRecord\) totalMissed \+= 1/)
assert.match(apiClient, /current\.hasRecord = true/)
assert.match(apiClient, /classificationReason/)
assert.match(apiClient, /matchingCycles\.slice\(0, 10\)/)
assert.match(apiClient, /rows\.sort\(\(left, right\) => compareTreeNumbers/)

assert.match(workbook, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/)
assert.match(workbook, /MFMS_Tree_Wise_Query_/)
assert.match(workbook, /Tree No\./)
assert.match(workbook, /C\$\{cycle\.cycle\} \$\{measureLabel\[measure\]\}/)
assert.match(workbook, /autoFilter/)
assert.match(workbook, /state="frozen"/)

const workbookBlob = buildTreeWiseQueryWorkbook({
  cycles: [{ cycle: "18", startDate: "2026-01-01", endDate: "2026-01-14" }],
  measures: ["nuts", "sale"],
  metadata: ["classification", "reason"],
  totals: ["totalNuts", "totalSale", "totalMissed"],
  rows: [{
    treeNo: "845.1",
    plot: "Plot 1",
    classification: "Good",
    reason: "20 or more nuts",
    cycles: { "18": { bunches: 1, nuts: 22, sale: 220, hasRecord: true } },
    totalBunches: 1,
    totalNuts: 22,
    totalSale: 220,
    totalMissed: 0,
  }],
})
const workbookBytes = new Uint8Array(await workbookBlob.arrayBuffer())
const workbookText = new TextDecoder().decode(workbookBytes)
assert.deepEqual([...workbookBytes.slice(0, 2)], [0x50, 0x4b], "Excel export must be a ZIP-based .xlsx workbook")
assert.match(workbookText, /Tree-wise Query/)
assert.match(workbookText, /845\.1/)
assert.match(workbookText, /C18 Nuts/)
assert.match(workbookText, /C18 Sale/)
assert.match(workbookText, /Total Missed/)
assert.match(workbookText, /xSplit="1" ySplit="5"/)

console.log("Tree-wise Table Query selection, table, totals, pagination, sorting, and Excel contracts passed.")
