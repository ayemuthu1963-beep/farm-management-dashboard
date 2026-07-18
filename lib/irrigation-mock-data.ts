// ============================================================================
// IRRIGATION DASHBOARD - COMPREHENSIVE MOCK DATA
// Frontend-only mock data with all business logic
// ============================================================================

export type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF" | "NM"
export type IrrigationStatus = "irrigated" | "no-record" | "partial" | "issue"
export type CropType = "coconut" | "jackfruit" | "nutmeg"

// Business constants
export const PUMP_CAPACITY_LITERS_PER_HOUR = 50000
export const CROP_RATES: Record<CropType, number> = {
  coconut: 100, // litres per tree per hour
  jackfruit: 60,
  nutmeg: 80,
}

// Zone configuration
export interface ZoneConfig {
  id: ZoneId
  name: string
  abbr: string
  crop: CropType
  treeCount: number
  physicalPlot: string
  overlaps?: ZoneId[]
}

export const ZONE_CONFIG: Record<ZoneId, ZoneConfig> = {
  P1E: { id: "P1E", name: "Plot 1 East", abbr: "P1E", crop: "coconut", treeCount: 125, physicalPlot: "Plot 1 East" },
  P1W: { id: "P1W", name: "Plot 1 West", abbr: "P1W", crop: "coconut", treeCount: 110, physicalPlot: "Plot 1 West" },
  P2E: { id: "P2E", name: "Plot 2 East", abbr: "P2E", crop: "coconut", treeCount: 135, physicalPlot: "Plot 2 East" },
  P2W: { id: "P2W", name: "Plot 2 West", abbr: "P2W", crop: "coconut", treeCount: 128, physicalPlot: "Plot 2 West" },
  JF: { id: "JF", name: "Jackfruit", abbr: "JF", crop: "jackfruit", treeCount: 42, physicalPlot: "Jackfruit" },
  NM: { id: "NM", name: "Nutmeg", abbr: "NM", crop: "nutmeg", treeCount: 35, physicalPlot: "Overlaps P1E & P2W", overlaps: ["P1E", "P2W"] },
}

// Irrigation record
export interface IrrigationRecord {
  id: string
  date: string
  startTime: string
  zoneId: ZoneId
  motor: string
  valve: string
  runtimeMinutes: number
  totalWaterLitres: number
  waterPerTreeLitres: number
  crop: CropType
  treeCount: number
  remarks: string
  source: string
}

// Sample irrigation records — mock data for the table and charts
export const IRRIGATION_RECORDS: IrrigationRecord[] = [
  {
    id: "REC-001",
    date: "2026-07-16",
    startTime: "06:30",
    zoneId: "P1E",
    motor: "M1",
    valve: "V1",
    runtimeMinutes: 210,
    totalWaterLitres: 175000,
    waterPerTreeLitres: 1400,
    crop: "coconut",
    treeCount: 125,
    remarks: "Regular irrigation cycle",
    source: "Manual entry",
  },
  {
    id: "REC-002",
    date: "2026-07-16",
    startTime: "06:45",
    zoneId: "NM",
    motor: "M2",
    valve: "V2",
    runtimeMinutes: 180,
    totalWaterLitres: 150000,
    waterPerTreeLitres: 4286, // 180/60 * 80 per tree
    crop: "nutmeg",
    treeCount: 35,
    remarks: "Nutmeg zone independent operation",
    source: "Manual entry",
  },
  {
    id: "REC-003",
    date: "2026-07-16",
    startTime: "09:00",
    zoneId: "P1W",
    motor: "M1",
    valve: "V3",
    runtimeMinutes: 200,
    totalWaterLitres: 166667,
    waterPerTreeLitres: 1515,
    crop: "coconut",
    treeCount: 110,
    remarks: "Plot 1 West second cycle",
    source: "Manual entry",
  },
  {
    id: "REC-004",
    date: "2026-07-16",
    startTime: "11:30",
    zoneId: "P2E",
    motor: "M3",
    valve: "V4",
    runtimeMinutes: 220,
    totalWaterLitres: 183333,
    waterPerTreeLitres: 1359,
    crop: "coconut",
    treeCount: 135,
    remarks: "Plot 2 East morning cycle",
    source: "Manual entry",
  },
  {
    id: "REC-005",
    date: "2026-07-16",
    startTime: "14:00",
    zoneId: "P2W",
    motor: "M3",
    valve: "V5",
    runtimeMinutes: 195,
    totalWaterLitres: 162500,
    waterPerTreeLitres: 1269,
    crop: "coconut",
    treeCount: 128,
    remarks: "Plot 2 West afternoon cycle",
    source: "Manual entry",
  },
  {
    id: "REC-006",
    date: "2026-07-16",
    startTime: "16:15",
    zoneId: "JF",
    motor: "M4",
    valve: "V6",
    runtimeMinutes: 240,
    totalWaterLitres: 200000,
    waterPerTreeLitres: 4762, // 240/60 * 60 per tree
    crop: "jackfruit",
    treeCount: 42,
    remarks: "Jackfruit afternoon irrigation",
    source: "Manual entry",
  },
  {
    id: "REC-007",
    date: "2026-07-15",
    startTime: "06:30",
    zoneId: "P1E",
    motor: "M1",
    valve: "V1",
    runtimeMinutes: 215,
    totalWaterLitres: 179167,
    waterPerTreeLitres: 1433,
    crop: "coconut",
    treeCount: 125,
    remarks: "Previous day cycle",
    source: "Manual entry",
  },
  {
    id: "REC-008",
    date: "2026-07-15",
    startTime: "09:00",
    zoneId: "P2E",
    motor: "M3",
    valve: "V4",
    runtimeMinutes: 210,
    totalWaterLitres: 175000,
    waterPerTreeLitres: 1296,
    crop: "coconut",
    treeCount: 135,
    remarks: "Previous day cycle",
    source: "Manual entry",
  },
]

