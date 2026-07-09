// Mock data for the Beetle Trap Monitoring dashboard. No backend — all static.
// Codex will later connect the real sources listed in CODEX_HANDOFF.md:
//   plot1.mbtiles / plot2.mbtiles  -> drone orthomosaic basemaps
//   Beetle_Traps.geojson           -> trap GPS locations + trap type
//   red_palm_weevil_red.svg        -> Red Palm Weevil marker icon
//   rhinoceros_beetle_black.svg    -> Rhinoceros Beetle marker icon
//
// Trap facts (fixed):
//   Total traps 78  |  Rhinoceros 39  |  Red Palm Weevil 39
//   Inspection frequency: every 2 days

export type PlotId = "plot1" | "plot2"
export type BeetleType = "Rhinoceros" | "Red Palm Weevil"
export type RiskLevel = "Very High" | "High" | "Medium" | "Low"
export type CountBand = "Very Low" | "Low" | "Medium" | "High" | "Very High"

// ---------------------------------------------------------------------------
// Shared pheromone reset schedule (identical for both trap types)
// ---------------------------------------------------------------------------
export const resetSchedule = {
  pheromoneInstalledOn: "18 Mar 2026",
  pheromoneChangeOn: "16 Jun 2026",
  changeIntervalDays: 90,
  cumulativeCountStartDate: "18 Mar 2026",
  daysRemaining: 2,
} as const

export const lastInspectionDate = "16 Jun 2026"
export const nextInspectionDate = "18 Jun 2026"

// ---------------------------------------------------------------------------
// Top summary cards
// ---------------------------------------------------------------------------
export interface BeetleSummary {
  label: string
  value: string
  unit: string
  icon: "trap" | "rhino" | "weevil" | "calendar" | "alert" | "area"
}

export const beetleSummary: BeetleSummary[] = [
  { label: "Total Traps", value: "78", unit: "across both plots", icon: "trap" },
  { label: "Rhinoceros Beetle Traps", value: "39", unit: "black beetle", icon: "rhino" },
  { label: "Red Palm Weevil Traps", value: "39", unit: "red beetle", icon: "weevil" },
  { label: "Next Inspection Due", value: nextInspectionDate, unit: "in 2 days", icon: "calendar" },
  { label: "Highest Infection Trap", value: "Trap 21", unit: "42 beetles since reset", icon: "alert" },
  { label: "Highest Infection Area", value: "Plot 1 – NE Zone", unit: "68 beetles", icon: "area" },
]

// ---------------------------------------------------------------------------
// Traps (single source of truth). Map markers + Top 10 both derive from this.
// x / y are percentage coordinates (0-100) over the plot orthomosaic image —
// placeholder positions for the static design; Codex replaces with real GPS.
// ---------------------------------------------------------------------------
export interface Trap {
  trapNo: string
  type: BeetleType
  plot: PlotId
  x: number
  y: number
  lastCount: number
  cumulativeCount: number
  risk: RiskLevel
  lastInspection: string
}

export const traps: Trap[] = [
  // Top 10 (highest cumulative counts) — exact placeholder values
  { trapNo: "Trap 21", type: "Red Palm Weevil", plot: "plot1", x: 24, y: 30, lastCount: 6, cumulativeCount: 42, risk: "Very High", lastInspection: lastInspectionDate },
  { trapNo: "Trap 36", type: "Rhinoceros", plot: "plot2", x: 58, y: 26, lastCount: 5, cumulativeCount: 38, risk: "Very High", lastInspection: lastInspectionDate },
  { trapNo: "Trap 12", type: "Rhinoceros", plot: "plot1", x: 62, y: 44, lastCount: 4, cumulativeCount: 27, risk: "High", lastInspection: lastInspectionDate },
  { trapNo: "Trap 48", type: "Red Palm Weevil", plot: "plot2", x: 33, y: 58, lastCount: 4, cumulativeCount: 24, risk: "High", lastInspection: lastInspectionDate },
  { trapNo: "Trap 08", type: "Rhinoceros", plot: "plot1", x: 44, y: 66, lastCount: 3, cumulativeCount: 19, risk: "Medium", lastInspection: lastInspectionDate },
  { trapNo: "Trap 64", type: "Red Palm Weevil", plot: "plot2", x: 70, y: 62, lastCount: 3, cumulativeCount: 17, risk: "Medium", lastInspection: lastInspectionDate },
  { trapNo: "Trap 05", type: "Rhinoceros", plot: "plot1", x: 16, y: 54, lastCount: 2, cumulativeCount: 16, risk: "Medium", lastInspection: lastInspectionDate },
  { trapNo: "Trap 27", type: "Red Palm Weevil", plot: "plot1", x: 78, y: 22, lastCount: 2, cumulativeCount: 12, risk: "Low", lastInspection: lastInspectionDate },
  { trapNo: "Trap 60", type: "Rhinoceros", plot: "plot2", x: 46, y: 40, lastCount: 1, cumulativeCount: 9, risk: "Low", lastInspection: lastInspectionDate },
  { trapNo: "Trap 73", type: "Red Palm Weevil", plot: "plot2", x: 22, y: 74, lastCount: 1, cumulativeCount: 8, risk: "Low", lastInspection: lastInspectionDate },
  // Additional lower-count traps for map density (never enter Top 10)
  { trapNo: "Trap 31", type: "Rhinoceros", plot: "plot1", x: 36, y: 42, lastCount: 1, cumulativeCount: 7, risk: "Medium", lastInspection: lastInspectionDate },
  { trapNo: "Trap 67", type: "Red Palm Weevil", plot: "plot2", x: 84, y: 46, lastCount: 1, cumulativeCount: 6, risk: "Medium", lastInspection: lastInspectionDate },
  { trapNo: "Trap 03", type: "Rhinoceros", plot: "plot1", x: 52, y: 20, lastCount: 1, cumulativeCount: 5, risk: "Low", lastInspection: lastInspectionDate },
  { trapNo: "Trap 40", type: "Red Palm Weevil", plot: "plot2", x: 40, y: 78, lastCount: 0, cumulativeCount: 4, risk: "Low", lastInspection: lastInspectionDate },
  { trapNo: "Trap 55", type: "Rhinoceros", plot: "plot1", x: 70, y: 74, lastCount: 0, cumulativeCount: 2, risk: "Low", lastInspection: lastInspectionDate },
  { trapNo: "Trap 18", type: "Red Palm Weevil", plot: "plot2", x: 60, y: 82, lastCount: 0, cumulativeCount: 1, risk: "Low", lastInspection: lastInspectionDate },
]

