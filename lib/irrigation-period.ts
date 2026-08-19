export const IRRIGATION_TIME_ZONE = "Asia/Kolkata"
export const DEFAULT_IRRIGATION_LAST_N_DAYS = 7
export const IRRIGATION_LAST_N_DAY_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export const IRRIGATION_PERIOD_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "lastN", label: "Last N Days" },
  { id: "custom", label: "Custom Date Range" },
] as const

export type IrrigationPeriodId = (typeof IRRIGATION_PERIOD_OPTIONS)[number]["id"]

export interface IrrigationDateBounds {
  startDate: string
  endDate: string
  label: string
}

export const IRRIGATION_PERIOD_VALIDATION_ERRORS = [
  "Custom start and end dates are required",
  "Start date cannot be after end date",
  "Unsupported irrigation period",
  "Last N Days must be an integer from 2 through 10",
] as const

function isSupportedLastNDays(days: number): boolean {
  return Number.isInteger(days) && days >= 2 && days <= 10
}

export function normalizeIrrigationLastNDays(value: unknown): number {
  const days = typeof value === "number" ? value : Number(value)
  return isSupportedLastNDays(days) ? days : DEFAULT_IRRIGATION_LAST_N_DAYS
}

export function getIstIsoDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IRRIGATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function getIrrigationDateBounds(
  period: Exclude<IrrigationPeriodId, "custom">,
  lastNDays = DEFAULT_IRRIGATION_LAST_N_DAYS,
  now = new Date(),
): IrrigationDateBounds {
  const today = getIstIsoDate(now)
  const yesterday = shiftIsoDate(today, -1)

  if (period === "today") {
    return { startDate: today, endDate: today, label: "Today" }
  }
  if (period === "yesterday") {
    return { startDate: yesterday, endDate: yesterday, label: "Yesterday" }
  }

  const days = normalizeIrrigationLastNDays(lastNDays)
  return {
    startDate: shiftIsoDate(today, -(days - 1)),
    endDate: today,
    label: `Last ${days} Days`,
  }
}

export function buildIrrigationPeriodQuery(
  period: Exclude<IrrigationPeriodId, "custom">,
  lastNDays = DEFAULT_IRRIGATION_LAST_N_DAYS,
  now = new Date(),
): string {
  const bounds = getIrrigationDateBounds(period, lastNDays, now)
  const params = new URLSearchParams({
    period,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
  })
  if (period === "lastN") {
    params.set("days", normalizeIrrigationLastNDays(lastNDays).toString())
  }
  return params.toString()
}

export function resolveIrrigationDateBounds(
  searchParams: URLSearchParams,
  now = new Date(),
): IrrigationDateBounds {
  const period = searchParams.get("period") ?? "lastN"
  if (period === "custom") {
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    if (!startDate || !endDate) throw new Error(IRRIGATION_PERIOD_VALIDATION_ERRORS[0])
    if (startDate > endDate) throw new Error(IRRIGATION_PERIOD_VALIDATION_ERRORS[1])
    return { startDate, endDate, label: `${startDate} to ${endDate}` }
  }
  if (period !== "today" && period !== "yesterday" && period !== "lastN") {
    throw new Error(IRRIGATION_PERIOD_VALIDATION_ERRORS[2])
  }

  const daysValue = searchParams.get("days")
  const days = daysValue === null ? DEFAULT_IRRIGATION_LAST_N_DAYS : Number(daysValue)
  if (period === "lastN" && !isSupportedLastNDays(days)) {
    throw new Error(IRRIGATION_PERIOD_VALIDATION_ERRORS[3])
  }
  return getIrrigationDateBounds(period, days, now)
}

export function getRecentIrrigationHistoryDates(endDate?: string, now = new Date()): string[] {
  const finalDate = endDate ?? getIstIsoDate(now)
  return Array.from({ length: 7 }, (_, index) => shiftIsoDate(finalDate, -index))
}
