"use client"

import { useState } from "react"
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FALLBACK_MOTORS } from "@/lib/motor-screenshot-analysis-config"
import type { CommandSource, Motor, MotorId, RunStatus } from "@/lib/motor-screenshot-analysis-types"

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

function farmToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const part = (name: string) => parts.find((item) => item.type === name)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const TODAY = farmToday()
export const DEFAULT_FILTERS: Filters = {
  range: "30d",
  customStart: addDays(TODAY, -29),
  customEnd: TODAY,
  motor: "all",
  source: "all",
  status: "all",
  search: "",
}

export function resolveDateRange(filters: Filters): { startDate: string; endDate: string } {
  if (filters.range === "custom") return { startDate: filters.customStart, endDate: filters.customEnd }
  if (filters.range === "today") return { startDate: TODAY, endDate: TODAY }
  if (filters.range === "yesterday") {
    const day = addDays(TODAY, -1)
    return { startDate: day, endDate: day }
  }
  return { startDate: addDays(TODAY, filters.range === "7d" ? -6 : -29), endDate: TODAY }
}

const RANGES: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
]
const fieldClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"

export function AnalysisFilters({
  filters,
  onChange,
  resultCount,
  motors = FALLBACK_MOTORS,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  resultCount: number
  motors?: Motor[]
}) {
  const [openMobile, setOpenMobile] = useState(false)
  function set<K extends keyof Filters>(key: K, value: Filters[K]) { onChange({ ...filters, [key]: value }) }
  const body = (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Date range</p>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((range) => (
            <button key={range.value} type="button" onClick={() => set("range", range.value)} aria-pressed={filters.range === range.value} className={cn("rounded-full px-3 py-1 text-xs font-medium", filters.range === range.value ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:bg-muted")}>{range.label}</button>
          ))}
        </div>
      </div>
      {filters.range === "custom" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-foreground">Start date<input type="date" value={filters.customStart} onChange={(event) => set("customStart", event.target.value)} className={`mt-1 ${fieldClass}`} /></label>
          <label className="text-xs font-medium text-foreground">End date<input type="date" value={filters.customEnd} onChange={(event) => set("customEnd", event.target.value)} className={`mt-1 ${fieldClass}`} /></label>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-foreground">Motor
          <select value={filters.motor} onChange={(event) => set("motor", event.target.value as Filters["motor"])} className={`mt-1 ${fieldClass}`}>
            <option value="all">All Motors</option>{motors.map((motor) => <option key={motor.id} value={motor.id}>{motor.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-foreground">Command source
          <select value={filters.source} onChange={(event) => set("source", event.target.value as Filters["source"])} className={`mt-1 ${fieldClass}`}>
            <option value="all">All Sources</option><option value="rtc">RTC</option><option value="phone">Phone</option><option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="text-xs font-medium text-foreground">Status
          <select value={filters.status} onChange={(event) => set("status", event.target.value as Filters["status"])} className={`mt-1 ${fieldClass}`}>
            <option value="all">All Records</option><option value="complete">Complete</option><option value="unmatched_on">Unmatched ON</option><option value="unmatched_off">Unmatched OFF</option><option value="needs_review">Needs Review</option><option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="text-xs font-medium text-foreground">Search
          <span className="relative mt-1 block"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={filters.search} onChange={(event) => set("search", event.target.value)} placeholder="Reason or device" className={cn(fieldClass, "pl-8")} /></span>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{resultCount} database record{resultCount === 1 ? "" : "s"} loaded</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}><RotateCcw className="size-4" /> Reset Filters</Button>
      </div>
    </div>
  )
  return (
    <section aria-label="Filters" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="sm:hidden"><button type="button" onClick={() => setOpenMobile((value) => !value)} aria-expanded={openMobile} className="flex w-full items-center justify-between text-sm font-medium"><span className="flex items-center gap-2"><SlidersHorizontal className="size-4" /> Filters</span><span className="text-xs text-muted-foreground">{resultCount} shown</span></button>{openMobile && <div className="mt-4">{body}</div>}</div>
      <div className="hidden sm:block">{body}</div>
    </section>
  )
}
