// ============================================================================
// WELL WATER DASHBOARD DATA CONTRACT
// The backend daily rows are authoritative for water volume, motor-pumped water,
// and the difference between consecutive calendar-date morning readings.
// The frontend formats values but does not recalculate
// well-water business logic.
// ============================================================================

export type WellId = "north" | "south"
export type WellCode = "well1" | "well2"
type NumericApiValue = number | string

export interface WellDailyApiRow {
  date: string
  well_id: WellId
  well_code: WellCode
  well_name: string
  morning_water_liters: NumericApiValue | null
  evening_water_liters: NumericApiValue | null
  motor_runtime_minutes: NumericApiValue
  water_pumped_out_liters: NumericApiValue | null
  observed_storage_change_liters: NumericApiValue | null
  difference_in_morning_readings_litres: NumericApiValue | null
  remarks: string
  reading_count: number
  morning_reading_id: number | null
  evening_reading_id: number | null
  capacity_liters: NumericApiValue | null
  liters_per_inch: NumericApiValue | null
  calculation_method: string | null
}

export interface WellDashboardResponse {
  summary: {
    total_readings: number
    first_reading_date: string | null
    latest_reading_date: string | null
    selected_start_date?: string
    selected_end_date?: string
    calendar_days?: number
  }
  daily_rows?: WellDailyApiRow[]
  north_rows: WellDailyApiRow[]
  south_rows: WellDailyApiRow[]
}

export interface WellDailyRecord {
  date: string
  morningWater: number | null
  eveningWater: number | null
  morningWaterDisplay: string
  eveningWaterDisplay: string
  motorRuntimeMinutes: number
  waterPumpedOut: number | null
  observedStorageChange: number | null
  differenceInMorningReadings: number | null
  remarks: string
  configurationWarning?: string
}

export interface SummaryStat {
  well: string
  wellId: WellId | "both"
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
}

export const SOUTH_WELL_CONFIGURATION_WARNING = "Configuration requires verification"

export const emptyWellDashboardData: WellDashboardData = {
  northWellRecords: [],
  southWellRecords: [],
  wellCapacity: {
    north: "--",
    south: "--",
  },
  summaryStats: [
    { well: "North Well", wellId: "north", label: "Total Pumped Out", value: 0, icon: "pump" },
    { well: "South Well", wellId: "south", label: "Total Pumped Out", value: 0, icon: "pump" },
    { well: "Both Wells", wellId: "both", label: "Total Pumped Out", value: 0, icon: "pump" },
  ],
  totalReadings: 0,
  latestReadingDate: "--",
}

export const seriesConfig = [
  { key: "morningWater", label: "Morning Water", color: "var(--chart-1)" },
  { key: "eveningWater", label: "Evening Water", color: "var(--chart-2)" },
  { key: "pumpedOut", label: "Pumped Out", color: "var(--chart-3)" },
] as const

export function formatNumberIN(num: number): string {
  return num.toLocaleString("en-IN")
}

