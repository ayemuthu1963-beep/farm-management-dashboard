import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { formatExactRuntime, formatRuntimeHHMM, formatRuntimeSeconds, roundedRuntimeMinutes } from "../lib/motor-screenshot-analysis-format.ts"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const text = (path) => readFileSync(join(root, path), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n"))
  .digest("hex")
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
assert.equal(formatRuntimeHHMM(9501), "02:38")
assert.equal(approved.filter((row) => row.status !== "complete").length, 1)

const apiClient = text("lib/motor-screenshot-analysis-api.ts")
const dataModel = text("lib/motor-screenshot-analysis-data.ts")
const proxy = text("app/api/motor-screenshot-analysis/[...path]/route.ts")
const review = text("components/motor-screenshot-analysis/analysis-review-panel.tsx")
const types = text("lib/motor-screenshot-analysis-types.ts")
const upload = text("components/motor-screenshot-analysis/screenshot-upload-panel.tsx")
const sourceInput = text("components/motor-screenshot-analysis/source-input-panel.tsx")
const config = text("lib/motor-screenshot-analysis-config.ts")
const table = text("components/motor-screenshot-analysis/runtime-records-table.tsx")

assert.equal(existsSync(join(root, "app/motor-runtime/screenshot-analysis/page.tsx")), false)
assert.equal(existsSync(join(root, "lib/motor-screenshot-analysis-mock-data.ts")), false)
assert.match(apiClient, /params\.set\("sort"/)
assert.match(apiClient, /params\.set\("page"/)
assert.match(apiClient, /params\.set\("page_size"/)
assert.match(dataModel, /combinedSeconds/)
assert.match(dataModel, /Math\.round\(combinedSeconds \/ 60\)/)
assert.match(proxy, /getBasicAuthHeader/)
assert.match(proxy, /getAdminTargetSafetyErrors/)
assert.match(proxy, /getAuthenticatedUserAssertionHeaders/)
assert.match(proxy, /X-Content-Type-Options/)
assert.match(review, /Confirm and Save/)
assert.match(review, /Save Corrections/)
assert.match(review, /Reject Analysis/)
assert.match(review, /Reanalyse/)
assert.match(review, /datetime-local/)
assert.match(review, /Cropped source preview for tile/)
assert.match(review, /Original date text/)
assert.match(review, /Original time text/)
assert.match(review, /Parsed first line/)
assert.match(review, /OCR audit/)
assert.match(review, /parser_warning/)
assert.match(review, /!message\.event_timestamp/)
assert.match(review, /Provisional pairing preview/)
assert.match(review, /do not affect confirmed database totals/)
assert.match(review, /formatExactRuntime\(provisionalSeconds\)/)
assert.match(review, /Owner confirmation required/)
assert.match(review, /Imported source text/)
assert.match(review, /Stored Excel source rows/)
assert.match(review, /Power loss is evidence/)
assert.match(review, /Reject Import/)
assert.match(review, /Delete Import/)
assert.match(types, /provisional_sessions: ProvisionalSession\[\]/)
assert.match(types, /requires_owner_confirmation: true/)
assert.match(upload, /multiple/)
assert.match(upload, /motorId/)
assert.match(upload, /authenticated MFMS route/)
assert.match(sourceInput, /Paste Full Text/)
assert.match(sourceInput, /Upload Screenshot — Optional/)
assert.match(sourceInput, /Upload TXT File/)
assert.match(sourceInput, /Upload Excel/)
assert.match(sourceInput, /Import Excel and Review/)
assert.match(sourceInput, /accept="\.xlsx,application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/)
assert.match(sourceInput, /Screenshot OCR/)
assert.match(sourceInput, /Screenshot OCR is not currently enabled/)
assert.match(sourceInput, /Paste Motor Notification Text/)
assert.match(sourceInput, /Import and Review/)
assert.match(sourceInput, /Copy Sample Format/)
assert.match(sourceInput, /Maximum 10 files, 1 MiB each/)
assert.match(sourceInput, /accept="\.txt,text\/plain"/)
assert.match(sourceInput, /Preview Text/)
assert.match(config, /SCREENSHOT_OCR_ENABLED = false/)
assert.equal((config.match(/\| MOTOR|\| MTR/g) ?? []).length, 11, "Approved sample must contain 11 MOTOR/MTR records")
assert.match(table, /Sorting and pagination are applied by the backend/)
assert.match(table, /md:hidden/)
assert.match(table, /overflow-x-auto/)
assert.match(table, /formatRuntimeHHMM\(record\.runtimeSeconds\)/)

assert.equal(sha256("app/page.tsx"), "6cd92f7d2928dfc4504a30e2efcfc32756456e06232cc031b10b26009d23d926", "MFMS home page changed")
assert.equal(sha256("app/motor-runtime/page.tsx"), "786ba2af7869f73a3b4039908852e29b915caf181668ef2a70e85cb0078c4e0d", "Approved Motor Runtime page changed")

console.log("Motor import API, minute-only totals, review workflow and removed screenshot page invariants: PASS")
