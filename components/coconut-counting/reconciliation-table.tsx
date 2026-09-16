"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight, RefreshCw } from "lucide-react"

import { CoconutCountingHarvestedEditor } from "@/components/coconut-counting/harvested-editor"
import { HarvestRequestState } from "@/components/coconut/harvest-request-state"
import {
  formatReconciliationNumber,
  formatReconciliationPercent,
  reconciliationNumber,
  type CoconutCountingCycleReconciliation,
  type CoconutCountingReconciliationPlot,
  type CoconutCountingReconciliationResponse,
  type CoconutCountingReconciliationSession,
} from "@/lib/coconut-counting-reconciliation"
import { cn } from "@/lib/utils"

function formatHarvestDate(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function formatLastSync(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed)
}

function sessionHref(session: CoconutCountingReconciliationSession): string {
  const date = session.harvest_date.slice(0, 10)
  const params = new URLSearchParams({ from: date, to: date, session: session.session_uuid })
  return `/coconut-counting?${params.toString()}#session-detail`
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

function plotSessions(cycle: CoconutCountingCycleReconciliation, plot: 1 | 2) {
  return cycle.sessions.filter((session) => session.plot === plot)
}

function MobilePlot({
  cycle,
  summary,
  onReload,
}: {
  cycle: CoconutCountingCycleReconciliation
  summary: CoconutCountingReconciliationPlot
  onReload: () => Promise<void>
}) {
  return (
    <section className={cn("rounded-xl border border-border p-3", plotBackground(summary.plot))}>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cycle {cycle.harvest_cycle}</p>
        <h3 className="font-bold text-foreground">Plot {summary.plot}</h3>
      </div>
      <div className="space-y-3">
        {plotSessions(cycle, summary.plot).map((session) => (
          <article key={session.session_uuid} className="rounded-lg border border-border bg-background/85 p-3 text-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{formatHarvestDate(session.harvest_date)}</p>
                <p className="text-xs text-muted-foreground">Last sync: {formatLastSync(session.last_sync)}</p>
              </div>
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
            <Link href={sessionHref(session)} className="mt-3 inline-flex items-center gap-1 font-bold text-primary hover:underline">
              View session <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background/90 p-3">
        <p className="font-bold">Total {summary.plot}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Grade A</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.grade_a)} ({formatReconciliationPercent(summary.grade_a_percent)})</dd></div>
          <div><dt className="text-xs text-muted-foreground">Grade B</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.grade_b)} ({formatReconciliationPercent(summary.grade_b_percent)})</dd></div>
          <div><dt className="text-xs text-muted-foreground">Count B</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.count_b)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Combined</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.combined)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Physical</dt><dd className="font-bold tabular-nums">{formatReconciliationNumber(summary.physical)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Rejection</dt><dd className={cn("tabular-nums", rejectionClass(summary.rejection))}>{formatReconciliationNumber(summary.rejection)} ({formatReconciliationPercent(summary.rejection_percent)})</dd></div>
        </dl>
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Harvested</p>
          <CoconutCountingHarvestedEditor summary={summary} onSaved={onReload} idPrefix="mobile" />
        </div>
      </div>
    </section>
  )
}

