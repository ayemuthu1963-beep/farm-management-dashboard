import { strToU8, zipSync } from "fflate"
import type { WorkerV2FinancialRow, WorkerV2MoneyFields, WorkerV2StateResponse } from "./worker-v2-types"

type Cell = string | number | null

export const WORKER_V2_EXCEL_HEADERS = [
  "Week", "Account code", "Worker", "Financial status", "Opening",
  "Repayment", "Advance", "Present balance", "Own earnings", "Week status",
] as const

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}

function moneyCell(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error("Worker V2 API returned an invalid money value.")
  return parsed
}

function moneyCells(row: WorkerV2MoneyFields): Cell[] {
  return [moneyCell(row.opening_balance), moneyCell(row.repayment_total), moneyCell(row.advance_total), moneyCell(row.closing_balance)]
}

function columnName(index: number) {
  let name = ""
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(((value - 1) % 26) + 65) + name
  }
  return name
}

function cellXml(value: Cell, row: number, column: number, style: number) {
  if (value === null) return ""
  const reference = `${columnName(column)}${row}`
  if (typeof value === "number") return `<c r="${reference}" s="${style}"><v>${value}</v></c>`
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function sheetRow(values: Cell[], rowNumber: number, kind: "header" | "detail" | "total") {
  const cells = values.map((value, column) => {
    const financialColumn = column >= 4 && column <= 8
    const style = kind === "header" ? 1 : kind === "total" ? (financialColumn ? 4 : 3) : financialColumn ? 2 : 0
    return cellXml(value, rowNumber, column, style)
  }).join("")
  return `<row r="${rowNumber}">${cells}</row>`
}

function detailCells(row: WorkerV2FinancialRow): Cell[] {
  return [
    row.week_start, row.account_code, row.display_name,
    row.financial_applicable ? "Applicable" : "Blank / not applicable",
    ...moneyCells(row), moneyCell(row.own_earnings), row.week_status,
  ]
}

export function buildWorkerV2Workbook(response: WorkerV2StateResponse, weekStart: string): Uint8Array {
  const rows = response.rows.filter((row) => row.week_start === weekStart)
  const total = response.totals.find((item) => item.week_start === weekStart)
  if (!total) throw new Error("Worker V2 API did not provide the selected week total.")
  const details = rows.map(detailCells)
  const totalRow: Cell[] = [weekStart, "", "API TOTAL", "", ...moneyCells(total), moneyCell(total.own_earnings), ""]
  const initializationRow: Cell[] = [
    "Fresh-start initialization", response.start_week, "API opening total", "",
    moneyCell(response.initialization.opening_total), "Historical imported", response.historical_records_imported,
  ]
  const rowXml = [
    sheetRow([...WORKER_V2_EXCEL_HEADERS], 1, "header"),
    ...details.map((row, index) => sheetRow(row, index + 2, "detail")),
    sheetRow(totalRow, details.length + 2, "total"),
    sheetRow(initializationRow, details.length + 3, "total"),
  ].join("")
  const lastColumn = columnName(WORKER_V2_EXCEL_HEADERS.length - 1)
  const lastRow = details.length + 3
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="4" width="22" customWidth="1"/><col min="5" max="9" width="18" customWidth="1"/><col min="10" max="10" width="14" customWidth="1"/></cols><sheetData>${rowXml}</sheetData></worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Worker V2" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₹&quot;#,##0;[Red]-&quot;₹&quot;#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheet),
    "xl/styles.xml": strToU8(styles),
  })
}
