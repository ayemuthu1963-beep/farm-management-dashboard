import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { formatIstDateTime } from "../lib/format-ist-date-time.ts"
import {
  buildReviewBuckets,
  cycleCollisionResolved,
  reviewUnresolvedCounts,
} from "../lib/harvest-review-model.ts"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(resolve(root, path), "utf8")

const adminPage = read("app/admin/page.tsx")
const cyclePage = read("app/admin/harvest-cycle/page.tsx")
const cycleClient = read("components/admin/harvest-cycle-admin-client.tsx")
const syncPage = read("app/admin/harvest-sync/page.tsx")
const workspace = read("components/admin/harvest-manual-review-workspace.tsx")
const review = read("components/admin/harvest-review-sections.tsx")
const model = read("lib/harvest-review-model.ts")
const proxy = read("app/api/admin/harvest-sync/[[...path]]/route.ts")
const envExample = read(".env.example")

// Scan and ODK timestamps use one genuine Asia/Kolkata formatter for display only.
assert.equal(
  formatIstDateTime("2026-07-30T02:33:07.632000Z"),
  "30 Jul 2026 | 08:03 IST",
)
assert.equal(
  formatIstDateTime("2026-07-31T10:34:12.904496Z"),
  "31 Jul 2026 | 16:04 IST",
)
for (const invalid of [null, undefined, "", "not-a-timestamp"]) {
  assert.equal(formatIstDateTime(invalid), "—")
}
const formattedIstTimestamp = formatIstDateTime("2026-07-31T10:34:12.904496Z")
assert.doesNotMatch(formattedIstTimestamp, /\d{2}:\d{2}:\d{2}/, "seconds must not be displayed")
assert.doesNotMatch(formattedIstTimestamp, /\.\d+/, "milliseconds must not be displayed")
assert.doesNotMatch(formattedIstTimestamp, /\dT\d/, "the raw ISO T separator must not be displayed")
assert.doesNotMatch(formattedIstTimestamp, /Z(?:\s|$)/, "the raw UTC Z suffix must not be displayed")
assert.match(workspace, /formatIstDateTime\(scan\.scan_ended_at \?\? scan\.scan_started_at\)/)
assert.match(workspace, /Scan \{scan\.id\} — \{formatIstDateTime/)
assert.match(workspace, /selectedBatchStatus\?\.scanTimestamp/)
assert.match(workspace, /formatIstDateTime\(/)
assert.equal(
  (review.match(/formatIstDateTime\((?:row|record)\.odk_submission_timestamp\)/g) ?? []).length,
  5,
  "every visible ODK Time cell must use the shared IST formatter",
)
assert.doesNotMatch(
  review,
  /displayHarvestValue\((?:row|record)\.odk_submission_timestamp\)/,
)
assert.match(model, /String\(left\.odk_submission_timestamp \?\? ""\)\.localeCompare/)
assert.doesNotMatch(model, /formatIstDateTime/)

// Scan 10-style categories stay distinct and the unresolved total is their union.
const scanItem = (overrides) => ({
  id: 1,
  scan_id: 10,
  odk_instance_id: "uuid:base",
  harvest_date: "2026-07-30",
  original_tree_no: "1",
  classification: "SINGLE_VALID_AUTO_READY",
  issue_type: null,
  odk_submission_timestamp: "2026-07-30T02:33:07Z",
  b1: 1,
  b2: 0,
  b3: 0,
  total_bunches: 1,
  total_nuts: 1,
  group_key: null,
  note: null,
  submitter_name: "Training labourer",
  device_id: "training-device",
  ...overrides,
})
const scan10Items = []
for (let index = 1; index <= 696; index += 1) {
  scan10Items.push(
    scanItem({
      id: index,
      odk_instance_id: `uuid:single-${index}`,
      original_tree_no: String(index),
      group_key: `2026-07-30|${index}`,
    }),
  )
}
for (let index = 0; index < 5; index += 1) {
  const treeNo = String(700 + index)
  for (let candidate = 1; candidate <= 2; candidate += 1) {
    scan10Items.push(
      scanItem({
        id: 700 + index * 2 + candidate,
        odk_instance_id: `uuid:conflict-${treeNo}-${candidate}`,
        original_tree_no: treeNo,
        classification: "DUPLICATE_REVIEW_REQUIRED",
        group_key: `2026-07-30|${treeNo}`,
        b1: candidate,
        total_nuts: candidate,
      }),
    )
  }
}
scan10Items.push(
  scanItem({
    id: 800,
    odk_instance_id: "uuid:unmatched-1663",
    original_tree_no: "1663",
    classification: "UNMATCHED_TREE",
    group_key: "2026-07-30|1663",
    tree_exists_in_master: false,
    note: "Tree Number does not exist in TREE MASTER",
  }),
)
for (const treeNo of ["1119", "1634"]) {
  scan10Items.push(
    scanItem({
      id: 900 + Number(treeNo),
      odk_instance_id: `uuid:cycle-${treeNo}`,
      original_tree_no: treeNo,
      classification: "DUPLICATE_REVIEW_REQUIRED",
      issue_type: "CROSS_DATE_CYCLE_COLLISION",
      group_key: `2026-07-30|${treeNo}`,
      note: "more than one date in the same harvest cycle",
    }),
  )
}
const scan10Buckets = buildReviewBuckets(scan10Items, "2026-07-30", "19")
const scan10Unresolved = reviewUnresolvedCounts(scan10Buckets)
assert.equal(scan10Buckets.submissions.length, 709)
assert.equal(scan10Buckets.treeGroupCount, 704)
assert.equal(scan10Buckets.cleanSingles.length, 696)
assert.equal(scan10Buckets.conflicts.length, 5)
assert.equal(scan10Buckets.errors.length, 1)
assert.equal(scan10Buckets.cycleCollisions.length, 2)
assert.equal(
  scan10Buckets.cleanSingles.length +
    scan10Buckets.conflicts.length +
    scan10Buckets.errors.length +
    scan10Buckets.cycleCollisions.length,
  704,
)
assert.deepEqual(scan10Unresolved, {
  conflictingDuplicateGroupsRemaining: 5,
  invalidZeroGroupsRemaining: 0,
  dataErrorGroupsRemaining: 1,
  cycleSafetyGroupsRemaining: 2,
  totalUnresolvedGroupsRemaining: 8,
})
const newPendingCycleIssue = [
  scanItem({
    odk_instance_id: "uuid:new-cycle-30",
    original_tree_no: "1119",
    classification: "DUPLICATE_REVIEW_REQUIRED",
    issue_type: null,
    effective_issue_type: "PENDING_CROSS_DATE_CYCLE_COLLISION",
    group_key: "2026-07-30|1119",
    note: null,
  }),
  scanItem({
    odk_instance_id: "uuid:new-cycle-31",
    harvest_date: "2026-07-31",
    original_tree_no: "1119",
    classification: "DUPLICATE_REVIEW_REQUIRED",
    issue_type: "PENDING_CROSS_DATE_CYCLE_COLLISION",
    group_key: "2026-07-31|1119",
    note: null,
  }),
]
assert.equal(
  buildReviewBuckets(newPendingCycleIssue, "2026-07-30", "19").cycleCollisions.length,
  1,
  "the explicit pending cross-date issue type must not depend on note wording",
)
const pendingCandidates = [
  scanItem({ odk_instance_id: "uuid:pending-30" }),
  scanItem({ odk_instance_id: "uuid:pending-31", harvest_date: "2026-07-31" }),
]
assert.equal(
  cycleCollisionResolved(
    scanItem({ supervisor_decision: "RETAIN_PENDING_CYCLE_SUBMISSION" }),
    pendingCandidates,
  ),
  false,
  "a retain-pending action without a selected source record must remain unresolved",
)
assert.equal(
  cycleCollisionResolved(
    scanItem({
      supervisor_decision: "RETAIN_PENDING_CYCLE_SUBMISSION",
      selected_effective_instance_id: "uuid:pending-30",
    }),
    pendingCandidates,
  ),
  true,
)

// Preserve unrelated Admin tools and update only the two separate Harvest destinations.
for (const title of [
  "Motor Runtime Entry",
  "Well Water Entry",
  "Beetle Trap Entry",
  "Fertiliser & Pesticide Inventory Entry",
]) {
  assert.match(adminPage, new RegExp(title.replace(/[&]/g, "\\&")))
}
assert.match(adminPage, /title: "Harvest Cycle Admin"/)
assert.match(
  adminPage,
  /Open, close and maintain Harvest Cycles, dates, sale details and Cycle totals\./,
)
assert.match(adminPage, /title: "Harvest Manual Review & Import"/)
assert.match(
  adminPage,
  /Scan ODK, resolve duplicate or invalid submissions, run a dry run and manually import the reviewed Harvest batch\./,
)
assert.match(adminPage, /href: "\/admin\/harvest-cycle"/)
assert.match(adminPage, /href: "\/admin\/harvest-sync"/)

// Cycle administration is operationally separate from review/import.
assert.match(cyclePage, /Harvest Cycle Admin/)
assert.doesNotMatch(cyclePage, /Latest Manual Harvest Import/)
assert.doesNotMatch(cyclePage, /Open Harvest Manual Review &amp; Import/)
assert.doesNotMatch(cyclePage, /href="\/admin\/harvest-sync"/)
assert.doesNotMatch(cyclePage, /\/api\/admin\/harvest-sync\/history/)
assert.doesNotMatch(cyclePage, /HarvestCycleDuplicateTreeEntries/)
assert.doesNotMatch(cyclePage, /Scan ODK/)
assert.doesNotMatch(cyclePage, /Auto Sync|Automatic Preview Harvest/)
assert.match(cyclePage, /HARVEST_CYCLE_FETCH_ATTEMPTS = 2/)
assert.match(cyclePage, /HARVEST_CYCLE_RETRY_DELAY_MS = 250/)
assert.match(cycleClient, /Harvest Cycle History/)
for (const retainedControl of [
  "Open New Harvest Cycle",
  "Close Current Harvest Cycle",
  "Update Sale Details",
  "Current Harvest Cycle Status",
]) {
  assert.match(cycleClient, new RegExp(retainedControl))
}

// Exact permanent page copy and one authoritative workspace.
assert.match(syncPage, /Harvest Manual Review &amp; Import/)
assert.match(
  syncPage,
  /Review ODK Harvest submissions, resolve discrepancies, run a safety dry run and manually import the approved date-specific batch\./,
)
assert.match(syncPage, /<span className="font-extrabold">Mode:<\/span> Manual Review &amp; Import/)
assert.match(syncPage, /Database:<\/span> mfms_server_uat/)
assert.match(syncPage, /ODK Project:<\/span> 17/)
assert.match(syncPage, /Form:<\/span> mfms_preview_harvest_test_v1/)
assert.match(syncPage, /HarvestManualReviewWorkspace/)
assert.doesNotMatch(syncPage, /Automatic schedule|Harvest ODK Sync/)
assert.match(workspace, /MANUAL REVIEW & IMPORT AVAILABLE/)
assert.match(
  workspace,
  /A committed import is available only after the selected date has zero unresolved issues, the final import set is reviewed, and the authoritative dry run passes\./,
)
assert.doesNotMatch(
  workspace,
  /MANUAL IMPORT REMAINS LOCKED|MANUAL IMPORT IS DISABLED|Manual Import Disabled|Manual import remains locked|Manual import is disabled/,
)
assert.equal(
  existsSync(resolve(root, "components/admin/harvest-cycle-duplicate-tree-entries.tsx")),
  false,
)
assert.equal(
  existsSync(resolve(root, "components/admin/harvest-sync-admin-client.tsx")),
  false,
)

const stepHeadings = [
  "Step 1 — Select Batch",
  "Step 2 — Date-Scoped Summary",
  "Step 3 — Review Submissions",
  "Step 4 — Final Import Set & Verified Exports",
  "Step 5 — Authoritative Rollback-Only Dry Run",
  "Step 6 — Manual Import & History",
]
let lastStepIndex = -1
for (const heading of stepHeadings) {
  const index = workspace.indexOf(heading)
  assert.ok(index > lastStepIndex, `${heading} must exist in the required order`)
  lastStepIndex = index
}

// Cycle -> date -> scan, persisted scan navigation, and strict date scope.
assert.match(workspace, /Load Previous Scan/)
assert.match(workspace, /type="date"/)
assert.match(workspace, /list="persisted-harvest-dates"/)
assert.match(workspace, /required/)
assert.match(workspace, /Select the open Harvest Cycle and a required Harvest date before Scan ODK/)
assert.match(workspace, /!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(targetDate\)/)
assert.match(workspace, /Harvest Cycle/)
assert.match(workspace, /Cycle \{openCycle\} — Open/)
assert.match(workspace, /\/batch-status\?/)
assert.match(workspace, /targetHarvestDate !== targetDate/)
assert.match(workspace, /selectedScanIsLatest/)
assert.match(workspace, /const hasSelectedHarvestDate = \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//)
assert.match(
  workspace,
  /Select a Harvest Date to calculate the date-scoped batch\./,
)
assert.match(workspace, /hasSelectedHarvestDate \? \(scanData\?\.items \?\? \[\]\) : \[\]/)

// All six review categories share one scan/date owner, live search, natural sort, and pagination.
const categoryHeadings = [
  "Clean single submissions — standing-rule ready",
  "Exact duplicates — standing-rule resolved",
  "Conflicting duplicate submissions",
  "Valid records with invalid-zero duplicates",
  "Tree number and data errors — correction required",
  "Cycle safety decisions",
]
let lastCategoryIndex = -1
for (const heading of categoryHeadings) {
  const index = review.indexOf(heading)
  assert.ok(index > lastCategoryIndex, `${heading} must exist in the required order`)
  lastCategoryIndex = index
}
assert.match(review, /Tree Number Search/)
assert.match(review, /Natural ascending/)
assert.match(review, /REVIEW_GROUP_PAGE_SIZE/)
assert.match(review, /REVIEW_ROW_PAGE_SIZE/)
assert.match(review, /Category counts update live/)
assert.match(review, /overflow-x-auto/)
assert.match(adminPage, /grid gap-4 md:grid-cols-2/)
assert.match(workspace, /grid gap-4 md:grid-cols-2 lg:grid-cols-4/)
assert.ok(
  (workspace.match(/overflow-(?:x-)?auto/g) ?? []).length >= 2,
  "Wide final/history tables must remain horizontally scrollable on mobile",
)
assert.ok(
  (review.match(/sm:grid-cols-|md:grid-cols-|lg:grid-cols-/g) ?? []).length >= 10,
  "Review controls and counters must use responsive breakpoints rather than fixed desktop columns",
)

// Preserve strict business validation and deterministic exact-duplicate handling.
assert.match(model, /Number\.isInteger/)
assert.match(model, /item\.total_bunches === expectedBunches/)
assert.match(model, /item\.total_nuts === expectedNuts/)
assert.match(model, /earliestSubmission/)
assert.match(model, /left\.odk_instance_id\.localeCompare\(right\.odk_instance_id\)/)
assert.match(model, /READY_EXACT_DUPLICATE/)
assert.match(model, /SUPERSEDED_EXACT_DUPLICATE/)
assert.match(model, /SINGLE_VALID_AUTO_READY/)
assert.match(model, /naturalTreeCompare/)

// Supervisor controls, group fingerprints, invalid-zero policy, cycle safety and safe corrections.
assert.match(review, /Save and Open Next Unresolved/)
assert.match(review, /issue_type: "CONFLICTING_DUPLICATE"/)
assert.match(review, /decision: "SELECT_SUBMISSION"/)
assert.match(review, /groupStatus\?\.groupMatches === true/)
assert.match(review, /RETAIN_VALID_EXCLUDE_INVALID_ZERO/)
assert.match(review, /VALID_RECORD_WITH_INVALID_ZERO_SUBMISSION/)
assert.match(review, /Not selectable/)
assert.match(review, /Retain valid submission and exclude invalid zero submission/)
assert.match(review, /KEEP_EXISTING_CYCLE_RECORD/)
assert.match(review, /USE_PENDING_SUBMISSION/)
assert.match(review, /CORRECTION ACTION REQUIRED/)
assert.match(review, /MAP_TO_EXISTING_TREE/)
assert.match(review, /TreeNumberAutocomplete/)
assert.match(review, /Searchable exact Tree Master selector/)
assert.match(review, /\/api\/coconut-harvest\/tree-master/)
assert.match(review, /validatedTreeNo: option\.treeNo/)
assert.match(review, /Select an exact Tree Number from the Tree Master list/)
assert.match(review, /resolved_tree_no: mapIsValid \? target : null/)
assert.match(review, /Original submitted Tree Number/)
assert.match(review, /formatIstDateTime\(row\.odk_submission_timestamp\)/)
for (const field of [
  "Harvest Date",
  "ODK Time",
  "ODK Instance",
  "Submitter / Device",
  "Bunch Count",
  "B1",
  "B2",
  "B3",
  "Total Nuts",
  "Exact error",
  "Exists in Tree Master",
  "Proposed Tree Master number",
]) {
  assert.match(review, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
assert.match(review, /Other error classes can only be deferred and remain blocked/)
assert.match(review, /DEFER_DECISION/)
assert.match(review, /fingerprint-status/)
assert.match(review, /Multiple pending submissions for the same Tree Number occur on different dates in the same open Harvest Cycle/)
assert.match(review, /RETAIN_PENDING_CYCLE_SUBMISSION/)
assert.match(review, /Retain \{displayHarvestDateLong\(candidate\.harvest_date\)\} submission and exclude/)
assert.match(review, /Use pending submission as a correction proposal/)
assert.match(review, /PENDING_CROSS_DATE_CYCLE_COLLISION/)

// Final plan, verified exports, authoritative dry run, opaque token, and fail-closed manual commit.
assert.match(workspace, /Review Final Import Set/)
assert.match(workspace, /Download Pre-Import CSV/)
assert.match(workspace, /Download Full Audit CSV/)
assert.match(workspace, /x-content-sha256/)
assert.match(workspace, /crypto\.subtle\.digest\("SHA-256"/)
assert.match(workspace, /CSV integrity verification failed/)
assert.match(workspace, /\/import-dry-run/)
assert.match(workspace, /Run Import Dry Run/)
assert.match(workspace, /transactionRolledBack/)
assert.match(workspace, /hostLockVerified/)
assert.match(workspace, /postgresAdvisoryLockVerified/)
assert.match(workspace, /selectedOtherDateCount/)
assert.match(workspace, /auditRowsGenerated/)
assert.match(workspace, /projectedCycleTotals/)
assert.match(workspace, /Internal Plan Integrity Digest/)
assert.match(workspace, /The opaque one-use dry-run token is never displayed/)
assert.doesNotMatch(workspace, />\{importPlan\.confirmationToken\}</)
assert.match(workspace, /\/manual-import/)
assert.doesNotMatch(workspace, /fetch\("\/api\/admin\/harvest-sync\/import"/)
assert.match(workspace, /Confirm Manual Import/)
assert.match(workspace, /status\?\.manualImportEnabled === true/)
assert.match(workspace, /dry_run_token/)
assert.match(workspace, /finalTotalsReviewed/)
assert.match(
  workspace,
  /I reviewed the complete Final Import Set and confirm its effective record,/,
)
assert.match(workspace, /const finalImportBlockers: string\[\] = \[\]/)
for (const condition of [
  "Select a Harvest Date.",
  "Select a completed Scan ID.",
  "Select an Open Harvest Cycle.",
  "The date-scoped fingerprint must be current.",
  "Conflicting duplicate groups remaining:",
  "Stale decisions:",
  "Hidden candidates:",
  "Tree Number/data errors remaining:",
  "Cycle-safety groups remaining:",
  "Total unresolved groups remaining:",
  "Generate the matching Final Import Set.",
  "The authoritative rollback-only dry run must pass.",
  "A valid, unexpired dry-run token is required.",
  "The dry-run record count no longer matches.",
  "The dry-run bunch total no longer matches.",
  "The dry-run nut total no longer matches.",
  "Enter the exact dynamic confirmation phrase.",
]) {
  assert.match(workspace, new RegExp(condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
assert.match(workspace, /disabled=\{busy !== null \|\| finalImportBlockers\.length > 0\}/)
assert.ok(
  (workspace.match(/unresolvedGroupCount > 0/g) ?? []).length >= 3,
  "Final-set, dry-run and manual-import controls must fail closed while groups remain unresolved",
)
for (const label of [
  "conflicting duplicate groups remaining",
  "Tree Number/data errors remaining",
  "Cycle-safety groups remaining",
  "total unresolved groups remaining",
]) {
  assert.match(workspace, new RegExp(label))
}
for (const authoritativeCountField of [
  "conflictingDuplicateGroupsRemaining",
  "treeDataErrorGroupsRemaining",
  "cycleSafetyGroupsRemaining",
  "totalUnresolvedGroupsRemaining",
]) {
  assert.match(workspace, new RegExp(`statusPlan\\?\\.${authoritativeCountField}`))
}
assert.doesNotMatch(workspace, /candidateCount > 197|197-record safety cap/)

// Structured post-import verification and durable history/download controls.
assert.match(workspace, /Post-Import Verification/)
assert.match(workspace, /history\/\$\{runId\}\/post-import-verification/)
assert.match(workspace, /history\/dry-runs\/\$\{target\.sourceId\}/)
assert.match(workspace, /history\/\$\{target\.sourceId\}\/\$\{kind\}\.csv/)
assert.match(workspace, /data\.entries \?\? \[\]/)
assert.match(workspace, /entry\.runType === "DRY_RUN"/)
assert.match(workspace, /Pre-Import CSV/)
assert.match(workspace, /Records CSV/)
assert.match(workspace, /Audit CSV/)
for (const heading of [
  "Harvest Date",
  "Cycle",
  "Status",
  "Count",
  "Bunches",
  "Nuts",
  "User",
  "Completed",
  "Date Fingerprint",
  "Control Path",
]) {
  assert.match(workspace, new RegExp(`>${heading}<`))
}
assert.match(workspace, /DRY RUN \/ CONSUMED BY COMMIT/)
assert.match(workspace, /COMMITTED IMPORT/)
assert.match(workspace, /recordsReceipt\.sha256/)
assert.match(workspace, /auditReceipt\.sha256/)
assert.match(workspace, /durableVerification/)
assert.match(workspace, /Download Post-Import Records CSV/)
assert.match(workspace, /Download Post-Import Audit CSV/)
assert.match(workspace, /cycleTotalsProjected/)

// Audit-only sections start collapsed; important asynchronous feedback is announced.
assert.match(review, /id === "review-clean-singles"/)
assert.match(review, /id === "review-exact-duplicates"/)
assert.match(review, /<details>/)
assert.match(workspace, /aria-live=\{message\.ok \? "polite" : "assertive"\}/)
assert.match(review, /aria-live="polite"/)
assert.match(workspace, /htmlFor="harvest-persisted-scan"/)
assert.match(review, /htmlFor="harvest-review-tree-search"/)
assert.match(review, /htmlFor="harvest-review-tree-sort"/)
assert.match(workspace, /invalid-zero source submissions/)
assert.match(workspace, /already-imported source submissions/)

// Server-only runtime lock, backend lock, and retired legacy route must all agree.
assert.match(envExample, /HARVEST_MANUAL_IMPORT_ENABLED=false/)
assert.doesNotMatch(envExample, /NEXT_PUBLIC_HARVEST_MANUAL_IMPORT_ENABLED/)
assert.match(proxy, /process\.env\.HARVEST_MANUAL_IMPORT_ENABLED/)
assert.match(proxy, /rawSuffix === "manual-import"/)
assert.match(proxy, /isManualImportRuntimeEnabled\(\)/)
assert.match(proxy, /manualImportEnabled:/)
assert.match(proxy, /rawSuffix === "import"/)
assert.match(proxy, /status: 410/)
assert.match(proxy, /status: 423/)
assert.match(proxy, /response\.arrayBuffer\(\)/)
assert.match(proxy, /X-Content-SHA256/)
assert.match(proxy, /request\.headers\.get\("authorization"\)/)
assert.match(proxy, /createHmac\("sha256", signingSecret\)/)
assert.match(proxy, /X-MFMS-Authenticated-User/)
assert.match(proxy, /X-MFMS-Authenticated-User-Timestamp/)
assert.match(proxy, /X-MFMS-Authenticated-User-Signature/)
assert.match(proxy, /`\$\{target\.pathname\}\$\{target\.search\}`/)

console.log("Harvest manual-review UI contract checks passed.")
