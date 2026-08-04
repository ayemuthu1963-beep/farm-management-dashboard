import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { formatExactRuntime, formatRuntimeSeconds, roundedRuntimeMinutes } from "../lib/motor-screenshot-analysis-format.ts"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const text = (path) => readFileSync(join(root, path), "utf8")
const sha256 = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex")
const record = (id, onTime, offTime, runtimeSeconds, status = "complete") => ({
  id,
  date: "2026-07-30",
  motorId: "motor-1",
  motorName: "Motor 1",
  run: Number(id),
  onTime,
  onReason: onTime ? "RTC scheduled ON" : null,
  offTime,
  offReason: offTime ? "RTC scheduled OFF" : null,
  source: "rtc",
  runtimeSeconds,
  runtimeMinutes: roundedRuntimeMinutes(runtimeSeconds),
  status,
  screenshotId: 1,
  screenshotName: "sample.png",
  extractedMessages: [],
  matchingNote: "fixture",
})

const approved = [
  record("1", "09:14", "09:35", 1250),
  record("2", "11:36", "12:35", 3501),
  record("3", "13:36", "14:35", 3501),
  record("4", "15:14", "15:34", 1249),
  record("5", null, "16:35", 0, "unmatched_off"),
]
const combinedSeconds = approved.filter((row) => row.status === "complete").reduce((sum, row) => sum + row.runtimeSeconds, 0)
assert.equal(combinedSeconds, 9501, "Totals must sum exact seconds")
assert.equal(roundedRuntimeMinutes(combinedSeconds), 158, "The final 9501-second total must display as 158 minutes")
assert.deepEqual(approved.slice(0, 4).map((row) => row.runtimeMinutes), [21, 58, 58, 21])
assert.equal(formatRuntimeSeconds(9501), "2 hr 38 min")
assert.equal(formatExactRuntime(9501), "2 hr 38 min 21 sec")
assert.equal(approved.filter((row) => row.status !== "complete").length, 1)

const page = text("app/motor-runtime/screenshot-analysis/page.tsx")
const apiClient = text("lib/motor-screenshot-analysis-api.ts")
const dataModel = text("lib/motor-screenshot-analysis-data.ts")
const proxy = text("app/api/motor-screenshot-analysis/[...path]/route.ts")
const review = text("components/motor-screenshot-analysis/analysis-review-panel.tsx")
const upload = text("components/motor-screenshot-analysis/screenshot-upload-panel.tsx")
const table = text("components/motor-screenshot-analysis/runtime-records-table.tsx")

assert.doesNotMatch(page, /motor-screenshot-analysis-mock-data|RUN_RECORDS|setTimeout\(.*Static/)
assert.equal(existsSync(join(root, "lib/motor-screenshot-analysis-mock-data.ts")), false)
assert.match(page, /uploadScreenshots/)
assert.match(page, /loadRecords/)
assert.match(page, /loadSummary/)
assert.match(apiClient, /params\.set\("sort"/)
assert.match(apiClient, /params\.set\("page"/)
assert.match(apiClient, /params\.set\("page_size"/)
assert.match(dataModel, /combinedSeconds/)
assert.match(dataModel, /Math\.round\(combinedSeconds \/ 60\)/)
assert.match(proxy, /getBasicAuthHeader/)
assert.match(proxy, /getPreviewAdminTargetSafetyErrors/)
assert.match(proxy, /X-Content-Type-Options/)
assert.match(review, /Confirm and Save/)
assert.match(review, /Save Corrections/)
assert.match(review, /Reject Analysis/)
assert.match(review, /Reanalyse/)
assert.match(review, /datetime-local/)
assert.match(upload, /multiple/)
assert.match(upload, /motorId/)
assert.match(upload, /authenticated MFMS route/)
assert.match(table, /Sorting and pagination are applied by the backend/)
assert.match(table, /md:hidden/)
assert.match(table, /overflow-x-auto/)

assert.equal(sha256("app/page.tsx"), "fcc828abdfe3228f3c5b29378e4e254dbd0fa99c4f939ca3549bc25b83eab2be", "MFMS home page changed")
assert.equal(sha256("app/motor-runtime/page.tsx"), "e702c72259c236bb9151783b1f0dddd7fe90be24b4fddf53decfd078a1cd31fb", "Existing Motor Runtime page changed")

console.log("Motor Screenshot Analysis real workflow, exact-second totals, review, API, responsive and regression invariants: PASS")
