// Reusable date / time / runtime formatters.
// Centralised so runtime formatting is never duplicated across components.

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/**
 * Format minutes as "H hr MM min", or "M min" when under an hour.
 * Examples: 158 -> "2 hr 38 min", 368 -> "6 hr 08 min", 21 -> "21 min".
 */
export function formatRuntime(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 min"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  return `${hours} hr ${String(mins).padStart(2, "0")} min`
}
/** Format an ISO date ("2026-07-30") as "30 Jul 2026". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/** Short weekday + day, e.g. "Thu 30". */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" })
  return `${weekday} ${d.getDate()}`
}

/** Format an inclusive date range as "28 Jul–31 Jul 2026". */
export function formatDateRange(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split("-").map(Number)
  const [ey, em, ed] = endIso.split("-").map(Number)
  const start = sy === ey ? `${sd} ${MONTHS[sm - 1]}` : `${sd} ${MONTHS[sm - 1]} ${sy}`
  const end = `${ed} ${MONTHS[em - 1]} ${ey}`
  return `${start}\u2013${end}`
}

/** Guarantee 24-hour "HH:MM" with no seconds; passthrough for our mock data. */
export function formatTime(time: string | null): string {
  return time ?? "\u2014"
}
