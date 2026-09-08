import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { strFromU8, unzipSync } from "fflate"
import { buildBeetleTrapMatrix } from "../lib/beetle-trap-matrix.ts"
import {
  beetleTrapMatrixWorkbookFilename,
  buildBeetleTrapMatrixWorkbook,
} from "../lib/beetle-trap-matrix-excel.ts"

const matrix = buildBeetleTrapMatrix(
  [
    {
      trap_no: "10",
      trap_type: "Rhinoceros Beetle",
      active: true,
      inspection_records: [
        { inspection_date: "2026-09-05", beetle_count: 4 },
        { inspection_date: "2026-09-05", beetle_count: 2 },
      ],
    },
    {
      trap_no: "2",
      trap_type: "Red Palm Weevil",
      active: true,
      inspection_records: [
        { inspection_date: "2026-09-05", beetle_count: "3" },
        { inspection_date: "2026-09-01", beetle_count: 0 },
      ],
    },
    {
      trap_no: "1",
      trap_type: "Rhinoceros Beetle",
      active: true,
      inspection_records: [{ inspection_date: "2026-09-01", beetle_count: 5 }],
    },
    {
      trap_no: "99",
      trap_type: "Red Palm Weevil",
      active: false,
      inspection_records: [{ inspection_date: "2026-09-05", beetle_count: 100 }],
    },
  ],
  ["2026-09-05", "2026-08-31"],
)

assert.deepEqual(matrix.traps.map((trap) => trap.trapNo), ["1", "2", "10"])
assert.deepEqual(matrix.traps.map((trap) => trap.total), [5, 3, 6])
assert.deepEqual(matrix.rows.map((row) => row.sourceDate), ["2026-09-05", "2026-09-01", "2026-08-31"])
assert.deepEqual(matrix.rows[0].counts, [null, 3, 6])
assert.deepEqual(matrix.rows[1].counts, [5, 0, null])
assert.deepEqual(matrix.rows[2].counts, [null, null, null])

const [page, table, exportButton] = await Promise.all([
  readFile(new URL("../app/beetle-trap/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-trap-daily-matrix.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-trap-matrix-excel-export.tsx", import.meta.url), "utf8"),
])

assert.match(page, /getBeetleTrapLocations/)
assert.match(page, /Promise\.all/)
assert.match(page, /href=\{`#beetle-traps-\$\{entry\.sourceDate\}`\}/)
assert.ok(page.indexOf('title="Daily Beetle Count Data"') < page.indexOf("<BeetleTrapDailyMatrix"))
assert.match(table, /title="Beetle in Traps"/)
assert.match(table, /Trap No\./)
assert.match(table, /id=\{`beetle-traps-\$\{row\.sourceDate\}`\}/)
assert.match(table, /target:bg-amber-100/)
assert.match(table, /Red Palm Weevil/)
assert.match(table, /Rhinoceros Beetle/)
assert.match(table, /text-red-700/)
assert.match(table, /text-black/)
assert.match(table, />\s*Total\s*</)
assert.ok(table.indexOf("Total") < table.indexOf("matrix.rows.map"))
assert.match(table, /trap\.total === 0 \? null : trap\.total/)
assert.match(table, /count === null \|\| count === 0 \? null : count/)
assert.doesNotMatch(table, /<tfoot>/)
assert.doesNotMatch(table, /—/)
assert.match(table, /Blank cells indicate zero or no recorded count\./)
assert.match(table, /BeetleTrapMatrixExcelExport/)
assert.match(exportButton, /Export to Excel/)
assert.match(exportButton, /buildBeetleTrapMatrixWorkbook\(matrix\)/)

const workbook = buildBeetleTrapMatrixWorkbook(matrix)
assert.equal(workbook.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
const files = unzipSync(new Uint8Array(await workbook.arrayBuffer()))
const sheet = strFromU8(files["xl/worksheets/sheet1.xml"])
const styles = strFromU8(files["xl/styles.xml"])
assert.ok(sheet.indexOf("Trap No.") < sheet.indexOf("Total"))
assert.ok(sheet.indexOf("Total") < sheet.indexOf("05 Sept 2026"))
assert.match(sheet, /Blank cells indicate zero or no recorded count\./)
assert.doesNotMatch(sheet, /<v>0<\/v>/)
assert.match(sheet, /<v>3<\/v>/)
assert.match(sheet, /<v>6<\/v>/)
assert.match(styles, /FFB91C1C/)
assert.match(styles, /FF000000/)
assert.match(beetleTrapMatrixWorkbookFilename(), /^beetle-in-traps-\d{4}-\d{2}-\d{2}\.xlsx$/)

console.log("Beetle Trap totals-first matrix, blank zero cells, Excel export, and Home tile contracts passed.")
