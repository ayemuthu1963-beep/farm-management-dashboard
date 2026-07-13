import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { bandForCount } from "@/lib/beetle-data"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type TrapType = "Rhinoceros Beetle" | "Red Palm Weevil" | "Unknown"

interface ApiLocationRow {
  trap_no: string
  trap_type: string
  latitude: string | number
  longitude: string | number
  active: boolean
  cumulative_beetle_count?: string | number | null
  latest_inspection_date?: string | null
  latest_count?: string | number | null
  records_count?: string | number | null
  cumulative_count_start_date?: string | null
  pheromone_lure_installed_date?: string | null
}

interface BeetleMarker {
  trapNo: string
  trapType: TrapType
  latitude: number
  longitude: number
  cumulativeCount: number
  latestInspectionDate: string
  latestCount: number
  recordsCount: number
  pheromoneInstalledOn: string
  resetDate: string
  countBand: "Very Low" | "Low" | "Medium" | "High" | "Very High"
}

function normalizeTrapType(value: string): TrapType {
  if (value === "Red Palm Weevil") return "Red Palm Weevil"
  if (value === "Rhinoceros Beetle") return "Rhinoceros Beetle"
  return "Unknown"
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not connected yet"
  return value
}

function toMarker(row: ApiLocationRow): BeetleMarker {
  const cumulativeCount = toNumber(row.cumulative_beetle_count)

  return {
    trapNo: `Trap ${row.trap_no}`,
    trapType: normalizeTrapType(row.trap_type),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    cumulativeCount,
    latestInspectionDate: formatDate(row.latest_inspection_date),
    latestCount: toNumber(row.latest_count),
    recordsCount: toNumber(row.records_count),
    pheromoneInstalledOn: formatDate(row.pheromone_lure_installed_date),
    resetDate: formatDate(row.cumulative_count_start_date),
    countBand: bandForCount(cumulativeCount).band,
  }
}

export async function GET() {
  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured for Beetle Trap markers." }, { status: 500 })
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/beetle-trap/locations`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Harvest API returned ${response.status} while loading Beetle Trap locations.` },
        { status: 502 },
      )
    }

    const rows = (await response.json()) as ApiLocationRow[]
    const markers = rows.filter((row) => row.active !== false).map(toMarker)

    return NextResponse.json({
      markers,
      source: {
        databaseTables: ["beetle_trap_locations", "beetle_trap_counts", "beetle_trap_admin_settings"],
        activeLocations: markers.length,
        countsConnected: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Beetle Trap marker API error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
