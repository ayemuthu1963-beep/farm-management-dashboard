import Link from "next/link"
import { ArrowLeft, Droplets } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { WellWaterAdminClient, type WellLatestReading, type WellSetting } from "@/components/admin/well-water-admin-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"

interface WellSummaryResponse {
  total_readings?: number
  latest_reading_date?: string | null
  latest?: Array<{
    well_code?: string
    well_name?: string
    reading_date?: string | null
    reading_time?: string | null
    feet?: number | null
    inches?: number | null
    total_inches?: number | null
    capacity_liters?: number | null
    liters_per_inch?: number | null
    level_feet_decimal?: number | null
  }>
}

interface WellSettingResponse {
  well_code?: string
  well_name?: string
  capacity_liters?: number
  liters_per_inch?: number
  total_depth_inches?: number | null
  calculation_method?: string | null
  reference_offset_inches?: number | null
}

interface WellSummary {
  totalReadings: number
  latestReadingDate: string | null
  latest: WellLatestReading[]
}

const EMPTY_SUMMARY: WellSummary = {
  totalReadings: 0,
  latestReadingDate: null,
  latest: [],
}

function parseNullableFinite(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseSettings(rows: unknown): WellSetting[] | null {
  if (!Array.isArray(rows) || rows.length !== 2) return null
  const parsed: WellSetting[] = []
  for (const raw of rows as WellSettingResponse[]) {
    if (
      (raw.well_code !== "well1" && raw.well_code !== "well2") ||
      typeof raw.well_name !== "string" ||
      !raw.well_name.trim() ||
      typeof raw.capacity_liters !== "number" ||
      !Number.isInteger(raw.capacity_liters) ||
      raw.capacity_liters <= 0 ||
      typeof raw.liters_per_inch !== "number" ||
      !Number.isInteger(raw.liters_per_inch) ||
      raw.liters_per_inch <= 0 ||
      (raw.total_depth_inches !== null && raw.total_depth_inches !== undefined && (!Number.isInteger(raw.total_depth_inches) || raw.total_depth_inches <= 0)) ||
      (raw.calculation_method !== null && raw.calculation_method !== undefined && !["CAPACITY_MINUS_TAPE", "REMAINING_COLUMN_CAPPED"].includes(raw.calculation_method)) ||
      (raw.reference_offset_inches !== null && raw.reference_offset_inches !== undefined && (!Number.isInteger(raw.reference_offset_inches) || raw.reference_offset_inches < 0))
    ) {
      return null
    }
    parsed.push({
      wellCode: raw.well_code,
      wellName: raw.well_name,
      capacityLiters: raw.capacity_liters,
      litersPerInch: raw.liters_per_inch,
      totalDepthInches: raw.total_depth_inches ?? null,
      calculationMethod: raw.calculation_method ?? null,
      referenceOffsetInches: raw.reference_offset_inches ?? null,
    })
  }
  return new Set(parsed.map((row) => row.wellCode)).size === 2 ? parsed : null
}

function parseSummary(data: WellSummaryResponse): WellSummary | null {
  if (typeof data.total_readings !== "number" || !Number.isInteger(data.total_readings) || data.total_readings < 0 || !Array.isArray(data.latest)) return null
  const latest: WellLatestReading[] = []
  for (const row of data.latest) {
    const feet = parseNullableFinite(row.feet)
    const inches = parseNullableFinite(row.inches)
    const totalInches = parseNullableFinite(row.total_inches)
    const capacityLiters = parseNullableFinite(row.capacity_liters)
    const litersPerInch = parseNullableFinite(row.liters_per_inch)
    const levelFeetDecimal = parseNullableFinite(row.level_feet_decimal)
    if (
      (row.well_code !== "well1" && row.well_code !== "well2") ||
      typeof row.well_name !== "string" ||
      !row.well_name.trim() ||
      (row.reading_date !== null && row.reading_date !== undefined && typeof row.reading_date !== "string") ||
      (row.reading_time !== null && row.reading_time !== undefined && typeof row.reading_time !== "string") ||
      feet === undefined ||
      inches === undefined ||
      totalInches === undefined ||
      capacityLiters === undefined ||
      litersPerInch === undefined ||
      levelFeetDecimal === undefined
    ) {
      return null
    }
    latest.push({
      wellCode: row.well_code,
      wellName: row.well_name,
      readingDate: row.reading_date ?? null,
      readingTime: row.reading_time ?? null,
      feet,
      inches,
      totalInches,
      capacityLiters,
      litersPerInch,
      levelFeetDecimal,
    })
  }
  return {
    totalReadings: data.total_readings,
    latestReadingDate: data.latest_reading_date ?? null,
    latest,
  }
}

async function loadWellSummary(): Promise<{ summary: WellSummary; settings: WellSetting[]; error: string | null }> {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return { summary: EMPTY_SUMMARY, settings: [], error: `Preview target validation failed: ${targetErrors.join(" ")}` }
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return { summary: EMPTY_SUMMARY, settings: [], error: "Harvest API credentials are not configured." }
  }

  try {
    const headers = { Authorization: authHeader, Accept: "application/json" }
    const [summaryResponse, settingsResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/well-water/summary`, { headers, cache: "no-store" }),
      fetch(`${getApiBaseUrl()}/api/well-water/settings`, { headers, cache: "no-store" }),
    ])
    if (!summaryResponse.ok) {
      return {
        summary: EMPTY_SUMMARY,
        settings: [],
        error: `Harvest API returned ${summaryResponse.status} while loading Well Water status.`,
      }
    }
    if (!settingsResponse.ok) {
      return {
        summary: EMPTY_SUMMARY,
        settings: [],
        error: `Harvest API returned ${settingsResponse.status} while loading Well settings.`,
      }
    }

    const summary = parseSummary((await summaryResponse.json()) as WellSummaryResponse)
    const settings = parseSettings(await settingsResponse.json())
    if (!summary || !settings) {
      return { summary: EMPTY_SUMMARY, settings: [], error: "Harvest API returned malformed Well Water data." }
    }
    return { summary, settings, error: null }
  } catch (error) {
    return {
      summary: EMPTY_SUMMARY,
      settings: [],
      error: error instanceof Error ? error.message : "Unknown Well Water load error.",
    }
  }
}

export default async function AdminWellWaterPage() {
  const { summary, settings, error } = await loadWellSummary()

  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        {error ? (
          <Panel title="Well Water Status" icon={Droplets}>
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-bold">Unable to load Well Water status.</p>
              <p className="mt-1">{error}</p>
            </div>
          </Panel>
        ) : (
          <WellWaterAdminClient summary={summary} settings={settings} />
        )}
      </div>
    </DashboardShell>
  )
}
