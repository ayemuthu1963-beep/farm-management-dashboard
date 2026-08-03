import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [page, headerActions, exportButton, workbook] = await Promise.all([
  readFile(new URL("../app/beetle-trap/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-trap-header-actions.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-daily-excel-export.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/beetle-daily-count-excel.ts", import.meta.url), "utf8"),
])

assert.doesNotMatch(page, /Daily Beetle Count – Last 15 Inspection Dates/)
assert.match(page, /Daily Beetle Count \(Start Date:/)
assert.match(page, /activePeriodQuery/)
assert.match(page, /start_date: cumulativeStartDate/)
assert.match(page, /fetchBeetleDashboardData\(activePeriodQuery\)/)
assert.match(page, /className="border-chart-2\/30 bg-chart-2\/5"/)
assert.match(page, /className="border-primary\/30 bg-primary\/5"/)
assert.match(page, /<BeetleDailyExcelExport rows=\{rows\} startDate=\{cumulativeStartDate\}/)
assert.doesNotMatch(headerActions, /ExportButton/)
assert.match(exportButton, /Export to Excel/)
assert.match(exportButton, /buildDailyBeetleCountWorkbook\(\{ rows, startDate \}\)/)
assert.match(exportButton, /dailyBeetleWorkbookFilename/)
assert.match(workbook, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/)
assert.match(workbook, /daily-beetle-count-\$\{safeStartDate\}\.xlsx/)
assert.match(workbook, /Rhinoceros Beetle Count/)
assert.match(workbook, /Red Palm Weevil Count/)
assert.match(workbook, /Cumulative period start date:/)

console.log("Beetle Trap cumulative-period chart, table, and Excel export contracts passed.")
