import { strToU8, zipSync } from "fflate"
import type { BeetleTrapMatrix, BeetleTrapType } from "@/lib/beetle-trap-matrix"

const WORKBOOK_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function columnName(index: number): string {
  let name = ""
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(((value - 1) % 26) + 65) + name
  }
  return name
}

function inlineStringCell(columnIndex: number, rowNumber: number, value: string, styleId: number): string {
  const reference = `${columnName(columnIndex)}${rowNumber}`
  return `<c r="${reference}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function numericCell(columnIndex: number, rowNumber: number, value: number, styleId: number): string {
  if (!Number.isFinite(value) || value === 0) return ""
  return `<c r="${columnName(columnIndex)}${rowNumber}" s="${styleId}" t="n"><v>${value}</v></c>`
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function trapStyle(trapType: BeetleTrapType, row: "header" | "total" | "detail"): number {
  if (trapType === "Red Palm Weevil") {
    return row === "header" ? 3 : row === "total" ? 6 : 9
  }
  if (trapType === "Rhinoceros Beetle") {
    return row === "header" ? 2 : row === "total" ? 5 : 8
  }
  return row === "header" ? 4 : row === "total" ? 7 : 10
}

function worksheetXml(matrix: BeetleTrapMatrix): string {
  const lastColumn = columnName(matrix.traps.length)
  const lastRow = Math.max(4, matrix.rows.length + 4)
  const trapHeaders = matrix.traps
    .map((trap, index) => inlineStringCell(index + 1, 3, trap.trapNo, trapStyle(trap.trapType, "header")))
    .join("")
  const totals = matrix.traps
    .map((trap, index) => numericCell(index + 1, 4, trap.total, trapStyle(trap.trapType, "total")))
    .join("")
  const dateRows = matrix.rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 5
      const counts = row.counts
        .map((count, trapIndex) => count === null
          ? ""
          : numericCell(trapIndex + 1, rowNumber, count, trapStyle(matrix.traps[trapIndex].trapType, "detail")))
        .join("")
      return `<row r="${rowNumber}">${inlineStringCell(0, rowNumber, formatDisplayDate(row.sourceDate), 11)}${counts}</row>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="4" topLeftCell="B5" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="${matrix.traps.length + 1}" width="11" customWidth="1"/></cols>
  <sheetData>
    <row r="1" ht="26" customHeight="1">${inlineStringCell(0, 1, "Beetle in Traps", 1)}</row>
    <row r="2">${inlineStringCell(0, 2, "Blank cells indicate zero or no recorded count.", 12)}</row>
    <row r="3" ht="24" customHeight="1">${inlineStringCell(0, 3, "Trap No.", 2)}${trapHeaders}</row>
    <row r="4" ht="24" customHeight="1">${inlineStringCell(0, 4, "Total", 5)}${totals}</row>
    ${dateRows}
  </sheetData>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF166534"/><sz val="16"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF000000"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFB91C1C"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF6B7280"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><color rgb="FF000000"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><color rgb="FFB91C1C"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F3E9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFC9DCCB"/></left><right style="thin"><color rgb="FFC9DCCB"/></right><top style="thin"><color rgb="FFC9DCCB"/></top><bottom style="thin"><color rgb="FFC9DCCB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="13">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export function buildBeetleTrapMatrixWorkbook(matrix: BeetleTrapMatrix): Blob {
  if (matrix.traps.length === 0) throw new Error("At least one Beetle Trap is required for export.")

  const workbook = zipSync(
    {
      "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
      "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Beetle in Traps" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
      "xl/styles.xml": strToU8(stylesXml),
      "xl/worksheets/sheet1.xml": strToU8(worksheetXml(matrix)),
    },
    { level: 6 },
  )

  return new Blob([workbook], { type: WORKBOOK_MIME_TYPE })
}

export function beetleTrapMatrixWorkbookFilename(): string {
  return `beetle-in-traps-${new Date().toISOString().slice(0, 10)}.xlsx`
}
