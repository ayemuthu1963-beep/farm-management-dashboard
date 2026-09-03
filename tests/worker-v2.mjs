import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { strFromU8, unzipSync } from "fflate"
import { buildWorkerV2Workbook } from "../lib/worker-v2-excel.ts"

const weekStart = "2026-08-29"
const money = (opening, repayment, advance, closing, displayName, accountCode, applicable = true) => ({
  week_start: weekStart,
  account_code: accountCode,
  display_name: displayName,
  financial_applicable: applicable,
  opening_balance: opening,
  repayment_total: repayment,
  advance_total: advance,
  closing_balance: closing,
})
const financialRows = [
  money("-16980.00", "0.00", "0.00", "-16980.00", "Kuppan", "1"),
  money("-2834.00", "0.00", "4050.00", "-6884.00", "Arunan", "2"),
  money("-18.00", "0.00", "0.00", "-18.00", "Sivan", "3"),
  money("0.00", "0.00", "0.00", "0.00", "Lokesh", "4"),
  money("-23050.00", "0.00", "500.00", "-23550.00", "Tiruma", "5"),
  money(null, null, null, null, "Rani", "6", false),
  money("-6950.00", "0.00", "0.00", "-6950.00", "Vijaya", "7"),
  money("-13000.00", "0.00", "0.00", "-13000.00", "Mary", "8"),
  money("-3000.00", "0.00", "0.00", "-3000.00", "Raja Mani", "9"),
  money(null, null, null, null, "Chitra", "10", false),
  money("1920.00", "0.00", "0.00", "1920.00", "Outside Ladies", "21"),
  money("0.00", "0.00", "0.00", "0.00", "Mary-Labour", "WG-CUSTOM-7D02BF6C"),
]
const rows = financialRows.map((row) => ({
  week_start: weekStart,
  account_code: row.account_code,
  v1_classified_fixture: row,
  v2: { ...row },
  matches: true,
}))
const apiTotal = {
  opening_balance: "-63912.00",
  repayment_total: "0.00",
  advance_total: "4550.00",
  closing_balance: "-68462.00",
}
const response = {
  source: "SYNTHETIC_AUTHORISED_VALUES",
  classification_model: "PRODUCTION_DISTRIBUTION_PATTERN_STRICT_CONTINUITY",
  migration_boundary: {
    boundary_date: weekStart,
    mode: "STRICT_PREVIOUS_CLOSING",
    legacy_history_through: "2026-08-28",
    strict_opening_total: "-63912.00",
    defective_v1_display_total: "-71132.00",
    classified_variance: "-7220.00",
    variance_explained: true,
  },
  v1_row_count: 48,
  v2_classified_event_count: 33,
  unresolved_count: 0,
  unresolved_balance_records: 0,
  duplicate_count: 0,
  missing_count: 0,
  extra_count: 0,
  balance_differences: 0,
  canonical_sha256: "a".repeat(64),
  passed: true,
  totals: [{
    week_start: weekStart,
    v1_classified_fixture: apiTotal,
    v2: { ...apiTotal },
    matches: true,
  }],
  rows,
}

const workbook = buildWorkerV2Workbook(response, weekStart)
const files = unzipSync(workbook)
const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"])
assert.doesNotMatch(worksheet, /<f>/, "V2 Excel must not reconstruct balances with formulas")
assert.match(worksheet, /<c r="K14" s="4"><v>4550<\/v><\/c>/, "V2 Excel total must copy the API advance total")
assert.match(worksheet, /<c r="L14" s="4"><v>-68462<\/v><\/c>/, "V2 Excel total must copy the API closing total")
assert.match(worksheet, /<c r="A15" s="3" t="inlineStr"><is><t xml:space="preserve">Migration boundary<\/t><\/is><\/c>/)
assert.match(worksheet, /<c r="E15" s="4"><v>-63912<\/v><\/c>/, "Excel must copy the API strict opening")
assert.match(worksheet, /<c r="G15" s="4"><v>-7220<\/v><\/c>/, "Excel must expose the classified legacy variance")
for (const rowNumber of [7, 11]) {
  for (const column of ["E", "F", "G", "H", "I", "J", "K", "L"]) {
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
assert.doesNotMatch(api, /method: "(?:POST|PUT|PATCH|DELETE)"/)
assert.doesNotMatch(component, /current_signed_balance|opening\s*\+\s*repayment|closing\s*=/i)
assert.doesNotMatch(component, />\s*Save\s*</)
assert.match(component, /API-provided totals/)
assert.match(component, /Excel from API values/)
assert.match(component, /Strict previous-closing opening/)
assert.match(component, /frozen legacy evidence/)
assert.match(component, /response\.totals\.some\(\(item\) => item\.week_start === current\)/)
assert.match(component, /disabled=\{!data \|\| !selectedWeek \|\| !total\}/)
assert.match(normalPage, /WeeklyWageTablePreview/, "the normal Worker page must remain V1")
assert.doesNotMatch(normalPage, /WorkerV2Comparison/, "V2 must not replace the normal Worker page")
assert.match(v2Page, /NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED === "true"/)
assert.match(previewDockerfile, /ARG NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED=false/)
assert.match(previewDeploy, /NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED=true/)
assert.match(previewDeploy, /image_revision_for_container "\$backend_container"/)
assert.match(previewDeploy, /matched_backend_commit/)

console.log("worker-v2: strict-continuity comparison and API-authoritative Excel checks passed")
