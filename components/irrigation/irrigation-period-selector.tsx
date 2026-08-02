"use client"

import { type ChangeEvent, type FormEvent, useState } from "react"
import { CalendarRange, Download, RefreshCw } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import {
  buildIrrigationPeriodQuery,
  DEFAULT_IRRIGATION_LAST_N_DAYS,
  getIrrigationDateBounds,
  IRRIGATION_LAST_N_DAY_OPTIONS,
  IRRIGATION_PERIOD_OPTIONS,
  type IrrigationPeriodId,
} from "@/lib/irrigation-period"
import { cn } from "@/lib/utils"

interface IrrigationPeriodSelectorProps {
  onPeriodChange: (query: string) => void
  onRefresh: () => void
  onExport: () => void
  isLoading?: boolean
  canExport?: boolean
}

export function IrrigationPeriodSelector({
  onPeriodChange,
  onRefresh,
  onExport,
  isLoading = false,
  canExport = false,
}: IrrigationPeriodSelectorProps) {
  const [initialRange] = useState(() => getIrrigationDateBounds("lastN"))
  const [activePeriod, setActivePeriod] = useState<IrrigationPeriodId>("lastN")
  const [lastNDays, setLastNDays] = useState(DEFAULT_IRRIGATION_LAST_N_DAYS)
  const [showCustom, setShowCustom] = useState(false)
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)

  function applyPeriod(periodId: IrrigationPeriodId) {
    setActivePeriod(periodId)
    if (periodId === "custom") {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    onPeriodChange(buildIrrigationPeriodQuery(periodId, lastNDays))
  }

  function updateLastNDays(event: ChangeEvent<HTMLSelectElement>) {
    const days = Number(event.target.value)
    setLastNDays(days)
    setActivePeriod("lastN")
    setShowCustom(false)
    onPeriodChange(buildIrrigationPeriodQuery("lastN", days))
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!startDate || !endDate) return
    const params = new URLSearchParams({ period: "custom", startDate, endDate })
    onPeriodChange(params.toString())
  }

  return (
    <Panel
      title="Date & Period Controls"
      icon={CalendarRange}
      headerRight={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={isLoading || !canExport}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden="true" />
            Export to Excel
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {IRRIGATION_PERIOD_OPTIONS.map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => applyPeriod(period.id)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                activePeriod === period.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {period.id === "lastN" ? `Last ${lastNDays} Days` : period.label}
            </button>
          ))}
        </div>

        {activePeriod === "lastN" ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center">
            <label htmlFor="irrigation-last-n-days" className="text-xs font-medium text-muted-foreground">
              Number of days
            </label>
            <select
              id="irrigation-last-n-days"
              value={lastNDays}
              onChange={updateLastNDays}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-24"
            >
              {IRRIGATION_LAST_N_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>{days}</option>
              ))}
            </select>
            <span className="text-sm font-semibold text-foreground">Last {lastNDays} Days</span>
          </div>
        ) : null}

        {showCustom ? (
          <form onSubmit={submitCustom} className="grid gap-3 rounded-lg bg-muted/30 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label htmlFor="irrigation-start-date" className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</label>
              <input id="irrigation-start-date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label htmlFor="irrigation-end-date" className="mb-1 block text-xs font-medium text-muted-foreground">End Date</label>
              <input id="irrigation-end-date" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Apply</button>
          </form>
        ) : null}
      </div>
    </Panel>
  )
}
