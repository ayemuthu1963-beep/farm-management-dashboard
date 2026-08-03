import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import type { CycleSummary, HarvestCycleRow, CycleStatus, PerformanceRow, TreeHarvestRow } from "@/lib/coconut-harvest-data"
import { compareTreeNumbers } from "@/lib/tree-number-options"

interface ApiCycleRow {
  harvest_cycle: string
  harvest_start_date: string
  harvest_end_date: string | null
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
  nuts_last_10_cycles: number | null
  average_nuts: string | number | null
  harvests_count: number | null
  missed_harvests: number | null
  min_nuts: number | null
  max_nuts: number | null
  plantation_date: string | null
  months_since_planted: number | null
  lifecycle_status: string | null
}

export interface TreePerformanceCategoryRow {
  treeNo: string
  plantationDate: string | null
  monthsSincePlanted: number | null
  lifecycleStatus: string | null
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

export interface FarmMapTreeHarvestSummary {
  treeNo: string
  status: string | null
  classification: string | null
  lastHarvestDate: string | null
  latestBunches: number | null
  latestNuts: number | null
  currentYearTotalNuts: number | null
  missedHarvestCycles: number | null
  hasHarvestData: boolean
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
    endDate: row.harvest_end_date ?? "",
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
    "Future Better": "\u{1F331}",
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

function mapPerformanceCategoryDetail(
  detail: ApiTreePerformanceDetail,
  lastCycles: Set<number>,
): TreePerformanceCategoryRow {
  const totalNutsLast10Cycles = detail.nuts_last_10_cycles ?? 0

  return {
    treeNo: detail.tree_no,
    plantationDate: detail.plantation_date ?? null,
    monthsSincePlanted: detail.months_since_planted ?? null,
    lifecycleStatus: detail.lifecycle_status ?? null,
    totalNutsLast10Cycles,
    averageNuts: lastCycles.size > 0 ? totalNutsLast10Cycles / lastCycles.size : 0,
    harvestsCount: detail.harvests_count ?? 0,
    missedHarvests: detail.missed_harvests ?? 0,
    minNuts: detail.min_nuts ?? 0,
    maxNuts: detail.max_nuts ?? 0,
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

async function fetchTreeNumberPage(query: string, limit: number, authHeader: string) {
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

export async function fetchTreeNumbers(query = "", limit = 25): Promise<string[]> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  return fetchTreeNumberPage(query, limit, authHeader)
}

const TREE_MASTER_PAGE_SIZE = 100
const NUMERIC_PREFIX_SUFFIXES = [..."0123456789."]
const GENERAL_PREFIX_SUFFIXES = [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.-_"]
const ROOT_PREFIXES = [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"]

export async function fetchAllTreeNumbers(): Promise<string[]> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const treeNumbers = new Set(
    await fetchTreeNumberPage("", TREE_MASTER_PAGE_SIZE, authHeader),
  )
  const pendingPrefixes = [...ROOT_PREFIXES]
  const visitedPrefixes = new Set<string>()

  while (pendingPrefixes.length > 0) {
    const batch = pendingPrefixes.splice(0, 10).filter((prefix) => {
      if (visitedPrefixes.has(prefix)) return false
      visitedPrefixes.add(prefix)
      return true
    })
    if (batch.length === 0) continue

    const pages = await Promise.all(
      batch.map(async (prefix) => ({
        prefix,
        rows: await fetchTreeNumberPage(prefix, TREE_MASTER_PAGE_SIZE, authHeader),
      })),
    )

    for (const { prefix, rows } of pages) {
      for (const treeNo of rows) treeNumbers.add(treeNo)

      if (rows.length === TREE_MASTER_PAGE_SIZE && prefix.length < 50) {
        const suffixes = /^[0-9.]+$/.test(prefix)
          ? NUMERIC_PREFIX_SUFFIXES
          : GENERAL_PREFIX_SUFFIXES
        pendingPrefixes.push(...suffixes.map((suffix) => `${prefix}${suffix}`))
      }
    }
  }

  return [...treeNumbers].sort(compareTreeNumbers)
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

export async function fetchFarmMapTreeHarvestSummary(treeNo: string): Promise<FarmMapTreeHarvestSummary> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const encodedTreeNo = encodeURIComponent(treeNo)
  const detailParams = new URLSearchParams({
    tree_from: treeNo,
    tree_to: treeNo,
  })
  const [treeResponse, performanceResponse] = await Promise.all([
    fetch(`${getApiBaseUrl()}/api/trees/${encodedTreeNo}`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
    fetch(`${getApiBaseUrl()}/api/detailed-query?${detailParams.toString()}`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
  ])

  if (!treeResponse.ok) {
    throw new HarvestApiError(`Harvest API returned ${treeResponse.status}`, treeResponse.status)
  }
  if (!performanceResponse.ok) {
    throw new HarvestApiError(`Harvest API returned ${performanceResponse.status}`, performanceResponse.status)
  }

  const treeData = (await treeResponse.json()) as {
    tree?: { tree_no?: string; status?: string | null }
    summary?: { last_harvest_date?: string | null }
    records?: Array<{
      harvest_date: string
      total_bunches: number | null
      total_nuts: number | null
    }>
    totals?: Array<{
      label: string
      total_nuts: number | null
    }>
  }
  const performanceData = (await performanceResponse.json()) as {
    rows?: Array<{
      tree_no: string
      category: string | null
      missed_harvests: number | null
    }>
  }

  const records = treeData.records ?? []
  const latest = records[0]
  const performance = performanceData.rows?.find((row) => row.tree_no === treeNo)
  const currentYear = String(new Date().getFullYear())
  const currentYearHasRecords = records.some((record) => record.harvest_date.startsWith(`${currentYear}-`))
  const currentYearTotals = treeData.totals?.find((row) => row.label === `Total ${currentYear}`)

  return {
    treeNo: treeData.tree?.tree_no ?? treeNo,
    status: treeData.tree?.status ?? null,
    classification: performance?.category ?? null,
    lastHarvestDate: treeData.summary?.last_harvest_date ?? null,
    latestBunches: latest?.total_bunches ?? null,
    latestNuts: latest?.total_nuts ?? null,
    currentYearTotalNuts: currentYearHasRecords ? (currentYearTotals?.total_nuts ?? null) : null,
    missedHarvestCycles: performance?.missed_harvests ?? null,
    hasHarvestData: records.length > 0,
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

  const rows = selectedDetails.map((detail) => mapPerformanceCategoryDetail(detail, lastCycles))

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

const numericTreeIdentifierPattern = /^\d+(?:\.\d+)?$/

function normalizeNumericTreeIdentifier(value: string): string {
  const [wholePart, fractionalPart = ""] = value.split(".")
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, "")
  const normalizedFraction = fractionalPart.replace(/0+$/, "")
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole
}

function compareNumericTreeIdentifiers(left: string, right: string): number {
  const [leftWhole, leftFraction = ""] = normalizeNumericTreeIdentifier(left).split(".")
  const [rightWhole, rightFraction = ""] = normalizeNumericTreeIdentifier(right).split(".")

  if (leftWhole.length !== rightWhole.length) {
    return leftWhole.length - rightWhole.length
  }

  const wholeCompare = leftWhole.localeCompare(rightWhole)
  if (wholeCompare !== 0) {
    return wholeCompare
  }

  const fractionalLength = Math.max(leftFraction.length, rightFraction.length)
  const normalizedLeftFraction = leftFraction.padEnd(fractionalLength, "0")
  const normalizedRightFraction = rightFraction.padEnd(fractionalLength, "0")
  return normalizedLeftFraction.localeCompare(normalizedRightFraction)
}

function parseTreeRangeBoundary(value: string | undefined): string | null {
  if (isBlank(value)) {
    return null
  }

  const trimmed = value!.trim()
  if (!numericTreeIdentifierPattern.test(trimmed)) {
    throw new Error("Tree Number range requires complete numeric tree identifiers.")
  }

  return normalizeNumericTreeIdentifier(trimmed)
}

function parseNumericTreeIdentifier(value: string): string | null {
  const trimmed = value.trim()
  if (!numericTreeIdentifierPattern.test(trimmed)) {
    return null
  }

  return normalizeNumericTreeIdentifier(trimmed)
}

function inTreeNumberRange(value: string, from: string | undefined, to: string | undefined): boolean {
  if (isBlank(from) && isBlank(to)) {
    return true
  }

  const min = parseTreeRangeBoundary(from)
  const max = parseTreeRangeBoundary(to)

  if (min !== null && max !== null && compareNumericTreeIdentifiers(min, max) > 0) {
    throw new Error("Tree Number From cannot be greater than Tree Number To.")
  }

  const numericTreeNo = parseNumericTreeIdentifier(value)
  if (numericTreeNo === null) {
    return false
  }

  if (min !== null && compareNumericTreeIdentifiers(numericTreeNo, min) < 0) {
    return false
  }

  if (max !== null && compareNumericTreeIdentifiers(numericTreeNo, max) > 0) {
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

export async function fetchDetailedQueryData(filters: DetailedQueryFilters): Promise<DetailedQueryData> {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured")
  }

  const parameterNames: Record<keyof DetailedQueryFilters, string> = {
    treeFrom: "tree_from",
    treeTo: "tree_to",
    cycleFrom: "cycle_from",
    cycleTo: "cycle_to",
    dateFrom: "date_from",
    dateTo: "date_to",
    nutsFrom: "nuts_from",
    nutsTo: "nuts_to",
    saleFrom: "sale_from",
    saleTo: "sale_to",
    missedFrom: "missed_from",
    missedTo: "missed_to",
    plot1Classification: "plot1_classification",
    plot2Classification: "plot2_classification",
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters) as [keyof DetailedQueryFilters, string | undefined][]) {
    if (!isBlank(value) && value !== "All") {
      params.set(parameterNames[key], value!.trim())
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/api/detailed-query?${params}`, {
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
    rows: Array<{
      tree_no: string
      harvest_cycle: string
      harvest_date: string
      bunch1_nuts: number
      bunch2_nuts: number
      bunch3_nuts: number
      total_bunches: number
      total_nuts: number
      total_sale: string | number | null
      missed_harvests: number
      plot: string
      category: string
    }>
  }

  return {
    rows: data.rows.map((row) => ({
      treeNo: row.tree_no,
      harvestCycle: row.harvest_cycle,
      harvestDate: row.harvest_date,
      nutsB1: row.bunch1_nuts ?? 0,
      nutsB2: row.bunch2_nuts ?? 0,
      nutsB3: row.bunch3_nuts ?? 0,
      totalBunches: row.total_bunches ?? 0,
      totalNuts: row.total_nuts ?? 0,
      totalSale: toNumber(row.total_sale),
      missedHarvests: row.missed_harvests ?? 0,
      plot: row.plot,
      classification: row.category,
    })),
    usedMockFallback: false,
  }
}
