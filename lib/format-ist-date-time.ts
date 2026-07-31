const IST_TIME_ZONE = "Asia/Kolkata"

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: IST_TIME_ZONE,
})

export function formatIstDateTime(value: string | null | undefined): string {
  if (!value) return "—"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"

  const parts = new Map(
    IST_DATE_TIME_FORMATTER.formatToParts(parsed).map((part) => [part.type, part.value]),
  )
  const day = parts.get("day")
  const month = parts.get("month")
  const year = parts.get("year")
  const hour = parts.get("hour")
  const minute = parts.get("minute")

  if (!day || !month || !year || !hour || !minute) return "—"
  return `${day} ${month} ${year} | ${hour}:${minute} IST`
}
