"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Database } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { IrrigationPeriodSelector } from "@/components/irrigation/irrigation-period-selector"
import { IrrigationSummaryCards } from "@/components/irrigation/irrigation-summary-cards"
import { ZoneStatusCards } from "@/components/irrigation/zone-status-cards"
import { IrrigationMapV2 } from "@/components/irrigation/irrigation-map-v2"
import {
  IrrigationOverviewCharts,
  WaterPerTreeTrendChart,
} from "@/components/irrigation/irrigation-charts-hybrid"
import { IrrigationZoneTable } from "@/components/irrigation/irrigation-zone-table"
import {
  emptyIrrigationData,
  statusColors,
  type IrrigationData,
} from "@/lib/irrigation-data"

const environmentBanner = process.env.NEXT_PUBLIC_MFMS_ENV_BANNER?.trim()
const environmentDatabaseLabel = process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL?.trim()
const environmentDataScope =
  environmentDatabaseLabel === "mfms_server_uat" || environmentBanner?.toLowerCase().includes("pilot")
    ? "PREVIEW"
    : environmentDatabaseLabel === "mfms_local_uat_v1_2" || environmentBanner?.toLowerCase().includes("uat")
      ? "LOCAL UAT"
      : !environmentDatabaseLabel || environmentDatabaseLabel === "mfms_local_dev_v1_2"
        ? "LOCAL"
        : "UNKNOWN"
const liveDataLabel = `LIVE ${environmentDataScope} DATABASE DATA`

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll("\"", "\"\"")}"`
}

export default function IrrigationManagementPage() {
  const [periodQuery, setPeriodQuery] = useState("period=last7")
  const [data, setData] = useState<IrrigationData>(emptyIrrigationData)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const response = await fetch(`/api/irrigation-management?${periodQuery}`, { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? "Unable to load irrigation data")
        if (active) setData(payload)
      } catch (error) {
        if (active) {
          setData(emptyIrrigationData)
          setErrorMessage(error instanceof Error ? error.message : "Unable to load irrigation data")
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [periodQuery])

  function refreshData() {
    setPeriodQuery((currentQuery) => {
      const params = new URLSearchParams(currentQuery)
      params.set("refresh", Date.now().toString())
      return params.toString()
    })
  }

  function exportZoneData() {
    if (data.source !== "live") return
    const rows = [
      ["Zone", "Crop", "Motor / Valve Mapping", "Runtime", "Water Supplied (L)", "Water per Tree (L)", "Records", "Status"],
      ...data.zones.map((zone) => [
        zone.name,
        zone.crop,
        zone.motor,
        zone.valveOpenTime,
        zone.totalWaterSupplied,
        zone.waterPerTree,
        zone.recordsCount,
        zone.statusLabel,
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `mfms-irrigation-by-zone-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const alertZones = data.zones.filter((zone) => zone.status !== "irrigated")

  return (
    <DashboardShell>
      <Header />
      <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">IRRIGATION MANAGEMENT</h1>
            <p className="mt-1 text-muted-foreground">Six-zone water distribution with an independent Nutmeg box</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
            <Database className="size-3.5" aria-hidden="true" /> {liveDataLabel}
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {errorMessage}. Live data unavailable; no fallback data is being shown. Use Refresh to retry.
          </div>
        ) : null}

        <IrrigationPeriodSelector
          onPeriodChange={setPeriodQuery}
          onRefresh={refreshData}
          onExport={exportZoneData}
          isLoading={isLoading}
        />

        <IrrigationSummaryCards
          summary={data.summary}
          zoneCount={data.zones.length}
          isLoading={isLoading}
        />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Zone Status</h2>
            <p className="text-xs text-muted-foreground">
              Live status for Plot 1 East, Plot 1 West, Plot 2 East, Plot 2 West, Jackfruit and Nutmeg.
            </p>
          </div>
          <ZoneStatusCards zones={data.zones} isLoading={isLoading} />
        </section>

        <IrrigationOverviewCharts
          trend={data.trend}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />

        <IrrigationMapV2 zones={data.zones} isLoading={isLoading} />

        <Panel title="Operational Alerts" icon={AlertTriangle}>
          {isLoading ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Checking live irrigation status...
            </div>
          ) : alertZones.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              All six operational zones have irrigation records for the selected period.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {alertZones.map((zone) => (
                <div
                  key={zone.id}
                  className={`rounded-lg border p-3 text-sm ${statusColors[zone.status].bg} ${statusColors[zone.status].border}`}
                >
                  <div className={`font-semibold ${statusColors[zone.status].text}`}>
                    {zone.name} — {zone.statusLabel}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Records: {zone.recordsCount}. Mapping: {zone.configuredMotorValves.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <WaterPerTreeTrendChart
          trend={data.trend}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />

        <IrrigationZoneTable
          zones={data.zones}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />
      </main>
    </DashboardShell>
  )
}
