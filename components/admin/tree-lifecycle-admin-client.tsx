"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, FileSpreadsheet, History, RefreshCcw, Sprout, Trees, Upload } from "lucide-react"

import { TreeNumberAutocomplete } from "@/components/harvest/tree-number-autocomplete"
import { Panel } from "@/components/farm/panel"
import { treeNumberOptionKey, type TreeNumberOption } from "@/lib/tree-number-options"

type LifecycleAction = "REPLACEMENT_PLANTED" | "PROMOTE_EARLY_HARVEST" | "RESTORE_AUTOMATIC"

interface SaplingRow {
  tree_no: string
  plot?: string | null
  plantation_date: string
  months_since_planted: number
  lifecycle_status: string
  status_source?: string | null
  reason?: string | null
}

interface LifecycleEvent {
  id: number
  tree_no: string
  action: string
  plantation_date?: string | null
  effective_date?: string | null
  reason?: string | null
  admin_user?: string | null
  created_at?: string | null
}

interface LifecycleSummary {
  saplings: SaplingRow[]
  recent_events: LifecycleEvent[]
  total_saplings: number
}

interface ActionResult {
  ok: boolean
  errors: string[]
  message: string
}

interface ImportPreviewRow {
  row: number
  tree_no?: string | null
  plantation_date?: string | null
  months_since_planted?: number | null
  lifecycle_status?: string | null
  source?: string | null
  errors?: string[]
  warnings?: string[]
  will_import?: boolean
}

interface ImportPreview {
  filename: string
  as_of_date: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  ignored_duplicate_rows: number
  rows: ImportPreviewRow[]
}

const today = () => new Date().toISOString().slice(0, 10)

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(parsed)
}

function actionLabel(action: LifecycleAction) {
  if (action === "REPLACEMENT_PLANTED") return "Replacement → Make Sapling"
  if (action === "PROMOTE_EARLY_HARVEST") return "Early Bearing → Harvest Tree"
  return "Return to Automatic Rule"
}

function eventLabel(action: string): string {
  if (action === "REPLACEMENT_PLANTED") return "Replacement / Sapling"
  if (action === "PROMOTE_EARLY_HARVEST") return "Early bearing / Harvest Tree"
  if (action === "RESTORE_AUTOMATIC") return "Automatic rule restored"
  if (action === "INITIAL_IMPORT") return "Initial plantation date"
  return action.replaceAll("_", " ")
}

