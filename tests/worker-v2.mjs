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
const rows = [
  money("-3834.00", "0.00", "4050.00", "-7884.00", "Arunan", "2"),
  money("-24050.00", "0.00", "500.00", "-24550.00", "Tiruma", "5"),
  money(null, null, null, null, "Rani", "6", false),
].map((row) => ({
  week_start: weekStart,
  account_code: row.account_code,
  v1_classified_fixture: row,
  v2: { ...row },
  matches: true,
}))
const apiTotal = {
  opening_balance: "-27884.00",
  repayment_total: "0.00",
  advance_total: "4550.00",
  closing_balance: "-32434.00",
}
const response = {
  source: "SYNTHETIC_AUTHORISED_VALUES",
  v1_row_count: 48,
  v2_classified_event_count: 29,
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
assert.match(worksheet, /<c r="K5" s="4"><v>4550<\/v><\/c>/, "V2 Excel total must copy the API advance total")
assert.match(worksheet, /<c r="L5" s="4"><v>-32434<\/v><\/c>/, "V2 Excel total must copy the API closing total")
for (const column of ["E", "F", "G", "H", "I", "J", "K", "L"]) {
  assert.doesNotMatch(worksheet, new RegExp(`<c r="${column}4"`), "Rani financial cells must remain blank")
}

const component = await readFile(new URL("../components/worker-management/worker-v2-comparison.tsx", import.meta.url), "utf8")
const api = await readFile(new URL("../lib/worker-v2-api.ts", import.meta.url), "utf8")
const normalPage = await readFile(new URL("../app/worker-management/page.tsx", import.meta.url), "utf8")
const v2Page = await readFile(new URL("../app/worker-management/v2-comparison/page.tsx", import.meta.url), "utf8")
const previewDockerfile = await readFile(new URL("../Dockerfile.preview", import.meta.url), "utf8")

assert.match(api, /method: "GET"/)
assert.doesNotMatch(api, /method: "(?:POST|PUT|PATCH|DELETE)"/)
assert.doesNotMatch(component, /current_signed_balance|opening\s*\+\s*repayment|closing\s*=/i)
assert.doesNotMatch(component, />\s*Save\s*</)
assert.match(component, /API-provided totals/)
assert.match(component, /Excel from API values/)
assert.match(normalPage, /WeeklyWageTablePreview/, "the normal Worker page must remain V1")
assert.doesNotMatch(normalPage, /WorkerV2Comparison/, "V2 must not replace the normal Worker page")
assert.match(v2Page, /NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED === "true"/)
assert.match(previewDockerfile, /ARG NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED=false/)

console.log("worker-v2: read-only comparison and API-authoritative Excel checks passed")
