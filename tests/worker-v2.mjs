import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { strFromU8, unzipSync } from "fflate"
import { buildWorkerV2Workbook } from "../lib/worker-v2-excel.ts"

const weekStart = "2026-08-29"
const row = (opening, repayment, advance, closing, displayName, accountCode, applicable = true) => ({
  week_start: weekStart,
  week_end: "2026-09-04",
  week_status: "OPEN",
  account_code: accountCode,
  display_name: displayName,
  account_type: accountCode === "21" || accountCode.startsWith("WG-") ? "GROUP" : "FARM",
  financial_applicable: applicable,
  opening_balance: opening,
  repayment_total: repayment,
  advance_total: advance,
  closing_balance: closing,
  own_earnings: "0.00",
  has_repayment: repayment !== "0.00" && repayment !== null,
  has_advance: advance !== "0.00" && advance !== null,
})
const rows = [
  row("-16980.00", "0.00", "0.00", "-16980.00", "Kuppan", "1"),
  row("-2834.00", "0.00", "4050.00", "-6884.00", "Arunan", "2"),
  row("-18.00", "0.00", "0.00", "-18.00", "Sivan", "3"),
  row("0.00", "0.00", "0.00", "0.00", "Lokesh", "4"),
  row("-23050.00", "0.00", "500.00", "-23550.00", "Tiruma", "5"),
  row(null, null, null, null, "Rani", "6", false),
  row("-6950.00", "0.00", "0.00", "-6950.00", "Vijaya", "7"),
  row("-13000.00", "0.00", "0.00", "-13000.00", "Mary", "8"),
  row("-3000.00", "0.00", "0.00", "-3000.00", "Raja Mani", "9"),
  row(null, null, null, null, "Chitra", "10", false),
  row("1920.00", "0.00", "0.00", "1920.00", "Outside Ladies", "21"),
  row("0.00", "0.00", "0.00", "0.00", "Mary-Labour", "WG-CUSTOM-7D02BF6C"),
]
const response = {
  source: "V2_FRESH_START",
  start_week: weekStart,
  historical_records_imported: 0,
  initialization: {
    initialized: true,
    initialization_id: "97b35f03-9e60-4a39-8a7f-4168a5ad15c6",
    week_start: weekStart,
    opening_total: "-63912.00",
    initialized_at: "2026-09-04T00:00:00+05:30",
    initialized_by: "owner",
  },
  duplicate_count: 0,
  missing_opening_count: 0,
  unresolved_count: 0,
  unresolved_balance_records: 0,
  canonical_sha256: "a".repeat(64),
  passed: true,
  totals: [{
    week_start: weekStart,
    opening_balance: "-63912.00",
    repayment_total: "0.00",
    advance_total: "4550.00",
    closing_balance: "-68462.00",
    own_earnings: "0.00",
  }],
  rows,
  attendance_entries: [],
}

const workbook = buildWorkerV2Workbook(response, weekStart)
const files = unzipSync(workbook)
const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"])
assert.doesNotMatch(worksheet, /<f>/, "V2 Excel must not reconstruct balances with formulas")
assert.match(worksheet, /<c r="E14" s="4"><v>-63912<\/v><\/c>/, "Excel total must copy API opening")
assert.match(worksheet, /<c r="G14" s="4"><v>4550<\/v><\/c>/, "Excel total must copy API advance")
assert.match(worksheet, /<c r="H14" s="4"><v>-68462<\/v><\/c>/, "Excel total must copy API present balance")
assert.match(worksheet, /Fresh-start initialization/)
assert.match(worksheet, /<c r="E15" s="4"><v>-63912<\/v><\/c>/, "Excel must copy initialized API opening")
for (const rowNumber of [7, 11]) {
  for (const column of ["E", "F", "G", "H"]) {
    assert.doesNotMatch(worksheet, new RegExp(`<c r="${column}${rowNumber}"`), "dependent financial cells must remain blank")
  }
}

const component = await readFile(new URL("../components/worker-management/worker-v2-comparison.tsx", import.meta.url), "utf8")
const api = await readFile(new URL("../lib/worker-v2-api.ts", import.meta.url), "utf8")
const normalPage = await readFile(new URL("../app/worker-management/page.tsx", import.meta.url), "utf8")
const v2Page = await readFile(new URL("../app/worker-management/v2-comparison/page.tsx", import.meta.url), "utf8")
const previewDockerfile = await readFile(new URL("../Dockerfile.preview", import.meta.url), "utf8")
const previewDeploy = await readFile(new URL("../scripts/preview-server-deploy.sh", import.meta.url), "utf8")

assert.match(api, /method: "GET"/)
assert.match(api, /method: "POST"/)
assert.match(api, /method: "PUT"/)
assert.match(component, /Initialize approved opening once/)
assert.match(component, /Worker V2 fresh start/)
assert.match(component, /Financial fields intentionally blank/)
assert.match(component, /Excel from API/)
assert.match(component, /API-provided totals/)
assert.match(component, /closeWorkerV2Week/)
assert.match(component, /existingAttendance\?\.row_version/)
assert.match(component, /attendance\.dailyWage === "" \? 0/)
assert.doesNotMatch(component, /current_signed_balance|opening\s*\+\s*repayment|closing\s*=/i)
assert.match(normalPage, /WeeklyWageTablePreview/, "the normal Worker page must remain V1")
assert.doesNotMatch(normalPage, /WorkerV2Comparison/, "V2 must not replace the normal Worker page")
assert.match(v2Page, /NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED === "true"/)
assert.match(previewDockerfile, /ARG NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED=false/)
assert.match(previewDeploy, /NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED=true/)
assert.match(previewDeploy, /matched_backend_commit/)

console.log("worker-v2: fresh-start owner entry and API-authoritative Excel checks passed")
