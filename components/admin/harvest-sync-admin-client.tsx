"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, DatabaseZap, History, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { Panel } from "@/components/farm/panel"

interface SyncStatus {
  projectId: number
  formId: string
  importEnabled: boolean
  openCycle: { harvest_cycle: string; harvest_start_date: string; harvest_end_date: string | null; harvest_status: string } | null
  latestScan: any | null
  latestImport: any | null
  cycleSummary: { records: number; trees: number; bunches: number; nuts: number } | null
}

interface ScanData {
  scan: any
  items: any[]
}

interface ImportPlan {
  scanId: number
  targetHarvestDate: string
  harvestCycle: string
  dateScopedBatchFingerprint: string
  dateScopedFingerprintMatches: boolean
  globalSourceChanged: boolean
  globalSourceWarning: string | null
  confirmationToken: string
  confirmationPhrase: string
  candidateCount: number
  candidateBunches: number
  candidateNuts: number
  exactDuplicateGroupsReady: number
  cleanSinglesAutoReady: number
  conflictsResolved: number
  conflictsRemaining: number
  cycleBlockersResolved: number
  unresolvedGroupCount: number
  staleDecisionCount: number
  correctionRequiredCount: number
  hiddenEligibleCount: number
  resolvedExclusionCount: number
  manualConflictExclusionCount: number
  exactDuplicateSuperseded: number
  totalExcludedCount?: number
  readyForImport: boolean
  candidates: any[]
  unresolved: any[]
  resolvedExclusions: any[]
  supersededExactDuplicates: any[]
}

interface DateScopedBatchStatus {
  scanId: number
  scanTimestamp: string | null
  targetHarvestDate: string
  harvestCycle: string
  storedDateScopedBatchFingerprint: string
  currentDateScopedBatchFingerprint: string
  dateScopedFingerprintMatches: boolean
  storedGlobalSourceFingerprint: string
  currentGlobalSourceFingerprint: string
  globalSourceChanged: boolean
  globalSourceWarning: string | null
  checkedAt: string
  plan?: Partial<ImportPlan>
}

function n(value: unknown): string {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0"
}

function d(value: string | null | undefined): string {
  if (!value) return "—"
  return value.slice(0, 10)
}

