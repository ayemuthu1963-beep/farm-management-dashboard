export interface BeetleDailyExcelRow {
  date: string
  plot1Rhinoceros: number
  plot1RedPalmWeevil: number
  plot2Rhinoceros: number
  plot2RedPalmWeevil: number
}

interface DailyBeetleWorkbookInput {
  rows: BeetleDailyExcelRow[]
  startDate: string | null
}

interface ZipEntry {
  name: string
  content: string
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

function inlineStringCell(column: number, row: number, value: string): string {
  return `<c r="${columnName(column)}${row}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function numericCell(column: number, row: number, value: number): string {
  return `<c r="${columnName(column)}${row}" t="n"><v>${Number.isFinite(value) ? value : 0}</v></c>`
}

function worksheetXml({ rows, startDate }: DailyBeetleWorkbookInput): string {
  const startLabel = startDate ?? "Not available"
  const dataRows = rows.length > 0
    ? rows.map((entry, index) => {
      const row = index + 6
      return `<row r="${row}">${[
        inlineStringCell(1, row, entry.date),
        numericCell(2, row, entry.plot1Rhinoceros),
        numericCell(3, row, entry.plot1RedPalmWeevil),
        numericCell(4, row, entry.plot2Rhinoceros),
        numericCell(5, row, entry.plot2RedPalmWeevil),
      ].join("")}</row>`
    }).join("")
    : `<row r="6">${inlineStringCell(1, 6, "No inspection records are available for this cumulative period.")}</row>`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="5" width="27" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1">${inlineStringCell(1, 1, "Daily Beetle Count")}</row>
    <row r="2">${inlineStringCell(1, 2, `Cumulative period start date: ${startLabel}`)}</row>
    <row r="4">${[
      inlineStringCell(1, 4, "Date"),
      inlineStringCell(2, 4, "Plot 1"),
      inlineStringCell(4, 4, "Plot 2"),
    ].join("")}</row>
    <row r="5">${[
      inlineStringCell(2, 5, "Rhinoceros Beetle Count"),
      inlineStringCell(3, 5, "Red Palm Weevil Count"),
      inlineStringCell(4, 5, "Rhinoceros Beetle Count"),
      inlineStringCell(5, 5, "Red Palm Weevil Count"),
    ].join("")}</row>
    ${dataRows}
  </sheetData>
  <mergeCells count="3">
    <mergeCell ref="A4:A5"/>
    <mergeCell ref="B4:C4"/>
    <mergeCell ref="D4:E4"/>
  </mergeCells>
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

/** Build a standards-compliant, uncompressed XLSX archive without adding a browser dependency. */
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
    writeUint16(localHeader, 6, 0)
    writeUint16(localHeader, 8, 0)
    writeUint16(localHeader, 10, 0)
    writeUint16(localHeader, 12, 0)
    writeUint32(localHeader, 14, checksum)
    writeUint32(localHeader, 18, content.length)
    writeUint32(localHeader, 22, content.length)
    writeUint16(localHeader, 26, name.length)
    writeUint16(localHeader, 28, 0)
    localHeader.set(name, 30)
    localParts.push(localHeader, content)

    const centralHeader = new Uint8Array(46 + name.length)
    writeUint32(centralHeader, 0, 0x02014b50)
    writeUint16(centralHeader, 4, 20)
    writeUint16(centralHeader, 6, 20)
    writeUint16(centralHeader, 8, 0)
    writeUint16(centralHeader, 10, 0)
    writeUint16(centralHeader, 12, 0)
    writeUint16(centralHeader, 14, 0)
    writeUint32(centralHeader, 16, checksum)
    writeUint32(centralHeader, 20, content.length)
    writeUint32(centralHeader, 24, content.length)
    writeUint16(centralHeader, 28, name.length)
    writeUint16(centralHeader, 30, 0)
    writeUint16(centralHeader, 32, 0)
    writeUint16(centralHeader, 34, 0)
    writeUint16(centralHeader, 36, 0)
    writeUint32(centralHeader, 38, 0)
    writeUint32(centralHeader, 42, localOffset)
    centralHeader.set(name, 46)
    centralParts.push(centralHeader)

    localOffset += localHeader.length + content.length
  }

  const centralDirectory = concat(centralParts)
  const endOfDirectory = new Uint8Array(22)
  writeUint32(endOfDirectory, 0, 0x06054b50)
  writeUint16(endOfDirectory, 4, 0)
  writeUint16(endOfDirectory, 6, 0)
  writeUint16(endOfDirectory, 8, entries.length)
  writeUint16(endOfDirectory, 10, entries.length)
  writeUint32(endOfDirectory, 12, centralDirectory.length)
  writeUint32(endOfDirectory, 16, localOffset)
  writeUint16(endOfDirectory, 20, 0)

  return concat([...localParts, centralDirectory, endOfDirectory])
}

export function buildDailyBeetleCountWorkbook(input: DailyBeetleWorkbookInput): Blob {
  const workbook = zip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Daily Beetle Count" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(input) },
  ])

  return new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function dailyBeetleWorkbookFilename(startDate: string | null): string {
  const safeStartDate = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : "current-period"
  return `daily-beetle-count-${safeStartDate}.xlsx`
}
