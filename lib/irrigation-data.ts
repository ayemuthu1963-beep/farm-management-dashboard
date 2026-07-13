// ============================================================================
// IRRIGATION DASHBOARD DATA CONTRACT
// Uses Motor Runtime records as the source of truth. No irrigation-entry table.
// ============================================================================

export type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF"

export type IrrigationStatus = "target" | "no-data"

export interface CropWaterFigure {
  crop: "Coconut" | "Nutmeg" | "Jackfruit"
  litresPerTree: number
}

export interface Zone {
  id: ZoneId
  name: string
  plot: string
  motor: string
  valveOpenTime: string
  totalWaterSupplied: number
  waterPerTree: number
  waterPerTreeDisplay: string
  cropWater: CropWaterFigure[]
  lastIrrigatedDate: string
  daysSinceIrrigation: number | null
  recordsCount: number
  status: IrrigationStatus
  statusLabel: string
}

export interface TrendPoint {
  date: string
  P1E: number
  P1W: number
  P2E: number
  P2W: number
  JF: number
}

export interface IrrigationSummary {
  totalWaterSupplied: number
  totalMotorRuntime: string
  zonesIrrigated: number
  latestIrrigation: string
}

export interface IrrigationData {
  summary: IrrigationSummary
  zones: Zone[]
  waterPerTreeTrend: TrendPoint[]
  selectedPeriodLabel: string
  sourceRecord?: {
    entryDate: string
    plot: string
    motorNo: number
    valveNo: number
    hours: number
    minutes: number
    totalMinutes: number
    totalWaterLitres: number
    waterPerTree: CropWaterFigure[]
  }
}

export const zoneNames: Record<ZoneId, string> = {
  P1E: "Plot 1 East",
  P1W: "Plot 1 West",
  P2E: "Plot 2 East",
  P2W: "Plot 2 West",
  JF: "Jackfruit",
}

export const statusColors = {
  target: { label: "Irrigated", bg: "bg-chart-2/10", text: "text-chart-2", svg: "rgb(34, 197, 94)" },
  "no-data": { label: "No Irrigation", bg: "bg-muted/15", text: "text-muted-foreground", svg: "rgb(107, 114, 128)" },
} satisfies Record<IrrigationStatus, { label: string; bg: string; text: string; svg: string }>

export const emptyIrrigationData: IrrigationData = {
  selectedPeriodLabel: "Selected period",
  summary: {
    totalWaterSupplied: 0,
    totalMotorRuntime: "0 h 0 m",
    zonesIrrigated: 0,
    latestIrrigation: "--",
  },
  zones: (Object.keys(zoneNames) as ZoneId[]).map((id) => ({
    id,
    name: zoneNames[id],
    plot: "--",
    motor: "--",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    waterPerTree: 0,
    waterPerTreeDisplay: "--",
    cropWater: [],
    lastIrrigatedDate: "--",
    daysSinceIrrigation: null,
    recordsCount: 0,
    status: "no-data",
    statusLabel: statusColors["no-data"].label,
  })),
  waterPerTreeTrend: [],
}

export function formatNumberIN(num: number): string {
  return num.toLocaleString("en-IN")
}
