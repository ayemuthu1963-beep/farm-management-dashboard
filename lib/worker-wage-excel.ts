import { strToU8, zipSync } from "fflate"

export const WORKER_WAGE_SHEET_NAME = "Worker wages"
export const WORKER_WAGE_TOTAL_LABEL = "Sheet Total"

export type WageWorkbookCell = string | number | null

export type WageSheetAggregateRow = {
  dailyWages: Array<number | null | undefined>
  weekWages: number | null | undefined
  loanPayment: number | null | undefined
  wageToPay: number | null | undefined
  earlierLoanBalance: number | null | undefined
  cashPaidInWeek: number | null | undefined
  presentBalance: number | null | undefined
  includeFinancials: boolean
}

export type WageSheetTotals = {
  dailyWages: number[]
  wages: number
  loanPayment: number
  wageToPay: number
  earlierLoanBalance: number
  advances: number
  presentBalance: number
}

type WorkerWageWorkbookInput = {
  headers: string[]
  detailRows: WageWorkbookCell[][]
  totals: WageSheetTotals
  worksheetName?: string
}

function numeric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function calculateWageSheetTotals(rows: WageSheetAggregateRow[], dayCount = 7): WageSheetTotals {
  const totals: WageSheetTotals = {
    dailyWages: Array.from({ length: dayCount }, () => 0),
    wages: 0,
    loanPayment: 0,
    wageToPay: 0,
    earlierLoanBalance: 0,
    advances: 0,
    presentBalance: 0,
  }

  for (const row of rows) {
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
      totals.dailyWages[dayIndex] += numeric(row.dailyWages[dayIndex])
    }
    totals.wages += numeric(row.weekWages)
    if (!row.includeFinancials) continue
    totals.loanPayment += numeric(row.loanPayment)
    totals.wageToPay += numeric(row.wageToPay)
    totals.earlierLoanBalance += numeric(row.earlierLoanBalance)
    totals.advances += numeric(row.cashPaidInWeek)
    totals.presentBalance += numeric(row.presentBalance)
  }

  return totals
}

export function createWageSheetTotalRow(totals: WageSheetTotals): WageWorkbookCell[] {
  return [
    WORKER_WAGE_TOTAL_LABEL,
    null,
    null,
    null,
    ...totals.dailyWages,
    totals.wages,
    totals.loanPayment,
    totals.wageToPay,
    totals.earlierLoanBalance,
    totals.advances,
    totals.presentBalance,
  ]
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function columnName(index: number) {
  let name = ""
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(((value - 1) % 26) + 65) + name
  }
  return name
}

function cellXml(value: WageWorkbookCell, rowNumber: number, columnIndex: number, styleId: number) {
  if (value === null || value === "") return ""
  const reference = `${columnName(columnIndex)}${rowNumber}`
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Worker wage export contains a non-finite number at ${reference}.`)
    return `<c r="${reference}" s="${styleId}"><v>${value}</v></c>`
  }
  return `<c r="${reference}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function rowXml(values: WageWorkbookCell[], rowNumber: number, kind: "header" | "detail" | "total") {
  const entryType = values[3]
  const cells = values
    .map((value, columnIndex) => {
      if (kind === "header") return cellXml(value, rowNumber, columnIndex, 1)
      if (kind === "total") return cellXml(value, rowNumber, columnIndex, columnIndex === 0 ? 3 : 4)
      const isCount = entryType === "No" && columnIndex >= 4 && columnIndex <= 10
      const isCurrency = columnIndex === 1 || (columnIndex >= 4 && columnIndex <= 16)
      return cellXml(value, rowNumber, columnIndex, isCount ? 5 : isCurrency ? 2 : 6)
    })
    .join("")
  const height = kind === "header" ? 30 : kind === "total" ? 24 : 20
  return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`
}

export function buildWorkerWageWorkbook({
  headers,
  detailRows,
  totals,
  worksheetName = WORKER_WAGE_SHEET_NAME,
}: WorkerWageWorkbookInput) {
  const totalRow = createWageSheetTotalRow(totals)
  if (headers.length !== totalRow.length) {
    throw new Error(`Worker wage export header has ${headers.length} columns but the total row has ${totalRow.length}.`)
  }
  for (const [index, row] of detailRows.entries()) {
    if (row.length !== headers.length) {
      throw new Error(`Worker wage export detail row ${index + 1} has ${row.length} columns; expected ${headers.length}.`)
    }
  }

  const rows = [
    rowXml(headers, 1, "header"),
    ...detailRows.map((row, index) => rowXml(row, index + 2, "detail")),
    rowXml(totalRow, detailRows.length + 2, "total"),
  ].join("")
  const lastColumn = columnName(headers.length - 1)
  const lastRow = detailRows.length + 2
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="22" customWidth="1"/>
    <col min="2" max="3" width="12" customWidth="1"/>
    <col min="4" max="4" width="29" customWidth="1"/>
    <col min="5" max="11" width="14" customWidth="1"/>
    <col min="12" max="17" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows}</sheetData>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(worksheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₹&quot;#,##0;[Red]-&quot;₹&quot;#,##0"/></numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF020617"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD8DEE9"/></left><right style="thin"><color rgb="FFD8DEE9"/></right><top style="thin"><color rgb="FFD8DEE9"/></top><bottom style="thin"><color rgb="FFD8DEE9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

  return zipSync(
    {
      "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
      "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
      "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>MFMS</dc:creator><cp:lastModifiedBy>MFMS</cp:lastModifiedBy></cp:coreProperties>`),
      "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>MFMS</Application></Properties>`),
      "xl/workbook.xml": strToU8(workbookXml),
      "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
      "xl/styles.xml": strToU8(stylesXml),
      "xl/worksheets/sheet1.xml": strToU8(sheetXml),
    },
    { level: 6 },
  )
}
