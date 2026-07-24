import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import type { CycleSummary, HarvestCycleRow, CycleStatus, PerformanceRow, TreeHarvestRow } from "@/lib/coconut-harvest-data"

interface ApiCycleRow {
  harvest_cycle: string
  harvest_start_date: string
  harvest_end_date: string
  harvest_status: string
  total_sale_value: string | number | null
  total_trees_harvested: number | null
  total_bunches: number | null
  total_nuts: number | null
  sale_price_per_nut: string | number | null
}

interface ApiTreeOption {
  tree_no: string
}

interface ApiTreeHistoryRecord {
  harvest_date: string
  harvest_cycle: string | null
  bunch1_nuts: number | null
  bunch2_nuts: number | null
  bunch3_nuts: number | null
  total_bunches: number | null
  total_nuts: number | null
  total_sale: string | number | null
}

interface ApiTreePerformanceCycle {
  harvest_cycle: string
}

interface ApiTreePerformanceRow {
  plot: "Plot 1" | "Plot 2" | string
  category: string
  criteria: string
  rank_order: number | null
  tree_count: number | null
  min_nuts: number | null
  max_nuts: number | null
  average_nuts: string | number | null
}

interface ApiTreePerformanceDetail {
  plot: "Plot 1" | "Plot 2" | string
  category: string
  tree_no: string
  missed_harvests: number | null
}

export interface TreePerformanceCategoryRow {
  treeNo: string
  totalNutsLast10Cycles: number
  averageNuts: number
  harvestsCount: number
  missedHarvests: number
  minNuts: number
  maxNuts: number
}

export interface TreePerformanceCategoryData {
  plot: string
  category: string
  rows: TreePerformanceCategoryRow[]
  usedMockFallback: boolean
}

export interface CycleViewData {
  cycleSummary: CycleSummary
  harvestCycleRows: HarvestCycleRow[]
  harvestCycleOptions: number[]
}

export interface HarvestSummaryData {
  label: string
  harvestCycle: string | null
  startDate: string
  endDate: string
  gapDays: number | null
  treesHarvested: number
  totalBunches: number
  totalNuts: number
  salePrice: number
  totalSale: number
}

export interface TreeViewData {
  treeNo: string
  treeHarvestHistory: TreeHarvestRow[]
}

export interface TreePerformanceData {
  performanceCyclesUsed: number[]
  plot1Performance: PerformanceRow[]
  plot2Performance: PerformanceRow[]
}

export interface DetailedQueryFilters {
  treeFrom?: string
  treeTo?: string
  cycleFrom?: string
  cycleTo?: string
  dateFrom?: string
  dateTo?: string
  nutsFrom?: string
  nutsTo?: string
  saleFrom?: string
  saleTo?: string
  missedFrom?: string
  missedTo?: string
  plot1Classification?: string
  plot2Classification?: string
}

export interface DetailedQueryRow {
  treeNo: string
  harvestCycle: string
  harvestDate: string
  nutsB1: number
  nutsB2: number
  nutsB3: number
  totalBunches: number
  totalNuts: number
  totalSale: number
  missedHarvests: number
  plot: string
  classification: string
}

export interface DetailedQueryData {
  rows: DetailedQueryRow[]
  usedMockFallback: boolean
}

export class HarvestApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0
  }

  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toStatus(value: string): CycleStatus {
  return value === "Open" ? "Open" : "Locked"
}

function toCycleNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function mapCycleRow(row: ApiCycleRow): HarvestCycleRow {
  return {
    cycle: toCycleNumber(row.harvest_cycle),
    startDate: row.harvest_start_date,
    endDate: row.harvest_end_date,
    status: toStatus(row.harvest_status),
    trees: row.total_trees_harvested ?? 0,
    bunches: row.total_bunches ?? 0,
    nuts: row.total_nuts ?? 0,
    salePrice: toNumber(row.sale_price_per_nut),
    totalSale: toNumber(row.total_sale_value),
  }
}

function mapTreeHistoryRecord(row: ApiTreeHistoryRecord): TreeHarvestRow {
  return {
    cycle: toCycleNumber(row.harvest_cycle ?? "0"),
    harvestDate: row.harvest_date,
    nutsB1: row.bunch1_nuts ?? 0,
    nutsB2: row.bunch2_nuts ?? 0,
    nutsB3: row.bunch3_nuts ?? 0,
    totalBunches: row.total_bunches ?? 0,
    totalNuts: row.total_nuts ?? 0,
    totalSale: toNumber(row.total_sale),
  }
}