// Top 10 traps since last reset (derived — highest cumulative first)
export const topTraps: Trap[] = [...traps].sort((a, b) => b.cumulativeCount - a.cumulativeCount).slice(0, 10)

// ---------------------------------------------------------------------------
// Daily beetle counts — last 10 inspection dates (kept separate, no totals)
// ---------------------------------------------------------------------------
export interface DailyCount {
  date: string
  rhinoceros: number
  redPalmWeevil: number
}

export const dailyCounts: DailyCount[] = [
  { date: "16 Jun 2026", rhinoceros: 23, redPalmWeevil: 18 },
  { date: "14 Jun 2026", rhinoceros: 20, redPalmWeevil: 16 },
  { date: "12 Jun 2026", rhinoceros: 18, redPalmWeevil: 20 },
  { date: "10 Jun 2026", rhinoceros: 21, redPalmWeevil: 13 },
  { date: "08 Jun 2026", rhinoceros: 17, redPalmWeevil: 15 },
  { date: "06 Jun 2026", rhinoceros: 19, redPalmWeevil: 12 },
  { date: "04 Jun 2026", rhinoceros: 14, redPalmWeevil: 11 },
  { date: "02 Jun 2026", rhinoceros: 16, redPalmWeevil: 10 },
  { date: "31 May 2026", rhinoceros: 12, redPalmWeevil: 9 },
  { date: "29 May 2026", rhinoceros: 10, redPalmWeevil: 8 },
]

// ---------------------------------------------------------------------------
// Beetle infection by area (horizontal bars, highest first)
// ---------------------------------------------------------------------------
export interface AreaInfection {
  area: string
  count: number
}

export const areaInfections: AreaInfection[] = [
  { area: "Plot 1 – North East Zone", count: 68 },
  { area: "Plot 1 – Central Zone", count: 54 },
  { area: "Plot 2 – North Zone", count: 47 },
  { area: "Plot 2 – West Zone", count: 39 },
  { area: "Plot 1 – South Zone", count: 26 },
  { area: "Plot 2 – South Zone", count: 18 },
]

// ---------------------------------------------------------------------------
// Plot orthomosaic basemaps (placeholder images for the static design)
// ---------------------------------------------------------------------------
export interface PlotMap {
  id: PlotId
  label: string
  image: string
}

export const plotMaps: PlotMap[] = [
  { id: "plot1", label: "Plot 1", image: "/mfms/beetle/plot1-orthomosaic.png" },
  { id: "plot2", label: "Plot 2", image: "/mfms/beetle/plot2-orthomosaic.png" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Icon-size band from cumulative count since last reset (drives marker size).
export interface CountBandInfo {
  band: CountBand
  label: string
  range: string
  sizePx: number
  glow: boolean
}

export const countBands: CountBandInfo[] = [
  { band: "Very Low", label: "Very Low", range: "1–2", sizePx: 16, glow: false },
  { band: "Low", label: "Low", range: "3–5", sizePx: 22, glow: false },
  { band: "Medium", label: "Medium", range: "6–10", sizePx: 30, glow: false },
  { band: "High", label: "High", range: "11–20", sizePx: 40, glow: false },
  { band: "Very High", label: "Very High", range: "21+", sizePx: 52, glow: true },
]

export function bandForCount(count: number): CountBandInfo {
  if (count >= 21) return countBands[4]
  if (count >= 11) return countBands[3]
  if (count >= 6) return countBands[2]
  if (count >= 3) return countBands[1]
  return countBands[0]
}