export function CoconutCountingReconciliationTable() {
  const [data, setData] = useState<CoconutCountingReconciliationResponse | null>(null)
  const [cycleOptions, setCycleOptions] = useState<number[]>([])
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")
  const [error, setError] = useState("")
  const requestGeneration = useRef(0)

  const loadCycle = useCallback(async (cycle: number) => {
    const requestId = ++requestGeneration.current
    setStatus("loading")
    setError("")
    try {
      const response = await fetch(`/api/coconut-counting/reconciliation?cycle=${cycle}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as CoconutCountingReconciliationResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Coconut Counting reconciliation data.")
      if (requestId !== requestGeneration.current) return
      setData(payload)
      setStatus(payload.cycles.length > 0 ? "ready" : "empty")
    } catch (caught) {
      if (requestId !== requestGeneration.current) return
      setError(caught instanceof Error ? caught.message : "Unable to load Coconut Counting reconciliation data.")
      setStatus("error")
    }
  }, [])

  const discoverCycles = useCallback(async (preferredCycle: number | null) => {
    setStatus("loading")
    setError("")
    try {
      const response = await fetch("/api/coconut-counting/reconciliation", { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as CoconutCountingReconciliationResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Unable to discover harvest cycles.")
      const cycles = payload.cycles.map((item) => item.harvest_cycle)
      setCycleOptions(cycles)
      const nextCycle = preferredCycle !== null && cycles.includes(preferredCycle)
        ? preferredCycle
        : (cycles[0] ?? null)
      setSelectedCycle(nextCycle)
      if (nextCycle === null) {
        setData(payload)
        setStatus("empty")
      } else {
        await loadCycle(nextCycle)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to discover harvest cycles.")
      setStatus("error")
    }
  }, [loadCycle])

  useEffect(() => {
    void discoverCycles(null)
    return () => {
      requestGeneration.current += 1
    }
  }, [discoverCycles])

  const cycleData = data?.cycles[0] ?? null

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-labelledby="harvest-reconciliation-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="harvest-reconciliation-heading" className="font-bold text-foreground">Harvest reconciliation</h2>
          <p className="text-xs text-muted-foreground">Complete APK sessions and workbook totals for the selected harvest cycle.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-xs font-semibold text-foreground">
            Cycle
            <select
              value={selectedCycle ?? ""}
              onChange={(event) => {
                const cycle = Number(event.target.value)
                setSelectedCycle(cycle)
                void loadCycle(cycle)
              }}
              disabled={cycleOptions.length === 0}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {cycleOptions.map((cycle) => <option key={cycle} value={cycle}>Cycle {cycle}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void discoverCycles(selectedCycle)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold hover:bg-accent">
            <RefreshCw className="size-3.5" aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <p>Grade B = Count B × 2 · Combined = Grade A + Count B · Physical = Grade A + Grade B</p>
        <p>Harvested is manually entered once per Cycle and Plot · Rejection = Harvested − Physical</p>
      </div>

      {status === "loading" ? <div className="p-4"><HarvestRequestState tone="loading" message="Loading Coconut Counting harvest records..." /></div> : null}
      {status === "error" ? <div className="p-4"><HarvestRequestState tone="error" message="Unable to load the harvest table." detail={error} onRetry={() => discoverCycles(selectedCycle)} /></div> : null}
      {status === "empty" ? <div className="p-4"><HarvestRequestState tone="empty" message="No APK records are available for the selected cycle." /></div> : null}

      {data && data.unassigned_session_count > 0 ? (
        <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          {data.unassigned_session_count.toLocaleString("en-IN")} legacy session(s) have no Cycle or Plot. They remain available in Filtered session records below.
        </p>
      ) : null}

      {status === "ready" && cycleData ? (
        <>
          <div className="space-y-4 p-3 xl:hidden">
            {cycleData.plots.map((summary) => (
              <MobilePlot key={summary.plot} cycle={cycleData} summary={summary} onReload={() => loadCycle(cycleData.harvest_cycle)} />
            ))}
          </div>

          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[1400px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
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
                {cycleData.plots.map((summary) => (
                  <Fragment key={summary.plot}>
                    {plotSessions(cycleData, summary.plot).map((session) => (
                      <tr key={session.session_uuid} className={cn("border-b border-border", plotBackground(summary.plot))}>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium">{session.plot}</td>
                        <td className="whitespace-nowrap px-3 py-2.5"><Link href={sessionHref(session)} className="font-semibold text-primary hover:underline">{formatHarvestDate(session.harvest_date)}</Link></td>
                        <td className="px-3 py-2.5"><span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", statusClass(session.status))}>{session.status}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{session.entries.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatReconciliationNumber(session.grade_a)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatReconciliationNumber(session.grade_b)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatReconciliationNumber(session.count_b)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatReconciliationNumber(session.combined)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatReconciliationNumber(session.physical)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatLastSync(session.last_sync)}</td>
                      </tr>
                    ))}
                    <tr className={cn("border-y-2 border-primary/25 font-bold", plotBackground(summary.plot))}>
                      <th scope="row" className="whitespace-nowrap px-3 py-3 text-left">Total {summary.plot}</th>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3"> </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.grade_a)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.grade_b)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.count_b)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.combined)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatReconciliationNumber(summary.physical)}</td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", rejectionClass(summary.rejection))}>{formatReconciliationNumber(summary.rejection)}</td>
                      <td className="px-3 py-3 text-right align-top"><CoconutCountingHarvestedEditor summary={summary} onSaved={() => loadCycle(cycleData.harvest_cycle)} idPrefix="desktop" /></td>
                      <td className="px-3 py-3"> </td>
                    </tr>
                    <tr className="border-b-2 border-primary/20 bg-muted/35 text-xs font-semibold text-muted-foreground">
                      <th scope="row" className="px-3 py-2 text-left">Percentage</th>
                      <td colSpan={3} className="px-3 py-2"> </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatReconciliationPercent(summary.grade_a_percent)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatReconciliationPercent(summary.grade_b_percent)}</td>
                      <td colSpan={3} className="px-3 py-2"> </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", rejectionClass(summary.rejection))}>{formatReconciliationPercent(summary.rejection_percent)}</td>
                      <td colSpan={2} className="px-3 py-2"> </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}
