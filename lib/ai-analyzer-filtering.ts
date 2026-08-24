import type { AnalyzerAlert, AnalyzerSeverity } from "@/lib/ai-analyzer-types"

export type AnalyzerFilterState = {
  crop: string
  plot: string
  zone: string
  date: string
  severity: "all" | AnalyzerSeverity
}

type DateScopedAlert = Pick<AnalyzerAlert, "start_date" | "end_date">

type FilterableAlert = DateScopedAlert & Pick<AnalyzerAlert, "alert_id" | "crop" | "plot" | "zone" | "severity">

const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Validate an ISO calendar date without constructing a JavaScript Date.
 * Analyzer filtering is farm-calendar based (Asia/Kolkata), so UTC conversion
 * must never be allowed to move a selected day backwards or forwards.
 */
export function isValidIsoCalendarDate(value: string): boolean {
  const match = ISO_CALENDAR_DATE.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

/**
 * Date-filter contract:
 * - blank selects every alert;
 * - a start-only point alert matches that exact date;
 * - a valid start/end range is inclusive;
 * - undated, malformed, end-only, or reversed-range alerts are excluded while
 *   a Date filter is active.
 */
export function matchesAnalyzerAlertDate(alert: DateScopedAlert, selectedDate: string): boolean {
  if (selectedDate === "") return true
  if (!isValidIsoCalendarDate(selectedDate)) return false

  const startDate = alert.start_date
  const endDate = alert.end_date
  if (!startDate || !isValidIsoCalendarDate(startDate)) return false

  if (!endDate) return startDate === selectedDate
  if (!isValidIsoCalendarDate(endDate) || endDate < startDate) return false

  return startDate <= selectedDate && selectedDate <= endDate
}

export function filterAnalyzerAlerts<T extends FilterableAlert>(alerts: readonly T[], filters: AnalyzerFilterState): T[] {
  return alerts.filter((alert) => {
    return (filters.crop === "all" || alert.crop === filters.crop)
      && (filters.plot === "all" || alert.plot === filters.plot)
      && (filters.zone === "all" || alert.zone === filters.zone)
      && (filters.severity === "all" || alert.severity === filters.severity)
      && matchesAnalyzerAlertDate(alert, filters.date)
  })
}

export function resolveVisibleAnalyzerAlert<T extends Pick<AnalyzerAlert, "alert_id">>(
  visibleAlerts: readonly T[],
  selectedId: string | null,
): T | null {
  return visibleAlerts.find((alert) => alert.alert_id === selectedId) ?? visibleAlerts[0] ?? null
}
