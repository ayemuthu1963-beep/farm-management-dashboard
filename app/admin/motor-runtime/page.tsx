import Link from "next/link"
import { ArrowLeft, Gauge } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { MotorRuntimeAdminClient } from "@/components/admin/motor-runtime-admin-client"
import { PreviewAdminNotice, getPreviewDatabaseLabel } from "@/components/admin/preview-admin-notice"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"

interface RecentRuntimeEntry {
  id: number
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  total_minutes: number
  remarks: string | null
  source: string
  created_at: string
}

function isRecentRuntimeEntry(value: unknown): value is RecentRuntimeEntry {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    Number.isInteger(row.id) &&
    typeof row.entry_date === "string" &&
    typeof row.plot === "string" &&
    Number.isInteger(row.motor_no) &&
    Number.isInteger(row.valve_no) &&
    Number.isInteger(row.hours) &&
    Number.isInteger(row.minutes) &&
    Number.isInteger(row.total_minutes) &&
    (row.remarks === null || typeof row.remarks === "string") &&
    typeof row.source === "string" &&
    typeof row.created_at === "string"
  )
}

async function loadRecentEntries(): Promise<{ entries: RecentRuntimeEntry[]; error: string | null }> {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return { entries: [], error: `Preview target validation failed: ${targetErrors.join(" ")}` }
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return { entries: [], error: "Harvest API credentials are not configured." }
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/motor-runtime/entries?limit=20`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!response.ok) {
      return { entries: [], error: `Harvest API returned ${response.status} while loading recent entries.` }
    }

    const data = await response.json()
    if (!Array.isArray(data) || data.length > 20 || !data.every(isRecentRuntimeEntry)) {
      return { entries: [], error: "Harvest API returned an invalid recent-entry response." }
    }
    return { entries: data, error: null }
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : "Unknown Motor Runtime load error.",
    }
  }
}

export default async function AdminMotorRuntimePage() {
  const { entries, error } = await loadRecentEntries()

  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        <Panel title="Motor Runtime Entry" icon={Gauge}>
          <MotorRuntimeAdminClient
            recentEntries={entries}
            databaseDisplayName={getPreviewDatabaseLabel()}
            loadError={error}
          />
        </Panel>
      </div>
    </DashboardShell>
  )
}
