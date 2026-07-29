"use client"

import { useEffect, useMemo, useState } from "react"
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
  confirmationToken: string
  candidateCount: number
  candidateBunches: number
  candidateNuts: number
  exactDuplicateRetained: number
  exactDuplicateSuperseded: number
  unresolvedCount: number
  effectiveRecordCountsByDate: Record<string, number>
  candidates: any[]
}

function n(value: unknown): string {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0"
}

function d(value: string | null | undefined): string {
  if (!value) return "—"
  return value.slice(0, 10)
}

function naturalTreeCompare(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

const CONFLICT_GROUP_PAGE_SIZE = 10
const EXACT_GROUP_PAGE_SIZE = 25

function classBadge(classification: string) {
  if (classification === "READY_NEW") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (classification === "READY_EXACT_DUPLICATE") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (classification === "ALREADY_IMPORTED") return "bg-slate-50 text-slate-700 border-slate-200"
  if (classification === "SUPERSEDED_EXACT_DUPLICATE") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

export function HarvestSyncAdminClient() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [scan, setScan] = useState<ScanData | null>(null)
  const [issues, setIssues] = useState<any | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scanIdInput, setScanIdInput] = useState("")
  const [dateFilter, setDateFilter] = useState("2026-07-29")
  const [treeFilter, setTreeFilter] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [conflictPage, setConflictPage] = useState(1)
  const [exactPage, setExactPage] = useState(1)
  const [selectedInstanceByGroup, setSelectedInstanceByGroup] = useState<Record<string, string>>({})
  const [decisionReasonByGroup, setDecisionReasonByGroup] = useState<Record<string, string>>({})

  async function loadStatus(): Promise<SyncStatus | null> {
    const response = await fetch("/api/admin/harvest-sync/status", { cache: "no-store" })
    if (!response.ok) return null
    const data = (await response.json()) as SyncStatus
    setStatus(data)
    return data
  }

  async function loadIssues(scanId?: number) {
    const query = scanId ? `?scan_id=${scanId}` : ""
    const response = await fetch(`/api/admin/harvest-sync/issues${query}`, { cache: "no-store" })
    if (response.ok) setIssues(await response.json())
  }

  async function loadScan(scanId: number) {
    setBusy("load-scan")
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/harvest-sync/scans/${scanId}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Unable to load scan")
      setScan(data)
      setScanIdInput(String(scanId))
      setImportPlan(null)
      setConflictPage(1)
      setExactPage(1)
      await loadIssues(scanId)
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

  const latestScan = scan?.scan ?? status?.latestScan ?? null
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
    if (!scanId) {
      setMessage({ ok: false, text: "Run Scan ODK before importing." })
      return
    }
    setBusy("preview-import")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: scanId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Unable to prepare final import summary")
      setImportPlan(data.plan)
      setMessage({ ok: true, text: "Final import set prepared. Review the complete summary before confirming." })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to prepare final import summary" })
    } finally {
      setBusy(null)
    }
  }

  async function importApproved() {
    const scanId = latestScan?.id
    if (!scanId || !importPlan) {
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
          mode: "approved",
          confirmation_token: importPlan.confirmationToken,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Import failed")
      setMessage({ ok: true, text: `Import finished: ${data.result.result}. Imported ${data.result.imported} rows; ${data.result.excluded} unresolved rows remain.` })
      setImportPlan(null)
      await Promise.all([loadStatus(), loadIssues(), loadHistory()])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Import failed" })
    } finally {
      setBusy(null)
    }
  }

  async function downloadAuditCsv() {
    const scanId = latestScan?.id
    if (!scanId) return
    setBusy("audit-csv")
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/harvest-sync/scans/${scanId}/audit.csv`, { cache: "no-store" })
      if (!response.ok) throw new Error("Unable to create pre-import audit CSV")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `harvest-sync-scan-${scanId}-audit.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to create pre-import audit CSV" })
    } finally {
      setBusy(null)
    }
  }

  async function saveConflictSelection(groupKey: string, rows: any[]) {
    const selectedInstance = selectedInstanceByGroup[groupKey]
    const reason = decisionReasonByGroup[groupKey]?.trim()
    if (!selectedInstance || !reason) {
      setMessage({ ok: false, text: "Select the correct ODK submission and record a supervisor reason." })
      return
    }
    const anchorRow = rows.find((row) => row.odk_instance_id === selectedInstance) ?? rows[0]
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
      setMessage({ ok: true, text: `Supervisor selection saved for Tree ${anchorRow.original_tree_no}. No Harvest record was imported.` })
      setImportPlan(null)
      await Promise.all([loadScan(Number(latestScan?.id)), loadHistory()])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save supervisor selection" })
    } finally {
      setBusy(null)
    }
  }

  const selectedItems = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase()
    return (scan?.items ?? [])
      .filter((item) => !dateFilter || d(item.harvest_date) === dateFilter)
      .filter((item) => !query || String(item.original_tree_no ?? "").toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        const compared = naturalTreeCompare(left.original_tree_no, right.original_tree_no)
        if (compared !== 0) return sortDirection === "asc" ? compared : -compared
        return String(left.odk_submission_timestamp ?? "").localeCompare(String(right.odk_submission_timestamp ?? ""))
      })
  }, [scan, dateFilter, treeFilter, sortDirection])

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
  const singleRows = selectedGroups.filter(([, rows]) => rows.length === 1).map(([, rows]) => rows[0])
  const allConflictGroups = useMemo(() => {
    return selectedGroups
      .filter(([, rows]) => rows.length > 1 && rows.some((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED"))
      .sort((left, right) => {
      const compared = naturalTreeCompare(left[1][0]?.original_tree_no, right[1][0]?.original_tree_no)
      return sortDirection === "asc" ? compared : -compared
    })
  }, [selectedGroups, sortDirection])
  const allConflictRows = allConflictGroups.flatMap(([, rows]) => rows)
  const cycleReviewRows = singleRows.filter((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED")
  const conflictingGroupCount = allConflictGroups.length
  const conflictPageCount = Math.max(1, Math.ceil(allConflictGroups.length / CONFLICT_GROUP_PAGE_SIZE))
  const visibleConflictGroups = allConflictGroups.slice(
    (conflictPage - 1) * CONFLICT_GROUP_PAGE_SIZE,
    conflictPage * CONFLICT_GROUP_PAGE_SIZE,
  )
  const exactDuplicateGroups = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase()
    return [...(issues?.groups?.exactDuplicateGroups ?? [])]
      .filter((group: any) => !dateFilter || d(group.harvestDate) === dateFilter)
      .filter((group: any) => !query || String(group.treeNo ?? "").toLocaleLowerCase().includes(query))
      .sort((left: any, right: any) => {
        const compared = naturalTreeCompare(left.treeNo, right.treeNo)
        return sortDirection === "asc" ? compared : -compared
      })
  }, [issues, dateFilter, treeFilter, sortDirection])
  const exactPageCount = Math.max(1, Math.ceil(exactDuplicateGroups.length / EXACT_GROUP_PAGE_SIZE))
  const visibleExactDuplicateGroups = exactDuplicateGroups.slice(
    (exactPage - 1) * EXACT_GROUP_PAGE_SIZE,
    exactPage * EXACT_GROUP_PAGE_SIZE,
  )
  const unmatchedRows = selectedItems.filter((item) => item.classification === "UNMATCHED_TREE")

  useEffect(() => {
    setConflictPage(1)
    setExactPage(1)
  }, [dateFilter, treeFilter, sortDirection])

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
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Tree Number Search
            <input
              value={treeFilter}
              onChange={(event) => setTreeFilter(event.target.value)}
              placeholder="For example, 845.1"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Tree Sort
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
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
          <button onClick={() => void prepareImport()} disabled={busy !== null || !latestScan} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60">{busy === "preview-import" ? "Preparing..." : "Review Final Import Set"}</button>
          <button onClick={() => void downloadAuditCsv()} disabled={busy !== null || !latestScan} className="rounded-lg border px-4 py-2 text-sm font-extrabold">{busy === "audit-csv" ? "Preparing CSV..." : "Download Pre-Import Audit CSV"}</button>
          <button onClick={() => void loadHistory()} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-extrabold">View Import History</button>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Showing {n(selectedItems.length)} submissions in {n(selectedTreeGroupCount)} tree/date groups for {dateFilter || "all dates"}.
        </p>
        {message ? (
          <div className={`mt-4 rounded-xl border p-3 text-sm font-bold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {message.ok ? <CheckCircle2 className="mr-2 inline size-4" /> : <AlertTriangle className="mr-2 inline size-4" />}
            {message.text}
          </div>
        ) : null}
      </Panel>

      {importPlan ? (
        <Panel title="Final Reviewed Import Summary" icon={CheckCircle2}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Effective Records</p><p className="text-2xl font-black">{n(importPlan.candidateCount)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Bunches / Nuts</p><p className="font-black">{n(importPlan.candidateBunches)} / {n(importPlan.candidateNuts)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Exact Duplicates</p><p className="font-black">{n(importPlan.exactDuplicateRetained)} retained</p><p className="text-xs">{n(importPlan.exactDuplicateSuperseded)} source submissions excluded</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Unresolved</p><p className="text-2xl font-black text-rose-700">{n(importPlan.unresolvedCount)}</p></div>
          </div>
          <div className="mt-4 max-h-72 overflow-auto rounded-xl border">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-background"><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Tree</th><th className="p-2">ODK Instance</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Source</th></tr></thead>
              <tbody>{importPlan.candidates.map((row: any) => <tr key={row.odk_instance_id} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2 font-bold">{row.import_tree_no}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td><td className="p-2">{row.classification}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Confirming inserts exactly the effective records listed above. A changed ODK fingerprint or review decision invalidates this confirmation.
          </div>
          <button
            onClick={() => void importApproved()}
            disabled={busy !== null || status?.importEnabled !== true}
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

      <Panel title={`Selected Date Review — ${dateFilter || "All Dates"}`} icon={Search}>
        <div className="grid gap-3 md:grid-cols-6">
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Source Submissions</p><p className="text-2xl font-black">{n(selectedItems.length)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Tree Groups</p><p className="text-2xl font-black">{n(selectedTreeGroupCount)}</p></div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-bold uppercase text-sky-800">Single Submissions</p><p className="text-2xl font-black text-sky-900">{n(singleRows.length)}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-800">Exact-Duplicate Groups</p><p className="text-2xl font-black text-emerald-900">{n(exactDuplicateGroups.length)}</p></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs font-bold uppercase text-rose-800">Conflicting Groups</p><p className="text-2xl font-black text-rose-900">{n(conflictingGroupCount)}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold uppercase text-amber-800">Cycle Safety Reviews</p><p className="text-2xl font-black text-amber-900">{n(cycleReviewRows.length)}</p></div>
        </div>
      </Panel>

      <Panel title="Exact Duplicates — Automatically Resolved" icon={ShieldCheck}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-800">Exact-Duplicate Tree Groups</p><p className="text-2xl font-black text-emerald-900">{n(issueCounts.exactDuplicateGroups)}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold uppercase text-amber-800">Source Submissions Excluded</p><p className="text-2xl font-black text-amber-900">{n(issueCounts.exactDuplicateSuperseded)}</p></div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-bold uppercase text-sky-800">Effective Records Retained</p><p className="text-2xl font-black text-sky-900">{n(issueCounts.exactDuplicateRetained)}</p></div>
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
                      {[group.retained, ...(group.superseded ?? [])].filter(Boolean).map((row: any) => <tr key={row.odk_instance_id} className="border-b"><td className="p-2 font-bold">{row.classification === "READY_EXACT_DUPLICATE" ? "Retained" : "Superseded"}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.submitter_name || "—"} / {row.device_id || "—"}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td></tr>)}
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
        <div className="space-y-3">
          {visibleConflictGroups.map(([groupKey, rows]) => {
            const first = rows[0]
            return (
              <details key={groupKey} className="rounded-xl border bg-background">
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Tree {first.original_tree_no} · {d(first.harvest_date)} · {n(rows.length)} conflicting submissions
                </summary>
                <div className="border-t p-4">
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
                                checked={selectedInstanceByGroup[groupKey] === row.odk_instance_id}
                                onChange={() => setSelectedInstanceByGroup((current) => ({ ...current, [groupKey]: row.odk_instance_id }))}
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
                      onClick={() => void saveConflictSelection(groupKey, rows)}
                      disabled={busy !== null || !selectedInstanceByGroup[groupKey] || !decisionReasonByGroup[groupKey]?.trim()}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
                    >
                      {busy === `decision-${groupKey}` ? "Saving..." : "Save Supervisor Selection"}
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

      <Panel title="Single-Submission Records — Visible in Review Set" icon={CheckCircle2}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">Every selected-date tree group with one source submission is visible. A cycle safety warning remains blocked rather than being silently treated as import-ready.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Tree</th><th className="p-2">ODK Instance</th><th className="p-2">Submitter / Device</th><th className="p-2">Submitted</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Bunches</th><th className="p-2">Nuts</th><th className="p-2">Review status</th></tr></thead>
            <tbody>{singleRows.map((row: any) => <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2 font-bold">{row.original_tree_no}</td><td className="p-2 font-mono">{row.odk_instance_id}</td><td className="p-2">{row.submitter_name || "—"} / {row.device_id || "—"}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_bunches}</td><td className="p-2">{row.total_nuts}</td><td className="p-2"><span className={`rounded-full border px-2 py-1 ${classBadge(row.classification)}`}>{row.classification}</span></td></tr>)}</tbody>
          </table>
        </div>
        {singleRows.length === 0 ? <p className="rounded-xl border p-3 text-sm text-muted-foreground">No single-submission records match the selected date and Tree Number filter.</p> : null}
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
