import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { unzipSync, strFromU8 } from "fflate"
import { buildIntelligenceWorkbook, formatIntelligenceScalar } from "../lib/mfms-intelligence-excel.ts"

const columns = [
  { key: "rank", label: "Rank", format: "integer", category: "Core", required: false, default_selected: true },
  { key: "tree_no", label: "Tree No", format: "text", category: "Core", required: true, default_selected: true },
  { key: "total_nuts", label: "Total Nuts", format: "integer", category: "Harvest", required: false, default_selected: true },
  { key: "early_avg", label: "Early Avg", format: "decimal6", category: "Direction", required: false, default_selected: true },
  { key: "change_percentage", label: "Change %", format: "decimal6", category: "Direction", required: false, default_selected: true },
  { key: "plantation_date", label: "Plantation Date", format: "date", category: "Lifecycle", required: false, default_selected: false },
]
const rows = Array.from({ length: 430 }, (_, index) => ({
  rank: index + 1, tree_no: index === 0 ? "35.1" : String(1000 + index), total_nuts: 532,
  early_avg: index === 1 ? null : "10.500000", change_percentage: "376.190476", plantation_date: null,
}))
const context = {
  version: "MFMS_INTELLIGENCE_EXPORT_CONTEXT_V1", context_id: "a".repeat(64),
  question: "Which trees have improved over the latest 5 completed harvest cycles?", answer_type: "Improved Trees",
  filename_stem: "Improved_Trees", warehouse_refresh_id: "MFMS_REFRESH_TEST", harvest_data_as_of: "2026-08-04",
  lifecycle_as_of_date: "2026-08-23", selected_cycles: ["15", "16", "17", "18", "19"],
  displayed_row_count: 50, all_matching_row_count: 430, default_columns: columns.filter((column) => column.default_selected).map((column) => column.key),
  available_columns: columns, rows, verification: { precision_policy: "full precision then one decimal" },
}

const selected = context.default_columns
const originalContext = structuredClone(context)
const displayedBlob = buildIntelligenceWorkbook(context, selected, "displayed")
const allBlob = buildIntelligenceWorkbook(context, selected, "all")
const displayed = Buffer.from(await displayedBlob.arrayBuffer()).toString("utf8")
const allBytes = Buffer.from(await allBlob.arrayBuffer())
const all = allBytes.toString("utf8")

assert.ok(all.length > displayed.length)
assert.match(all, /sheet name="Results"/)
assert.match(all, /sheet name="Query &amp; Verification"/)
assert.match(all, /<autoFilter ref="A1:E431"/)
assert.match(displayed, /<autoFilter ref="A1:E51"/)
assert.match(all, /<t xml:space="preserve">35\.1<\/t>/)
assert.match(all, /s="2" t="n"><v>532<\/v>/)
assert.match(all, /s="3" t="n"><v>10\.5<\/v>/)
assert.match(all, /s="4" t="n"><v>3\.7619047/)
assert.match(all, /<t xml:space="preserve">—<\/t>/)
assert.doesNotMatch(all, /Plantation Date/)
assert.equal(formatIntelligenceScalar("10.500000", "decimal6", "early_avg"), "10.5")
assert.equal(formatIntelligenceScalar("50.000000", "decimal6", "recent_avg"), "50.0")
assert.equal(formatIntelligenceScalar("39.500000", "decimal6", "change"), "39.5")
assert.equal(formatIntelligenceScalar("376.190476", "decimal6", "change_percentage"), "376.2%")
assert.equal(formatIntelligenceScalar("115.094340", "decimal6", "change_percentage"), "115.1%")
assert.equal(formatIntelligenceScalar(532, "integer", "total_nuts"), "532")
assert.equal(formatIntelligenceScalar("35.1", "text", "tree_no"), "35.1")
assert.equal(formatIntelligenceScalar(null, "decimal6", "change_percentage"), "—")
const entries = unzipSync(allBytes)
assert.equal(Object.keys(entries).length, 7, "The workbook must be a readable seven-part XLSX archive")
const resultsXml = strFromU8(entries["xl/worksheets/sheet1.xml"])
const verificationXml = strFromU8(entries["xl/worksheets/sheet2.xml"])
assert.equal((resultsXml.match(/<row /g) ?? []).length, 431)
assert.match(verificationXml, /MFMS_REFRESH_TEST/)
assert.match(verificationXml, /2026-08-04/)
assert.match(verificationXml, new RegExp(context.context_id))
assert.deepEqual(context, originalContext, "Export must not mutate the response snapshot")
const subset = unzipSync(new Uint8Array(await buildIntelligenceWorkbook(context, ["tree_no", "plantation_date"], "displayed").arrayBuffer()))
const subsetXml = strFromU8(subset["xl/worksheets/sheet1.xml"])
assert.match(subsetXml, /Plantation Date/)
assert.doesNotMatch(subsetXml, /Total Nuts|Early Avg|Change %/)
assert.match(subsetXml, /<autoFilter ref="A1:B51"/)
const textContext = { ...context, rows: [{ ...rows[0], tree_no: '=HYPERLINK("https://example.invalid")<&' }], all_matching_row_count: 1, displayed_row_count: 1 }
const safeText = unzipSync(new Uint8Array(await buildIntelligenceWorkbook(textContext, ["tree_no"], "all").arrayBuffer()))
const safeTextXml = strFromU8(safeText["xl/worksheets/sheet1.xml"])
assert.match(safeTextXml, /t="inlineStr"/)
assert.match(safeTextXml, /&quot;https:\/\/example\.invalid&quot;/)
assert.match(safeTextXml, /&lt;&amp;/)
assert.doesNotMatch(safeTextXml, /<f[ >]/, "Response text must never become an Excel formula")
if (process.env.MFMS_XLSX_OUTPUT) await writeFile(process.env.MFMS_XLSX_OUTPUT, allBytes)
console.log("MFMS Intelligence Excel workbook tests passed")
