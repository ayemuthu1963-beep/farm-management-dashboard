"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, DatabaseZap, History, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { Panel } from "@/components/farm/panel"

interface SyncStatus {
  projectId: number
  formId: string
  openCycle: { harvest_cycle: string; harvest_start_date: string; harvest_end_date: string | null; harvest_status: string } | null
  latestScan: any | null
  latestImport: any | null
  cycleSummary: { records: number; trees: number; bunches: number; nuts: number } | null
}

interface ScanData {
  scan: any
  items: any[]
}

function n(value: unknown): string {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0"
}

function d(value: string | null | undefined): string {
  if (!value) return "—"
  return value.slice(0, 10)
}

function classBadge(classification: string) {
  if (classification === "READY_NEW") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (classification === "ALREADY_IMPORTED") return "bg-slate-50 text-slate-700 border-slate-200"
  if (classification === "SUPERSEDED") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

export function HarvestSyncAdminClient() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [scan, setScan] = useState<ScanData | null>(null)
  const [issues, setIssues] = useState<any | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function loadStatus() {
    const response = await fetch("/api/admin/harvest-sync/status", { cache: "no-store" })
    if (response.ok) setStatus(await response.json())
  }

  async function loadIssues() {
    const response = await fetch("/api/admin/harvest-sync/issues", { cache: "no-store" })
    if (response.ok) setIssues(await response.json())
  }

  async function loadHistory() {
    const response = await fetch("/api/admin/harvest-sync/history", { cache: "no-store" })
    if (response.ok) setHistory(((await response.json()) as { runs?: any[] }).runs ?? [])
  }

  useEffect(() => {
    void loadStatus()
    void loadIssues()
    void loadHistory()
  }, [])

  const latestScan = scan?.scan ?? status?.latestScan ?? null
  const issueCounts = useMemo(() => {
    const source = scan?.scan ?? issues?.scan ?? status?.latestScan
    return {
      ready: Number(source?.ready_new_count ?? 0),
      duplicates: Number(source?.duplicate_group_count ?? 0),
      duplicateReview: Number(source?.duplicate_review_count ?? 0),
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
      setMessage({ ok: true, text: `Scan ${data.scan.id} complete. Review issues before importing.` })
      await Promise.all([loadStatus(), loadIssues(), loadHistory()])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Scan failed" })
    } finally {
      setBusy(null)
    }
  }

  async function importApproved() {
    const scanId = latestScan?.id
    if (!scanId) {
      setMessage({ ok: false, text: "Run Scan ODK before importing." })
      return
    }
    setBusy("import")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: scanId, mode: "approved" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Import failed")
      setMessage({ ok: true, text: `Import finished: ${data.result.result}. Imported ${data.result.imported} rows; ${data.result.excluded} unresolved rows remain.` })
      await Promise.all([loadStatus(), loadIssues(), loadHistory()])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Import failed" })
    } finally {
      setBusy(null)
    }
  }

  const duplicateRows = (issues?.groups?.duplicateTreeEntries ?? scan?.items?.filter((item) => ["DUPLICATE_REVIEW_REQUIRED", "SUPERSEDED"].includes(item.classification)) ?? []).slice(0, 80)
  const unmatchedRows = (issues?.groups?.treesNotInMaster ?? scan?.items?.filter((item) => item.classification === "UNMATCHED_TREE") ?? []).slice(0, 40)

  return (
    <div className="space-y-5">
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
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void scanOdk()} disabled={busy !== null} className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy === "scan" ? "Scanning..." : "Scan ODK"}</button>
          <button onClick={() => void loadIssues()} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-extrabold">Review Issues</button>
          <button onClick={() => void importApproved()} disabled={busy !== null || !latestScan} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60">{busy === "import" ? "Importing..." : "Import Approved"}</button>
          <button onClick={() => void loadHistory()} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-extrabold">View Import History</button>
        </div>
        {message ? (
          <div className={`mt-4 rounded-xl border p-3 text-sm font-bold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {message.ok ? <CheckCircle2 className="mr-2 inline size-4" /> : <AlertTriangle className="mr-2 inline size-4" />}
            {message.text}
          </div>
        ) : null}
      </Panel>

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

      <Panel title="Duplicate Tree Entries" icon={AlertTriangle}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Tree</th><th className="p-2">ODK Time</th><th className="p-2">B1</th><th className="p-2">B2</th><th className="p-2">B3</th><th className="p-2">Nuts</th><th className="p-2">Status</th><th className="p-2">Default Latest</th></tr></thead>
            <tbody>{duplicateRows.map((row: any) => <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b"><td className="p-2">{d(row.harvest_date)}</td><td className="p-2 font-bold">{row.original_tree_no}</td><td className="p-2">{row.odk_submission_timestamp ?? "—"}</td><td className="p-2">{row.b1}</td><td className="p-2">{row.b2}</td><td className="p-2">{row.b3}</td><td className="p-2">{row.total_nuts}</td><td className="p-2"><span className={`rounded-full border px-2 py-1 ${classBadge(row.classification)}`}>{row.classification}</span></td><td className="p-2">{row.is_default_effective ? "Yes" : "No"}</td></tr>)}</tbody>
          </table>
        </div>
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
