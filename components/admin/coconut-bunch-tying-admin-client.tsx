"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, Download, FileSpreadsheet, History, Link2, Upload } from "lucide-react"

import { Panel } from "@/components/farm/panel"

interface PreviewRow {
  source_row_number: number
  tree_no: string
  bunches_tied: number | null
  plot: string | null
  status: "valid" | "invalid"
  errors: string[]
  warnings: string[]
}

interface ImportPreview {
  ok: true
  filename: string
  round_code: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  duplicate_rows: number
  unreported_tree_count: number
  total_bunches_tied: number
  plot_totals: Record<string, { trees_reported: number; bunches_tied: number }>
  rows: PreviewRow[]
  errors: string[]
  warnings: string[]
}

interface TyingRound {
  round_id: number
  round_code: string
  work_start_date: string
  work_end_date: string
  source_filename: string
  source_row_count: number
  total_bunches_tied: number
  imported_by: string
  imported_at: string
  status: string
}

interface CoverageMetrics {
  active_registered_trees: number
  trees_listed: number
  trees_observed: number
  total_bunches_tied: number
  missing_from_batch: number
  observed_coverage_pct: number
  average_tied_bunches: number | null
}

interface CoverageResponse {
  round: TyingRound
  metrics: CoverageMetrics
  plot_breakdown: Array<CoverageMetrics & { plot: string }>
  previous_round: TyingRound | null
  deltas: {
    trees_observed: number
    total_bunches_tied: number
    observed_coverage_pct: number
  } | null
  follow_up: Array<{
    tree_no: string
    plot: string
    reason: string
    last_tying_date: string | null
    last_tied_bunches: number | null
    last_round_code: string | null
  }>
}

type TyingTab = "import" | "history" | "coverage"

const fieldClass = "mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm normal-case text-foreground"

function defaultRoundCode(): string {
  const now = new Date()
  return `${now.getFullYear()}-H${now.getMonth() < 6 ? "1" : "2"}`
}

function errorList(payload: unknown, fallback: string): string[] {
  if (payload && typeof payload === "object" && Array.isArray((payload as { errors?: unknown }).errors)) {
    return (payload as { errors: unknown[] }).errors.map(String)
  }
  return [fallback]
}

