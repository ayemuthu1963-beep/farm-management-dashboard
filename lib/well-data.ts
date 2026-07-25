// ============================================================================
// WELL WATER DASHBOARD DATA CONTRACT
// Uses the existing backend /api/well-water/dashboard response as source of truth.
// No duplicate tables; calculations reuse well_water_wells + vw_well_water_readings.
// ============================================================================

export type WellId = "north" | "south"
export type WellCode = "well1" | "well2"

export interface WellDashboardRow {
  reading_id: number
  reading_date: string
  reading_time: string
  well_code: WellCode
  well_name: string
  feet: number
  inches: number
  total_inches: number
  previous_total_inches: number | null
  change_inches: number | null
  pumped_out_liters: number
  recharge_liters: number
  capacity_liters: number
  liters_per_inch: number
  total_depth_inches?: number | null
  calculation_method?: string | null
  reference_offset_inches?: number | null
  level_feet_decimal: number
}

export interface WellDashboardResponse {
  summary: {
    total_readings: number
    first_reading_date: string | null
    latest_reading_date: string | null
  }
  north_rows: WellDashboardRow[]
  south_rows: WellDashboardRow[]
}

export interface WellDailyRecord {
  date: string
  morningWater: number | null
  eveningWater: number | null
  morningWaterDisplay: string
  eveningWaterDisplay: string
  waterPumpedOut: number | null
  rechargedSinceYesterday: number | null
  remarks: string
  configurationWarning?: string
}

export interface SummaryStat {
  well: string
  wellId: WellId
  label: string
  value: number | null
  icon: "drop" | "drop-alt" | "pump" | "recharge"
  warning?: string
}

export interface WellDashboardData {
  northWellRecords: WellDailyRecord[]
  southWellRecords: WellDailyRecord[]
  wellCapacity: Record<WellId, string>
  summaryStats: SummaryStat[]
  totalReadings: number
  latestReadingDate: string
}

export interface ChartPoint {
  date: string
  morningWater: number | null
  eveningWater: number | null
  pumpedOut: number | null
  recharged: number | null
}

const WELL_ID_BY_CODE: Record<WellCode, WellId> = {
  well1: "north",
  well2: "south",
}

const WELL_NAME_BY_ID: Record<WellId, string> = {
  north: "North Well",
  south: "South Well",
}

export const SOUTH_WELL_CONFIGURATION_WARNING = "Configuration requires verification"

const CAPACITY_MINUS_TAPE = "CAPACITY_MINUS_TAPE"
const REMAINING_COLUMN_CAPPED = "REMAINING_COLUMN_CAPPED"

export const emptyWellDashboardData: WellDashboardData = {
  northWellRecords: [],
  southWellRecords: [],
  wellCapacity: {
    north: "--",
    south: "--",
  },
  summaryStats: [
    { well: "North Well", wellId: "north", label: "Avg Morning Water", value: 0, icon: "drop" },
    { well: "North Well", wellId: "north", label: "Avg Evening Water", value: 0, icon: "drop-alt" },
    { well: "North Well", wellId: "north", label: "Total Pumped Out", value: 0, icon: "pump" },
    { well: "North Well", wellId: "north", label: "Total Recharged", value: 0, icon: "recharge" },
    { well: "South Well", wellId: "south", label: "Avg Morning Water", value: 0, icon: "drop" },
    { well: "South Well", wellId: "south", label: "Avg Evening Water", value: 0, icon: "drop-alt" },
    { well: "South Well", wellId: "south", label: "Total Pumped Out", value: 0, icon: "pump" },
    { well: "South Well", wellId: "south", label: "Total Recharged", value: 0, icon: "recharge" },
  ],
  totalReadings: 0,
  latestReadingDate: "--",
}

export const seriesConfig = [
  { key: "morningWater", label: "Morning Water", color: "var(--chart-1)" },
  { key: "eveningWater", label: "Evening Water", color: "var(--chart-2)" },
  { key: "pumpedOut", label: "Pumped Out", color: "var(--chart-3)" },
  { key: "recharged", label: "Recharged", color: "var(--chart-4)" },
] as const

export function formatNumberIN(num: number): string {
  return num.toLocaleString("en-IN")
}

function formatCapacity(liters: number | null | undefined): string {
  if (!liters) return "--"
  return `${formatNumberIN(liters)} litres`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "--"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTableDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function waterAvailableLiters(row: WellDashboardRow): number | null {
  const method = row.calculation_method ?? CAPACITY_MINUS_TAPE

  if (method === REMAINING_COLUMN_CAPPED) {
    if (!row.total_depth_inches || row.total_depth_inches <= 0) return null
    const remainingWaterInches = row.total_depth_inches - row.total_inches
    const rawLiters = remainingWaterInches * row.liters_per_inch
    return Math.min(row.capacity_liters, Math.max(0, rawLiters))
  }

  // Confirmed for North Well: readings are depth from the reference point
  // down to the water surface.
  const rawLiters = row.capacity_liters - row.total_inches * row.liters_per_inch
  return rawLiters < 0 ? null : rawLiters
}

function waterDisplay(row: WellDashboardRow): string {
  const availableWater = waterAvailableLiters(row)
  if (availableWater === null) return SOUTH_WELL_CONFIGURATION_WARNING
  return formatNumberIN(Math.round(availableWater))
}

function optionalWaterDisplay(row: WellDashboardRow | undefined): string {
  if (!row) return "--"
  return waterDisplay(row)
}

function average(values: Array<number | null>): number {
  const validValues = values.filter((value): value is number => value !== null)
  if (validValues.length === 0) return 0
  return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length)
}

