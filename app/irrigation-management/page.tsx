"use client"

import { useEffect, useState } from "react"
import { Droplets } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { IrrigationPeriodSelector } from "@/components/irrigation/irrigation-period-selector"
import { IrrigationMapSection } from "@/components/irrigation/irrigation-map-section"
import { IrrigationCharts } from "@/components/irrigation/irrigation-charts"
import { IrrigationZoneTable } from "@/components/irrigation/irrigation-zone-table"
import { emptyIrrigationData, formatNumberIN, type IrrigationData } from "@/lib/irrigation-data"

export default function IrrigationManagementPage() {
  const [periodQuery, setPeriodQuery] = useState("period=last7")
  const [data, setData] = useState<IrrigationData>(emptyIrrigationData)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadIrrigationData() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/irrigation-management?${periodQuery}`, { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load irrigation data")
        }
        if (isActive) {
          setData(payload)
        }
      } catch (error) {
        if (isActive) {
          setData(emptyIrrigationData)
          setErrorMessage(error instanceof Error ? error.message : "Unable to load irrigation data")
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadIrrigationData()

    return () => {
      isActive = false
    }
  }, [periodQuery])

  return (
    <DashboardShell>
      <Header />

      <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Page title section */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">IRRIGATION MANAGEMENT</h1>
          <p className="mt-1 text-muted-foreground">Water distribution by irrigation zone</p>
        </div>

        {/* Summary cards */}
        <StatGrid>
          <StatCard
            icon={Droplets}
            label="Total Water Supplied"
            value={isLoading ? "Loading..." : `${formatNumberIN(data.summary.totalWaterSupplied)} L`}
            accent="bg-chart-2/10 text-chart-2"
          />
          <StatCard
            icon={Droplets}
            label="Total Motor Runtime"
            value={isLoading ? "Loading..." : data.summary.totalMotorRuntime}
            accent="bg-primary/10 text-primary"
          />
          <StatCard
            icon={Droplets}
            label="Zones Irrigated"
            value={isLoading ? "Loading..." : `${data.summary.zonesIrrigated} / ${data.zones.length}`}
            accent="bg-chart-3/10 text-chart-3"
          />
          <StatCard
            icon={Droplets}
            label="Latest Irrigation"
            value={isLoading ? "Loading..." : data.summary.latestIrrigation}
            accent="bg-chart-4/10 text-chart-4"
          />
        </StatGrid>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Period selector with refresh and export */}
        <IrrigationPeriodSelector onPeriodChange={setPeriodQuery} onRefresh={() => setPeriodQuery((query) => `${query}&refresh=${Date.now()}`)} />

        {/* Map + detail panel */}
        <IrrigationMapSection zones={data.zones} />

        {/* Charts */}
        <IrrigationCharts zones={data.zones} waterPerTreeTrend={data.waterPerTreeTrend} />

        {/* Zone table */}
        <IrrigationZoneTable zones={data.zones} />
      </main>
    </DashboardShell>
  )
}
