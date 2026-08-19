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
    first_entry_date: string | null
    latest_entry_date: string | null
  }
  recordsByMotor: Record<MotorId, MotorDailyRecord[]>
  summaryStats: MotorSummaryStat[]
  statusCards: MotorStatus[]
  chartData: MotorChartPoint[]
  irrigationTrend: MotorIrrigationTrendPoint[]
  valveGroups: ValveGroup[]
}

export const emptyMotorDashboardData: MotorDashboardData = {
  summary: { total_entries: 0, first_entry_date: null, latest_entry_date: null },
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
}

export const motorSeriesConfig = [
  { key: "M1", label: "Motor 1", color: "var(--chart-1)" },
  { key: "M2", label: "Motor 2", color: "var(--chart-3)" },
  { key: "M3", label: "Motor 3", color: "var(--chart-2)" },
] as const
