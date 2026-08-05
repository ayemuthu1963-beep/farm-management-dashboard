"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, CalendarDays, RefreshCw, Trees, Wifi, WifiOff } from "lucide-react"

type SelectionMode = "date" | "range"

interface CounterTotals {
  fromDate: string
  toDate: string
  totalNuts: number
  treesHarvested: number
  duplicateSubmissionCount: number
  lastUpdated: string
  lastUpdatedFull: string
  connectionStatus: "live" | "offline"
}

const REFRESH_MS = 5 * 60_000
const CACHE_PREFIX = "mfms-harvest-live-counter:v1"

function indiaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value || ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}-${month}-${year}` : value
}

function cacheKey(fromDate: string, toDate: string): string {
  return `${CACHE_PREFIX}:${fromDate}:${toDate}`
}

function readCache(fromDate: string, toDate: string): CounterTotals | null {
  try {
    const value = window.localStorage.getItem(cacheKey(fromDate, toDate))
    return value ? (JSON.parse(value) as CounterTotals) : null
  } catch {
    return null
  }
}

function storeCache(data: CounterTotals): void {
  try {
    window.localStorage.setItem(cacheKey(data.fromDate, data.toDate), JSON.stringify(data))
  } catch {
    // Browser storage can be unavailable in private or restricted sessions.
  }
}

function normalizedTotals(raw: unknown, fromDate: string, toDate: string): CounterTotals {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid counter response")
  const value = raw as Record<string, unknown>
  const numberValue = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = Number(value[key])
      if (Number.isFinite(candidate)) return candidate
    }
    return 0
  }
  return {
    fromDate: String(value.fromDate || value.selectedDate || fromDate),
    toDate: String(value.toDate || value.selectedDate || toDate),
    totalNuts: numberValue("totalNuts", "todayNuts"),
    treesHarvested: numberValue("treesHarvested", "treeCount"),
    duplicateSubmissionCount: numberValue("duplicateSubmissionCount", "possibleDuplicateCount"),
    lastUpdated: String(value.lastUpdated || "No data"),
    lastUpdatedFull: String(value.lastUpdatedFull || new Date().toISOString()),
    connectionStatus: value.connectionStatus === "offline" ? "offline" : "live",
  }
}

export function LiveCounterClient() {
  const today = useMemo(() => indiaDate(), [])
  const [mode, setMode] = useState<SelectionMode>("date")
  const [fromDate, setFromDate] = useState(today)
  const [rangeEndDate, setRangeEndDate] = useState(today)
  const [data, setData] = useState<CounterTotals | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const toDate = mode === "date" ? fromDate : rangeEndDate

  const sync = useCallback(async (manualRefresh = false) => {
    if (!fromDate || !toDate || fromDate > toDate) return
    setSyncing(true)
    setError("")
    const period =
      fromDate === toDate
        ? `date=${encodeURIComponent(fromDate)}`
        : `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`
    const query = manualRefresh ? `${period}&refresh=1` : period

    try {
      const response = await fetch(`/api/coconut-harvest/live-counter?${query}`, { cache: "no-store" })
      if (!response.ok) throw new Error(`Counter request failed: ${response.status}`)
      const fresh = normalizedTotals(await response.json(), fromDate, toDate)
      setData(fresh)
      storeCache(fresh)
    } catch {
      const cached = readCache(fromDate, toDate)
      if (cached) setData({ ...cached, connectionStatus: "offline" })
      else setData(null)
      setError("Harvest totals are temporarily unavailable.")
    } finally {
      setSyncing(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    void sync()
    const interval = window.setInterval(() => void sync(), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [sync])

  const updateFromDate = (nextDate: string) => {
    setFromDate(nextDate)
    if (mode === "date" || rangeEndDate < nextDate) setRangeEndDate(nextDate)
  }

  const metrics = [
    { label: "Total Nuts", value: data?.totalNuts ?? 0, icon: Activity, tone: "bg-primary/5 text-primary" },
    { label: "Trees Harvested", value: data?.treesHarvested ?? 0, icon: Trees, tone: "bg-chart-2/10 text-chart-2" },
    {
      label: "Duplicate Submissions",
      value: data?.duplicateSubmissionCount ?? 0,
      icon: AlertTriangle,
      tone:
        (data?.duplicateSubmissionCount ?? 0) > 0
          ? "bg-amber-50 text-amber-700"
          : "bg-muted text-muted-foreground",
    },
  ]

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1 space-y-4">
            <div
              className="inline-flex rounded-lg border border-border bg-muted p-1"
              role="group"
              aria-label="Date selection mode"
            >
              {(["date", "range"] as SelectionMode[]).map((selection) => (
                <button
                  key={selection}
                  type="button"
                  onClick={() => {
                    setMode(selection)
                    if (selection === "date") setRangeEndDate(fromDate)
                  }}
                  aria-pressed={mode === selection}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                    mode === selection
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {selection === "date" ? "Single Date" : "Date Range"}
                </button>
              ))}
            </div>

            <div className={`grid gap-3 ${mode === "range" ? "sm:grid-cols-2" : "max-w-sm"}`}>
              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="size-4" /> {mode === "range" ? "From" : "Harvest date"}
                </span>
                <input
                  type="date"
                  value={fromDate}
                  max={today}
                  onChange={(event) => updateFromDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold text-foreground"
                />
              </label>
              {mode === "range" ? (
                <label className="space-y-1.5">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <CalendarDays className="size-4" /> To (inclusive)
                  </span>
                  <input
                    type="date"
                    value={rangeEndDate}
                    min={fromDate}
                    max={today}
                    onChange={(event) => setRangeEndDate(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold text-foreground"
                  />
                </label>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
            <button
              type="button"
              onClick={() => void sync(true)}
              disabled={syncing || !fromDate || !toDate || fromDate > toDate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing" : "Sync Now"}
            </button>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {data?.connectionStatus === "live" ? (
                <Wifi className="size-4 text-emerald-600" />
              ) : (
                <WifiOff className="size-4" />
              )}
              Last synced: {data?.lastUpdated ?? "No data"}
            </div>
          </div>
        </div>
      </section>

      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected harvest period</p>
        <p className="mt-1 text-base font-bold text-foreground">
          {fromDate === toDate ? displayDate(fromDate) : `${displayDate(fromDate)} to ${displayDate(toDate)}`}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Harvest totals">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <article key={metric.label} className={`rounded-xl border border-border p-5 text-center shadow-sm ${metric.tone}`}>
              <Icon className="mx-auto size-7" aria-hidden="true" />
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-foreground">
                {metric.value.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide">{metric.label}</p>
            </article>
          )
        })}
      </section>

      {error ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-center text-sm font-semibold text-foreground">
          {error}
          {data ? " Showing the last saved totals for this period." : ""}
        </div>
      ) : null}

      <p className="text-center text-xs font-medium text-muted-foreground">
        Automatically refreshes every five minutes · View only · No data entry
      </p>
    </div>
  )
}
