import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const component = readFileSync(resolve(root, "components/admin/harvest-sync-admin-client.tsx"), "utf8")
const proxy = readFileSync(resolve(root, "app/api/admin/harvest-sync/[[...path]]/route.ts"), "utf8")
const harvestCyclePage = readFileSync(resolve(root, "app/admin/harvest-cycle/page.tsx"), "utf8")
const harvestCycleDuplicates = readFileSync(
  resolve(root, "components/admin/harvest-cycle-duplicate-tree-entries.tsx"),
  "utf8",
)

assert.match(component, /Exact Duplicates — Automatically Resolved/)
assert.match(component, /exact_duplicate_group_count/)
assert.match(component, /exact_duplicate_superseded_count/)
assert.match(component, /exact_duplicate_retained_count/)
assert.match(component, /SUPERSEDED_EXACT_DUPLICATE/)
assert.match(component, /item\.classification === "DUPLICATE_REVIEW_REQUIRED"/)
assert.doesNotMatch(
  component,
  /\["DUPLICATE_REVIEW_REQUIRED",\s*"SUPERSEDED_EXACT_DUPLICATE"\]\.includes/,
  "Automatically resolved rows must not appear in the discrepancy list",
)
assert.match(component, /Download Complete Pre-Import CSV/)
assert.match(component, /Download Complete Audit CSV/)
assert.match(component, /"pre-import" \| "date-audit"/)
assert.match(component, /x-content-sha256/)
assert.match(proxy, /X-Content-SHA256/)
assert.match(component, /\$\{kind\}\.csv/)
assert.match(component, /Review Date-Scoped Import Set/)
assert.match(component, /Confirm Final Batch Import/)
assert.match(component, /confirmation_token/)
assert.match(component, /No Harvest record is inserted during scanning/)
assert.match(component, /PREVIEW REVIEW MODE — HARVEST IMPORT DISABLED/)
assert.match(component, /status\?\.importEnabled !== true/)
assert.match(component, /Harvest Import Disabled/)
assert.match(component, /Open Scan/)
assert.match(component, /Harvest Date/)
assert.match(component, /Tree Number Search/)
assert.match(component, /Natural ascending/)
assert.match(component, /CONFLICT_GROUP_PAGE_SIZE/)
assert.match(component, /ODK Instance/)
assert.match(component, /Submitter \/ Device/)
assert.match(component, /Clean Single Submissions — Automatically Ready/)
assert.match(component, /SINGLE_VALID_AUTO_READY/)
assert.match(component, /Cross-Date Cycle Safety Review/)
assert.match(component, /Cycle Safety Reviews/)
assert.match(component, /Save Supervisor Selection/)
assert.match(component, /Save and Open Next Unresolved/)
assert.match(component, /decision: "SELECT_SUBMISSION"/)
assert.match(component, /hydrateConflictReviewState\(data\.items \?\? \[\]\)/)
assert.match(component, /const issuesRequestId = useRef\(0\)/)
assert.match(component, /requestId !== issuesRequestId\.current/)
assert.match(component, /Issue response did not match requested Scan/)
assert.match(component, /const batchStatusRequestId = useRef\(0\)/)
assert.match(component, /requestId !== batchStatusRequestId\.current/)
assert.match(component, /Date-scoped batch response did not match the requested Scan, Harvest Date and Cycle/)
assert.match(component, /const importPreviewRequestId = useRef\(0\)/)
assert.match(component, /requestId !== importPreviewRequestId\.current/)
assert.match(component, /Import preview response did not match the requested Scan, Harvest Date, Cycle and fingerprint/)
assert.match(component, /batchStatusMatchesTarget/)
assert.ok(
  (component.match(/batchStatusMatchesSelection/g) ?? []).length >= 8,
  "Date-scoped preview, CSV, decision and import controls must all use the selected batch identity",
)
assert.match(component, /CSV response did not include a valid X-Content-SHA256 integrity header/)
assert.match(component, /crypto\.subtle\.digest\("SHA-256"/)
assert.match(component, /CSV integrity verification failed/)
assert.match(component, /CSV downloaded and verified/)
assert.match(component, /RESOLVED_CONFLICT_DECISIONS = new Set\(\["SELECT_SUBMISSION", "KEEP_LATEST"\]\)/)
assert.match(component, /selected_effective_instance_id \?\? row\?\.odk_instance_id/)
assert.match(component, /isActiveValidConflictCandidate/)
assert.match(component, /row\?\.classification === "DUPLICATE_REVIEW_REQUIRED"/)
assert.match(component, /const \[scanLoadVersion/)
assert.match(component, /setScanLoadVersion\(\(version\) => version \+ 1\)/)
assert.match(component, /setBatchStatus\(null\)/)
assert.match(component, /A valid Harvest Date and matching date-scoped batch verification are required/)
assert.match(component, /Harvest import remains locked in this page/)
assert.match(component, /setStatus\(null\)/)
assert.match(component, /manualConflictExclusionCount/)
assert.match(component, /exactDuplicateSuperseded/)
assert.match(component, /totalExcludedCount/)
assert.match(component, /const allDateConflictGroups = useMemo/)
assert.match(component, /allDateConflictGroups\.findIndex/)
assert.match(component, /setTreeFilter\(""\)/)
assert.match(component, /Date-Scoped Batch Readiness/)
assert.match(component, /storedDateScopedBatchFingerprint/)
assert.match(component, /dateScopedFingerprintMatches/)
assert.match(component, /globalSourceChanged/)
assert.match(component, /Global ODK Source/)
assert.match(component, /Clean Singles Auto-Ready/)
assert.match(component, /Hidden Eligible Candidates/)
assert.match(component, /Download Complete Pre-Import CSV/)
assert.match(component, /Download Complete Audit CSV/)
assert.match(component, /\/batch-status\?/)
assert.match(component, /"pre-import" \| "date-audit"/)
assert.match(component, /\$\{kind\}\.csv/)
assert.match(component, /harvest_date: dateFilter/)
assert.match(component, /harvest_cycle: String\(cycle\)/)
assert.match(component, /date_scoped_batch_fingerprint/)
assert.match(component, /confirmation_phrase/)
assert.match(component, /expected_record_count/)
assert.match(component, /expected_total_bunches/)
assert.match(component, /expected_total_nuts/)
assert.match(component, /status\?\.importEnabled !== true/)
assert.match(component, /!importPlan\.readyForImport/)
assert.match(proxy, /response\.arrayBuffer\(\)/, "CSV proxying must preserve non-JSON responses")
assert.match(harvestCyclePage, /HARVEST_CYCLE_FETCH_ATTEMPTS = 2/)
assert.match(harvestCyclePage, /HARVEST_CYCLE_RETRY_DELAY_MS = 250/)
assert.match(harvestCyclePage, /response\.status < 500/)
assert.match(harvestCyclePage, /HarvestCycleDuplicateTreeEntries/)
assert.doesNotMatch(harvestCycleDuplicates, /APPROVED_DUPLICATE_SCAN_ID/)
assert.doesNotMatch(harvestCycleDuplicates, /DISPLAY_ROW_LIMIT/)
assert.match(harvestCycleDuplicates, /\/api\/admin\/harvest-sync\/scans"/)
assert.match(harvestCycleDuplicates, /completedScans\[0\]/)
assert.match(harvestCycleDuplicates, /aria-label="Harvest Sync Scan"/)
assert.match(harvestCycleDuplicates, /aria-label="Harvest Date"/)
assert.match(harvestCycleDuplicates, /CONFLICTING DUPLICATE TREE ENTRIES — REVIEW REQUIRED/)
assert.match(harvestCycleDuplicates, /TREE NUMBER \/ DATA ERRORS — CORRECTION REQUIRED/)
assert.match(harvestCycleDuplicates, /EXACT DUPLICATES — AUTOMATICALLY RESOLVED/)
const harvestCycleConflictSection = harvestCycleDuplicates.slice(
  harvestCycleDuplicates.indexOf("CONFLICTING DUPLICATE TREE ENTRIES — REVIEW REQUIRED"),
  harvestCycleDuplicates.indexOf("TREE NUMBER / DATA ERRORS — CORRECTION REQUIRED"),
)
assert.match(harvestCycleConflictSection, /type="radio"/)
assert.match(harvestCycleConflictSection, /Record to Retain/)
assert.match(harvestCycleDuplicates, /Supervisor confirmed correct labour entry/)
assert.match(harvestCycleDuplicates, /Duplicate recording of the same harvest/)
assert.match(harvestCycleDuplicates, /Quantity confirmed after field verification/)
assert.match(harvestCycleConflictSection, /CONFLICT_SUPERVISOR_REASONS/)
assert.match(harvestCycleConflictSection, /Other reason details/)
assert.match(harvestCycleConflictSection, /Save Supervisor Selection/)
assert.match(harvestCycleConflictSection, /Save and Open Next Unresolved/)
assert.match(harvestCycleDuplicates, /issue_type: "CONFLICTING_DUPLICATE"/)
assert.match(harvestCycleDuplicates, /decision: "SELECT_SUBMISSION"/)
assert.match(harvestCycleDuplicates, /selected_effective_instance_id: selectedRow\.odk_instance_id/)
assert.match(harvestCycleConflictSection, /groupStatus\?\.groupMatches === true/)
assert.match(harvestCycleConflictSection, /Supervisor decision saved/)
assert.match(harvestCycleConflictSection, /supervisor_admin_user/)
assert.match(harvestCycleConflictSection, /supervisor_decision_updated_at/)
assert.match(harvestCycleDuplicates, /conflictGroupResolved/)
assert.match(harvestCycleDuplicates, /resolvedConflictCount/)
assert.match(harvestCycleDuplicates, /remainingConflictCount/)
assert.match(harvestCycleDuplicates, /setOpenConflictGroupKey\(nextUnresolved\[0\]\)/)
assert.match(harvestCycleDuplicates, /businessSignature/)
assert.match(harvestCycleDuplicates, /item\.total_bunches/)
assert.match(harvestCycleDuplicates, /item\.total_nuts/)
assert.match(harvestCycleDuplicates, /DUPLICATE_REVIEW_REQUIRED/)
assert.match(harvestCycleDuplicates, /SUPERSEDED_EXACT_DUPLICATE/)
assert.match(harvestCycleDuplicates, /EXPLICIT_ERROR_CLASSIFICATIONS/)
assert.match(harvestCycleDuplicates, /UNMATCHED_TREE/)
assert.match(harvestCycleDuplicates, /INVALID_DATA/)
assert.match(harvestCycleDuplicates, /ODK_HAS_ISSUES/)
assert.match(harvestCycleDuplicates, /LATE_SUBMISSION/)
assert.match(harvestCycleDuplicates, /IMPORT_ERROR/)
assert.match(harvestCycleDuplicates, /supervisor_decision/)
assert.match(harvestCycleDuplicates, /tree_exists_in_master/)
assert.match(harvestCycleDuplicates, /Pagination/)
assert.match(harvestCycleDuplicates, /Supervisor Action/)
assert.match(harvestCycleDuplicates, /Supervisor Reason/)
assert.match(harvestCycleDuplicates, /Save Supervisor Decision/)
assert.match(harvestCycleDuplicates, /Amend Supervisor Decision/)
assert.match(harvestCycleDuplicates, /KEEP_EXISTING_CYCLE_RECORD/)
assert.match(harvestCycleDuplicates, /USE_PENDING_SUBMISSION/)
assert.match(harvestCycleDuplicates, /DEFER_DECISION/)
assert.match(harvestCycleDuplicates, /CORRECTION ACTION REQUIRED/)
assert.match(harvestCycleDuplicates, /Group fingerprint unchanged/)
assert.match(harvestCycleDuplicates, /fingerprint-status/)
assert.match(
  harvestCycleDuplicates,
  /New ODK source changes exist after Scan/,
)
assert.match(
  harvestCycleDuplicates,
  /This Tree Number’s source data changed after the decision was saved/,
)
assert.match(harvestCycleDuplicates, /New scan required/)
assert.match(harvestCycleDuplicates, /Existing Harvest Record ID/)
assert.doesNotMatch(harvestCycleDuplicates, /Allow both/)
for (const heading of [
  "Tree Number",
  "Harvest Date",
  "ODK Time",
  "ODK Instance ID",
  "Submitter / Device",
  "B1",
  "B2",
  "B3",
  "Bunch Count",
  "Total Nuts",
  "Status",
  "Supervisor Decision",
]) {
  assert.match(harvestCycleDuplicates, new RegExp(`>${heading}<`))
}

console.log("Harvest Sync exact-duplicate UI contract checks passed.")
