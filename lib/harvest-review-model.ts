export const REVIEW_GROUP_PAGE_SIZE = 10
export const REVIEW_ROW_PAGE_SIZE = 25

const EXACT_AUDIT_CLASSIFICATIONS = new Set([
  "READY_EXACT_DUPLICATE",
  "SUPERSEDED_EXACT_DUPLICATE",
  "SUPERSEDED",
  "DUPLICATE_REVIEW_REQUIRED",
])

const EXPLICIT_ERROR_CLASSIFICATIONS = new Set([
  "UNMATCHED_TREE",
  "INVALID_DATA",
  "ODK_HAS_ISSUES",
  "ODK_REJECTED",
  "ODK_DELETED",
  "LATE_SUBMISSION",
  "IMPORT_ERROR",
  "FAILED",
])

const NON_ERROR_CLASSIFICATIONS = new Set([
  "READY_NEW",
  "SINGLE_VALID_AUTO_READY",
  "READY_EXACT_DUPLICATE",
  "SUPERSEDED_EXACT_DUPLICATE",
  "SUPERSEDED",
  "ALREADY_IMPORTED",
])

export interface HarvestScanSummary {
  id: number
  status: string
  scan_started_at: string | null
  scan_ended_at: string | null
  cycle_no: string | null
  source_row_count?: number | null
  ready_new_count?: number | null
  duplicate_group_count?: number | null
  duplicate_review_count?: number | null
  exact_duplicate_group_count?: number | null
  exact_duplicate_superseded_count?: number | null
  unmatched_tree_count?: number | null
  invalid_data_count?: number | null
  [key: string]: unknown
}

export interface HarvestScanItem {
  id: number
  scan_id: number
  odk_instance_id: string
  harvest_date: string | null
  original_tree_no: string | null
  classification: string
  issue_type?: string | null
  effective_issue_type?: string | null
  odk_submission_timestamp: string | null
  harvest_time?: string | null
  b1: number | null
  b2: number | null
  b3: number | null
  total_bunches: number | null
  total_nuts: number | null
  group_key: string | null
  note: string | null
  existing_harvest_record_id?: number | null
  review_state?: string | null
  submitter_name: string | null
  device_id: string | null
  tree_exists_in_master?: boolean
  supervisor_decision?: string | null
  supervisor_reason?: string | null
  supervisor_resolved_tree_no?: string | null
  selected_effective_instance_id?: string | null
  supervisor_admin_user?: string | null
  supervisor_decision_at?: string | null
  supervisor_decision_updated_at?: string | null
  supervisor_existing_harvest_record_id?: number | null
  supervisor_group_source_fingerprint?: string | null
  supervisor_group_fingerprint_version?: string | null
  supervisor_correction_status?: string | null
  supervisor_correction_run_id?: number | null
  existing_record_source?: string | null
  is_invalid_zero_submission?: boolean
  effective_classification?: string | null
  [key: string]: unknown
}

export interface HarvestScanResponse {
  scan: HarvestScanSummary
  items: HarvestScanItem[]
}

export interface ExactAuditGroup {
  key: string
  rows: HarvestScanItem[]
  retained: HarvestScanItem
  superseded: HarvestScanItem[]
}

export interface MixedValidInvalidZeroGroup {
  valid: HarvestScanItem
  invalid: HarvestScanItem[]
}

export interface ReviewGroup {
  key: string
  rows: HarvestScanItem[]
}

export interface CycleCollisionGroup {
  key: string
  pending: HarvestScanItem
  pendingCandidates: HarvestScanItem[]
  records: HarvestScanItem[]
}

export interface AppliedCorrectionAuditItem {
  key: string
  runId: number
  row: HarvestScanItem
}

