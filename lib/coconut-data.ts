// Mock data for the Coconut Harvest dashboard. No backend — all figures are static.

export interface CoconutSummary {
  label: string
  value: string
  sublabel: string
  icon: "nut" | "trees" | "scale" | "cycle"
}

export const coconutSummary: CoconutSummary[] = [
  { label: "Nuts This Cycle", value: "18,420", sublabel: "45-day cycle", icon: "nut" },
  { label: "Total Palms", value: "1,240", sublabel: "Bearing trees", icon: "trees" },
  { label: "Avg Nuts / Palm", value: "14.9", sublabel: "This cycle", icon: "cycle" },
  { label: "Copra Yield", value: "2,180 kg", sublabel: "Estimated", icon: "scale" },
]

export interface HarvestCycle {
  cycle: string
  dateRange: string
  nuts: number
  avgPerPalm: number
  grade: string
}

export const harvestCycles: HarvestCycle[] = [
  { cycle: "Cycle 8 / 2026", dateRange: "22 Jun - 06 Jul", nuts: 18420, avgPerPalm: 14.9, grade: "A" },
  { cycle: "Cycle 7 / 2026", dateRange: "08 May - 21 Jun", nuts: 17650, avgPerPalm: 14.2, grade: "A" },
  { cycle: "Cycle 6 / 2026", dateRange: "24 Apr - 07 May", nuts: 16980, avgPerPalm: 13.7, grade: "B" },
  { cycle: "Cycle 5 / 2026", dateRange: "10 Mar - 23 Apr", nuts: 17240, avgPerPalm: 13.9, grade: "A" },
  { cycle: "Cycle 4 / 2026", dateRange: "25 Jan - 09 Mar", nuts: 16110, avgPerPalm: 13.0, grade: "B" },
]

export interface TreePerformance {
  block: string
  palms: number
  nuts: number
  avgPerPalm: number
  status: "Excellent" | "Good" | "Average" | "Low"
}

export const treePerformance: TreePerformance[] = [
  { block: "Block A - Plot 1 East", palms: 320, nuts: 5120, avgPerPalm: 16.0, status: "Excellent" },
  { block: "Block B - Plot 1 West", palms: 300, nuts: 4380, avgPerPalm: 14.6, status: "Good" },
  { block: "Block C - Plot 2 East", palms: 340, nuts: 4760, avgPerPalm: 14.0, status: "Good" },
  { block: "Block D - Plot 2 West", palms: 280, nuts: 4160, avgPerPalm: 14.9, status: "Good" },
]

export interface HarvestRecord {
  date: string
  block: string
  nuts: number
  weightKg: number
  grade: string
  remarks: string
}

export const recentHarvest: HarvestRecord[] = [
  { date: "06-07-2026", block: "Block A - Plot 1 East", nuts: 1320, weightKg: 1584, grade: "A", remarks: "Normal" },
  { date: "05-07-2026", block: "Block B - Plot 1 West", nuts: 1180, weightKg: 1416, grade: "A", remarks: "Normal" },
  { date: "04-07-2026", block: "Block C - Plot 2 East", nuts: 1240, weightKg: 1488, grade: "B", remarks: "Some immature" },
  { date: "03-07-2026", block: "Block D - Plot 2 West", nuts: 1090, weightKg: 1308, grade: "A", remarks: "Normal" },
  { date: "02-07-2026", block: "Block A - Plot 1 East", nuts: 1360, weightKg: 1632, grade: "A", remarks: "Normal" },
]

export interface CoconutTrendPoint {
  cycle: string
  nuts: number
}

// Oldest -> newest for left-to-right chart
export const coconutTrend: CoconutTrendPoint[] = [
  { cycle: "C4", nuts: 16110 },
  { cycle: "C5", nuts: 17240 },
  { cycle: "C6", nuts: 16980 },
  { cycle: "C7", nuts: 17650 },
  { cycle: "C8", nuts: 18420 },
]
