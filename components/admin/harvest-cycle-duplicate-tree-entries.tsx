"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, History } from "lucide-react"
import { Panel } from "@/components/farm/panel"

const GROUP_PAGE_SIZE = 10
const ERROR_PAGE_SIZE = 25
const EXACT_PAGE_SIZE = 25

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
  "READY_EXACT_DUPLICATE",
  "SUPERSEDED_EXACT_DUPLICATE",
  "SUPERSEDED",
  "ALREADY_IMPORTED",
])

interface ScanSummary {
  id: number
  status: string
  scan_started_at: string | null
  scan_ended_at: string | null
  cycle_no: string | null
}

interface ScanItem {
  id: number
  scan_id: number
  odk_instance_id: string
  harvest_date: string | null
  original_tree_no: string | null
  classification: string
  issue_type: string | null
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
  selected_effective_instance_id?: string | null
  supervisor_admin_user?: string | null
  supervisor_decision_at?: string | null
  supervisor_decision_updated_at?: string | null
  supervisor_existing_harvest_record_id?: number | null
  existing_record_source?: string | null
}

interface ScanResponse {
  scan: ScanSummary
  items: ScanItem[]
}

interface ExactAuditGroup {
  key: string
  rows: ScanItem[]
  retained: ScanItem
  superseded: ScanItem[]
}

type CycleDecisionAction =
  | "KEEP_EXISTING_CYCLE_RECORD"
  | "USE_PENDING_SUBMISSION"
  | "DEFER_DECISION"
  | ""

interface DecisionDraft {
  action: CycleDecisionAction
  reason: string
  otherReason: string
}

interface ConflictDecisionDraft {
  selectedInstanceId: string
  reason: string
  otherReason: string
}

interface FingerprintStatus {
  scanId: number
  matches: boolean
  checkedAt: string
  scanTimestamp?: string | null
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

const SUPERVISOR_REASONS = [
  "Existing Cycle record is correct",
  "Pending labour submission is correct",
  "Duplicate recording of the same harvest",
  "Field verification required",
  "Other",
] as const

const CONFLICT_SUPERVISOR_REASONS = [
  "Supervisor confirmed correct labour entry",
  "Duplicate recording of the same harvest",
  "Quantity confirmed after field verification",
  "Other",
] as const

const CYCLE_COLLISION_DECISIONS = new Set<CycleDecisionAction>([
  "KEEP_EXISTING_CYCLE_RECORD",
  "USE_PENDING_SUBMISSION",
  "DEFER_DECISION",
])

const RESOLVED_CONFLICT_DECISIONS = new Set(["SELECT_SUBMISSION", "KEEP_LATEST"])

const EMPTY_DECISION_DRAFT: DecisionDraft = {
  action: "",
  reason: "",
  otherReason: "",
}

function displayDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—"
}

