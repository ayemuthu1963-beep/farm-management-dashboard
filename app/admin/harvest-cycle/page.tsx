import Link from "next/link"
import { ArrowLeft, CalendarRange, DatabaseZap } from "lucide-react"
import { HarvestCycleAdminClient, type HarvestCycleSummary } from "@/components/admin/harvest-cycle-admin-client"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

const HARVEST_CYCLE_FETCH_ATTEMPTS = 2
const HARVEST_CYCLE_RETRY_DELAY_MS = 250

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapCycle(row: ApiCycleRow): HarvestCycleSummary {
  return {
    harvestCycle: row.harvest_cycle,
    harvestStartDate: row.harvest_start_date,
    harvestEndDate: row.harvest_end_date,
    harvestStatus: row.harvest_status,
    totalSaleValue: toNumber(row.total_sale_value),
    totalTreesHarvested: row.total_trees_harvested,
    totalBunches: row.total_bunches,
    totalNuts: row.total_nuts,
    salePricePerNut: toNumber(row.sale_price_per_nut),
  }
}

async function fetchCycles(): Promise<HarvestCycleSummary[]> {
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    throw new Error("Harvest API credentials are not configured.")
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= HARVEST_CYCLE_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/cycles`, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        const error = new Error(`Harvest API returned HTTP ${response.status}.`)
        if (response.status < 500 || attempt === HARVEST_CYCLE_FETCH_ATTEMPTS) {
          throw error
        }
        lastError = error
      } else {
        const rows = (await response.json()) as ApiCycleRow[]
        return rows.map(mapCycle)
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Harvest Cycle data request failed.")
      if (
        attempt === HARVEST_CYCLE_FETCH_ATTEMPTS ||
        /^Harvest API returned HTTP 4\d\d\.$/.test(lastError.message)
      ) {
        throw lastError
      }
    }

    await new Promise((resolve) => setTimeout(resolve, HARVEST_CYCLE_RETRY_DELAY_MS))
  }

  throw lastError ?? new Error("Harvest Cycle data request failed.")
}

export default async function HarvestCycleAdminPage() {
  const cycles = await fetchCycles()
  const latestCycle = cycles[0] ?? null
  const openCycle = cycles.find((cycle) => cycle.harvestStatus === "Open") ?? null
  const lastClosedCycle = cycles.find((cycle) => cycle.harvestStatus !== "Open") ?? null

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Admin Console
        </Link>
        <PreviewAdminNotice />
          <div className="mt-4 flex items-start gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarRange className="size-7" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">Preview Admin</p>
              <h1 className="mt-2 text-3xl font-black uppercase text-foreground">Harvest Cycle Admin</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-muted-foreground">
                Open and maintain Harvest Cycles in the MFMS Preview database only. Cycle 19 is prepared for a 25 July 2026 start date; the End Date is still required before opening.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            Automatic Preview Harvest sync is disabled. Use Manual ODK Harvest Sync to scan, review and import submissions.
          </p>
          <Link
            href="/admin/harvest-sync"
            className="group block rounded-2xl border border-primary/20 bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <DatabaseZap className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black uppercase text-foreground">Manual ODK Harvest Sync</h2>
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
                      Auto Sync Disabled
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm font-medium text-muted-foreground">
                    Scan Preview ODK submissions, review duplicates or unmatched trees, and import approved Harvest records manually.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground group-hover:bg-primary/90">
                Open Manual Sync
              </span>
            </div>
          </Link>
        </section>

        <HarvestCycleAdminClient cycles={cycles} latestCycle={latestCycle} openCycle={openCycle} lastClosedCycle={lastClosedCycle} />
      </div>
    </DashboardShell>
  )
}