function toNullableFiniteNumber(value: NumericApiValue | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const numericValue = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

export function formatLitresAxisTick(value: unknown): string {
  const numericValue =
    typeof value === "number" || typeof value === "string"
      ? toNullableFiniteNumber(value)
      : null
  if (numericValue === null) return ""
  const roundedValue = Math.round(numericValue)
  return roundedValue === 0 ? "0" : `${formatNumberIN(roundedValue)} L`
}

export function includeZeroInWellChartDomain(
  [rawMinimum, rawMaximum]: readonly [number, number],
): [number, number] {
  const minimum = Number.isFinite(rawMinimum) ? rawMinimum : 0
  const maximum = Number.isFinite(rawMaximum) ? rawMaximum : 0
  return [Math.min(0, minimum), Math.max(0, maximum)]
}

export function formatSignedLitres(value: number | null, includeUnit = false): string {
  if (value === null) return "—"
  const rounded = Math.round(value)
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : ""
  return `${sign}${formatNumberIN(Math.abs(rounded))}${includeUnit ? " L" : ""}`
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

function waterDisplay(value: number | null): string {
  if (value === null) return "—"
  return formatNumberIN(Math.round(value))
}

function sumAvailable(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => value !== null)
  if (validValues.length === 0) return null
  return validValues.reduce((sum, value) => sum + value, 0)
}

function toDailyRecord(row: WellDailyApiRow): WellDailyRecord {
  const configurationWarning =
    row.remarks === SOUTH_WELL_CONFIGURATION_WARNING
      ? SOUTH_WELL_CONFIGURATION_WARNING
      : undefined
  const morningWater = toNullableFiniteNumber(row.morning_water_liters)
  const eveningWater = toNullableFiniteNumber(row.evening_water_liters)

  return {
    date: formatTableDate(row.date),
    morningWater,
    eveningWater,
    morningWaterDisplay: waterDisplay(morningWater),
    eveningWaterDisplay: waterDisplay(eveningWater),
    motorRuntimeMinutes: toNullableFiniteNumber(row.motor_runtime_minutes) ?? 0,
    waterPumpedOut: toNullableFiniteNumber(row.water_pumped_out_liters),
    observedStorageChange: toNullableFiniteNumber(row.observed_storage_change_liters),
    differenceInMorningReadings: toNullableFiniteNumber(row.difference_in_morning_readings_litres),
    remarks: row.remarks,
    configurationWarning,
  }
}

function capacityFromRows(rows: WellDailyApiRow[]): string {
  return formatCapacity(
    toNullableFiniteNumber(rows.find((row) => row.capacity_liters)?.capacity_liters),
  )
}

function buildPumpedOutStats(
  northRecords: WellDailyRecord[],
  southRecords: WellDailyRecord[],
): SummaryStat[] {
  return [
    {
      well: "North Well",
      wellId: "north",
      label: "Total Pumped Out",
      value: sumAvailable(northRecords.map((record) => record.waterPumpedOut)),
      icon: "pump",
      warning: "Unavailable",
    },
    {
      well: "South Well",
      wellId: "south",
      label: "Total Pumped Out",
      value: sumAvailable(southRecords.map((record) => record.waterPumpedOut)),
      icon: "pump",
      warning: "Unavailable",
    },
    {
      well: "Both Wells",
      wellId: "both",
      label: "Total Pumped Out",
      value: sumAvailable(
        [...northRecords, ...southRecords].map((record) => record.waterPumpedOut),
      ),
      icon: "pump",
      warning: "Unavailable",
    },
  ]
}

export function buildWellDashboardData(payload: WellDashboardResponse): WellDashboardData {
  const dailyRows = payload.daily_rows ?? [...(payload.north_rows ?? []), ...(payload.south_rows ?? [])]
  const northRows = dailyRows.filter((row) => row.well_id === "north" || row.well_code === "well1")
  const southRows = dailyRows.filter((row) => row.well_id === "south" || row.well_code === "well2")
  const northWellRecords = northRows.map(toDailyRecord)
  const southWellRecords = southRows.map(toDailyRecord)

  return {
    northWellRecords,
    southWellRecords,
    wellCapacity: {
      north: capacityFromRows(northRows),
      south: capacityFromRows(southRows),
    },
    summaryStats: buildPumpedOutStats(northWellRecords, southWellRecords),
    totalReadings: payload.summary?.total_readings ?? 0,
    latestReadingDate: formatDate(payload.summary?.latest_reading_date),
  }
}

// Chart data is ordered oldest -> newest (left to right on the x-axis).
export function toChartData(records: WellDailyRecord[]): ChartPoint[] {
  return [...records]
    .reverse()
    .map((record) => ({
      date: record.date,
      morningWater: record.morningWater,
      eveningWater: record.eveningWater,
      pumpedOut: record.waterPumpedOut,
    }))
}

function escapeCsv(value: string | number | null): string {
  const text = value === null ? "" : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function buildWellWaterCsv(data: WellDashboardData): string {
  const header = [
    "Well",
    "Date",
    "Morning Water (Litres)",
    "Evening Water (Litres)",
    "Water Pumped Out (Litres)",
    "Difference in Morning Readings (Litres)",
    "Remarks",
  ]
  const rows = ([
    ["North Well", data.northWellRecords],
    ["South Well", data.southWellRecords],
  ] as const).flatMap(([well, records]) =>
    records.map((record) => [
      well,
      record.date,
      record.morningWater,
      record.eveningWater,
      record.waterPumpedOut,
      record.differenceInMorningReadings,
      record.remarks,
    ]),
  )
  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")
}
