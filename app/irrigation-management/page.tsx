"use client"

import { Droplets } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { IrrigationPeriodSelector } from "@/components/irrigation/irrigation-period-selector"
import { IrrigationMapSection } from "@/components/irrigation/irrigation-map-section"
import { IrrigationCharts } from "@/components/irrigation/irrigation-charts"
import { IrrigationZoneTable } from "@/components/irrigation/irrigation-zone-table"
import { getTotalWaterSupplied, getTotalMotorRuntime } from "@/lib/irrigation-data"

export default function IrrigationManagementPage() {
  const totalWater = getTotalWaterSupplied()
  const totalRuntime = getTotalMotorRuntime()

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
            value={`${(totalWater / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}L`}
            accent="bg-chart-2/10 text-chart-2"
          />
          <StatCard
            icon={Droplets}
            label="Total Motor Runtime"
            value={totalRuntime}
            accent="bg-primary/10 text-primary"
          />
        </StatGrid>

        {/* Period selector with refresh and export */}
        <IrrigationPeriodSelector />

        {/* Map + detail panel */}
        <IrrigationMapSection />

        {/* Charts */}
        <IrrigationCharts />

        {/* Zone table */}
        <IrrigationZoneTable />
      </main>
    </DashboardShell>
  )
}
