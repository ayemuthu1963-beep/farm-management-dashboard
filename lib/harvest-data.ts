// Mock data for the Coconut Harvest dashboard.
// No backend — replace these values with your real farm API/DB later.

export interface PlotStatus {
  id: string
  name: string
  variety: string
  trees: number
  readyToHarvest: number
  lastHarvest: string
  status: "Ready" | "Growing" | "Rested"
}

export const plotStatuses: PlotStatus[] = [
  {
    id: "plot-a",
    name: "Plot A - East Grove",
    variety: "East Coast Tall",
    trees: 420,
    readyToHarvest: 138,
    lastHarvest: "05-07-2026",
    status: "Ready",
  },
  {
    id: "plot-b",
    name: "Plot B - Canal Side",
    variety: "Dwarf Orange",
    trees: 310,
    readyToHarvest: 64,
    lastHarvest: "03-07-2026",
    status: "Growing",
  },
  {
    id: "plot-c",
    name: "Plot C - Hill Block",
    variety: "Hybrid T×D",
    trees: 260,
    readyToHarvest: 92,
    lastHarvest: "06-07-2026",
    status: "Ready",
  },
]

export interface PlotInfo {
  plot: string
  variety: string
  trees: number
  avgAgeYears: number
  spacing: string
}

export const plotInfo: PlotInfo[] = [
  { plot: "Plot A - East Grove", variety: "East Coast Tall", trees: 420, avgAgeYears: 18, spacing: "7.5 x 7.5 m" },
  { plot: "Plot B - Canal Side", variety: "Dwarf Orange", trees: 310, avgAgeYears: 9, spacing: "6.5 x 6.5 m" },
  { plot: "Plot C - Hill Block", variety: "Hybrid T×D", trees: 260, avgAgeYears: 12, spacing: "7.0 x 7.0 m" },
]

export interface HarvestDailyRecord {
  date: string
  relativeLabel: string
  nutsHarvested: number
  trees: number
  avgPerTree: number
  gradeARatio: number // percent
  remarks: string
}

// keyed by plot id
export const harvestLogByPlot: Record<string, HarvestDailyRecord[]> = {
  "plot-a": [
    { date: "06-07-2026", relativeLabel: "Today - 1", nutsHarvested: 1820, trees: 84, avgPerTree: 21.7, gradeARatio: 82, remarks: "Normal" },
    { date: "05-07-2026", relativeLabel: "Today - 2", nutsHarvested: 1710, trees: 80, avgPerTree: 21.4, gradeARatio: 80, remarks: "Normal" },
    { date: "04-07-2026", relativeLabel: "Today - 3", nutsHarvested: 1560, trees: 76, avgPerTree: 20.5, gradeARatio: 78, remarks: "Light Rain" },
    { date: "03-07-2026", relativeLabel: "Today - 4", nutsHarvested: 1640, trees: 78, avgPerTree: 21.0, gradeARatio: 81, remarks: "Normal" },
    { date: "02-07-2026", relativeLabel: "Today - 5", nutsHarvested: 1490, trees: 72, avgPerTree: 20.7, gradeARatio: 79, remarks: "Normal" },
  ],
  "plot-b": [
    { date: "06-07-2026", relativeLabel: "Today - 1", nutsHarvested: 980, trees: 52, avgPerTree: 18.8, gradeARatio: 74, remarks: "Normal" },
    { date: "05-07-2026", relativeLabel: "Today - 2", nutsHarvested: 1020, trees: 55, avgPerTree: 18.5, gradeARatio: 76, remarks: "Normal" },
    { date: "04-07-2026", relativeLabel: "Today - 3", nutsHarvested: 910, trees: 50, avgPerTree: 18.2, gradeARatio: 72, remarks: "Slight Rain" },
    { date: "03-07-2026", relativeLabel: "Today - 4", nutsHarvested: 960, trees: 51, avgPerTree: 18.8, gradeARatio: 75, remarks: "Normal" },
    { date: "02-07-2026", relativeLabel: "Today - 5", nutsHarvested: 890, trees: 48, avgPerTree: 18.5, gradeARatio: 73, remarks: "Normal" },
  ],
  "plot-c": [
    { date: "06-07-2026", relativeLabel: "Today - 1", nutsHarvested: 1340, trees: 60, avgPerTree: 22.3, gradeARatio: 85, remarks: "Normal" },
    { date: "05-07-2026", relativeLabel: "Today - 2", nutsHarvested: 1280, trees: 58, avgPerTree: 22.1, gradeARatio: 84, remarks: "Normal" },
    { date: "04-07-2026", relativeLabel: "Today - 3", nutsHarvested: 1190, trees: 55, avgPerTree: 21.6, gradeARatio: 82, remarks: "Normal" },
    { date: "03-07-2026", relativeLabel: "Today - 4", nutsHarvested: 1230, trees: 56, avgPerTree: 22.0, gradeARatio: 83, remarks: "Light Rain" },
    { date: "02-07-2026", relativeLabel: "Today - 5", nutsHarvested: 1150, trees: 53, avgPerTree: 21.7, gradeARatio: 81, remarks: "Normal" },
  ],
}

