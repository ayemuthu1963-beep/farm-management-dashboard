import type { TreeWiseQueryCycle, TreeWiseQueryRow } from "@/lib/coconut-harvest-api"

export type TreeWiseMeasure = "bunches" | "nuts" | "sale"
export type TreeWiseMetadata = "plot" | "classification" | "reason"
export type TreeWiseTotal = "totalBunches" | "totalNuts" | "totalSale" | "totalMissed"

export interface TreeWiseWorkbookInput {
  rows: TreeWiseQueryRow[]
  cycles: TreeWiseQueryCycle[]
  measures: TreeWiseMeasure[]
  metadata: TreeWiseMetadata[]
  totals: TreeWiseTotal[]
}

interface ZipEntry {
  name: string
  content: string
}

interface ExportColumn {
  group: string
  header: string
  width: number
  value: (row: TreeWiseQueryRow) => string | number
}

const encoder = new TextEncoder()

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;")
}

function columnName(index: number): string {
  let result = ""
  let current = index
  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

function inlineStringCell(column: number, row: number, value: string, style = 0): string {
  return `<c r="${columnName(column)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function numericCell(column: number, row: number, value: number, style = 0): string {
  return `<c r="${columnName(column)}${row}" s="${style}" t="n"><v>${Number.isFinite(value) ? value : 0}</v></c>`
}

function formatCycleDate(value: string): string {
  if (!value) return "Open"
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}/${month}/${year}` : value
}

const measureLabel: Record<TreeWiseMeasure, string> = {
  bunches: "Bun",
  nuts: "Nuts",
  sale: "Sale",
}

const metadataLabel: Record<TreeWiseMetadata, string> = {
  plot: "Plot",
  classification: "Class",
  reason: "Reason",
}

const totalLabel: Record<TreeWiseTotal, string> = {
  totalBunches: "Total Bun",
  totalNuts: "Total Nuts",
  totalSale: "Total Sale",
  totalMissed: "Total Missed",
}

function exportColumns(input: TreeWiseWorkbookInput): ExportColumn[] {
  const columns: ExportColumn[] = [
    { group: "Tree", header: "Tree No.", width: 13, value: (row) => row.treeNo },
  ]

  for (const field of input.metadata) {
    columns.push({
      group: metadataLabel[field],
      header: metadataLabel[field],
      width: field === "reason" ? 34 : 20,
      value: (row) => row[field],
    })
  }

  for (const cycle of input.cycles) {
    for (const measure of input.measures) {
      columns.push({
        group: `C${cycle.cycle}`,
        header: `C${cycle.cycle} ${measureLabel[measure]}`,
        width: measure === "sale" ? 16 : 12,
        value: (row) => row.cycles[cycle.cycle]?.[measure] ?? 0,
      })
    }
  }

  for (const total of input.totals) {
    columns.push({
      group: "Totals",
      header: totalLabel[total],
      width: 16,
      value: (row) => row[total],
    })
  }

  return columns
}

function worksheetXml(input: TreeWiseWorkbookInput): string {
  const columns = exportColumns(input)
  const lastColumn = columnName(columns.length)
  const cycleLegend = input.cycles
    .map((cycle) => `C${cycle.cycle}: ${formatCycleDate(cycle.startDate)}–${formatCycleDate(cycle.endDate)}`)
    .join("  |  ")

  const mergeRefs: string[] = [`A1:${lastColumn}1`, `A2:${lastColumn}2`]
  let groupStart = 1
  for (let index = 1; index <= columns.length; index += 1) {
    const currentGroup = columns[index - 1]?.group
    const nextGroup = columns[index]?.group
    if (currentGroup !== nextGroup) {
      const start = columnName(groupStart)
      const end = columnName(index)
      if (groupStart === index) mergeRefs.push(`${start}4:${start}5`)
      else mergeRefs.push(`${start}4:${end}4`)
      groupStart = index + 1
    }
  }

  const dataRows = input.rows.map((entry, index) => {
    const rowNumber = index + 6
    const cells = columns.map((column, columnIndex) => {
      const value = column.value(entry)
      const isSale = column.header.includes("Sale")
      return typeof value === "number"
        ? numericCell(columnIndex + 1, rowNumber, value, isSale ? 4 : 0)
        : inlineStringCell(columnIndex + 1, rowNumber, value)
    })
    return `<row r="${rowNumber}">${cells.join("")}</row>`
  }).join("")

  const widths = columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`).join("")
  const groupHeaders = columns.map((column, index) => {
    const previous = columns[index - 1]
    return !previous || previous.group !== column.group ? inlineStringCell(index + 1, 4, column.group, 2) : ""
  }).join("")
  const leafHeaders = columns.map((column, index) => inlineStringCell(index + 1, 5, column.header, 3)).join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="5" topLeftCell="B6" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
  <cols>${widths}</cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">${inlineStringCell(1, 1, "Muthu Farms — Tree-wise Table Query", 1)}</row>
    <row r="2">${inlineStringCell(1, 2, cycleLegend || "No harvest cycles matched the selected filters.", 5)}</row>
    <row r="4">${groupHeaders}</row>
    <row r="5">${leafHeaders}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A5:${lastColumn}${Math.max(5, input.rows.length + 5)}"/>
  <mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`
}

const crc32Table = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of bytes) value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff
  target[offset + 1] = (value >>> 8) & 0xff
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff
  target[offset + 1] = (value >>> 8) & 0xff
  target[offset + 2] = (value >>> 16) & 0xff
  target[offset + 3] = (value >>> 24) & 0xff
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function zip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const content = encoder.encode(entry.content)
    const checksum = crc32(content)
    const localHeader = new Uint8Array(30 + name.length)
    writeUint32(localHeader, 0, 0x04034b50)
    writeUint16(localHeader, 4, 20)
    writeUint32(localHeader, 14, checksum)
    writeUint32(localHeader, 18, content.length)
    writeUint32(localHeader, 22, content.length)
    writeUint16(localHeader, 26, name.length)
    localHeader.set(name, 30)
    localParts.push(localHeader, content)

    const centralHeader = new Uint8Array(46 + name.length)
    writeUint32(centralHeader, 0, 0x02014b50)
    writeUint16(centralHeader, 4, 20)
    writeUint16(centralHeader, 6, 20)
    writeUint32(centralHeader, 16, checksum)
    writeUint32(centralHeader, 20, content.length)
    writeUint32(centralHeader, 24, content.length)
    writeUint16(centralHeader, 28, name.length)
    writeUint32(centralHeader, 42, localOffset)
    centralHeader.set(name, 46)
    centralParts.push(centralHeader)
    localOffset += localHeader.length + content.length
  }

  const centralDirectory = concat(centralParts)
  const endOfDirectory = new Uint8Array(22)
  writeUint32(endOfDirectory, 0, 0x06054b50)
  writeUint16(endOfDirectory, 8, entries.length)
  writeUint16(endOfDirectory, 10, entries.length)
  writeUint32(endOfDirectory, 12, centralDirectory.length)
  writeUint32(endOfDirectory, 16, localOffset)
  return concat([...localParts, centralDirectory, endOfDirectory])
}

export function buildTreeWiseQueryWorkbook(input: TreeWiseWorkbookInput): Blob {
  const workbook = zip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tree-wise Query" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="Rs. #,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF166534"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF166534"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(input) },
  ])

  return new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function treeWiseWorkbookFilename(): string {
  return `MFMS_Tree_Wise_Query_${new Date().toISOString().slice(0, 10)}.xlsx`
}
