// ============================================================================
// IRRIGATION DASHBOARD MOCK DATA
// Static data only — suitable for UI review before database integration
// ============================================================================

// Zone IDs — includes Nutmeg (NM) which overlaps P1E and P2W
export type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF" | "NM"

// Zone overlay information — indicates which physical zones Nutmeg overlaps
export const zoneOverlaps: Record<ZoneId, ZoneId[]> = {
  P1E: [],
  P1W: [],
  P2E: [],
  P2W: [],
  JF: [],
  NM: ["P1E", "P2W"], // Nutmeg overlaps portions of Plot 1 East and Plot 2 West
}

// Status colors
export type IrrigationStatus = "above-target" | "target" | "low" | "critical" | "very-low" | "no-data"

export interface Zone {
  id: ZoneId
  name: string
  plot: string
  motor: string
  valveOpenTime: string // e.g. "4 h 20 m"
  totalWaterSupplied: number // litres
  numberOfTrees: number
  waterPerTree: number // litres/tree
  lastIrrigatedDate: string // e.g. "13 July 2026, 4:30 PM"
  daysSinceIrrigation: number
  status: IrrigationStatus
  statusLabel: string
}

// Zone data — the single source of truth
export const zones: Zone[] = [
  {
    id: "P1E",
    name: "Plot 1 East",
    plot: "Database Value",
    motor: "Database Value",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    numberOfTrees: 0,
    waterPerTree: 0,
    lastIrrigatedDate: "--",
    daysSinceIrrigation: 0,
    status: "target",
    statusLabel: "Target Achieved",
  },
  {
    id: "P1W",
    name: "Plot 1 West",
    plot: "Database Value",
    motor: "Database Value",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    numberOfTrees: 0,
    waterPerTree: 0,
    lastIrrigatedDate: "--",
    daysSinceIrrigation: 0,
    status: "target",
    statusLabel: "Target Achieved",
  },
  {
    id: "P2E",
    name: "Plot 2 East",
    plot: "Database Value",
    motor: "Database Value",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    numberOfTrees: 0,
    waterPerTree: 0,
    lastIrrigatedDate: "--",
    daysSinceIrrigation: 0,
    status: "low",
    statusLabel: "Slightly Low",
  },
  {
    id: "P2W",
    name: "Plot 2 West",
    plot: "Database Value",
    motor: "Database Value",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    numberOfTrees: 0,
    waterPerTree: 0,
    lastIrrigatedDate: "--",
    daysSinceIrrigation: 0,
    status: "very-low",
    statusLabel: "Low",
  },
  {
    id: "JF",
    name: "Jackfruit",
    plot: "Database Value",
    motor: "Database Value",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    numberOfTrees: 0,
    waterPerTree: 0,
    lastIrrigatedDate: "--",
    daysSinceIrrigation: 0,
    status: "critical",
    statusLabel: "Critical",
  },
  {
    id: "NM",
    name: "Nutmeg",
    plot: "Overlaps P1E & P2W",
    motor: "Database Value",
    valveOpenTime: "--",
    totalWaterSupplied: 0,
    numberOfTrees: 0,
    waterPerTree: 0,
    lastIrrigatedDate: "--",
    daysSinceIrrigation: 0,
    status: "target",
    statusLabel: "Target Achieved",
  },
]

// Summary totals
export function getTotalWaterSupplied(): number {
  return zones.reduce((sum, z) => sum + z.totalWaterSupplied, 0)
}

export function getTotalMotorRuntime(): string {
  // Mock: sum of valve times (converted to hours/minutes)
  const totalMinutes = zones.reduce((sum, z) => {
    const parts = z.valveOpenTime.split(" ")
    const hours = parseInt(parts[0]) || 0
    const mins = parseInt(parts[2]) || 0
    return sum + hours * 60 + mins
  }, 0)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h} h ${m} m`
}

// Recent trend data for "Water per Tree Trend" chart — last 10 inspection dates
// Nutmeg uses fixed rate: 80 litres per tree per hour (independent of P1E and P2W)
export interface TrendPoint {
  date: string
  P1E: number
  P1W: number
  P2E: number
  P2W: number
  JF: number
  NM: number
}

export const waterPerTreeTrend: TrendPoint[] = [
  { date: "04 Jul", P1E: 642, P1W: 580, P2E: 451, P2W: 410, JF: 265, NM: 80 },
  { date: "05 Jul", P1E: 655, P1W: 592, P2E: 463, P2W: 425, JF: 270, NM: 80 },
  { date: "06 Jul", P1E: 668, P1W: 603, P2E: 471, P2W: 438, JF: 275, NM: 80 },
  { date: "07 Jul", P1E: 673, P1W: 610, P2E: 474, P2W: 442, JF: 277, NM: 80 },
  { date: "08 Jul", P1E: 671, P1W: 608, P2E: 476, P2W: 445, JF: 279, NM: 80 },
  { date: "09 Jul", P1E: 674, P1W: 609, P2E: 475, P2W: 447, JF: 280, NM: 80 },
  { date: "10 Jul", P1E: 675, P1W: 611, P2E: 477, P2W: 448, JF: 280, NM: 80 },
  { date: "11 Jul", P1E: 676, P1W: 611, P2E: 477, P2W: 448, JF: 280, NM: 80 },
  { date: "12 Jul", P1E: 676, P1W: 611, P2E: 477, P2W: 448, JF: 280, NM: 80 },
  { date: "13 Jul", P1E: 677, P1W: 611, P2E: 477, P2W: 448, JF: 280, NM: 80 },
]

// Status color map (tailwind + inline rgb for SVG)
export const statusColors = {
  "above-target": { label: "Above Target", bg: "bg-chart-2/15", text: "text-chart-2", svg: "rgb(34, 197, 94)" }, // green
  target: { label: "Target", bg: "bg-chart-2/10", text: "text-chart-2", svg: "rgb(34, 197, 94)" }, // dark green
  low: { label: "Slightly Low", bg: "bg-warning/15", text: "text-warning", svg: "rgb(234, 179, 8)" }, // yellow
  critical: { label: "Critical", bg: "bg-destructive/15", text: "text-destructive", svg: "rgb(239, 68, 68)" }, // red
  "very-low": { label: "Low", bg: "bg-orange-500/15", text: "text-orange-500", svg: "rgb(249, 115, 22)" }, // orange
  "no-data": { label: "No Data", bg: "bg-muted/15", text: "text-muted-foreground", svg: "rgb(107, 114, 128)" }, // grey
}

// Format large numbers with Indian digit grouping
export function formatNumberIN(num: number): string {
  return num.toLocaleString("en-IN")
}

// Nutmeg-specific calculation: 80 litres per tree per hour
const NUTMEG_LITRES_PER_TREE_PER_HOUR = 80

export function calculateNutmegWaterPerTree(runtimeHours: number): number {
  return runtimeHours * NUTMEG_LITRES_PER_TREE_PER_HOUR
}

// Helper to check if a zone is physically separate or overlapping
export function isOverlappingZone(zoneId: ZoneId): boolean {
  return zoneId === "NM"
}

// Helper to get zones that a given zone overlaps
export function getOverlappingZones(zoneId: ZoneId): ZoneId[] {
  return zoneOverlaps[zoneId]
}