function ResultBox({ result }: { result: ActionResult | null }) {
  if (!result) return null
  return (
    <div className={`rounded-xl border p-3 text-sm ${result.ok ? "border-primary/25 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      <div className="flex items-start gap-2">
        {result.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
        <div>
          <p className="font-bold">{result.message}</p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function TreeLifecycleAdminClient() {
  const [summary, setSummary] = useState<LifecycleSummary | null>(null)
  const [summaryError, setSummaryError] = useState("")
  const [loading, setLoading] = useState(true)
  const [treeOptions, setTreeOptions] = useState<TreeNumberOption[]>([])
  const [treeOptionsLoading, setTreeOptionsLoading] = useState(false)
  const [treeOptionsError, setTreeOptionsError] = useState(false)
  const [action, setAction] = useState<LifecycleAction>("REPLACEMENT_PLANTED")
  const [treeNo, setTreeNo] = useState("")
  const [validatedTreeNo, setValidatedTreeNo] = useState("")
  const [plantationDate, setPlantationDate] = useState(today)
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [reason, setReason] = useState("")
  const [result, setResult] = useState<ActionResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importAsOfDate, setImportAsOfDate] = useState(today)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importResult, setImportResult] = useState<ActionResult | null>(null)
  const [validatingImport, setValidatingImport] = useState(false)
  const [applyingImport, setApplyingImport] = useState(false)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setSummaryError("")
    try {
      const response = await fetch("/api/admin/tree-lifecycle", { cache: "no-store" })
      const data = (await response.json().catch(() => ({}))) as Partial<LifecycleSummary> & { errors?: unknown }
      if (!response.ok || !Array.isArray(data.saplings) || !Array.isArray(data.recent_events)) {
        const errors = Array.isArray(data.errors) ? data.errors.map(String).join(" ") : "Unable to load Tree Lifecycle data."
        throw new Error(errors)
      }
      setSummary({
        saplings: data.saplings as SaplingRow[],
        recent_events: data.recent_events as LifecycleEvent[],
        total_saplings: typeof data.total_saplings === "number" ? data.total_saplings : data.saplings.length,
      })
    } catch (error) {
      setSummary(null)
      setSummaryError(error instanceof Error ? error.message : "Unable to load Tree Lifecycle data.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTreeOptions = useCallback(async () => {
    setTreeOptionsLoading(true)
    setTreeOptionsError(false)
    try {
      const response = await fetch("/api/coconut-harvest/tree-master", { cache: "no-store" })
      const data = (await response.json().catch(() => ({}))) as { treeNumbers?: unknown }
      if (!response.ok || !Array.isArray(data.treeNumbers) || !data.treeNumbers.every((value) => typeof value === "string")) {
        throw new Error("Unable to load Tree Numbers from Tree Master.")
      }
      setTreeOptions(data.treeNumbers.map((treeNumber) => ({ key: treeNumberOptionKey(treeNumber), treeNo: treeNumber })))
    } catch {
      setTreeOptions([])
      setTreeOptionsError(true)
    } finally {
      setTreeOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
    void loadTreeOptions()
  }, [loadSummary, loadTreeOptions])

  const isExactTree = useMemo(() => treeNo.trim() !== "" && treeNo.trim() === validatedTreeNo, [treeNo, validatedTreeNo])

  async function saveAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (!isExactTree) {
      setResult({ ok: false, errors: ["Select an exact Tree Number from Tree Master before saving."], message: "Tree Lifecycle change was not saved." })
      return
    }

    setSaving(true)
    setResult(null)
    try {
      const response = await fetch("/api/admin/tree-lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tree_no: treeNo,
          plantation_date: plantationDate,
          effective_date: effectiveDate,
          reason,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ActionResult>
      const saved: ActionResult = {
        ok: response.ok && data.ok === true,
        errors: Array.isArray(data.errors) ? data.errors.map(String) : response.ok ? [] : [`Request failed with status ${response.status}.`],
        message: typeof data.message === "string" ? data.message : response.ok ? "Tree Lifecycle change saved." : "Tree Lifecycle change was not saved.",
      }
      setResult(saved)
      if (saved.ok) {
        setReason("")
        await loadSummary()
      }
    } catch (error) {
      setResult({ ok: false, errors: [error instanceof Error ? error.message : "Unknown network error."], message: "Tree Lifecycle change was not saved." })
    } finally {
      setSaving(false)
    }
  }

  function importFormData(): FormData | null {
    if (!importFile) return null
    const form = new FormData()
    form.set("file", importFile)
    form.set("as_of_date", importAsOfDate)
    return form
  }

  async function validateImport() {
    if (validatingImport || applyingImport) return
    const selectedFileName = importFile?.name ?? "plantation-date-import.xlsx"
    const form = importFormData()
    if (!form) {
      setImportPreview(null)
      setImportResult({ ok: false, errors: ["Select the Excel workbook first."], message: "Import was not validated." })
      return
    }
    setValidatingImport(true)
    setImportResult(null)
    setImportPreview(null)
    try {
      const response = await fetch("/api/admin/tree-lifecycle/import/validate", {
        method: "POST",
        body: form,
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ImportPreview> & { ok?: unknown; errors?: unknown }
      if (!response.ok || data.ok !== true || !Array.isArray(data.rows)) {
        const errors = Array.isArray(data.errors) ? data.errors.map(String) : [`Validation failed with status ${response.status}.`]
        setImportResult({ ok: false, errors, message: "Import was not validated." })
        return
      }
      setImportPreview({
        filename: typeof data.filename === "string" ? data.filename : selectedFileName,
        as_of_date: typeof data.as_of_date === "string" ? data.as_of_date : importAsOfDate,
        total_rows: typeof data.total_rows === "number" ? data.total_rows : 0,
        valid_rows: typeof data.valid_rows === "number" ? data.valid_rows : 0,
        invalid_rows: typeof data.invalid_rows === "number" ? data.invalid_rows : 0,
        ignored_duplicate_rows: typeof data.ignored_duplicate_rows === "number" ? data.ignored_duplicate_rows : 0,
        rows: data.rows as ImportPreviewRow[],
      })
      setImportResult({
        ok: true,
        errors: [],
        message: "Workbook validated. Review the calculated plantation dates, then import the valid rows.",
      })
    } catch (error) {
      setImportResult({ ok: false, errors: [error instanceof Error ? error.message : "Unknown network error."], message: "Import was not validated." })
    } finally {
      setValidatingImport(false)
    }
  }

  async function applyImport() {
    if (applyingImport || validatingImport) return
    const form = importFormData()
    if (!form || !importPreview || importPreview.valid_rows === 0) {
      setImportResult({ ok: false, errors: ["Validate a workbook with at least one valid row before importing."], message: "Plantation dates were not imported." })
      return
    }
    setApplyingImport(true)
    setImportResult(null)
    try {
      const response = await fetch("/api/admin/tree-lifecycle/import/apply", {
        method: "POST",
        body: form,
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ActionResult> & { imported_rows?: unknown }
      const saved: ActionResult = {
        ok: response.ok && data.ok === true,
        errors: Array.isArray(data.errors) ? data.errors.map(String) : response.ok ? [] : [`Import failed with status ${response.status}.`],
        message: typeof data.message === "string" ? data.message : response.ok ? "Plantation dates imported." : "Plantation dates were not imported.",
      }
      setImportResult(saved)
      if (saved.ok) {
        setImportPreview(null)
        await loadSummary()
      }
    } catch (error) {
      setImportResult({ ok: false, errors: [error instanceof Error ? error.message : "Unknown network error."], message: "Plantation dates were not imported." })
    } finally {
      setApplyingImport(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Tree Lifecycle controls apply to Preview / UAT only.</p>
            <p className="mt-1">A replacement records a new plantation date and becomes <strong>Future Better</strong> until 36 completed months. An early-bearing tree can be promoted to normal Harvest Tree performance. Previous harvest history is retained but excluded before the current planting date.</p>
          </div>
        </div>
      </div>

      <Panel title="Tree Lifecycle / Sapling Status" icon={Sprout}>
        <form onSubmit={(event) => void saveAction(event)} className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Controlled Action
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as LifecycleAction)}
              disabled={saving}
              className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm normal-case text-foreground"
            >
              <option value="REPLACEMENT_PLANTED">Replacement → Make Sapling</option>
              <option value="PROMOTE_EARLY_HARVEST">Early Bearing → Harvest Tree</option>
              <option value="RESTORE_AUTOMATIC">Return to Automatic Rule</option>
            </select>
          </label>

          <div>
            <label htmlFor="tree-lifecycle-tree-no" className="text-xs font-bold uppercase text-muted-foreground">Exact Tree Number</label>
            <div className="mt-1">
              <TreeNumberAutocomplete
                id="tree-lifecycle-tree-no"
                value={treeNo}
                options={treeOptions}
                loading={treeOptionsLoading}
                loadError={treeOptionsError}
                disabled={saving}
                placeholder="Search an exact Tree Master number"
                showPlot
                onValueChange={(value) => {
                  setTreeNo(value)
                  setValidatedTreeNo("")
                }}
                onSelect={(option) => {
                  setTreeNo(option.treeNo)
                  setValidatedTreeNo(option.treeNo)
                }}
                onInvalidCommit={(value) => {
                  setTreeNo(value)
                  setValidatedTreeNo("")
                }}
                onRetry={() => void loadTreeOptions()}
              />
            </div>
          </div>

          {action === "REPLACEMENT_PLANTED" ? (
            <label className="text-xs font-bold uppercase text-muted-foreground">
              New Plantation Date
              <input
                type="date"
                value={plantationDate}
                onChange={(event) => setPlantationDate(event.target.value)}
                disabled={saving}
                className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm normal-case text-foreground"
              />
              <span className="mt-1 block normal-case font-medium">This date starts a new 36-month lifecycle and performance period for this Tree No.</span>
            </label>
          ) : (
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Effective Date
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                disabled={saving}
                className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm normal-case text-foreground"
              />
              <span className="mt-1 block normal-case font-medium">{action === "PROMOTE_EARLY_HARVEST" ? "The tree will leave Future Better and use normal harvest-performance rankings." : "The status will once again be determined automatically from the plantation date."}</span>
            </label>
          )}

          <label className="text-xs font-bold uppercase text-muted-foreground">
            Reason / Notes <span className="normal-case font-medium">(optional)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={saving}
              rows={3}
              placeholder={action === "REPLACEMENT_PLANTED" ? "Example: Old palm removed and replacement planted." : action === "PROMOTE_EARLY_HARVEST" ? "Example: Tree started bearing before 36 months." : "Example: Previous entry corrected."}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm normal-case text-foreground"
            />
          </label>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={saving || !isExactTree}
              className="inline-flex min-w-64 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <RefreshCcw className="size-4 animate-spin" /> : <Sprout className="size-4" />}
              {saving ? "Saving…" : actionLabel(action)}
            </button>
          </div>
          <div className="lg:col-span-2"><ResultBox result={result} /></div>
        </form>
      </Panel>

      <Panel title="Import Plantation Dates from Excel" icon={FileSpreadsheet}>
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Excel Workbook
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={validatingImport || applyingImport}
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null)
                setImportPreview(null)
                setImportResult(null)
              }}
              className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm normal-case text-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-bold file:text-primary"
            />
            <span className="mt-1 block normal-case font-medium">Required headers: <strong>Tree No</strong> and <strong>Months Since Planted</strong>. A plantation date is calculated from the selected as-of date.</span>
          </label>

          <label className="text-xs font-bold uppercase text-muted-foreground">
            Months are correct as of
            <input
              type="date"
              value={importAsOfDate}
              max={today()}
              disabled={validatingImport || applyingImport}
              onChange={(event) => {
                setImportAsOfDate(event.target.value)
                setImportPreview(null)
                setImportResult(null)
              }}
              className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm normal-case text-foreground"
            />
            <span className="mt-1 block normal-case font-medium">Use the date on which the months in this survey were counted.</span>
          </label>

          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <button
              type="button"
              onClick={() => void validateImport()}
              disabled={!importFile || validatingImport || applyingImport}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {validatingImport ? <RefreshCcw className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              {validatingImport ? "Validating…" : "Validate Workbook"}
            </button>
            <button
              type="button"
              onClick={() => void applyImport()}
              disabled={!importPreview || importPreview.valid_rows === 0 || validatingImport || applyingImport}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applyingImport ? <RefreshCcw className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {applyingImport ? "Importing…" : `Import ${importPreview?.valid_rows ?? 0} Valid Trees`}
            </button>
          </div>
          <div className="lg:col-span-2"><ResultBox result={importResult} /></div>

          {importPreview ? (
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                <p className="font-bold">{importPreview.filename}: {importPreview.valid_rows.toLocaleString("en-IN")} valid tree{importPreview.valid_rows === 1 ? "" : "s"} ready to import.</p>
                <p className="mt-1 text-muted-foreground">As of {formatDate(importPreview.as_of_date)} · {importPreview.invalid_rows} invalid row{importPreview.invalid_rows === 1 ? "" : "s"} will not be imported · {importPreview.ignored_duplicate_rows} exact duplicate row{importPreview.ignored_duplicate_rows === 1 ? "" : "s"} will be ignored.</p>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead><tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary"><th className="px-3 py-2.5">Source Row</th><th className="px-3 py-2.5">Tree No.</th><th className="px-3 py-2.5">Calculated Plantation Date</th><th className="px-3 py-2.5 text-right">Months Since Planted</th><th className="px-3 py-2.5">Result</th><th className="px-3 py-2.5">Validation Notes</th></tr></thead>
                  <tbody>{importPreview.rows.map((row) => {
                    const notes = [...(row.errors ?? []), ...(row.warnings ?? [])]
                    return <tr key={row.row} className="border-b border-border last:border-0"><td className="px-3 py-2.5 text-muted-foreground">{row.row}</td><td className="px-3 py-2.5 font-bold text-foreground">{row.tree_no ?? "—"}</td><td className="px-3 py-2.5 text-foreground">{formatDate(row.plantation_date)}</td><td className="px-3 py-2.5 text-right font-semibold text-foreground">{row.months_since_planted ?? "—"}</td><td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${row.will_import ? "border-primary/25 bg-primary/5 text-primary" : row.errors?.length ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-300 bg-amber-50 text-amber-950"}`}>{row.will_import ? row.lifecycle_status ?? "Ready" : row.errors?.length ? "Not imported" : "Duplicate ignored"}</span></td><td className="px-3 py-2.5 text-muted-foreground">{notes.length ? notes.join(" ") : "Ready to import."}</td></tr>
                  })}</tbody>
                </table>
              </div>
              {importPreview.total_rows > importPreview.rows.length ? <p className="mt-2 text-xs text-muted-foreground">Showing the first {importPreview.rows.length} of {importPreview.total_rows} source rows.</p> : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="Current Saplings / Future Better" icon={Trees}>
        {loading ? <p className="text-sm text-muted-foreground">Loading current sapling list…</p> : null}
        {summaryError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-bold">Unable to load Tree Lifecycle data.</p>
            <p className="mt-1">{summaryError}</p>
            <button type="button" onClick={() => void loadSummary()} className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 font-bold hover:bg-destructive/10">Retry</button>
          </div>
        ) : null}
        {summary ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{summary.total_saplings.toLocaleString("en-IN")} tree{summary.total_saplings === 1 ? "" : "s"} currently classified as Future Better.</p>
            {summary.saplings.length === 0 ? <p className="text-sm text-muted-foreground">No current saplings have been recorded.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead><tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary"><th className="px-3 py-2.5">Tree No.</th><th className="px-3 py-2.5">Plot</th><th className="px-3 py-2.5">Plantation Date</th><th className="px-3 py-2.5 text-right">Months Since Planted</th><th className="px-3 py-2.5">Lifecycle Status</th><th className="px-3 py-2.5">Rule</th></tr></thead>
                  <tbody>{summary.saplings.map((row) => <tr key={row.tree_no} className="border-b border-border last:border-0"><td className="px-3 py-2.5 font-bold text-foreground">{row.tree_no}</td><td className="px-3 py-2.5 text-muted-foreground">{row.plot ?? "—"}</td><td className="px-3 py-2.5 text-foreground">{formatDate(row.plantation_date)}</td><td className="px-3 py-2.5 text-right font-semibold text-foreground">{row.months_since_planted}</td><td className="px-3 py-2.5"><span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-bold text-sky-800">{row.lifecycle_status}</span></td><td className="px-3 py-2.5 text-muted-foreground">{row.status_source ?? "Automatic"}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </Panel>

      {summary?.recent_events.length ? (
        <Panel title="Tree Lifecycle Audit History" icon={History}>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-sm"><thead><tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary"><th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">Tree No.</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Plantation / Effective Date</th><th className="px-3 py-2.5">Reason</th><th className="px-3 py-2.5">Admin</th></tr></thead><tbody>{summary.recent_events.map((event) => <tr key={event.id} className="border-b border-border last:border-0"><td className="px-3 py-2.5 text-muted-foreground">{formatDate(event.created_at)}</td><td className="px-3 py-2.5 font-bold text-foreground">{event.tree_no}</td><td className="px-3 py-2.5 text-foreground">{eventLabel(event.action)}</td><td className="px-3 py-2.5 text-muted-foreground">{formatDate(event.plantation_date ?? event.effective_date)}</td><td className="px-3 py-2.5 text-muted-foreground">{event.reason ?? "—"}</td><td className="px-3 py-2.5 text-muted-foreground">{event.admin_user ?? "—"}</td></tr>)}</tbody></table></div>
        </Panel>
      ) : null}
    </div>
  )
}
