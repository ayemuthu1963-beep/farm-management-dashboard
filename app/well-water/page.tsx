"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Droplet, Info, RefreshCw } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { WellSection } from "@/components/farm/well-section"
import { SummaryCards } from "@/components/farm/summary-cards"
import {
  buildWellDashboardData,
  buildWellWaterCsv,
  emptyWellDashboardData,
  type WellDashboardData,
  type WellDashboardResponse,
} from "@/lib/well-data"
import { formatIstDateTime } from "@/lib/format-ist-date-time"
import {
  formatWellWaterSyncSuccess,
  getWellWaterSyncErrorMessage,
  isCompletedWellWaterSync,
} from "@/lib/well-water-sync"

type SyncNotice = {
  kind: "success" | "warning" | "error"
  message: string
}

export default function WellWaterPage() {
  const [query, setQuery] = useState("days=5")
  const [data, setData] = useState<WellDashboardData>(emptyWellDashboardData)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncNotice, setSyncNotice] = useState<SyncNotice | null>(null)
  const [latestSuccessfulSyncAt, setLatestSuccessfulSyncAt] = useState<string | null>(null)
  const syncInProgressRef = useRef(false)

  function exportCsv() {
    const blob = new Blob([buildWellWaterCsv(data)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "well-water-morning-differences.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

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
  }, [query, refreshVersion])

  async function syncWellWaterNow() {
    if (syncInProgressRef.current) return

    syncInProgressRef.current = true
    setIsSyncing(true)
    setSyncNotice(null)

    try {
      const response = await fetch("/api/admin/well-water/sync", {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok || !isCompletedWellWaterSync(payload)) {
        throw new Error(getWellWaterSyncErrorMessage(payload))
      }

      setSyncNotice({
        kind: payload.records_rejected_or_failed > 0 ? "warning" : "success",
        message: formatWellWaterSyncSuccess(payload),
      })
      setLatestSuccessfulSyncAt(
        payload.latest_successful_sync_at || payload.sync_completed_at,
      )
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      setSyncNotice({
        kind: "error",
        message: error instanceof Error ? error.message : getWellWaterSyncErrorMessage(null),
      })
    } finally {
      syncInProgressRef.current = false
      setIsSyncing(false)
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={syncWellWaterNow}
              disabled={isSyncing}
              aria-busy={isSyncing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
              {isSyncing ? "Syncing…" : "Sync ODK Now"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={isLoading || data.totalReadings === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </button>
          </div>
        </div>

        {syncNotice ? (
          <div
            role={syncNotice.kind === "error" ? "alert" : "status"}
            aria-live={syncNotice.kind === "error" ? "assertive" : "polite"}
            className={
              syncNotice.kind === "error"
                ? "rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                : syncNotice.kind === "warning"
                  ? "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-foreground"
                  : "rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground"
            }
          >
            {syncNotice.message}
          </div>
        ) : null}

        {latestSuccessfulSyncAt ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Latest successful sync: {formatIstDateTime(latestSuccessfulSyncAt)}
          </p>
        ) : null}

        {/* Date range (full width) */}
        <DateRangeSelector onChange={setQuery} />

        {/* Summary */}
        <SummaryCards stats={data.summaryStats} />

        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {errorMessage}
          </div>
        )}

        {/* North + South wells */}
        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <WellSection
            title="North Well"
            icon={Droplet}
            iconClassName="text-primary"
            capacity={isLoading ? "Loading..." : data.wellCapacity.north}
            records={data.northWellRecords}
            tableHeaderClassName="bg-primary/10 text-primary"
            panelClassName="border-chart-1/30 bg-chart-1/5"
          />
          <WellSection
            title="South Well"
            icon={Droplet}
            iconClassName="text-chart-3"
            capacity={isLoading ? "Loading..." : data.wellCapacity.south}
            records={data.southWellRecords}
            tableHeaderClassName="bg-chart-3/15 text-chart-3"
            panelClassName="border-chart-3/30 bg-chart-3/5"
          />
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-2 rounded-xl border border-chart-1/30 bg-chart-1/10 px-4 py-3 text-sm text-foreground">
          <Info className="size-4 shrink-0 text-chart-1" aria-hidden="true" />
          <span>Water capacity is the maximum water that can be taken from bottom to Pampari.</span>
        </div>
      </div>
    </DashboardShell>
  )
}