function categoryWithBadge(category: string): string {
  const badgeByCategory: Record<string, string> = {
    "Century Maker": "\u{1F4AF}",
    "Match Winner": "\u{1F525}",
    "Reliable Batter": "\u{1F44D}",
    "Tail Ender": "\u{1F62C}",
    "Bench Player": "\u{1FA91}",
  }

  return `${badgeByCategory[category] ?? ""} ${category}`.trim()
}

function categoryWithoutBadge(category: string): string {
  return category.replace(/^[^\p{L}\p{N}]+/u, "").trim()
}

function mapPerformanceRow(row: ApiTreePerformanceRow): PerformanceRow {
  return {
    rank: row.rank_order ?? 0,
    category: categoryWithBadge(row.category),
    criteria: row.criteria.replaceAll("cycles", "harvests"),
    treeCount: row.tree_count ?? 0,
    minNuts: row.min_nuts ?? 0,
    maxNuts: row.max_nuts ?? 0,
    averageNuts: toNumber(row.average_nuts),
  }
}

async function mapPerformanceCategoryDetail(
  detail: ApiTreePerformanceDetail,
  authHeader: string,
  lastCycles: Set<number>,
): Promise<TreePerformanceCategoryRow> {
  const records = (await fetchRawTreeHistory(detail.tree_no, authHeader)).filter((record) => {
    return lastCycles.has(toCycleNumber(record.harvest_cycle ?? "0"))
  })

  const nutsByHarvest = records.map((record) => record.total_nuts ?? 0)
  const totalNutsLast10Cycles = nutsByHarvest.reduce((sum, nuts) => sum + nuts, 0)
  const minNuts = nutsByHarvest.length > 0 ? Math.min(...nutsByHarvest) : 0
  const maxNuts = nutsByHarvest.length > 0 ? Math.max(...nutsByHarvest) : 0

  return {
    treeNo: detail.tree_no,
    totalNutsLast10Cycles,
    averageNuts: lastCycles.size > 0 ? totalNutsLast10Cycles / lastCycles.size : 0,
    harvestsCount: records.length,
    missedHarvests: detail.missed_harvests ?? 0,
    minNuts,
    maxNuts,
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

async function fetchTreesHarvestedWithNuts(row: HarvestCycleRow, authHeader: string): Promise<number | null> {
  const params = new URLSearchParams({
    start_date: row.startDate,
    end_date: row.endDate,
  })

  const response = await fetch(`${getApiBaseUrl()}/api/export/csv?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: "text/csv",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const csv = await response.text()
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "")

  if (lines.length <= 1 || lines[0] === "no_records") {
    return 0
  }

  const headers = parseCsvLine(lines[0])
  const totalNutsIndex = headers.indexOf("total_nuts")

  if (totalNutsIndex === -1) {
    return null
  }

  return lines.slice(1).reduce((count, line) => {
    const cells = parseCsvLine(line)
    return toNumber(cells[totalNutsIndex]) > 0 ? count + 1 : count
  }, 0)
}

export async function fetchCycleViewData(): Promise<CycleViewData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const response = await fetch(`${getApiBaseUrl()}/api/cycles`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const apiRows = (await response.json()) as ApiCycleRow[]
  const initialHarvestCycleRows = apiRows.map(mapCycleRow)
  const harvestCycleRows = await Promise.all(
    initialHarvestCycleRows.map(async (row) => {
      const treesHarvestedWithNuts = await fetchTreesHarvestedWithNuts(row, authHeader)
      return treesHarvestedWithNuts === null ? row : { ...row, trees: treesHarvestedWithNuts }
    }),
  )
  const latest = harvestCycleRows[0]

  return {
    harvestCycleRows,
    harvestCycleOptions: harvestCycleRows.map((row) => row.cycle),
    cycleSummary: latest
      ? {
          totalHarvests: latest.trees,
          totalBunches: latest.bunches,
          totalNuts: latest.nuts,
          averageNuts: latest.trees > 0 ? latest.nuts / latest.trees : 0,
          lifetimeSale: latest.totalSale,
        }
      : {
          totalHarvests: 0,
          totalBunches: 0,
          totalNuts: 0,
          averageNuts: 0,
          lifetimeSale: 0,
        },
  }
}

export async function fetchHarvestSummaryData(params: {
  harvestCycle?: string
  startDate?: string
  endDate?: string
}): Promise<HarvestSummaryData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const searchParams = new URLSearchParams()
  if (params.harvestCycle) {
    searchParams.set("harvest_cycle", params.harvestCycle)
  } else {
    if (params.startDate) {
      searchParams.set("start_date", params.startDate)
    }
    if (params.endDate) {
      searchParams.set("end_date", params.endDate)
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/api/harvest-summary?${searchParams.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const row = (await response.json()) as {
    label: string
    harvest_cycle: string | null
    start_date: string
    end_date: string
    gap_days: number | null
    trees_harvested: number | null
    total_bunches: number | null
    total_nuts: number | null
    sale_price: string | number | null
    total_sale: string | number | null
  }

  return {
    label: row.label,
    harvestCycle: row.harvest_cycle,
    startDate: row.start_date,
    endDate: row.end_date,
    gapDays: row.gap_days,
    treesHarvested: row.trees_harvested ?? 0,
    totalBunches: row.total_bunches ?? 0,
    totalNuts: row.total_nuts ?? 0,
    salePrice: toNumber(row.sale_price),
    totalSale: toNumber(row.total_sale),
  }
}

export async function fetchTreeNumbers(query = "", limit = 25): Promise<string[]> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  })

  const response = await fetch(`${getApiBaseUrl()}/api/trees?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const rows = (await response.json()) as ApiTreeOption[]
  return rows.map((row) => row.tree_no)
}

export async function fetchTreeViewData(treeNo: string): Promise<TreeViewData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const response = await fetch(`${getApiBaseUrl()}/api/trees/${encodeURIComponent(treeNo)}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const data = (await response.json()) as { records: ApiTreeHistoryRecord[]; tree?: { tree_no?: string } }

  return {
    treeNo: data.tree?.tree_no ?? treeNo,
    treeHarvestHistory: data.records.map(mapTreeHistoryRecord),
  }
}

export async function fetchTreePerformanceData(): Promise<TreePerformanceData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const response = await fetch(`${getApiBaseUrl()}/api/tree-performance`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const data = (await response.json()) as {
    last_cycles: ApiTreePerformanceCycle[]
    rows: ApiTreePerformanceRow[]
  }

  return {
    performanceCyclesUsed: data.last_cycles.map((cycle) => toCycleNumber(cycle.harvest_cycle)),
    plot1Performance: data.rows.filter((row) => row.plot === "Plot 1").map(mapPerformanceRow),
    plot2Performance: data.rows.filter((row) => row.plot === "Plot 2").map(mapPerformanceRow),
  }
}

export async function fetchTreePerformanceCategoryData(
  plot: string,
  category: string,
): Promise<TreePerformanceCategoryData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const response = await fetch(`${getApiBaseUrl()}/api/tree-performance`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const performance = (await response.json()) as {
    last_cycles: ApiTreePerformanceCycle[]
    details: ApiTreePerformanceDetail[]
  }

  const lastCycles = new Set(performance.last_cycles.map((cycle) => toCycleNumber(cycle.harvest_cycle)))
  const cleanCategory = categoryWithoutBadge(category)

  const selectedDetails = performance.details.filter((detail) => {
    return detail.plot === plot && detail.category === cleanCategory
  })

  const rows: TreePerformanceCategoryRow[] = []
  const batchSize = 25

  for (let index = 0; index < selectedDetails.length; index += batchSize) {
    const batch = selectedDetails.slice(index, index + batchSize)
    rows.push(...(await Promise.all(batch.map((detail) => mapPerformanceCategoryDetail(detail, authHeader, lastCycles)))))
  }

  rows.sort((a, b) => {
    const totalCompare = b.totalNutsLast10Cycles - a.totalNutsLast10Cycles
    if (totalCompare !== 0) {
      return totalCompare
    }

    return a.treeNo.localeCompare(b.treeNo, undefined, { numeric: true, sensitivity: "base" })
  })

  return {
    plot,
    category: cleanCategory,
    rows,
    usedMockFallback: false,
  }
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ""
}

function isAll(value: string | undefined): boolean {
  return isBlank(value) || value === "All"
}

function inTextRange(value: string, from: string | undefined, to: string | undefined): boolean {
  if (!isBlank(from) && value.localeCompare(from!.trim()) < 0) {
    return false
  }

  if (!isBlank(to) && value.localeCompare(to!.trim()) > 0) {
    return false
  }

  return true
}

function toOptionalNumber(value: string | undefined): number | null {
  if (isBlank(value)) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function inNumberRange(value: number, from: string | undefined, to: string | undefined): boolean {
  const min = toOptionalNumber(from)
  const max = toOptionalNumber(to)

  if (min !== null && value < min) {
    return false
  }

  if (max !== null && value > max) {
    return false
  }

  return true
}

function inDateRange(value: string, from: string | undefined, to: string | undefined): boolean {
  if (!isBlank(from) && value < from!.trim()) {
    return false
  }

  if (!isBlank(to) && value > to!.trim()) {
    return false
  }

  return true
}

function detailMatchesClassification(detail: ApiTreePerformanceDetail, filters: DetailedQueryFilters): boolean {
  const plot1 = filters.plot1Classification
  const plot2 = filters.plot2Classification

  if (isAll(plot1) && isAll(plot2)) {
    return true
  }

  if (!isAll(plot1) && detail.plot === "Plot 1" && detail.category === plot1) {
    return true
  }

  if (!isAll(plot2) && detail.plot === "Plot 2" && detail.category === plot2) {
    return true
  }

  return false
}

async function fetchRawTreeHistory(treeNo: string, authHeader: string): Promise<ApiTreeHistoryRecord[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/trees/${encodeURIComponent(treeNo)}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return []
  }

  const data = (await response.json()) as { records: ApiTreeHistoryRecord[] }
  return data.records
}

export async function fetchDetailedQueryData(filters: DetailedQueryFilters): Promise<DetailedQueryData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const response = await fetch(`${getApiBaseUrl()}/api/tree-performance`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new HarvestApiError(`Harvest API returned ${response.status}`, response.status)
  }

  const performance = (await response.json()) as {
    details: ApiTreePerformanceDetail[]
  }

  const candidateDetails = performance.details.filter((detail) => {
    return (
      inTextRange(detail.tree_no, filters.treeFrom, filters.treeTo) &&
      inNumberRange(detail.missed_harvests ?? 0, filters.missedFrom, filters.missedTo) &&
      detailMatchesClassification(detail, filters)
    )
  })

  const rows: DetailedQueryRow[] = []

  for (const detail of candidateDetails) {
    const records = await fetchRawTreeHistory(detail.tree_no, authHeader)

    for (const record of records) {
      const harvestCycle = record.harvest_cycle ?? ""
      const cycleNumber = toCycleNumber(harvestCycle)
      const totalNuts = record.total_nuts ?? 0
      const totalSale = toNumber(record.total_sale)

      if (
        inNumberRange(cycleNumber, filters.cycleFrom, filters.cycleTo) &&
        inDateRange(record.harvest_date, filters.dateFrom, filters.dateTo) &&
        inNumberRange(totalNuts, filters.nutsFrom, filters.nutsTo) &&
        inNumberRange(totalSale, filters.saleFrom, filters.saleTo)
      ) {
        rows.push({
          treeNo: detail.tree_no,
          harvestCycle,
          harvestDate: record.harvest_date,
          nutsB1: record.bunch1_nuts ?? 0,
          nutsB2: record.bunch2_nuts ?? 0,
          nutsB3: record.bunch3_nuts ?? 0,
          totalBunches: record.total_bunches ?? 0,
          totalNuts,
          totalSale,
          missedHarvests: detail.missed_harvests ?? 0,
          plot: detail.plot,
          classification: detail.category,
        })
      }
    }
  }

  rows.sort((a, b) => {
    const dateCompare = b.harvestDate.localeCompare(a.harvestDate)
    if (dateCompare !== 0) {
      return dateCompare
    }

    return a.treeNo.localeCompare(b.treeNo)
  })

  return {
    rows: rows.slice(0, 500),
    usedMockFallback: false,
  }
}
