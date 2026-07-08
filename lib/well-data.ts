// Mock data for the Well Water dashboard. No backend — all figures are static.
// All water figures are in Litres.
//
// Future backend calculation rules (documented for Codex, NOT implemented here):
//   North Well: 1 inch = 1,650 litres
//   South Well: 1 inch = 1,300 litres
//   Pumped Out  = Morning reading - Evening reading
//   Recharged   = Evening reading - Next Morning reading

export type WellId = "north" | "south"

export interface WellDailyRecord {
  date: string
  morningWater: number
  eveningWater: number
  waterPumpedOut: number
  rechargedSinceYesterday: number
  remarks: string
}

export interface SummaryStat {
  well: string
  wellId: WellId
  label: string
  value: number
  icon: "drop" | "drop-alt" | "pump" | "recharge"
}

// Full storage capacity per well, shown beside each well heading.
// (Maximum water that can be taken from bottom to Pampari.)
export const wellCapacity: Record<WellId, string> = {
  north: "11,28,270 litres",
  south: "6,32,500 litres",
}

// North well — most recent day first (matches the table order in the design)
export const northWellRecords: WellDailyRecord[] = [
  {
    date: "06-07-2026",
    morningWater: 32.5,
    eveningWater: 29.8,
    waterPumpedOut: 2.7,
    rechargedSinceYesterday: 1.2,
    remarks: "Normal",
  },
  {
    date: "05-07-2026",
    morningWater: 31.3,
    eveningWater: 28.4,
    waterPumpedOut: 2.9,
    rechargedSinceYesterday: 0.9,
    remarks: "Normal",
  },
  {
    date: "04-07-2026",
    morningWater: 30.4,
    eveningWater: 27.8,
    waterPumpedOut: 2.6,
    rechargedSinceYesterday: 0.7,
    remarks: "Slight Rain",
  },
  {
    date: "03-07-2026",
    morningWater: 29.7,
    eveningWater: 27.1,
    waterPumpedOut: 2.6,
    rechargedSinceYesterday: 1.1,
    remarks: "Normal",
  },
  {
    date: "02-07-2026",
    morningWater: 28.6,
    eveningWater: 26.2,
    waterPumpedOut: 2.4,
    rechargedSinceYesterday: 0.8,
    remarks: "Normal",
  },
]

// South well — most recent day first
export const southWellRecords: WellDailyRecord[] = [
  {
    date: "06-07-2026",
    morningWater: 28.1,
    eveningWater: 25.4,
    waterPumpedOut: 2.7,
    rechargedSinceYesterday: 1.0,
    remarks: "Normal",
  },
  {
    date: "05-07-2026",
    morningWater: 27.1,
    eveningWater: 24.3,
    waterPumpedOut: 2.8,
    rechargedSinceYesterday: 0.6,
    remarks: "Normal",
  },
  {
    date: "04-07-2026",
    morningWater: 26.5,
    eveningWater: 23.8,
    waterPumpedOut: 2.7,
    rechargedSinceYesterday: 0.5,
    remarks: "Normal",
  },
  {
    date: "03-07-2026",
    morningWater: 26.0,
    eveningWater: 23.3,
    waterPumpedOut: 2.7,
    rechargedSinceYesterday: 0.8,
    remarks: "Light Rain",
  },
  {
    date: "02-07-2026",
    morningWater: 25.2,
    eveningWater: 22.7,
    waterPumpedOut: 2.5,
    rechargedSinceYesterday: 0.7,
    remarks: "Normal",
  },
]

// Summary stats for the selected period
export const summaryStats: SummaryStat[] = [
  { well: "North Well", wellId: "north", label: "Avg Morning Water", value: 30.1, icon: "drop" },
  { well: "North Well", wellId: "north", label: "Avg Evening Water", value: 27.86, icon: "drop-alt" },
  { well: "North Well", wellId: "north", label: "Total Pumped Out", value: 13.2, icon: "pump" },
  { well: "North Well", wellId: "north", label: "Total Recharged", value: 4.7, icon: "recharge" },
  { well: "South Well", wellId: "south", label: "Avg Morning Water", value: 26.18, icon: "drop" },
  { well: "South Well", wellId: "south", label: "Avg Evening Water", value: 23.5, icon: "drop-alt" },
  { well: "South Well", wellId: "south", label: "Total Pumped Out", value: 13.4, icon: "pump" },
  { well: "South Well", wellId: "south", label: "Total Recharged", value: 3.6, icon: "recharge" },
]

export interface ChartPoint {
  date: string
  morningWater: number
  eveningWater: number
  pumpedOut: number
  recharged: number
}

// Chart data is ordered oldest -> newest (left to right on the x-axis)
export function toChartData(records: WellDailyRecord[]): ChartPoint[] {
  return [...records]
    .reverse()
    .map((r) => ({
      date: r.date,
      morningWater: r.morningWater,
      eveningWater: r.eveningWater,
      pumpedOut: r.waterPumpedOut,
      recharged: r.rechargedSinceYesterday,
    }))
}

export const seriesConfig = [
  { key: "morningWater", label: "Morning Water", color: "var(--chart-1)" },
  { key: "eveningWater", label: "Evening Water", color: "var(--chart-2)" },
  { key: "pumpedOut", label: "Pumped Out", color: "var(--chart-3)" },
  { key: "recharged", label: "Recharged", color: "var(--chart-4)" },
] as const

export const todayDate = "06 Jul 2026"
export const todayTime = "08:15 AM"
