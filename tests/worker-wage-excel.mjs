import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { strFromU8, unzipSync } from "fflate"
import {
  buildWorkerWageWorkbook,
  calculateWageSheetTotals,
  WORKER_WAGE_TOTAL_LABEL,
} from "../lib/worker-wage-excel.ts"

const headers = [
  "Worker name",
  "Base wage",
  "Reference",
  "Entry",
  "15.08 Sat",
  "16.08 Sun",
  "17.08 Mon",
  "18.08 Tue",
  "19.08 Wed",
  "20.08 Thu",
  "21.08 Fri",
  "Week wages",
  "To loan payment",
  "Wage to be paid",
  "Earlier loan balance",
  "Cash paid in week",
  "Present balance",
]

const aggregateRows = [
  {
    dailyWages: [100, 200, 0, 400, 500, 600, 700],
    weekWages: 2500,
    loanPayment: 500,
    wageToPay: 2000,
    earlierLoanBalance: -4000,
    cashPaidInWeek: 800,
    presentBalance: -4300,
    includeFinancials: true,
  },
  {
    dailyWages: [50, null, undefined, 200, 0, 300, 350],
    weekWages: 900,
    loanPayment: null,
    wageToPay: null,
    earlierLoanBalance: null,
    cashPaidInWeek: null,
    presentBalance: null,
    includeFinancials: false,
  },
]

const detailRows = [
  ["Arunan", 400, "A1", "Daily wage", 100, 200, 0, 400, 500, 600, 700, 2500, 500, 2000, -4000, 800, -4300],
  ["Outside Ladies", 320, "G1", "No", 2, 0, null, 3, 0, 1, 2, null, null, null, null, null, null],
  ["Outside Ladies", 320, "G1", "Group wage (rate × labourers)", 50, null, null, 200, 0, 300, 350, 900, null, null, null, null, null],
]

function decodeXml(value) {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")
}

function readCells(sheetXml) {
  const cells = new Map()
  const cellPattern = /<c r="([A-Z]+\d+)" s="(\d+)"(?: t="([^"]+)")?>([\s\S]*?)<\/c>/g
  for (const match of sheetXml.matchAll(cellPattern)) {
    const [, reference, style, type, body] = match
    if (type === "inlineStr") {
      const text = body.match(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/)?.[1] ?? ""
      cells.set(reference, { type: "string", value: decodeXml(text), style: Number(style) })
    } else {
      const numericValue = body.match(/<v>([^<]+)<\/v>/)?.[1]
      cells.set(reference, { type: "number", value: Number(numericValue), style: Number(style) })
    }
  }
  return cells
}

function expectedTotalValues(totals) {
  return [
    ...totals.dailyWages,
    totals.wages,
    totals.loanPayment,
    totals.wageToPay,
    totals.earlierLoanBalance,
    totals.advances,
    totals.presentBalance,
  ]
}

function assertWorkbookMatches({ workbookBytes, expectedDetailCount, expectedTotals }) {
  const files = unzipSync(workbookBytes)
  const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"])
  const workbook = strFromU8(files["xl/workbook.xml"])
  const cells = readCells(worksheet)
  const worksheetRows = [...worksheet.matchAll(/<row r="\d+"/g)]
  const finalRowNumber = expectedDetailCount + 2

  assert.equal(worksheetRows.length - 2, expectedDetailCount, "the detail-row count must be unchanged")
  assert.match(workbook, /<sheet name="Worker wages"/, "the worksheet name must remain Worker wages")
  assert.deepEqual(cells.get(`A${finalRowNumber}`), { type: "string", value: WORKER_WAGE_TOTAL_LABEL, style: 3 })
  for (const column of ["B", "C", "D"]) {
    assert.equal(cells.has(`${column}${finalRowNumber}`), false, `${column}${finalRowNumber} must be blank`)
  }

  const totalColumns = ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"]
  const displayedTotals = expectedTotalValues(expectedTotals)
  for (const [index, column] of totalColumns.entries()) {
    const cell = cells.get(`${column}${finalRowNumber}`)
    assert.equal(cell?.type, "number", `${column}${finalRowNumber} must be a numeric Excel cell`)
    assert.equal(cell?.value, displayedTotals[index], `${column}${finalRowNumber} must match the UI aggregation`)
    assert.equal(cell?.style, 4, `${column}${finalRowNumber} must retain the total currency format`)
  }
}

