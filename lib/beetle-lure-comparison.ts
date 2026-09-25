import { BEETLE_LURE_ASSIGNMENTS, BEETLE_LURE_START_DATE } from "./beetle-lure-assignments.ts"
import type { BeetleTrapLocationRecord } from "./beetle-trap-matrix.ts"

export { BEETLE_LURE_START_DATE }
export type LureCompany = "B" | "G"
type Plot = 1 | 2
type Species = "Red Palm Weevil" | "Rhinoceros Beetle"

export const BEETLE_LURE_SERIES = [
  { key: "plot1GRedPalmWeevil", plot: 1, company: "G", species: "Red Palm Weevil", color: "#dc2626" },
  { key: "plot1GRhinoceros", plot: 1, company: "G", species: "Rhinoceros Beetle", color: "#111827" },
  { key: "plot2GRedPalmWeevil", plot: 2, company: "G", species: "Red Palm Weevil", color: "#dc2626" },
  { key: "plot2GRhinoceros", plot: 2, company: "G", species: "Rhinoceros Beetle", color: "#111827" },
  { key: "plot1BRedPalmWeevil", plot: 1, company: "B", species: "Red Palm Weevil", color: "#d97706" },
  { key: "plot1BRhinoceros", plot: 1, company: "B", species: "Rhinoceros Beetle", color: "#2563eb" },
  { key: "plot2BRedPalmWeevil", plot: 2, company: "B", species: "Red Palm Weevil", color: "#d97706" },
  { key: "plot2BRhinoceros", plot: 2, company: "B", species: "Rhinoceros Beetle", color: "#2563eb" },
] as const
export type BeetleLureSeriesKey = typeof BEETLE_LURE_SERIES[number]["key"]
export type BeetleLureDailyRow = Record<BeetleLureSeriesKey, number | null> & {
  date: string
  sourceDate: string
}

const assignments = new Map<string, { plot: Plot; species: Species; company: LureCompany }>(
  BEETLE_LURE_ASSIGNMENTS.map(([trap, plot, species, company]) => [trap, { plot, species, company }]),
)

export function canonicalTrapNo(value: string): string {
  const number = value.trim().replace(/^Trap\s*/i, "")
  return /^\d+$/.test(number) ? String(Number(number)) : number
}

export function lureForTrap(trapNo: string): LureCompany | null {
  return assignments.get(canonicalTrapNo(trapNo))?.company ?? null
}

export function trapLureLabel(trapNo: string): string {
  return `Trap ${canonicalTrapNo(trapNo)} (${lureForTrap(trapNo) ?? "Unassigned"})`
}

export function comparisonStartDate(resetDate?: string | null): string {
  return resetDate && resetDate > BEETLE_LURE_START_DATE ? resetDate : BEETLE_LURE_START_DATE
}

/** Backend end date when available; otherwise the farm's current IST calendar day. */
export function comparisonEndDate(endDate?: string | null, now = new Date()): string {
  if (endDate) return endDate
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
}

export function comparisonLocations(
  locations: BeetleTrapLocationRecord[],
  startDate = BEETLE_LURE_START_DATE,
  endDate?: string | null,
): BeetleTrapLocationRecord[] {
  const start = comparisonStartDate(startDate)
  return locations.filter((location) => location.active !== false).map((location) => ({
    ...location,
    trap_no: canonicalTrapNo(location.trap_no),
    inspection_records: (location.inspection_records ?? []).filter((record) => {
      const date = record.inspection_date?.slice(0, 10)
      return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && (!endDate || date <= endDate)
    }),
  }))
}

export interface BeetleLureAreaRow {
  area: string
  red_palm_weevil_traps: number
  rhinoceros_beetle_traps: number
  red_palm_weevil_count: number | null
  rhinoceros_beetle_count: number | null
  average_red_palm_weevil: number | null
  average_rhinoceros_beetle: number | null
  has_red_palm_weevil_data: boolean
  has_rhinoceros_beetle_data: boolean
}

/** All displays use the same records and reviewed plot/company/species mapping. */
export function buildBeetleLureComparison(
  locations: BeetleTrapLocationRecord[],
  startDate = BEETLE_LURE_START_DATE,
  endDate?: string | null,
): { daily: BeetleLureDailyRow[]; areas: BeetleLureAreaRow[]; locations: BeetleTrapLocationRecord[] } {
  const active = comparisonLocations(locations, startDate, endDate)
  const seen = new Set<string>()
  for (const location of active) {
    const assignment = assignments.get(location.trap_no)
    if (!assignment) throw new Error(`Trap ${location.trap_no} needs a B/G assignment.`)
    if (seen.has(location.trap_no)) throw new Error(`Duplicate trap ${location.trap_no}.`)
    if (assignment.species !== location.trap_type) throw new Error(`Trap ${location.trap_no} species differs from the approved mapping.`)
    if (!Array.isArray(locations.find((row) => canonicalTrapNo(row.trap_no) === location.trap_no)?.inspection_records)) {
      throw new Error(`Trap ${location.trap_no} inspection records are unavailable.`)
    }
    seen.add(location.trap_no)
  }
  if (seen.size !== assignments.size) throw new Error("The comparison requires all 78 assigned traps; the active trap list has changed.")

  const daily = new Map<string, BeetleLureDailyRow>()
  const totals = new Map<BeetleLureSeriesKey, { traps: number; count: number | null }>(
    BEETLE_LURE_SERIES.map((series) => [series.key, { traps: 0, count: null }]),
  )
  for (const location of active) {
    const assignment = assignments.get(location.trap_no)!
    const series = BEETLE_LURE_SERIES.find((item) => item.plot === assignment.plot && item.company === assignment.company && item.species === assignment.species)!
    const total = totals.get(series.key)!
    total.traps += 1
    for (const record of location.inspection_records ?? []) {
      if (record.beetle_count === null || record.beetle_count === undefined || record.beetle_count === "") {
        throw new Error(`Trap ${location.trap_no} has an empty inspection count.`)
      }
      const count = Number(record.beetle_count)
      if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Trap ${location.trap_no} has an invalid inspection count.`)
      const sourceDate = record.inspection_date!.slice(0, 10)
      let row = daily.get(sourceDate)
      if (!row) {
        row = {
          ...Object.fromEntries(BEETLE_LURE_SERIES.map((item) => [item.key, null])),
          sourceDate,
          date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${sourceDate}T00:00:00Z`)),
        } as BeetleLureDailyRow
        daily.set(sourceDate, row)
      }
      row[series.key] = (row[series.key] ?? 0) + count
      total.count = (total.count ?? 0) + count
    }
  }
  const areas = ([1, 2] as const).flatMap((plot) => (["B", "G"] as const).map((company) => {
    const rpw = totals.get(`plot${plot}${company}RedPalmWeevil`)!
    const rhino = totals.get(`plot${plot}${company}Rhinoceros`)!
    return {
      area: `Plot ${plot} ${company}`,
      red_palm_weevil_traps: rpw.traps,
      rhinoceros_beetle_traps: rhino.traps,
      red_palm_weevil_count: rpw.count,
      rhinoceros_beetle_count: rhino.count,
      average_red_palm_weevil: rpw.count === null || !rpw.traps ? null : rpw.count / rpw.traps,
      average_rhinoceros_beetle: rhino.count === null || !rhino.traps ? null : rhino.count / rhino.traps,
      has_red_palm_weevil_data: rpw.count !== null,
      has_rhinoceros_beetle_data: rhino.count !== null,
    }
  }))
  return { daily: [...daily.values()].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate)), areas, locations: active }
}
