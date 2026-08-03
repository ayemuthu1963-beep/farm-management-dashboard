"use client"

import { useEffect, useState } from "react"
import { Gauge, Info, TrendingUp } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { getMotorDefaultDateRange, MotorDateRangeSelector, validateMotorDateRange, type MotorDateRange } from "@/components/motor/motor-date-range-selector"
import { MotorStatusCards } from "@/components/motor/motor-status-cards"
import { MotorLogSection } from "@/components/motor/motor-log-section"
import { MotorChart } from "@/components/motor/motor-chart"
import { MotorValvesSection } from "@/components/motor/motor-valves-section"
import { MotorSummaryCards } from "@/components/motor/motor-summary-cards"
import { emptyMotorDashboardData, type MotorDashboardData } from "@/lib/motor-data"

export default function MotorRuntimePage() {
  const [dateRange, setDateRange] = useState<MotorDateRange>(() => getMotorDefaultDateRange())
  const [data, setData] = useState<MotorDashboardData>(emptyMotorDashboardData)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const dateRangeError = validateMotorDateRange(dateRange)

  useEffect(() => {
    let isActive = true

    async function loadMotorData() {
      if (dateRangeError) {
        setData(emptyMotorDashboardData)
        setErrorMessage(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setErrorMessage(null)
      try {
        const query = new URLSearchParams({
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          days: String(dateRange.days),
        })
        const response = await fetch(`/api/motor-runtime/dashboard?${query}`, { cache: "no-store" })
        const payload = (await response.json()) as MotorDashboardData & { error?: string }
        if (!response.ok) throw new Error(payload.error ?? "Unable to load Motor Runtime data")
        if (isActive) setData(payload)
      } catch (error) {
        if (isActive) {
          setData(emptyMotorDashboardData)
          setErrorMessage(error instanceof Error ? error.message : "Unable to load Motor Runtime data")
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadMotorData()
    return () => { isActive = false }
  }, [dateRange, dateRangeError])

  const totalEntries = data.summary.total_entries

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">Motor Runtime</h1>
            <p className="text-sm text-muted-foreground">Pump run hours and valve runtime history</p>
          </div>
        </div>

        <MotorDateRangeSelector
          value={dateRange}
          errorMessage={dateRangeError}
          onChange={setDateRange}
          onResetDefault={() => setDateRange(getMotorDefaultDateRange())}
        />

        {errorMessage && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{errorMessage}</div>}
        {isLoading && <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground">Loading motor runtime data…</div>}
        {!isLoading && !errorMessage && totalEntries === 0 && <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No motor runtime records found for the selected period.</div>}

        <MotorStatusCards motors={data.statusCards} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <MotorLogSection recordsByMotor={data.recordsByMotor} />
          <Panel title="Runtime Trend" icon={TrendingUp} iconClassName="text-emerald-700" className="border-emerald-200/80 bg-emerald-50/55">
            <MotorChart data={data.chartData} />
          </Panel>
        </div>

        <MotorValvesSection valveGroups={data.valveGroups} />
        <MotorSummaryCards stats={data.summaryStats} />

        <div className="flex items-center gap-2 rounded-xl border border-chart-1/30 bg-chart-1/10 px-4 py-3 text-sm text-foreground">
          <Info className="size-4 shrink-0 text-chart-1" aria-hidden="true" />
          <span>Runtime hours are calculated from stored hours and minutes: total minutes ÷ 60.</span>
        </div>
      </div>
    </DashboardShell>
  )
}
