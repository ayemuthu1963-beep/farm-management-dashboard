"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, History, MapPinned, Search, ShieldCheck } from "lucide-react"
import { HarvestControlledReplacement } from "@/components/admin/harvest-controlled-replacement"
import { HarvestLocationComparisonMap } from "@/components/admin/harvest-location-comparison-map"
import { TreeNumberAutocomplete } from "@/components/harvest/tree-number-autocomplete"
import { formatIstDateTime } from "@/lib/format-ist-date-time"
import {
  treeNumberOptionKey,
  type TreeNumberOption,
} from "@/lib/tree-number-options"
import {
  REVIEW_GROUP_PAGE_SIZE,
  REVIEW_ROW_PAGE_SIZE,
  RESOLVED_CONFLICT_DECISIONS,
  SAVED_CONFLICT_DECISIONS,
  buildReviewBuckets,
  conflictGroupResolved,
  cycleCollisionResolved,
  displayHarvestDate,
  displayHarvestValue,
  groupFingerprintStatusKey,
  invalidZeroGroupResolved,
  isActiveValidConflictCandidate,
  isAllZeroInvalidSubmission,
  mixedValidInvalidZeroGroup,
  pendingCycleDispositionForTarget,
  selectedConflictInstance,
  type HarvestScanItem,
  type HarvestScanResponse,
  type ReviewGroup,
} from "@/lib/harvest-review-model"

type CycleDecisionAction =
  | "KEEP_EXISTING_CYCLE_RECORD"
  | "USE_PENDING_SUBMISSION"
  | "RETAIN_PENDING_CYCLE_SUBMISSION"
  | "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE"
  | "DEFER_DECISION"
  | ""

type ConflictDecisionAction =
  | "SELECT_SUBMISSION"
  | "REASSIGN_SUBMISSION_TREE"
  | "RETAIN_VALID_EXCLUDE_INVALID_ZERO"
  | "DEFER_DECISION"
  | ""

type ConflictResolutionMode = "RETAIN_ONE" | "REASSIGN_TREE" | ""

type ErrorDecisionAction = "MAP_TO_EXISTING_TREE" | "DEFER_DECISION" | ""

interface DecisionDraft {
  action: CycleDecisionAction
  selectedInstanceId: string
  reason: string
  otherReason: string
}

interface ErrorDecisionDraft {
  action: ErrorDecisionAction
  resolvedTreeNo: string
  validatedTreeNo: string
  reason: string
}

interface ConflictDecisionDraft {
  selectedInstanceId: string
  action: ConflictDecisionAction
  resolutionMode: ConflictResolutionMode
  correctedTreeNo: string
  validatedCorrectedTreeNo: string
  reason: string
  otherReason: string
}

interface FingerprintStatus {
  scanId: number
  matches: boolean
  checkedAt: string
  treeNo?: string
  groupMatches?: boolean
  groupFingerprintVersion?: string
  storedGroupFingerprint?: string
  baselineGroupFingerprint?: string
  currentGroupFingerprint?: string
  immutableScanMatchesSavedDecision?: boolean
  storedScanFingerprint?: string
  currentLiveFingerprint?: string
  fullSourceMatches?: boolean
  liveSourceChanged?: boolean
  finalImportRequiresNewScan?: boolean
}

interface Props {
  scanData: HarvestScanResponse | null
  targetDate: string
  disabled?: boolean
  onDecisionSaved: () => Promise<void>
}

const SUPERVISOR_REASONS = [
  "Existing Cycle record is correct",
  "Pending labour submission is correct",
  "Duplicate recording of the same harvest",
  "Field verification required",
  "Other",
] as const

const CONFLICT_SUPERVISOR_REASONS = [
  "Tree number entered incorrectly",
  "Supervisor confirmed correct labour entry",
  "Duplicate recording of the same harvest",
  "Quantity confirmed after field verification",
  "Other",
] as const

const INVALID_ZERO_SUPERVISOR_REASONS = [
  "Accidental empty submission",
  "Valid labour entry confirmed",
  "Zero-value duplicate excluded after supervisor verification",
  "Field verification required",
  "Other",
] as const

const CYCLE_COLLISION_DECISIONS = new Set<CycleDecisionAction>([
  "KEEP_EXISTING_CYCLE_RECORD",
  "USE_PENDING_SUBMISSION",
  "RETAIN_PENDING_CYCLE_SUBMISSION",
  "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE",
  "DEFER_DECISION",
])

function normalizedCycleDecisionAction(value: unknown): CycleDecisionAction {
  if (value === "USE_PENDING_SUBMISSION_AS_CORRECTION_PROPOSAL") {
    return "USE_PENDING_SUBMISSION"
  }
  return CYCLE_COLLISION_DECISIONS.has(value as CycleDecisionAction)
    ? (value as CycleDecisionAction)
    : ""
}

function normalizedCycleDecisionActionForTarget(
  value: unknown,
  selectedInstanceId: string | null | undefined,
  pendingCandidates: HarvestScanItem[],
  targetDate: string,
): CycleDecisionAction {
  const action = normalizedCycleDecisionAction(value)
  return pendingCycleDispositionForTarget(
    action,
    selectedInstanceId,
    pendingCandidates,
    targetDate,
  ) as CycleDecisionAction
}

const EMPTY_DECISION_DRAFT: DecisionDraft = {
  action: "",
  selectedInstanceId: "",
  reason: "",
  otherReason: "",
}

function statusBadge(classification: string): string {
  if (classification === "UNMATCHED_TREE") return "border-orange-200 bg-orange-50 text-orange-800"
  if (classification === "DUPLICATE_REVIEW_REQUIRED") return "border-rose-200 bg-rose-50 text-rose-800"
  if (classification === "INVALID_DATA") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-amber-200 bg-amber-50 text-amber-800"
}

