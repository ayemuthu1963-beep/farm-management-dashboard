"use client"

import { CalendarRange, RefreshCw } from "lucide-react"
import { Panel } from "@/components/farm/panel"

const FARM_TIME_ZONE = "Asia/Kolkata"
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface MotorDateRange {
  startDate: string
  endDate: string
  days: number
}

interface MotorDateRangeSelectorProps {
  value: MotorDateRange
  errorMessage: string | null
  onChange: (value: MotorDateRange) => void
  onResetDefault: () => void
}

function farmDateParts(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  }
}

function isoFromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getFarmIsoDate(offsetDays = 0, now = new Date()): string {
  const { year, month, day } = farmDateParts(now)
  const utcDate = new Date(Date.UTC(year, month - 1, day + offsetDays))
  return isoFromUtcDate(utcDate)
}

export function getMotorDefaultDateRange(now = new Date()): MotorDateRange {
  const startDate = getFarmIsoDate(-6, now)
  const endDate = getFarmIsoDate(0, now)
  return {
    startDate,
    endDate,
    days: calculateDisplayedDays(startDate, endDate),
  }
}

export function calculateDisplayedDays(startDate: string, endDate: string): number {
  if (!ISO_DATE_PATTERN.test(startDate) || !ISO_DATE_PATTERN.test(endDate)) return 0
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return 0
  return Math.round((end - start) / 86_400_000) + 1
}

export function validateMotorDateRange(value: MotorDateRange): string | null {
  if (!value.startDate) return "Start Date is required."
  if (!value.endDate) return "End Date is required."
  if (!ISO_DATE_PATTERN.test(value.startDate)) return "Start Date is not valid."
  if (!ISO_DATE_PATTERN.test(value.endDate)) return "End Date is not valid."
  if (value.startDate > value.endDate) return "Start Date cannot be after End Date."
  const today = getFarmIsoDate(0)
  if (value.startDate > today || value.endDate > today) return "Future dates are not allowed."
  return null
}

function withDays(startDate: string, endDate: string): MotorDateRange {
  return { startDate, endDate, days: calculateDisplayedDays(startDate, endDate) }
}

export function MotorDateRangeSelector({ value, errorMessage, onChange, onResetDefault }: MotorDateRangeSelectorProps) {
  const today = getFarmIsoDate(0)

  return (
    <Panel title="Select Date Range" icon={CalendarRange}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label htmlFor="motor-start-date" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Start Date
          </label>
          <input
            id="motor-start-date"
            type="date"
            value={value.startDate}
            max={today}
            onChange={(event) => onChange(withDays(event.target.value, value.endDate))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="motor-end-date" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            End Date
          </label>
          <input
            id="motor-end-date"
            type="date"
            value={value.endDate}
            max={today}
            onChange={(event) => onChange(withDays(value.startDate, event.target.value))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="motor-days" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            No. of Days
          </label>
          <input
            id="motor-days"
            readOnly
            value={value.days}
            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm font-bold text-foreground outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onResetDefault}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Reset Default
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Default uses {FARM_TIME_ZONE}: Start Date = today − 6 days; End Date = today.
      </p>
      {errorMessage && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {errorMessage}
        </p>
      )}
    </Panel>
  )
}
