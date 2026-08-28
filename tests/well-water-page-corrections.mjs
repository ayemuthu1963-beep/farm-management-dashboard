import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  formatWellWaterSyncSuccess,
  getWellWaterSyncErrorMessage,
  WELL_WATER_SYNC_FAILURE_MESSAGE,
} from "../lib/well-water-sync.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const page = read("app/well-water/page.tsx")
const dateRangeSelector = read("components/farm/date-range-selector.tsx")
const summaryCards = read("components/farm/summary-cards.tsx")
const wellSection = read("components/farm/well-section.tsx")
const wellTable = read("components/farm/well-table.tsx")
const wellChart = read("components/farm/well-chart.tsx")
const wellData = read("lib/well-data.ts")
const syncProxy = read("app/api/admin/well-water/sync/route.ts")

// Default through the current farm date; a missing current-day row stays blank.
assert.match(dateRangeSelector, /getDefaultWellDateRange\(days = 6/)
assert.match(dateRangeSelector, /const endDate = farmIsoDate\(now\)/)
assert.match(page, /days=6/)
assert.match(wellData, /buildCalendarRecords/)
assert.match(wellData, /isPlaceholder: true/)
assert.match(wellTable, /record\.isPlaceholder && record\.waterPumpedOut === null \? ""/)

// Remarks remain in the data contract and CSV, but are not rendered in either shared table.
assert.doesNotMatch(wellTable, />Remarks</)
assert.doesNotMatch(wellTable, /record\.remarks/)
assert.match(wellTable, /colSpan=\{4\}/)
assert.match(wellTable, /min-w-\[560px\]/)
assert.match(wellTable, /table-fixed/)
assert.match(wellTable, /max-w-full min-w-0 overflow-x-auto/)
assert.match(wellData, /remarks: string/)
assert.match(wellData, /"Remarks"/)
assert.match(wellData, /record\.remarks/)

// Each well renders its data and trend as independent bordered Panel cards.
assert.equal((wellSection.match(/<Panel\b/g) ?? []).length, 2)
assert.ok(wellSection.indexOf("<WellTable") < wellSection.indexOf("<WellChart"))
assert.match(wellSection, /title=\{`\$\{title\} Water Trend`\}/)
assert.equal((wellSection.match(/className=\{panelClassName/g) ?? []).length, 2)
assert.equal((wellSection.match(/bodyClassName="min-w-0"/g) ?? []).length, 2)

// North remains before South on mobile; xl retains the approved two-column layout.
assert.ok(page.indexOf('title="North Well"') < page.indexOf('title="South Well"'))
assert.match(page, /grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2/)

// Use restrained, existing MFMS colour tokens to distinguish the visible tiles.
assert.match(dateRangeSelector, /border-chart-1\/30 bg-chart-1\/5/)
assert.match(summaryCards, /border-primary\/25 bg-primary\/5/)
assert.match(summaryCards, /border-chart-1\/30 bg-chart-1\/10/)
assert.match(summaryCards, /border-chart-3\/30 bg-chart-3\/10/)
assert.match(summaryCards, /border-chart-2\/30 bg-chart-2\/10/)
assert.match(page, /panelClassName="border-chart-1\/30 bg-chart-1\/5"/)
assert.match(page, /panelClassName="border-chart-3\/30 bg-chart-3\/5"/)

// The responsive chart reserves enough room for Indian-formatted litre ticks.
assert.match(wellChart, /margin=\{\{ top: 8, right: 12, bottom: 4, left: 12 \}\}/)
assert.doesNotMatch(wellChart, /left:\s*-/)
assert.match(wellChart, /width=\{96\}/)
assert.match(wellChart, /tickFormatter=\{formatLitresAxisTick\}/)
assert.match(wellChart, /domain=\{includeZeroInWellChartDomain\}/)
assert.match(wellChart, /tickMargin=\{8\}/)
assert.match(wellChart, /minWidth=\{0\}/)
assert.match(wellChart, /h-72 min-h-72 w-full min-w-0/)
assert.match(wellChart, /formatNumberIN\(Math\.round\(Number\(value\)\)\)/)

// Manual sync has loading protection, success/failure feedback, and refreshes data only on success.
assert.match(page, /Sync ODK Now/)
assert.match(page, /Syncing…/)
assert.match(page, /disabled=\{isSyncing\}/)
assert.match(page, /aria-busy=\{isSyncing\}/)
assert.match(page, /animate-spin/)
assert.match(page, /syncInProgressRef\.current/)
assert.match(page, /fetch\("\/api\/admin\/well-water\/sync"/)
assert.match(page, /credentials: "same-origin"/)
assert.match(page, /setRefreshVersion\(\(version\) => version \+ 1\)/)
assert.match(page, /\[query, refreshVersion\]/)
assert.doesNotMatch(page, /setData\(emptyWellDashboardData\)/)
assert.match(page, /role=\{syncNotice\.kind === "error" \? "alert" : "status"\}/)
assert.match(page, /Latest successful sync:/)
assert.match(page, /formatIstDateTime\(latestSuccessfulSyncAt\)/)

const completedResult = {
  status: "completed",
  submissions_checked: 15,
  new_records_imported: 3,
  already_imported_records_skipped: 12,
  historical_records_skipped: 0,
  records_rejected_or_failed: 0,
  sync_started_at: "2026-08-01T18:00:00+05:30",
  sync_completed_at: "2026-08-01T18:00:03+05:30",
  latest_successful_sync_at: "2026-08-01T18:00:03+05:30",
  message: "completed",
}
assert.equal(
  formatWellWaterSyncSuccess(completedResult),
  "Sync completed: 3 new records imported, 12 already up to date.",
)
assert.equal(
  formatWellWaterSyncSuccess({ ...completedResult, records_rejected_or_failed: 2 }),
  "Sync completed: 3 new records imported, 12 already up to date. 2 records were rejected or failed.",
)
assert.match(page, /records_rejected_or_failed > 0 \? "warning" : "success"/)
assert.equal(
  getWellWaterSyncErrorMessage({ message: "A Well Water sync is already in progress." }),
  "A Well Water sync is already in progress.",
)
assert.equal(getWellWaterSyncErrorMessage({ detail: "Not authenticated" }), "Not authenticated")
assert.equal(getWellWaterSyncErrorMessage(null), WELL_WATER_SYNC_FAILURE_MESSAGE)

// The browser calls a same-origin proxy guarded by the shared environment and gateway identity contracts.
assert.match(syncProxy, /export async function POST\(request: NextRequest\)/)
assert.doesNotMatch(syncProxy, /export async function GET/)
assert.match(syncProxy, /getAdminTargetSafetyErrors/)
assert.match(syncProxy, /api\/admin\/well-water\/sync/)
assert.match(syncProxy, /getBasicAuthHeader\(\)/)
assert.match(syncProxy, /getAuthenticatedUserAssertionHeaders/)
assert.match(syncProxy, /MfmsAdminIdentityError/)
assert.match(syncProxy, /AbortSignal\.timeout\(SYNC_PROXY_TIMEOUT_MS\)/)
assert.doesNotMatch(syncProxy, /ODK_(?:PASSWORD|TOKEN|CENTRAL)/)

console.log("Well Water page corrections frontend regression passed")
