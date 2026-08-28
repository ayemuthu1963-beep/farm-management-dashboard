"use client"

import { useEffect, useMemo, useState } from "react"
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
import { irrigationEnvironmentCopy } from "@/lib/public-environment"
import { buildIrrigationPeriodQuery } from "@/lib/irrigation-period"
import { irrigationPlanError, type IrrigationPlanResponse, type MotorRunScheduleRow } from "@/lib/irrigation-plan"
import { parsePersistedMotorRunScheduleRows, scheduledWaterForZoneDate, type ScheduleLoadStatus } from "@/lib/irrigation-schedule-comparison"
import { applyScheduledKnownZerosToTrend } from "@/lib/known-zero-data"

const irrigationEnvironment = irrigationEnvironmentCopy(
  process.env.NEXT_PUBLIC_MFMS_ENV,
  process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL,
)

export default function IrrigationManagementPage() {
  const [periodQuery, setPeriodQuery] = useState(() => buildIrrigationPeriodQuery("lastN"))
  const [data, setData] = useState<IrrigationData>(emptyIrrigationData)
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId>("P1E")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [persistedScheduleRows, setPersistedScheduleRows] = useState<MotorRunScheduleRow[]>([])
  const [scheduleLoadStatus, setScheduleLoadStatus] = useState<ScheduleLoadStatus>("loading")
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadPersistedSchedule() {
      setScheduleLoadStatus("loading")
      setScheduleLoadError(null)
      try {
        const response = await fetch("/api/operator-settings/irrigation-plan/motor-run-schedule", { cache: "no-store" })
        const payload = (await response.json().catch(() => ({}))) as IrrigationPlanResponse
        if (!response.ok) throw new Error(irrigationPlanError(payload, "Motor Run Schedule could not be loaded."))
        const rows = parsePersistedMotorRunScheduleRows(payload.rows)
        if (!active) return
        setPersistedScheduleRows(rows)
        setScheduleLoadStatus("ready")
      } catch (error) {
        if (!active) return
        setPersistedScheduleRows([])
        setScheduleLoadStatus("unavailable")
        setScheduleLoadError(error instanceof Error ? error.message : "Motor Run Schedule could not be loaded.")
      }
    }
    void loadPersistedSchedule()
    return () => { active = false }
  }, [])

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
  const displayedTrend = useMemo(() => applyScheduledKnownZerosToTrend(
    data.trend,
    (zoneId, date) => scheduledWaterForZoneDate(
      persistedScheduleRows,
      scheduleLoadStatus,
      zoneId,
      date,
    ).kind === "scheduled",
  ), [data.trend, persistedScheduleRows, scheduleLoadStatus])

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
            <Database className="size-3.5" aria-hidden="true" /> {irrigationEnvironment.liveDataBadge}
          </div>
        </div>

        {errorMessage ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{errorMessage}. Live data unavailable; no fallback data is being shown.</div> : null}

        <IrrigationMapWithDetails
          zones={data.zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          isLoading={isLoading}
          persistedScheduleRows={persistedScheduleRows}
          scheduleLoadStatus={scheduleLoadStatus}
          scheduleLoadError={scheduleLoadError}
        />

        {scheduleLoadStatus === "loading" ? (
          <section className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            Loading persisted Irrigation Plan…
          </section>
        ) : (
          <IrrigationPlanTables
            persistedScheduleRows={persistedScheduleRows}
            scheduleLoadStatus={scheduleLoadStatus}
            scheduleLoadError={scheduleLoadError}
            onPersistedScheduleChange={(rows) => {
              setPersistedScheduleRows(rows)
              setScheduleLoadStatus("ready")
              setScheduleLoadError(null)
            }}
            onPersistedScheduleUnavailable={(message) => {
              setPersistedScheduleRows([])
              setScheduleLoadStatus("unavailable")
              setScheduleLoadError(message)
            }}
          />
        )}

        <IrrigationChartsHybrid zones={data.zones} trend={displayedTrend} isLoading={isLoading} errorMessage={errorMessage} />

        <IrrigationPeriodSelector
          onPeriodChange={setPeriodQuery}
          onRefresh={refreshData}
          onExport={exportZoneData}
          isLoading={isLoading}
          canExport={data.source === "live"}
        />

        <IrrigationSummaryCards summary={data.summary} zoneCount={data.zones.length} isLoading={isLoading} />

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
