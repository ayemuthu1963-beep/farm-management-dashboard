const DAY_MS = 24 * 60 * 60 * 1000

function getIstCalendarDate(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = new Map(parts.map((part) => [part.type, part.value]))

  return new Date(
    Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
    ),
  )
}

function formatProviderDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "")
}

export function getHistoryDateRange(days: number, now = new Date()) {
  const today = getIstCalendarDate(now)
  const end = new Date(today.getTime() - DAY_MS)
  const start = new Date(end.getTime() - (days - 1) * DAY_MS)

  return {
    startDate: formatProviderDate(start),
    endDate: formatProviderDate(end),
  }
}
