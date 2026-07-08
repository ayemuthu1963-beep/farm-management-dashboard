// Mock data for the Fertiliser Management dashboard. No backend — all static.
// Tracks application schedules, quantities applied and stock levels.

export interface FertiliserSummary {
  label: string
  value: string
  unit: string
  icon: "bag" | "calendar" | "applied" | "alert"
}

export const fertiliserSummary: FertiliserSummary[] = [
  { label: "Applied This Month", value: "1,850", unit: "kg", icon: "applied" },
  { label: "Upcoming Tasks", value: "4", unit: "this week", icon: "calendar" },
  { label: "Stock Items", value: "9", unit: "in store", icon: "bag" },
  { label: "Low Stock", value: "2", unit: "need reorder", icon: "alert" },
]

export type ScheduleStatus = "Done" | "Scheduled" | "Overdue"

export interface FertiliserSchedule {
  date: string
  block: string
  fertiliser: string
  quantityKg: number
  method: string
  status: ScheduleStatus
}

export const fertiliserSchedule: FertiliserSchedule[] = [
  { date: "02-07-2026", block: "Plot 1 East", fertiliser: "Urea", quantityKg: 120, method: "Broadcast", status: "Done" },
  { date: "04-07-2026", block: "Plot 1 West", fertiliser: "NPK 19:19:19", quantityKg: 90, method: "Fertigation", status: "Done" },
  { date: "06-07-2026", block: "Plot 2 East", fertiliser: "Muriate of Potash", quantityKg: 75, method: "Broadcast", status: "Done" },
  { date: "09-07-2026", block: "Plot 2 West", fertiliser: "Organic Compost", quantityKg: 300, method: "Basal", status: "Scheduled" },
  { date: "11-07-2026", block: "Nutmeg Block", fertiliser: "NPK 19:19:19", quantityKg: 60, method: "Fertigation", status: "Scheduled" },
  { date: "01-07-2026", block: "Jackfruit Block", fertiliser: "Urea", quantityKg: 80, method: "Broadcast", status: "Overdue" },
]

export type StockLevel = "Good" | "Low" | "Critical"

export interface StockItem {
  name: string
  inStockKg: number
  reorderKg: number
  level: StockLevel
}

export const stockItems: StockItem[] = [
  { name: "Urea", inStockKg: 640, reorderKg: 300, level: "Good" },
  { name: "NPK 19:19:19", inStockKg: 210, reorderKg: 250, level: "Low" },
  { name: "Muriate of Potash", inStockKg: 180, reorderKg: 150, level: "Good" },
  { name: "Organic Compost", inStockKg: 90, reorderKg: 400, level: "Critical" },
  { name: "Micronutrient Mix", inStockKg: 55, reorderKg: 40, level: "Good" },
]

// Monthly fertiliser usage trend (kg)
export interface UsagePoint {
  month: string
  quantityKg: number
}

export const usageTrend: UsagePoint[] = [
  { month: "Feb", quantityKg: 1420 },
  { month: "Mar", quantityKg: 1680 },
  { month: "Apr", quantityKg: 1350 },
  { month: "May", quantityKg: 1920 },
  { month: "Jun", quantityKg: 1560 },
  { month: "Jul", quantityKg: 1850 },
]