function displayDate(value: string | null | undefined): string {
  const isoDate = d(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`))
}

function naturalTreeCompare(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

const CONFLICT_GROUP_PAGE_SIZE = 10
const EXACT_GROUP_PAGE_SIZE = 25
const RESOLVED_CONFLICT_DECISIONS = new Set(["SELECT_SUBMISSION", "KEEP_LATEST"])

function selectedConflictInstance(row: any): string | null {
  if (!RESOLVED_CONFLICT_DECISIONS.has(String(row?.supervisor_decision ?? ""))) return null
  const selected = row?.selected_effective_instance_id ?? row?.odk_instance_id
  return selected ? String(selected) : null
}

function isActiveValidConflictCandidate(row: any): boolean {
  const reviewState = String(row?.review_state ?? "").toLowerCase().replace(/\s+/g, "")
  return Boolean(
    row?.odk_instance_id &&
      row?.classification === "DUPLICATE_REVIEW_REQUIRED" &&
      !["deleted", "rejected", "hasissues"].includes(reviewState) &&
      ["b1", "b2", "b3", "total_bunches", "total_nuts"].every((field) => row[field] !== null && row[field] !== undefined),
  )
}

function conflictGroupResolved(rows: any[]): boolean {
  return rows.some((decisionRow) => {
    const selected = selectedConflictInstance(decisionRow)
    return Boolean(
      selected &&
        rows.some(
          (row) => String(row.odk_instance_id) === selected && isActiveValidConflictCandidate(row),
        ),
    )
  },
  )
}

async function blobSha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function batchStatusMatchesTarget(
  batch: DateScopedBatchStatus | null,
  scanId: unknown,
  harvestDate: string,
  harvestCycle: unknown,
): boolean {
  return Boolean(
    batch &&
      /^\d{4}-\d{2}-\d{2}$/.test(harvestDate) &&
      Number(batch.scanId) === Number(scanId) &&
      batch.targetHarvestDate === harvestDate &&
      String(batch.harvestCycle) === String(harvestCycle ?? ""),
  )
}

function excludedRecordCount(plan: Partial<ImportPlan> | undefined): number | null {
  if (!plan) return null
  if (plan.totalExcludedCount !== undefined) return Number(plan.totalExcludedCount)
  const fields = [
    plan.exactDuplicateSuperseded,
    plan.manualConflictExclusionCount,
    plan.resolvedExclusionCount,
  ]
  if (fields.every((value) => value === undefined)) return null
  return fields.reduce<number>((total, value) => total + Number(value ?? 0), 0)
}

export function HarvestSyncAdminClient() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [scan, setScan] = useState<ScanData | null>(null)
  const [issues, setIssues] = useState<any | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null)
  const [batchStatus, setBatchStatus] = useState<DateScopedBatchStatus | null>(null)
  const [batchStatusError, setBatchStatusError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scanIdInput, setScanIdInput] = useState("")
  const [dateFilter, setDateFilter] = useState("2026-07-29")
  const [treeFilter, setTreeFilter] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [conflictPage, setConflictPage] = useState(1)
  const [exactPage, setExactPage] = useState(1)
  const [scanLoadVersion, setScanLoadVersion] = useState(0)
  const [openConflictGroupKey, setOpenConflictGroupKey] = useState<string | null>(null)
  const [selectedInstanceByGroup, setSelectedInstanceByGroup] = useState<Record<string, string>>({})
  const [decisionReasonByGroup, setDecisionReasonByGroup] = useState<Record<string, string>>({})
  const [confirmationPhraseInput, setConfirmationPhraseInput] = useState("")
  const issuesRequestId = useRef(0)
  const batchStatusRequestId = useRef(0)
  const importPreviewRequestId = useRef(0)
  const decisionRequestId = useRef(0)
  const statusRequestId = useRef(0)

  function hydrateConflictReviewState(items: any[]) {
    const savedSelections: Record<string, string> = {}
    const savedReasons: Record<string, string> = {}
    for (const item of items) {
      const groupKey = item.group_key ?? `${d(item.harvest_date)}|${item.original_tree_no}`
      const selectedInstance = selectedConflictInstance(item)
      if (selectedInstance) {
        savedSelections[groupKey] = selectedInstance
        savedReasons[groupKey] = String(item.supervisor_reason ?? "")
      }
    }
    setSelectedInstanceByGroup(savedSelections)
    setDecisionReasonByGroup(savedReasons)
  }

  async function loadStatus(): Promise<SyncStatus | null> {
    const requestId = ++statusRequestId.current
    try {
      const response = await fetch("/api/admin/harvest-sync/status", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? "Unable to verify Harvest import lock status")
      }
      if (requestId !== statusRequestId.current) return null
      setStatus(data as SyncStatus)
      return data as SyncStatus
    } catch (error) {
      if (requestId !== statusRequestId.current) return null
      setStatus(null)
      setImportPlan(null)
      setMessage({
        ok: false,
        text: `${
          error instanceof Error ? error.message : "Unable to verify Harvest import lock status"
        }. Harvest import remains locked in this page.`,
      })
      return null
    }
  }

  async function loadIssues(scanId?: number) {
    const requestId = ++issuesRequestId.current
    setIssues(null)
    const query = scanId ? `?scan_id=${scanId}` : ""
    try {
      const response = await fetch(`/api/admin/harvest-sync/issues${query}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? "Unable to load scan issues")
      }
      if (scanId && Number(data?.scan?.id ?? 0) !== scanId) {
        throw new Error(`Issue response did not match requested Scan ${scanId}`)
      }
      if (requestId !== issuesRequestId.current) return null
      setIssues(data)
      return data
    } catch (error) {
      if (requestId !== issuesRequestId.current) return null
      setIssues(null)
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to load scan issues" })
      return null
    }
  }

  async function loadScan(scanId: number) {
    setBusy("load-scan")
    setMessage(null)
    batchStatusRequestId.current += 1
    importPreviewRequestId.current += 1
    decisionRequestId.current += 1
    setBatchStatus(null)
    setBatchStatusError(null)
    setImportPlan(null)
    try {
      const response = await fetch(`/api/admin/harvest-sync/scans/${scanId}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Unable to load scan")
      setScan(data)
      hydrateConflictReviewState(data.items ?? [])
      setScanIdInput(String(scanId))
      setImportPlan(null)
      setConflictPage(1)
      setExactPage(1)
      await loadIssues(scanId)
      setScanLoadVersion((version) => version + 1)
      return data as ScanData
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to load scan" })
      return null
    } finally {
      setBusy(null)
    }
  }

  async function loadHistory() {
    const response = await fetch("/api/admin/harvest-sync/history", { cache: "no-store" })
    if (response.ok) setHistory(((await response.json()) as { runs?: any[] }).runs ?? [])
  }

  async function loadBatchStatus(scanId: number, harvestDate: string) {
    const requestId = ++batchStatusRequestId.current
    const cycle = status?.openCycle?.harvest_cycle
    if (!scanId || !harvestDate || !cycle) {
      setBatchStatus(null)
      setBatchStatusError(null)
      return null
    }
    setBatchStatus(null)
    setBatchStatusError(null)
    try {
      const query = new URLSearchParams({
        harvest_date: harvestDate,
        harvest_cycle: String(cycle),
      })
      const response = await fetch(
        `/api/admin/harvest-sync/scans/${scanId}/batch-status?${query.toString()}`,
        { cache: "no-store" },
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? "Unable to verify the date-scoped batch")
      }
      if (
        Number(data?.scanId ?? 0) !== scanId ||
        data?.targetHarvestDate !== harvestDate ||
        String(data?.harvestCycle ?? "") !== String(cycle)
      ) {
        throw new Error("Date-scoped batch response did not match the requested Scan, Harvest Date and Cycle")
      }
      if (requestId !== batchStatusRequestId.current) return null
      setBatchStatus(data as DateScopedBatchStatus)
      setBatchStatusError(null)
      return data as DateScopedBatchStatus
    } catch (error) {
      if (requestId !== batchStatusRequestId.current) return null
      setBatchStatus(null)
      setBatchStatusError(error instanceof Error ? error.message : "Unable to verify the date-scoped batch")
      return null
    }
  }

  useEffect(() => {
    async function bootstrap() {
      const current = await loadStatus()
      await Promise.all([
        current?.latestScan?.id ? loadScan(Number(current.latestScan.id)) : loadIssues(),
        loadHistory(),
      ])
    }
    void bootstrap()
  }, [])

  useEffect(() => {
    const scanId = Number(scan?.scan?.id ?? status?.latestScan?.id ?? 0)
    importPreviewRequestId.current += 1
    decisionRequestId.current += 1
    setImportPlan(null)
    setConfirmationPhraseInput("")
    if (scanId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter) && status?.openCycle?.harvest_cycle) {
      void loadBatchStatus(scanId, dateFilter)
    } else {
      setBatchStatus(null)
      setBatchStatusError(null)
    }
  }, [scan?.scan?.id, status?.latestScan?.id, status?.openCycle?.harvest_cycle, dateFilter, scanLoadVersion])

  const latestScan = scan?.scan ?? status?.latestScan ?? null
  const hasValidTargetDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)
  const batchStatusMatchesSelection = batchStatusMatchesTarget(
    batchStatus,
    latestScan?.id,
    dateFilter,
    status?.openCycle?.harvest_cycle,
  )
  const selectedBatchStatus = batchStatusMatchesSelection ? batchStatus : null
  const importPlanMatchesSelection = Boolean(
    importPlan &&
      Number(importPlan.scanId) === Number(latestScan?.id) &&
      importPlan.targetHarvestDate === dateFilter &&
      String(importPlan.harvestCycle) === String(status?.openCycle?.harvest_cycle ?? "") &&
      importPlan.dateScopedBatchFingerprint === selectedBatchStatus?.storedDateScopedBatchFingerprint,
  )
  const issueCounts = useMemo(() => {
    const source = scan?.scan ?? issues?.scan ?? status?.latestScan
    return {
      ready: Number(source?.ready_new_count ?? 0),
      duplicates: Number(source?.duplicate_group_count ?? 0),
      duplicateReview: Number(source?.duplicate_review_count ?? 0),
      exactDuplicateGroups: Number(source?.exact_duplicate_group_count ?? 0),
      exactDuplicateSuperseded: Number(source?.exact_duplicate_superseded_count ?? 0),
      exactDuplicateRetained: Number(source?.exact_duplicate_retained_count ?? 0),
      unmatched: Number(source?.unmatched_tree_count ?? 0),
      invalid: Number(source?.invalid_data_count ?? 0),
      deletedRejected: Number(source?.rejected_count ?? 0) + Number(source?.has_issues_count ?? 0),
      late: Number(source?.late_submission_count ?? 0),
    }
  }, [scan, issues, status])

  async function scanOdk() {
    setBusy("scan")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Scan failed")
      setScan(data)
      hydrateConflictReviewState(data.items ?? [])
      setScanIdInput(String(data.scan.id))
      setImportPlan(null)
      setConflictPage(1)
      setExactPage(1)
      setMessage({ ok: true, text: `Scan ${data.scan.id} complete. Review issues before importing.` })
      await Promise.all([loadStatus(), loadIssues(Number(data.scan.id)), loadHistory()])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Scan failed" })
    } finally {
      setBusy(null)
    }
  }

  async function prepareImport() {
    const scanId = latestScan?.id
    const cycle = status?.openCycle?.harvest_cycle
    if (!scanId || !hasValidTargetDate || !cycle) {
      setMessage({ ok: false, text: "Select a Scan ID, Harvest Date and open Harvest cycle before preparing the batch." })
      return
    }
    if (!batchStatusMatchesSelection || !batchStatus?.storedDateScopedBatchFingerprint) {
      setMessage({ ok: false, text: "Verify the date-scoped batch fingerprint before preparing the final import set." })
      return
    }
    const targetHarvestDate = dateFilter
    const targetHarvestCycle = String(cycle)
    const targetBatchFingerprint = batchStatus.storedDateScopedBatchFingerprint
    const requestId = ++importPreviewRequestId.current
    setBusy("preview-import")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: scanId,
          harvest_date: targetHarvestDate,
          harvest_cycle: targetHarvestCycle,
          date_scoped_batch_fingerprint: targetBatchFingerprint,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Unable to prepare final import summary")
      if (requestId !== importPreviewRequestId.current) return
      if (
        Number(data?.plan?.scanId ?? 0) !== Number(scanId) ||
        data?.plan?.targetHarvestDate !== targetHarvestDate ||
        String(data?.plan?.harvestCycle ?? "") !== targetHarvestCycle ||
        data?.plan?.dateScopedBatchFingerprint !== targetBatchFingerprint
      ) {
        throw new Error("Import preview response did not match the requested Scan, Harvest Date, Cycle and fingerprint")
      }
      setImportPlan(data.plan)
      setConfirmationPhraseInput("")
      setMessage({
        ok: Boolean(data.plan?.readyForImport),
        text: data.plan?.readyForImport
          ? "Date-scoped final import set prepared. Review every record before confirming."
          : "Date-scoped preview prepared, but unresolved or unsafe groups still block final import.",
      })
    } catch (error) {
      if (requestId !== importPreviewRequestId.current) return
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to prepare final import summary" })
    } finally {
      setBusy(null)
    }
  }

  async function importApproved() {
    const scanId = latestScan?.id
    const cycle = status?.openCycle?.harvest_cycle
    if (!scanId || !importPlan || !hasValidTargetDate || !cycle || !importPlanMatchesSelection) {
      setMessage({ ok: false, text: "Review the final import set before confirming." })
      return
    }
    if (!status?.importEnabled) {
      setMessage({ ok: false, text: "PREVIEW REVIEW MODE — HARVEST IMPORT DISABLED" })
      return
    }
    setBusy("import")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: scanId,
          harvest_date: dateFilter,
          harvest_cycle: String(cycle),
          date_scoped_batch_fingerprint: importPlan.dateScopedBatchFingerprint,
          mode: "approved",
          confirmation_token: importPlan.confirmationToken,
          confirmation_phrase: confirmationPhraseInput.trim(),
          expected_record_count: importPlan.candidateCount,
          expected_total_bunches: importPlan.candidateBunches,
          expected_total_nuts: importPlan.candidateNuts,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Import failed")
      setMessage({ ok: true, text: `Import finished: ${data.result.result}. Imported ${data.result.imported} rows.` })
      setImportPlan(null)
      setConfirmationPhraseInput("")
      await Promise.all([loadStatus(), loadIssues(), loadHistory()])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Import failed" })
    } finally {
      setBusy(null)
    }
  }

  async function downloadDateScopedCsv(kind: "pre-import" | "date-audit") {
    const scanId = latestScan?.id
    const cycle = status?.openCycle?.harvest_cycle
    if (
      !scanId ||
      !hasValidTargetDate ||
      !cycle ||
      !batchStatusMatchesSelection ||
      !batchStatus?.storedDateScopedBatchFingerprint
    ) {
      setMessage({ ok: false, text: "A verified Scan ID, Harvest Date and date-scoped fingerprint are required." })
      return
    }
    const busyKey = kind === "pre-import" ? "pre-import-csv" : "audit-csv"
    setBusy(busyKey)
    setMessage(null)
    try {
      const query = new URLSearchParams({
        harvest_date: dateFilter,
        harvest_cycle: String(cycle),
        date_scoped_batch_fingerprint: batchStatus.storedDateScopedBatchFingerprint,
      })
      const response = await fetch(
        `/api/admin/harvest-sync/scans/${scanId}/${kind}.csv?${query.toString()}`,
        { cache: "no-store" },
      )
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `Unable to create ${kind === "pre-import" ? "pre-import" : "audit"} CSV`)
      }
      const expectedSha256 = response.headers.get("x-content-sha256")?.trim().toLowerCase()
      if (!expectedSha256 || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new Error("CSV response did not include a valid X-Content-SHA256 integrity header")
      }
      const blob = await response.blob()
      const actualSha256 = await blobSha256Hex(blob)
      if (actualSha256 !== expectedSha256) {
        throw new Error(`CSV integrity verification failed: expected ${expectedSha256}, received ${actualSha256}`)
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download =
        kind === "pre-import"
          ? `harvest-sync-scan-${scanId}-${dateFilter}-pre-import.csv`
          : `harvest-sync-scan-${scanId}-${dateFilter}-audit.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage({
        ok: true,
        text: `${kind === "pre-import" ? "Pre-import" : "Audit"} CSV downloaded and verified. SHA-256: ${actualSha256}`,
      })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to create date-scoped CSV" })
    } finally {
      setBusy(null)
    }
  }

  async function saveConflictSelection(groupKey: string, rows: any[], openNextUnresolved: boolean) {
    const selectedInstance = selectedInstanceByGroup[groupKey]
    const reason = decisionReasonByGroup[groupKey]?.trim()
    if (!selectedInstance || !reason) {
      setMessage({ ok: false, text: "Select the correct ODK submission and record a supervisor reason." })
      return
    }
    if (!hasValidTargetDate || !batchStatusMatchesSelection) {
      setMessage({
        ok: false,
        text: "A valid Harvest Date and matching date-scoped batch verification are required before saving a decision.",
      })
      return
    }
    const selectedRow = rows.find((row) => String(row.odk_instance_id) === String(selectedInstance))
    if (!selectedRow || !isActiveValidConflictCandidate(selectedRow)) {
      setMessage({ ok: false, text: "Select an active, valid conflicting submission before saving." })
      return
    }
    const requestId = ++decisionRequestId.current
    const decisionScanId = Number(latestScan?.id)
    const decisionHarvestDate = dateFilter
    const decisionHarvestCycle = String(status?.openCycle?.harvest_cycle ?? "")
    const anchorRow = selectedRow
    const currentGroupIndex = allDateConflictGroups.findIndex(([key]) => key === groupKey)
    const orderedFollowingGroups = [
      ...allDateConflictGroups.slice(currentGroupIndex + 1),
      ...allDateConflictGroups.slice(0, Math.max(0, currentGroupIndex)),
    ]
    const nextUnresolved = orderedFollowingGroups.find(([, candidateRows]) => !conflictGroupResolved(candidateRows))
    setBusy(`decision-${groupKey}`)
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: latestScan?.id,
          odk_instance_id: anchorRow.odk_instance_id,
          issue_type: "CONFLICTING_DUPLICATE",
          decision: "SELECT_SUBMISSION",
          selected_effective_instance_id: selectedInstance,
          reason,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Unable to save supervisor selection")
      if (requestId !== decisionRequestId.current) return
      if (
        decisionScanId !== Number(latestScan?.id) ||
        decisionHarvestDate !== dateFilter ||
        decisionHarvestCycle !== String(status?.openCycle?.harvest_cycle ?? "")
      ) {
        throw new Error("The selected Scan, Harvest Date or Cycle changed while the decision was being saved")
      }
      setMessage({ ok: true, text: `Supervisor selection saved for Tree ${anchorRow.original_tree_no}. No Harvest record was imported.` })
      setImportPlan(null)
      await Promise.all([loadScan(Number(latestScan?.id)), loadHistory()])
      if (openNextUnresolved && nextUnresolved) {
        const nextIndex = allDateConflictGroups.findIndex(([key]) => key === nextUnresolved[0])
        setTreeFilter("")
        setConflictPage(Math.floor(nextIndex / CONFLICT_GROUP_PAGE_SIZE) + 1)
        setOpenConflictGroupKey(nextUnresolved[0])
        setMessage({
          ok: true,
          text: `Supervisor selection saved for Tree ${anchorRow.original_tree_no}. Opened the next unresolved group; no Harvest record was imported.`,
        })
      } else {
        setOpenConflictGroupKey(null)
        setMessage({
          ok: true,
          text: `Supervisor selection saved for Tree ${anchorRow.original_tree_no}. No Harvest record was imported.`,
        })
      }
    } catch (error) {
      if (requestId !== decisionRequestId.current) return
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save supervisor selection" })
    } finally {
      setBusy(null)
    }
  }

  const dateScopedItems = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) return []
    return (scan?.items ?? [])
      .filter((item) => d(item.harvest_date) === dateFilter)
      .sort((left, right) => {
        const compared = naturalTreeCompare(left.original_tree_no, right.original_tree_no)
        if (compared !== 0) return sortDirection === "asc" ? compared : -compared
        return String(left.odk_submission_timestamp ?? "").localeCompare(String(right.odk_submission_timestamp ?? ""))
      })
  }, [scan, dateFilter, sortDirection])
  const selectedItems = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase()
    return dateScopedItems.filter(
      (item) => !query || String(item.original_tree_no ?? "").toLocaleLowerCase().includes(query),
    )
  }, [dateScopedItems, treeFilter])

  const selectedTreeGroupCount = useMemo(
    () => new Set(selectedItems.map((item) => item.group_key ?? `${d(item.harvest_date)}|${item.original_tree_no}`)).size,
    [selectedItems],
  )
  const selectedGroups = useMemo(() => {
    const grouped = new Map<string, any[]>()
    for (const item of selectedItems) {
      const key = item.group_key ?? `${d(item.harvest_date)}|${item.original_tree_no}`
      grouped.set(key, [...(grouped.get(key) ?? []), item])
    }
    return [...grouped.entries()]
  }, [selectedItems])
  const dateScopedGroups = useMemo(() => {
    const grouped = new Map<string, any[]>()
    for (const item of dateScopedItems) {
      const key = item.group_key ?? `${d(item.harvest_date)}|${item.original_tree_no}`
      grouped.set(key, [...(grouped.get(key) ?? []), item])
    }
    return [...grouped.entries()]
  }, [dateScopedItems])
  const singleRows = selectedGroups.filter(([, rows]) => rows.length === 1).map(([, rows]) => rows[0])
  const dateScopedSingleRows = dateScopedGroups.filter(([, rows]) => rows.length === 1).map(([, rows]) => rows[0])
  const cleanSingleRows = singleRows.filter(
    (item) => item.classification === "READY_NEW" || item.classification === "SINGLE_VALID_AUTO_READY",
  )
  const dateScopedCleanSingleRows = dateScopedSingleRows.filter(
    (item) => item.classification === "READY_NEW" || item.classification === "SINGLE_VALID_AUTO_READY",
  )
  const allConflictGroups = useMemo(() => {
    return selectedGroups
      .filter(([, rows]) => rows.length > 1 && rows.some((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED"))
      .sort((left, right) => {
      const compared = naturalTreeCompare(left[1][0]?.original_tree_no, right[1][0]?.original_tree_no)
      return sortDirection === "asc" ? compared : -compared
    })
  }, [selectedGroups, sortDirection])
  const allDateConflictGroups = useMemo(() => {
    return dateScopedGroups
      .filter(([, rows]) => rows.length > 1 && rows.some((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED"))
      .sort((left, right) => {
        const compared = naturalTreeCompare(left[1][0]?.original_tree_no, right[1][0]?.original_tree_no)
        return sortDirection === "asc" ? compared : -compared
      })
  }, [dateScopedGroups, sortDirection])
  const allConflictRows = allConflictGroups.flatMap(([, rows]) => rows)
  const cycleReviewRows = singleRows.filter((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED")
  const dateScopedCycleReviewRows = dateScopedSingleRows.filter(
    (item) => item.classification === "DUPLICATE_REVIEW_REQUIRED",
  )
  const conflictingGroupCount = allConflictGroups.length
  const resolvedConflictCount = allConflictGroups.filter(([, rows]) => conflictGroupResolved(rows)).length
  const dateScopedResolvedConflictCount = allDateConflictGroups.filter(([, rows]) =>
    conflictGroupResolved(rows),
  ).length
  const remainingConflictCount = conflictingGroupCount - resolvedConflictCount
  const dateScopedRemainingConflictCount = allDateConflictGroups.length - dateScopedResolvedConflictCount
  const dateScopedResolvedCycleBlockerCount = dateScopedCycleReviewRows.filter(
    (item) => item.supervisor_decision === "KEEP_EXISTING_CYCLE_RECORD",
  ).length
  const dateScopedRemainingCycleBlockerCount =
    dateScopedCycleReviewRows.length - dateScopedResolvedCycleBlockerCount
  const conflictPageCount = Math.max(1, Math.ceil(allConflictGroups.length / CONFLICT_GROUP_PAGE_SIZE))
  const visibleConflictGroups = allConflictGroups.slice(
    (conflictPage - 1) * CONFLICT_GROUP_PAGE_SIZE,
    conflictPage * CONFLICT_GROUP_PAGE_SIZE,
  )
  const dateScopedExactDuplicateGroups = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) return []
    return [...(issues?.groups?.exactDuplicateGroups ?? [])]
      .filter((group: any) => d(group.harvestDate) === dateFilter)
      .sort((left: any, right: any) => {
        const compared = naturalTreeCompare(left.treeNo, right.treeNo)
        return sortDirection === "asc" ? compared : -compared
      })
  }, [issues, dateFilter, sortDirection])
  const exactDuplicateGroups = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase()
    return dateScopedExactDuplicateGroups.filter(
      (group: any) => !query || String(group.treeNo ?? "").toLocaleLowerCase().includes(query),
    )
  }, [dateScopedExactDuplicateGroups, treeFilter])
  const exactPageCount = Math.max(1, Math.ceil(exactDuplicateGroups.length / EXACT_GROUP_PAGE_SIZE))
  const visibleExactDuplicateGroups = exactDuplicateGroups.slice(
    (exactPage - 1) * EXACT_GROUP_PAGE_SIZE,
    exactPage * EXACT_GROUP_PAGE_SIZE,
  )
  const selectedExactSupersededCount = exactDuplicateGroups.reduce(
    (total: number, group: any) => total + Number(group.superseded?.length ?? 0),
    0,
  )
  const dateScopedExactSupersededCount = dateScopedExactDuplicateGroups.reduce(
    (total: number, group: any) => total + Number(group.superseded?.length ?? 0),
    0,
  )
  const unmatchedRows = selectedItems.filter((item) => item.classification === "UNMATCHED_TREE")
  const fallbackEffectiveRecordCount =
    dateScopedExactDuplicateGroups.length + dateScopedCleanSingleRows.length + dateScopedResolvedConflictCount
  const fallbackExcludedCount =
    dateScopedExactSupersededCount +
    allDateConflictGroups
      .filter(([, rows]) => conflictGroupResolved(rows))
      .reduce((total, [, rows]) => total + Math.max(0, rows.length - 1), 0) +
    dateScopedResolvedCycleBlockerCount
  const backendExcludedCount = excludedRecordCount(selectedBatchStatus?.plan)
  const blockingDataRows = selectedItems.filter((item) =>
    [
      "UNMATCHED_TREE",
      "INVALID_DATA",
      "ODK_HAS_ISSUES",
      "ODK_DELETED",
      "ODK_REJECTED",
      "LATE_SUBMISSION",
      "IMPORT_ERROR",
      "FAILED",
    ].includes(item.classification),
  )
  const displayedBatchStatus = {
    exactDuplicateGroupsReady:
      selectedBatchStatus?.plan?.exactDuplicateGroupsReady ?? dateScopedExactDuplicateGroups.length,
    cleanSinglesAutoReady: selectedBatchStatus?.plan?.cleanSinglesAutoReady ?? dateScopedCleanSingleRows.length,
    conflictsResolved: selectedBatchStatus?.plan?.conflictsResolved ?? dateScopedResolvedConflictCount,
    conflictsRemaining: selectedBatchStatus?.plan?.conflictsRemaining ?? dateScopedRemainingConflictCount,
    cycleBlockersResolved: selectedBatchStatus?.plan?.cycleBlockersResolved ?? dateScopedResolvedCycleBlockerCount,
    cycleBlockersRemaining: dateScopedRemainingCycleBlockerCount,
    effectiveRecordsReady: selectedBatchStatus?.plan?.candidateCount ?? fallbackEffectiveRecordCount,
    recordsExcluded: backendExcludedCount ?? fallbackExcludedCount,
    unresolvedGroups:
      selectedBatchStatus?.plan?.unresolvedGroupCount ??
      dateScopedRemainingConflictCount + dateScopedRemainingCycleBlockerCount,
    staleDecisions: selectedBatchStatus?.plan?.staleDecisionCount ?? 0,
    correctionRequired: selectedBatchStatus?.plan?.correctionRequiredCount ?? blockingDataRows.length,
    hiddenEligible: selectedBatchStatus?.plan?.hiddenEligibleCount ?? 0,
    readyForImport: Boolean(selectedBatchStatus?.plan?.readyForImport),
  }

  useEffect(() => {
    setConflictPage(1)
    setExactPage(1)
  }, [dateFilter, sortDirection])

  return (
    <div className="space-y-5">
      {status?.importEnabled !== true ? (
        <section className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 text-center text-sm font-black text-rose-950">
          PREVIEW REVIEW MODE — HARVEST IMPORT DISABLED
        </section>
      ) : null}
      <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-black uppercase">Preview-only Harvest ODK Sync</p>
            <p className="mt-1 font-semibold">Workflow: Scan ODK → Review Issues → Import Approved. Project/Form are fixed server-side to Project 17 / mfms_preview_harvest_test_v1.</p>
          </div>
        </div>
      </section>

      <Panel title="Current Open Cycle & Source" icon={DatabaseZap}>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-background p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Open Cycle</p><p className="text-2xl font-black">{status?.openCycle ? `Cycle ${status.openCycle.harvest_cycle}` : "None"}</p></div>
          <div className="rounded-xl border bg-background p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Start / End</p><p className="font-bold">{d(status?.openCycle?.harvest_start_date)} → {d(status?.openCycle?.harvest_end_date)}</p></div>
          <div className="rounded-xl border bg-background p-4"><p className="text-xs font-bold uppercase text-muted-foreground">ODK Source</p><p className="font-bold">Project {status?.projectId ?? 17}</p><p className="text-xs">{status?.formId ?? "mfms_preview_harvest_test_v1"}</p></div>
          <div className="rounded-xl border bg-background p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Cycle Totals</p><p className="font-bold">{n(status?.cycleSummary?.trees)} trees / {n(status?.cycleSummary?.bunches)} bunches / {n(status?.cycleSummary?.nuts)} nuts</p></div>
        </div>
      </Panel>

      <Panel title="Manual Sync Actions" icon={Search}>
        <div className="mb-4 grid gap-3 rounded-xl border bg-muted/30 p-3 md:grid-cols-[10rem_1fr_13rem_auto]">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Scan ID
            <input
              value={scanIdInput}
              onChange={(event) => setScanIdInput(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              disabled={busy !== null}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
              aria-label="Scan ID"
            />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Harvest Date
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              disabled={busy !== null}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Tree Number Search
            <input
              value={treeFilter}
              onChange={(event) => {
                setTreeFilter(event.target.value)
                setConflictPage(1)
                setExactPage(1)
              }}
              disabled={busy !== null}
              placeholder="For example, 845.1"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Tree Sort
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              disabled={busy !== null}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="asc">Natural ascending</option>
              <option value="desc">Natural descending</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void scanOdk()} disabled={busy !== null} className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy === "scan" ? "Scanning..." : "Scan ODK"}</button>
          <button
            onClick={() => {
              const requested = Number(scanIdInput)
              if (requested > 0) void loadScan(requested)
            }}
            disabled={busy !== null || Number(scanIdInput) <= 0}
            className="rounded-lg border px-4 py-2 text-sm font-extrabold disabled:opacity-60"
          >
            {busy === "load-scan" ? "Loading..." : "Open Scan"}
          </button>
          <button onClick={() => void loadIssues(Number(latestScan?.id) || undefined)} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-extrabold">Review Issues</button>
          <button
            onClick={() => void prepareImport()}
            disabled={
              busy !== null ||
              !latestScan ||
              !hasValidTargetDate ||
              !batchStatusMatchesSelection ||
              !selectedBatchStatus?.dateScopedFingerprintMatches
            }
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy === "preview-import" ? "Preparing..." : "Review Date-Scoped Import Set"}
          </button>
          <button
            onClick={() => void downloadDateScopedCsv("pre-import")}
            disabled={
              busy !== null ||
              !latestScan ||
              !batchStatusMatchesSelection ||
              !selectedBatchStatus?.dateScopedFingerprintMatches ||
              !displayedBatchStatus.readyForImport
            }
            className="rounded-lg border px-4 py-2 text-sm font-extrabold disabled:opacity-60"
          >
            {busy === "pre-import-csv" ? "Preparing CSV..." : "Download Complete Pre-Import CSV"}
          </button>
          <button
            onClick={() => void downloadDateScopedCsv("date-audit")}
            disabled={
              busy !== null ||
              !latestScan ||
              !batchStatusMatchesSelection ||
              !selectedBatchStatus?.dateScopedFingerprintMatches
            }
            className="rounded-lg border px-4 py-2 text-sm font-extrabold disabled:opacity-60"
          >
            {busy === "audit-csv" ? "Preparing CSV..." : "Download Complete Audit CSV"}
          </button>
          <button onClick={() => void loadHistory()} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-extrabold">View Import History</button>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Showing {n(selectedItems.length)} submissions in {n(selectedTreeGroupCount)} tree/date groups for{" "}
          {hasValidTargetDate ? dateFilter : "no valid Harvest Date"}.
        </p>
        {message ? (
          <div className={`mt-4 rounded-xl border p-3 text-sm font-bold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {message.ok ? <CheckCircle2 className="mr-2 inline size-4" /> : <AlertTriangle className="mr-2 inline size-4" />}
            {message.text}
          </div>
        ) : null}
      </Panel>

      <Panel title="Date-Scoped Batch Readiness" icon={ShieldCheck}>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Target Harvest Date</p>
            <p className="font-black">{displayDate(dateFilter)}</p>
            <p className="text-xs">Cycle {status?.openCycle?.harvest_cycle ?? "—"}</p>
          </div>
          <div className={`rounded-xl border p-3 ${selectedBatchStatus?.dateScopedFingerprintMatches ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <p className="text-xs font-bold uppercase text-muted-foreground">Date-Scoped Fingerprint</p>
            <p className="font-black">{selectedBatchStatus?.dateScopedFingerprintMatches ? "CURRENT" : "STALE / UNVERIFIED"}</p>
            <p className="mt-1 break-all font-mono text-[10px]">{selectedBatchStatus?.storedDateScopedBatchFingerprint ?? "—"}</p>
          </div>
          <div className={`rounded-xl border p-3 ${selectedBatchStatus?.globalSourceChanged ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-xs font-bold uppercase text-muted-foreground">Global ODK Source</p>
            <p className="font-black">{selectedBatchStatus ? (selectedBatchStatus.globalSourceChanged ? "NEWER SOURCE EXISTS" : "UNCHANGED") : "CHECKING"}</p>
            <p className="text-xs">Unrelated dates never enter this date-scoped batch.</p>
          </div>
          <div className={`rounded-xl border p-3 ${displayedBatchStatus.readyForImport ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
            <p className="text-xs font-bold uppercase text-muted-foreground">Batch Readiness</p>
            <p className="font-black">{selectedBatchStatus ? (displayedBatchStatus.readyForImport ? "READY" : "REVIEW REQUIRED") : "VERIFYING"}</p>
            <p className="text-xs">{n(displayedBatchStatus.unresolvedGroups)} unresolved groups</p>
          </div>
        </div>
        {selectedBatchStatus?.globalSourceChanged ? (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            {selectedBatchStatus.globalSourceWarning ??
              `New ODK source changes exist after Scan ${latestScan?.id}. The ${displayDate(dateFilter)} batch remains valid only while its date-scoped fingerprint is unchanged.`}
          </div>
        ) : null}
        {batchStatusError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
            {batchStatusError}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Exact Duplicates Auto-Resolved</p><p className="text-2xl font-black text-emerald-700">{n(displayedBatchStatus.exactDuplicateGroupsReady)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Clean Singles Auto-Ready</p><p className="text-2xl font-black text-emerald-700">{n(displayedBatchStatus.cleanSinglesAutoReady)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Conflicts Resolved</p><p className="text-2xl font-black">{n(displayedBatchStatus.conflictsResolved)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Conflicts Remaining</p><p className="text-2xl font-black text-rose-700">{n(displayedBatchStatus.conflictsRemaining)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Cycle Blockers Resolved</p><p className="text-2xl font-black">{n(displayedBatchStatus.cycleBlockersResolved)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Effective Records Ready</p><p className="text-2xl font-black text-sky-800">{n(displayedBatchStatus.effectiveRecordsReady)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Records Excluded</p><p className="text-2xl font-black">{n(displayedBatchStatus.recordsExcluded)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Stale Decisions</p><p className="text-2xl font-black text-rose-700">{n(displayedBatchStatus.staleDecisions)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Correction Required</p><p className="text-2xl font-black text-rose-700">{n(displayedBatchStatus.correctionRequired)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Hidden Eligible Candidates</p><p className="text-2xl font-black text-rose-700">{n(displayedBatchStatus.hiddenEligible)}</p></div>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Selected Scan #{latestScan?.id ?? "—"} · {selectedBatchStatus?.scanTimestamp ?? latestScan?.scan_ended_at ?? "Timestamp unavailable"}.
          Final import remains blocked unless every displayed safety count is clear and the date-scoped fingerprint still matches.
        </p>
      </Panel>

      {importPlan && importPlanMatchesSelection ? (
        <Panel title="Final Reviewed Import Summary" icon={CheckCircle2}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Effective Records</p><p className="text-2xl font-black">{n(importPlan.candidateCount)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Bunches / Nuts</p><p className="font-black">{n(importPlan.candidateBunches)} / {n(importPlan.candidateNuts)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Exact / Single Ready</p><p className="font-black">{n(importPlan.exactDuplicateGroupsReady)} / {n(importPlan.cleanSinglesAutoReady)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Unresolved</p><p className="text-2xl font-black text-rose-700">{n(importPlan.unresolvedGroupCount)}</p></div>
          </div>
          <p className="mt-3 text-sm font-bold">
            Target: {displayDate(importPlan.targetHarvestDate)} · Cycle {importPlan.harvestCycle} ·
            {importPlan.readyForImport ? " Ready for controlled confirmation" : " Review is incomplete"}
          </p>
          <div className="mt-4 max-h-72 overflow-auto rounded-xl border">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-background"><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Cycle</th><th className="p-2">Tree</th><th className="p-2">ODK Instance</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Selection Method</th><th className="p-2">Excluded ODK Instances</th><th className="p-2">Supervisor Decision / Reason</th></tr></thead>
              <tbody>{importPlan.candidates.map((row: any) => <tr key={row.odk_instance_id} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2">{importPlan.harvestCycle}</td><td className="p-2 font-bold">{row.import_tree_no}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td><td className="p-2 font-bold">{row.selection_method ?? row.classification}</td><td className="p-2 font-mono">{Array.isArray(row.excluded_odk_instance_ids) ? row.excluded_odk_instance_ids.join(", ") : row.excluded_odk_instance_ids || "—"}</td><td className="p-2">{row.supervisor_decision ? `${row.supervisor_decision}: ${row.supervisor_reason || "—"}` : "—"}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Confirming inserts exactly the effective records listed above for {displayDate(importPlan.targetHarvestDate)}.
            A changed date-scoped fingerprint, candidate count or total invalidates this confirmation.
          </div>
          <label className="mt-4 block text-xs font-bold uppercase text-muted-foreground">
            Dynamic confirmation phrase
            <input
              value={confirmationPhraseInput}
              onChange={(event) => setConfirmationPhraseInput(event.target.value)}
              disabled={status?.importEnabled !== true || !importPlan.readyForImport || !importPlanMatchesSelection}
              placeholder={importPlan.confirmationPhrase}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
            Required phrase: {importPlan.confirmationPhrase}
          </p>
          <button
            onClick={() => void importApproved()}
            disabled={
              busy !== null ||
              status?.importEnabled !== true ||
              !importPlanMatchesSelection ||
              !importPlan.readyForImport ||
              confirmationPhraseInput.trim() !== importPlan.confirmationPhrase
            }
            className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status?.importEnabled !== true ? "Harvest Import Disabled" : busy === "import" ? "Importing..." : "Confirm Final Batch Import"}
          </button>
        </Panel>
      ) : null}

      <Panel title="Scan Summary / Next Action Required" icon={RefreshCw}>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Last Scan</p><p className="font-black">{latestScan ? `#${latestScan.id}` : "—"}</p><p className="text-xs">{latestScan?.scan_ended_at ?? ""}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Clean Ready</p><p className="text-2xl font-black text-emerald-700">{n(issueCounts.ready)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Duplicate Groups</p><p className="text-2xl font-black text-amber-700">{n(issueCounts.duplicates)}</p><p className="text-xs">Review pending: {n(issueCounts.duplicateReview)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Unmatched Trees</p><p className="text-2xl font-black text-rose-700">{n(issueCounts.unmatched)}</p></div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Invalid</p><p className="font-black">{n(issueCounts.invalid)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Rejected / Has Issues</p><p className="font-black">{n(issueCounts.deletedRejected)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Late</p><p className="font-black">{n(issueCounts.late)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Last Import</p><p className="font-black">{status?.latestImport?.result ?? "—"}</p></div>
        </div>
      </Panel>

      <Panel
        title={`Selected Date Review — ${hasValidTargetDate ? dateFilter : "Select a valid Harvest Date"}`}
        icon={Search}
      >
        <div className="grid gap-3 md:grid-cols-6">
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Source Submissions</p><p className="text-2xl font-black">{n(selectedItems.length)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Tree Groups</p><p className="text-2xl font-black">{n(selectedTreeGroupCount)}</p></div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-bold uppercase text-sky-800">Clean Singles Auto-Ready</p><p className="text-2xl font-black text-sky-900">{n(cleanSingleRows.length)}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-800">Exact-Duplicate Groups</p><p className="text-2xl font-black text-emerald-900">{n(exactDuplicateGroups.length)}</p></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs font-bold uppercase text-rose-800">Conflicting Groups</p><p className="text-2xl font-black text-rose-900">{n(conflictingGroupCount)}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold uppercase text-amber-800">Cycle Safety Reviews</p><p className="text-2xl font-black text-amber-900">{n(cycleReviewRows.length)}</p></div>
        </div>
      </Panel>

      <Panel title="Exact Duplicates — Automatically Resolved" icon={ShieldCheck}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-800">Exact-Duplicate Tree Groups</p><p className="text-2xl font-black text-emerald-900">{n(exactDuplicateGroups.length)}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold uppercase text-amber-800">Source Submissions Excluded</p><p className="text-2xl font-black text-amber-900">{n(selectedExactSupersededCount)}</p></div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-bold uppercase text-sky-800">Effective Records Retained</p><p className="text-2xl font-black text-sky-900">{n(exactDuplicateGroups.length)}</p></div>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">The earliest valid ODK submission is retained; equal timestamps use the lexicographically lowest ODK instance ID. No Harvest record is inserted during scanning.</p>
        <div className="mt-3 space-y-2">
          {visibleExactDuplicateGroups.map((group: any) => (
            <details key={group.groupKey} className="rounded-xl border bg-background">
              <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                Tree {group.treeNo} · {d(group.harvestDate)} · {n(group.superseded?.length)} superseded
              </summary>
              <div className="border-t p-4 text-xs">
                <p><span className="font-bold">Retained ODK instance:</span> <span className="font-mono">{group.retained?.odk_instance_id ?? "—"}</span></p>
                <p className="mt-1"><span className="font-bold">Automatic-resolution reason:</span> {group.reason}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead><tr className="border-b"><th className="p-2">Disposition</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">Submitted</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th></tr></thead>
                    <tbody>
                      {[group.retained, ...(group.superseded ?? [])].filter(Boolean).map((row: any) => <tr key={row.odk_instance_id} className="border-b"><td className="p-2 font-bold">{row.classification === "READY_EXACT_DUPLICATE" ? "Retained" : row.classification === "SUPERSEDED_EXACT_DUPLICATE" ? "Superseded" : row.classification}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.submitter_name || "—"} / {row.device_id || "—"}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          ))}
          {exactDuplicateGroups.length === 0 ? <p className="rounded-xl border p-3 text-sm text-muted-foreground">No exact-duplicate groups in the latest scan.</p> : null}
        </div>
        {exactDuplicateGroups.length > EXACT_GROUP_PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-between text-xs font-bold">
            <button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={exactPage <= 1} onClick={() => setExactPage((page) => Math.max(1, page - 1))}>Previous</button>
            <span>Page {exactPage} of {exactPageCount} · {n(exactDuplicateGroups.length)} groups</span>
            <button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={exactPage >= exactPageCount} onClick={() => setExactPage((page) => Math.min(exactPageCount, page + 1))}>Next</button>
          </div>
        ) : null}
      </Panel>

      <Panel title="Conflicting Duplicate Tree Entries — Supervisor Review Required" icon={AlertTriangle}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">{n(conflictingGroupCount)} conflicting groups · {n(allConflictRows.length)} source submissions. No conflicting group is automatically resolved.</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-2 text-xs"><span className="font-black">{n(conflictingGroupCount)}</span> total conflicts</div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs"><span className="font-black">{n(resolvedConflictCount)}</span> resolved</div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs"><span className="font-black">{n(remainingConflictCount)}</span> remaining</div>
        </div>
        <div className="space-y-3">
          {visibleConflictGroups.map(([groupKey, rows]) => {
            const first = rows[0]
            const isResolved = conflictGroupResolved(rows)
            const selectedDecision = rows.find((row) =>
              RESOLVED_CONFLICT_DECISIONS.has(String(row.supervisor_decision ?? "")),
            )
            const selectedCandidateValid = rows.some(
              (row) =>
                String(row.odk_instance_id) === String(selectedInstanceByGroup[groupKey] ?? "") &&
                isActiveValidConflictCandidate(row),
            )
            return (
              <details
                key={groupKey}
                open={openConflictGroupKey === groupKey}
                onToggle={(event) => {
                  if (event.currentTarget.open) {
                    setOpenConflictGroupKey(groupKey)
                  } else if (openConflictGroupKey === groupKey) {
                    setOpenConflictGroupKey(null)
                  }
                }}
                className="rounded-xl border bg-background"
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Tree {first.original_tree_no} · {d(first.harvest_date)} · {n(rows.length)} conflicting submissions
                </summary>
                <div className="border-t p-4">
                  <div className={`mb-3 rounded-lg border p-3 text-xs ${isResolved ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950"}`}>
                    {selectedDecision ? (
                      <p>
                        <span className="font-black">Saved decision:</span> {selectedDecision.supervisor_decision};
                        selected <span className="font-mono">{selectedConflictInstance(selectedDecision)}</span>;
                        reason: {selectedDecision.supervisor_reason || "No reason recorded"}
                      </p>
                    ) : (
                      <p className="font-black">Review required — select one submission and record a reason.</p>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead><tr className="border-b"><th className="p-2">Select</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">ODK Time</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th></tr></thead>
                      <tbody>
                        {rows.map((row: any) => (
                          <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                            <td className="p-2">
                              <input
                                type="radio"
                                name={`conflict-${groupKey}`}
                                checked={
                                  String(selectedInstanceByGroup[groupKey] ?? "") === String(row.odk_instance_id)
                                }
                                onChange={() => setSelectedInstanceByGroup((current) => ({ ...current, [groupKey]: row.odk_instance_id }))}
                                disabled={
                                  busy !== null ||
                                  !batchStatusMatchesSelection ||
                                  !isActiveValidConflictCandidate(row)
                                }
                                aria-label={`Select ODK instance ${row.odk_instance_id}`}
                              />
                            </td>
                            <td className="p-2 font-mono">{row.odk_instance_id}</td>
                            <td className="p-2">{row.submitter_name || "—"} / {row.device_id || "—"}</td>
                            <td className="p-2">{row.odk_submission_timestamp ?? "—"}</td>
                            <td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td>
                            <td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row">
                    <input
                      value={decisionReasonByGroup[groupKey] ?? ""}
                      onChange={(event) => setDecisionReasonByGroup((current) => ({ ...current, [groupKey]: event.target.value }))}
                      placeholder="Supervisor reason (required)"
                      className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => void saveConflictSelection(groupKey, rows, false)}
                      disabled={
                        busy !== null ||
                        !batchStatusMatchesSelection ||
                        !selectedCandidateValid ||
                        !decisionReasonByGroup[groupKey]?.trim()
                      }
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
                    >
                      {busy === `decision-${groupKey}` ? "Saving..." : "Save Supervisor Selection"}
                    </button>
                    <button
                      onClick={() => void saveConflictSelection(groupKey, rows, true)}
                      disabled={
                        busy !== null ||
                        !batchStatusMatchesSelection ||
                        !selectedCandidateValid ||
                        !decisionReasonByGroup[groupKey]?.trim()
                      }
                      className="rounded-lg border border-primary px-4 py-2 text-sm font-extrabold text-primary disabled:opacity-50"
                    >
                      {busy === `decision-${groupKey}` ? "Saving..." : "Save and Open Next Unresolved"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">This stores a review decision only. It does not write to harvest_records.</p>
                </div>
              </details>
            )
          })}
        </div>
        {allConflictGroups.length > CONFLICT_GROUP_PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-between text-xs font-bold">
            <button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={conflictPage <= 1} onClick={() => setConflictPage((page) => Math.max(1, page - 1))}>Previous</button>
            <span>Page {conflictPage} of {conflictPageCount} · {n(allConflictGroups.length)} groups</span>
            <button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={conflictPage >= conflictPageCount} onClick={() => setConflictPage((page) => Math.min(conflictPageCount, page + 1))}>Next</button>
          </div>
        ) : null}
      </Panel>

      {cycleReviewRows.length > 0 ? (
        <Panel title="Cross-Date Cycle Safety Review" icon={AlertTriangle}>
          <p className="mb-3 text-sm font-semibold text-amber-900">These are single submissions for the selected date, but the same Tree Number already appears on another date in the open Harvest cycle. They remain blocked from import pending supervisor review.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Tree</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">Submitted</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Safety reason</th></tr></thead>
              <tbody>{cycleReviewRows.map((row: any) => <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2 font-bold">{row.original_tree_no}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.submitter_name || "—"} / {row.device_id || "—"}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td><td className="p-2">{row.note}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel title="Clean Single Submissions — Automatically Ready" icon={CheckCircle2}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Every valid one-submission group is included as SINGLE_VALID_AUTO_READY without an individual approval. Cycle collisions remain excluded and require a supervisor decision.
        </p>
        <details className="rounded-xl border bg-background">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
            Expand clean-single audit · {n(cleanSingleRows.length)} effective records
          </summary>
          <div className="overflow-x-auto border-t">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Tree</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">Submitted</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Review status</th></tr></thead>
            <tbody>{cleanSingleRows.map((row: any) => <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2 font-bold">{row.original_tree_no}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.submitter_name || "—"} / {row.device_id || "—"}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td><td className="p-2"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold text-emerald-700">SINGLE_VALID_AUTO_READY</span></td></tr>)}</tbody>
          </table>
          </div>
        </details>
        {cleanSingleRows.length === 0 ? <p className="rounded-xl border p-3 text-sm text-muted-foreground">No clean single-submission records match the selected date and Tree Number filter.</p> : null}
      </Panel>

      <Panel title="Trees Not in Tree Master" icon={AlertTriangle}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Original Tree</th><th className="p-2">ODK Time</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Reason</th></tr></thead>
            <tbody>{unmatchedRows.map((row: any) => <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2 font-black text-rose-700">{row.original_tree_no}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td><td className="p-2">{row.note}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">Mapping/correction decisions are audited server-side; adding a new tree to master is intentionally not available here.</p>
      </Panel>

      <Panel title="Import History" icon={History}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Run</th><th className="p-2">Result</th><th className="p-2">Cycle</th><th className="p-2">Scanned</th><th className="p-2">Imported</th><th className="p-2">Superseded</th><th className="p-2">Excluded</th><th className="p-2">When</th></tr></thead>
            <tbody>{history.map((run) => <tr key={run.id} className="border-b"><td className="p-2">#{run.id}</td><td className="p-2 font-bold">{run.result}</td><td className="p-2">{run.cycle_no}</td><td className="p-2">{run.scanned}</td><td className="p-2">{run.imported}</td><td className="p-2">{run.superseded}</td><td className="p-2">{run.excluded}</td><td className="p-2">{run.run_ended_at}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
