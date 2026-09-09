export type IntelligenceCell = string | number | null | string[]
export type IntelligenceColumn = {
  key: string
  label: string
  format: "integer" | "text" | "date" | "decimal6" | "flags"
  category: "Core" | "Harvest" | "Lifecycle" | "Direction" | "Quality" | "Period"
  required: boolean
  default_selected: boolean
}

export type IntelligenceExportContext = {
  version: "MFMS_INTELLIGENCE_EXPORT_CONTEXT_V1"
  context_id: string
  question: string
  answer_type: string
  filename_stem: string
  warehouse_refresh_id: string
  harvest_data_as_of: string | null
  lifecycle_as_of_date: string | null
  selected_cycles: string[]
  displayed_row_count: number
  all_matching_row_count: number
  default_columns: string[]
  available_columns: IntelligenceColumn[]
  rows: Array<Record<string, IntelligenceCell>>
  verification: Record<string, unknown>
}

export function formatIntelligenceScalar(value: string | number | null, format: IntelligenceColumn["format"], key: string) {
  if (value === null) return "—"
  if (format === "integer" && typeof value === "number") return value.toLocaleString("en-IN")
  if (format === "decimal6") {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return `${numeric.toFixed(1)}${key === "change_percentage" || key === "coverage_percent" ? "%" : ""}`
  }
  return String(value)
}

type RowScope = "displayed" | "all"
type ZipEntry = { name: string; content: string }
const encoder = new TextEncoder()

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;")
}

function columnName(index: number) {
  let result = ""
  for (let current = index; current > 0; current = Math.floor((current - 1) / 26)) result = String.fromCharCode(65 + ((current - 1) % 26)) + result
  return result
}

function textCell(column: number, row: number, value: string, style = 0) {
  return `<c r="${columnName(column)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function numberCell(column: number, row: number, value: number, style: number) {
  return `<c r="${columnName(column)}${row}" s="${style}" t="n"><v>${value}</v></c>`
}

function resultCell(column: number, row: number, definition: IntelligenceColumn, value: IntelligenceCell) {
  if (value === null) return textCell(column, row, "—")
  if (definition.format === "flags") return textCell(column, row, Array.isArray(value) && value.length ? value.join("; ") : "—", 5)
  if (definition.key === "tree_no") return textCell(column, row, String(value))
  if (definition.format === "integer" && typeof value === "number") return numberCell(column, row, value, 2)
  if (definition.key === "change_percentage" || definition.key === "coverage_percent") {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numberCell(column, row, numeric / 100, 4) : textCell(column, row, String(value))
  }
  if (definition.format === "decimal6") {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numberCell(column, row, numeric, 3) : textCell(column, row, String(value))
  }
  return textCell(column, row, String(value))
}

function resultsSheet(columns: IntelligenceColumn[], rows: Array<Record<string, IntelligenceCell>>) {
  const last = columnName(columns.length)
  const widths = columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(42, Math.max(11, column.label.length + 3))}" customWidth="1"/>`).join("")
  const header = columns.map((column, index) => textCell(index + 1, 1, column.label, 1)).join("")
  const data = rows.map((entry, index) => `<row r="${index + 2}">${columns.map((column, columnIndex) => resultCell(columnIndex + 1, index + 2, column, entry[column.key])).join("")}</row>`).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData><row r="1" ht="24" customHeight="1">${header}</row>${data}</sheetData><autoFilter ref="A1:${last}${Math.max(1, rows.length + 1)}"/></worksheet>`
}

function verificationRows(context: IntelligenceExportContext, scope: RowScope, selected: IntelligenceColumn[]) {
  const generatedIst = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date())
  const values: Array<[string, unknown]> = [
    ["Original question", context.question], ["Answer type", context.answer_type], ["Generated/exported timestamp IST", generatedIst],
    ["Harvest domain data as of", context.harvest_data_as_of], ["Warehouse refresh identity", context.warehouse_refresh_id],
    ["Lifecycle as of", context.lifecycle_as_of_date], ["Selected completed cycles", context.selected_cycles.join(", ")],
    ["Selected export row scope", scope === "all" ? `All matching rows (${context.all_matching_row_count})` : `Displayed rows (${context.displayed_row_count})`],
    ["Selected columns", selected.map((column) => column.label).join(", ")], ["Result snapshot identity", context.context_id],
  ]
  const labels: Record<string, string> = {
    period: "Period", period_start: "Period start", period_end: "Period end", denominator: "Denominator",
    complete_history_denominator: "Complete-history denominator", incomplete_history_exclusions: "Incomplete-history exclusions",
    lifecycle_filter: "Current Harvest Tree filter", direction_rule: "Direction rule", applied_filters: "Applied filters",
    quality_policy: "Quality policy", duplicate_tree_1112_policy: "Duplicate Tree 1112 policy", precision_policy: "Calculation precision policy",
  }
  for (const [key, value] of Object.entries(context.verification)) values.push([labels[key] ?? key, value])
  return values
}

function verificationSheet(context: IntelligenceExportContext, scope: RowScope, selected: IntelligenceColumn[]) {
  const rows = verificationRows(context, scope, selected)
  const content = rows.map(([label, raw], index) => {
    const value = raw === null || raw === undefined ? "—" : typeof raw === "string" ? raw : JSON.stringify(raw)
    return `<row r="${index + 1}">${textCell(1, index + 1, label, index === 0 ? 1 : 6)}${textCell(2, index + 1, value, 5)}</row>`
  }).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="100" customWidth="1"/></cols><sheetData>${content}</sheetData></worksheet>`
}

