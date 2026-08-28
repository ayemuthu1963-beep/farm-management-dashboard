export type MotorId = "M1" | "M2" | "M3"

export interface MotorStatus {
  id: MotorId
  name: string
  well: string
  status: "Running" | "Idle" | "Maintenance"
  runHoursToday: number
  lastStart: string
}

export interface MotorDailyRecord {
  date: string
  runHours: number
  starts: number
  energyUnits: number
  waterLifted: number
  remarks: string
  plot?: string
  valve?: string
  source?: string
  status?: "Not Run"
}

export interface PublicMotorNoRunRecord {
  date: string
  motorId: MotorId
  motorName: string
  status: "Not Run"
  reason: string
  runtime: "0 minutes"
  water: "0 L"
}

export interface MeasuredMotorRuntimeDay {
  date: string
  motorId: MotorId
}

export function noRunsWithoutMeasuredRuntime(
  records: readonly PublicMotorNoRunRecord[],
  measuredDays: readonly MeasuredMotorRuntimeDay[],
): PublicMotorNoRunRecord[] {
  const measuredMotorDates = new Set(measuredDays.map(({ date, motorId }) => `${motorId}:${date}`))
  return records.filter((record) => !measuredMotorDates.has(`${record.motorId}:${record.date}`))
}

const PUBLIC_MOTOR_NAMES: Record<MotorId, string> = {
  M1: "Motor 1",
  M2: "Motor 2",
  M3: "Motor 3",
}

const PUBLIC_MOTOR_IDS: Record<string, MotorId | undefined> = {
  "motor-1": "M1",
  "motor-2": "M2",
  "motor-3": "M3",
}

export function projectPublicMotorNoRunRecords(records: readonly unknown[]): PublicMotorNoRunRecord[] {
  return records.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return []
    const record = candidate as Record<string, unknown>
    const motorId = typeof record.motor_id === "string" ? PUBLIC_MOTOR_IDS[record.motor_id] : undefined
    if (
      !motorId ||
      typeof record.operation_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.operation_date) ||
      record.status !== "Not Run" ||
      typeof record.reason !== "string" ||
      !record.reason.trim() ||
      record.voided_at != null
    ) return []

    return [{
      date: record.operation_date,
      motorId,
      motorName: PUBLIC_MOTOR_NAMES[motorId],
      status: "Not Run" as const,
      reason: record.reason.trim(),
      runtime: "0 minutes" as const,
      water: "0 L" as const,
    }]
  })
}

export interface MotorSummaryStat {
  motor: string
  motorId: MotorId
  label: string
  value: number
  unit: string
  icon: "clock" | "power" | "starts" | "water"
}

export interface MotorChartPoint {
  date: string
  M1: number | null
  M2: number | null
  M3: number | null
}

export interface MotorIrrigationTrendPoint {
  date: string
  totalRuntimeHours: number | null
  totalWaterLitres: number | null
}

export interface ValveRecord {
  date: string
  motorNo: string
  valve: string
  area: string
  runtime: string
  remarks: string
}

export interface ValveGroup {
  motors: string
  valves: ValveRecord[]
}

export interface MotorDashboardData {
  summary: {
    total_entries: number
    confirmed_no_run_count: number
    first_entry_date: string | null
    latest_entry_date: string | null
  }
  recordsByMotor: Record<MotorId, MotorDailyRecord[]>
  summaryStats: MotorSummaryStat[]
  statusCards: MotorStatus[]
  chartData: MotorChartPoint[]
  irrigationTrend: MotorIrrigationTrendPoint[]
  valveGroups: ValveGroup[]
  noRunRecords: PublicMotorNoRunRecord[]
}

export const emptyMotorDashboardData: MotorDashboardData = {
  summary: { total_entries: 0, confirmed_no_run_count: 0, first_entry_date: null, latest_entry_date: null },
  recordsByMotor: { M1: [], M2: [], M3: [] },
  summaryStats: [
    { motor: "Motor 1", motorId: "M1", label: "Total Run Hours", value: 0, unit: "Hours", icon: "clock" },
    { motor: "Motor 1", motorId: "M1", label: "Total Starts", value: 0, unit: "Cycles", icon: "starts" },
    { motor: "Motor 1", motorId: "M1", label: "Total Water Pumped", value: 0, unit: "Litres", icon: "water" },
    { motor: "Motor 2", motorId: "M2", label: "Total Run Hours", value: 0, unit: "Hours", icon: "clock" },
    { motor: "Motor 2", motorId: "M2", label: "Total Starts", value: 0, unit: "Cycles", icon: "starts" },
    { motor: "Motor 2", motorId: "M2", label: "Total Water Pumped", value: 0, unit: "Litres", icon: "water" },
    { motor: "Motor 3", motorId: "M3", label: "Total Run Hours", value: 0, unit: "Hours", icon: "clock" },
    { motor: "Motor 3", motorId: "M3", label: "Total Starts", value: 0, unit: "Cycles", icon: "starts" },
    { motor: "Motor 3", motorId: "M3", label: "Total Water Pumped", value: 0, unit: "Litres", icon: "water" },
  ],
  statusCards: [
    { id: "M1", name: "Motor 1", well: "Well 1 - North", status: "Idle", runHoursToday: 0, lastStart: "--" },
    { id: "M2", name: "Motor 2", well: "Well 1 - North", status: "Idle", runHoursToday: 0, lastStart: "--" },
    { id: "M3", name: "Motor 3", well: "Well 2 - South", status: "Idle", runHoursToday: 0, lastStart: "--" },
  ],
  chartData: [],
  irrigationTrend: [],
  valveGroups: [{ motors: "Recorded Motor Runtime Entries", valves: [] }],
  noRunRecords: [],
}

export const motorSeriesConfig = [
  { key: "M1", label: "Motor 1", color: "var(--chart-1)" },
  { key: "M2", label: "Motor 2", color: "var(--chart-3)" },
  { key: "M3", label: "Motor 3", color: "var(--chart-2)" },
] as const