function displayValue(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

function naturalTreeCompare(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function groupKey(item: ScanItem): string {
  return item.group_key ?? `${displayDate(item.harvest_date)}|${item.original_tree_no ?? ""}`
}

function fingerprintStatusKey(treeNo: string, harvestDate?: string | null): string {
  return harvestDate ? `${treeNo}|${displayDate(harvestDate)}` : treeNo
}

function businessSignature(item: ScanItem, cycleNo: string | null): string {
  return JSON.stringify([
    String(item.original_tree_no ?? "").trim(),
    displayDate(item.harvest_date),
    cycleNo ?? "",
    item.total_bunches,
    item.b1,
    item.b2,
    item.b3,
    item.total_nuts,
  ])
}

function earliestSubmission(rows: ScanItem[]): ScanItem {
  return [...rows].sort((left, right) => {
    const timeCompared = String(left.odk_submission_timestamp ?? "").localeCompare(
      String(right.odk_submission_timestamp ?? ""),
    )
    if (timeCompared !== 0) return timeCompared
    return left.odk_instance_id.localeCompare(right.odk_instance_id)
  })[0]
}

function statusBadge(classification: string): string {
  if (classification === "UNMATCHED_TREE") return "border-orange-200 bg-orange-50 text-orange-800"
  if (classification === "DUPLICATE_REVIEW_REQUIRED") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-amber-200 bg-amber-50 text-amber-800"
}

function isCycleCollision(item: ScanItem): boolean {
  return (
    item.classification === "DUPLICATE_REVIEW_REQUIRED" &&
    (item.note ?? "").includes("more than one date in the same Harvest cycle")
  )
}

function selectedConflictInstance(item: ScanItem | undefined): string | null {
  if (!item || !RESOLVED_CONFLICT_DECISIONS.has(String(item.supervisor_decision ?? ""))) {
    return null
  }
  const selected = item.selected_effective_instance_id ?? item.odk_instance_id
  return selected ? String(selected) : null
}

function isActiveValidConflictCandidate(item: ScanItem): boolean {
  const reviewState = String(item.review_state ?? "").toLowerCase().replace(/\s+/g, "")
  return Boolean(
    item.odk_instance_id &&
      item.classification === "DUPLICATE_REVIEW_REQUIRED" &&
      !["deleted", "rejected", "hasissues"].includes(reviewState) &&
      [item.b1, item.b2, item.b3, item.total_bunches, item.total_nuts].every(
        (value) => value !== null && value !== undefined,
      ),
  )
}

function conflictGroupResolved(rows: ScanItem[]): boolean {
  return rows.some((decisionRow) => {
    const selected = selectedConflictInstance(decisionRow)
    return Boolean(
      selected &&
        rows.some(
          (row) =>
            String(row.odk_instance_id) === selected && isActiveValidConflictCandidate(row),
        ),
    )
  })
}

function storedConflictDecisionDraft(rows: ScanItem[]): ConflictDecisionDraft {
  const decisionRow = rows.find((row) => selectedConflictInstance(row))
  const savedReason = decisionRow?.supervisor_reason ?? ""
  const savedReasonIsChoice = CONFLICT_SUPERVISOR_REASONS.some(
    (reason) => reason === savedReason,
  )
  return {
    selectedInstanceId: selectedConflictInstance(decisionRow) ?? "",
    reason: savedReason ? (savedReasonIsChoice ? savedReason : "Other") : "",
    otherReason: savedReasonIsChoice ? "" : savedReason,
  }
}

function decisionState(action: string | null | undefined): string {
  if (action === "KEEP_EXISTING_CYCLE_RECORD") return "Resolved"
  if (action === "USE_PENDING_SUBMISSION") return "CORRECTION ACTION REQUIRED"
  return "Unresolved"
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
    <div className="mt-3 flex items-center justify-between text-xs font-bold">
      <button
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Previous
      </button>
      <span>
        Page {page} of {pageCount} · {total.toLocaleString("en-IN")} {unit}
      </span>
      <button
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
      >
        Next
      </button>
    </div>
  )
}

export function HarvestCycleDuplicateTreeEntries() {
  const [scans, setScans] = useState<ScanSummary[]>([])
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conflictPage, setConflictPage] = useState(1)
  const [errorPage, setErrorPage] = useState(1)
  const [exactPage, setExactPage] = useState(1)
  const [fingerprintStatus, setFingerprintStatus] = useState<FingerprintStatus | null>(null)
  const [groupFingerprintStatuses, setGroupFingerprintStatuses] = useState<
    Record<string, FingerprintStatus>
  >({})
  const [openConflictGroupKey, setOpenConflictGroupKey] = useState<string | null>(null)
  const [conflictDecisionDrafts, setConflictDecisionDrafts] = useState<
    Record<string, ConflictDecisionDraft>
  >({})
  const [conflictDecisionMessage, setConflictDecisionMessage] = useState<
    Record<string, string>
  >({})
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, DecisionDraft>>({})
  const [decisionSaving, setDecisionSaving] = useState<string | null>(null)
  const [decisionMessage, setDecisionMessage] = useState<Record<string, string>>({})

  async function loadGroupFingerprintStatus(
    scanId: number,
    treeNo: string,
    harvestDate?: string | null,
  ) {
    const dateQuery = harvestDate ? `&harvest_date=${encodeURIComponent(displayDate(harvestDate))}` : ""
    const statusKey = fingerprintStatusKey(treeNo, harvestDate)
    const groupResponse = await fetch(
      `/api/admin/harvest-sync/scans/${scanId}/fingerprint-status?tree_no=${encodeURIComponent(treeNo)}${dateQuery}`,
      { cache: "no-store" },
    )
    const groupStatus = (await groupResponse.json()) as FingerprintStatus & {
      detail?: string
      error?: string
    }
    if (!groupResponse.ok) {
      throw new Error(
        groupStatus.detail ??
          groupStatus.error ??
          `Tree ${treeNo} fingerprint check returned HTTP ${groupResponse.status}.`,
      )
    }
    setGroupFingerprintStatuses((current) => ({ ...current, [statusKey]: groupStatus }))
    return groupStatus
  }

  async function loadScan(scanId: number) {
    setLoading(true)
    setError(null)
    setFingerprintStatus(null)
    setGroupFingerprintStatuses({})
    setConflictDecisionDrafts({})
    try {
      const response = await fetch(`/api/admin/harvest-sync/scans/${scanId}`, { cache: "no-store" })
      const data = (await response.json()) as ScanResponse & { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? `Harvest Sync scan API returned HTTP ${response.status}.`)
      }
      setScanData(data)
      setSelectedScanId(scanId)
      const collisionTrees = [
        ...new Set(
          data.items
            .filter(isCycleCollision)
            .map((item) => String(item.original_tree_no ?? "").trim())
            .filter(Boolean),
        ),
      ]
      const groupStatuses = await Promise.all(
        collisionTrees.map(async (treeNo) => {
          const groupStatus = await loadGroupFingerprintStatus(scanId, treeNo)
          return [treeNo, groupStatus] as const
        }),
      )
      setGroupFingerprintStatuses(Object.fromEntries(groupStatuses))
      if (groupStatuses[0]) {
        setFingerprintStatus(groupStatuses[0][1])
      } else {
        const fingerprintResponse = await fetch(
          `/api/admin/harvest-sync/scans/${scanId}/fingerprint-status`,
          { cache: "no-store" },
        )
        const fingerprint = (await fingerprintResponse.json()) as FingerprintStatus & {
          detail?: string
          error?: string
        }
        if (!fingerprintResponse.ok) {
          throw new Error(
            fingerprint.detail ??
              fingerprint.error ??
              `Source fingerprint check returned HTTP ${fingerprintResponse.status}.`,
          )
        }
        setFingerprintStatus(fingerprint)
      }
      const dates = [...new Set(data.items.map((item) => displayDate(item.harvest_date)).filter((value) => value !== "—"))]
        .sort()
      setDateFilter((current) => (current && dates.includes(current) ? current : (dates.at(-1) ?? "")))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Harvest Cycle review issues.")
    } finally {
      setLoading(false)
    }
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

  function updateConflictDecisionDraft(
    key: string,
    rows: ScanItem[],
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

  async function saveConflictDecision(
    key: string,
    rows: ScanItem[],
    openNextUnresolved: boolean,
  ) {
    const draft = conflictDecisionDrafts[key] ?? storedConflictDecisionDraft(rows)
    const reason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
    const selectedRow = rows.find(
      (row) => String(row.odk_instance_id) === String(draft.selectedInstanceId),
    )
    const treeNo = String(rows[0]?.original_tree_no ?? "").trim()
    const groupStatus =
      groupFingerprintStatuses[fingerprintStatusKey(treeNo, rows[0]?.harvest_date)]
    if (
      !selectedScanId ||
      !selectedRow ||
      !isActiveValidConflictCandidate(selectedRow) ||
      !reason ||
      groupStatus?.groupMatches !== true
    ) {
      return
    }

    const currentGroupIndex = conflictingGroups.findIndex(([group]) => group === key)
    const orderedFollowingGroups = [
      ...conflictingGroups.slice(currentGroupIndex + 1),
      ...conflictingGroups.slice(0, Math.max(0, currentGroupIndex)),
    ]
    const nextUnresolved = orderedFollowingGroups.find(
      ([, candidateRows]) => !conflictGroupResolved(candidateRows),
    )
    const nextTreeNo = String(nextUnresolved?.[1]?.[0]?.original_tree_no ?? "").trim()
    const nextHarvestDate = nextUnresolved?.[1]?.[0]?.harvest_date ?? null

    setDecisionSaving(key)
    setConflictDecisionMessage((current) => ({ ...current, [key]: "" }))
    try {
      const response = await fetch("/api/admin/harvest-sync/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: selectedScanId,
          odk_instance_id: selectedRow.odk_instance_id,
          issue_type: "CONFLICTING_DUPLICATE",
          decision: "SELECT_SUBMISSION",
          selected_effective_instance_id: selectedRow.odk_instance_id,
          reason,
        }),
      })
      const result = (await response.json()) as { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? `Decision API returned HTTP ${response.status}.`)
      }

      await loadScan(selectedScanId)
      if (openNextUnresolved && nextUnresolved && nextTreeNo) {
        const nextIndex = conflictingGroups.findIndex(([group]) => group === nextUnresolved[0])
        setConflictPage(Math.floor(nextIndex / GROUP_PAGE_SIZE) + 1)
        setOpenConflictGroupKey(nextUnresolved[0])
        await loadGroupFingerprintStatus(selectedScanId, nextTreeNo, nextHarvestDate)
      } else {
        setOpenConflictGroupKey(null)
      }
      setConflictDecisionMessage((current) => ({
        ...current,
        [key]: openNextUnresolved && nextUnresolved
          ? "Supervisor selection saved. The next unresolved group is open."
          : "Supervisor selection saved.",
      }))
    } catch (saveError) {
      setConflictDecisionMessage((current) => ({
        ...current,
        [key]:
          saveError instanceof Error ? saveError.message : "Unable to save the supervisor selection.",
      }))
    } finally {
      setDecisionSaving(null)
    }
  }

  async function saveCycleDecision(pending: ScanItem) {
    const draft = decisionDrafts[pending.odk_instance_id] ?? EMPTY_DECISION_DRAFT
    const reason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
    const groupStatus = groupFingerprintStatuses[String(pending.original_tree_no ?? "").trim()]
    if (!draft.action || !reason || groupStatus?.groupMatches !== true || !selectedScanId) return
    setDecisionSaving(pending.odk_instance_id)
    setDecisionMessage((current) => ({ ...current, [pending.odk_instance_id]: "" }))
    try {
      const response = await fetch("/api/admin/harvest-sync/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: selectedScanId,
          odk_instance_id: pending.odk_instance_id,
          issue_type: "CYCLE_COLLISION",
          decision: draft.action,
          selected_effective_instance_id:
            draft.action === "USE_PENDING_SUBMISSION" ? pending.odk_instance_id : null,
          reason,
        }),
      })
      const result = (await response.json()) as { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? `Decision API returned HTTP ${response.status}.`)
      }
      setDecisionMessage((current) => ({
        ...current,
        [pending.odk_instance_id]: "Supervisor decision saved.",
      }))
      await loadScan(selectedScanId)
    } catch (saveError) {
      setDecisionMessage((current) => ({
        ...current,
        [pending.odk_instance_id]:
          saveError instanceof Error ? saveError.message : "Unable to save the supervisor decision.",
      }))
    } finally {
      setDecisionSaving(null)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    async function bootstrap() {
      try {
        const response = await fetch("/api/admin/harvest-sync/scans", {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = (await response.json()) as { scans?: ScanSummary[]; detail?: string; error?: string }
        if (!response.ok) {
          throw new Error(data.detail ?? data.error ?? `Harvest Sync scan list returned HTTP ${response.status}.`)
        }
        const completedScans = (data.scans ?? []).filter((scan) => scan.status === "SCANNED")
        setScans(completedScans)
        if (completedScans[0]) await loadScan(completedScans[0].id)
        else setLoading(false)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : "Unable to load Harvest Sync scans.")
        setLoading(false)
      }
    }

    void bootstrap()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    setConflictPage(1)
    setErrorPage(1)
    setExactPage(1)
    setOpenConflictGroupKey(null)
  }, [selectedScanId, dateFilter])

  const selectedItems = useMemo(
    () =>
      (scanData?.items ?? [])
        .filter((item) => !dateFilter || displayDate(item.harvest_date) === dateFilter)
        .sort((left, right) => {
          const treeCompared = naturalTreeCompare(left.original_tree_no, right.original_tree_no)
          if (treeCompared !== 0) return treeCompared
          return String(left.odk_submission_timestamp ?? "").localeCompare(String(right.odk_submission_timestamp ?? ""))
        }),
    [scanData, dateFilter],
  )

  const selectedGroups = useMemo(() => {
    const grouped = new Map<string, ScanItem[]>()
    for (const item of selectedItems) {
      const key = groupKey(item)
      grouped.set(key, [...(grouped.get(key) ?? []), item])
    }
    return [...grouped.entries()]
  }, [selectedItems])

  const conflictingGroups = useMemo(
    () =>
      selectedGroups.filter(([, rows]) => {
        if (rows.length < 2) return false
        const signatures = new Set(rows.map((item) => businessSignature(item, scanData?.scan.cycle_no ?? null)))
        return signatures.size > 1 && rows.some((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED")
      }),
    [scanData, selectedGroups],
  )

  const conflictingGroupKeys = useMemo(
    () => new Set(conflictingGroups.map(([key]) => key)),
    [conflictingGroups],
  )
  const resolvedConflictCount = conflictingGroups.filter(([, rows]) =>
    conflictGroupResolved(rows),
  ).length
  const remainingConflictCount = conflictingGroups.length - resolvedConflictCount

  const exactAuditGroups = useMemo<ExactAuditGroup[]>(
    () =>
      selectedGroups
        .filter(([, rows]) => {
          if (rows.length < 2) return false
          if (!rows.every((item) => EXACT_AUDIT_CLASSIFICATIONS.has(item.classification))) return false
          return new Set(rows.map((item) => businessSignature(item, scanData?.scan.cycle_no ?? null))).size === 1
        })
        .map(([key, rows]) => {
          const retained =
            rows.find((item) => item.classification === "READY_EXACT_DUPLICATE") ?? earliestSubmission(rows)
          return { key, rows, retained, superseded: rows.filter((item) => item !== retained) }
        }),
    [scanData, selectedGroups],
  )

  const errorRows = useMemo(
    () =>
      selectedItems.filter((item) => {
        if (isCycleCollision(item)) return false
        if (conflictingGroupKeys.has(groupKey(item))) return false
        if (exactAuditGroups.some((group) => group.key === groupKey(item))) return false
        if (EXPLICIT_ERROR_CLASSIFICATIONS.has(item.classification)) return true
        if (item.classification === "DUPLICATE_REVIEW_REQUIRED") return true
        return !NON_ERROR_CLASSIFICATIONS.has(item.classification)
      }),
    [conflictingGroupKeys, exactAuditGroups, selectedItems],
  )

  const cycleCollisionGroups = useMemo(() => {
    const allItems = scanData?.items ?? []
    return selectedItems
      .filter(isCycleCollision)
      .map((pending) => ({
        pending,
        records: allItems
          .filter(
            (item) =>
              item.original_tree_no === pending.original_tree_no &&
              (item.classification === "ALREADY_IMPORTED" || isCycleCollision(item)),
          )
          .sort((left, right) =>
            displayDate(left.harvest_date).localeCompare(displayDate(right.harvest_date)),
          ),
      }))
  }, [scanData, selectedItems])

  const visibleConflicts = conflictingGroups.slice(
    (conflictPage - 1) * GROUP_PAGE_SIZE,
    conflictPage * GROUP_PAGE_SIZE,
  )
  const visibleErrors = errorRows.slice((errorPage - 1) * ERROR_PAGE_SIZE, errorPage * ERROR_PAGE_SIZE)
  const visibleExactGroups = exactAuditGroups.slice(
    (exactPage - 1) * EXACT_PAGE_SIZE,
    exactPage * EXACT_PAGE_SIZE,
  )
  const conflictPageCount = Math.max(1, Math.ceil(conflictingGroups.length / GROUP_PAGE_SIZE))
  const errorPageCount = Math.max(1, Math.ceil(errorRows.length / ERROR_PAGE_SIZE))
  const exactPageCount = Math.max(1, Math.ceil(exactAuditGroups.length / EXACT_PAGE_SIZE))
  const selectedDateOptions = useMemo(
    () =>
      [...new Set((scanData?.items ?? []).map((item) => displayDate(item.harvest_date)).filter((value) => value !== "—"))]
        .sort()
        .reverse(),
    [scanData],
  )

  return (
    <div className="space-y-5">
      <Panel title="Harvest Issue Review Source" icon={History}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Scan
            <select
              aria-label="Harvest Sync Scan"
              value={selectedScanId ?? ""}
              onChange={(event) => void loadScan(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            >
              {scans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  Scan {scan.id} — {scan.scan_ended_at ?? scan.scan_started_at ?? "timestamp unavailable"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Harvest Date
            <select
              aria-label="Harvest Date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            >
              {selectedDateOptions.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p className="rounded-xl border bg-background p-3">
            <span className="block text-xs font-bold uppercase text-muted-foreground">Active Scan ID</span>
            <span className="font-black">{selectedScanId ? `Scan ${selectedScanId}` : "—"}</span>
          </p>
          <p className="rounded-xl border bg-background p-3">
            <span className="block text-xs font-bold uppercase text-muted-foreground">Scan Timestamp</span>
            <span className="font-bold">
              {scanData?.scan.scan_ended_at ?? scanData?.scan.scan_started_at ?? "—"}
            </span>
          </p>
          <p className="rounded-xl border bg-background p-3">
            <span className="block text-xs font-bold uppercase text-muted-foreground">Selected Harvest Date</span>
            <span className="font-black">{dateFilter || "—"}</span>
          </p>
        </div>
        {loading ? <p className="mt-3 text-sm font-semibold text-muted-foreground">Loading persisted scan…</p> : null}
          {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
        {fingerprintStatus?.liveSourceChanged ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
            New ODK source changes exist after Scan {selectedScanId}. Decisions for unchanged groups may still be
            amended. A new scan is required before final import.
          </p>
        ) : null}
      </Panel>

      <Panel title="CONFLICTING DUPLICATE TREE ENTRIES — REVIEW REQUIRED" icon={AlertTriangle}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          {conflictingGroups.length.toLocaleString("en-IN")} conflicting groups ·{" "}
          {conflictingGroups.flatMap(([, rows]) => rows).length.toLocaleString("en-IN")} candidate submissions.
          Every material Harvest value is compared within the selected Tree Number/date/cycle group.
        </p>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-2 text-xs">
            <span className="font-black">{conflictingGroups.length.toLocaleString("en-IN")}</span>{" "}
            total conflicts
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs">
            <span className="font-black">{resolvedConflictCount.toLocaleString("en-IN")}</span>{" "}
            resolved
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs">
            <span className="font-black">{remainingConflictCount.toLocaleString("en-IN")}</span>{" "}
            remaining
          </div>
        </div>
        <div className="space-y-3">
          {visibleConflicts.map(([key, rows]) => {
            const first = rows[0]
            const treeNo = String(first.original_tree_no ?? "").trim()
            const decisionRow = rows.find((row) => selectedConflictInstance(row))
            const storedDraft = storedConflictDecisionDraft(rows)
            const draft = conflictDecisionDrafts[key] ?? storedDraft
            const conflictFingerprintKey = fingerprintStatusKey(treeNo, first.harvest_date)
            const groupStatus = groupFingerprintStatuses[conflictFingerprintKey]
            const finalReason =
              draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
            const selectedCandidate = rows.find(
              (row) => String(row.odk_instance_id) === String(draft.selectedInstanceId),
            )
            const canSave =
              Boolean(selectedCandidate && isActiveValidConflictCandidate(selectedCandidate)) &&
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
                    if (
                      selectedScanId &&
                      treeNo &&
                      !groupFingerprintStatuses[conflictFingerprintKey]
                    ) {
                      void loadGroupFingerprintStatus(
                        selectedScanId,
                        treeNo,
                        first.harvest_date,
                      ).catch((fingerprintError) => {
                        setConflictDecisionMessage((current) => ({
                          ...current,
                          [key]:
                            fingerprintError instanceof Error
                              ? fingerprintError.message
                              : "Unable to validate the group fingerprint.",
                        }))
                      })
                    }
                  } else if (openConflictGroupKey === key) {
                    setOpenConflictGroupKey(null)
                  }
                }}
                className="rounded-xl border bg-background"
                data-testid={`conflict-group-${key}`}
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Tree {displayValue(first.original_tree_no)} · {displayDate(first.harvest_date)} · {rows.length} candidate
                  submissions
                  {selectedConflictInstance(decisionRow) ? " · Supervisor decision saved" : ""}
                </summary>
                <div className="border-t p-4">
                  {decisionRow?.supervisor_decision ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
                      <p className="font-black">Saved supervisor decision: {decisionRow.supervisor_decision}</p>
                      <p className="mt-1">
                        Selected: <span className="font-mono">{selectedConflictInstance(decisionRow) ?? "—"}</span>
                      </p>
                      <p className="mt-1">Reason: {decisionRow.supervisor_reason ?? "—"}</p>
                      <p className="mt-1">
                        Supervisor: {displayValue(decisionRow.supervisor_admin_user)} ·{" "}
                        {displayValue(
                          decisionRow.supervisor_decision_updated_at ??
                            decisionRow.supervisor_decision_at,
                        )}
                      </p>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2">Record to Retain</th>
                          <th className="p-2">Tree Number</th>
                          <th className="p-2">Harvest Date</th>
                          <th className="p-2">ODK Time</th>
                          <th className="p-2">ODK Instance ID</th>
                          <th className="p-2">Submitter / Device</th>
                          <th className="p-2">B1</th>
                          <th className="p-2">B2</th>
                          <th className="p-2">B3</th>
                          <th className="p-2">Bunch Count</th>
                          <th className="p-2">Total Nuts</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Supervisor Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                            <td className="p-2">
                              <label className="inline-flex items-center gap-2 font-bold">
                                <input
                                  type="radio"
                                  name={`conflict-${key}`}
                                  value={row.odk_instance_id}
                                  checked={
                                    String(draft.selectedInstanceId) ===
                                    String(row.odk_instance_id)
                                  }
                                  onChange={() =>
                                    updateConflictDecisionDraft(key, rows, {
                                      selectedInstanceId: row.odk_instance_id,
                                    })
                                  }
                                  disabled={
                                    decisionSaving !== null ||
                                    !isActiveValidConflictCandidate(row) ||
                                    groupStatus?.groupMatches !== true
                                  }
                                  aria-label={`Retain ODK instance ${row.odk_instance_id} for Tree ${displayValue(row.original_tree_no)}`}
                                />
                                Retain
                              </label>
                            </td>
                            <td className="p-2 font-bold">{displayValue(row.original_tree_no)}</td>
                            <td className="p-2">{displayDate(row.harvest_date)}</td>
                            <td className="p-2">{displayValue(row.odk_submission_timestamp)}</td>
                            <td className="p-2 font-mono">{row.odk_instance_id}</td>
                            <td className="p-2">
                              {displayValue(row.submitter_name)} / {displayValue(row.device_id)}
                            </td>
                            <td className="p-2">{displayValue(row.b1)}</td>
                            <td className="p-2">{displayValue(row.b2)}</td>
                            <td className="p-2">{displayValue(row.b3)}</td>
                            <td className="p-2">{displayValue(row.total_bunches)}</td>
                            <td className="p-2">{displayValue(row.total_nuts)}</td>
                            <td className="p-2">
                              <span className={`rounded-full border px-2 py-1 ${statusBadge(row.classification)}`}>
                                {row.classification}
                              </span>
                            </td>
                            <td className="p-2">
                              {row.odk_instance_id === selectedConflictInstance(decisionRow)
                                ? `Selected${decisionRow?.supervisor_reason ? ` — ${decisionRow.supervisor_reason}` : ""}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Supervisor Reason
                      <select
                        aria-label={`Supervisor Reason for conflicting Tree ${displayValue(first.original_tree_no)}`}
                        value={draft.reason}
                        onChange={(event) =>
                          updateConflictDecisionDraft(key, rows, {
                            reason: event.target.value,
                            otherReason:
                              event.target.value === "Other" ? draft.otherReason : "",
                          })
                        }
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                      >
                        <option value="">Select Supervisor Reason</option>
                        {CONFLICT_SUPERVISOR_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs font-semibold">
                      {groupStatus?.groupMatches === true
                        ? "Group fingerprint unchanged — supervisor selection may be saved."
                        : groupStatus?.groupMatches === false
                          ? "This conflict group changed after the scan. Rescan and review again."
                          : "Checking this conflict group’s fingerprint…"}
                    </div>
                  </div>
                  {draft.reason === "Other" ? (
                    <label className="mt-3 block text-xs font-bold uppercase text-muted-foreground">
                      Other reason details
                      <textarea
                        aria-label={`Other Supervisor Reason for conflicting Tree ${displayValue(first.original_tree_no)}`}
                        value={draft.otherReason}
                        onChange={(event) =>
                          updateConflictDecisionDraft(key, rows, {
                            otherReason: event.target.value,
                          })
                        }
                        className="mt-1 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                        required
                      />
                    </label>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void saveConflictDecision(key, rows, false)}
                      disabled={!canSave}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {decisionSaving === key ? "Saving…" : "Save Supervisor Selection"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveConflictDecision(key, rows, true)}
                      disabled={!canSave}
                      className="rounded-lg border border-primary px-4 py-2 text-sm font-black text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {decisionSaving === key ? "Saving…" : "Save and Open Next Unresolved"}
                    </button>
                    <span className="text-xs font-semibold text-muted-foreground">
                      This saves only the reconciliation decision. No Harvest record is imported.
                    </span>
                  </div>
                  {conflictDecisionMessage[key] ? (
                    <p className="mt-3 text-xs font-bold">{conflictDecisionMessage[key]}</p>
                  ) : null}
                </div>
              </details>
            )
          })}
          {!loading && conflictingGroups.length === 0 ? (
            <p className="rounded-xl border p-3 text-sm text-muted-foreground">
              No conflicting duplicate groups match the selected scan and Harvest date.
            </p>
          ) : null}
        </div>
        <Pagination
          page={conflictPage}
          pageCount={conflictPageCount}
          total={conflictingGroups.length}
          unit="groups"
          onPageChange={setConflictPage}
        />
      </Panel>

      <Panel title="TREE NUMBER / DATA ERRORS — CORRECTION REQUIRED" icon={AlertTriangle}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          {(errorRows.length + cycleCollisionGroups.length).toLocaleString("en-IN")} unresolved records for the selected scan and Harvest date.
          Tree Numbers are never changed automatically.
        </p>
        <div className="mb-4 space-y-4">
          {cycleCollisionGroups.map(({ pending, records }) => {
            const groupStatus =
              groupFingerprintStatuses[String(pending.original_tree_no ?? "").trim()] ?? null
            const savedAction = CYCLE_COLLISION_DECISIONS.has(
              pending.supervisor_decision as CycleDecisionAction,
            )
              ? (pending.supervisor_decision as CycleDecisionAction)
              : ""
            const savedReason = pending.supervisor_reason ?? ""
            const savedReasonIsChoice = SUPERVISOR_REASONS.some((reason) => reason === savedReason)
            const draft =
              decisionDrafts[pending.odk_instance_id] ??
              ({
                action: savedAction,
                reason: savedReason ? (savedReasonIsChoice ? savedReason : "Other") : "",
                otherReason: savedReasonIsChoice ? "" : savedReason,
              } satisfies DecisionDraft)
            const finalReason = draft.reason === "Other" ? draft.otherReason.trim() : draft.reason.trim()
            const canSave =
              Boolean(draft.action) &&
              Boolean(finalReason) &&
              groupStatus?.groupMatches === true &&
              decisionSaving !== pending.odk_instance_id
            const replacementRequested =
              draft.action === "USE_PENDING_SUBMISSION" ||
              pending.supervisor_decision === "USE_PENDING_SUBMISSION"
            return (
              <div key={pending.odk_instance_id} className="rounded-xl border border-amber-300 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black">
                      Tree {displayValue(pending.original_tree_no)} · Cycle {displayValue(scanData?.scan.cycle_no)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {displayValue(pending.note)}
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-black text-amber-950">
                    {decisionState(pending.supervisor_decision)}
                  </span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[1320px] text-left text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">Tree Number</th>
                        <th className="p-2">Harvest Date</th>
                        <th className="p-2">Cycle</th>
                        <th className="p-2">Record Status</th>
                        <th className="p-2">ODK Instance ID</th>
                        <th className="p-2">Submitter / Device</th>
                        <th className="p-2">Submission Time</th>
                        <th className="p-2">Bunch Count</th>
                        <th className="p-2">B1</th>
                        <th className="p-2">B2</th>
                        <th className="p-2">B3</th>
                        <th className="p-2">Total Nuts</th>
                        <th className="p-2">Source</th>
                        <th className="p-2">Existing Harvest Record ID</th>
                        <th className="p-2">Supervisor Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => {
                        const imported = record.classification === "ALREADY_IMPORTED"
                        const rowHasDecision = record.odk_instance_id === pending.odk_instance_id
                        return (
                          <tr key={record.odk_instance_id} className="border-b bg-background/80">
                            <td className="p-2 font-bold">{displayValue(record.original_tree_no)}</td>
                            <td className="p-2">{displayDate(record.harvest_date)}</td>
                            <td className="p-2">{displayValue(scanData?.scan.cycle_no)}</td>
                            <td className="p-2 font-bold">{imported ? "Imported" : "Pending"}</td>
                            <td className="p-2 font-mono">{record.odk_instance_id}</td>
                            <td className="p-2">
                              {displayValue(record.submitter_name)} / {displayValue(record.device_id)}
                            </td>
                            <td className="p-2">{displayValue(record.odk_submission_timestamp)}</td>
                            <td className="p-2">{displayValue(record.total_bunches)}</td>
                            <td className="p-2">{displayValue(record.b1)}</td>
                            <td className="p-2">{displayValue(record.b2)}</td>
                            <td className="p-2">{displayValue(record.b3)}</td>
                            <td className="p-2">{displayValue(record.total_nuts)}</td>
                            <td className="p-2">{imported ? displayValue(record.existing_record_source) : "ODK"}</td>
                            <td className="p-2">
                              {imported ? displayValue(record.existing_harvest_record_id) : "—"}
                            </td>
                            <td className="p-2">
                              {rowHasDecision && pending.supervisor_decision ? (
                                <div>
                                  <p className="font-black">{pending.supervisor_decision}</p>
                                  <p className="mt-1">{displayValue(pending.supervisor_reason)}</p>
                                  <p className="mt-1">
                                    {displayValue(pending.supervisor_admin_user)} ·{" "}
                                    {displayValue(pending.supervisor_decision_at)}
                                  </p>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Supervisor Action
                    <select
                      aria-label={`Supervisor Action for Tree ${pending.original_tree_no}`}
                      value={draft.action}
                      onChange={(event) => {
                        const action = event.target.value as CycleDecisionAction
                        updateDecisionDraft(pending.odk_instance_id, {
                          action,
                          reason: "",
                          otherReason: "",
                        })
                      }}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                    >
                      <option value="">Select Supervisor Action</option>
                      <option value="KEEP_EXISTING_CYCLE_RECORD">Keep existing Cycle record</option>
                      <option value="USE_PENDING_SUBMISSION">Use pending submission instead</option>
                      <option value="DEFER_DECISION">Defer decision</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Supervisor Reason
                    <select
                      aria-label={`Supervisor Reason for Tree ${pending.original_tree_no}`}
                      value={draft.reason}
                      onChange={(event) =>
                        updateDecisionDraft(pending.odk_instance_id, {
                          reason: event.target.value,
                          otherReason: event.target.value === "Other" ? draft.otherReason : "",
                        })
                      }
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                    >
                      <option value="">Select Supervisor Reason</option>
                      {SUPERVISOR_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {draft.reason === "Other" ? (
                  <label className="mt-3 block text-xs font-bold uppercase text-muted-foreground">
                    Other reason details
                    <textarea
                      aria-label={`Other Supervisor Reason for Tree ${pending.original_tree_no}`}
                      value={draft.otherReason}
                      onChange={(event) =>
                        updateDecisionDraft(pending.odk_instance_id, { otherReason: event.target.value })
                      }
                      className="mt-1 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm normal-case text-foreground"
                      required
                    />
                  </label>
                ) : null}

                {draft.action === "KEEP_EXISTING_CYCLE_RECORD" ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
                    The pending submission will be excluded from the proposed import. Audit reason: Duplicate harvest
                    entry already recorded in this cycle. The ODK submission remains unchanged.
                  </p>
                ) : null}
                {replacementRequested ? (
                  <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs font-black text-rose-950">
                    CORRECTION ACTION REQUIRED — Existing imported record requires controlled replacement before this
                    decision can be applied. The pending submission remains outside the normal import batch.
                  </p>
                ) : null}
                {draft.action === "DEFER_DECISION" ? (
                  <p className="mt-3 rounded-lg border bg-background p-3 text-xs font-semibold">
                    This issue remains unresolved and blocked from import.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void saveCycleDecision(pending)}
                    disabled={!canSave}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {decisionSaving === pending.odk_instance_id
                      ? "Saving…"
                      : pending.supervisor_decision
                        ? "Amend Supervisor Decision"
                        : "Save Supervisor Decision"}
                  </button>
                  <span
                    className={`text-xs font-bold ${
                      groupStatus?.groupMatches === true
                        ? "text-emerald-700"
                        : groupStatus?.groupMatches === false
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {groupStatus?.groupMatches === true
                      ? "Group fingerprint unchanged — decision amendment is available"
                      : groupStatus?.groupMatches === false
                        ? "This Tree Number’s source data changed after the decision was saved. Rescan and review again."
                        : "Checking this Tree Number’s source fingerprint…"}
                  </span>
                  {decisionMessage[pending.odk_instance_id] ? (
                    <span className="text-xs font-bold">{decisionMessage[pending.odk_instance_id]}</span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <p className="rounded-lg border bg-background p-2">
                    <span className="block font-bold uppercase text-muted-foreground">Group fingerprint</span>
                    {groupStatus?.groupMatches === true
                      ? "Unchanged"
                      : groupStatus?.groupMatches === false
                        ? "Changed"
                        : "Checking…"}
                  </p>
                  <p className="rounded-lg border bg-background p-2">
                    <span className="block font-bold uppercase text-muted-foreground">Live-source status</span>
                    {groupStatus?.liveSourceChanged ? "New source changes after this scan" : "Matches selected scan"}
                  </p>
                  <p className="rounded-lg border bg-background p-2">
                    <span className="block font-bold uppercase text-muted-foreground">Final import</span>
                    {groupStatus?.finalImportRequiresNewScan ? "New scan required" : "Batch fingerprint current"}
                  </p>
                </div>
                {pending.supervisor_decision ? (
                  <p className="mt-3 text-xs font-semibold text-muted-foreground">
                    Saved by {displayValue(pending.supervisor_admin_user)} at{" "}
                    {displayValue(pending.supervisor_decision_at)}. This decision may be amended while Harvest import
                    remains locked.
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b">
                <th className="p-2">Submitted Tree Number</th>
                <th className="p-2">Harvest Date</th>
                <th className="p-2">ODK Time</th>
                <th className="p-2">ODK Instance ID</th>
                <th className="p-2">Submitter / Device</th>
                <th className="p-2">Error Classification</th>
                <th className="p-2">Exact Error Message</th>
                <th className="p-2">Exists in TREE MASTER</th>
                <th className="p-2">Supervisor Decision</th>
              </tr>
            </thead>
            <tbody>
              {visibleErrors.map((row) => (
                <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                  <td className="p-2 font-bold">{displayValue(row.original_tree_no)}</td>
                  <td className="p-2">{displayDate(row.harvest_date)}</td>
                  <td className="p-2">{displayValue(row.odk_submission_timestamp)}</td>
                  <td className="p-2 font-mono">{row.odk_instance_id}</td>
                  <td className="p-2">
                    {displayValue(row.submitter_name)} / {displayValue(row.device_id)}
                  </td>
                  <td className="p-2">
                    <span className={`rounded-full border px-2 py-1 ${statusBadge(row.classification)}`}>
                      {row.classification}
                    </span>
                  </td>
                  <td className="p-2">{displayValue(row.note)}</td>
                  <td className="p-2">{row.tree_exists_in_master ? "Yes" : "No"}</td>
                  <td className="p-2">
                    {row.supervisor_decision
                      ? `${row.supervisor_decision}${row.supervisor_reason ? ` — ${row.supervisor_reason}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && errorRows.length === 0 && cycleCollisionGroups.length === 0 ? (
          <p className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground">
            No Tree Number or data errors match the selected scan and Harvest date.
          </p>
        ) : null}
        <Pagination
          page={errorPage}
          pageCount={errorPageCount}
          total={errorRows.length}
          unit="records"
          onPageChange={setErrorPage}
        />
      </Panel>

      <details className="rounded-xl border border-border bg-card shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-700" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground sm:text-base">
              EXACT DUPLICATES — AUTOMATICALLY RESOLVED
            </h2>
          </div>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {exactAuditGroups.length.toLocaleString("en-IN")} groups ·{" "}
            {exactAuditGroups.reduce((total, group) => total + group.superseded.length, 0).toLocaleString("en-IN")} source
            submissions superseded. Expand for read-only audit details.
          </p>
        </summary>
        <div className="border-t p-4 sm:p-5">
          <div className="space-y-3">
            {visibleExactGroups.map((group) => (
              <details key={group.key} className="rounded-xl border bg-background">
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Tree {displayValue(group.retained.original_tree_no)} · {displayDate(group.retained.harvest_date)} ·{" "}
                  {group.superseded.length} automatically superseded
                </summary>
                <div className="border-t p-4 text-xs">
                  <p>
                    <span className="font-bold">Retained ODK instance:</span>{" "}
                    <span className="font-mono">{group.retained.odk_instance_id}</span>
                  </p>
                  <p className="mt-1">
                    <span className="font-bold">Reason:</span> Automatically resolved under standing exact-duplicate
                    rule
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2">Disposition</th>
                          <th className="p-2">ODK Instance ID</th>
                          <th className="p-2">Submitter / Device</th>
                          <th className="p-2">ODK Time</th>
                          <th className="p-2">B1</th>
                          <th className="p-2">B2</th>
                          <th className="p-2">B3</th>
                          <th className="p-2">Bunch Count</th>
                          <th className="p-2">Total Nuts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[group.retained, ...group.superseded].map((row) => (
                          <tr key={row.odk_instance_id} className="border-b">
                            <td className="p-2 font-bold">{row === group.retained ? "Retained" : "Superseded"}</td>
                            <td className="p-2 font-mono">{row.odk_instance_id}</td>
                            <td className="p-2">
                              {displayValue(row.submitter_name)} / {displayValue(row.device_id)}
                            </td>
                            <td className="p-2">{displayValue(row.odk_submission_timestamp)}</td>
                            <td className="p-2">{displayValue(row.b1)}</td>
                            <td className="p-2">{displayValue(row.b2)}</td>
                            <td className="p-2">{displayValue(row.b3)}</td>
                            <td className="p-2">{displayValue(row.total_bunches)}</td>
                            <td className="p-2">{displayValue(row.total_nuts)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))}
          </div>
          {!loading && exactAuditGroups.length === 0 ? (
            <p className="rounded-xl border p-3 text-sm text-muted-foreground">
              No automatically resolved exact duplicates match the selected scan and Harvest date.
            </p>
          ) : null}
          <Pagination
            page={exactPage}
            pageCount={exactPageCount}
            total={exactAuditGroups.length}
            unit="groups"
            onPageChange={setExactPage}
          />
        </div>
      </details>
    </div>
  )
}