export const plotTabs = [
  { id: "plot-a", label: "Plot A" },
  { id: "plot-b", label: "Plot B" },
  { id: "plot-c", label: "Plot C" },
]

// Chart: total nuts harvested per day per plot
export interface HarvestChartPoint {
  date: string
  "Plot A": number
  "Plot B": number
  "Plot C": number
}

export const harvestSeriesConfig = [
  { key: "Plot A", label: "Plot A", color: "var(--chart-2)" },
  { key: "Plot B", label: "Plot B", color: "var(--chart-3)" },
  { key: "Plot C", label: "Plot C", color: "var(--chart-1)" },
] as const

export function toHarvestChartData(): HarvestChartPoint[] {
  const a = harvestLogByPlot["plot-a"]
  const b = harvestLogByPlot["plot-b"]
  const c = harvestLogByPlot["plot-c"]
  // oldest first for a left-to-right trend
  return a
    .map((_, i) => ({
      date: a[i].date,
      "Plot A": a[i].nutsHarvested,
      "Plot B": b[i].nutsHarvested,
      "Plot C": c[i].nutsHarvested,
    }))
    .reverse()
}

export interface HarvestSummaryStat {
  plotId: string
  plot: string
  label: string
  value: number
  unit: string
  icon: "nuts" | "tree" | "grade" | "trend"
}

export const harvestSummaryStats: HarvestSummaryStat[] = [
  { plotId: "plot-a", plot: "PLOT A", label: "Total Nuts", value: 8220, unit: "Nuts", icon: "nuts" },
  { plotId: "plot-a", plot: "PLOT A", label: "Avg / Tree", value: 21.1, unit: "Nuts/Tree", icon: "tree" },
  { plotId: "plot-b", plot: "PLOT B", label: "Total Nuts", value: 4760, unit: "Nuts", icon: "nuts" },
  { plotId: "plot-b", plot: "PLOT B", label: "Avg / Tree", value: 18.6, unit: "Nuts/Tree", icon: "tree" },
  { plotId: "plot-c", plot: "PLOT C", label: "Total Nuts", value: 6190, unit: "Nuts", icon: "nuts" },
  { plotId: "plot-c", plot: "PLOT C", label: "Avg / Tree", value: 21.9, unit: "Nuts/Tree", icon: "tree" },
  { plotId: "all", plot: "ALL PLOTS", label: "Grade A Ratio", value: 79.5, unit: "Percent", icon: "grade" },
  { plotId: "all", plot: "ALL PLOTS", label: "Daily Average", value: 3814, unit: "Nuts/Day", icon: "trend" },
]
