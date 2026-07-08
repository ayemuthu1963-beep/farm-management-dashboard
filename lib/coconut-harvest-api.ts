import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import type { CycleSummary, HarvestCycleRow, CycleStatus } from "@/lib/coconut-harvest-data"

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

export interface CycleViewData {
  cycleSummary: CycleSummary
  harvestCycleRows: HarvestCycleRow[]
  harvestCycleOptions: number[]
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
    throw new Error(`Harvest API returned ${response.status}`)
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
