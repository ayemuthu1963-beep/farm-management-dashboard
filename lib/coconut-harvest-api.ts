import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import type { CycleSummary, HarvestCycleRow, CycleStatus, TreeHarvestRow } from "@/lib/coconut-harvest-data"

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

export interface CycleViewData {
  cycleSummary: CycleSummary
  harvestCycleRows: HarvestCycleRow[]
  harvestCycleOptions: number[]
}

export interface TreeViewData {
  treeNo: string
  treeHarvestHistory: TreeHarvestRow[]
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
  const harvestCycleRows = apiRows.map(mapCycleRow)
  const latest = harvestCycleRows[0]

  return {
    harvestCycleRows,
    harvestCycleOptions: harvestCycleRows.map((row) => row.cycle),
    cycleSummary: latest
      ? {
          totalHarvests: latest.trees,
          totalNuts: latest.nuts,
          averageNuts: latest.trees > 0 ? latest.nuts / latest.trees : 0,
          lifetimeSale: latest.totalSale,
        }
      : {
          totalHarvests: 0,
          totalNuts: 0,
          averageNuts: 0,
          lifetimeSale: 0,
        },
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
