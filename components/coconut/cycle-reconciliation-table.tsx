"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { Pencil, RefreshCw, Save, X } from "lucide-react"

import { HarvestButtonSpinner, HarvestRequestState } from "@/components/coconut/harvest-request-state"
import {
  formatReconciliationNumber,
  formatReconciliationPercent,
  reconciliationNumber,
  type CoconutCountingCycleReconciliation,
  type CoconutCountingReconciliationPlot,
  type CoconutCountingReconciliationResponse,
  type CoconutCountingReconciliationSession,
} from "@/lib/coconut-counting-reconciliation"
import { formatIstDateTime } from "@/lib/format-ist-date-time"
import { cn } from "@/lib/utils"

interface CycleReconciliationTableProps {
  cycle: number | null
  onCyclesLoaded?: (cycles: number[]) => void
  onViewTreeRecords?: (cycle: number) => void
  treeRecordCycles?: readonly number[]
}

function formatHarvestDate(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function statusClass(status: CoconutCountingReconciliationSession["status"]): string {
  if (status === "ACTIVE") return "border-amber-300 bg-amber-100 text-amber-900"
  if (status === "COMPLETED") return "border-emerald-300 bg-emerald-100 text-emerald-900"
  return "border-slate-300 bg-slate-100 text-slate-800"
}

function plotBackground(plot: 1 | 2): string {
  return plot === 1
    ? "bg-emerald-50/70 dark:bg-emerald-950/25"
    : "bg-sky-50/70 dark:bg-sky-950/25"
}

function rejectionClass(value: number | string | null): string {
  const number = reconciliationNumber(value)
  return number !== null && number < 0 ? "font-bold text-destructive" : "font-semibold text-foreground"
}

function HarvestedEditor({
  summary,
  onSaved,
}: {
  summary: CoconutCountingReconciliationPlot
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(summary.harvested === null ? "" : String(summary.harvested))
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!editing) setValue(summary.harvested === null ? "" : String(summary.harvested))
  }, [editing, summary.harvested])

  async function save() {
    const harvested = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(harvested)) {
      setError("Enter a non-negative whole number.")
      return
    }
    if (summary.harvested_revision > 0 && !reason.trim()) {
      setError("Enter a reason for this correction.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch(
        `/api/coconut-counting-admin/cycles/${summary.harvest_cycle}/plots/${summary.plot}/harvested`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            harvested_nuts: harvested,
            expected_revision: summary.harvested_revision,
            reason: reason.trim() || null,
          }),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
      if (!response.ok) throw new Error(payload.error ?? payload.detail ?? "Harvested total could not be saved.")
      await onSaved()
      setReason("")
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Harvested total could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="font-bold tabular-nums">{formatReconciliationNumber(summary.harvested)}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-primary hover:bg-accent"
        >
          <Pencil className="size-3" aria-hidden="true" />
          {summary.harvested === null ? "Enter" : "Edit"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-w-48 flex-col items-stretch gap-1.5">
      <label className="sr-only" htmlFor={`harvested-${summary.harvest_cycle}-${summary.plot}`}>
        Cycle {summary.harvest_cycle} Plot {summary.plot} Harvested
      </label>
      <input
        id={`harvested-${summary.harvest_cycle}-${summary.plot}`}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={saving}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
      />
      {summary.harvested_revision > 0 ? (
        <>
          <label className="sr-only" htmlFor={`harvested-reason-${summary.harvest_cycle}-${summary.plot}`}>
            Reason for correction
          </label>
          <input
            id={`harvested-reason-${summary.harvest_cycle}-${summary.plot}`}
            type="text"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={saving}
            placeholder="Reason for correction"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </>
      ) : null}
      {error ? <p className="text-left text-xs font-medium text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError("")
            setReason("")
          }}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-accent disabled:opacity-60"
        >
          <X className="size-3" aria-hidden="true" /> Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <HarvestButtonSpinner /> : <Save className="size-3" aria-hidden="true" />}
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  )
}

function plotSessions(cycle: CoconutCountingCycleReconciliation, plot: 1 | 2) {
  return cycle.sessions.filter((session) => session.plot === plot)
}

