"use client"

import { useState } from "react"
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MOTORS } from "@/lib/motor-screenshot-analysis-mock-data"
import type {
  CommandSource,
  MotorId,
  RunRecord,
  RunStatus,
} from "@/lib/motor-screenshot-analysis-types"

export type DateRange = "today" | "yesterday" | "7d" | "30d" | "custom"

export interface Filters {
  range: DateRange
  customStart: string
  customEnd: string
  motor: MotorId | "all"
  source: CommandSource | "all"
  status: RunStatus | "all"
  search: string
}
export const DEFAULT_FILTERS: Filters = {
  range: "30d",
  customStart: "2026-07-28",
  customEnd: "2026-07-31",
  motor: "all",
  source: "all",
  status: "all",
  search: "",
}

// The sample data ends 31 Jul 2026 — treat that as "today" so relative ranges
// return meaningful records in this static preview.
const REFERENCE_TODAY = "2026-07-31"

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00")
  const to = new Date(toIso + "T00:00:00")
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export function applyFilters(records: RunRecord[], filters: Filters): RunRecord[] {
  return records.filter((r) => {
    // Date range
    if (filters.range === "custom") {
      if (r.date < filters.customStart || r.date > filters.customEnd) return false
    } else {
      const diff = daysBetween(r.date, REFERENCE_TODAY)
      if (filters.range === "today" && diff !== 0) return false
      if (filters.range === "yesterday" && diff !== 1) return false
      if (filters.range === "7d" && (diff < 0 || diff > 6)) return false
      if (filters.range === "30d" && (diff < 0 || diff > 29)) return false
    }

    if (filters.motor !== "all" && r.motorId !== filters.motor) return false
    if (filters.source !== "all" && r.source !== filters.source) return false
    if (filters.status !== "all" && r.status !== filters.status) return false

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      const hay = [r.onReason, r.offReason, r.screenshotName, r.onTime, r.offTime]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

const RANGES: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
]

function fieldClass() {
  return "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
}

export function AnalysisFilters({
  filters,
  onChange,
  resultCount,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  resultCount: number
}) {
  const [openMobile, setOpenMobile] = useState(false)

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value })
  }

  const body = (
    <div className="flex flex-col gap-4">
      {/* Date range chips */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Date range
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => set("range", r.value)}
              aria-pressed={filters.range === r.value}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filters.range === r.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {filters.range === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <label htmlFor="start-date" className="mb-1 block text-xs font-medium text-foreground">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={filters.customStart}
              onChange={(e) => set("customStart", e.target.value)}
              className={fieldClass()}
            />
          </div>
          <div>
            <label htmlFor="end-date" className="mb-1 block text-xs font-medium text-foreground">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={filters.customEnd}
              onChange={(e) => set("customEnd", e.target.value)}
              className={fieldClass()}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:pb-2">
            Custom range applies automatically.
          </p>
        </div>
      )}

      {/* Record filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="motor-filter" className="mb-1 block text-xs font-medium text-foreground">
            Motor
          </label>
          <select
            id="motor-filter"
            value={filters.motor}
            onChange={(e) => set("motor", e.target.value as Filters["motor"])}
            className={fieldClass()}
          >
            <option value="all">All Motors</option>
            {MOTORS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source-filter" className="mb-1 block text-xs font-medium text-foreground">
            Command source
          </label>
          <select
            id="source-filter"
            value={filters.source}
            onChange={(e) => set("source", e.target.value as Filters["source"])}
            className={fieldClass()}
          >
            <option value="all">All Sources</option>
            <option value="rtc">RTC</option>
            <option value="phone">Phone</option>
          </select>
        </div>
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-foreground">
            Status
          </label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(e) => set("status", e.target.value as Filters["status"])}
            className={fieldClass()}
          >
            <option value="all">All Records</option>
            <option value="complete">Complete</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </div>
        <div>
          <label htmlFor="search-filter" className="mb-1 block text-xs font-medium text-foreground">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="search-filter"
              type="search"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder={"Reason, command, file\u2026"}
              className={cn(fieldClass(), "pl-8")}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {resultCount} record{resultCount === 1 ? "" : "s"} match
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset Filters
        </Button>
      </div>
    </div>
  )

  return (
    <section
      aria-label="Filters"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      {/* Mobile collapse */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setOpenMobile((v) => !v)}
          aria-expanded={openMobile}
          className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            Filters
          </span>
          <span className="text-xs text-muted-foreground">{resultCount} shown</span>
        </button>
        {openMobile && <div className="mt-4">{body}</div>}
      </div>

      {/* Tablet / desktop */}
      <div className="hidden sm:block">{body}</div>
    </section>
  )
}
