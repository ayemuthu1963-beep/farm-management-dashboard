export function formatWeatherValue(
  value: number | null,
  suffix: string,
  fractionDigits = 1,
): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(fractionDigits)}${suffix}`
}

export function formatObservationTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return "time unavailable"

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

export function formatHistoryDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date)
}