function CyclePlotCards({
  cycle,
  summary,
  onReload,
  onViewTreeRecords,
  treeRecordCycles,
}: {
  cycle: CoconutCountingCycleReconciliation
  summary: CoconutCountingReconciliationPlot
  onReload: () => Promise<void>
  onViewTreeRecords?: (cycle: number) => void
  treeRecordCycles?: readonly number[]
}) {
  const sessions = plotSessions(cycle, summary.plot)
  const hasTreeRecords = treeRecordCycles?.includes(cycle.harvest_cycle) ?? false
  return (
    <section className={cn("rounded-xl border border-border p-3", plotBackground(summary.plot))}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cycle {cycle.harvest_cycle}</p>
          <h3 className="font-bold text-foreground">Plot {summary.plot}</h3>
        </div>
        {onViewTreeRecords && hasTreeRecords ? (
          <button type="button" onClick={() => onViewTreeRecords(cycle.harvest_cycle)} className="text-xs font-semibold text-primary hover:underline">
            View tree records
          </button>
        ) : null}
      </div>
      <div className="space-y-3">
        {sessions.map((session) => (
          <article key={session.session_uuid} className="rounded-lg border border-border bg-background/85 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">{formatHarvestDate(session.harvest_date)}</p>
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", statusClass(session.status))}>{session.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div><dt className="text-xs text-muted-foreground">Entries</dt><dd className="font-semibold tabular-nums">{session.entries.toLocaleString("en-IN")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Grade A</dt><dd className="font-semibold tabular-nums">{formatReconciliationNumber(session.grade_a)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Grade B</dt><dd className="font-semibold tabular-nums">{formatReconciliationNumber(session.grade_b)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Count B</dt><dd className="font-semibold tabular-nums">{formatReconciliationNumber(session.count_b)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Combined</dt><dd className="font-semibold tabular-nums">{formatReconciliationNumber(session.combined)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Physical</dt><dd className="font-semibold tabular-nums">{formatReconciliationNumber(session.physical)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Last sync: {formatIstDateTime(session.last_sync)}</p>
          </article>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background/90 p-3">
        <p className="mb-2 font-bold">Total {summary.plot}</p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Grade A</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.grade_a)} <span className="font-medium">({formatReconciliationPercent(summary.grade_a_percent)})</span></dd></div>
          <div><dt className="text-xs text-muted-foreground">Grade B</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.grade_b)} <span className="font-medium">({formatReconciliationPercent(summary.grade_b_percent)})</span></dd></div>
          <div><dt className="text-xs text-muted-foreground">Count B</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.count_b)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Combined</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.combined)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Physical</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.physical)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Rejection</dt><dd className={cn("tabular-nums", rejectionClass(summary.rejection))}>{formatReconciliationNumber(summary.rejection)} <span className="font-medium">({formatReconciliationPercent(summary.rejection_percent)})</span></dd></div>
        </dl>
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Harvested</p>
          <HarvestedEditor summary={summary} onSaved={onReload} />
        </div>
      </div>
    </section>
  )
}

