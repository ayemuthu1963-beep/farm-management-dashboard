// Mock data for the Beetle Trap Monitoring dashboard. No backend — all static.
// Tracks pheromone trap catches for rhinoceros / red palm weevil beetles.

export interface BeetleSummary {
  label: string
  value: string
  unit: string
  icon: "bug" | "trap" | "alert" | "check"
}

export const beetleSummary: BeetleSummary[] = [
  { label: "Active Traps", value: "18", unit: "across farm", icon: "trap" },
  { label: "Catches This Week", value: "47", unit: "beetles", icon: "bug" },
  { label: "Alert Traps", value: "3", unit: "need attention", icon: "alert" },
  { label: "Serviced Traps", value: "15", unit: "up to date", icon: "check" },
]

export type TrapStatus = "Normal" | "High" | "Alert"

export interface TrapRecord {
  trapId: string
  location: string
  beetleType: string
  catches: number
  lastServiced: string
  status: TrapStatus
}

export const trapRecords: TrapRecord[] = [
  { trapId: "T-01", location: "Plot 1 East", beetleType: "Rhinoceros", catches: 4, lastServiced: "05-07-2026", status: "Normal" },
  { trapId: "T-02", location: "Plot 1 West", beetleType: "Red Palm Weevil", catches: 9, lastServiced: "05-07-2026", status: "High" },
  { trapId: "T-03", location: "Plot 2 East", beetleType: "Rhinoceros", catches: 12, lastServiced: "04-07-2026", status: "Alert" },
  { trapId: "T-04", location: "Plot 2 West", beetleType: "Rhinoceros", catches: 3, lastServiced: "06-07-2026", status: "Normal" },
  { trapId: "T-05", location: "Nutmeg Block", beetleType: "Red Palm Weevil", catches: 6, lastServiced: "05-07-2026", status: "High" },
  { trapId: "T-06", location: "Jackfruit Block", beetleType: "Rhinoceros", catches: 2, lastServiced: "06-07-2026", status: "Normal" },
  { trapId: "T-07", location: "Boundary North", beetleType: "Red Palm Weevil", catches: 11, lastServiced: "03-07-2026", status: "Alert" },
  { trapId: "T-08", location: "Boundary South", beetleType: "Rhinoceros", catches: 5, lastServiced: "05-07-2026", status: "Normal" },
]

// Weekly catch trend (last 6 weeks)
export interface BeetleTrendPoint {
  week: string
  rhinoceros: number
  redPalmWeevil: number
}

export const beetleTrend: BeetleTrendPoint[] = [
  { week: "Wk 22", rhinoceros: 18, redPalmWeevil: 12 },
  { week: "Wk 23", rhinoceros: 22, redPalmWeevil: 15 },
  { week: "Wk 24", rhinoceros: 19, redPalmWeevil: 20 },
  { week: "Wk 25", rhinoceros: 25, redPalmWeevil: 18 },
  { week: "Wk 26", rhinoceros: 21, redPalmWeevil: 24 },
  { week: "Wk 27", rhinoceros: 28, redPalmWeevil: 19 },
]
