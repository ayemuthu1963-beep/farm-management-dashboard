"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FlaskConical,
  History,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react"
import { HarvestReviewSections } from "@/components/admin/harvest-review-sections"
import { Panel } from "@/components/farm/panel"
import {
  buildReviewBuckets,
  conflictGroupResolved,
  cycleCollisionResolved,
  displayHarvestDate,
  invalidZeroGroupResolved,
  isAllZeroInvalidSubmission,
  type HarvestScanResponse,
  type HarvestScanSummary,
} from "@/lib/harvest-review-model"

interface SyncStatus {
  projectId: number
  formId: string
  manualImportEnabled?: boolean
  importEnabled?: boolean
  openCycle: {
    harvest_cycle: string
    harvest_start_date: string
    harvest_end_date: string | null
    harvest_status: string
  } | null
  latestScan: HarvestScanSummary | null
  latestImport: Record<string, unknown> | null
  cycleSummary: { records: number; trees: number; bunches: number; nuts: number } | null
}

interface ImportPlan {
  scanId: number
  targetHarvestDate: string
  harvestCycle: string
  dateScopedBatchFingerprint: string
  dateScopedFingerprintMatches?: boolean
  globalSourceChanged?: boolean
  globalSourceWarning?: string | null
  confirmationToken: string
  confirmationPhrase: string
  candidateCount: number
  candidateBunches: number
  candidateNuts: number
  targetSubmissionCount?: number
  targetGroupCount?: number
  exactDuplicateGroupsReady: number
  cleanSinglesAutoReady: number
  conflictsResolved: number
  conflictsRemaining: number
  invalidZeroGroupsResolved?: number
  cycleBlockersResolved: number
  cycleBlockersRemaining?: number
  unresolvedCount?: number
  unresolvedGroupCount: number
  staleDecisionCount: number
  correctionRequiredCount: number
  hiddenEligibleCount: number
  resolvedExclusionCount: number
  manualConflictExclusionCount: number
  exactDuplicateSuperseded: number
  totalExcludedCount?: number
  readyForImport: boolean
  candidates: Record<string, unknown>[]
  unresolved: Record<string, unknown>[]
  resolvedExclusions: Record<string, unknown>[]
  supersededExactDuplicates: Record<string, unknown>[]
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

interface DryRunResult {
  ok: boolean
  dryRun: boolean
  transactionRolledBack: boolean
  hostLockVerified: boolean
  postgresAdvisoryLockVerified: boolean
  selectedOtherDateCount: number
  candidateCount: number
  candidateBunches: number
  candidateNuts: number
  auditRowsGenerated: number
  projectedCycleTotals: {
    records: number
    trees: number
    bunches: number
    nuts: number
  }
  dryRunToken?: string
  dryRunReceiptId?: number
  dryRunTokenExpiresAt?: string
  preImportCsvSha256?: string
  auditCsvSha256?: string
  cycleTotalsBefore?: {
    records: number
    trees: number
    bunches: number
    nuts: number
  }
  bindingKey: string
  completedAt: string
}

interface CsvReceipt {
  filename: string
  sha256: string
}

interface WorkspaceMessage {
  ok: boolean
  text: string
}

interface PostImportVerification {
  records?: number
  importedRecords?: number
  superseded?: number
  excluded?: number
  cycleTotalsBefore?: Record<string, unknown>
  cycleTotalsProjected?: Record<string, unknown>
  cycleTotalsAfter?: Record<string, unknown>
  preImportCsvSha256?: string
  auditCsvSha256?: string
  importedBunches?: number
  importedNuts?: number
  excludedSourceSubmissions?: number
  auditRowsWritten?: number
  duplicateInstanceIdResult?: string
  duplicateTreeDateResult?: string
  duplicateTreeCycleResult?: string
  cycleTotalsStatus?: string
  importUser?: string
  importTimestamp?: string
  recordsCsvSha256?: string
}

interface DurablePostImportVerification {
  runId?: number
  historySource?: string
  result?: string
  importedRecords?: number
  recordMismatches?: Record<string, unknown>[]
  cycleTotalsAvailable?: boolean
  cycleTotalsMatch?: boolean | null
  expectedCycleTotals?: Record<string, unknown>
  currentCycleTotals?: Record<string, unknown>
  recordsCsvSha256?: string
  auditCsvSha256?: string
  importedBunches?: number
  importedNuts?: number
  excludedSourceSubmissions?: number
  auditRowsWritten?: number
  duplicateInstanceIdResult?: string
  duplicateTreeDateResult?: string
  duplicateTreeCycleResult?: string
  cycleTotalsStatus?: string
  importUser?: string
  importTimestamp?: string
}

interface CompletedImportResult {
  run: Record<string, unknown>
  verification: PostImportVerification
  durableVerification?: DurablePostImportVerification
  durableVerificationError?: string
}

interface HistoryEntry {
  id: string
  sourceId: number
  runType: "COMMITTED" | "DRY_RUN"
  scanId?: number | null
  harvestDate?: string | null
  harvestCycle?: string | null
  recordCount?: number | null
  totalBunches?: number | null
  totalNuts?: number | null
  adminUser?: string | null
  timestamp?: string | null
  dateScopedBatchFingerprint?: string | null
  status?: string | null
  recordsCsvAvailable?: boolean
  auditCsvAvailable?: boolean
  postImportVerificationAvailable?: boolean
  consumedRunId?: number | null
}

interface HistoryDownloadTarget {
  key: string
  sourceId: number
  runType: "COMMITTED" | "DRY_RUN"
}

function numberText(value: unknown): string {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-IN") : "0"
}

function fullDate(value: string | null | undefined): string {
  const date = displayHarvestDate(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const row = data as { detail?: unknown; error?: unknown; message?: unknown }
    const message = row.detail ?? row.error ?? row.message
    if (message) return String(message)
  }
  return fallback
}

function planBindingKey(plan: ImportPlan | null): string {
  if (!plan) return ""
  return JSON.stringify([
    plan.scanId,
    plan.targetHarvestDate,
    plan.harvestCycle,
    plan.dateScopedBatchFingerprint,
    plan.confirmationToken,
    plan.confirmationPhrase,
    plan.candidateCount,
    plan.candidateBunches,
    plan.candidateNuts,
  ])
}

function excludedCount(plan: Partial<ImportPlan> | undefined): number {
  if (!plan) return 0
  if (plan.totalExcludedCount !== undefined) return Number(plan.totalExcludedCount)
  return (
    Number(plan.exactDuplicateSuperseded ?? 0) +
    Number(plan.manualConflictExclusionCount ?? 0) +
    Number(plan.resolvedExclusionCount ?? 0)
  )
}

async function blobSha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function MessageBox({ message }: { message: WorkspaceMessage | null }) {
  if (!message) return null
  return (
    <div
      role={message.ok ? "status" : "alert"}
      aria-live={message.ok ? "polite" : "assertive"}
      aria-atomic="true"
      className={`rounded-xl border p-3 text-sm font-bold ${
        message.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      {message.ok ? (
        <CheckCircle2 className="mr-2 inline size-4" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
      )}
      {message.text}
    </div>
  )
}

export function HarvestManualReviewWorkspace() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [scans, setScans] = useState<HarvestScanSummary[]>([])
  const [scanData, setScanData] = useState<HarvestScanResponse | null>(null)
  const [targetDate, setTargetDate] = useState("")
  const [batchStatus, setBatchStatus] = useState<DateScopedBatchStatus | null>(null)
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [csvReceipts, setCsvReceipts] = useState<
    Partial<Record<"pre-import" | "date-audit", CsvReceipt>>
  >({})
  const [confirmationPhraseInput, setConfirmationPhraseInput] = useState("")
  const [postImportResult, setPostImportResult] = useState<CompletedImportResult | null>(null)
  const [historyVerification, setHistoryVerification] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [historyDownloadReceipts, setHistoryDownloadReceipts] = useState<
    Record<string, CsvReceipt>
  >({})
  const [busy, setBusy] = useState<string | null>("initial")
  const [message, setMessage] = useState<WorkspaceMessage | null>(null)
  const [batchStatusError, setBatchStatusError] = useState<string | null>(null)
  const batchRequestId = useRef(0)
  const planRequestId = useRef(0)

  const selectedScanId = scanData?.scan.id ?? null
  const openCycle = status?.openCycle?.harvest_cycle ?? null
  const selectedDateOptions = useMemo(
    () =>
      [
        ...new Set(
          (scanData?.items ?? [])
            .map((item) => displayHarvestDate(item.harvest_date))
            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
        ),
      ]
        .sort()
        .reverse(),
    [scanData],
  )
  const reviewBuckets = useMemo(
    () =>
      buildReviewBuckets(
        scanData?.items ?? [],
        targetDate,
        scanData?.scan.cycle_no ?? null,
      ),
    [scanData, targetDate],
  )
  const alreadyImportedCount = useMemo(
    () =>
      reviewBuckets.submissions.filter(
        (item) => item.classification === "ALREADY_IMPORTED",
      ).length,
    [reviewBuckets.submissions],
  )
  const invalidZeroSubmissionCount = useMemo(
    () =>
      reviewBuckets.submissions.filter((item) => isAllZeroInvalidSubmission(item)).length,
    [reviewBuckets.submissions],
  )

  const batchMatchesSelection = Boolean(
    batchStatus &&
      Number(batchStatus.scanId) === Number(selectedScanId) &&
      batchStatus.targetHarvestDate === targetDate &&
      String(batchStatus.harvestCycle) === String(openCycle ?? ""),
  )
  const selectedBatchStatus = batchMatchesSelection ? batchStatus : null
  const importPlanMatchesSelection = Boolean(
    importPlan &&
      Number(importPlan.scanId) === Number(selectedScanId) &&
      importPlan.targetHarvestDate === targetDate &&
      String(importPlan.harvestCycle) === String(openCycle ?? "") &&
      importPlan.dateScopedBatchFingerprint ===
        selectedBatchStatus?.storedDateScopedBatchFingerprint,
  )
  const currentPlanBinding = planBindingKey(importPlan)
  const dryRunMatchesPlan = Boolean(
    dryRunResult &&
      dryRunResult.bindingKey === currentPlanBinding &&
      dryRunResult.ok &&
      dryRunResult.dryRun &&
      dryRunResult.transactionRolledBack &&
      dryRunResult.hostLockVerified &&
      dryRunResult.postgresAdvisoryLockVerified &&
      dryRunResult.selectedOtherDateCount === 0 &&
      Number(dryRunResult.candidateCount) === Number(importPlan?.candidateCount) &&
      Number(dryRunResult.candidateBunches) === Number(importPlan?.candidateBunches) &&
      Number(dryRunResult.candidateNuts) === Number(importPlan?.candidateNuts),
  )
  const manualImportEnabled = status?.manualImportEnabled === true
  const latestCompletedScanId = scans[0]?.id ?? null
  const selectedScanIsLatest = Boolean(
    selectedScanId && latestCompletedScanId && selectedScanId === latestCompletedScanId,
  )
  const selectedScanIndex = scans.findIndex((scan) => scan.id === selectedScanId)
  const previousScan =
    selectedScanIndex >= 0
      ? (scans[selectedScanIndex + 1] ?? null)
      : (scans[1] ?? scans[0] ?? null)

  function invalidateFinalControls() {
    planRequestId.current += 1
    setImportPlan(null)
    setDryRunResult(null)
    setCsvReceipts({})
    setConfirmationPhraseInput("")
    setPostImportResult(null)
  }

  async function loadStatus(): Promise<SyncStatus | null> {
    const response = await fetch("/api/admin/harvest-sync/status", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(errorMessage(data, "Unable to load the manual import lock and open Cycle"))
    }
    setStatus(data as SyncStatus)
    return data as SyncStatus
  }

  async function loadScans(): Promise<HarvestScanSummary[]> {
    const response = await fetch("/api/admin/harvest-sync/scans", { cache: "no-store" })
    const data = (await response.json()) as {
      scans?: HarvestScanSummary[]
      detail?: string
      error?: string
    }
    if (!response.ok) throw new Error(errorMessage(data, "Unable to load persisted scans"))
    const completed = (data.scans ?? []).filter((scan) => scan.status === "SCANNED")
    setScans(completed)
    return completed
  }

  async function loadHistory(): Promise<void> {
    const response = await fetch("/api/admin/harvest-sync/history", { cache: "no-store" })
    const data = (await response.json()) as {
      entries?: HistoryEntry[]
      runs?: Record<string, unknown>[]
      detail?: string
      error?: string
    }
    if (!response.ok) throw new Error(errorMessage(data, "Unable to load import history"))
    setHistory(data.entries ?? [])
  }

  async function loadScan(scanId: number, preserveDate = true): Promise<boolean> {
    setBusy("load-scan")
    setMessage(null)
    batchRequestId.current += 1
    invalidateFinalControls()
    setBatchStatus(null)
    setBatchStatusError(null)
    try {
      const response = await fetch(`/api/admin/harvest-sync/scans/${scanId}`, {
        cache: "no-store",
      })
      const data = (await response.json()) as HarvestScanResponse & {
        detail?: string
        error?: string
      }
      if (!response.ok) throw new Error(errorMessage(data, `Unable to load Scan ${scanId}`))
      if (Number(data.scan?.id) !== scanId) {
        throw new Error(`Scan response did not match requested Scan ${scanId}`)
      }
      setScanData(data)
      const dates = [
        ...new Set(
          data.items
            .map((item) => displayHarvestDate(item.harvest_date))
            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
        ),
      ]
      setTargetDate((current) => {
        if (preserveDate && /^\d{4}-\d{2}-\d{2}$/.test(current)) return current
        return dates.length === 1 ? dates[0] : ""
      })
      return true
    } catch (error) {
      setScanData(null)
      setTargetDate("")
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to load scan" })
      return false
    } finally {
      setBusy(null)
    }
  }

  async function reloadSelectedScan(): Promise<void> {
    if (!selectedScanId) return
    const refreshes = await Promise.allSettled([
      loadScan(selectedScanId, true),
      loadScans(),
      loadHistory(),
    ])
    if (
      refreshes.some(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value === false),
      )
    ) {
      setMessage({
        ok: false,
        text: "The supervisor decision was saved, but part of the refreshed view could not be loaded. Reload the page before continuing.",
      })
    }
  }

  async function bootstrap() {
    setBusy("initial")
    setMessage(null)
    try {
      const [currentStatus, completedScans] = await Promise.all([
        loadStatus(),
        loadScans(),
        loadHistory(),
      ])
      const initialId =
        completedScans[0]?.id ??
        (currentStatus?.latestScan?.id ? Number(currentStatus.latestScan.id) : null)
      if (initialId) await loadScan(initialId, false)
    } catch (error) {
      setMessage({
        ok: false,
        text: `${
          error instanceof Error ? error.message : "Unable to initialise the review workspace"
        }. Manual import remains locked.`,
      })
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    const requestId = ++batchRequestId.current
    invalidateFinalControls()
    setBatchStatus(null)
    setBatchStatusError(null)
    if (!selectedScanId || !openCycle || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return

    async function verifyDateScope() {
      try {
        const query = new URLSearchParams({
          harvest_date: targetDate,
          harvest_cycle: String(openCycle),
        })
        const response = await fetch(
          `/api/admin/harvest-sync/scans/${selectedScanId}/batch-status?${query.toString()}`,
          { cache: "no-store" },
        )
        const data = (await response.json()) as DateScopedBatchStatus & {
          detail?: string
          error?: string
        }
        if (!response.ok) {
          throw new Error(errorMessage(data, "Unable to verify the date-scoped batch"))
        }
        if (
          Number(data.scanId) !== Number(selectedScanId) ||
          data.targetHarvestDate !== targetDate ||
          String(data.harvestCycle) !== String(openCycle)
        ) {
          throw new Error(
            "Date-scoped response did not match the selected Scan, Harvest date and Cycle",
          )
        }
        if (requestId !== batchRequestId.current) return
        setBatchStatus(data)
      } catch (error) {
        if (requestId !== batchRequestId.current) return
        setBatchStatusError(
          error instanceof Error ? error.message : "Unable to verify the date-scoped batch",
        )
      }
    }

    void verifyDateScope()
  }, [openCycle, selectedScanId, targetDate])

  async function scanOdk() {
    if (!openCycle || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setMessage({ ok: false, text: "Select the open Harvest Cycle and a required Harvest date before Scan ODK." })
      return
    }
    setBusy("scan")
    setMessage(null)
    invalidateFinalControls()
    try {
      const response = await fetch("/api/admin/harvest-sync/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const data = (await response.json()) as HarvestScanResponse & {
        detail?: string
        error?: string
      }
      if (!response.ok) throw new Error(errorMessage(data, "Scan ODK failed"))
      const refreshes = await Promise.allSettled([
        loadStatus(),
        loadScans(),
        loadHistory(),
        loadScan(Number(data.scan.id), true),
      ])
      const refreshFailed = refreshes.some(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value === false),
      )
      setMessage({
        ok: !refreshFailed,
        text: refreshFailed
          ? `Scan ${data.scan.id} was persisted, but part of the refreshed view could not be loaded. Reload the page before continuing.`
          : `Scan ${data.scan.id} was persisted. Select one Harvest date and review every section.`,
      })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Scan ODK failed" })
    } finally {
      setBusy(null)
    }
  }

  async function prepareFinalPlan() {
    if (
      !selectedScanId ||
      !openCycle ||
      !selectedBatchStatus?.storedDateScopedBatchFingerprint ||
      !selectedBatchStatus.dateScopedFingerprintMatches
    ) {
      setMessage({
        ok: false,
        text: "A current date-scoped fingerprint is required before building the final import set.",
      })
      return
    }
    const requestId = ++planRequestId.current
    const fingerprint = selectedBatchStatus.storedDateScopedBatchFingerprint
    const capturedScan = selectedScanId
    const capturedDate = targetDate
    const capturedCycle = String(openCycle)
    setBusy("prepare-plan")
    setMessage(null)
    setDryRunResult(null)
    setCsvReceipts({})
    try {
      const response = await fetch("/api/admin/harvest-sync/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: capturedScan,
          harvest_date: capturedDate,
          harvest_cycle: capturedCycle,
          date_scoped_batch_fingerprint: fingerprint,
        }),
      })
      const data = (await response.json()) as {
        plan?: ImportPlan
        detail?: string
        error?: string
      }
      if (!response.ok || !data.plan) {
        throw new Error(errorMessage(data, "Unable to build the final import set"))
      }
      if (requestId !== planRequestId.current) return
      if (
        Number(data.plan.scanId) !== capturedScan ||
        data.plan.targetHarvestDate !== capturedDate ||
        String(data.plan.harvestCycle) !== capturedCycle ||
        data.plan.dateScopedBatchFingerprint !== fingerprint
      ) {
        throw new Error(
          "Final import set did not match the selected Scan, Harvest date, Cycle and fingerprint",
        )
      }
      setImportPlan(data.plan)
      setConfirmationPhraseInput("")
      setMessage({
        ok: data.plan.readyForImport,
        text: data.plan.readyForImport
          ? "Final import set built. Review every effective record and verified export before dry run."
          : "The final import set is blocked by unresolved or unsafe records.",
      })
    } catch (error) {
      if (requestId !== planRequestId.current) return
      setImportPlan(null)
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Unable to build the final import set",
      })
    } finally {
      setBusy(null)
    }
  }

  async function downloadDateScopedCsv(kind: "pre-import" | "date-audit") {
    if (
      !selectedScanId ||
      !openCycle ||
      !importPlan ||
      !importPlanMatchesSelection ||
      !importPlan.readyForImport
    ) {
      setMessage({ ok: false, text: "Build a ready, matching final import set before downloading CSV files." })
      return
    }
    const busyKey = kind === "pre-import" ? "pre-import-csv" : "audit-csv"
    setBusy(busyKey)
    setMessage(null)
    try {
      const query = new URLSearchParams({
        harvest_date: targetDate,
        harvest_cycle: String(openCycle),
        date_scoped_batch_fingerprint: importPlan.dateScopedBatchFingerprint,
      })
      const response = await fetch(
        `/api/admin/harvest-sync/scans/${selectedScanId}/${kind}.csv?${query.toString()}`,
        { cache: "no-store" },
      )
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Unable to create the requested CSV")
      }
      const expectedSha256 = response.headers.get("x-content-sha256")?.trim().toLowerCase()
      if (!expectedSha256 || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new Error("CSV response did not include a valid X-Content-SHA256 header")
      }
      const blob = await response.blob()
      const actualSha256 = await blobSha256Hex(blob)
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `CSV integrity verification failed: expected ${expectedSha256}, received ${actualSha256}`,
        )
      }
      const filename =
        kind === "pre-import"
          ? `harvest-sync-scan-${selectedScanId}-${targetDate}-pre-import.csv`
          : `harvest-sync-scan-${selectedScanId}-${targetDate}-audit.csv`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setCsvReceipts((current) => ({
        ...current,
        [kind]: { filename, sha256: actualSha256 },
      }))
      setMessage({ ok: true, text: `${filename} downloaded and SHA-256 verified.` })
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Unable to create the requested CSV",
      })
    } finally {
      setBusy(null)
    }
  }

  function authoritativePayload(plan: ImportPlan) {
    return {
      scan_id: plan.scanId,
      harvest_date: plan.targetHarvestDate,
      harvest_cycle: plan.harvestCycle,
      date_scoped_batch_fingerprint: plan.dateScopedBatchFingerprint,
      mode: "approved",
      confirmation_token: plan.confirmationToken,
      confirmation_phrase: plan.confirmationPhrase,
      expected_record_count: plan.candidateCount,
      expected_total_bunches: plan.candidateBunches,
      expected_total_nuts: plan.candidateNuts,
    }
  }

  async function runAuthoritativeDryRun() {
    if (
      !importPlan ||
      !importPlanMatchesSelection ||
      !importPlan.readyForImport ||
      !selectedScanIsLatest
    ) {
      setMessage({
        ok: false,
        text: "A ready final set from the latest completed scan is required.",
      })
      return
    }
    const bindingKey = planBindingKey(importPlan)
    setBusy("dry-run")
    setMessage(null)
    setDryRunResult(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/import-dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authoritativePayload(importPlan)),
      })
      const data = (await response.json()) as Omit<DryRunResult, "bindingKey" | "completedAt"> & {
        detail?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(errorMessage(data, "The authoritative dry run failed"))
      }
      if (
        !data.ok ||
        !data.dryRun ||
        !data.transactionRolledBack ||
        !data.hostLockVerified ||
        !data.postgresAdvisoryLockVerified ||
        Number(data.selectedOtherDateCount) !== 0
      ) {
        throw new Error("Dry-run response did not satisfy every rollback and locking invariant")
      }
      setDryRunResult({
        ...data,
        bindingKey,
        completedAt: new Date().toISOString(),
      })
      setMessage({
        ok: true,
        text: "Authoritative import code completed and rolled back. No Harvest record was committed.",
      })
    } catch (error) {
      setDryRunResult(null)
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "The authoritative dry run failed",
      })
    } finally {
      setBusy(null)
    }
  }

  async function importReviewedBatch() {
    const dryRunToken = dryRunResult?.dryRunToken
    if (
      !manualImportEnabled ||
      !importPlan ||
      !importPlanMatchesSelection ||
      !dryRunMatchesPlan ||
      !dryRunToken ||
      confirmationPhraseInput.trim() !== importPlan.confirmationPhrase
    ) {
      setMessage({
        ok: false,
        text: "Manual import is locked or the matching dry run and confirmation are incomplete.",
      })
      return
    }
    setBusy("import")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/manual-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...authoritativePayload(importPlan),
          confirmation_phrase: confirmationPhraseInput.trim(),
          dry_run_token: dryRunToken,
        }),
      })
      const data = (await response.json()) as {
        result?: Record<string, unknown>
        postImportVerification?: PostImportVerification
        detail?: string
        error?: string
      }
      if (!response.ok || !data.result) {
        throw new Error(errorMessage(data, "Manual import failed"))
      }
      const runId = Number(data.result.id)
      let durableVerification: DurablePostImportVerification | undefined
      let durableVerificationError: string | undefined
      if (Number.isFinite(runId)) {
        try {
          durableVerification = await fetchPostImportVerification(runId)
          setHistoryVerification((current) => ({
            ...current,
            [String(runId)]: durableVerification as Record<string, unknown>,
          }))
        } catch (error) {
          durableVerificationError =
            error instanceof Error
              ? error.message
              : `Unable to verify completed Run ${runId}`
        }
      } else {
        durableVerificationError =
          "The completed import response did not include a valid run ID for durable verification."
      }
      setPostImportResult({
        run: data.result,
        verification:
          data.postImportVerification && typeof data.postImportVerification === "object"
            ? (data.postImportVerification as PostImportVerification)
            : {},
        durableVerification,
        durableVerificationError,
      })
      setMessage({
        ok: !durableVerificationError,
        text: durableVerificationError
          ? `Manual import committed successfully, but durable verification could not be completed: ${durableVerificationError}. Do not retry the import.`
          : "Manual import completed and durable post-import verification was loaded.",
      })
      const refreshes = await Promise.allSettled([loadStatus(), loadScans(), loadHistory()])
      if (refreshes.some((result) => result.status === "rejected")) {
        setMessage({
          ok: false,
          text: "Manual import committed successfully, but part of the refreshed view could not be loaded. Do not retry; reload the page and verify the completed run.",
        })
      }
      planRequestId.current += 1
      setImportPlan(null)
      setDryRunResult(null)
      setCsvReceipts({})
      setConfirmationPhraseInput("")
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Manual import failed" })
    } finally {
      setBusy(null)
    }
  }

  async function downloadHistoryCsv(
    target: HistoryDownloadTarget,
    kind: "records" | "audit",
  ) {
    const receiptKey = `${target.key}-${kind}`
    setBusy(`history-${receiptKey}`)
    setMessage(null)
    try {
      const isDryRun = target.runType === "DRY_RUN"
      const endpoint = isDryRun
        ? `/api/admin/harvest-sync/history/dry-runs/${target.sourceId}/${
            kind === "records" ? "pre-import" : "audit"
          }.csv`
        : `/api/admin/harvest-sync/history/${target.sourceId}/${kind}.csv`
      const response = await fetch(
        endpoint,
        { cache: "no-store" },
      )
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(
          detail ||
            `Unable to download ${target.runType.toLowerCase()} ${target.sourceId} ${kind} CSV`,
        )
      }
      const expectedSha256 = response.headers.get("x-content-sha256")?.trim().toLowerCase()
      if (!expectedSha256 || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new Error("History CSV response did not include a valid X-Content-SHA256 header")
      }
      const blob = await response.blob()
      const actualSha256 = await blobSha256Hex(blob)
      if (actualSha256 !== expectedSha256) {
        throw new Error("History CSV SHA-256 verification failed")
      }
      const filename = isDryRun
        ? `harvest-manual-dry-run-${target.sourceId}-${
            kind === "records" ? "pre-import" : "audit"
          }.csv`
        : `harvest-manual-import-run-${target.sourceId}-${kind}.csv`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setHistoryDownloadReceipts((current) => ({
        ...current,
        [receiptKey]: { filename, sha256: actualSha256 },
      }))
      setMessage({ ok: true, text: `${filename} downloaded and SHA-256 verified.` })
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Unable to download the history CSV",
      })
    } finally {
      setBusy(null)
    }
  }

  async function fetchPostImportVerification(
    runId: number,
  ): Promise<DurablePostImportVerification> {
    const response = await fetch(
      `/api/admin/harvest-sync/history/${runId}/post-import-verification`,
      { cache: "no-store" },
    )
    const data = (await response.json()) as DurablePostImportVerification & {
      detail?: string
      error?: string
    }
    if (!response.ok) {
      throw new Error(errorMessage(data, `Unable to verify completed Run ${runId}`))
    }
    return data
  }

  async function verifyHistoryRun(runId: number) {
    setBusy(`verify-history-${runId}`)
    setMessage(null)
    try {
      const data = await fetchPostImportVerification(runId)
      setHistoryVerification((current) => ({
        ...current,
        [String(runId)]: data as Record<string, unknown>,
      }))
      setMessage({
        ok: data.result === "PASS" || data.result === "PASS_WITH_LEGACY_TOTALS_UNAVAILABLE",
        text: `Run ${runId} post-import verification: ${String(data.result ?? "UNKNOWN")}.`,
      })
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : `Unable to verify completed Run ${runId}`,
      })
    } finally {
      setBusy(null)
    }
  }

  const statusPlan = selectedBatchStatus?.plan
  const conflictsResolved =
    statusPlan?.conflictsResolved ??
    reviewBuckets.conflicts.filter((group) => conflictGroupResolved(group.rows)).length
  const conflictsUnresolved =
    statusPlan?.conflictsRemaining ??
    reviewBuckets.conflicts.filter((group) => !conflictGroupResolved(group.rows)).length
  const invalidZeroResolved =
    statusPlan?.invalidZeroGroupsResolved ??
    reviewBuckets.invalidZeroGroups.filter((group) => invalidZeroGroupResolved(group.rows)).length
  const cycleResolved =
    statusPlan?.cycleBlockersResolved ??
    reviewBuckets.cycleCollisions.filter(({ pending }) => cycleCollisionResolved(pending)).length
  const cycleRemaining =
    statusPlan?.cycleBlockersRemaining ??
    reviewBuckets.cycleCollisions.filter(({ pending }) => !cycleCollisionResolved(pending)).length
  const correctionRequired =
    statusPlan?.correctionRequiredCount ?? reviewBuckets.errors.length
  const readiness = Boolean(statusPlan?.readyForImport)
  const postImportRunId = Number(postImportResult?.run.id)
  const completedVerification =
    postImportResult?.durableVerification ?? postImportResult?.verification
  const postImportDownloadTarget: HistoryDownloadTarget | null = Number.isFinite(
    postImportRunId,
  )
    ? {
        key: `commit-${postImportRunId}`,
        sourceId: postImportRunId,
        runType: "COMMITTED",
      }
    : null
  const postImportRecordsReceipt = postImportDownloadTarget
    ? historyDownloadReceipts[`${postImportDownloadTarget.key}-records`]
    : null
  const postImportAuditReceipt = postImportDownloadTarget
    ? historyDownloadReceipts[`${postImportDownloadTarget.key}-audit`]
    : null

  return (
    <div className="space-y-5">
      <section
        className={`rounded-2xl border-2 p-4 text-sm ${
          manualImportEnabled
            ? "border-emerald-400 bg-emerald-50 text-emerald-950"
            : "border-rose-400 bg-rose-50 text-rose-950"
        }`}
      >
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-black uppercase">
              {manualImportEnabled ? "Manual import control enabled" : "Manual import remains locked"}
            </p>
            <p className="mt-1 font-semibold">
              Scan, review, export, and rollback-only dry run remain separate from the final commit control.
            </p>
          </div>
        </div>
      </section>

      <Panel title="Step 1 — Select Batch" icon={Search}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            <label htmlFor="harvest-persisted-scan">Persisted Scan</label>
            <select
              id="harvest-persisted-scan"
              value={selectedScanId ?? ""}
              onChange={(event) => void loadScan(Number(event.target.value), false)}
              disabled={busy !== null}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select a completed scan</option>
              {scans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  Scan {scan.id} · {scan.scan_ended_at ?? scan.scan_started_at ?? "timestamp unavailable"} · Cycle{" "}
                  {scan.cycle_no ?? "—"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (previousScan) void loadScan(previousScan.id, true)
              }}
              disabled={busy !== null || !previousScan}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-xs font-black text-foreground disabled:opacity-40"
            >
              Load Previous Scan
            </button>
          </div>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Harvest Date
            <input
              type="date"
              list="persisted-harvest-dates"
              required
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              disabled={busy !== null}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            />
            <datalist id="persisted-harvest-dates">
              {selectedDateOptions.map((date) => (
                <option key={date} value={date} />
              ))}
            </datalist>
            <span className="mt-2 block normal-case text-muted-foreground">
              Required before Scan ODK. Summary, review and import remain scoped to this date.
            </span>
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Harvest Cycle
            <select
              value={openCycle ?? ""}
              required
              disabled
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-black text-foreground disabled:opacity-100"
            >
              <option value="">No open Harvest Cycle</option>
              {openCycle ? <option value={openCycle}>Cycle {openCycle} — Open</option> : null}
            </select>
            <span className="mt-2 block normal-case text-muted-foreground">
              {displayHarvestDate(status?.openCycle?.harvest_start_date)} →{" "}
              {displayHarvestDate(status?.openCycle?.harvest_end_date)}
            </span>
          </label>
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">ODK Source</p>
            <p className="mt-1 font-black">Project {status?.projectId ?? 17}</p>
            <p className="break-all text-xs">{status?.formId ?? "mfms_preview_harvest_test_v1"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void scanOdk()}
            disabled={
              busy !== null ||
              !openCycle ||
              !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${busy === "scan" ? "animate-spin" : ""}`} aria-hidden="true" />
            {busy === "scan" ? "Scanning ODK…" : "Scan ODK"}
          </button>
          <span className="self-center text-xs font-semibold text-muted-foreground">
            Scan ODK persists a review snapshot only; it does not write Harvest records.
          </span>
        </div>
        <div className="mt-4">
          <MessageBox message={message} />
        </div>
      </Panel>

      <Panel title="Step 2 — Date-Scoped Summary" icon={ShieldCheck}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Scan / Timestamp</p>
            <p className="font-black">{selectedScanId ? `Scan ${selectedScanId}` : "—"}</p>
            <p className="text-xs">{selectedBatchStatus?.scanTimestamp ?? scanData?.scan.scan_ended_at ?? "—"}</p>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              selectedBatchStatus?.dateScopedFingerprintMatches
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <p className="text-xs font-bold uppercase text-muted-foreground">Date-Scoped Fingerprint</p>
            <p className="font-black">
              {selectedBatchStatus?.dateScopedFingerprintMatches ? "CURRENT" : "UNVERIFIED / STALE"}
            </p>
            <p className="mt-1 break-all font-mono text-[10px]">
              {selectedBatchStatus?.storedDateScopedBatchFingerprint ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Submissions / Tree Groups</p>
            <p className="text-xl font-black">
              {numberText(statusPlan?.targetSubmissionCount ?? reviewBuckets.submissions.length)} /{" "}
              {numberText(statusPlan?.targetGroupCount ?? reviewBuckets.treeGroupCount)}
            </p>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              readiness ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
            }`}
          >
            <p className="text-xs font-bold uppercase text-muted-foreground">Batch Readiness</p>
            <p className="font-black">{readiness ? "READY" : "REVIEW REQUIRED"}</p>
            <p className="text-xs">{numberText(statusPlan?.unresolvedGroupCount)} unresolved groups</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(statusPlan?.exactDuplicateGroupsReady ?? reviewBuckets.exactGroups.length)}</span> exact groups resolved</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(statusPlan?.cleanSinglesAutoReady ?? reviewBuckets.cleanSingles.length)}</span> clean singles ready</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(conflictsResolved)}</span> conflicts resolved</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black text-rose-700">{numberText(conflictsUnresolved)}</span> conflicts unresolved</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(invalidZeroResolved)}</span> invalid-zero resolved</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(invalidZeroSubmissionCount)}</span> invalid-zero source submissions</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(alreadyImportedCount)}</span> already-imported source submissions</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(cycleResolved)} / {numberText(cycleRemaining)}</span> cycle resolved / remaining</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black text-rose-700">{numberText(statusPlan?.staleDecisionCount)}</span> stale decisions</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black text-rose-700">{numberText(statusPlan?.hiddenEligibleCount)}</span> hidden candidates</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black text-rose-700">{numberText(correctionRequired)}</span> correction required</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(statusPlan?.candidateCount)}</span> effective records</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{numberText(excludedCount(statusPlan))}</span> excluded submissions</div>
          <div className="rounded-lg border p-2 text-xs"><span className="block text-xl font-black">{selectedScanIsLatest ? "YES" : "NO"}</span> latest scan selected</div>
        </div>
        {selectedBatchStatus?.globalSourceChanged ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            {selectedBatchStatus.globalSourceWarning ??
              "Newer ODK source changes exist. This date remains valid only while its date-scoped fingerprint is unchanged."}
          </p>
        ) : null}
        {batchStatusError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">
            {batchStatusError}
          </p>
        ) : null}
      </Panel>

      <Panel title="Step 3 — Review Submissions" icon={ClipboardCheck}>
        <HarvestReviewSections
          scanData={scanData}
          targetDate={targetDate}
          disabled={busy !== null}
          onDecisionSaved={reloadSelectedScan}
        />
      </Panel>

      <Panel title="Step 4 — Final Import Set & Verified Exports" icon={FileCheck2}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void prepareFinalPlan()}
            disabled={
              busy !== null ||
              !selectedBatchStatus?.dateScopedFingerprintMatches ||
              !selectedScanIsLatest
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {busy === "prepare-plan" ? "Reviewing Final Set…" : "Review Final Import Set"}
          </button>
          <span className="text-xs font-semibold text-muted-foreground">
            The final set is generated by the backend from the persisted scan, saved decisions, Cycle, and fingerprint.
          </span>
        </div>
        {importPlan && importPlanMatchesSelection ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Effective Records</p><p className="text-2xl font-black">{numberText(importPlan.candidateCount)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Bunches</p><p className="text-2xl font-black">{numberText(importPlan.candidateBunches)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Nuts</p><p className="text-2xl font-black">{numberText(importPlan.candidateNuts)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Excluded Sources</p><p className="text-2xl font-black">{numberText(excludedCount(importPlan))}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Unresolved Groups</p><p className="text-2xl font-black text-rose-700">{numberText(importPlan.unresolvedGroupCount)}</p></div>
            </div>
            <div className="max-h-[32rem] overflow-auto rounded-xl border">
              <table className="min-w-[1500px] text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b"><th className="p-2">Tree Number</th><th className="p-2">Harvest Date</th><th className="p-2">Cycle</th><th className="p-2">Selected ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">Bunch Count</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Total Nuts</th><th className="p-2">Selection Method</th><th className="p-2">Excluded Instance IDs</th><th className="p-2">Supervisor Reason</th></tr>
                </thead>
                <tbody>
                  {importPlan.candidates.map((row) => (
                    <tr key={String(row.odk_instance_id)} className="border-b">
                      <td className="p-2 font-bold">{String(row.import_tree_no ?? "—")}</td>
                      <td className="p-2">{displayHarvestDate(String(row.harvest_date ?? ""))}</td>
                      <td className="p-2">{importPlan.harvestCycle}</td>
                      <td className="p-2 font-mono">{String(row.odk_instance_id ?? "—")}</td>
                      <td className="p-2">{String(row.submitter_name ?? "—")} / {String(row.device_id ?? "—")}</td>
                      <td className="p-2">{String(row.total_bunches ?? "—")}</td>
                      <td className="p-2">{String(row.b1 ?? "—")}</td>
                      <td className="p-2">{String(row.b2 ?? "—")}</td>
                      <td className="p-2">{String(row.b3 ?? "—")}</td>
                      <td className="p-2">{String(row.total_nuts ?? "—")}</td>
                      <td className="p-2 font-bold">{String(row.selection_method ?? row.classification ?? "—")}</td>
                      <td className="p-2 font-mono">{Array.isArray(row.excluded_odk_instance_ids) ? row.excluded_odk_instance_ids.join(", ") : String(row.excluded_odk_instance_ids ?? "—")}</td>
                      <td className="p-2">{row.supervisor_decision ? `${String(row.supervisor_decision)} — ${String(row.supervisor_reason ?? "—")}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(["pre-import", "date-audit"] as const).map((kind) => {
                const receipt = csvReceipts[kind]
                const label =
                  kind === "pre-import"
                    ? "Download Pre-Import CSV"
                    : "Download Full Audit CSV"
                return (
                  <div key={kind} className="rounded-xl border p-3">
                    <button
                      type="button"
                      onClick={() => void downloadDateScopedCsv(kind)}
                      disabled={busy !== null || !importPlan.readyForImport}
                      className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-extrabold text-primary disabled:opacity-50"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      {busy === `${kind === "pre-import" ? "pre-import" : "audit"}-csv` ? "Preparing…" : label}
                    </button>
                    <p className="mt-2 text-xs font-bold">{receipt?.filename ?? `${label.replace("Download ", "")} not downloaded in this browser.`}</p>
                    <p className="mt-1 break-all font-mono text-[10px]">SHA-256: {receipt?.sha256 ?? "—"}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border p-3 text-sm font-semibold text-muted-foreground">
            Build the final set after all readiness counters are clear.
          </p>
        )}
      </Panel>

      <Panel title="Step 5 — Authoritative Rollback-Only Dry Run" icon={FlaskConical}>
        <p className="text-sm font-semibold text-muted-foreground">
          This invokes the actual import transaction path, verifies both locks and database protections, generates per-record audit rows, and then forces a rollback.
        </p>
        <button
          type="button"
          onClick={() => void runAuthoritativeDryRun()}
          disabled={
            busy !== null ||
            !importPlan ||
            !importPlanMatchesSelection ||
            !importPlan.readyForImport ||
            !selectedScanIsLatest
          }
          className="mt-4 rounded-lg bg-sky-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {busy === "dry-run" ? "Running and Rolling Back…" : "Run Import Dry Run"}
        </button>
        {importPlan ? (
          <div className="mt-4 rounded-xl border bg-muted/20 p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Required Confirmation Phrase</p>
            <p className="mt-1 font-mono text-sm font-black">{importPlan.confirmationPhrase}</p>
            <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Internal Plan Integrity Digest</p>
            <p className="mt-1 text-xs font-black">Generated and held by this review workspace.</p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              This deterministic digest binds the scan, date, Cycle, fingerprint, effective records and totals. The opaque one-use dry-run token is never displayed.
            </p>
          </div>
        ) : null}
        {dryRunResult && dryRunMatchesPlan ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase">Transaction Rolled Back</p><p className="text-xl font-black">YES</p></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase">Host Lock</p><p className="text-xl font-black">{dryRunResult.hostLockVerified ? "VERIFIED" : "FAILED"}</p></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase">Advisory Lock</p><p className="text-xl font-black">{dryRunResult.postgresAdvisoryLockVerified ? "VERIFIED" : "FAILED"}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase">Other-Date Selections</p><p className="text-xl font-black">{numberText(dryRunResult.selectedOtherDateCount)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase">Audit Rows Generated</p><p className="text-xl font-black">{numberText(dryRunResult.auditRowsGenerated)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase">Projected Cycle Trees</p><p className="text-xl font-black">{numberText(dryRunResult.projectedCycleTotals.trees)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase">Projected Cycle Bunches</p><p className="text-xl font-black">{numberText(dryRunResult.projectedCycleTotals.bunches)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase">Projected Cycle Nuts</p><p className="text-xl font-black">{numberText(dryRunResult.projectedCycleTotals.nuts)}</p></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">One-Use Dry-Run Token</p>
                <p className="mt-1 font-black">
                  {dryRunResult.dryRunToken
                    ? `Held in memory · Receipt ${dryRunResult.dryRunReceiptId ?? "—"}`
                    : "Not issued"}
                </p>
                <p className="mt-1">
                  Expires: {dryRunResult.dryRunTokenExpiresAt ?? "—"}. The opaque token is never rendered.
                </p>
              </div>
              <div className="rounded-xl border p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Verified Export Digests</p>
                <p className="mt-1 break-all font-mono text-[10px]">
                  Pre-import: {dryRunResult.preImportCsvSha256 ?? "—"}
                </p>
                <p className="mt-1 break-all font-mono text-[10px]">
                  Audit: {dryRunResult.auditCsvSha256 ?? "—"}
                </p>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Completed {dryRunResult.completedAt}. Changing the scan, date, Cycle, fingerprint, decisions, count, bunches or nuts invalidates this result.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border p-3 text-sm font-semibold text-muted-foreground">
            No matching successful dry run is held in this browser.
          </p>
        )}
      </Panel>

      <Panel title="Step 6 — Manual Import & History" icon={History}>
        <div
          className={`rounded-xl border p-4 ${
            manualImportEnabled
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-300 bg-rose-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black uppercase">
                {manualImportEnabled ? "Manual import gate is enabled" : "Manual import is disabled"}
              </p>
              <p className="mt-1 text-sm font-semibold">
                The final control also requires the exact phrase, a matching successful dry run, and its one-use backend token.
              </p>
            </div>
          </div>
        </div>
        <label className="mt-4 block text-xs font-bold uppercase text-muted-foreground">
          Dynamic Confirmation Phrase
          <input
            value={confirmationPhraseInput}
            onChange={(event) => setConfirmationPhraseInput(event.target.value)}
            placeholder={importPlan?.confirmationPhrase ?? "Build the final import set first"}
            disabled={!manualImportEnabled || !dryRunMatchesPlan || !dryRunResult?.dryRunToken}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={() => void importReviewedBatch()}
          disabled={
            busy !== null ||
            !manualImportEnabled ||
            !importPlan ||
            !importPlanMatchesSelection ||
            !dryRunMatchesPlan ||
            !dryRunResult?.dryRunToken ||
            confirmationPhraseInput.trim() !== importPlan.confirmationPhrase
          }
          className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!manualImportEnabled ? "Manual Import Disabled" : busy === "import" ? "Importing…" : "Confirm Manual Import"}
        </button>
        {postImportResult ? (
          <section
            className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4"
            aria-live="polite"
            aria-atomic="true"
          >
            <h3 className="text-sm font-black uppercase text-emerald-950">Post-Import Verification</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Run / Result</p>
                <p className="mt-1 font-black">
                  #{String(postImportResult.run.id ?? "—")} · {String(postImportResult.run.result ?? "—")}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Imported</p>
                <p className="mt-1 font-black">
                  {numberText(completedVerification?.importedRecords ?? postImportResult.verification.records)} records
                </p>
                <p className="mt-1">
                  {numberText(completedVerification?.importedBunches)} bunches ·{" "}
                  {numberText(completedVerification?.importedNuts)} nuts
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Superseded / Excluded</p>
                <p className="mt-1 font-black">
                  {numberText(postImportResult.verification.superseded)} /{" "}
                  {numberText(postImportResult.verification.excluded)}
                </p>
                <p className="mt-1">
                  {numberText(completedVerification?.excludedSourceSubmissions)} total source exclusions
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Cycle Totals After</p>
                <p className="mt-1 font-black">
                  {numberText(postImportResult.verification.cycleTotalsAfter?.trees)} trees ·{" "}
                  {numberText(postImportResult.verification.cycleTotalsAfter?.bunches)} bunches ·{" "}
                  {numberText(postImportResult.verification.cycleTotalsAfter?.nuts)} nuts
                </p>
                <p className="mt-1">{completedVerification?.cycleTotalsStatus ?? "—"}</p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Durable Verification</p>
                <p className="mt-1 font-black">
                  {postImportResult.durableVerification?.result ??
                    (postImportResult.durableVerificationError ? "FAILED TO LOAD" : "PENDING")}
                </p>
                <p className="mt-1">
                  {numberText(
                    postImportResult.durableVerification?.recordMismatches?.length,
                  )}{" "}
                  mismatches / Cycle totals{" "}
                  {postImportResult.durableVerification?.cycleTotalsAvailable === false
                    ? "unavailable"
                    : postImportResult.durableVerification?.cycleTotalsMatch === true
                      ? "match"
                      : postImportResult.durableVerification?.cycleTotalsMatch === false
                        ? "differ"
                        : "pending"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Audit</p>
                <p className="mt-1 font-black">
                  {numberText(completedVerification?.auditRowsWritten)} rows written
                </p>
                <p className="mt-1">
                  History: {postImportResult.durableVerification?.historySource ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Collision Checks</p>
                <p className="mt-1 font-black">
                  Instance {completedVerification?.duplicateInstanceIdResult ?? "—"} · Tree/date{" "}
                  {completedVerification?.duplicateTreeDateResult ?? "—"} · Tree/Cycle{" "}
                  {completedVerification?.duplicateTreeCycleResult ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Completed By / At</p>
                <p className="mt-1 font-black">
                  {completedVerification?.importUser ?? String(postImportResult.run.admin_user ?? "—")}
                </p>
                <p className="mt-1 font-black">
                  {completedVerification?.importTimestamp ??
                    String(
                      postImportResult.run.completed_at ??
                        postImportResult.run.run_ended_at ??
                        "—",
                    )}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {(
                [
                  ["Cycle Totals Before", postImportResult.verification.cycleTotalsBefore],
                  ["Cycle Totals Projected", postImportResult.verification.cycleTotalsProjected],
                  ["Cycle Totals After", postImportResult.verification.cycleTotalsAfter],
                ] as const
              ).map(([label, totals]) => (
                <div key={label} className="rounded-lg border bg-background p-3 text-xs">
                  <p className="font-bold uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 font-black">
                    {numberText(totals?.records)} records / {numberText(totals?.trees)} trees /{" "}
                    {numberText(totals?.bunches)} bunches / {numberText(totals?.nuts)} nuts
                  </p>
                </div>
              ))}
            </div>
            {postImportResult.durableVerificationError ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-950"
              >
                {postImportResult.durableVerificationError}. Do not retry the import; use the
                durable history verification control.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  postImportDownloadTarget
                    ? void downloadHistoryCsv(postImportDownloadTarget, "records")
                    : undefined
                }
                disabled={busy !== null || !postImportDownloadTarget}
                className="inline-flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs font-black disabled:opacity-40"
              >
                <Download className="size-4" aria-hidden="true" />
                Download Post-Import Records CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  postImportDownloadTarget
                    ? void downloadHistoryCsv(postImportDownloadTarget, "audit")
                    : undefined
                }
                disabled={busy !== null || !postImportDownloadTarget}
                className="inline-flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs font-black disabled:opacity-40"
              >
                <Download className="size-4" aria-hidden="true" />
                Download Post-Import Audit CSV
              </button>
            </div>
            <p className="mt-3 break-all font-mono text-[10px]">
              Post-import records SHA-256:{" "}
              {postImportRecordsReceipt?.sha256 ??
                completedVerification?.recordsCsvSha256 ??
                "—"}
            </p>
            <p className="mt-1 break-all font-mono text-[10px]">
              Post-import audit SHA-256:{" "}
              {postImportAuditReceipt?.sha256 ??
                completedVerification?.auditCsvSha256 ??
                "—"}
            </p>
            <p className="mt-1 break-all font-mono text-[10px]">
              Downloaded records SHA-256:{" "}
              {postImportRecordsReceipt?.sha256 ??
                postImportResult.durableVerification?.recordsCsvSha256 ??
                "—"}
            </p>
            <p className="mt-1 break-all font-mono text-[10px]">
              Downloaded audit SHA-256:{" "}
              {postImportAuditReceipt?.sha256 ??
                postImportResult.durableVerification?.auditCsvSha256 ??
                "—"}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
              History source: {postImportResult.durableVerification?.historySource ?? "—"}
            </p>
          </section>
        ) : null}
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="min-w-[1750px] text-left text-xs">
            <thead>
              <tr className="border-b">
                <th className="p-2">Run</th>
                <th className="p-2">Harvest Date</th>
                <th className="p-2">Cycle</th>
                <th className="p-2">Status</th>
                <th className="p-2">Count</th>
                <th className="p-2">Bunches</th>
                <th className="p-2">Nuts</th>
                <th className="p-2">User</th>
                <th className="p-2">Completed</th>
                <th className="p-2">Date Fingerprint</th>
                <th className="p-2">Control Path</th>
                <th className="p-2">Verification & Downloads</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const sourceId = Number(entry.sourceId)
                const downloadTarget: HistoryDownloadTarget = {
                  key: entry.id,
                  sourceId,
                  runType: entry.runType,
                }
                const runId = sourceId
                const run = {
                  id: sourceId,
                  harvest_date: entry.harvestDate,
                  cycle_no: entry.harvestCycle,
                  result: entry.status,
                  imported: entry.recordCount,
                  admin_user: entry.adminUser,
                  completed_at: entry.timestamp,
                  run_ended_at: entry.timestamp,
                  date_scoped_batch_fingerprint: entry.dateScopedBatchFingerprint,
                }
                const details = {
                  target_harvest_date: entry.harvestDate,
                  confirmed_candidate_count: entry.recordCount,
                  confirmed_candidate_bunches: entry.totalBunches,
                  confirmed_candidate_nuts: entry.totalNuts,
                  date_scoped_batch_fingerprint: entry.dateScopedBatchFingerprint,
                }
                const verification =
                  entry.runType === "COMMITTED"
                    ? historyVerification[String(sourceId)]
                    : undefined
                const recordsReceipt =
                  historyDownloadReceipts[`${entry.id}-records`]
                const auditReceipt = historyDownloadReceipts[`${entry.id}-audit`]
                return (
                  <tr key={entry.id} className="border-b align-top">
                    <td className="p-2 font-bold">
                      {entry.runType === "DRY_RUN" ? "Dry run" : "Commit"} #{sourceId}
                    </td>
                    <td className="p-2">{displayHarvestDate(String(run.harvest_date ?? details.target_harvest_date ?? ""))}</td>
                    <td className="p-2">{String(run.cycle_no ?? "—")}</td>
                    <td className="p-2 font-bold">{String(run.result ?? "—")}</td>
                    <td className="p-2">{numberText(run.imported ?? details.confirmed_candidate_count)}</td>
                    <td className="p-2">{numberText(details.confirmed_candidate_bunches)}</td>
                    <td className="p-2">{numberText(details.confirmed_candidate_nuts)}</td>
                    <td className="p-2">{String(run.admin_user ?? "—")}</td>
                    <td className="p-2">{String(run.completed_at ?? run.run_ended_at ?? "—")}</td>
                    <td className="max-w-60 break-all p-2 font-mono text-[10px]">
                      {String(run.date_scoped_batch_fingerprint ?? details.date_scoped_batch_fingerprint ?? "—")}
                    </td>
                    <td className="p-2 font-bold">
                      {entry.runType === "DRY_RUN"
                        ? entry.consumedRunId
                          ? `DRY RUN / CONSUMED BY COMMIT #${entry.consumedRunId}`
                          : "DRY RUN"
                        : "COMMITTED IMPORT"}
                    </td>
                    <td className="p-2">
                      <div className="flex min-w-72 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void verifyHistoryRun(runId)}
                          disabled={
                            busy !== null ||
                            !Number.isFinite(runId) ||
                            entry.runType !== "COMMITTED" ||
                            !entry.postImportVerificationAvailable
                          }
                          className="rounded border px-2 py-1 font-bold disabled:opacity-40"
                        >
                          {entry.runType === "COMMITTED" ? "Verify" : "Rollback verified"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadHistoryCsv(downloadTarget, "records")}
                          disabled={
                            busy !== null ||
                            !Number.isFinite(runId) ||
                            !entry.recordsCsvAvailable
                          }
                          className="rounded border px-2 py-1 font-bold disabled:opacity-40"
                        >
                          {entry.runType === "DRY_RUN" ? "Pre-Import CSV" : "Records CSV"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadHistoryCsv(downloadTarget, "audit")}
                          disabled={
                            busy !== null ||
                            !Number.isFinite(runId) ||
                            !entry.auditCsvAvailable
                          }
                          className="rounded border px-2 py-1 font-bold disabled:opacity-40"
                        >
                          Audit CSV
                        </button>
                      </div>
                      <p className="mt-2 font-bold">
                        Verification:{" "}
                        {entry.runType === "DRY_RUN"
                          ? String(entry.status ?? "VERIFIED_ROLLBACK")
                          : String(verification?.result ?? "not run")}
                      </p>
                      {recordsReceipt ? (
                        <p className="mt-1 break-all font-mono text-[9px]">
                          Records SHA-256: {recordsReceipt.sha256}
                        </p>
                      ) : null}
                      {auditReceipt ? (
                        <p className="mt-1 break-all font-mono text-[9px]">
                          Audit SHA-256: {auditReceipt.sha256}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-muted-foreground">No manual import history is recorded.</p>
        ) : null}
      </Panel>
    </div>
  )
}