export function CycleReconciliationTable({
  cycle,
  onCyclesLoaded,
  onViewTreeRecords,
  treeRecordCycles,
}: CycleReconciliationTableProps) {
  const [data, setData] = useState<CoconutCountingReconciliationResponse | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setStatus("loading")
    setError("")
    try {
      const params = new URLSearchParams()
      if (cycle !== null) params.set("cycle", String(cycle))
      const suffix = params.size > 0 ? `?${params.toString()}` : ""
      const response = await fetch(`/api/coconut-harvest/cycle-reconciliation${suffix}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as CoconutCountingReconciliationResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Coconut Counting reconciliation data.")
      setData(payload)
      onCyclesLoaded?.(payload.cycles.map((item) => item.harvest_cycle))
      setStatus(payload.cycles.length > 0 ? "ready" : "empty")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Coconut Counting reconciliation data.")
      setStatus("error")
    }
  }, [cycle, onCyclesLoaded])

  useEffect(() => {
    void load()
  }, [load])

  if (status === "loading") return <HarvestRequestState tone="loading" message="Loading Coconut Counting harvest records..." />
  if (status === "error") return <HarvestRequestState tone="error" message="Unable to load the harvest table." detail={error} onRetry={load} />
  if (status === "empty" || !data) {
    return <HarvestRequestState tone="empty" message={cycle === null ? "No APK harvest cycles are available yet." : `No APK records are available for Cycle ${cycle}.`} />
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <p>Grade B = Count B × 2 · Combined = Grade A + Count B · Physical = Grade A + Grade B</p>
          <p>Harvested is entered once for each Cycle and Plot. Rejection = Harvested − Physical.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent">
          <RefreshCw className="size-3.5" aria-hidden="true" /> Refresh table
        </button>
      </div>

      {data.unassigned_session_count > 0 ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {data.unassigned_session_count.toLocaleString("en-IN")} legacy session(s) have no Cycle or Plot and are excluded until assigned.
        </p>
      ) : null}

      <div className="space-y-4 xl:hidden">
        {data.cycles.flatMap((cycleData) => cycleData.plots.map((summary) => (
          <CyclePlotCards
            key={`${cycleData.harvest_cycle}-${summary.plot}`}
            cycle={cycleData}
            summary={summary}
            onReload={load}
            onViewTreeRecords={onViewTreeRecords}
            treeRecordCycles={treeRecordCycles}
          />
        )))}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1500px] border-collapse text-sm">
          <thead>
            <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
              <th className="px-3 py-2.5">Cycle</th>
              <th className="px-3 py-2.5">Plot</th>
              <th className="px-3 py-2.5">Harvest date</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Entries</th>
              <th className="px-3 py-2.5 text-right">Grade A</th>
              <th className="px-3 py-2.5 text-right">Grade B</th>
              <th className="px-3 py-2.5 text-right">Count B</th>
              <th className="px-3 py-2.5 text-right">Combined</th>
              <th className="px-3 py-2.5 text-right">Physical</th>
              <th className="px-3 py-2.5 text-right">Rejection</th>
              <th className="px-3 py-2.5 text-right">Harvested</th>
              <th className="px-3 py-2.5">Last sync</th>
            </tr>
          </thead>
          <tbody>
            {data.cycles.map((cycleData) => (
              <Fragment key={cycleData.harvest_cycle}>
                {cycleData.plots.map((summary) => (
                  <Fragment key={`${cycleData.harvest_cycle}-${summary.plot}`}>
                    {plotSessions(cycleData, summary.plot).map((session) => (
                      <tr key={session.session_uuid} className={cn("border-b border-border", plotBackground(summary.plot))}>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{cycleData.harvest_cycle}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium">{session.plot}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{formatHarvestDate(session.harvest_date)}</td>
                        <td className="px-3 py-2.5"><span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", statusClass(session.status))}>{session.status}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{session.entries.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatReconciliationNumber(session.grade_a)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatReconciliationNumber(session.grade_b)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatReconciliationNumber(session.count_b)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatReconciliationNumber(session.combined)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatReconciliationNumber(session.physical)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatIstDateTime(session.last_sync)}</td>
                      </tr>
                    ))}
                    <tr className={cn("border-y-2 border-primary/25 font-bold", plotBackground(summary.plot))}>
                      <td className="px-3 py-3 align-top">
                        <span>Cycle {cycleData.harvest_cycle}</span>
                        {onViewTreeRecords && treeRecordCycles?.includes(cycleData.harvest_cycle) ? (
                          <button type="button" onClick={() => onViewTreeRecords(cycleData.harvest_cycle)} className="mt-1 block text-xs font-semibold text-primary hover:underline">
                            View tree records
                          </button>
                        ) : null}
                      </td>
                      <th scope="row" className="whitespace-nowrap px-3 py-3 text-left">Total {summary.plot}</th>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3 text-right">—</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.grade_a)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.grade_b)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.count_b)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.combined)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.physical)}</td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", rejectionClass(summary.rejection))}>{formatReconciliationNumber(summary.rejection)}</td>
                      <td className="px-3 py-3 text-right align-top"><HarvestedEditor summary={summary} onSaved={load} /></td>
                      <td className="px-3 py-3">—</td>
                    </tr>
                    <tr className="border-b-2 border-primary/20 bg-muted/35 text-xs font-semibold text-muted-foreground">
                      <td className="px-3 py-2">Cycle {cycleData.harvest_cycle}</td>
                      <th scope="row" className="px-3 py-2 text-left">Percentage</th>
                      <td colSpan={3} className="px-3 py-2">—</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatReconciliationPercent(summary.grade_a_percent)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatReconciliationPercent(summary.grade_b_percent)}</td>
                      <td colSpan={3} className="px-3 py-2">—</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", rejectionClass(summary.rejection))}>{formatReconciliationPercent(summary.rejection_percent)}</td>
                      <td colSpan={2} className="px-3 py-2">—</td>
                    </tr>
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