export interface ReviewBuckets {
  submissions: HarvestScanItem[]
  treeGroupCount: number
  cleanSingles: HarvestScanItem[]
  exactGroups: ExactAuditGroup[]
  conflicts: ReviewGroup[]
  invalidZeroGroups: ReviewGroup[]
  errors: HarvestScanItem[]
  cycleCollisions: CycleCollisionGroup[]
  appliedCorrections: AppliedCorrectionAuditItem[]
}

export interface ReviewUnresolvedCounts {
  conflictingDuplicateGroupsRemaining: number
  invalidZeroGroupsRemaining: number
  dataErrorGroupsRemaining: number
  cycleSafetyGroupsRemaining: number
  totalUnresolvedGroupsRemaining: number
}

export const RESOLVED_CONFLICT_DECISIONS = new Set([
  "SELECT_SUBMISSION",
  "KEEP_LATEST",
  "RETAIN_VALID_EXCLUDE_INVALID_ZERO",
])

export const SAVED_CONFLICT_DECISIONS = new Set([
  ...RESOLVED_CONFLICT_DECISIONS,
  "DEFER_DECISION",
])

export function displayHarvestDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—"
}

export function displayHarvestValue(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

export function naturalTreeCompare(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

export function reviewGroupKey(item: HarvestScanItem): string {
  return item.group_key ?? `${displayHarvestDate(item.harvest_date)}|${item.original_tree_no ?? ""}`
}

export function groupFingerprintStatusKey(treeNo: string, harvestDate?: string | null): string {
  return harvestDate ? `${treeNo}|${displayHarvestDate(harvestDate)}` : treeNo
}

export function businessSignature(item: HarvestScanItem, cycleNo: string | null): string {
  return JSON.stringify([
    String(item.original_tree_no ?? "").trim(),
    displayHarvestDate(item.harvest_date),
    cycleNo ?? "",
    item.total_bunches,
    item.b1,
    item.b2,
    item.b3,
    item.total_nuts,
  ])
}

export function earliestSubmission(rows: HarvestScanItem[]): HarvestScanItem {
  return [...rows].sort((left, right) => {
    const timeCompared = String(left.odk_submission_timestamp ?? "").localeCompare(
      String(right.odk_submission_timestamp ?? ""),
    )
    if (timeCompared !== 0) return timeCompared
    return left.odk_instance_id.localeCompare(right.odk_instance_id)
  })[0]
}

export function isCycleCollision(item: HarvestScanItem): boolean {
  const issueType = String(item.effective_issue_type ?? item.issue_type ?? "").toUpperCase()
  const note = String(item.note ?? "").toLowerCase()
  return (
    item.classification === "DUPLICATE_REVIEW_REQUIRED" &&
    (
      issueType === "CYCLE_COLLISION" ||
      issueType === "CROSS_DATE_CYCLE_COLLISION" ||
      issueType === "PENDING_CROSS_DATE_CYCLE_COLLISION" ||
      note.includes("more than one date in the same harvest cycle") ||
      note.includes("same tree number in this harvest cycle") ||
      note.includes("same tree number and harvest date or cycle")
    )
  )
}

export function selectedConflictInstance(item: HarvestScanItem | undefined): string | null {
  if (!item || !RESOLVED_CONFLICT_DECISIONS.has(String(item.supervisor_decision ?? ""))) return null
  const selected = item.selected_effective_instance_id ?? item.odk_instance_id
  return selected ? String(selected) : null
}

export function isActiveValidConflictCandidate(item: HarvestScanItem): boolean {
  const reviewState = String(item.review_state ?? "").toLowerCase().replace(/\s+/g, "")
  const bunchValues = [item.b1, item.b2, item.b3]
  const integerBunchValues = bunchValues.every(
    (value) => typeof value === "number" && Number.isInteger(value) && value >= 0,
  )
  const expectedBunches = bunchValues.filter((value) => typeof value === "number" && value > 0).length
  const expectedNuts = bunchValues.reduce<number>(
    (total, value) => total + (typeof value === "number" ? value : 0),
    0,
  )
  return Boolean(
    item.odk_instance_id &&
      item.classification === "DUPLICATE_REVIEW_REQUIRED" &&
      !["deleted", "rejected", "hasissues"].includes(reviewState) &&
      integerBunchValues &&
      typeof item.total_bunches === "number" &&
      Number.isInteger(item.total_bunches) &&
      item.total_bunches >= 1 &&
      item.total_bunches === expectedBunches &&
      typeof item.total_nuts === "number" &&
      Number.isInteger(item.total_nuts) &&
      item.total_nuts > 0 &&
      item.total_nuts === expectedNuts,
  )
}

export function isAllZeroInvalidSubmission(item: HarvestScanItem): boolean {
  const quantities = [item.b1, item.b2, item.b3, item.total_bunches, item.total_nuts]
  const allZero = quantities.every(
    (value) => typeof value === "number" && Number.isInteger(value) && value === 0,
  )
  if (!allZero) return false
  if (item.is_invalid_zero_submission === true) return true
  if (item.effective_classification === "INVALID_DATA") return true
  if (item.classification === "INVALID_DATA") return true
  return item.classification === "DUPLICATE_REVIEW_REQUIRED"
}

export function mixedValidInvalidZeroGroup(
  rows: HarvestScanItem[],
): MixedValidInvalidZeroGroup | null {
  if (rows.length < 2) return null
  const invalid = rows.filter(isAllZeroInvalidSubmission)
  const valid = rows.filter(
    (row) => isActiveValidConflictCandidate(row) && !isAllZeroInvalidSubmission(row),
  )
  if (valid.length !== 1 || invalid.length < 1 || valid.length + invalid.length !== rows.length) {
    return null
  }
  return { valid: valid[0], invalid }
}

export function conflictGroupResolved(rows: HarvestScanItem[]): boolean {
  return rows.some((decisionRow) => {
    const selected = selectedConflictInstance(decisionRow)
    return Boolean(
      selected &&
        rows.some(
          (row) => String(row.odk_instance_id) === selected && isActiveValidConflictCandidate(row),
        ),
    )
  })
}

export function invalidZeroGroupResolved(rows: HarvestScanItem[]): boolean {
  const mixed = mixedValidInvalidZeroGroup(rows)
  if (!mixed) return false
  return rows.some(
    (row) =>
      row.supervisor_decision === "RETAIN_VALID_EXCLUDE_INVALID_ZERO" &&
      selectedConflictInstance(row) === mixed.valid.odk_instance_id,
  )
}

export function cycleCollisionResolved(
  item: HarvestScanItem,
  pendingCandidates?: HarvestScanItem[],
): boolean {
  if (item.supervisor_decision === "KEEP_EXISTING_CYCLE_RECORD") return true
  if (item.supervisor_decision !== "RETAIN_PENDING_CYCLE_SUBMISSION") return false
  const selectedInstanceId = String(item.selected_effective_instance_id ?? "").trim()
  return Boolean(
    selectedInstanceId &&
      (!pendingCandidates ||
        pendingCandidates.some(
          (candidate) => candidate.odk_instance_id === selectedInstanceId,
        )),
  )
}

export function dataErrorGroupResolved(item: HarvestScanItem): boolean {
  return Boolean(
    item.classification === "UNMATCHED_TREE" &&
      item.supervisor_decision === "MAP_TO_EXISTING_TREE" &&
      String(item.supervisor_resolved_tree_no ?? "").trim(),
  )
}

export function isAppliedControlledCorrection(item: HarvestScanItem): boolean {
  return Boolean(
    String(item.supervisor_correction_status ?? "").toUpperCase() === "APPLIED" &&
      Number.isInteger(Number(item.supervisor_correction_run_id)) &&
      Number(item.supervisor_correction_run_id) > 0,
  )
}

export function reviewUnresolvedCounts(buckets: ReviewBuckets): ReviewUnresolvedCounts {
  const conflictKeys = buckets.conflicts
    .filter((group) => !conflictGroupResolved(group.rows))
    .map((group) => group.key)
  const invalidZeroKeys = buckets.invalidZeroGroups
    .filter((group) => !invalidZeroGroupResolved(group.rows))
    .map((group) => group.key)
  const dataErrorKeys = buckets.errors
    .filter((item) => !dataErrorGroupResolved(item))
    .map(reviewGroupKey)
  const cycleSafetyKeys = buckets.cycleCollisions
    .filter(
      ({ pending, pendingCandidates }) =>
        !cycleCollisionResolved(pending, pendingCandidates),
    )
    .map((group) => group.key)

  // buildReviewBuckets assigns each actionable source group to exactly one category.
  // The Set is nevertheless authoritative so duplicate scan rows never inflate readiness.
  const distinctUnresolvedGroups = new Set([
    ...conflictKeys,
    ...invalidZeroKeys,
    ...dataErrorKeys,
    ...cycleSafetyKeys,
  ])

  return {
    conflictingDuplicateGroupsRemaining: new Set(conflictKeys).size,
    invalidZeroGroupsRemaining: new Set(invalidZeroKeys).size,
    dataErrorGroupsRemaining: new Set(dataErrorKeys).size,
    cycleSafetyGroupsRemaining: new Set(cycleSafetyKeys).size,
    totalUnresolvedGroupsRemaining: distinctUnresolvedGroups.size,
  }
}

export function buildReviewBuckets(
  allItems: HarvestScanItem[],
  targetDate: string,
  cycleNo: string | null,
  treeSearch = "",
  sortDirection: "asc" | "desc" = "asc",
): ReviewBuckets {
  const query = treeSearch.trim().toLocaleLowerCase()
  const submissions = allItems
    .filter((item) => !targetDate || displayHarvestDate(item.harvest_date) === targetDate)
    .filter(
      (item) =>
        !query ||
        String(item.original_tree_no ?? "")
          .toLocaleLowerCase()
          .includes(query),
    )
    .sort((left, right) => {
      const treeCompared = naturalTreeCompare(left.original_tree_no, right.original_tree_no)
      if (treeCompared !== 0) return sortDirection === "asc" ? treeCompared : -treeCompared
      return String(left.odk_submission_timestamp ?? "").localeCompare(
        String(right.odk_submission_timestamp ?? ""),
      )
    })

  const allGrouped = new Map<string, HarvestScanItem[]>()
  for (const item of submissions) {
    const key = reviewGroupKey(item)
    allGrouped.set(key, [...(allGrouped.get(key) ?? []), item])
  }
  const appliedCorrections = submissions
    .filter(isAppliedControlledCorrection)
    .map((row) => ({
      key: `correction-${Number(row.supervisor_correction_run_id)}`,
      runId: Number(row.supervisor_correction_run_id),
      row,
    }))
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.runId === entry.runId) === index,
    )
  const operationalSubmissions = submissions.filter(
    (item) => !isAppliedControlledCorrection(item),
  )
  const grouped = new Map<string, HarvestScanItem[]>()
  for (const item of operationalSubmissions) {
    const key = reviewGroupKey(item)
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }
  const groups = [...grouped.entries()]

  const exactGroups: ExactAuditGroup[] = groups
    .filter(([, rows]) => {
      if (rows.length < 2) return false
      if (!rows.every((item) => EXACT_AUDIT_CLASSIFICATIONS.has(item.classification))) return false
      return new Set(rows.map((item) => businessSignature(item, cycleNo))).size === 1
    })
    .map(([key, rows]) => {
      const retained =
        rows.find((item) => item.classification === "READY_EXACT_DUPLICATE") ??
        earliestSubmission(rows)
      return { key, rows, retained, superseded: rows.filter((item) => item !== retained) }
    })

  const exactKeys = new Set(exactGroups.map((group) => group.key))
  const cyclePendingByTree = new Map<string, HarvestScanItem[]>()
  for (const item of operationalSubmissions.filter(isCycleCollision)) {
    const treeNo = String(item.original_tree_no ?? "").trim()
    const key = `${treeNo}|${cycleNo ?? ""}`
    const allPendingCandidates = allItems.filter(
      (candidate) =>
        !isAppliedControlledCorrection(candidate) &&
        isCycleCollision(candidate) &&
        String(candidate.original_tree_no ?? "").trim() === treeNo,
    )
    cyclePendingByTree.set(key, allPendingCandidates)
  }
  const cycleCollisions: CycleCollisionGroup[] = [...cyclePendingByTree.entries()].map(
    ([key, pendingCandidates]) => {
      const pending =
        pendingCandidates.find((item) => Boolean(item.supervisor_decision)) ??
        earliestSubmission(pendingCandidates)
      const candidateIds = new Set(pendingCandidates.map((item) => item.odk_instance_id))
      const records = allItems
        .filter(
          (item) =>
            !isAppliedControlledCorrection(item) &&
            item.original_tree_no === pending.original_tree_no &&
            (
              item.classification === "ALREADY_IMPORTED" ||
              isCycleCollision(item) ||
              candidateIds.has(item.odk_instance_id)
            ),
        )
        .filter(
          (item, index, rows) =>
            rows.findIndex((candidate) => candidate.odk_instance_id === item.odk_instance_id) === index,
        )
        .sort((left, right) => {
          const dateCompared = displayHarvestDate(left.harvest_date).localeCompare(
            displayHarvestDate(right.harvest_date),
          )
          return dateCompared !== 0
            ? dateCompared
            : String(left.odk_submission_timestamp ?? "").localeCompare(
                String(right.odk_submission_timestamp ?? ""),
              )
        })
      return { key, pending, pendingCandidates, records }
    },
  )
  const cycleKeys = new Set(
    cycleCollisions.flatMap(({ pendingCandidates }) =>
      pendingCandidates.map((item) => reviewGroupKey(item)),
    ),
  )

  const reviewGroups = groups
    .filter(([key, rows]) => {
      if (rows.length < 2 || exactKeys.has(key) || cycleKeys.has(key)) return false
      return rows.some(
        (item) =>
          item.classification === "DUPLICATE_REVIEW_REQUIRED" ||
          isAllZeroInvalidSubmission(item),
      )
    })
    .map(([key, rows]) => ({ key, rows }))

  const invalidZeroGroups = reviewGroups.filter((group) => mixedValidInvalidZeroGroup(group.rows))
  const invalidZeroKeys = new Set(invalidZeroGroups.map((group) => group.key))
  const conflicts = reviewGroups.filter((group) => !invalidZeroKeys.has(group.key))
  const conflictKeys = new Set(conflicts.map((group) => group.key))

  const cleanSingles = groups
    .filter(([, rows]) => rows.length === 1)
    .map(([, rows]) => rows[0])
    .filter(
      (item) =>
        !isCycleCollision(item) &&
        (item.classification === "READY_NEW" || item.classification === "SINGLE_VALID_AUTO_READY"),
    )

  const errors = operationalSubmissions.filter((item) => {
    const key = reviewGroupKey(item)
    if (cycleKeys.has(key) || exactKeys.has(key) || conflictKeys.has(key) || invalidZeroKeys.has(key)) {
      return false
    }
    if (EXPLICIT_ERROR_CLASSIFICATIONS.has(item.classification)) return true
    if (item.classification === "DUPLICATE_REVIEW_REQUIRED") return true
    return !NON_ERROR_CLASSIFICATIONS.has(item.classification)
  })

  return {
    submissions,
    treeGroupCount: allGrouped.size,
    cleanSingles,
    exactGroups,
    conflicts,
    invalidZeroGroups,
    errors,
    cycleCollisions,
    appliedCorrections,
  }
}