function toDailyRecords(rows: WellDashboardRow[]): WellDailyRecord[] {
  const rowsByDate = new Map<string, WellDashboardRow[]>()

  for (const row of rows) {
    const dayRows = rowsByDate.get(row.reading_date) ?? []
    dayRows.push(row)
    rowsByDate.set(row.reading_date, dayRows)
  }

  return Array.from(rowsByDate.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, dayRows]) => {
      const sortedRows = [...dayRows].sort((a, b) => {
        const timeCompare = a.reading_time.localeCompare(b.reading_time)
        if (timeCompare !== 0) return timeCompare
        return a.reading_id - b.reading_id
      })

      const morningRow = sortedRows[0]
      const eveningRow = sortedRows.length >= 2 ? sortedRows.at(-1) : undefined
      const morningWater = waterAvailableLiters(morningRow)
      const eveningWater = eveningRow ? waterAvailableLiters(eveningRow) : null
      const hasCompletePair = sortedRows.length >= 2 && morningWater !== null && eveningWater !== null
      const pumpedOut = hasCompletePair && morningWater > eveningWater ? morningWater - eveningWater : null
      const recharged = hasCompletePair && eveningWater > morningWater ? eveningWater - morningWater : null
      const configurationWarning =
        morningWater === null || (eveningRow && eveningWater === null)
          ? SOUTH_WELL_CONFIGURATION_WARNING
          : undefined

      return {
        date: formatTableDate(date),
        morningWater,
        eveningWater,
        morningWaterDisplay: waterDisplay(morningRow),
        eveningWaterDisplay: optionalWaterDisplay(eveningRow),
        waterPumpedOut: pumpedOut,
        rechargedSinceYesterday: recharged,
        remarks: configurationWarning ? SOUTH_WELL_CONFIGURATION_WARNING : "Live Data",
        configurationWarning,
      }
    })
}

function capacityFromRows(rows: WellDashboardRow[]): string {
  return formatCapacity(rows[0]?.capacity_liters)
}

function buildStats(wellId: WellId, records: WellDailyRecord[]): SummaryStat[] {
  const well = WELL_NAME_BY_ID[wellId]
  const warning = records.some((record) => record.configurationWarning)
    ? SOUTH_WELL_CONFIGURATION_WARNING
    : undefined
  return [
    {
      well,
      wellId,
      label: "Avg Morning Water",
      value: warning && records.every((record) => record.morningWater === null) ? null : average(records.map((record) => record.morningWater)),
      icon: "drop",
      warning,
    },
    {
      well,
      wellId,
      label: "Avg Evening Water",
      value: warning && records.every((record) => record.eveningWater === null) ? null : average(records.map((record) => record.eveningWater)),
      icon: "drop-alt",
      warning,
    },
    {
      well,
      wellId,
      label: "Total Pumped Out",
      value: warning && records.every((record) => record.waterPumpedOut === null)
        ? null
        : records.reduce((sum, record) => sum + (record.waterPumpedOut ?? 0), 0),
      icon: "pump",
      warning,
    },
    {
      well,
      wellId,
      label: "Total Recharged",
      value: warning && records.every((record) => record.rechargedSinceYesterday === null)
        ? null
        : records.reduce((sum, record) => sum + (record.rechargedSinceYesterday ?? 0), 0),
      icon: "recharge",
      warning,
    },
  ]
}

export function buildWellDashboardData(payload: WellDashboardResponse): WellDashboardData {
  const northWellRecords = toDailyRecords(payload.north_rows ?? [])
  const southWellRecords = toDailyRecords(payload.south_rows ?? [])

  return {
    northWellRecords,
    southWellRecords,
    wellCapacity: {
      north: capacityFromRows(payload.north_rows ?? []),
      south: capacityFromRows(payload.south_rows ?? []),
    },
    summaryStats: [...buildStats(WELL_ID_BY_CODE.well1, northWellRecords), ...buildStats(WELL_ID_BY_CODE.well2, southWellRecords)],
    totalReadings: payload.summary?.total_readings ?? 0,
    latestReadingDate: formatDate(payload.summary?.latest_reading_date),
  }
}

// Chart data is ordered oldest -> newest (left to right on the x-axis)
export function toChartData(records: WellDailyRecord[]): ChartPoint[] {
  return [...records]
    .reverse()
    .map((record) => ({
      date: record.date,
      morningWater: record.morningWater,
      eveningWater: record.eveningWater,
      pumpedOut: record.waterPumpedOut,
      recharged: record.rechargedSinceYesterday,
    }))
}
