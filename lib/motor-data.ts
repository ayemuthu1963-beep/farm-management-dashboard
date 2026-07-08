// Mock data for the Motor Runtime dashboard. No backend — all figures are static.
// Runtime is in hours, energy in kWh (units), flow in Litres.

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
  { date: "06-07-2026", runHours: 6.5, starts: 4, energyUnits: 58.2, waterLifted: 2.7, remarks: "Normal" },
  { date: "05-07-2026", runHours: 6.8, starts: 5, energyUnits: 60.5, waterLifted: 2.9, remarks: "Normal" },
  { date: "04-07-2026", runHours: 6.2, starts: 4, energyUnits: 55.4, waterLifted: 2.6, remarks: "Slight Rain" },
  { date: "03-07-2026", runHours: 6.1, starts: 3, energyUnits: 54.1, waterLifted: 2.6, remarks: "Normal" },
  { date: "02-07-2026", runHours: 5.7, starts: 3, energyUnits: 50.8, waterLifted: 2.4, remarks: "Normal" },
]

export const m2Records: MotorDailyRecord[] = [
  { date: "06-07-2026", runHours: 3.2, starts: 2, energyUnits: 24.6, waterLifted: 1.3, remarks: "Normal" },
  { date: "05-07-2026", runHours: 2.8, starts: 2, energyUnits: 21.4, waterLifted: 1.1, remarks: "Standby" },
  { date: "04-07-2026", runHours: 3.0, starts: 3, energyUnits: 23.0, waterLifted: 1.2, remarks: "Normal" },
  { date: "03-07-2026", runHours: 2.6, starts: 2, energyUnits: 19.9, waterLifted: 1.0, remarks: "Normal" },
  { date: "02-07-2026", runHours: 2.4, starts: 1, energyUnits: 18.3, waterLifted: 0.9, remarks: "Normal" },
]

export const m3Records: MotorDailyRecord[] = [
  { date: "06-07-2026", runHours: 5.4, starts: 3, energyUnits: 41.2, waterLifted: 2.7, remarks: "Normal" },
  { date: "05-07-2026", runHours: 5.6, starts: 4, energyUnits: 42.7, waterLifted: 2.8, remarks: "Normal" },
  { date: "04-07-2026", runHours: 5.3, starts: 3, energyUnits: 40.4, waterLifted: 2.7, remarks: "Normal" },
  { date: "03-07-2026", runHours: 5.2, starts: 3, energyUnits: 39.6, waterLifted: 2.7, remarks: "Light Rain" },
  { date: "02-07-2026", runHours: 4.9, starts: 2, energyUnits: 37.3, waterLifted: 2.5, remarks: "Normal" },
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

// ---------------------------------------------------------------------------
// Valves opened / closed log (sample day). No backend — static mock data.
// Motor 1 & Motor 2 share valves 1-6; Motor 3 uses valves 7-9.
// ---------------------------------------------------------------------------
export interface ValveRecord {
  valve: string
  area: string
  openedTime: string
  closedTime: string
  runtime: string
  remarks: string
}

export interface ValveGroup {
  /** which motor(s) feed this set of valves */
  motors: string
  valves: ValveRecord[]
}

export const valveGroups: ValveGroup[] = [
  {
    motors: "Motor 1 & Motor 2",
    valves: [
      { valve: "Valve 1", area: "Plot 2 East", openedTime: "06:10 AM", closedTime: "07:25 AM", runtime: "1h 15m", remarks: "Normal" },
      { valve: "Valve 2", area: "Plot 2 West", openedTime: "07:25 AM", closedTime: "08:30 AM", runtime: "1h 05m", remarks: "Normal" },
      { valve: "Valve 3", area: "Plot 1 East", openedTime: "08:30 AM", closedTime: "09:40 AM", runtime: "1h 10m", remarks: "Normal" },
      { valve: "Valve 4", area: "Plot 1 West", openedTime: "09:40 AM", closedTime: "10:35 AM", runtime: "0h 55m", remarks: "Low pressure" },
      { valve: "Valve 5", area: "Nutmeg", openedTime: "10:35 AM", closedTime: "11:20 AM", runtime: "0h 45m", remarks: "Normal" },
      { valve: "Valve 6", area: "Jackfruit", openedTime: "11:20 AM", closedTime: "12:05 PM", runtime: "0h 45m", remarks: "Normal" },
    ],
  },
  {
    motors: "Motor 3",
    valves: [
      { valve: "Valve 7", area: "Plot 2 East", openedTime: "06:30 AM", closedTime: "07:50 AM", runtime: "1h 20m", remarks: "Normal" },
      { valve: "Valve 8", area: "Plot 2 West", openedTime: "07:50 AM", closedTime: "09:05 AM", runtime: "1h 15m", remarks: "Normal" },
      { valve: "Valve 9", area: "Jackfruit", openedTime: "09:05 AM", closedTime: "10:00 AM", runtime: "0h 55m", remarks: "Normal" },
    ],
  },
]
