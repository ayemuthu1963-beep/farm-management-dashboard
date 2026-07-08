// Mock data for the Motor Runtime dashboard. No backend — all figures are static.
// Runtime is in hours, energy in kWh (units), flow in Lacs Litres.

export type MotorId = "M1" | "M2" | "M3"

export interface MotorInfo {
  id: MotorId
  name: string
  well: string
  power: string
  connectionNo: string
  status: "Running" | "Idle" | "Maintenance"
  statusColor: string
}

export interface MotorDailyRecord {
  date: string
  relativeLabel: string
  runHours: number
  starts: number
  energyUnits: number
  waterLifted: number
  remarks: string
}

export interface MotorStatus {
  id: MotorId
  name: string
  well: string
  status: MotorInfo["status"]
  runHoursToday: number
  lastStart: string
}

export interface MotorSummaryStat {
  motor: string
  motorId: MotorId
  label: string
  value: number
  unit: string
  icon: "clock" | "power" | "starts" | "water"
}

// Motor specification table
export const motorInfo: MotorInfo[] = [
  {
    id: "M1",
    name: "M1 - North Well",
    well: "Well 1 - North",
    power: "12.5 / 10 HP",
    connectionNo: "78",
    status: "Running",
    statusColor: "bg-chart-2",
  },
  {
    id: "M2",
    name: "M2 - North Well",
    well: "Well 1 - North",
    power: "10 HP",
    connectionNo: "197",
    status: "Idle",
    statusColor: "bg-muted-foreground",
  },
  {
    id: "M3",
    name: "M3 - South Well",
    well: "Well 2 - South",
    power: "10 HP",
    connectionNo: "199",
    status: "Running",
    statusColor: "bg-chart-2",
  },
]

// Current-status cards
export const motorStatuses: MotorStatus[] = [
  { id: "M1", name: "Motor M1", well: "North Well", status: "Running", runHoursToday: 4.5, lastStart: "06:10 AM" },
  { id: "M2", name: "Motor M2", well: "North Well", status: "Idle", runHoursToday: 1.2, lastStart: "05:00 AM" },
  { id: "M3", name: "Motor M3", well: "South Well", status: "Running", runHoursToday: 3.8, lastStart: "06:30 AM" },
]

// Daily runtime records — most recent day first (matches table order)
export const m1Records: MotorDailyRecord[] = [
  { date: "06-07-2026", relativeLabel: "Today - 1", runHours: 6.5, starts: 4, energyUnits: 58.2, waterLifted: 2.7, remarks: "Normal" },
  { date: "05-07-2026", relativeLabel: "Today - 2", runHours: 6.8, starts: 5, energyUnits: 60.5, waterLifted: 2.9, remarks: "Normal" },
  { date: "04-07-2026", relativeLabel: "Today - 3", runHours: 6.2, starts: 4, energyUnits: 55.4, waterLifted: 2.6, remarks: "Slight Rain" },
  { date: "03-07-2026", relativeLabel: "Today - 4", runHours: 6.1, starts: 3, energyUnits: 54.1, waterLifted: 2.6, remarks: "Normal" },
  { date: "02-07-2026", relativeLabel: "Today - 5", runHours: 5.7, starts: 3, energyUnits: 50.8, waterLifted: 2.4, remarks: "Normal" },
]

export const m2Records: MotorDailyRecord[] = [
  { date: "06-07-2026", relativeLabel: "Today - 1", runHours: 3.2, starts: 2, energyUnits: 24.6, waterLifted: 1.3, remarks: "Normal" },
  { date: "05-07-2026", relativeLabel: "Today - 2", runHours: 2.8, starts: 2, energyUnits: 21.4, waterLifted: 1.1, remarks: "Standby" },
  { date: "04-07-2026", relativeLabel: "Today - 3", runHours: 3.0, starts: 3, energyUnits: 23.0, waterLifted: 1.2, remarks: "Normal" },
  { date: "03-07-2026", relativeLabel: "Today - 4", runHours: 2.6, starts: 2, energyUnits: 19.9, waterLifted: 1.0, remarks: "Normal" },
  { date: "02-07-2026", relativeLabel: "Today - 5", runHours: 2.4, starts: 1, energyUnits: 18.3, waterLifted: 0.9, remarks: "Normal" },
]

export const m3Records: MotorDailyRecord[] = [
  { date: "06-07-2026", relativeLabel: "Today - 1", runHours: 5.4, starts: 3, energyUnits: 41.2, waterLifted: 2.7, remarks: "Normal" },
  { date: "05-07-2026", relativeLabel: "Today - 2", runHours: 5.6, starts: 4, energyUnits: 42.7, waterLifted: 2.8, remarks: "Normal" },
  { date: "04-07-2026", relativeLabel: "Today - 3", runHours: 5.3, starts: 3, energyUnits: 40.4, waterLifted: 2.7, remarks: "Normal" },
  { date: "03-07-2026", relativeLabel: "Today - 4", runHours: 5.2, starts: 3, energyUnits: 39.6, waterLifted: 2.7, remarks: "Light Rain" },
  { date: "02-07-2026", relativeLabel: "Today - 5", runHours: 4.9, starts: 2, energyUnits: 37.3, waterLifted: 2.5, remarks: "Normal" },
]

// Summary stats for the selected period
export const motorSummaryStats: MotorSummaryStat[] = [
  { motor: "Motor M1", motorId: "M1", label: "Total Run Hours", value: 31.3, unit: "Hours", icon: "clock" },
  { motor: "Motor M1", motorId: "M1", label: "Total Energy", value: 279.0, unit: "Units", icon: "power" },
  { motor: "Motor M2", motorId: "M2", label: "Total Run Hours", value: 14.0, unit: "Hours", icon: "clock" },
  { motor: "Motor M2", motorId: "M2", label: "Total Energy", value: 103.2, unit: "Units", icon: "power" },
  { motor: "Motor M3", motorId: "M3", label: "Total Run Hours", value: 26.4, unit: "Hours", icon: "clock" },
  { motor: "Motor M3", motorId: "M3", label: "Total Energy", value: 201.2, unit: "Units", icon: "power" },
  { motor: "All Motors", motorId: "M1", label: "Total Starts", value: 51, unit: "Cycles", icon: "starts" },
  { motor: "All Motors", motorId: "M1", label: "Total Water Lifted", value: 34.0, unit: "Lacs Litres", icon: "water" },
]

export interface MotorChartPoint {
  date: string
  M1: number
  M2: number
  M3: number
}

// Chart data ordered oldest -> newest (left to right)
export function toRuntimeChartData(): MotorChartPoint[] {
  const dates = [...m1Records].reverse().map((r) => r.date)
  const m1 = [...m1Records].reverse()
  const m2 = [...m2Records].reverse()
  const m3 = [...m3Records].reverse()
  return dates.map((date, i) => ({
    date,
    M1: m1[i].runHours,
    M2: m2[i].runHours,
    M3: m3[i].runHours,
  }))
}

export const motorSeriesConfig = [
  { key: "M1", label: "Motor M1", color: "var(--chart-1)" },
  { key: "M2", label: "Motor M2", color: "var(--chart-3)" },
  { key: "M3", label: "Motor M3", color: "var(--chart-2)" },
] as const

export const motorRecordsById: Record<MotorId, MotorDailyRecord[]> = {
  M1: m1Records,
  M2: m2Records,
  M3: m3Records,
}