function submissionLocationLabel(row: HarvestScanItem): string {
  if (row.gps_latitude == null || row.gps_longitude == null) return "No GPS"
  const latitude = Number(row.gps_latitude)
  const longitude = Number(row.gps_longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "No GPS"
  const accuracy = Number(row.gps_accuracy_m)
  return Number.isFinite(accuracy) && accuracy >= 0 ? `GPS ±${Math.round(accuracy)} m` : "GPS captured"
}

function displayHarvestDateLong(value: string | null | undefined): string {
  const date = displayHarvestDate(value)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`
}

function displayHarvestDayMonth(value: string | null | undefined): string {
  const date = displayHarvestDate(value)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  return `${Number(match[3])} ${months[Number(match[2]) - 1]}`
}

function pendingCycleSupervisorReasons(rows: HarvestScanItem[]): string[] {
  const dateReasons = [...new Set(rows.map((row) => displayHarvestDate(row.harvest_date)))]
    .sort()
    .map((date) => `${displayHarvestDayMonth(date)} submission is correct`)
  return [
    ...dateReasons,
    "Duplicate recording across Harvest dates",
    "Field verification required",
    "Other",
  ]
}

function decisionState(action: string | null | undefined): string {
  if (
    action === "KEEP_EXISTING_CYCLE_RECORD" ||
    action === "RETAIN_PENDING_CYCLE_SUBMISSION" ||
    action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE"
  ) return "Resolved"
  if (
    action === "USE_PENDING_SUBMISSION" ||
    action === "USE_PENDING_SUBMISSION_AS_CORRECTION_PROPOSAL"
  ) return "Correction required"
  return "Unresolved"
}

function storedConflictDecisionDraft(rows: HarvestScanItem[]): ConflictDecisionDraft {
  const mixedGroup = mixedValidInvalidZeroGroup(rows)
  const decisionRow =
    rows.find((row) => SAVED_CONFLICT_DECISIONS.has(String(row.supervisor_decision ?? ""))) ??
    rows.find((row) => selectedConflictInstance(row))
  const savedReason = decisionRow?.supervisor_reason ?? ""
  const allowedReasons = mixedGroup ? INVALID_ZERO_SUPERVISOR_REASONS : CONFLICT_SUPERVISOR_REASONS
  const savedReasonIsChoice = allowedReasons.some((reason) => reason === savedReason)
  const savedAction = String(decisionRow?.supervisor_decision ?? "")
  return {
    selectedInstanceId:
      selectedConflictInstance(decisionRow) ??
      (mixedGroup && savedAction !== "DEFER_DECISION" ? mixedGroup.valid.odk_instance_id : ""),
    action:
      savedAction === "REASSIGN_SUBMISSION_TREE" ||
      savedAction === "RETAIN_VALID_EXCLUDE_INVALID_ZERO" ||
      savedAction === "DEFER_DECISION"
        ? savedAction
        : mixedGroup
          ? ""
          : "SELECT_SUBMISSION",
    resolutionMode:
      savedAction === "REASSIGN_SUBMISSION_TREE"
        ? "REASSIGN_TREE"
        : savedAction === "SELECT_SUBMISSION" || savedAction === "KEEP_LATEST"
          ? "RETAIN_ONE"
          : "",
    correctedTreeNo:
      savedAction === "REASSIGN_SUBMISSION_TREE"
        ? String(decisionRow?.supervisor_resolved_tree_no ?? "")
        : "",
    validatedCorrectedTreeNo:
      savedAction === "REASSIGN_SUBMISSION_TREE"
        ? String(decisionRow?.supervisor_resolved_tree_no ?? "")
        : "",
    reason: savedReason ? (savedReasonIsChoice ? savedReason : "Other") : "",
    otherReason: savedReasonIsChoice ? "" : savedReason,
  }
}

function Pagination({
  page,
  pageCount,
  total,
  unit,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  unit: string
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold">
      <button
        type="button"
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Previous
      </button>
      <span className="text-center">
        Page {page} of {pageCount} · {total.toLocaleString("en-IN")} {unit}
      </span>
      <button
        type="button"
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
      >
        Next
      </button>
    </div>
  )
}

function ReviewSection({
  id,
  title,
  icon: Icon,
  count,
  collapsedByDefault = false,
  children,
}: {
  id: string
  title: string
  icon: typeof ShieldCheck
  count: number
  collapsedByDefault?: boolean
  children: React.ReactNode
}) {
  const startsCollapsed =
    collapsedByDefault ||
    id === "review-clean-singles" ||
    id === "review-exact-duplicates" ||
    id === "review-applied-corrections"
  const heading = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-black uppercase tracking-wide text-foreground sm:text-base">
          {title}
        </h3>
      </div>
      <span className="rounded-full border bg-background px-3 py-1 text-xs font-black">
        {count.toLocaleString("en-IN")}
      </span>
    </div>
  )

  return (
    <section id={id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      {startsCollapsed ? (
        <details>
          <summary className="cursor-pointer list-none">{heading}</summary>
          <div className="mt-4">{children}</div>
        </details>
      ) : (
        <>
          <div className="mb-4">{heading}</div>
          {children}
        </>
      )}
    </section>
  )
}

export function HarvestReviewSections({
  scanData,
  targetDate,
  disabled = false,
  onDecisionSaved,
}: Props) {
  const [treeSearch, setTreeSearch] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [singlePage, setSinglePage] = useState(1)
  const [exactPage, setExactPage] = useState(1)
  const [conflictPage, setConflictPage] = useState(1)
  const [invalidZeroPage, setInvalidZeroPage] = useState(1)
  const [errorPage, setErrorPage] = useState(1)
  const [cyclePage, setCyclePage] = useState(1)
  const [appliedCorrectionPage, setAppliedCorrectionPage] = useState(1)
  const [openConflictGroupKey, setOpenConflictGroupKey] = useState<string | null>(null)
  const [locationMapGroupKey, setLocationMapGroupKey] = useState<string | null>(null)
  const [conflictDecisionDrafts, setConflictDecisionDrafts] = useState<
    Record<string, ConflictDecisionDraft>
  >({})
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, DecisionDraft>>({})
  const [errorDecisionDrafts, setErrorDecisionDrafts] = useState<
    Record<string, ErrorDecisionDraft>
  >({})
  const [treeMasterOptions, setTreeMasterOptions] = useState<TreeNumberOption[]>([])
  const [treeMasterLoading, setTreeMasterLoading] = useState(false)
  const [treeMasterLoadError, setTreeMasterLoadError] = useState(false)
  const [groupFingerprintStatuses, setGroupFingerprintStatuses] = useState<
    Record<string, FingerprintStatus>
  >({})
  const [decisionSaving, setDecisionSaving] = useState<string | null>(null)
  const [decisionMessages, setDecisionMessages] = useState<Record<string, string>>({})

  const selectedScanId = scanData?.scan.id ?? null
  const buckets = useMemo(
    () =>
      buildReviewBuckets(
        scanData?.items ?? [],
        targetDate,
        scanData?.scan.cycle_no ?? null,
        treeSearch,
        sortDirection,
      ),
    [scanData, sortDirection, targetDate, treeSearch],
  )
  const allDecisionGroups = useMemo(
    () => [...buckets.conflicts, ...buckets.invalidZeroGroups],
    [buckets.conflicts, buckets.invalidZeroGroups],
  )

  const loadTreeMasterOptions = useCallback(async () => {
    setTreeMasterLoading(true)
    setTreeMasterLoadError(false)
    try {
      const response = await fetch("/api/coconut-harvest/tree-master", {
        cache: "no-store",
      })
      const data = (await response.json()) as { treeNumbers?: unknown; error?: string }
      if (
        !response.ok ||
        !Array.isArray(data.treeNumbers) ||
        !data.treeNumbers.every((treeNo) => typeof treeNo === "string")
      ) {
        throw new Error(data.error ?? "Unable to load Tree Numbers from Tree Master.")
      }
      setTreeMasterOptions(
        data.treeNumbers.map((treeNo) => ({
          key: treeNumberOptionKey(treeNo),
          treeNo,
        })),
      )
    } catch {
      setTreeMasterOptions([])
      setTreeMasterLoadError(true)
    } finally {
      setTreeMasterLoading(false)
    }
  }, [])

  useEffect(() => {
    if (
      (buckets.errors.some((item) => item.classification === "UNMATCHED_TREE") ||
        buckets.conflicts.length > 0) &&
      treeMasterOptions.length === 0 &&
      !treeMasterLoading &&
      !treeMasterLoadError
    ) {
      void loadTreeMasterOptions()
    }
  }, [
    buckets.conflicts.length,
    buckets.errors,
    loadTreeMasterOptions,
    treeMasterLoadError,
    treeMasterLoading,
    treeMasterOptions.length,
  ])

  const loadGroupFingerprintStatus = useCallback(
    async (scanId: number, treeNo: string, harvestDate?: string | null) => {
      const dateQuery = harvestDate
        ? `&harvest_date=${encodeURIComponent(displayHarvestDate(harvestDate))}`
        : ""
      const statusKey = groupFingerprintStatusKey(treeNo, harvestDate)
      const response = await fetch(
        `/api/admin/harvest-sync/scans/${scanId}/fingerprint-status?tree_no=${encodeURIComponent(treeNo)}${dateQuery}`,
        { cache: "no-store" },
      )
      const data = (await response.json()) as FingerprintStatus & {
        detail?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(
          data.detail ?? data.error ?? `Tree ${treeNo} fingerprint check returned HTTP ${response.status}.`,
        )
      }
      setGroupFingerprintStatuses((current) => ({ ...current, [statusKey]: data }))
      return data
    },
    [],
  )

  useEffect(() => {
    setSinglePage(1)
    setExactPage(1)
    setConflictPage(1)
    setInvalidZeroPage(1)
    setErrorPage(1)
    setCyclePage(1)
    setAppliedCorrectionPage(1)
    setOpenConflictGroupKey(null)
  }, [selectedScanId, sortDirection, targetDate, treeSearch])

  useEffect(() => {
    setConflictDecisionDrafts({})
    setDecisionDrafts({})
    setErrorDecisionDrafts({})
    setDecisionMessages({})
    setGroupFingerprintStatuses({})
    if (!selectedScanId || !targetDate) return
    for (const { pending } of buckets.cycleCollisions) {
      const treeNo = String(pending.original_tree_no ?? "").trim()
      if (!treeNo) continue
      void loadGroupFingerprintStatus(selectedScanId, treeNo).catch((error) => {
        setDecisionMessages((current) => ({
          ...current,
          [pending.odk_instance_id]:
            error instanceof Error ? error.message : "Unable to verify the cycle-safety group fingerprint.",
        }))
      })
    }
  }, [selectedScanId, targetDate, scanData?.scan.id, loadGroupFingerprintStatus])

  function updateConflictDecisionDraft(
    key: string,
    rows: HarvestScanItem[],
    update: Partial<ConflictDecisionDraft>,
  ) {
    setConflictDecisionDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? storedConflictDecisionDraft(rows)),
        ...update,
      },
    }))
  }

  function updateDecisionDraft(instanceId: string, update: Partial<DecisionDraft>) {
    setDecisionDrafts((current) => ({
      ...current,
      [instanceId]: {
        ...(current[instanceId] ?? EMPTY_DECISION_DRAFT),
        ...update,
      },
    }))
  }

  async function saveConflictDecision(
    group: ReviewGroup,
    openNextUnresolved: boolean,
  ) {
    const { key, rows } = group
    const draft = conflictDecisionDrafts[key] ?? storedConflictDecisionDraft(rows)
    const mixedGroup = mixedValidInvalidZeroGroup(rows)
    const reason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
    const selectedRow = rows.find(
      (row) => String(row.odk_instance_id) === String(draft.selectedInstanceId),
    )
    const correctedTreeNo = draft.correctedTreeNo.trim()
    const validTreeReassignment =
      !mixedGroup &&
      draft.resolutionMode === "REASSIGN_TREE" &&
      selectedRow !== undefined &&
      isActiveValidConflictCandidate(selectedRow) &&
      correctedTreeNo.length > 0 &&
      draft.validatedCorrectedTreeNo === correctedTreeNo &&
      correctedTreeNo !== String(selectedRow.original_tree_no ?? "").trim()
    const decision: ConflictDecisionAction = mixedGroup
      ? draft.action
      : draft.resolutionMode === "REASSIGN_TREE"
        ? "REASSIGN_SUBMISSION_TREE"
        : "SELECT_SUBMISSION"
    const validMixedSelection =
      decision === "RETAIN_VALID_EXCLUDE_INVALID_ZERO"
        ? selectedRow?.odk_instance_id === mixedGroup?.valid.odk_instance_id
        : decision === "DEFER_DECISION"
    const treeNo = String(rows[0]?.original_tree_no ?? "").trim()
    const groupStatus =
      groupFingerprintStatuses[groupFingerprintStatusKey(treeNo, rows[0]?.harvest_date)]
    if (
      disabled ||
      !selectedScanId ||
      (mixedGroup
        ? !validMixedSelection
        : !selectedRow ||
          !isActiveValidConflictCandidate(selectedRow) ||
          (draft.resolutionMode === "REASSIGN_TREE" && !validTreeReassignment) ||
          !draft.resolutionMode) ||
      !reason ||
      groupStatus?.groupMatches !== true
    ) {
      return
    }

    const currentIndex = allDecisionGroups.findIndex((candidate) => candidate.key === key)
    const following = [
      ...allDecisionGroups.slice(currentIndex + 1),
      ...allDecisionGroups.slice(0, Math.max(0, currentIndex)),
    ]
    const nextUnresolved = following.find((candidate) => !conflictGroupResolved(candidate.rows))

    setDecisionSaving(key)
    setDecisionMessages((current) => ({ ...current, [key]: "" }))
    try {
      const payload = mixedGroup
        ? {
            scan_id: selectedScanId,
            odk_instance_id: mixedGroup.valid.odk_instance_id,
            issue_type: "VALID_RECORD_WITH_INVALID_ZERO_SUBMISSION",
            decision,
            selected_effective_instance_id:
              decision === "DEFER_DECISION" ? null : mixedGroup.valid.odk_instance_id,
            reason,
          }
        : {
            scan_id: selectedScanId,
            odk_instance_id: selectedRow?.odk_instance_id,
            issue_type: "CONFLICTING_DUPLICATE",
            decision,
            resolved_tree_no: validTreeReassignment ? correctedTreeNo : null,
            selected_effective_instance_id: selectedRow?.odk_instance_id,
            reason,
          }
      const response = await fetch("/api/admin/harvest-sync/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? `Decision API returned HTTP ${response.status}.`)
      }
      await onDecisionSaved()
      if (openNextUnresolved && nextUnresolved) {
        const nextIndex = allDecisionGroups.findIndex(
          (candidate) => candidate.key === nextUnresolved.key,
        )
        if (nextIndex < buckets.conflicts.length) {
          setConflictPage(Math.floor(nextIndex / REVIEW_GROUP_PAGE_SIZE) + 1)
        } else {
          setInvalidZeroPage(
            Math.floor((nextIndex - buckets.conflicts.length) / REVIEW_GROUP_PAGE_SIZE) + 1,
          )
        }
        setOpenConflictGroupKey(nextUnresolved.key)
      } else {
        setOpenConflictGroupKey(null)
      }
      setDecisionMessages((current) => ({
        ...current,
        [key]:
          openNextUnresolved && nextUnresolved
            ? "Supervisor decision saved. The next unresolved group is open."
            : validTreeReassignment
              ? `Tree Number correction saved: ${displayHarvestValue(selectedRow?.original_tree_no)} → ${correctedTreeNo}. Both valid submissions will be retained.`
              : "Supervisor decision saved.",
      }))
    } catch (error) {
      setDecisionMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "Unable to save the supervisor decision.",
      }))
    } finally {
      setDecisionSaving(null)
    }
  }

  async function saveCycleDecision(
    pending: HarvestScanItem,
    pendingCandidates: HarvestScanItem[],
    hasImportedRecord: boolean,
  ) {
    const savedReason = pending.supervisor_reason ?? ""
    const reasonOptions = hasImportedRecord
      ? [...SUPERVISOR_REASONS]
      : pendingCycleSupervisorReasons(pendingCandidates)
    const savedReasonIsChoice = reasonOptions.some((reason) => reason === savedReason)
    const fallbackDraft: DecisionDraft = {
      action: normalizedCycleDecisionActionForTarget(
        pending.supervisor_decision,
        pending.selected_effective_instance_id,
        pendingCandidates,
        targetDate,
      ),
      selectedInstanceId:
        pending.selected_effective_instance_id ??
        (pendingCandidates.length === 1 ? pendingCandidates[0].odk_instance_id : ""),
      reason: savedReason ? (savedReasonIsChoice ? savedReason : "Other") : "",
      otherReason: savedReasonIsChoice ? "" : savedReason,
    }
    const draft = decisionDrafts[pending.odk_instance_id] ?? fallbackDraft
    const reason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
    const treeNo = String(pending.original_tree_no ?? "").trim()
    const groupStatus = groupFingerprintStatuses[groupFingerprintStatusKey(treeNo)]
    const selectedPending = pendingCandidates.find(
      (candidate) => candidate.odk_instance_id === draft.selectedInstanceId,
    )
    const targetDatePendingCandidates = pendingCandidates.filter(
      (candidate) => displayHarvestDate(candidate.harvest_date) === targetDate,
    )
    const targetDateAnchor =
      targetDatePendingCandidates.length === 1 ? targetDatePendingCandidates[0] : null
    const selectedIsTargetDate = Boolean(
      selectedPending && displayHarvestDate(selectedPending.harvest_date) === targetDate,
    )
    const validPendingCycleSelection = Boolean(
      selectedPending &&
        isActiveValidConflictCandidate(selectedPending) &&
        ((draft.action === "RETAIN_PENDING_CYCLE_SUBMISSION" && selectedIsTargetDate) ||
          (draft.action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE" &&
            !selectedIsTargetDate &&
            targetDateAnchor !== null)),
    )
    if (
      disabled ||
      !draft.action ||
      ((draft.action === "USE_PENDING_SUBMISSION" ||
        draft.action === "RETAIN_PENDING_CYCLE_SUBMISSION" ||
        draft.action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE") &&
        (!selectedPending || !isActiveValidConflictCandidate(selectedPending))) ||
      (!hasImportedRecord &&
        ((draft.action === "DEFER_DECISION" && targetDateAnchor === null) ||
          (draft.action !== "DEFER_DECISION" && !validPendingCycleSelection))) ||
      !reason ||
      groupStatus?.groupMatches !== true ||
      !selectedScanId
    ) {
      return
    }
    const decisionAnchorInstanceId =
      draft.action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE" ||
      (!hasImportedRecord && draft.action === "DEFER_DECISION")
        ? targetDateAnchor?.odk_instance_id
        : draft.action === "USE_PENDING_SUBMISSION" ||
            draft.action === "RETAIN_PENDING_CYCLE_SUBMISSION"
          ? selectedPending?.odk_instance_id
          : pending.odk_instance_id
    setDecisionSaving(pending.odk_instance_id)
    setDecisionMessages((current) => ({ ...current, [pending.odk_instance_id]: "" }))
    try {
      const response = await fetch("/api/admin/harvest-sync/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: selectedScanId,
          odk_instance_id: decisionAnchorInstanceId,
          issue_type: hasImportedRecord
            ? "CYCLE_COLLISION"
            : "PENDING_CROSS_DATE_CYCLE_COLLISION",
          decision: draft.action,
          selected_effective_instance_id:
            draft.action === "USE_PENDING_SUBMISSION" ||
            draft.action === "RETAIN_PENDING_CYCLE_SUBMISSION" ||
            draft.action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE"
              ? selectedPending?.odk_instance_id
              : null,
          reason,
        }),
      })
      const result = (await response.json()) as { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? `Decision API returned HTTP ${response.status}.`)
      }
      await onDecisionSaved()
      setDecisionMessages((current) => ({
        ...current,
        [pending.odk_instance_id]: "Supervisor decision saved.",
      }))
    } catch (error) {
      setDecisionMessages((current) => ({
        ...current,
        [pending.odk_instance_id]:
          error instanceof Error ? error.message : "Unable to save the supervisor decision.",
      }))
    } finally {
      setDecisionSaving(null)
    }
  }

  function errorDecisionDraft(row: HarvestScanItem): ErrorDecisionDraft {
    const savedAction =
      row.supervisor_decision === "MAP_TO_EXISTING_TREE" ||
      row.supervisor_decision === "DEFER_DECISION"
        ? row.supervisor_decision
        : ""
    return {
      action: savedAction,
      resolvedTreeNo: row.supervisor_resolved_tree_no ?? "",
      validatedTreeNo:
        savedAction === "MAP_TO_EXISTING_TREE"
          ? row.supervisor_resolved_tree_no ?? ""
          : "",
      reason: row.supervisor_reason ?? "",
    }
  }

  function updateErrorDecisionDraft(
    row: HarvestScanItem,
    update: Partial<ErrorDecisionDraft>,
  ) {
    setErrorDecisionDrafts((current) => ({
      ...current,
      [row.odk_instance_id]: {
        ...(current[row.odk_instance_id] ?? errorDecisionDraft(row)),
        ...update,
      },
    }))
  }

  async function saveDataErrorDecision(row: HarvestScanItem) {
    const draft = errorDecisionDrafts[row.odk_instance_id] ?? errorDecisionDraft(row)
    const target = draft.resolvedTreeNo.trim()
    const reason = draft.reason.trim()
    const treeNo = String(row.original_tree_no ?? "").trim()
    const fingerprintKey = groupFingerprintStatusKey(treeNo, row.harvest_date)
    const groupStatus = groupFingerprintStatuses[fingerprintKey]
    const mapIsValid =
      draft.action === "MAP_TO_EXISTING_TREE" &&
      row.classification === "UNMATCHED_TREE" &&
      target &&
      draft.validatedTreeNo === target
    const deferIsValid = draft.action === "DEFER_DECISION"
    if (
      disabled ||
      !selectedScanId ||
      !reason ||
      (!mapIsValid && !deferIsValid) ||
      groupStatus?.groupMatches !== true
    ) {
      return
    }
    setDecisionSaving(row.odk_instance_id)
    setDecisionMessages((current) => ({ ...current, [row.odk_instance_id]: "" }))
    try {
      const response = await fetch("/api/admin/harvest-sync/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: selectedScanId,
          odk_instance_id: row.odk_instance_id,
          issue_type: row.issue_type ?? row.classification,
          decision: draft.action,
          resolved_tree_no: mapIsValid ? target : null,
          selected_effective_instance_id: null,
          reason,
        }),
      })
      const result = (await response.json()) as { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? `Decision API returned HTTP ${response.status}.`)
      }
      await onDecisionSaved()
      setDecisionMessages((current) => ({
        ...current,
        [row.odk_instance_id]:
          mapIsValid
            ? `Mapping decision saved. Original submitted value ${displayHarvestValue(row.original_tree_no)} remains in the audit.`
            : "Deferred decision saved. This record remains blocked.",
      }))
    } catch (error) {
      setDecisionMessages((current) => ({
        ...current,
        [row.odk_instance_id]:
          error instanceof Error ? error.message : "Unable to save the data-error decision.",
      }))
    } finally {
      setDecisionSaving(null)
    }
  }

  function renderDecisionGroup(group: ReviewGroup) {
    const { key, rows } = group
    const first = rows[0]
    const treeNo = String(first.original_tree_no ?? "").trim()
    const mixedGroup = mixedValidInvalidZeroGroup(rows)
    const decisionRow = rows.find((row) =>
      SAVED_CONFLICT_DECISIONS.has(String(row.supervisor_decision ?? "")),
    )
    const draft = conflictDecisionDrafts[key] ?? storedConflictDecisionDraft(rows)
    const fingerprintKey = groupFingerprintStatusKey(treeNo, first.harvest_date)
    const groupStatus = groupFingerprintStatuses[fingerprintKey]
    const finalReason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
    const selectedCandidate = rows.find(
      (row) => String(row.odk_instance_id) === String(draft.selectedInstanceId),
    )
    const correctedTreeNo = draft.correctedTreeNo.trim()
    const validTreeReassignment =
      !mixedGroup &&
      draft.resolutionMode === "REASSIGN_TREE" &&
      Boolean(selectedCandidate && isActiveValidConflictCandidate(selectedCandidate)) &&
      correctedTreeNo.length > 0 &&
      draft.validatedCorrectedTreeNo === correctedTreeNo &&
      correctedTreeNo !== String(selectedCandidate?.original_tree_no ?? "").trim()
    const canSave =
      !disabled &&
      (mixedGroup
        ? (draft.action === "RETAIN_VALID_EXCLUDE_INVALID_ZERO" &&
            selectedCandidate?.odk_instance_id === mixedGroup.valid.odk_instance_id) ||
          draft.action === "DEFER_DECISION"
        : Boolean(
            draft.resolutionMode &&
              selectedCandidate &&
              isActiveValidConflictCandidate(selectedCandidate) &&
              (draft.resolutionMode !== "REASSIGN_TREE" || validTreeReassignment),
          )) &&
      Boolean(finalReason) &&
      groupStatus?.groupMatches === true &&
      decisionSaving !== key

    return (
      <details
        key={key}
        open={openConflictGroupKey === key}
        onToggle={(event) => {
          if (event.currentTarget.open) {
            setOpenConflictGroupKey(key)
            if (selectedScanId && treeNo && !groupFingerprintStatuses[fingerprintKey]) {
              void loadGroupFingerprintStatus(selectedScanId, treeNo, first.harvest_date).catch(
                (error) => {
                  setDecisionMessages((current) => ({
                    ...current,
                    [key]:
                      error instanceof Error
                        ? error.message
                        : "Unable to verify the group fingerprint.",
                  }))
                },
              )
            }
          } else if (openConflictGroupKey === key) {
            setOpenConflictGroupKey(null)
          }
        }}
        className="rounded-xl border bg-background"
        data-testid={`review-group-${key}`}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
          Tree {displayHarvestValue(first.original_tree_no)} · {displayHarvestDate(first.harvest_date)} ·{" "}
          {rows.length} source submissions
          {decisionRow?.supervisor_decision ? " · Supervisor decision saved" : ""}
        </summary>
        <div className="border-t p-4">
          {decisionRow?.supervisor_decision ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
              <p className="font-black">Saved supervisor decision: {decisionRow.supervisor_decision}</p>
              <p className="mt-1">
                {decisionRow.supervisor_decision === "REASSIGN_SUBMISSION_TREE"
                  ? "Corrected submission: "
                  : "Selected: "}
                <span className="font-mono">{selectedConflictInstance(decisionRow) ?? "—"}</span>
              </p>
              {decisionRow.supervisor_decision === "REASSIGN_SUBMISSION_TREE" ? (
                <p className="mt-1 font-bold">
                  Tree {displayHarvestValue(decisionRow.original_tree_no)} →{" "}
                  {displayHarvestValue(decisionRow.supervisor_resolved_tree_no)} · both submissions retained
                </p>
              ) : null}
              <p className="mt-1">Reason: {decisionRow.supervisor_reason ?? "—"}</p>
              <p className="mt-1">
                Supervisor: {displayHarvestValue(decisionRow.supervisor_admin_user)} ·{" "}
                {displayHarvestValue(
                  decisionRow.supervisor_decision_updated_at ??
                    decisionRow.supervisor_decision_at,
                )}
              </p>
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setLocationMapGroupKey((current) => (current === key ? null : key))
              }
              className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-black hover:border-primary/50"
              aria-expanded={locationMapGroupKey === key}
            >
              <MapPinned className="size-4" aria-hidden="true" />
              {locationMapGroupKey === key ? "Hide location map" : "View submissions on map"}
            </button>
            <span className="text-xs font-semibold text-muted-foreground">
              {rows.filter((row) => submissionLocationLabel(row) !== "No GPS").length} of {rows.length} submissions have a location
            </span>
          </div>
          {locationMapGroupKey === key ? (
            <HarvestLocationComparisonMap
              rows={rows}
              correctedTreeNo={
                draft.validatedCorrectedTreeNo === draft.correctedTreeNo.trim()
                  ? draft.correctedTreeNo.trim()
                  : null
              }
            />
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">
                    {draft.resolutionMode === "REASSIGN_TREE" ? "Correct" : "Retain"}
                  </th>
                  <th className="p-2">Tree</th>
                  <th className="p-2">Harvest Date</th>
                  <th className="p-2">ODK Time</th>
                  <th className="p-2">ODK Instance ID</th>
                  <th className="p-2">Submitter / Device</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">B1</th>
                  <th className="p-2">B2</th>
                  <th className="p-2">B3</th>
                  <th className="p-2">Bunch Count</th>
                  <th className="p-2">Total Nuts</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const invalidZero = Boolean(
                    mixedGroup?.invalid.some(
                      (candidate) => candidate.odk_instance_id === row.odk_instance_id,
                    ),
                  )
                  const effectiveClassification = invalidZero
                    ? "INVALID_DATA"
                    : row.effective_classification ?? row.classification
                  return (
                    <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                      <td className="p-2">
                        {invalidZero ? (
                          <span className="font-bold text-muted-foreground">Not selectable</span>
                        ) : (
                          <label className="inline-flex items-center gap-2 font-bold">
                            <input
                              type="radio"
                              name={`review-${key}`}
                              checked={String(draft.selectedInstanceId) === String(row.odk_instance_id)}
                              onChange={() =>
                                updateConflictDecisionDraft(key, rows, {
                                  selectedInstanceId: row.odk_instance_id,
                                })
                              }
                              disabled={
                                disabled ||
                                decisionSaving !== null ||
                                !isActiveValidConflictCandidate(row) ||
                                groupStatus?.groupMatches !== true
                              }
                              aria-label={`Retain ODK instance ${row.odk_instance_id} for Tree ${displayHarvestValue(row.original_tree_no)}`}
                            />
                            {draft.resolutionMode === "REASSIGN_TREE" ? "Correct" : "Retain"}
                          </label>
                        )}
                      </td>
                      <td className="p-2 font-bold">{displayHarvestValue(row.original_tree_no)}</td>
                      <td className="p-2">{displayHarvestDate(row.harvest_date)}</td>
                      <td className="p-2">{formatIstDateTime(row.odk_submission_timestamp)}</td>
                      <td className="p-2 font-mono">{row.odk_instance_id}</td>
                      <td className="p-2">
                        {displayHarvestValue(row.submitter_name)} / {displayHarvestValue(row.device_id)}
                      </td>
                      <td className="p-2 font-semibold">{submissionLocationLabel(row)}</td>
                      <td className="p-2">{displayHarvestValue(row.b1)}</td>
                      <td className="p-2">{displayHarvestValue(row.b2)}</td>
                      <td className="p-2">{displayHarvestValue(row.b3)}</td>
                      <td className="p-2">{displayHarvestValue(row.total_bunches)}</td>
                      <td className="p-2">{displayHarvestValue(row.total_nuts)}</td>
                      <td className="p-2">
                        <span className={`rounded-full border px-2 py-1 ${statusBadge(effectiveClassification)}`}>
                          {invalidZero ? "INVALID DATA" : effectiveClassification}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={`mt-4 grid gap-3 ${mixedGroup ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {mixedGroup ? (
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Supervisor Action
                <select
                  aria-label={`Supervisor Action for invalid-zero Tree ${displayHarvestValue(first.original_tree_no)}`}
                  value={draft.action}
                  onChange={(event) =>
                    updateConflictDecisionDraft(key, rows, {
                      action: event.target.value as ConflictDecisionAction,
                    })
                  }
                  disabled={disabled}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                >
                  <option value="">Select Supervisor Action</option>
                  <option value="RETAIN_VALID_EXCLUDE_INVALID_ZERO">
                    Retain valid submission and exclude invalid zero submission
                  </option>
                  <option value="DEFER_DECISION">Defer for field verification</option>
                </select>
              </label>
            ) : null}
            {!mixedGroup ? (
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Resolution
                <select
                  aria-label={`Resolution for Tree ${displayHarvestValue(first.original_tree_no)}`}
                  value={draft.resolutionMode}
                  onChange={(event) =>
                    updateConflictDecisionDraft(key, rows, {
                      resolutionMode: event.target.value as ConflictResolutionMode,
                      action:
                        event.target.value === "REASSIGN_TREE"
                          ? "REASSIGN_SUBMISSION_TREE"
                          : "SELECT_SUBMISSION",
                      correctedTreeNo: "",
                      validatedCorrectedTreeNo: "",
                    })
                  }
                  disabled={disabled}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                >
                  <option value="">Select resolution</option>
                  <option value="RETAIN_ONE">Same tree — retain one submission</option>
                  <option value="REASSIGN_TREE">Different trees — correct TreeNo and retain both</option>
                </select>
              </label>
            ) : null}
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Supervisor Reason
              <select
                aria-label={`Supervisor Reason for Tree ${displayHarvestValue(first.original_tree_no)}`}
                value={draft.reason}
                onChange={(event) =>
                  updateConflictDecisionDraft(key, rows, {
                    reason: event.target.value,
                    otherReason: event.target.value === "Other" ? draft.otherReason : "",
                  })
                }
                disabled={disabled}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
              >
                <option value="">Select Supervisor Reason</option>
                {(mixedGroup ? INVALID_ZERO_SUPERVISOR_REASONS : CONFLICT_SUPERVISOR_REASONS).map(
                  (reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs font-semibold">
              {groupStatus?.groupMatches === true
                ? "Group fingerprint unchanged. The decision may be saved."
                : groupStatus?.groupMatches === false
                  ? "This group changed after the scan. Run Scan ODK and review it again."
                  : "Open this group to verify its fingerprint."}
            </div>
          </div>
          {draft.reason === "Other" ? (
            <label className="mt-3 block text-xs font-bold uppercase text-muted-foreground">
              Other reason details
              <textarea
                value={draft.otherReason}
                onChange={(event) =>
                  updateConflictDecisionDraft(key, rows, { otherReason: event.target.value })
                }
                disabled={disabled}
                className="mt-1 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                required
              />
            </label>
          ) : null}
          {!mixedGroup && draft.resolutionMode === "REASSIGN_TREE" ? (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-black uppercase text-muted-foreground">
                Correct selected submission to an exact Tree Master number
              </p>
              <div className="mt-2">
                <TreeNumberAutocomplete
                  id={`conflict-tree-correction-${first.id}`}
                  value={draft.correctedTreeNo}
                  options={treeMasterOptions}
                  loading={treeMasterLoading}
                  loadError={treeMasterLoadError}
                  disabled={disabled || !selectedCandidate}
                  placeholder="Search the correct Tree Number"
                  onValueChange={(value) =>
                    updateConflictDecisionDraft(key, rows, {
                      correctedTreeNo: value,
                      validatedCorrectedTreeNo: "",
                    })
                  }
                  onSelect={(option) =>
                    updateConflictDecisionDraft(key, rows, {
                      correctedTreeNo: option.treeNo,
                      validatedCorrectedTreeNo: option.treeNo,
                      reason: "Tree number entered incorrectly",
                      otherReason: "",
                    })
                  }
                  onInvalidCommit={(value) => {
                    updateConflictDecisionDraft(key, rows, {
                      correctedTreeNo: value,
                      validatedCorrectedTreeNo: "",
                    })
                    setDecisionMessages((current) => ({
                      ...current,
                      [key]: "Select an exact Tree Number from Tree Master.",
                    }))
                  }}
                  onRetry={() => void loadTreeMasterOptions()}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <p className="rounded-lg border bg-background p-3 text-xs">
                  <span className="block font-bold uppercase text-muted-foreground">Original ODK TreeNo</span>
                  <span className="mt-1 block text-base font-black">
                    {displayHarvestValue(selectedCandidate?.original_tree_no)}
                  </span>
                </p>
                <p className="rounded-lg border border-primary/30 bg-background p-3 text-xs">
                  <span className="block font-bold uppercase text-muted-foreground">Corrected effective TreeNo</span>
                  <span className="mt-1 block text-base font-black">
                    {validTreeReassignment ? correctedTreeNo : "—"}
                  </span>
                </p>
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                The original ODK value and Instance ID remain unchanged in the audit. The selected submission receives the corrected effective TreeNo; the other valid submission remains on Tree {displayHarvestValue(first.original_tree_no)}.
              </p>
            </div>
          ) : null}
          {mixedGroup && draft.action === "RETAIN_VALID_EXCLUDE_INVALID_ZERO" ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
              The valid submission stays in the proposed import set.{" "}
              {mixedGroup.invalid.length.toLocaleString("en-IN")} all-zero invalid{" "}
              {mixedGroup.invalid.length === 1 ? "submission is" : "submissions are"} preserved in
              the audit and excluded under RETAIN_VALID_EXCLUDE_INVALID_ZERO.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveConflictDecision(group, false)}
              disabled={!canSave}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {decisionSaving === key ? "Saving…" : "Save Supervisor Decision"}
            </button>
            <button
              type="button"
              onClick={() => void saveConflictDecision(group, true)}
              disabled={!canSave}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-black text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {decisionSaving === key ? "Saving…" : "Save and Open Next Unresolved"}
            </button>
            <span className="text-xs font-semibold text-muted-foreground">
              This saves only the reconciliation decision. It does not write a Harvest record.
            </span>
          </div>
          {decisionMessages[key] ? (
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mt-3 text-xs font-bold"
            >
              {decisionMessages[key]}
            </p>
          ) : null}
        </div>
      </details>
    )
  }

  const visibleSingles = buckets.cleanSingles.slice(
    (singlePage - 1) * REVIEW_ROW_PAGE_SIZE,
    singlePage * REVIEW_ROW_PAGE_SIZE,
  )
  const visibleExact = buckets.exactGroups.slice(
    (exactPage - 1) * REVIEW_ROW_PAGE_SIZE,
    exactPage * REVIEW_ROW_PAGE_SIZE,
  )
  const visibleConflicts = buckets.conflicts.slice(
    (conflictPage - 1) * REVIEW_GROUP_PAGE_SIZE,
    conflictPage * REVIEW_GROUP_PAGE_SIZE,
  )
  const visibleInvalidZero = buckets.invalidZeroGroups.slice(
    (invalidZeroPage - 1) * REVIEW_GROUP_PAGE_SIZE,
    invalidZeroPage * REVIEW_GROUP_PAGE_SIZE,
  )
  const visibleErrors = buckets.errors.slice(
    (errorPage - 1) * REVIEW_ROW_PAGE_SIZE,
    errorPage * REVIEW_ROW_PAGE_SIZE,
  )
  const visibleCycle = buckets.cycleCollisions.slice(
    (cyclePage - 1) * REVIEW_GROUP_PAGE_SIZE,
    cyclePage * REVIEW_GROUP_PAGE_SIZE,
  )
  const visibleAppliedCorrections = buckets.appliedCorrections.slice(
    (appliedCorrectionPage - 1) * REVIEW_ROW_PAGE_SIZE,
    appliedCorrectionPage * REVIEW_ROW_PAGE_SIZE,
  )

  if (!scanData || !targetDate) {
    return (
      <p className="rounded-xl border p-4 text-sm font-semibold text-muted-foreground">
        Select a persisted scan and Harvest date to open the review sections.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[1fr_14rem]">
        <div className="text-xs font-bold uppercase text-muted-foreground">
          <label htmlFor="harvest-review-tree-search">Tree Number Search</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              id="harvest-review-tree-search"
              value={treeSearch}
              onChange={(event) => setTreeSearch(event.target.value)}
              placeholder="For example, 243 or 845.1"
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm text-foreground"
            />
          </div>
        </div>
        <div className="text-xs font-bold uppercase text-muted-foreground">
          <label htmlFor="harvest-review-tree-sort">Tree Sort</label>
          <select
            id="harvest-review-tree-sort"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="asc">Natural ascending</option>
            <option value="desc">Natural descending</option>
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <p className="rounded-lg border p-2 text-xs"><span className="block font-black">{buckets.cleanSingles.length}</span> clean singles</p>
        <p className="rounded-lg border p-2 text-xs"><span className="block font-black">{buckets.exactGroups.length}</span> exact groups</p>
        <p className="rounded-lg border p-2 text-xs"><span className="block font-black">{buckets.conflicts.length}</span> conflicts</p>
        <p className="rounded-lg border p-2 text-xs"><span className="block font-black">{buckets.invalidZeroGroups.length}</span> invalid-zero groups</p>
        <p className="rounded-lg border p-2 text-xs"><span className="block font-black">{buckets.errors.length}</span> data errors</p>
        <p className="rounded-lg border p-2 text-xs"><span className="block font-black">{buckets.cycleCollisions.length}</span> cycle-safety groups</p>
      </div>

      {buckets.appliedCorrections.length > 0 ? (
        <ReviewSection
          id="review-applied-corrections"
          title="Controlled Harvest corrections — applied audit"
          icon={History}
          count={buckets.appliedCorrections.length}
          collapsedByDefault
        >
          <p className="mb-3 text-sm font-semibold text-muted-foreground">
            Completed replacements are audit history only. They are excluded from actionable conflicts, errors and Cycle-safety counts.
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Correction Run</th>
                  <th className="p-2">Tree</th>
                  <th className="p-2">Harvest Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">ODK Instance</th>
                  <th className="p-2">Audit</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppliedCorrections.map(({ key, runId, row }) => (
                  <tr key={key} className="border-b bg-background">
                    <td className="p-2 font-black">{runId}</td>
                    <td className="p-2 font-black">{displayHarvestValue(row.original_tree_no)}</td>
                    <td className="p-2">{displayHarvestDate(row.harvest_date)}</td>
                    <td className="p-2 font-black text-emerald-700">CORRECTION APPLIED</td>
                    <td className="p-2 font-mono">{row.odk_instance_id}</td>
                    <td className="p-2">
                      <a
                        href={`/api/admin/harvest-sync/controlled-replacements/${runId}/audit.csv`}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-black"
                      >
                        <Download className="size-3.5" aria-hidden="true" /> Download audit CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={appliedCorrectionPage}
            pageCount={Math.max(1, Math.ceil(buckets.appliedCorrections.length / REVIEW_ROW_PAGE_SIZE))}
            total={buckets.appliedCorrections.length}
            unit="corrections"
            onPageChange={setAppliedCorrectionPage}
          />
        </ReviewSection>
      ) : null}

      <ReviewSection id="review-clean-singles" title="Clean single submissions — standing-rule ready" icon={CheckCircle2} count={buckets.cleanSingles.length}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Each valid one-submission group is included as SINGLE_VALID_AUTO_READY without a separate decision.
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[1050px] text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Tree</th><th className="p-2">Date</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">ODK Time</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Status</th></tr></thead>
            <tbody>
              {visibleSingles.map((row) => (
                <tr key={row.odk_instance_id} className="border-b">
                  <td className="p-2 font-bold">{displayHarvestValue(row.original_tree_no)}</td>
                  <td className="p-2">{displayHarvestDate(row.harvest_date)}</td>
                  <td className="p-2 font-mono">{row.odk_instance_id}</td>
                  <td className="p-2">{displayHarvestValue(row.submitter_name)} / {displayHarvestValue(row.device_id)}</td>
                  <td className="p-2">{formatIstDateTime(row.odk_submission_timestamp)}</td>
                  <td className="p-2">{displayHarvestValue(row.b1)}</td>
                  <td className="p-2">{displayHarvestValue(row.b2)}</td>
                  <td className="p-2">{displayHarvestValue(row.b3)}</td>
                  <td className="p-2">{displayHarvestValue(row.total_bunches)}</td>
                  <td className="p-2">{displayHarvestValue(row.total_nuts)}</td>
                  <td className="p-2 font-bold">SINGLE_VALID_AUTO_READY</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {buckets.cleanSingles.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No clean singles match the current filter.</p> : null}
        <Pagination page={singlePage} pageCount={Math.max(1, Math.ceil(buckets.cleanSingles.length / REVIEW_ROW_PAGE_SIZE))} total={buckets.cleanSingles.length} unit="records" onPageChange={setSinglePage} />
      </ReviewSection>

      <ReviewSection id="review-exact-duplicates" title="Exact duplicates — standing-rule resolved" icon={ShieldCheck} count={buckets.exactGroups.length}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          The earliest valid submission is retained; equal timestamps use the lexicographically lowest ODK instance ID.
        </p>
        <div className="space-y-2">
          {visibleExact.map((group) => (
            <details key={group.key} className="rounded-xl border bg-background">
              <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                Tree {displayHarvestValue(group.retained.original_tree_no)} · {displayHarvestDate(group.retained.harvest_date)} · {group.superseded.length} excluded
              </summary>
              <div className="overflow-x-auto border-t p-3">
                <table className="min-w-[900px] text-left text-xs">
                  <thead><tr className="border-b"><th className="p-2">Disposition</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">ODK Time</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th></tr></thead>
                  <tbody>
                    {[group.retained, ...group.superseded].map((row) => (
                      <tr key={row.odk_instance_id} className="border-b">
                        <td className="p-2 font-bold">{row === group.retained ? "Retained" : "Excluded"}</td>
                        <td className="p-2 font-mono">{row.odk_instance_id}</td>
                        <td className="p-2">{displayHarvestValue(row.submitter_name)} / {displayHarvestValue(row.device_id)}</td>
                        <td className="p-2">{formatIstDateTime(row.odk_submission_timestamp)}</td>
                        <td className="p-2">{displayHarvestValue(row.b1)}</td>
                        <td className="p-2">{displayHarvestValue(row.b2)}</td>
                        <td className="p-2">{displayHarvestValue(row.b3)}</td>
                        <td className="p-2">{displayHarvestValue(row.total_bunches)}</td>
                        <td className="p-2">{displayHarvestValue(row.total_nuts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
        {buckets.exactGroups.length === 0 ? <p className="text-sm text-muted-foreground">No exact-duplicate groups match the current filter.</p> : null}
        <Pagination page={exactPage} pageCount={Math.max(1, Math.ceil(buckets.exactGroups.length / REVIEW_ROW_PAGE_SIZE))} total={buckets.exactGroups.length} unit="groups" onPageChange={setExactPage} />
      </ReviewSection>

      <ReviewSection id="review-conflicts" title="Conflicting duplicate submissions" icon={AlertTriangle} count={buckets.conflicts.length}>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs"><span className="font-black">{buckets.conflicts.filter((group) => conflictGroupResolved(group.rows)).length}</span> resolved</p>
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs"><span className="font-black">{buckets.conflicts.filter((group) => !conflictGroupResolved(group.rows)).length}</span> unresolved</p>
        </div>
        <div className="space-y-3">{visibleConflicts.map(renderDecisionGroup)}</div>
        {buckets.conflicts.length === 0 ? <p className="text-sm text-muted-foreground">No conflicting groups match the current filter.</p> : null}
        <Pagination page={conflictPage} pageCount={Math.max(1, Math.ceil(buckets.conflicts.length / REVIEW_GROUP_PAGE_SIZE))} total={buckets.conflicts.length} unit="groups" onPageChange={setConflictPage} />
      </ReviewSection>

      <ReviewSection id="review-invalid-zero" title="Valid records with invalid-zero duplicates" icon={AlertTriangle} count={buckets.invalidZeroGroups.length}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Retain the sole valid submission and exclude only all-zero invalid submissions under RETAIN_VALID_EXCLUDE_INVALID_ZERO.
        </p>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs"><span className="font-black">{buckets.invalidZeroGroups.filter((group) => invalidZeroGroupResolved(group.rows)).length}</span> resolved</p>
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs"><span className="font-black">{buckets.invalidZeroGroups.filter((group) => !invalidZeroGroupResolved(group.rows)).length}</span> unresolved</p>
        </div>
        <div className="space-y-3">{visibleInvalidZero.map(renderDecisionGroup)}</div>
        {buckets.invalidZeroGroups.length === 0 ? <p className="text-sm text-muted-foreground">No invalid-zero groups match the current filter.</p> : null}
        <Pagination page={invalidZeroPage} pageCount={Math.max(1, Math.ceil(buckets.invalidZeroGroups.length / REVIEW_GROUP_PAGE_SIZE))} total={buckets.invalidZeroGroups.length} unit="groups" onPageChange={setInvalidZeroPage} />
      </ReviewSection>

      <ReviewSection id="review-data-errors" title="Tree number and data errors — correction required" icon={AlertTriangle} count={buckets.errors.length}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          An unmatched submitted Tree Number may be mapped only to an exact Tree Master value. The original submitted value is always preserved. Other error classes can only be deferred and remain blocked.
        </p>
        <div className="space-y-3">
          {visibleErrors.map((row) => {
            const draft = errorDecisionDrafts[row.odk_instance_id] ?? errorDecisionDraft(row)
            const treeNo = String(row.original_tree_no ?? "").trim()
            const fingerprintKey = groupFingerprintStatusKey(treeNo, row.harvest_date)
            const groupStatus = groupFingerprintStatuses[fingerprintKey]
            const target = draft.resolvedTreeNo.trim()
            const mapIsValid =
              row.classification === "UNMATCHED_TREE" &&
              draft.action === "MAP_TO_EXISTING_TREE" &&
              target.length > 0 &&
              draft.validatedTreeNo === target
            const deferIsValid = draft.action === "DEFER_DECISION"
            const canSave =
              !disabled &&
              Boolean(draft.reason.trim()) &&
              (mapIsValid || deferIsValid) &&
              groupStatus?.groupMatches === true &&
              decisionSaving !== row.odk_instance_id
            return (
              <details
                key={row.odk_instance_id}
                className="rounded-xl border bg-background"
                onToggle={(event) => {
                  if (
                    event.currentTarget.open &&
                    selectedScanId &&
                    treeNo &&
                    !groupFingerprintStatuses[fingerprintKey]
                  ) {
                    void loadGroupFingerprintStatus(
                      selectedScanId,
                      treeNo,
                      row.harvest_date,
                    ).catch((error) => {
                      setDecisionMessages((current) => ({
                        ...current,
                        [row.odk_instance_id]:
                          error instanceof Error
                            ? error.message
                            : "Unable to verify the source group fingerprint.",
                      }))
                    })
                  }
                }}
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Submitted Tree {displayHarvestValue(row.original_tree_no)} ·{" "}
                  {displayHarvestDate(row.harvest_date)} · {row.classification}
                  {row.supervisor_decision ? " · Supervisor decision saved" : ""}
                </summary>
                <div className="border-t p-4">
                  <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">
                        Original submitted Tree Number
                      </span>
                      <span className="font-black">{displayHarvestValue(row.original_tree_no)}</span>
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">Harvest Date</span>
                      {displayHarvestDate(row.harvest_date)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">ODK Time</span>
                      {formatIstDateTime(row.odk_submission_timestamp)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">ODK Instance</span>
                      <span className="font-mono">{row.odk_instance_id}</span>
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">Submitter / Device</span>
                      {displayHarvestValue(row.submitter_name)} / {displayHarvestValue(row.device_id)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">Bunch Count</span>
                      {displayHarvestValue(row.total_bunches)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">B1</span>
                      {displayHarvestValue(row.b1)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">B2</span>
                      {displayHarvestValue(row.b2)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">B3</span>
                      {displayHarvestValue(row.b3)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">Total Nuts</span>
                      {displayHarvestValue(row.total_nuts)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">Exact error</span>
                      {displayHarvestValue(row.note)}
                    </p>
                    <p className="rounded-lg border p-2">
                      <span className="block font-bold uppercase text-muted-foreground">Exists in Tree Master</span>
                      {row.tree_exists_in_master === true
                        ? "Yes"
                        : row.tree_exists_in_master === false
                          ? "No"
                          : "—"}
                    </p>
                  </div>
                  {row.supervisor_decision ? (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
                      Saved: {row.supervisor_decision} — {row.supervisor_reason ?? "—"} ·{" "}
                      {displayHarvestValue(row.supervisor_admin_user)} ·{" "}
                      {displayHarvestValue(
                        row.supervisor_decision_updated_at ?? row.supervisor_decision_at,
                      )}
                    </p>
                  ) : null}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Supervisor Action
                      <select
                        value={draft.action}
                        onChange={(event) =>
                          updateErrorDecisionDraft(row, {
                            action: event.target.value as ErrorDecisionAction,
                            resolvedTreeNo: "",
                            validatedTreeNo: "",
                          })
                        }
                        disabled={disabled}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                      >
                        <option value="">Select Supervisor Action</option>
                        {row.classification === "UNMATCHED_TREE" ? (
                          <option value="MAP_TO_EXISTING_TREE">Map to exact existing Tree Number</option>
                        ) : null}
                        <option value="DEFER_DECISION">Defer and keep blocked</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Mandatory Supervisor Reason
                      <textarea
                        value={draft.reason}
                        onChange={(event) =>
                          updateErrorDecisionDraft(row, { reason: event.target.value })
                        }
                        disabled={disabled}
                        className="mt-1 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                      />
                    </label>
                  </div>
                  {draft.action === "MAP_TO_EXISTING_TREE" ? (
                    <div className="mt-3 rounded-xl border p-3">
                      <label
                        htmlFor={`tree-master-correction-${row.id}`}
                        className="text-xs font-bold uppercase text-muted-foreground"
                      >
                        Searchable exact Tree Master selector
                      </label>
                      <div className="mt-1">
                        <TreeNumberAutocomplete
                          id={`tree-master-correction-${row.id}`}
                          value={draft.resolvedTreeNo}
                          options={treeMasterOptions}
                          loading={treeMasterLoading}
                          loadError={treeMasterLoadError}
                          disabled={disabled}
                          placeholder="Search an exact Tree Master number"
                          onValueChange={(value) =>
                            updateErrorDecisionDraft(row, {
                              resolvedTreeNo: value,
                              validatedTreeNo: "",
                            })
                          }
                          onSelect={(option) => {
                            updateErrorDecisionDraft(row, {
                              resolvedTreeNo: option.treeNo,
                              validatedTreeNo: option.treeNo,
                            })
                            setDecisionMessages((current) => ({
                              ...current,
                              [row.odk_instance_id]: `Tree ${option.treeNo} was selected exactly from Tree Master.`,
                            }))
                          }}
                          onInvalidCommit={(value) => {
                            updateErrorDecisionDraft(row, {
                              resolvedTreeNo: value,
                              validatedTreeNo: "",
                            })
                            setDecisionMessages((current) => ({
                              ...current,
                              [row.odk_instance_id]:
                                "Select an exact Tree Number from the Tree Master list.",
                            }))
                          }}
                          onRetry={() => void loadTreeMasterOptions()}
                        />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Tree Number correction confirmation">
                        <p className="rounded-lg border bg-muted/20 p-3 text-xs">
                          <span className="block font-bold uppercase text-muted-foreground">Original submitted Tree Number</span>
                          <span className="mt-1 block text-base font-black">{displayHarvestValue(row.original_tree_no)}</span>
                        </p>
                        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                          <span className="block font-bold uppercase text-muted-foreground">Proposed Tree Master number</span>
                          <span className="mt-1 block text-base font-black">{mapIsValid ? target : "—"}</span>
                        </p>
                      </div>
                      <p
                        className={`mt-2 text-xs font-bold ${
                          mapIsValid ? "text-emerald-700" : "text-muted-foreground"
                        }`}
                      >
                        {mapIsValid
                          ? `Tree ${target} selected exactly from Tree Master.`
                          : "Save remains disabled until an exact Tree Master choice is selected."}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-muted-foreground">
                        Mapping changes only the proposed effective Tree Number. Original ODK value{" "}
                        {displayHarvestValue(row.original_tree_no)} remains unchanged and auditable.
                      </p>
                    </div>
                  ) : null}
                  {draft.action === "DEFER_DECISION" ? (
                    <p className="mt-3 rounded-lg border bg-muted/20 p-3 text-xs font-semibold">
                      This record remains unresolved and excluded from the final import set.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void saveDataErrorDecision(row)}
                      disabled={!canSave}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {decisionSaving === row.odk_instance_id
                        ? "Saving…"
                        : row.supervisor_decision
                          ? "Amend Supervisor Decision"
                          : "Save Supervisor Decision"}
                    </button>
                    <span className="text-xs font-bold text-muted-foreground">
                      {groupStatus?.groupMatches === true
                        ? "Group fingerprint unchanged."
                        : groupStatus?.groupMatches === false
                          ? "Group fingerprint changed; run Scan ODK again."
                          : "Open this row to verify its group fingerprint."}
                    </span>
                    {decisionMessages[row.odk_instance_id] ? (
                      <span
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className="text-xs font-bold"
                      >
                        {decisionMessages[row.odk_instance_id]}
                      </span>
                    ) : null}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
        {buckets.errors.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No correction-required rows match the current filter.</p> : null}
        <Pagination page={errorPage} pageCount={Math.max(1, Math.ceil(buckets.errors.length / REVIEW_ROW_PAGE_SIZE))} total={buckets.errors.length} unit="records" onPageChange={setErrorPage} />
      </ReviewSection>

      <ReviewSection id="review-cycle-safety" title="Cycle safety decisions" icon={ShieldCheck} count={buckets.cycleCollisions.length}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Each group identifies either multiple pending dates or an existing imported record and a pending submission for the same Tree Number in the open Harvest Cycle.
        </p>
        <div className="space-y-4">
          {visibleCycle.map(({ key, pending, pendingCandidates, records }) => {
            const treeNo = String(pending.original_tree_no ?? "").trim()
            const groupStatus = groupFingerprintStatuses[groupFingerprintStatusKey(treeNo)] ?? null
            const importedRecord = records.find(
              (record) => record.classification === "ALREADY_IMPORTED",
            )
            const hasImportedRecord = records.some(
              (record) => record.classification === "ALREADY_IMPORTED",
            )
            const savedAction = normalizedCycleDecisionActionForTarget(
              pending.supervisor_decision,
              pending.selected_effective_instance_id,
              pendingCandidates,
              targetDate,
            )
            const savedReason = pending.supervisor_reason ?? ""
            const cycleReasonOptions = hasImportedRecord
              ? [...SUPERVISOR_REASONS]
              : pendingCycleSupervisorReasons(pendingCandidates)
            const savedReasonIsChoice = cycleReasonOptions.some(
              (reason) => reason === savedReason,
            )
            const draft =
              decisionDrafts[pending.odk_instance_id] ??
              ({
                action: savedAction,
                selectedInstanceId:
                  pending.selected_effective_instance_id ??
                  (pendingCandidates.length === 1
                    ? pendingCandidates[0].odk_instance_id
                    : ""),
                reason: savedReason ? (savedReasonIsChoice ? savedReason : "Other") : "",
                otherReason: savedReasonIsChoice ? "" : savedReason,
              } satisfies DecisionDraft)
            const finalReason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
            const selectedPending = pendingCandidates.find(
              (candidate) => candidate.odk_instance_id === draft.selectedInstanceId,
            )
            const targetDatePendingCandidates = pendingCandidates.filter(
              (candidate) => displayHarvestDate(candidate.harvest_date) === targetDate,
            )
            const targetDateAnchor =
              targetDatePendingCandidates.length === 1
                ? targetDatePendingCandidates[0]
                : null
            const selectedIsTargetDate = Boolean(
              selectedPending &&
                displayHarvestDate(selectedPending.harvest_date) === targetDate,
            )
            const pendingCycleSelectionIsValid = Boolean(
              selectedPending &&
                isActiveValidConflictCandidate(selectedPending) &&
                ((draft.action === "RETAIN_PENDING_CYCLE_SUBMISSION" &&
                  selectedIsTargetDate) ||
                  (draft.action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE" &&
                    !selectedIsTargetDate &&
                    targetDateAnchor !== null)),
            )
            const canSave =
              !disabled &&
              Boolean(draft.action) &&
              ((hasImportedRecord &&
                (draft.action === "KEEP_EXISTING_CYCLE_RECORD" ||
                  draft.action === "DEFER_DECISION" ||
                  (draft.action === "USE_PENDING_SUBMISSION" &&
                    Boolean(selectedPending && isActiveValidConflictCandidate(selectedPending))))) ||
                (!hasImportedRecord &&
                  ((draft.action === "DEFER_DECISION" && targetDateAnchor !== null) ||
                    pendingCycleSelectionIsValid))) &&
              Boolean(finalReason) &&
              groupStatus?.groupMatches === true &&
              decisionSaving !== pending.odk_instance_id
            return (
              <div key={key} className="rounded-xl border border-amber-300 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black">Tree {displayHarvestValue(pending.original_tree_no)} · Cycle {displayHarvestValue(scanData.scan.cycle_no)}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {hasImportedRecord
                        ? "An existing imported Cycle record and a pending submission share the same Tree Number in this open Harvest Cycle."
                        : "Multiple pending submissions for the same Tree Number occur on different dates in the same open Harvest Cycle."}
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-black text-amber-950">
                    {decisionState(pending.supervisor_decision)}
                  </span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[1320px] text-left text-xs">
                    <thead><tr className="border-b"><th className="p-2">Tree</th><th className="p-2">Date</th><th className="p-2">Cycle</th><th className="p-2">Status</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">ODK Time</th><th className="p-2">Bunches</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Nuts</th><th className="p-2">Source</th><th className="p-2">Harvest Record ID</th></tr></thead>
                    <tbody>
                      {records.map((record) => {
                        const imported = record.classification === "ALREADY_IMPORTED"
                        const selectablePending = pendingCandidates.some(
                          (candidate) => candidate.odk_instance_id === record.odk_instance_id,
                        )
                        return (
                          <tr key={record.odk_instance_id} className="border-b bg-background/80">
                            <td className="p-2 font-bold">
                              <span className="flex items-center gap-2">
                                {draft.action === "USE_PENDING_SUBMISSION" && selectablePending ? (
                                  <input
                                    type="radio"
                                    name={`cycle-pending-${key}`}
                                    value={record.odk_instance_id}
                                    checked={draft.selectedInstanceId === record.odk_instance_id}
                                    onChange={() =>
                                      updateDecisionDraft(pending.odk_instance_id, {
                                        selectedInstanceId: record.odk_instance_id,
                                      })
                                    }
                                    disabled={disabled}
                                    aria-label={`Use pending ODK submission ${record.odk_instance_id} for Tree ${treeNo}`}
                                  />
                                ) : null}
                                {displayHarvestValue(record.original_tree_no)}
                              </span>
                            </td>
                            <td className="p-2">{displayHarvestDate(record.harvest_date)}</td>
                            <td className="p-2">{displayHarvestValue(scanData.scan.cycle_no)}</td>
                            <td className="p-2 font-bold">{imported ? "Imported" : "Pending"}</td>
                            <td className="p-2 font-mono">{record.odk_instance_id}</td>
                            <td className="p-2">{displayHarvestValue(record.submitter_name)} / {displayHarvestValue(record.device_id)}</td>
                            <td className="p-2">{formatIstDateTime(record.odk_submission_timestamp)}</td>
                            <td className="p-2">{displayHarvestValue(record.total_bunches)}</td>
                            <td className="p-2">{displayHarvestValue(record.b1)}</td>
                            <td className="p-2">{displayHarvestValue(record.b2)}</td>
                            <td className="p-2">{displayHarvestValue(record.b3)}</td>
                            <td className="p-2">{displayHarvestValue(record.total_nuts)}</td>
                            <td className="p-2">{imported ? displayHarvestValue(record.existing_record_source) : "ODK"}</td>
                            <td className="p-2">{imported ? displayHarvestValue(record.existing_harvest_record_id) : "—"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {hasImportedRecord ? (
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Supervisor Action
                      <select
                        value={draft.action}
                        onChange={(event) =>
                          updateDecisionDraft(pending.odk_instance_id, {
                            action: event.target.value as CycleDecisionAction,
                            reason: "",
                            otherReason: "",
                          })
                        }
                        disabled={disabled}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                      >
                        <option value="">Select Supervisor Action</option>
                        <option value="KEEP_EXISTING_CYCLE_RECORD">Keep existing Cycle record</option>
                        <option value="USE_PENDING_SUBMISSION">Use pending submission as a correction proposal</option>
                        <option value="DEFER_DECISION">Defer decision</option>
                      </select>
                    </label>
                  ) : (
                    <fieldset className="rounded-xl border bg-background p-3">
                      <legend className="px-1 text-xs font-bold uppercase text-muted-foreground">
                        Supervisor Action
                      </legend>
                      <div className="space-y-2 text-sm font-semibold">
                        {pendingCandidates.map((candidate) => {
                          const candidateIsTargetDate =
                            displayHarvestDate(candidate.harvest_date) === targetDate
                          const candidateAction: CycleDecisionAction = candidateIsTargetDate
                            ? "RETAIN_PENDING_CYCLE_SUBMISSION"
                            : "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE"
                          const excludedDates = pendingCandidates
                            .filter((other) => other.odk_instance_id !== candidate.odk_instance_id)
                            .map((other) => displayHarvestDateLong(other.harvest_date))
                            .join(", ")
                          return (
                            <label key={candidate.odk_instance_id} className="flex items-start gap-2 rounded-lg border p-2">
                              <input
                                type="radio"
                                name={`pending-cycle-action-${key}`}
                                checked={
                                  draft.action === candidateAction &&
                                  draft.selectedInstanceId === candidate.odk_instance_id
                                }
                                onChange={() =>
                                  updateDecisionDraft(pending.odk_instance_id, {
                                    action: candidateAction,
                                    selectedInstanceId: candidate.odk_instance_id,
                                  })
                                }
                                disabled={disabled}
                                className="mt-0.5"
                              />
                              <span>
                                Retain {displayHarvestDateLong(candidate.harvest_date)} submission and exclude {excludedDates || "the other pending"} submission
                              </span>
                            </label>
                          )
                        })}
                        <label className="flex items-start gap-2 rounded-lg border p-2">
                          <input
                            type="radio"
                            name={`pending-cycle-action-${key}`}
                            checked={draft.action === "DEFER_DECISION"}
                            onChange={() =>
                              updateDecisionDraft(pending.odk_instance_id, {
                                action: "DEFER_DECISION",
                                selectedInstanceId: "",
                              })
                            }
                            disabled={disabled}
                            className="mt-0.5"
                          />
                          <span>Defer for field verification</span>
                        </label>
                      </div>
                    </fieldset>
                  )}
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Supervisor Reason
                    <select
                      value={draft.reason}
                      onChange={(event) =>
                        updateDecisionDraft(pending.odk_instance_id, {
                          reason: event.target.value,
                          otherReason: event.target.value === "Other" ? draft.otherReason : "",
                        })
                      }
                      disabled={disabled}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                    >
                      <option value="">Select Supervisor Reason</option>
                      {cycleReasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                  </label>
                </div>
                {draft.reason === "Other" ? (
                  <textarea
                    value={draft.otherReason}
                    onChange={(event) => updateDecisionDraft(pending.odk_instance_id, { otherReason: event.target.value })}
                    disabled={disabled}
                    aria-label={`Other Supervisor Reason for Tree ${treeNo}`}
                    className="mt-3 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                ) : null}
                {draft.action === "KEEP_EXISTING_CYCLE_RECORD" ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
                    The pending submission is excluded from the proposed import set. The existing Cycle record and ODK submission remain unchanged.
                  </p>
                ) : null}
                {draft.action === "USE_PENDING_SUBMISSION" ? (
                  <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs font-black text-rose-950">
                    CORRECTION ACTION REQUIRED — controlled replacement of the existing record is required before this pending submission can be used.
                  </p>
                ) : null}
                {draft.action === "RETAIN_PENDING_CYCLE_SUBMISSION" && selectedPending ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
                    Retain the {displayHarvestDateLong(selectedPending.harvest_date)} pending submission and exclude the other pending submission(s). Both original ODK submissions remain unchanged and auditable.
                  </p>
                ) : null}
                {draft.action === "EXCLUDE_TARGET_DATE_RETAIN_OTHER_DATE" && selectedPending ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
                    Exclude the {displayHarvestDayMonth(targetDate)} submission from this date-specific batch and retain the {displayHarvestDayMonth(selectedPending.harvest_date)} submission only for its own future date-specific review. Neither original ODK submission is changed.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void saveCycleDecision(pending, pendingCandidates, hasImportedRecord)}
                    disabled={!canSave}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {decisionSaving === pending.odk_instance_id ? "Saving…" : pending.supervisor_decision ? "Amend Supervisor Decision" : "Save Supervisor Decision"}
                  </button>
                  <span className="text-xs font-bold text-muted-foreground">
                    {groupStatus?.groupMatches === true ? "Group fingerprint unchanged." : groupStatus?.groupMatches === false ? "Group fingerprint changed; run Scan ODK again." : "Checking group fingerprint…"}
                  </span>
                  {decisionMessages[pending.odk_instance_id] ? (
                    <span
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className="text-xs font-bold"
                    >
                      {decisionMessages[pending.odk_instance_id]}
                    </span>
                  ) : null}
                </div>
                {hasImportedRecord &&
                (pending.supervisor_decision === "USE_PENDING_SUBMISSION" ||
                  pending.supervisor_decision ===
                    "USE_PENDING_SUBMISSION_AS_CORRECTION_PROPOSAL") &&
                pending.selected_effective_instance_id ? (
                  <HarvestControlledReplacement
                    scanId={selectedScanId!}
                    harvestDate={displayHarvestDate(pending.harvest_date)}
                    harvestCycle={scanData.scan.cycle_no ?? ""}
                    treeNo={treeNo}
                    existingHarvestRecordId={
                      importedRecord?.existing_harvest_record_id ??
                      pending.supervisor_existing_harvest_record_id ??
                      null
                    }
                    pendingOdkInstanceId={pending.selected_effective_instance_id}
                    disabled={disabled}
                    onReplacementApplied={onDecisionSaved}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        {buckets.cycleCollisions.length === 0 ? <p className="text-sm text-muted-foreground">No cycle-safety collisions match the current filter.</p> : null}
        <Pagination page={cyclePage} pageCount={Math.max(1, Math.ceil(buckets.cycleCollisions.length / REVIEW_GROUP_PAGE_SIZE))} total={buckets.cycleCollisions.length} unit="groups" onPageChange={setCyclePage} />
      </ReviewSection>

      <p className="text-xs font-semibold text-muted-foreground">
        Search currently shows {buckets.submissions.length.toLocaleString("en-IN")} submissions in{" "}
        {buckets.treeGroupCount.toLocaleString("en-IN")} tree/date groups. Category counts update live.
      </p>
    </div>
  )
}
