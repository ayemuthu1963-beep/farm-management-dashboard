"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Database } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { IrrigationPeriodSelector } from "@/components/irrigation/irrigation-period-selector"
import { IrrigationSummaryCards } from "@/components/irrigation/irrigation-summary-cards"
import { ZoneStatusCards } from "@/components/irrigation/zone-status-cards"
import { IrrigationMapWithDetails } from "@/components/irrigation/irrigation-map-with-details"
import { IrrigationChartsHybrid } from "@/components/irrigation/irrigation-charts-hybrid"
import { IrrigationZoneTableHybrid } from "@/components/irrigation/irrigation-zone-table-hybrid"
import { IrrigationPlanTables } from "@/components/irrigation/irrigation-plan-tables"
import { emptyIrrigationData, statusColors, type IrrigationData, type ZoneId } from "@/lib/irrigation-data"
import { buildIrrigationZoneCsv } from "@/lib/irrigation-export"
import { buildIrrigationPeriodQuery } from "@/lib/irrigation-period"

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

export default function IrrigationManagementPage() {
  const [periodQuery, setPeriodQuery] = useState(() => buildIrrigationPeriodQuery("lastN"))
  const [data, setData] = useState<IrrigationData>(emptyIrrigationData)
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId>("P1E")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

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
  }, [periodQuery, refreshVersion])

  function refreshData() {
    setRefreshVersion((version) => version + 1)
  }

  function exportZoneData() {
    if (data.source !== "live") return
    const blob = new Blob([buildIrrigationZoneCsv(data)], { type: "text/csv;charset=utf-8" })
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

        {errorMessage ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{errorMessage}. Live data unavailable; no fallback data is being shown.</div> : null}

        <IrrigationSummaryCards summary={data.summary} zoneCount={data.zones.length} isLoading={isLoading} />

        <IrrigationMapWithDetails zones={data.zones} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} isLoading={isLoading} />

        <IrrigationPlanTables />

        <IrrigationChartsHybrid zones={data.zones} trend={data.trend} isLoading={isLoading} errorMessage={errorMessage} />

        <IrrigationPeriodSelector
          onPeriodChange={setPeriodQuery}
          onRefresh={refreshData}
          onExport={exportZoneData}
          isLoading={isLoading}
          canExport={data.source === "live"}
        />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Zone Status</h2>
            <p className="text-xs text-muted-foreground">Nutmeg is counted as its own operational zone and does not merge with P1E or P2W.</p>
          </div>
          <ZoneStatusCards zones={data.zones} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />
        </section>

        <Panel title="Operational Alerts" icon={AlertTriangle}>
          {isLoading ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">Checking live irrigation status...</div>
          ) : alertZones.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">All six operational zones have irrigation records for the selected period.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {alertZones.map((zone) => (
                <div key={zone.id} className={`rounded-lg border p-3 text-sm ${statusColors[zone.status].bg} ${statusColors[zone.status].border}`}>
                  <div className={`font-semibold ${statusColors[zone.status].text}`}>{zone.name} — {zone.statusLabel}</div>
                  <div className="mt-1 text-muted-foreground">Records: {zone.recordsCount}. Mapping: {zone.configuredMotorValves.join(", ")}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <IrrigationZoneTableHybrid records={data.records} isLoading={isLoading} errorMessage={errorMessage} />
      </main>
    </DashboardShell>
  )
}
