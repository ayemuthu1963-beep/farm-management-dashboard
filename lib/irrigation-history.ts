export interface IrrigationHistoryEntry {
  entry_date: string
  plot: string
  total_minutes: number
}

export interface IrrigationHistoryDay {
  date: string
  displayDate: string
  totalMinutes: number
  perTreeLitres: number | null
  status: "Irrigated" | "No Record"
  isCurrentIncompleteDay: boolean
  knownZeroReason?: string
}

interface BuildRecentIrrigationHistoryOptions<TZone extends string> {
  entries: IrrigationHistoryEntry[]
  historyDates: string[]
  zoneIds: readonly TZone[]
  zoneByPlot: ReadonlyMap<string, TZone>
  litresPerTreePerHourByZone: Record<TZone, number>
  today: string
  knownZeroReasonsByZoneAndDate?: ReadonlyMap<TZone, ReadonlyMap<string, string>>
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
}

export function buildRecentIrrigationHistory<TZone extends string>({
  entries,
  historyDates,
  zoneIds,
  zoneByPlot,
  litresPerTreePerHourByZone,
  today,
  knownZeroReasonsByZoneAndDate,
}: BuildRecentIrrigationHistoryOptions<TZone>): Record<TZone, IrrigationHistoryDay[]> {
  const uniqueHistoryDates = Array.from(new Set(historyDates))
  const includedDates = new Set(uniqueHistoryDates)
  const minutesByZoneAndDate = new Map<TZone, Map<string, number>>()
  for (const zoneId of zoneIds) minutesByZoneAndDate.set(zoneId, new Map<string, number>())

  for (const entry of entries) {
    const zoneId = zoneByPlot.get(entry.plot)
    if (!zoneId || !includedDates.has(entry.entry_date)) continue
    const totalMinutes = Number(entry.total_minutes ?? 0)
    const dateMap = minutesByZoneAndDate.get(zoneId)
    if (!dateMap || !Number.isFinite(totalMinutes)) continue
    dateMap.set(entry.entry_date, (dateMap.get(entry.entry_date) ?? 0) + totalMinutes)
  }

  return Object.fromEntries(zoneIds.map((zoneId) => {
    const dateMap = minutesByZoneAndDate.get(zoneId) ?? new Map<string, number>()
    const history = uniqueHistoryDates.map((date) => {
      const totalMinutes = dateMap.get(date) ?? 0
      const knownZeroReason = totalMinutes > 0
        ? undefined
        : knownZeroReasonsByZoneAndDate?.get(zoneId)?.get(date)
      return {
        date,
        displayDate: formatShortDate(date),
        totalMinutes,
        perTreeLitres: totalMinutes > 0
          ? Math.round((totalMinutes / 60) * litresPerTreePerHourByZone[zoneId])
          : null,
        status: totalMinutes > 0 ? "Irrigated" as const : "No Record" as const,
        isCurrentIncompleteDay: date === today,
        ...(knownZeroReason ? { knownZeroReason } : {}),
      }
    })
    return [zoneId, history]
  })) as Record<TZone, IrrigationHistoryDay[]>
}
