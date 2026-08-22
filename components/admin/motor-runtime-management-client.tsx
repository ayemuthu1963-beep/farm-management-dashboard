"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  History,
  ListChecks,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { createExcelImports, getExcelImport, parseExcelImport } from "@/lib/motor-screenshot-analysis-api"
import type { MotorId, ProvisionalSession, UploadDetail, WorkbookRun } from "@/lib/motor-screenshot-analysis-types"
import {
  loadAllEvents,
  loadManagedSessions,
  loadPlotOptions,
  publishManagedSession,
  saveManagedSession,
  updateLegacyRuntimeEntry,
  voidLegacyRuntimeEntry,
  voidManagedSession,
  type AllEvent,
  type ManagedAllocation,
  type ManagedSession,
  type ManagedSessionPayload,
  type PlotOption,
} from "@/lib/motor-runtime-management-api"
import { cn } from "@/lib/utils"
import { motorPlotDisplayLabels, type StoredMotorPlot } from "@/lib/plot-identity"

type Tab = "import" | "events" | "review" | "history" | "summary" | "manual"
type ImportFile = { file: File; motorId: MotorId; inferred: boolean }
type EditableAllocation = {
  id: string
  plot: string
  valveNo: number
  startTime: string
  endTime: string
  startNextDay: boolean
  endNextDay: boolean
}
type EditableRun = {
  key: string
  sessionId?: number
  originalStatus?: ManagedSession["workflow_status"]
  sourceImportId: number | null
  sourceRuntimeSessionId: number | null
  motorId: MotorId
  operationDate: string
  runNo: number
  sourceOnAt: string | null
  sourceOffAt: string | null
  sourceRuntimeSeconds: number | null
  onTime: string
  offTime: string
  offNextDay: boolean
  reason: string
  allocations: EditableAllocation[]
  warnings: string[]
  conflicts: string[]
  saving: boolean
  saved: boolean
}
type LegacyEntry = {
  id: string
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  total_minutes: number
  remarks: string | null
  record_type: "legacy" | "managed"
}

const OBSOLETE_MINUTE_PRECISION_WARNING = "The workbook supplies HH:MM only. :00 seconds are provisional and require operator acceptance or correction."

const TABS: Array<{ id: Tab; label: string; icon: typeof Upload }> = [
  { id: "import", label: "Import Excel", icon: Upload },
  { id: "events", label: "All Events", icon: ListChecks },
  { id: "review", label: "Review Runs", icon: CheckCircle2 },
  { id: "history", label: "Runtime History", icon: History },
  { id: "summary", label: "Daily Summary", icon: CalendarDays },
  { id: "manual", label: "Manual Entry", icon: PencilLine },
]
const MOTORS: Array<{ id: MotorId; name: string }> = [
  { id: "motor-1", name: "Motor 1" },
  { id: "motor-2", name: "Motor 2" },
  { id: "motor-3", name: "Motor 3" },
]
const fieldClass = "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"

function motorPlotLabel(value: string): string {
  return value in motorPlotDisplayLabels
    ? motorPlotDisplayLabels[value as StoredMotorPlot]
    : value.replaceAll("_", " ")
}

function inferMotor(filename: string): MotorId {
  const match = filename.match(/motor[\s_-]*([123])/i)
  return match ? (`motor-${match[1]}` as MotorId) : "motor-1"
}

function indiaParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }
}

