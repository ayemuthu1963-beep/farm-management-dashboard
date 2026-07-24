"use client"

import { useEffect, useState } from "react"
import { Droplet, Info } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { WellSection } from "@/components/farm/well-section"
import { SummaryCards } from "@/components/farm/summary-cards"
import {
  buildWellDashboardData,
  emptyWellDashboardData,
  type WellDashboardData,
  type WellDashboardResponse,
} from "@/lib/well-data"

export default function WellWaterPage() {
  const [query, setQuery] = useState("days=5")
  const [data, setData] = useState<WellDashboardData>(emptyWellDashboardData)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadWellData() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/well-water/dashboard?${query}`, { cache: "no-store" })
        const payload = (await response.json()) as WellDashboardResponse & { error?: string }

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load Well Water data")
        }

        if (isActive) {
          setData(buildWellDashboardData(payload))
        }
      } catch (error) {
        if (isActive) {
          setData(emptyWellDashboardData)
          setErrorMessage(error instanceof Error ? error.message : "Unable to load Well Water data")
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadWellData()

    return () => {
      isActive = false
    }
  }, [query])

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Droplet className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
              Well Water Data
            </h1>
            <p className="text-sm text-muted-foreground">All figures in Litres</p>
          </div>
        </div>

        {/* Date range (full width) */}
        <DateRangeSelector onChange={setQuery} />

        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {errorMessage}
          </div>
        )}

        {/* North + South wells */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <WellSection
            title="North Well"
            icon={Droplet}
            iconClassName="text-primary"
            capacity={isLoading ? "Loading..." : data.wellCapacity.north}
            records={data.northWellRecords}
            tableHeaderClassName="bg-primary/10 text-primary"
          />
          <WellSection
            title="South Well"
            icon={Droplet}
            iconClassName="text-chart-3"
            capacity={isLoading ? "Loading..." : data.wellCapacity.south}
            records={data.southWellRecords}
            tableHeaderClassName="bg-chart-3/15 text-chart-3"
          />
        </div>

        {/* Summary */}
        <SummaryCards stats={data.summaryStats} />

        {/* Footer note */}
        <div className="flex items-center gap-2 rounded-xl border border-chart-1/30 bg-chart-1/10 px-4 py-3 text-sm text-foreground">
          <Info className="size-4 shrink-0 text-chart-1" aria-hidden="true" />
          <span>Water capacity is the maximum water that can be taken from bottom to Pampari.</span>
        </div>
      </div>
    </DashboardShell>
  )
}
