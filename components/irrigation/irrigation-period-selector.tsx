"use client"

import { useState } from "react"
import { Panel } from "@/components/farm/panel"
import { ExportButton } from "@/components/farm/export-button"
import { RefreshCw, CalendarRange } from "lucide-react"
import { cn } from "@/lib/utils"

const periodOptions = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 Days" },
  { id: "cycle", label: "Current Irrigation Cycle" },
  { id: "custom", label: "Custom Date Range" },
]

interface IrrigationPeriodSelectorProps {
  onPeriodChange: (query: string) => void
  onRefresh: () => void
}

export function IrrigationPeriodSelector({ onPeriodChange, onRefresh }: IrrigationPeriodSelectorProps) {
  const [activePeriod, setActivePeriod] = useState("last7")
  const [showCustom, setShowCustom] = useState(false)
  const [startDate, setStartDate] = useState("2026-07-13")
  const [endDate, setEndDate] = useState("2026-07-13")

  function applyPeriod(periodId: string) {
    setActivePeriod(periodId)
    if (periodId === "custom") {
      setShowCustom(true)
      return
    }

    setShowCustom(false)
    onPeriodChange(`period=${periodId}`)
  }

  function applyCustomRange() {
    onPeriodChange(`period=custom&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)
  }

  return (
    <Panel
      title="Date & Period Controls"
      icon={CalendarRange}
      headerRight={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </button>
          <ExportButton label="Export" />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Period buttons */}
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((period) => (
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
              {period.label}
            </button>
          ))}
        </div>

        {/* Custom date range (hidden by default) */}
        {showCustom && (
          <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label htmlFor="start-date" className="mb-1 block text-xs font-medium text-muted-foreground">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="end-date" className="mb-1 block text-xs font-medium text-muted-foreground">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={applyCustomRange}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}
