"use client"

import { type FormEvent, useState } from "react"
import { CalendarRange, Download, RefreshCw } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { cn } from "@/lib/utils"

const periodOptions = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 Days" },
  { id: "custom", label: "Custom Date Range" },
]

interface IrrigationPeriodSelectorProps {
  onPeriodChange: (query: string) => void
  onRefresh: () => void
  onExport: () => void
  isLoading?: boolean
}

function isoDateInIndia(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function IrrigationPeriodSelector({
  onPeriodChange,
  onRefresh,
  onExport,
  isLoading = false,
}: IrrigationPeriodSelectorProps) {
  const today = isoDateInIndia()
  const [activePeriod, setActivePeriod] = useState("last7")
  const [showCustom, setShowCustom] = useState(false)
  const [startDate, setStartDate] = useState(addDays(today, -6))
  const [endDate, setEndDate] = useState(today)

  function applyPeriod(periodId: string) {
    setActivePeriod(periodId)
    if (periodId === "custom") { setShowCustom(true); return }
    setShowCustom(false)
    onPeriodChange(`period=${periodId}`)
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!startDate || !endDate) return
    onPeriodChange(`period=custom&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)
  }

  return (
    <Panel title="Date & Period Controls" icon={CalendarRange} headerRight={<div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden="true" />Refresh</button><button type="button" onClick={onExport} disabled={isLoading} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"><Download className="size-4" aria-hidden="true" />Export to Excel</button></div>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((period) => <button key={period.id} type="button" onClick={() => applyPeriod(period.id)} className={cn("rounded-lg border px-4 py-2 text-sm font-semibold transition-colors", activePeriod === period.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted")}>{period.label}</button>)}
        </div>
        {showCustom ? <form onSubmit={submitCustom} className="grid gap-3 rounded-lg bg-muted/30 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"><div><label htmlFor="irrigation-start-date" className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</label><input id="irrigation-start-date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></div><div><label htmlFor="irrigation-end-date" className="mb-1 block text-xs font-medium text-muted-foreground">End Date</label><input id="irrigation-end-date" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></div><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Apply</button></form> : null}
      </div>
    </Panel>
  )
}