// Irrigation summary for selected period
export interface IrrigationSummary {
  totalRuntimeMinutes: number
  totalWaterLitres: number
  zonesIrrigated: number
  zonesNotIrrigated: number
  averageWaterPerTree: number
}

export function calculateSummary(): IrrigationSummary {
  const todayRecords = IRRIGATION_RECORDS.filter((r) => r.date === "2026-07-16")
  const irrigatedZones = new Set(todayRecords.map((r) => r.zoneId))
  const allZones = Object.keys(ZONE_CONFIG) as ZoneId[]
  const notIrrigatedZones = allZones.filter((z) => !irrigatedZones.has(z))

  const totalRuntime = todayRecords.reduce((sum, r) => sum + r.runtimeMinutes, 0)
  const totalWater = todayRecords.reduce((sum, r) => sum + r.totalWaterLitres, 0)
  const totalTrees = todayRecords.reduce((sum, r) => sum + r.treeCount, 0)
  const avgWaterPerTree = totalTrees > 0 ? totalWater / totalTrees : 0

  return {
    totalRuntimeMinutes: totalRuntime,
    totalWaterLitres: totalWater,
    zonesIrrigated: irrigatedZones.size,
    zonesNotIrrigated: notIrrigatedZones.length,
    averageWaterPerTree: avgWaterPerTree,
  }
}

// Get zone status for a specific date
export function getZoneStatus(zoneId: ZoneId, dateStr: string): IrrigationStatus {
  const records = IRRIGATION_RECORDS.filter((r) => r.zoneId === zoneId && r.date === dateStr)
  if (records.length === 0) return "no-record"
  if (records.length === 1) return "irrigated"
  // Multiple records could indicate partial or issue
  return "partial"
}

// Get zone details for selected date
export interface ZoneDetails {
  zoneId: ZoneId
  name: string
  abbr: string
  crop: CropType
  treeCount: number
  physicalPlot: string
  overlaps?: ZoneId[]
  status: IrrigationStatus
  lastIrrigationDate?: string
  lastIrrigationTime?: string
  totalRuntimeMinutes: number
  totalWaterLitres: number
  waterPerTreeLitres: number
  recordCount: number
}

export function getZoneDetails(zoneId: ZoneId, dateStr: string): ZoneDetails {
  const config = ZONE_CONFIG[zoneId]
  const records = IRRIGATION_RECORDS.filter((r) => r.zoneId === zoneId && r.date === dateStr)
  
  const totalRuntime = records.reduce((sum, r) => sum + r.runtimeMinutes, 0)
  const totalWater = records.reduce((sum, r) => sum + r.totalWaterLitres, 0)
  const waterPerTree = records.length > 0 ? records[records.length - 1].waterPerTreeLitres : 0

  return {
    zoneId,
    name: config.name,
    abbr: config.abbr,
    crop: config.crop,
    treeCount: config.treeCount,
    physicalPlot: config.physicalPlot,
    overlaps: config.overlaps,
    status: getZoneStatus(zoneId, dateStr),
    lastIrrigationDate: records.length > 0 ? records[records.length - 1].date : undefined,
    lastIrrigationTime: records.length > 0 ? records[records.length - 1].startTime : undefined,
    totalRuntimeMinutes: totalRuntime,
    totalWaterLitres: totalWater,
    waterPerTreeLitres: waterPerTree,
    recordCount: records.length,
  }
}

// Get all zone details
export function getAllZoneDetails(dateStr: string): ZoneDetails[] {
  const zones = Object.keys(ZONE_CONFIG) as ZoneId[]
  return zones.map((zoneId) => getZoneDetails(zoneId, dateStr))
}

// Format utilities
export function formatRuntimeMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function formatWaterLitres(litres: number): string {
  if (litres === 0) return "0 L"
  // Indian number formatting
  return `${litres.toLocaleString("en-IN")} L`
}

export function formatWaterPerTree(litres: number): string {
  return `${litres.toLocaleString("en-IN")} L`
}
