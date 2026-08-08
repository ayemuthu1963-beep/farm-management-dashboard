import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface BeetleDashboardResponse {
  summary?: {
    total_traps?: number
    rhinoceros_traps?: number
    red_palm_weevil_traps?: number
  }
  admin_settings?: {
    cumulative_count_start_date?: string | null
    pheromone_lure_installed_date?: string | null
    remarks?: string | null
    source?: string | null
    created_at?: string | null
    updated_at?: string | null
  } | null
  latest_water_change?: {
    water_changed_on?: string | null
  } | null
}

interface BeetleLocationResponse {
  trap_no?: string
  trap_type?: string
  latitude?: number | string
  longitude?: number | string
}

const VALID_TRAP_TYPES = new Set(["Red Palm Weevil", "Rhinoceros Beetle"])

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseLocation(row: BeetleLocationResponse) {
  const latitude = parseCoordinate(row.latitude)
  const longitude = parseCoordinate(row.longitude)
  if (
    typeof row.trap_no === "string" &&
    Boolean(row.trap_no.trim()) &&
    typeof row.trap_type === "string" &&
    VALID_TRAP_TYPES.has(row.trap_type) &&
    latitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude !== null &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return { trapNo: row.trap_no, trapType: row.trap_type, latitude, longitude }
  }
  return null
}

export async function GET() {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return NextResponse.json({ error: `Preview target validation failed: ${targetErrors.join(" ")}` }, { status: 403 })
  }

  const authHeader = getBasicAuthHeader()

  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured." }, { status: 500 })
  }

  try {
    const headers = { Authorization: authHeader, Accept: "application/json" }
    const [dashboardResponse, locationsResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/beetle-trap/dashboard`, { headers, cache: "no-store" }),
      fetch(`${getApiBaseUrl()}/api/beetle-trap/locations`, { headers, cache: "no-store" }),
    ])

    if (!dashboardResponse.ok) {
      return NextResponse.json(
        { error: `Harvest API returned ${dashboardResponse.status} while loading Beetle Trap admin summary.` },
        { status: 502 },
      )
    }
    if (!locationsResponse.ok) {
      return NextResponse.json(
        { error: `Harvest API returned ${locationsResponse.status} while loading Beetle Trap locations.` },
        { status: 502 },
      )
    }

    const dashboard = (await dashboardResponse.json()) as BeetleDashboardResponse
    const locationRows = (await locationsResponse.json()) as BeetleLocationResponse[]
    if (!Array.isArray(locationRows)) {
      return NextResponse.json({ error: "Harvest API returned an invalid Beetle Trap location response." }, { status: 502 })
    }
    if (
      !dashboard.summary ||
      !isNonNegativeInteger(dashboard.summary.total_traps) ||
      !isNonNegativeInteger(dashboard.summary.red_palm_weevil_traps) ||
      !isNonNegativeInteger(dashboard.summary.rhinoceros_traps)
    ) {
      return NextResponse.json({ error: "Harvest API returned an invalid Beetle Trap summary response." }, { status: 502 })
    }
    const locations = locationRows.map(parseLocation)
    if (locations.some((location) => location === null)) {
      return NextResponse.json({ error: "Harvest API returned malformed Beetle Trap location data." }, { status: 502 })
    }
    if (
      new Set(locationRows.map((row) => row.trap_no)).size !== locationRows.length ||
      dashboard.summary.total_traps !== locationRows.length ||
      dashboard.summary.red_palm_weevil_traps + dashboard.summary.rhinoceros_traps !== dashboard.summary.total_traps
    ) {
      return NextResponse.json({ error: "Harvest API returned inconsistent Beetle Trap totals." }, { status: 502 })
    }

    return NextResponse.json({
      latestReset: {
        pheromoneLureInstalledDate: dashboard.admin_settings?.pheromone_lure_installed_date ?? null,
        cumulativeCountStartDate: dashboard.admin_settings?.cumulative_count_start_date ?? null,
        remarks: dashboard.admin_settings?.remarks ?? null,
        source: dashboard.admin_settings?.source ?? null,
        createdAt: dashboard.admin_settings?.created_at ?? null,
        updatedAt: dashboard.admin_settings?.updated_at ?? null,
      },
      latestWaterChange: dashboard.latest_water_change?.water_changed_on ?? null,
      trapSummary: {
        totalTraps: dashboard.summary.total_traps,
        redPalmWeevilTraps: dashboard.summary.red_palm_weevil_traps,
        rhinocerosBeetleTraps: dashboard.summary.rhinoceros_traps,
      },
      locations,
      mode: "preview-admin-save-enabled",
      writesEnabled: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Beetle Trap admin summary error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
