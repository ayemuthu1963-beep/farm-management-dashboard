"use client"

import { useState } from "react"
import { CalendarDays, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { FALLBACK_MOTORS } from "@/lib/motor-screenshot-analysis-config"
import type { DateSummary, Motor, RunRecord } from "@/lib/motor-screenshot-analysis-types"
import { formatDate, formatRuntime } from "@/lib/motor-screenshot-analysis-format"
import { RuntimeRecordCard } from "./runtime-record-card"

export function DateRuntimeGroup({
  summary,
  defaultOpen = false,
  onViewScreenshot,
  motors = FALLBACK_MOTORS,
}: {
  summary: DateSummary
  defaultOpen?: boolean
  onViewScreenshot: (record: RunRecord) => void
  motors?: Motor[]
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = `date-panel-${summary.date}`

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full flex-col gap-3 p-4 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
            <CalendarDays className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-serif text-base font-bold text-foreground">
              {formatDate(summary.date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.completeRuns} complete {summary.completeRuns === 1 ? "run" : "runs"}
              {summary.unmatched > 0 && (
                <span className="text-destructive"> · {summary.unmatched} unmatched</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          {motors.map((m) => (
            <div key={m.id} className="text-left">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", m.dotClass)} aria-hidden="true" />
                {m.name}
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatRuntime(summary.perMotorMinutes[m.id])}
              </span>
            </div>
          ))}
          <div className="border-l border-border pl-4 sm:pl-5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Combined</span>
            <span className="block font-serif text-base font-bold text-primary">
              {formatRuntime(summary.combinedMinutes)}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {open && (
        <div id={panelId} className="border-t border-border bg-muted/20 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.records.map((r) => (
              <RuntimeRecordCard
                key={r.id}
                record={r}
                onViewScreenshot={onViewScreenshot}
                showDate={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