const defaultTotals = calculateWageSheetTotals(aggregateRows)
assert.deepEqual(defaultTotals, {
  dailyWages: [150, 200, 0, 600, 500, 900, 1050],
  wages: 3400,
  loanPayment: 500,
  wageToPay: 2000,
  earlierLoanBalance: -4000,
  advances: 800,
  presentBalance: -4300,
})

const defaultWorkbook = buildWorkerWageWorkbook({ headers, detailRows, totals: defaultTotals })
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "mfms-worker-wage-export-"))
const workbookPath = path.join(temporaryDirectory, "worker-wages-test.xlsx")
await writeFile(workbookPath, defaultWorkbook)
const reopenedWorkbook = new Uint8Array(await readFile(workbookPath))
assertWorkbookMatches({ workbookBytes: reopenedWorkbook, expectedDetailCount: detailRows.length, expectedTotals: defaultTotals })

const authoritativeCurrentRows = [
  [-17480, 0, -17480],
  [-3834, 4050, -7884],
  [-18, 0, -18],
  [-1000, 0, -1000],
  [-24050, 500, -24550],
  [-13300, 0, -13300],
  [-3500, 0, -3500],
].map(([earlierLoanBalance, cashPaidInWeek, presentBalance]) => ({
  dailyWages: [0, 0, 0, 0, 0, 0, 0],
  weekWages: 0,
  loanPayment: 0,
  wageToPay: 0,
  earlierLoanBalance,
  cashPaidInWeek,
  presentBalance,
  includeFinancials: true,
}))
const blankDependentRows = ["Rani", "Chitra"].map(() => ({
  dailyWages: [0, 0, 0, 0, 0, 0, 0],
  weekWages: 0,
  loanPayment: null,
  wageToPay: null,
  earlierLoanBalance: null,
  cashPaidInWeek: null,
  presentBalance: null,
  includeFinancials: false,
}))
const authoritativeCurrentTotals = calculateWageSheetTotals([
  ...authoritativeCurrentRows,
  ...blankDependentRows,
])
assert.equal(authoritativeCurrentTotals.earlierLoanBalance, -63182, "Excel and UI must share the authoritative current opening total")
assert.equal(authoritativeCurrentTotals.advances, 4550, "Excel and UI must deduct current advances exactly once")
assert.equal(authoritativeCurrentTotals.presentBalance, -67732, "Excel and UI must share the authoritative current present total")

const filteredTotals = calculateWageSheetTotals([aggregateRows[0]])
assert.deepEqual(filteredTotals.dailyWages, aggregateRows[0].dailyWages)
assert.equal(filteredTotals.wages, 2500, "a filtered export must total only its exported records")

const searchedWorkerTotals = calculateWageSheetTotals([aggregateRows[1]])
assert.equal(searchedWorkerTotals.wages, 900, "worker search must total only the matching exported worker")
assert.equal(searchedWorkerTotals.loanPayment, 0, "blank dependent financial values must stay zero in totals")

const pagedExportTotals = calculateWageSheetTotals([...aggregateRows.slice(0, 1), ...aggregateRows.slice(1)])
assert.deepEqual(pagedExportTotals, defaultTotals, "pagination must not drop records from the exported aggregation")

const noMatchTotals = calculateWageSheetTotals([])
const noMatchWorkbook = buildWorkerWageWorkbook({ headers, detailRows: [], totals: noMatchTotals })
assertWorkbookMatches({ workbookBytes: noMatchWorkbook, expectedDetailCount: 0, expectedTotals: noMatchTotals })

await rm(temporaryDirectory, { recursive: true, force: true })
console.log("worker-wage-excel: Sheet Total workbook regression checks passed")