export function CoconutBunchTyingAdminClient() {
  const [activeTab, setActiveTab] = useState<TyingTab>("import")
  const [roundCode, setRoundCode] = useState(defaultRoundCode)
  const [workStartDate, setWorkStartDate] = useState("")
  const [workEndDate, setWorkEndDate] = useState("")
  const [labourTeam, setLabourTeam] = useState("")
  const [remarks, setRemarks] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [rounds, setRounds] = useState<TyingRound[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null)
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [coverageBusy, setCoverageBusy] = useState(false)
  const [followUpSearch, setFollowUpSearch] = useState("")
  const [followUpPlot, setFollowUpPlot] = useState("All")
  const [busy, setBusy] = useState<"idle" | "validating" | "applying">("idle")
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const requestInFlight = useRef(false)

  const loadRounds = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/coconut-bunch-tying/rounds", { cache: "no-store" })
      const data = (await response.json().catch(() => ({}))) as { rounds?: TyingRound[] }
      if (response.ok && Array.isArray(data.rounds)) {
        setRounds(data.rounds)
        setSelectedRoundId((current) => current ?? data.rounds?.[0]?.round_id ?? null)
      }
    } catch {
      // Import remains available even when the history panel cannot refresh.
    }
  }, [])

  useEffect(() => { void loadRounds() }, [loadRounds])

  const loadCoverage = useCallback(async (roundId: number) => {
    setCoverageBusy(true)
    setErrors([])
    try {
      const response = await fetch("/api/admin/coconut-bunch-tying/rounds/" + roundId + "/coverage", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setCoverage(null)
        setErrors(errorList(data, "Coverage could not be loaded (" + response.status + ")."))
        return
      }
      setCoverage(data as CoverageResponse)
    } catch (error) {
      setCoverage(null)
      setErrors([error instanceof Error ? error.message : "Unable to load round coverage."])
    } finally {
      setCoverageBusy(false)
    }
  }, [])

  function formData(): FormData | null {
    if (!file) return null
    const form = new FormData()
    form.set("file", file, file.name)
    form.set("round_code", roundCode.trim())
    form.set("work_start_date", workStartDate)
    form.set("work_end_date", workEndDate)
    form.set("labour_team", labourTeam.trim())
    form.set("remarks", remarks.trim())
    return form
  }

  async function validateWorkbook() {
    if (requestInFlight.current) return
    const body = formData()
    if (!body) {
      setErrors(["Select the specialist labour Excel workbook first."])
      return
    }
    requestInFlight.current = true
    setBusy("validating")
    setPreview(null)
    setMessage("")
    setErrors([])
    try {
      const response = await fetch("/api/admin/coconut-bunch-tying/import/validate", { method: "POST", body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok !== true) {
        setErrors(errorList(data, `Validation failed with status ${response.status}.`))
        return
      }
      setPreview(data as ImportPreview)
      setMessage(data.invalid_rows === 0 && data.errors.length === 0
        ? "Workbook validated. Review the round totals, then import all rows in one transaction."
        : "Workbook has invalid rows. Correct the Excel file and validate it again; partial import is not allowed.")
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to validate the workbook."])
    } finally {
      requestInFlight.current = false
      setBusy("idle")
    }
  }

  async function applyWorkbook() {
    if (requestInFlight.current || !preview || preview.invalid_rows > 0) return
    const body = formData()
    if (!body) return
    requestInFlight.current = true
    setBusy("applying")
    setMessage("")
    setErrors([])
    try {
      const response = await fetch("/api/admin/coconut-bunch-tying/import/apply", { method: "POST", body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok !== true) {
        setErrors(errorList(data, `Import failed with status ${response.status}.`))
        return
      }
      setPreview(null)
      setFile(null)
      setMessage(`Round ${roundCode} imported successfully. ${data.imported_rows ?? 0} tree observations are now queryable.`)
      await loadRounds()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to import the workbook."])
    } finally {
      requestInFlight.current = false
      setBusy("idle")
    }
  }

  async function downloadTemplate() {
    const response = await fetch("/api/admin/coconut-bunch-tying/template")
    if (!response.ok) {
      setErrors(["Unable to download the Excel template."])
      return
    }
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = "coconut-bunch-tying-template.xlsx"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const filteredFollowUp = (coverage?.follow_up ?? []).filter((row) => {
    const matchesSearch = followUpSearch.trim() === "" || row.tree_no.toLowerCase().includes(followUpSearch.trim().toLowerCase())
    const matchesPlot = followUpPlot === "All" || row.plot === followUpPlot
    return matchesSearch && matchesPlot
  })

  function exportFollowUp() {
    if (!coverage) return
    const rows = [
      ["TreeNo", "Plot", "Reason", "LastRound", "LastTyingDate", "LastTiedBunches"],
      ...filteredFollowUp.map((row) => [
        row.tree_no,
        row.plot,
        row.reason,
        row.last_round_code ?? "",
        row.last_tying_date ?? "",
        row.last_tied_bunches ?? "",
      ]),
    ]
    const csv = rows
      .map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(","))
      .join("\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "coconut-bunch-tying-follow-up-" + coverage.round.round_code + ".csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Coconut operations</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">Coconut Bunch Tying</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Import specialist labour records, review permanent tying history, and follow up trees missed in each six-month round.
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-2 sm:grid-cols-3" role="tablist" aria-label="Coconut Bunch Tying">
        {[
          { id: "import" as const, label: "Excel Import", icon: Upload },
          { id: "history" as const, label: "Tying History", icon: History },
          { id: "coverage" as const, label: "Round Coverage & Follow-up", icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === "coverage" && selectedRoundId !== null) void loadCoverage(selectedRoundId)
              }}
              className={"inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors " + (
                selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "import" ? (
        <>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">One workbook must represent one completed bunch-tying round.</p>
            <p className="mt-1">Required Excel columns are <strong>TreeNo</strong> and <strong>BunchesTied</strong>. A written 0 is stored as zero; an omitted tree is treated as not reported and is never converted to zero.</p>
          </div>
        </div>
      </div>

      <Panel title="Import Bunch-Tying Round" icon={Link2}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Round Code
            <input value={roundCode} onChange={(event) => { setRoundCode(event.target.value); setPreview(null) }} placeholder="2026-H2" className={fieldClass} />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">Labour Team (optional)
            <input value={labourTeam} onChange={(event) => { setLabourTeam(event.target.value); setPreview(null) }} className={fieldClass} />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">Work Start Date
            <input type="date" value={workStartDate} onChange={(event) => { setWorkStartDate(event.target.value); setPreview(null) }} className={fieldClass} />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">Work End Date
            <input type="date" value={workEndDate} onChange={(event) => { setWorkEndDate(event.target.value); setPreview(null) }} className={fieldClass} />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground lg:col-span-2">Remarks (optional)
            <input value={remarks} onChange={(event) => { setRemarks(event.target.value); setPreview(null) }} className={fieldClass} />
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground lg:col-span-2">Specialist Labour Excel Workbook
            <input type="file" accept=".xlsx,.xlsm" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null) }} className="mt-1 block w-full rounded-md border border-dashed border-border bg-background p-3 text-sm normal-case" />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void downloadTemplate()} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent"><Download className="size-4" />Download Template</button>
          <button type="button" disabled={busy !== "idle"} onClick={() => void validateWorkbook()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"><FileSpreadsheet className="size-4" />{busy === "validating" ? "Validating…" : "Validate Workbook"}</button>
          <button type="button" disabled={!preview || preview.invalid_rows > 0 || preview.errors.length > 0 || busy !== "idle"} onClick={() => void applyWorkbook()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Upload className="size-4" />{busy === "applying" ? "Importing…" : "Import Validated Round"}</button>
        </div>

        {message ? <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{message}</p> : null}
        {errors.length > 0 ? <ul className="mt-4 list-disc rounded-lg border border-destructive/30 bg-destructive/5 p-4 pl-8 text-sm text-destructive">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      </Panel>

      {preview ? (
        <Panel title="Validation Preview" icon={FileSpreadsheet}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Workbook Rows", preview.total_rows], ["Valid Rows", preview.valid_rows], ["Invalid Rows", preview.invalid_rows],
              ["Duplicate Rows", preview.duplicate_rows], ["Unreported Trees", preview.unreported_tree_count], ["Total Bunches Tied", preview.total_bunches_tied],
            ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{Number(value).toLocaleString("en-IN")}</p></div>)}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead><tr className="bg-primary/10 text-left text-xs font-bold uppercase text-primary"><th className="px-3 py-2">Excel Row</th><th className="px-3 py-2">Tree No</th><th className="px-3 py-2">Plot</th><th className="px-3 py-2 text-right">Bunches Tied</th><th className="px-3 py-2">Status / Notes</th></tr></thead>
              <tbody>{preview.rows.map((row) => <tr key={row.source_row_number} className="border-b border-border"><td className="px-3 py-2">{row.source_row_number}</td><td className="px-3 py-2 font-bold">{row.tree_no || "—"}</td><td className="px-3 py-2">{row.plot || "—"}</td><td className="px-3 py-2 text-right font-bold">{row.bunches_tied ?? "—"}</td><td className="px-3 py-2 text-muted-foreground">{[...row.errors, ...row.warnings].join("; ") || "Valid"}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      ) : null}
        </>
      ) : null}

      {activeTab === "history" ? <Panel title="Permanent Tying History" icon={History}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead><tr className="bg-primary/10 text-left text-xs font-bold uppercase text-primary"><th className="px-3 py-2">Round</th><th className="px-3 py-2">Work Dates</th><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Trees</th><th className="px-3 py-2 text-right">Bunches Tied</th><th className="px-3 py-2">Imported</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Source File</th></tr></thead>
            <tbody>{rounds.map((round) => <tr key={round.round_id} className="border-b border-border"><td className="px-3 py-2 font-bold">{round.round_code}</td><td className="px-3 py-2">{round.work_start_date}–{round.work_end_date}</td><td className="px-3 py-2">{round.source_filename}</td><td className="px-3 py-2 text-right">{round.source_row_count}</td><td className="px-3 py-2 text-right font-bold">{round.total_bunches_tied}</td><td className="px-3 py-2">{round.imported_by}</td><td className="px-3 py-2">{round.status}</td><td className="px-3 py-2"><a className="font-bold text-primary hover:underline" href={"/api/admin/coconut-bunch-tying/rounds/" + round.round_id + "/source"}>Download</a></td></tr>)}</tbody>
          </table>
          {rounds.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No bunch-tying round has been imported yet.</p> : null}
        </div>
      </Panel> : null}

      {activeTab === "coverage" ? (
        <div className="flex flex-col gap-5">
          {errors.length > 0 ? <ul className="list-disc rounded-lg border border-destructive/30 bg-destructive/5 p-4 pl-8 text-sm text-destructive">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          <Panel title="Select Tying Round" icon={BarChart3}>
            <label className="block max-w-md text-xs font-bold uppercase text-muted-foreground">
              Round
              <select
                value={selectedRoundId ?? ""}
                onChange={(event) => {
                  const roundId = Number(event.target.value)
                  setSelectedRoundId(roundId)
                  void loadCoverage(roundId)
                }}
                className={fieldClass}
                disabled={rounds.length === 0}
              >
                {rounds.map((round) => <option key={round.round_id} value={round.round_id}>{round.round_code} · {round.work_end_date}</option>)}
              </select>
            </label>
          </Panel>

          {coverageBusy ? <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading coverage…</p> : null}
          {!coverageBusy && rounds.length === 0 ? <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Import a tying round before reviewing coverage.</p> : null}
          {!coverageBusy && coverage ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Active Trees", coverage.metrics.active_registered_trees],
                  ["Trees Observed", coverage.metrics.trees_observed],
                  ["Coverage", coverage.metrics.observed_coverage_pct.toFixed(1) + "%"],
                  ["Missing from Round", coverage.metrics.missing_from_batch],
                  ["Total Bunches Tied", coverage.metrics.total_bunches_tied],
                  ["Average per Observed Tree", coverage.metrics.average_tied_bunches?.toFixed(2) ?? "—"],
                ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
              </div>

              <Panel title="Plot Reconciliation" icon={BarChart3}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead><tr className="bg-primary/10 text-left text-xs font-bold uppercase text-primary"><th className="px-3 py-2">Plot</th><th className="px-3 py-2 text-right">Active</th><th className="px-3 py-2 text-right">Observed</th><th className="px-3 py-2 text-right">Missing</th><th className="px-3 py-2 text-right">Coverage</th><th className="px-3 py-2 text-right">Bunches Tied</th></tr></thead>
                    <tbody>{coverage.plot_breakdown.map((row) => <tr key={row.plot} className="border-b border-border"><td className="px-3 py-2 font-bold">{row.plot}</td><td className="px-3 py-2 text-right">{row.active_registered_trees}</td><td className="px-3 py-2 text-right">{row.trees_observed}</td><td className="px-3 py-2 text-right">{row.missing_from_batch}</td><td className="px-3 py-2 text-right">{row.observed_coverage_pct.toFixed(1)}%</td><td className="px-3 py-2 text-right font-bold">{row.total_bunches_tied}</td></tr>)}</tbody>
                  </table>
                </div>
                {coverage.deltas && coverage.previous_round ? <p className="mt-4 text-sm text-muted-foreground">Compared with {coverage.previous_round.round_code}: {coverage.deltas.trees_observed >= 0 ? "+" : ""}{coverage.deltas.trees_observed} trees observed, {coverage.deltas.total_bunches_tied >= 0 ? "+" : ""}{coverage.deltas.total_bunches_tied} bunches, {coverage.deltas.observed_coverage_pct >= 0 ? "+" : ""}{coverage.deltas.observed_coverage_pct.toFixed(1)} coverage points.</p> : <p className="mt-4 text-sm text-muted-foreground">No earlier committed round is available for comparison.</p>}
              </Panel>

              <Panel title="Follow-up Trees" icon={AlertTriangle}>
                <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Search Tree No
                    <input value={followUpSearch} onChange={(event) => setFollowUpSearch(event.target.value)} placeholder="Example: 1001.1" className={fieldClass} />
                  </label>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Plot
                    <select value={followUpPlot} onChange={(event) => setFollowUpPlot(event.target.value)} className={fieldClass}>
                      <option value="All">All plots</option>
                      {coverage.plot_breakdown.map((row) => <option key={row.plot} value={row.plot}>{row.plot}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => { setFollowUpSearch(""); setFollowUpPlot("All") }} className="mt-auto h-11 rounded-lg border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>
                  <button type="button" onClick={exportFollowUp} disabled={filteredFollowUp.length === 0} className="mt-auto h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Export CSV</button>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{filteredFollowUp.length} of {coverage.follow_up.length} follow-up trees shown.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead><tr className="bg-primary/10 text-left text-xs font-bold uppercase text-primary"><th className="px-3 py-2">Tree No</th><th className="px-3 py-2">Plot</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2">Last Round</th><th className="px-3 py-2">Last Tying Date</th><th className="px-3 py-2 text-right">Last Count</th></tr></thead>
                    <tbody>{filteredFollowUp.map((row) => <tr key={row.tree_no} className="border-b border-border"><td className="px-3 py-2 font-bold">{row.tree_no}</td><td className="px-3 py-2">{row.plot}</td><td className="px-3 py-2">{row.reason}</td><td className="px-3 py-2">{row.last_round_code ?? "—"}</td><td className="px-3 py-2">{row.last_tying_date ?? "—"}</td><td className="px-3 py-2 text-right">{row.last_tied_bunches ?? "—"}</td></tr>)}</tbody>
                  </table>
                  {coverage.follow_up.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Every active tree was observed in this round.</p> : null}
                  {coverage.follow_up.length > 0 && filteredFollowUp.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No follow-up trees match the current filters.</p> : null}
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
