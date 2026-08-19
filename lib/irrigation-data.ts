// ============================================================================
// IRRIGATION DASHBOARD DATA CONTRACT
// Motor Runtime records are the source of truth. No standalone irrigation-entry table.
// ============================================================================

export type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF" | "NM"
export type IrrigationStatus = "irrigated" | "no-record" | "partial" | "issue"
export type CropType = "Coconut" | "Nutmeg" | "Jackfruit"

export const PUMP_LITRES_PER_HOUR = 50_000

export const cropLitresPerTreePerHour: Record<CropType, number> = {
  Coconut: 100,
  Nutmeg: 60,
  Jackfruit: 60,
}

export interface ZoneConfig {
  id: ZoneId
  name: string
  abbr: ZoneId
  plot: string
  crop: CropType
  physicalPlot: string
  overlaps?: ZoneId[]
  configuredMotorValves: string[]
}

export const zoneOrder: ZoneId[] = ["P1E", "P1W", "P2E", "P2W", "JF", "NM"]

export const zoneConfigs: Record<ZoneId, ZoneConfig> = {
  P1E: { id: "P1E", name: "Plot 1 East", abbr: "P1E", plot: "Plot1_East", crop: "Coconut", physicalPlot: "Plot 1 East", configuredMotorValves: ["Motor 1 Valve 3", "Motor 2 Valve 9"] },
  P1W: { id: "P1W", name: "Plot 1 West", abbr: "P1W", plot: "Plot1_West", crop: "Coconut", physicalPlot: "Plot 1 West", configuredMotorValves: ["Motor 1 Valve 4", "Motor 2 Valve 10"] },
  P2E: { id: "P2E", name: "Plot 2 East", abbr: "P2E", plot: "Plot2_East", crop: "Coconut", physicalPlot: "Plot 2 East", configuredMotorValves: ["Motor 1 Valve 1", "Motor 2 Valve 7", "Motor 3 Valve 13"] },
  P2W: { id: "P2W", name: "Plot 2 West", abbr: "P2W", plot: "Plot2_West", crop: "Coconut", physicalPlot: "Plot 2 West", configuredMotorValves: ["Motor 1 Valve 2", "Motor 2 Valve 8", "Motor 3 Valve 14"] },
  JF: { id: "JF", name: "Jackfruit", abbr: "JF", plot: "Jack_Fruit", crop: "Jackfruit", physicalPlot: "Jackfruit block", configuredMotorValves: ["Motor 1 Valve 6", "Motor 2 Valve 12", "Motor 3 Valve 15"] },
  NM: { id: "NM", name: "Nutmeg", abbr: "NM", plot: "Nutmug", crop: "Nutmeg", physicalPlot: "Nutmeg operational zone", overlaps: ["P1E", "P2W"], configuredMotorValves: ["Motor 1 Valve 5", "Motor 2 Valve 11"] },
}

export const zoneNames = Object.fromEntries(zoneOrder.map((id) => [id, zoneConfigs[id].name])) as Record<ZoneId, string>

export const statusColors = {
  irrigated: { label: "Irrigated", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", svg: "#10b981" },
  "no-record": { label: "No Record", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", svg: "#94a3b8" },
  partial: { label: "Data Issue", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", svg: "#f59e0b" },
  issue: { label: "Data Issue", bg: "bg-red-50", border: "border-red-700", text: "text-red-700", svg: "#ef4444" },
} satisfies Record<IrrigationStatus, { label: string; bg: string; border: string; text: string; svg: string }>

export interface CropWaterFigure { crop: CropType; litresPerTree: number }

export interface ZoneFiveDayHistory {
  date: string
  displayDate: string
  totalMinutes: number
  perTreeLitres: number | null
  status: "Irrigated" | "No Record" | "Data Issue"
  isCurrentIncompleteDay?: boolean
}

export interface Zone extends ZoneConfig {
  motor: string
  valveOpenTime: string
  totalRuntimeMinutes: number
  totalRuntimeHours: number
  totalWaterSupplied: number
  waterPerTree: number
  waterPerTreeDisplay: string
  cropWater: CropWaterFigure[]
  lastIrrigatedDate: string
  daysSinceIrrigation: number | null
  recordsCount: number
  status: IrrigationStatus
  statusLabel: string
  fiveDayHistory: ZoneFiveDayHistory[]
}

export interface IrrigationRecord {
  id: string
  date: string
  displayDate: string
  zoneId: ZoneId
  zoneName: string
  crop: CropType
  plot: string
  motorNo: number
  valveNo: number
  motor: string
  valve: string
  runtimeMinutes: number
  runtimeDisplay: string
  totalWaterLitres: number
  waterPerTreeLitres: number
  source: string
  remarks: string
  sourceRecordCount?: number
  sourceRecordIds?: number[]
  mergedTotalMinutes?: number
  mergedRuntimeDisplay?: string
}

export interface TrendPoint {
  date: string
  displayDate: string
  totalWaterLitres: number | null
  totalRuntimeHours: number | null
  P1E: number | null
  P1W: number | null
  P2E: number | null
  P2W: number | null
  JF: number | null
  NM: number | null
}

export interface IrrigationSummary {
  totalWaterSupplied: number
  totalMotorRuntime: string
  totalMotorRuntimeMinutes: number
  zonesIrrigated: number
  zonesNotIrrigated: number
  averageWaterPerTree: number
  latestIrrigation: string
}

export interface IrrigationData {
  summary: IrrigationSummary
  zones: Zone[]
  records: IrrigationRecord[]
  trend: TrendPoint[]
  selectedPeriodLabel: string
  source: "live" | "empty"
  generatedAt: string
}

export function formatNumberIN(num: number): string { return Math.round(num).toLocaleString("en-IN") }
export function formatWaterLitres(num: number): string { return `${formatNumberIN(num)} L` }
export function formatRuntimeMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} h ${minutes} m`
}

export const emptyIrrigationData: IrrigationData = {
  selectedPeriodLabel: "Selected period",
  source: "empty",
  generatedAt: "",
  summary: { totalWaterSupplied: 0, totalMotorRuntime: "0 h 0 m", totalMotorRuntimeMinutes: 0, zonesIrrigated: 0, zonesNotIrrigated: zoneOrder.length, averageWaterPerTree: 0, latestIrrigation: "--" },
  zones: zoneOrder.map((id) => {
    const config = zoneConfigs[id]
    return { ...config, motor: config.configuredMotorValves.join(", "), valveOpenTime: "--", totalRuntimeMinutes: 0, totalRuntimeHours: 0, totalWaterSupplied: 0, waterPerTree: 0, waterPerTreeDisplay: "No runtime recorded", cropWater: [{ crop: config.crop, litresPerTree: 0 }], lastIrrigatedDate: "--", daysSinceIrrigation: null, recordsCount: 0, status: "no-record", statusLabel: statusColors["no-record"].label, fiveDayHistory: [] }
  }),
  records: [],
  trend: [],
}
