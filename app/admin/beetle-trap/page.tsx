import Link from "next/link"
import { ArrowLeft, Bug } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { BeetleTrapAdminClient } from "@/components/admin/beetle-trap-admin-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"
import { PreviewOdkSourceCard } from "@/components/odk/preview-odk-source-card"

export const dynamic = "force-dynamic"

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

interface AdminSummary {
  latestReset: {
    pheromoneLureInstalledDate: string | null
    cumulativeCountStartDate: string | null
    remarks: string | null
    source: string | null
    createdAt: string | null
    updatedAt: string | null
  }
  latestWaterChange: string | null
  trapSummary: {
    totalTraps: number
    redPalmWeevilTraps: number
    rhinocerosBeetleTraps: number
  }
  locations: Array<{
    trapNo: string
    trapType: string
    latitude: number
    longitude: number
  }>
  writesEnabled: boolean
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

function parseLocations(rows: BeetleLocationResponse[]): AdminSummary["locations"] | null {
  const parsed: AdminSummary["locations"] = []
  const seenTrapNumbers = new Set<string>()
  for (const row of rows) {
    const latitude = parseCoordinate(row.latitude)
    const longitude = parseCoordinate(row.longitude)
    if (
      typeof row.trap_no !== "string" ||
      !row.trap_no.trim() ||
      typeof row.trap_type !== "string" ||
      !VALID_TRAP_TYPES.has(row.trap_type) ||
      latitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude === null ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null
    }
    if (seenTrapNumbers.has(row.trap_no)) return null
    seenTrapNumbers.add(row.trap_no)
    parsed.push({
      trapNo: row.trap_no,
      trapType: row.trap_type,
      latitude,
      longitude,
    })
  }
  return parsed
}

async function loadAdminSummary(): Promise<{ summary: AdminSummary | null; error: string | null }> {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return { summary: null, error: `Preview target validation failed: ${targetErrors.join(" ")}` }
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return { summary: null, error: "Harvest API credentials are not configured." }
  }

  try {
    const headers = { Authorization: authHeader, Accept: "application/json" }
    const [dashboardResponse, locationsResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/beetle-trap/dashboard`, { headers, cache: "no-store" }),
      fetch(`${getApiBaseUrl()}/api/beetle-trap/locations`, { headers, cache: "no-store" }),
    ])

    if (!dashboardResponse.ok) {
      return { summary: null, error: `Harvest API returned ${dashboardResponse.status} while loading Beetle Trap settings.` }
    }
    if (!locationsResponse.ok) {
      return { summary: null, error: `Harvest API returned ${locationsResponse.status} while loading Beetle Trap locations.` }
    }

    const dashboard = (await dashboardResponse.json()) as BeetleDashboardResponse
    const locationRows = (await locationsResponse.json()) as BeetleLocationResponse[]
    if (!Array.isArray(locationRows)) {
      return { summary: null, error: "Harvest API returned an invalid Beetle Trap location response." }
    }
    if (
      !dashboard.summary ||
      !isNonNegativeInteger(dashboard.summary.total_traps) ||
      !isNonNegativeInteger(dashboard.summary.red_palm_weevil_traps) ||
      !isNonNegativeInteger(dashboard.summary.rhinoceros_traps)
    ) {
      return { summary: null, error: "Harvest API returned an invalid Beetle Trap summary response." }
    }
    const locations = parseLocations(locationRows)
    if (!locations) {
      return { summary: null, error: "Harvest API returned malformed Beetle Trap location data." }
    }
    if (
      dashboard.summary.total_traps !== locations.length ||
      dashboard.summary.red_palm_weevil_traps + dashboard.summary.rhinoceros_traps !== dashboard.summary.total_traps
    ) {
      return { summary: null, error: "Harvest API returned inconsistent Beetle Trap totals." }
    }

    return {
      summary: {
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
        writesEnabled: true,
      },
      error: null,
    }
  } catch (error) {
    return {
      summary: null,
      error: error instanceof Error ? error.message : "Unknown Beetle Trap load error.",
    }
  }
}

export default async function AdminBeetleTrapPage() {
  const { summary, error } = await loadAdminSummary()

  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        <PreviewOdkSourceCard form="beetleTrap" />
        {error || !summary ? (
          <Panel title="Beetle Trap Status" icon={Bug}>
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-bold">Unable to load Beetle Trap admin data.</p>
              <p className="mt-1">{error ?? "Unknown Beetle Trap load error."}</p>
            </div>
          </Panel>
        ) : (
          <BeetleTrapAdminClient summary={summary} />
        )}
      </div>
    </DashboardShell>
  )
}
