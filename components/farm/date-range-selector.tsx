"use client"

import { useState } from "react"
import { CalendarRange, RefreshCw } from "lucide-react"
import { Panel } from "@/components/farm/panel"

const dayOptions = ["5 Days", "7 Days", "15 Days", "30 Days"]

export function DateRangeSelector() {
  const [startDate, setStartDate] = useState("2026-07-02")
  const [endDate, setEndDate] = useState("2026-07-06")
  const [days, setDays] = useState("5 Days")

  return (
    <Panel title="Select Date Range" icon={CalendarRange}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label htmlFor="start-date" className="mb-1.5 block text-xs font-medium text-muted-foreground">
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
          <label htmlFor="end-date" className="mb-1.5 block text-xs font-medium text-muted-foreground">
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

        <div className="flex-1">
          <label htmlFor="days" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            No. of Days
          </label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {dayOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Update
        </button>
      </div>
    </Panel>
  )
}