const crcTable = (() => { const table = new Uint32Array(256); for (let i = 0; i < 256; i += 1) { let value = i; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; table[i] = value >>> 0 } return table })()
function crc32(bytes: Uint8Array) { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0 }
function u16(target: Uint8Array, offset: number, value: number) { target[offset] = value & 255; target[offset + 1] = (value >>> 8) & 255 }
function u32(target: Uint8Array, offset: number, value: number) { target[offset] = value & 255; target[offset + 1] = (value >>> 8) & 255; target[offset + 2] = (value >>> 16) & 255; target[offset + 3] = (value >>> 24) & 255 }
function concat(parts: Uint8Array[]) { const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length } return output }
function zip(entries: ZipEntry[]) {
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.name); const content = encoder.encode(entry.content); const checksum = crc32(content)
    const head = new Uint8Array(30 + name.length); u32(head, 0, 0x04034b50); u16(head, 4, 20); u32(head, 14, checksum); u32(head, 18, content.length); u32(head, 22, content.length); u16(head, 26, name.length); head.set(name, 30); local.push(head, content)
    const directory = new Uint8Array(46 + name.length); u32(directory, 0, 0x02014b50); u16(directory, 4, 20); u16(directory, 6, 20); u32(directory, 16, checksum); u32(directory, 20, content.length); u32(directory, 24, content.length); u16(directory, 28, name.length); u32(directory, 42, offset); directory.set(name, 46); central.push(directory); offset += head.length + content.length
  }
  const directory = concat(central); const end = new Uint8Array(22); u32(end, 0, 0x06054b50); u16(end, 8, entries.length); u16(end, 10, entries.length); u32(end, 12, directory.length); u32(end, 16, offset)
  return concat([...local, directory, end])
}

export function buildIntelligenceWorkbook(context: IntelligenceExportContext, selectedKeys: string[], scope: RowScope) {
  const columns = selectedKeys.map((key) => context.available_columns.find((column) => column.key === key)).filter((column): column is IntelligenceColumn => Boolean(column))
  const rowCount = scope === "all" ? context.all_matching_row_count : context.displayed_row_count
  const rows = context.rows.slice(0, rowCount)
  const workbook = zip([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/><sheet name="Query &amp; Verification" sheetId="2" r:id="rId2"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF166534"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", content: resultsSheet(columns, rows) },
    { name: "xl/worksheets/sheet2.xml", content: verificationSheet(context, scope, columns) },
  ])
  return new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function intelligenceWorkbookFilename(context: IntelligenceExportContext) {
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value
      return parts
    }, {})
  const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
  return `MFMS_Intelligence_${context.filename_stem}_${date}.xlsx`
}
