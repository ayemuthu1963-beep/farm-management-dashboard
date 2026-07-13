// ---------------------------------------------------------------------------
// Coconut Harvest — mock data (single source for all Coconut Harvest pages).
//
// NO BACKEND. All values below are static mock JSON.
// Codex will later replace these exports with real farm database / API data,
// keeping the SAME TypeScript shapes so the UI does not need to change.
//
// Money values are stored as plain numbers (Rupees). The UI formats them with
// the Indian digit grouping via Number.toLocaleString("en-IN").
// ---------------------------------------------------------------------------

/** Format a rupee amount using Indian digit grouping, e.g. 982000 -> "Rs. 9,82,000". */
export function formatRupees(amount: number, fractionDigits = 0): string {
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

// ===========================================================================
// Dropdown option lists
// ===========================================================================

/** Tree numbers available for selection on the Tree View page. */
export const treeNumbers: number[] = [1, 2, 3, 4, 5, 12, 18, 45, 128, 356, 742, 999, 1024, 1560, 2011]

/** Harvest cycle numbers available for selection (newest first). */
export const harvestCycleOptions: number[] = [18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7]

/** Tree classification categories (used by Tree Performance + Detailed Query). */
export const treeClassifications: string[] = [
  "All",
  "Century Maker",
  "Match Winner",
  "Reliable Batter",
  "Tail Ender",
  "Bench Player",
]

// ===========================================================================
// 1) Tree View — per-tree harvest history
// ===========================================================================

export interface TreeHarvestRow {
  /** Harvest cycle number */
  cycle: number
  /** ISO harvest date (YYYY-MM-DD) */
  harvestDate: string
  /** Nuts counted from bunch 1 */
  nutsB1: number
  /** Nuts counted from bunch 2 */
  nutsB2: number
  /** Nuts counted from bunch 3 */
  nutsB3: number
  /** Total number of bunches harvested */
  totalBunches: number
  /** Total nuts (nutsB1 + nutsB2 + nutsB3) */
  totalNuts: number
  /** Sale value for this harvest, in Rupees */
  totalSale: number
}

/** Sample history for the currently selected tree (newest cycle first). */
export const treeHarvestHistory: TreeHarvestRow[] = [
  { cycle: 18, harvestDate: "2026-06-26", nutsB1: 29, nutsB2: 20, nutsB3: 0, totalBunches: 2, totalNuts: 49, totalSale: 1700 },
  { cycle: 17, harvestDate: "2026-05-21", nutsB1: 10, nutsB2: 9, nutsB3: 0, totalBunches: 2, totalNuts: 19, totalSale: 728 },
  { cycle: 16, harvestDate: "2026-04-11", nutsB1: 15, nutsB2: 8, nutsB3: 0, totalBunches: 2, totalNuts: 23, totalSale: 828 },
  { cycle: 15, harvestDate: "2026-02-25", nutsB1: 29, nutsB2: 34, nutsB3: 25, totalBunches: 3, totalNuts: 88, totalSale: 2146 },
  { cycle: 14, harvestDate: "2026-01-07", nutsB1: 41, nutsB2: 50, nutsB3: 51, totalBunches: 3, totalNuts: 142, totalSale: 2012 },
  { cycle: 13, harvestDate: "2025-11-20", nutsB1: 30, nutsB2: 28, nutsB3: 22, totalBunches: 3, totalNuts: 80, totalSale: 1880 },
  { cycle: 12, harvestDate: "2025-10-05", nutsB1: 22, nutsB2: 19, nutsB3: 0, totalBunches: 2, totalNuts: 41, totalSale: 1435 },
  { cycle: 11, harvestDate: "2025-08-18", nutsB1: 18, nutsB2: 15, nutsB3: 12, totalBunches: 3, totalNuts: 45, totalSale: 1530 },
  { cycle: 10, harvestDate: "2025-07-02", nutsB1: 25, nutsB2: 21, nutsB3: 18, totalBunches: 3, totalNuts: 64, totalSale: 1792 },
  { cycle: 9, harvestDate: "2025-05-16", nutsB1: 12, nutsB2: 10, nutsB3: 0, totalBunches: 2, totalNuts: 22, totalSale: 770 },
  { cycle: 8, harvestDate: "2025-03-30", nutsB1: 33, nutsB2: 29, nutsB3: 24, totalBunches: 3, totalNuts: 86, totalSale: 2064 },
  { cycle: 7, harvestDate: "2025-02-11", nutsB1: 20, nutsB2: 17, nutsB3: 0, totalBunches: 2, totalNuts: 37, totalSale: 1258 },
]

// ===========================================================================
// 2) Cycle & Harvest View — cycle / date-range summary
// ===========================================================================

export interface CycleSummary {
  totalHarvests: number
  totalBunches: number
  totalNuts: number
  averageNuts: number
  lifetimeSale: number
}

/** Headline totals shown as summary cards on the Cycle View page. */
export const cycleSummary: CycleSummary = {
  totalHarvests: 1482,
  totalBunches: 2641,
  totalNuts: 28302,
  averageNuts: 19.1,
  lifetimeSale: 982000,
}

export type CycleStatus = "Locked" | "Open"

export interface HarvestCycleRow {
  cycle: number
  startDate: string
  endDate: string
  status: CycleStatus
  trees: number
  bunches: number
  nuts: number
  /** Average sale price per nut, in Rupees */
  salePrice: number
  /** Total sale value for the cycle, in Rupees */
  totalSale: number
}

/** All harvest cycles (newest first). */
export const harvestCycleRows: HarvestCycleRow[] = [
  { cycle: 18, startDate: "2026-06-26", endDate: "2026-07-02", status: "Locked", trees: 1482, bunches: 2641, nuts: 28302, salePrice: 34.7, totalSale: 982000 },
  { cycle: 17, startDate: "2026-05-21", endDate: "2026-05-25", status: "Locked", trees: 2095, bunches: 2321, nuts: 25185, salePrice: 38.32, totalSale: 965089 },
  { cycle: 16, startDate: "2026-04-01", endDate: "2026-04-17", status: "Locked", trees: 2096, bunches: 2188, nuts: 19057, salePrice: 36.01, totalSale: 686207 },
  { cycle: 15, startDate: "2026-02-25", endDate: "2026-03-28", status: "Locked", trees: 2096, bunches: 3880, nuts: 54043, salePrice: 24.39, totalSale: 1317987 },
  { cycle: 14, startDate: "2025-12-30", endDate: "2026-01-13", status: "Locked", trees: 2096, bunches: 2121, nuts: 35689, salePrice: 14.17, totalSale: 505632 },
  { cycle: 13, startDate: "2025-11-10", endDate: "2025-11-24", status: "Locked", trees: 2094, bunches: 2402, nuts: 31204, salePrice: 20.15, totalSale: 628760 },
  { cycle: 12, startDate: "2025-09-22", endDate: "2025-10-06", status: "Locked", trees: 2090, bunches: 2255, nuts: 27880, salePrice: 22.4, totalSale: 624512 },
  { cycle: 11, startDate: "2025-08-05", endDate: "2025-08-19", status: "Locked", trees: 2088, bunches: 2610, nuts: 33150, salePrice: 18.9, totalSale: 626535 },
  { cycle: 10, startDate: "2025-06-18", endDate: "2025-07-02", status: "Locked", trees: 2085, bunches: 2180, nuts: 24960, salePrice: 26.1, totalSale: 651456 },
  { cycle: 9, startDate: "2025-05-01", endDate: "2025-05-15", status: "Locked", trees: 2080, bunches: 1990, nuts: 21540, salePrice: 28.75, totalSale: 619275 },
  { cycle: 8, startDate: "2025-03-14", endDate: "2025-03-28", status: "Locked", trees: 2078, bunches: 2340, nuts: 29870, salePrice: 19.6, totalSale: 585452 },
  { cycle: 7, startDate: "2025-01-25", endDate: "2025-02-08", status: "Locked", trees: 2075, bunches: 2150, nuts: 22410, salePrice: 25.3, totalSale: 566973 },
]

// ===========================================================================
// 3) Tree Performance — Plot 1 & Plot 2 classification bands
// ===========================================================================

/** Harvests included in the performance calculation window (newest first). */
export const performanceCyclesUsed: number[] = [18, 17, 16, 15, 14, 13, 12, 11, 10, 9]

export interface PerformanceRow {
  rank: number
  /** Category label, includes a leading badge emoji as shown in the reference. */
  category: string
  criteria: string
  treeCount: number
  minNuts: number
  maxNuts: number
  averageNuts: number
}

/** Plot 1 — tree numbers 1 to 999. */
export const plot1Performance: PerformanceRow[] = [
  { rank: 1, category: "💯 Century Maker", criteria: "Over 400 nuts in last 10 harvests", treeCount: 62, minNuts: 401, maxNuts: 545, averageNuts: 434.58 },
  { rank: 2, category: "🔥 Match Winner", criteria: "300 to 399 nuts in last 10 harvests", treeCount: 275, minNuts: 300, maxNuts: 398, averageNuts: 341.62 },
  { rank: 3, category: "👍 Reliable Batter", criteria: "225 to 299 nuts in last 10 harvests", treeCount: 208, minNuts: 225, maxNuts: 299, averageNuts: 264.79 },
  { rank: 4, category: "😬 Tail Ender", criteria: "175 to 224 nuts in last 10 harvests", treeCount: 68, minNuts: 176, maxNuts: 224, averageNuts: 199.31 },
  { rank: 5, category: "🪑 Bench Player", criteria: "Less than 175 nuts in last 10 harvests", treeCount: 341, minNuts: 0, maxNuts: 172, averageNuts: 26.37 },
]

/** Plot 2 — tree numbers above 1000. */
export const plot2Performance: PerformanceRow[] = [
  { rank: 1, category: "🔥 Match Winner", criteria: "200 to 299 nuts in last 10 harvests", treeCount: 36, minNuts: 200, maxNuts: 290, averageNuts: 224.58 },
  { rank: 2, category: "👍 Reliable Batter", criteria: "150 to 199 nuts in last 10 harvests", treeCount: 145, minNuts: 150, maxNuts: 198, averageNuts: 170.91 },
  { rank: 3, category: "😬 Tail Ender", criteria: "100 to 149 nuts in last 10 harvests", treeCount: 359, minNuts: 100, maxNuts: 149, averageNuts: 123.9 },
  { rank: 4, category: "🪑 Bench Player", criteria: "Less than 100 nuts in last 10 harvests", treeCount: 623, minNuts: 0, maxNuts: 99, averageNuts: 39.33 },
]