function formatDate(value: string): string {
  if (!value) return "-"
  const parsed = new Date(`${value}T00:00:00+05:30`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
}

function runtimeMinutes(on: string, off: string, nextDay: boolean): number | null {
  if (!on || !off) return null
  const [onHour, onMinute] = on.split(":").map(Number)
  const [offHour, offMinute] = off.split(":").map(Number)
  const result = offHour * 60 + offMinute + (nextDay ? 1440 : 0) - (onHour * 60 + onMinute)
  return result > 0 ? result : null
}

function hhmm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-"
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function newAllocation(startTime = "", endTime = ""): EditableAllocation {
  return { id: crypto.randomUUID(), plot: "", valveNo: 0, startTime, endTime, startNextDay: false, endNextDay: false }
}

function farmTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function newManualRun(operationDate: string, runNo: number): EditableRun {
  return {
    key: `manual-${crypto.randomUUID()}`,
    sourceImportId: null,
    sourceRuntimeSessionId: null,
    motorId: "motor-1",
    operationDate,
    runNo,
    sourceOnAt: null,
    sourceOffAt: null,
    sourceRuntimeSeconds: null,
    onTime: "",
    offTime: "",
    offNextDay: false,
    reason: "Manual entry",
    allocations: [newAllocation()],
    warnings: [],
    conflicts: [],
    saving: false,
    saved: false,
  }
}

function workbookRunWarnings(parserWarning: string | null): string[] {
  const remaining = parserWarning?.replaceAll(OBSOLETE_MINUTE_PRECISION_WARNING, "").trim()
  return remaining ? [remaining] : []
}

function reasonFor(session: ProvisionalSession): string {
  return [session.on_reason, session.off_reason].filter(Boolean).join(" / ")
}

function editableFromProvisional(detail: UploadDetail, session: ProvisionalSession, runNo: number): EditableRun {
  const on = indiaParts(session.motor_on_at)
  const off = indiaParts(session.motor_off_at)
  const operationDate = session.operation_date || on.date
  return {
    key: `${detail.upload.id}-${runNo}-${session.motor_on_message_id ?? "off"}`,
    sourceImportId: detail.upload.id,
    sourceRuntimeSessionId: null,
    motorId: session.motor_id,
    operationDate,
    runNo,
    sourceOnAt: session.motor_on_at,
    sourceOffAt: session.motor_off_at,
    sourceRuntimeSeconds: session.runtime_seconds,
    onTime: on.time,
    offTime: off.time,
    offNextDay: Boolean(on.date && off.date && off.date > on.date),
    reason: reasonFor(session),
    allocations: [newAllocation(on.time, off.time)],
    warnings: session.status === "complete" ? [] : [`Imported result is ${session.status.replaceAll("_", " ")}; correct it before publishing.`],
    conflicts: [],
    saving: false,
    saved: false,
  }
}

function editableFromWorkbookRun(detail: UploadDetail, run: WorkbookRun): EditableRun {
  const on = indiaParts(run.motor_on_at)
  const off = indiaParts(run.motor_off_at)
  return {
    key: `${detail.upload.id}-workbook-${run.run_no}`,
    sourceImportId: detail.upload.id,
    sourceRuntimeSessionId: null,
    motorId: detail.upload.motor_id,
    operationDate: run.operation_date ?? on.date,
    runNo: run.run_no,
    sourceOnAt: run.motor_on_at,
    sourceOffAt: run.motor_off_at,
    sourceRuntimeSeconds: run.source_runtime_seconds,
    onTime: on.time,
    offTime: off.time,
    offNextDay: Boolean(on.date && off.date && off.date > on.date),
    reason: run.remarks,
    allocations: [newAllocation(on.time, off.time)],
    warnings: workbookRunWarnings(run.parser_warning),
    conflicts: [],
    saving: false,
    saved: false,
  }
}

function editableFromManaged(session: ManagedSession): EditableRun {
  const on = indiaParts(session.motor_on_at)
  const off = indiaParts(session.motor_off_at)
  return {
    key: `managed-${session.id}`,
    sessionId: session.id,
    originalStatus: session.workflow_status,
    sourceImportId: session.source_import_id,
    sourceRuntimeSessionId: null,
    motorId: session.motor_id,
    operationDate: session.operation_date,
    runNo: session.run_no,
    sourceOnAt: session.source_motor_on_at,
    sourceOffAt: session.source_motor_off_at,
    sourceRuntimeSeconds: session.source_runtime_seconds,
    onTime: on.time,
    offTime: off.time,
    offNextDay: Boolean(on.date && off.date && off.date > on.date),
    reason: session.reason ?? "",
    allocations: session.allocations.map((allocation) => {
      const starts = indiaParts(allocation.starts_at ?? null)
      const ends = indiaParts(allocation.ends_at ?? null)
      return {
        id: String(allocation.id ?? crypto.randomUUID()),
        plot: allocation.plot,
        valveNo: allocation.valve_no,
        startTime: starts.time,
        endTime: ends.time,
        startNextDay: starts.date > session.operation_date,
        endNextDay: ends.date > session.operation_date,
      }
    }),
    warnings: [],
    conflicts: [],
    saving: false,
    saved: true,
  }
}

function sessionPayload(run: EditableRun): ManagedSessionPayload {
  return {
    source_import_id: run.sourceImportId,
    source_runtime_session_id: run.sourceRuntimeSessionId,
    motor_id: run.motorId,
    operation_date: run.operationDate,
    run_no: run.runNo,
    source_motor_on_at: run.sourceOnAt,
    source_motor_off_at: run.sourceOffAt,
    source_runtime_seconds: run.sourceRuntimeSeconds,
    on_time: run.onTime || null,
    off_time: run.offTime || null,
    off_next_day: run.offNextDay,
    reason: run.reason || null,
    allocations: run.allocations.filter((item) => item.plot && item.startTime && item.endTime).map((item) => ({
      plot: item.plot,
      valve_no: item.valveNo,
      start_time: item.startTime,
      end_time: item.endTime,
      start_next_day: item.startNextDay,
      end_next_day: item.endNextDay,
    })),
  }
}

export function MotorRuntimeManagementClient() {
  const [tab, setTab] = useState<Tab>("import")
  const [files, setFiles] = useState<ImportFile[]>([])
  const [imports, setImports] = useState<UploadDetail[]>([])
  const [runs, setRuns] = useState<EditableRun[]>([])
  const [manualRun, setManualRun] = useState<EditableRun | null>(null)
  const [importDiscrepancyCount, setImportDiscrepancyCount] = useState(0)
  const [events, setEvents] = useState<AllEvent[]>([])
  const [sessions, setSessions] = useState<ManagedSession[]>([])
  const [legacyEntries, setLegacyEntries] = useState<LegacyEntry[]>([])
  const [plotOptions, setPlotOptions] = useState<PlotOption[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<"day" | "last" | "range">("last")
  const [singleDay, setSingleDay] = useState("")
  const [lastDays, setLastDays] = useState(7)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [motorFilter, setMotorFilter] = useState<MotorId | "all">("all")
  const [search, setSearch] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { loadPlotOptions().then(setPlotOptions).catch(() => setPlotOptions([])) }, [])

  const query = useCallback((pageSize: 200 | 500) => {
    const params = new URLSearchParams({ page_size: String(pageSize) })
    if (filterMode === "day" && singleDay) {
      params.set("start_date", singleDay)
      params.set("end_date", singleDay)
    } else if (filterMode === "last") params.set("days", String(lastDays))
    else {
      if (startDate) params.set("start_date", startDate)
      if (endDate) params.set("end_date", endDate)
    }
    if (motorFilter !== "all") params.set("motor_id", motorFilter)
    if (search.trim()) params.set("search", search.trim())
    return params
  }, [endDate, filterMode, lastDays, motorFilter, search, singleDay, startDate])

  const refreshEvents = useCallback(async () => {
    setBusy(true)
    try { setEvents((await loadAllEvents(query(500))).items); setError(null) }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load events.") }
    finally { setBusy(false) }
  }, [query])

  const refreshSessions = useCallback(async () => {
    setBusy(true)
    try {
      const params = query(200)
      const [managed, legacyResponse] = await Promise.all([
        loadManagedSessions(params),
        fetch(`/api/admin/motor-runtime/entries?${params}`, { cache: "no-store" }),
      ])
      const legacyPayload = await legacyResponse.json().catch(() => ({ entries: [] }))
      if (!legacyResponse.ok) throw new Error(Array.isArray(legacyPayload.errors) ? legacyPayload.errors.join(" ") : "Unable to load legacy runtime records.")
      setSessions(managed.items)
      setLegacyEntries((Array.isArray(legacyPayload.entries) ? legacyPayload.entries : []).filter((entry: LegacyEntry) => entry.record_type === "legacy"))
      setError(null)
    }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load runtime history.") }
    finally { setBusy(false) }
  }, [query])

  useEffect(() => {
    if (tab === "events") void refreshEvents()
    if (tab === "history" || tab === "summary") void refreshSessions()
  }, [refreshEvents, refreshSessions, tab])

  function selectFiles(list: FileList | null) {
    if (!list) return
    const selected = Array.from(list)
    const empty = selected.find((file) => file.size === 0)
    if (empty) {
      setError(`${empty.name} is empty (0 bytes). Download or copy the complete .xlsx workbook, then select it again.`)
      return
    }
    const invalid = selected.find((file) => !file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024)
    if (invalid) {
      setError(`${invalid.name} must be a macro-free .xlsx file no larger than 5 MiB.`)
      return
    }
    if (files.length + selected.length > 10) {
      setError("No more than 10 workbooks may be imported at once.")
      return
    }
    setFiles((current) => [...current, ...selected.map((file) => ({ file, motorId: inferMotor(file.name), inferred: /motor[\s_-]*[123]/i.test(file.name) }))])
    setError(null)
  }

  async function importExcel() {
    if (!files.length) return
    setBusy(true)
    setError(null)
    setMessage("Validating workbooks and storing All Events...")
    const detailById = new Map<number, UploadDetail>()
    let reopenedCount = 0
    try {
      for (const item of files) {
        const created = await createExcelImports(item.motorId, [item.file])
        for (const imported of created.imports) {
          detailById.set(imported.id, await parseExcelImport(imported.id))
        }
        for (const duplicate of created.duplicates) {
          if (duplicate.existing_import_id && !detailById.has(duplicate.existing_import_id)) {
            detailById.set(duplicate.existing_import_id, await getExcelImport(duplicate.existing_import_id))
            reopenedCount += 1
          }
        }
      }
      const details = [...detailById.values()]
      const nextRuns: EditableRun[] = []
      let discrepancyCount = 0
      for (const detail of details) {
        if (detail.workbook_runs?.length) {
          nextRuns.push(...detail.workbook_runs.map((run) => editableFromWorkbookRun(detail, run)))
          discrepancyCount += detail.provisional_sessions.filter((value) => value.status !== "complete").length
        } else {
          const perDate = new Map<string, number>()
          for (const session of detail.provisional_sessions) {
            const key = `${session.motor_id}:${session.operation_date}`
            const runNo = (perDate.get(key) ?? 0) + 1
            perDate.set(key, runNo)
            nextRuns.push(editableFromProvisional(detail, session, runNo))
          }
        }
      }
      setImports(details)
      setRuns(nextRuns)
      setImportDiscrepancyCount(discrepancyCount)
      setFiles([])
      setMessage(`${details.reduce((sum, detail) => sum + detail.source_rows.length, 0)} All Events rows available; ${nextRuns.length} workbook runs are ready for operator review${reopenedCount ? `; ${reopenedCount} existing import reopened` : ""}${discrepancyCount ? `; ${discrepancyCount} unresolved notification-event discrepancies kept out of Review Runs` : ""}.`)
      setTab("review")
      setError(null)
    } catch (value) {
      setError(value instanceof Error ? value.message : "Excel import failed.")
    } finally { setBusy(false) }
  }

  function startNewImport() {
    if ((imports.length > 0 || runs.length > 0) && !window.confirm("Start a new import? This clears the current review screen only. Records already saved to History will remain.")) return
    setFiles([])
    setImports([])
    setRuns([])
    setImportDiscrepancyCount(0)
    setMessage(null)
    setError(null)
    setTab("import")
    if (fileInput.current) fileInput.current.value = ""
  }

  function patchRun(key: string, patch: Partial<EditableRun>) {
    setRuns((current) => current.map((run) => run.key === key ? { ...run, ...patch, saved: patch.saved ?? false } : run))
  }

  function patchAllocation(runKey: string, allocationId: string, patch: Partial<EditableAllocation>) {
    setRuns((current) => current.map((run) => run.key !== runKey ? run : {
      ...run,
      saved: false,
      allocations: run.allocations.map((allocation) => allocation.id === allocationId ? { ...allocation, ...patch } : allocation),
    }))
  }

  function patchManualRun(key: string, patch: Partial<EditableRun>) {
    setManualRun((current) => current?.key === key ? { ...current, ...patch, saved: patch.saved ?? false } : current)
  }

  function patchManualAllocation(runKey: string, allocationId: string, patch: Partial<EditableAllocation>) {
    setManualRun((current) => current?.key !== runKey ? current : {
      ...current,
      saved: false,
      allocations: current.allocations.map((allocation) => allocation.id === allocationId ? { ...allocation, ...patch } : allocation),
    })
  }

  function startManualEntry(replaceCurrent = false) {
    if (replaceCurrent && manualRun && !manualRun.saved && !window.confirm("Start a new manual entry? The unsaved values currently shown will be cleared.")) return
    const operationDate = farmTodayIso()
    const knownRuns = [
      ...sessions.filter((session) => session.operation_date === operationDate && session.motor_id === "motor-1").map((session) => session.run_no),
      ...runs.filter((run) => run.operationDate === operationDate && run.motorId === "motor-1").map((run) => run.runNo),
    ]
    setManualRun(newManualRun(operationDate, Math.max(0, ...knownRuns) + 1))
    setMessage(null)
    setError(null)
    setTab("manual")
  }

  async function saveRun(run: EditableRun, publish: boolean, patch: (key: string, value: Partial<EditableRun>) => void = patchRun) {
    setError(null)
    patch(run.key, { saving: true, warnings: [], conflicts: [] })
    try {
      const saved = await saveManagedSession(sessionPayload(run), run.sessionId)
      const conflicts = saved.conflicts.map((item) => (
        item.conflict_type === "same_plot_overlap"
          ? `${motorPlotLabel(item.candidate_plot)} is already irrigated by ${item.motor_id.replace("motor-", "Motor ")} during this time.`
          : `${run.motorId.replace("motor-", "Motor ")} is already allocated to another plot during this time.`
      ))
      if (publish && (saved.warnings.length || conflicts.length)) {
        patch(run.key, { sessionId: saved.session.id, saving: false, saved: true, warnings: saved.warnings, conflicts })
        return
      }
      if (publish) await publishManagedSession(saved.session.id)
      patch(run.key, {
        sessionId: saved.session.id,
        originalStatus: publish ? "published" : "draft",
        saving: false,
        saved: true,
        warnings: saved.warnings,
        conflicts,
      })
      setMessage(publish ? `Motor ${run.motorId.slice(-1)} Run ${run.runNo} saved to History.` : `Motor ${run.motorId.slice(-1)} Run ${run.runNo} saved as draft.`)
      if (publish) await refreshSessions()
    } catch (value) {
      const detail = (value as Error & { detail?: { warnings?: string[]; conflicts?: Array<{ conflict_type?: string }> } }).detail
      patch(run.key, {
        saving: false,
        warnings: detail?.warnings ?? [value instanceof Error ? value.message : "Run could not be saved."],
        conflicts: detail?.conflicts?.map((item) => item.conflict_type?.replaceAll("_", " ") ?? "Physical conflict") ?? [],
      })
    }
  }

  function editHistory(session: ManagedSession) {
    const editable = editableFromManaged(session)
    setRuns((current) => [editable, ...current.filter((run) => run.sessionId !== session.id)])
    setTab("review")
    setMessage("History record opened for correction. Save the corrected record to History to publish it with an audit trail.")
  }

  async function voidHistory(session: ManagedSession) {
    if (!window.confirm(`Void Motor ${session.motor_id.slice(-1)} Run ${session.run_no} on ${session.operation_date}? The audit record will be retained.`)) return
    try { await voidManagedSession(session.id); await refreshSessions() }
    catch (value) { setError(value instanceof Error ? value.message : "Record could not be voided.") }
  }

  const published = sessions.filter((session) => session.workflow_status === "published")
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; motorId: MotorId; runs: number; minutes: number }>()
    for (const session of published) {
      const key = `${session.operation_date}:${session.motor_id}`
      const current = map.get(key) ?? { date: session.operation_date, motorId: session.motor_id, runs: 0, minutes: 0 }
      current.runs += 1
      current.minutes += session.runtime_minutes ?? 0
      map.set(key, current)
    }
    for (const entry of legacyEntries) {
      const motorId = `motor-${entry.motor_no}` as MotorId
      const key = `${entry.entry_date}:${motorId}`
      const current = map.get(key) ?? { date: entry.entry_date, motorId, runs: 0, minutes: 0 }
      current.runs += 1
      current.minutes += entry.total_minutes
      map.set(key, current)
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.motorId.localeCompare(b.motorId))
  }, [legacyEntries, published])

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Motor Runtime Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Import Niagara Smart Drip Excel history, review actual motor runs, allocate each run sequentially to plots and publish approved history.</p>
        <p className="mt-2 text-xs font-semibold text-primary">Drafts may retain discrepancies. Save to History is blocked until the full motor runtime is allocated without impossible overlaps.</p>
      </div>

      <div role="tablist" aria-label="Motor Runtime Management" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => id === "manual" ? (manualRun ? setTab("manual") : startManualEntry()) : setTab(id)} className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold",
            id === "manual"
              ? tab === id
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
              : tab === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}>
            <Icon className="size-4" /> {label}{id === "review" && runs.length ? ` (${runs.length})` : ""}
          </button>
        ))}
      </div>

      {(files.length > 0 || imports.length > 0 || runs.length > 0) && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={startNewImport} disabled={busy}>
            <RefreshCw className="size-4" /> Start New Import
          </Button>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</div>}

      {tab === "import" && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3"><FileSpreadsheet className="mt-0.5 size-6 text-primary" /><div><h2 className="font-serif text-lg font-bold">Import Niagara Smart Drip Excel</h2><p className="text-sm text-muted-foreground">The filename suggests Motor 1, 2 or 3. Confirm the motor for every workbook before importing.</p></div></div>
          <div className="mt-4 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm font-medium">Same approved workbook structure: All Events, Motor Runs and Daily Totals</p>
            <p className="mt-1 text-xs text-muted-foreground">Macro-free .xlsx only, maximum 10 files, 5 MiB each.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => fileInput.current?.click()} disabled={busy}><Upload className="size-4" /> Select Excel Files</Button>
            <input ref={fileInput} type="file" accept=".xlsx" multiple className="sr-only" onChange={(event) => { selectFiles(event.target.files); event.target.value = "" }} />
          </div>
          {files.length > 0 && <div className="mt-4 space-y-2">{files.map((item, index) => (
            <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="grid items-center gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_180px_auto]">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.file.name}</p><p className="text-xs text-muted-foreground">{Math.ceil(item.file.size / 1024)} KiB · {item.inferred ? "Motor inferred from filename; confirmation required" : "No motor number found; select carefully"}</p></div>
              <label className="text-xs font-semibold">Confirm Motor<select value={item.motorId} onChange={(event) => setFiles((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, motorId: event.target.value as MotorId } : value))} className={`${fieldClass} mt-1`}>{MOTORS.map((motor) => <option key={motor.id} value={motor.id}>{motor.name}</option>)}</select></label>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button>
            </div>
          ))}</div>}
          <Button type="button" className="mt-4" disabled={busy || files.length === 0} onClick={() => void importExcel()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} Import and Review</Button>
          {imports.length > 0 && <p className="mt-3 text-xs text-muted-foreground">This review session loaded {imports.length} workbook(s). Calculations use the displayed HH:MM values exactly; seconds are ignored without rounding and retained only in the source audit.</p>}
        </section>
      )}

      {(tab === "events" || tab === "history" || tab === "summary") && (
        <section className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold">Period<select value={filterMode} onChange={(event) => setFilterMode(event.target.value as typeof filterMode)} className={`${fieldClass} mt-1`}><option value="day">Single day</option><option value="last">Last number of days</option><option value="range">Date range</option></select></label>
            {filterMode === "day" && <label className="text-xs font-semibold">Date<input type="date" value={singleDay} onChange={(event) => setSingleDay(event.target.value)} className={`${fieldClass} mt-1`} /></label>}
            {filterMode === "last" && <label className="text-xs font-semibold">Days<input type="number" min="1" max="366" value={lastDays} onChange={(event) => setLastDays(Number(event.target.value))} className={`${fieldClass} mt-1 w-24`} /></label>}
            {filterMode === "range" && <><label className="text-xs font-semibold">From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${fieldClass} mt-1`} /></label><label className="text-xs font-semibold">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={`${fieldClass} mt-1`} /></label></>}
            <label className="text-xs font-semibold">Motor<select value={motorFilter} onChange={(event) => setMotorFilter(event.target.value as MotorId | "all")} className={`${fieldClass} mt-1`}><option value="all">All motors</option>{MOTORS.map((motor) => <option key={motor.id} value={motor.id}>{motor.name}</option>)}</select></label>
            {tab === "events" && <label className="text-xs font-semibold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} className={`${fieldClass} mt-1`} placeholder="Message or remarks" /></label>}
            <Button type="button" variant="outline" onClick={() => void (tab === "events" ? refreshEvents() : refreshSessions())}><RefreshCw className="size-4" /> Apply</Button>
          </div>
        </section>
      )}

      {tab === "events" && <AllEventsTable events={events} busy={busy} />}
      {tab === "manual" && <>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div><h2 className="font-serif text-lg font-bold text-emerald-950">Manual Motor Runtime Entry</h2><p className="text-sm text-emerald-900/80">Enter the complete motor run and every irrigated plot below. The same runtime, allocation and physical-conflict checks used for Excel imports apply.</p></div>
          <Button type="button" variant="outline" className="border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-100" onClick={() => startManualEntry(true)}><Plus className="size-4" /> Start Another Manual Entry</Button>
        </section>
        {manualRun && <ReviewRuns runs={[manualRun]} plotOptions={plotOptions} onPatch={patchManualRun} onPatchAllocation={patchManualAllocation} onSave={(run, publish) => saveRun(run, publish, patchManualRun)} />}
      </>}
      {tab === "review" && <>
        {importDiscrepancyCount > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> {importDiscrepancyCount} notification-event discrepancies require separate review</p><p className="mt-1">They remain visible in All Events and Motor Screenshot Analysis, but are not treated as additional workbook runs.</p></div>}
        <ReviewRuns runs={runs} plotOptions={plotOptions} onPatch={patchRun} onPatchAllocation={patchAllocation} onSave={saveRun} />
      </>}
      {tab === "history" && <><LegacyEditor entries={legacyEntries} plotOptions={plotOptions} onChanged={refreshSessions} /><RuntimeHistory sessions={sessions} legacyEntries={legacyEntries} busy={busy} onEdit={editHistory} onVoid={voidHistory} /></>}
      {tab === "summary" && <DailySummary rows={daily} busy={busy} />}
    </div>
  )
}

function AllEventsTable({ events, busy }: { events: AllEvent[]; busy: boolean }) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-serif text-lg font-bold">All Events</h2><p className="text-xs text-muted-foreground">Stored separately by assigned motor and date in the same columns as the workbook.</p></div>{busy ? <Loading /> : <div className="max-h-[70vh] overflow-auto"><table className="w-full min-w-[900px] text-sm"><thead className="sticky top-0 bg-muted"><tr className="text-left"><th className="p-2">Motor</th><th className="p-2">Tile</th><th className="p-2">First Line of Tile</th><th className="p-2">Date</th><th className="p-2">Time</th><th className="p-2">Remarks</th><th className="p-2">Source</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-border align-top"><td className="p-2 font-semibold">{event.motor_name}</td><td className="p-2">{event.tile_no ?? event.row_number - 1}</td><td className="p-2 font-medium">{event.raw_first_line}</td><td className="whitespace-nowrap p-2">{event.original_date_text}</td><td className="whitespace-nowrap p-2">{event.original_time_text}</td><td className="p-2 text-muted-foreground">{event.remarks}</td><td className="p-2 text-xs text-muted-foreground">{event.original_filename}</td></tr>)}</tbody></table>{events.length === 0 && <Empty text="No imported All Events rows match this period." />}</div>}</section>
}

function ReviewRuns({ runs, plotOptions, onPatch, onPatchAllocation, onSave }: { runs: EditableRun[]; plotOptions: PlotOption[]; onPatch: (key: string, patch: Partial<EditableRun>) => void; onPatchAllocation: (runKey: string, id: string, patch: Partial<EditableAllocation>) => void; onSave: (run: EditableRun, publish: boolean) => Promise<void> }) {
  if (!runs.length) return <Empty text="Import an Excel workbook or open a History record to review motor runs." />
  return <div className="space-y-4">{runs.map((run) => {
    const options = plotOptions.filter((option) => option.motor_id === run.motorId)
    const minutes = runtimeMinutes(run.onTime, run.offTime, run.offNextDay)
    return <section key={run.key} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-serif text-lg font-bold">Motor {run.motorId.slice(-1)} · {formatDate(run.operationDate)} · Run {run.runNo}</h2><p className="text-xs text-muted-foreground">Calculation basis: displayed HH:MM only; seconds are ignored without rounding.</p></div><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", run.originalStatus === "published" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{run.originalStatus ?? "new draft"}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label className="text-xs font-semibold">Motor<select value={run.motorId} onChange={(event) => onPatch(run.key, { motorId: event.target.value as MotorId, allocations: [] })} className={`${fieldClass} mt-1`}>{MOTORS.map((motor) => <option key={motor.id} value={motor.id}>{motor.name}</option>)}</select></label><label className="text-xs font-semibold">Date<input type="date" value={run.operationDate} onChange={(event) => onPatch(run.key, { operationDate: event.target.value })} className={`${fieldClass} mt-1`} /></label><label className="text-xs font-semibold">Actual ON<input type="time" value={run.onTime} onChange={(event) => onPatch(run.key, { onTime: event.target.value })} className={`${fieldClass} mt-1`} /></label><label className="text-xs font-semibold">Actual OFF/cutoff<input type="time" value={run.offTime} onChange={(event) => onPatch(run.key, { offTime: event.target.value })} className={`${fieldClass} mt-1`} /></label><label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2 text-xs font-semibold"><input type="checkbox" checked={run.offNextDay} onChange={(event) => onPatch(run.key, { offNextDay: event.target.checked })} /> OFF next day</label><div className="self-end rounded-lg bg-primary/10 px-3 py-2"><p className="text-xs text-muted-foreground">Runtime</p><p className="font-mono text-lg font-bold text-primary">{hhmm(minutes)}</p></div></div>
      <label className="mt-3 block text-xs font-semibold">Reason<input value={run.reason} onChange={(event) => onPatch(run.key, { reason: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="bg-muted text-left"><th className="p-2">Sequence</th><th className="p-2">Plot Irrigated</th><th className="p-2">Valve</th><th className="p-2">From</th><th className="p-2">To</th><th className="p-2">Next day</th><th className="p-2">Runtime</th><th className="p-2"></th></tr></thead><tbody>{run.allocations.map((allocation, index) => <tr key={allocation.id} className="border-t border-border"><td className="p-2 font-semibold">{index + 1}</td><td className="p-2"><select value={allocation.plot} onChange={(event) => { const option = options.find((value) => value.plot === event.target.value); onPatchAllocation(run.key, allocation.id, { plot: event.target.value, valveNo: option?.valve_no ?? 0 }) }} className={fieldClass}><option value="">Select plot</option>{options.map((option) => <option key={option.plot} value={option.plot}>{motorPlotLabel(option.plot)}</option>)}</select></td><td className="p-2">{allocation.valveNo ? `Valve${allocation.valveNo}` : "-"}</td><td className="p-2"><input type="time" value={allocation.startTime} onChange={(event) => onPatchAllocation(run.key, allocation.id, { startTime: event.target.value })} className={fieldClass} /></td><td className="p-2"><input type="time" value={allocation.endTime} onChange={(event) => onPatchAllocation(run.key, allocation.id, { endTime: event.target.value })} className={fieldClass} /></td><td className="p-2"><label className="mr-2 text-xs"><input type="checkbox" checked={allocation.startNextDay} onChange={(event) => onPatchAllocation(run.key, allocation.id, { startNextDay: event.target.checked })} /> Start</label><label className="text-xs"><input type="checkbox" checked={allocation.endNextDay} onChange={(event) => onPatchAllocation(run.key, allocation.id, { endNextDay: event.target.checked })} /> End</label></td><td className="p-2 font-mono">{hhmm(runtimeMinutes(allocation.startTime, allocation.endTime, allocation.endNextDay && !allocation.startNextDay))}</td><td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => onPatch(run.key, { allocations: run.allocations.filter((value) => value.id !== allocation.id) })}><Trash2 className="size-4" /></Button></td></tr>)}</tbody></table></div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { const previous = run.allocations.at(-1); onPatch(run.key, { allocations: [...run.allocations, newAllocation(previous?.endTime ?? run.onTime, run.offTime)] }) }}><Plus className="size-4" /> Add next plot</Button>
      {(run.warnings.length > 0 || run.conflicts.length > 0) && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> Resolve before Save to History</p><ul className="mt-1 list-disc pl-5">{[...run.warnings, ...run.conflicts].map((value) => <li key={value}>{value}</li>)}</ul></div>}
      <div className="mt-4 flex flex-wrap gap-2">{run.originalStatus !== "published" && <Button type="button" variant="outline" disabled={run.saving} onClick={() => void onSave(run, false)}><Save className="size-4" /> Save Draft</Button>}<Button type="button" disabled={run.saving} onClick={() => void onSave(run, true)}>{run.saving ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {run.originalStatus === "published" ? "Save Corrected History" : "Save to History"}</Button><span className="self-center text-xs text-muted-foreground">Saving to History recalculates runtime and performs the final physical-conflict check.</span></div>
    </section>
  })}</div>
}

function LegacyEditor({ entries, plotOptions, onChanged }: { entries: LegacyEntry[]; plotOptions: PlotOption[]; onChanged: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const selected = entries.find((entry) => entry.id === selectedId) ?? null
  const options = selected ? plotOptions.filter((option) => option.motor_no === selected.motor_no) : []

  async function submit(form: HTMLFormElement) {
    if (!selected) return
    const data = new FormData(form)
    const plot = String(data.get("plot") ?? "")
    const option = options.find((value) => value.plot === plot)
    setSaving(true)
    try {
      await updateLegacyRuntimeEntry(selected.id, {
        entry_date: String(data.get("entry_date") ?? selected.entry_date),
        plot,
        motor_no: selected.motor_no,
        valve_no: option?.valve_no ?? selected.valve_no,
        hours: Number(data.get("hours") ?? selected.hours),
        minutes: Number(data.get("minutes") ?? selected.minutes),
        remarks: String(data.get("remarks") ?? "").trim() || null,
      })
      setStatus("Legacy runtime corrected. The previous value remains in the audit history.")
      await onChanged()
    } catch (value) {
      setStatus(value instanceof Error ? value.message : "Legacy runtime could not be corrected.")
    } finally { setSaving(false) }
  }

  async function voidEntry() {
    if (!selected || !window.confirm("Void this legacy runtime entry? Its audit history will be retained.")) return
    setSaving(true)
    try {
      await voidLegacyRuntimeEntry(selected.id)
      setSelectedId("")
      setStatus("Legacy runtime entry voided; no record was permanently deleted.")
      await onChanged()
    } catch (value) {
      setStatus(value instanceof Error ? value.message : "Legacy runtime could not be voided.")
    } finally { setSaving(false) }
  }

  return <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-serif text-base font-bold">Legacy Manual Record Correction</h2><p className="mt-1 text-xs text-muted-foreground">Legacy entries retain blank ON/OFF times. Correct their date, plot or existing HH:MM duration here; every old value remains auditable.</p><label className="mt-3 block max-w-xl text-xs font-semibold">Select legacy record<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setStatus(null) }} className={`${fieldClass} mt-1`}><option value="">Choose a legacy record</option>{entries.map((entry) => <option key={entry.id} value={entry.id}>{formatDate(entry.entry_date)} · Motor {entry.motor_no} · {motorPlotLabel(entry.plot)} · {hhmm(entry.total_minutes)}</option>)}</select></label>{selected && <form key={selected.id} className="mt-3 grid gap-3 md:grid-cols-6" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget) }}><label className="text-xs font-semibold">Date<input name="entry_date" type="date" defaultValue={selected.entry_date} className={`${fieldClass} mt-1`} /></label><label className="text-xs font-semibold">Plot<select name="plot" defaultValue={selected.plot} className={`${fieldClass} mt-1`}>{options.map((option) => <option key={option.plot} value={option.plot}>{motorPlotLabel(option.plot)} · Valve{option.valve_no}</option>)}</select></label><label className="text-xs font-semibold">Hours<input name="hours" type="number" min="0" max="24" defaultValue={selected.hours} className={`${fieldClass} mt-1`} /></label><label className="text-xs font-semibold">Minutes<input name="minutes" type="number" min="0" max="59" defaultValue={selected.minutes} className={`${fieldClass} mt-1`} /></label><label className="text-xs font-semibold md:col-span-2">Remarks<input name="remarks" defaultValue={selected.remarks ?? ""} className={`${fieldClass} mt-1`} /></label><div className="flex gap-2 md:col-span-6"><Button type="submit" disabled={saving}><Save className="size-4" /> Save Correction</Button><Button type="button" variant="outline" disabled={saving} onClick={() => void voidEntry()}>Void Record</Button></div></form>}{status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}</section>
}

function RuntimeHistory({ sessions, legacyEntries, busy, onEdit, onVoid }: { sessions: ManagedSession[]; legacyEntries: LegacyEntry[]; busy: boolean; onEdit: (session: ManagedSession) => void; onVoid: (session: ManagedSession) => Promise<void> }) {
  if (busy) return <Loading />
  return <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-serif text-lg font-bold">Runtime History</h2><p className="text-xs text-muted-foreground">Published records feed /motor-runtime automatically. Draft and void records remain here for operator review and audit. Legacy records retain their original duration with blank ON/OFF times.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted"><tr className="text-left"><th className="p-2">Motor</th><th className="p-2">Date</th><th className="p-2">Run</th><th className="p-2">Actual ON</th><th className="p-2">Actual OFF/cutoff</th><th className="p-2">Runtime</th><th className="p-2">Reason</th><th className="p-2">Plots</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody>{sessions.map((session) => <tr key={`managed-${session.id}`} className="border-t border-border align-top"><td className="p-2 font-semibold">{session.motor_name}</td><td className="p-2">{formatDate(session.operation_date)}</td><td className="p-2">{session.run_no}</td><td className="p-2 font-mono">{indiaParts(session.motor_on_at).time || "-"}</td><td className="p-2 font-mono">{indiaParts(session.motor_off_at).time || "-"}</td><td className="p-2 font-mono font-semibold">{hhmm(session.runtime_minutes)}</td><td className="p-2">{session.reason || "-"}</td><td className="p-2">{session.allocations.map((allocation) => `${motorPlotLabel(allocation.plot)} ${indiaParts(allocation.starts_at ?? null).time}-${indiaParts(allocation.ends_at ?? null).time}`).join("; ") || "Unallocated"}</td><td className="p-2 capitalize">{session.workflow_status}</td><td className="p-2"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={session.workflow_status === "void"} onClick={() => onEdit(session)}>Edit</Button><Button type="button" size="sm" variant="ghost" disabled={session.workflow_status === "void"} onClick={() => void onVoid(session)}>Void</Button></div></td></tr>)}{legacyEntries.map((entry) => <tr key={`legacy-${entry.id}`} className="border-t border-border bg-muted/20 align-top"><td className="p-2 font-semibold">Motor {entry.motor_no}</td><td className="p-2">{formatDate(entry.entry_date)}</td><td className="p-2">-</td><td className="p-2 font-mono">-</td><td className="p-2 font-mono">-</td><td className="p-2 font-mono font-semibold">{hhmm(entry.total_minutes)}</td><td className="p-2">{entry.remarks || "Legacy manual entry"}</td><td className="p-2">{motorPlotLabel(entry.plot)} · Valve{entry.valve_no}</td><td className="p-2">Legacy</td><td className="p-2 text-xs text-muted-foreground">Preserved</td></tr>)}</tbody></table>{sessions.length === 0 && legacyEntries.length === 0 && <Empty text="No runtime records match this period." />}</div></section>
}

function DailySummary({ rows, busy }: { rows: Array<{ date: string; motorId: MotorId; runs: number; minutes: number }>; busy: boolean }) {
  if (busy) return <Loading />
  return <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-serif text-lg font-bold">Daily Summary</h2><p className="text-xs text-muted-foreground">Published runs only. Draft, void and unresolved records are excluded.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-muted"><tr className="text-left"><th className="p-3">Date</th><th className="p-3">Motor</th><th className="p-3">Runs</th><th className="p-3">Total Run Time (HH:MM)</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.date}-${row.motorId}`} className="border-t border-border"><td className="p-3">{formatDate(row.date)}</td><td className="p-3 font-semibold">Motor {row.motorId.slice(-1)}</td><td className="p-3">{row.runs}</td><td className="p-3 font-mono text-base font-bold text-primary">{hhmm(row.minutes)}</td></tr>)}</tbody></table>{rows.length === 0 && <Empty text="No published runtime totals match this period." />}</div></section>
}

function Loading() { return <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading...</p> }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{text}</p> }
