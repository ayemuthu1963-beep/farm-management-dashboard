"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CloudRain,
  CloudSun,
  Compass,
  Droplet,
  ExternalLink,
  Gauge,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import {
  formatHistoryDate,
  formatObservationTime,
  formatWeatherValue,
} from "@/lib/weather-format"
import type {
  WeatherApiErrorResponse,
  WeatherCurrent,
  WeatherCurrentResponse,
  WeatherHistoryResponse,
} from "@/lib/weather-types"

type LoadState = "loading" | "ready" | "error"

const AMBIENT_WEATHER_DASHBOARD_URL =
  "https://ambientweather.net/dashboard/3c60e933cba3de37fedd489ab60dd376"

async function readWeatherResponse<T extends object>(url: string, field: keyof T): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  const payload = (await response.json()) as T | WeatherApiErrorResponse

  if (!response.ok || typeof payload !== "object" || payload === null || !(field in payload)) {
    throw new Error("error" in payload ? payload.error : "Weather data unavailable")
  }

  return payload as T
}

function CurrentMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Droplet
}) {
  return (
    <div className="rounded-xl border border-[#dce9dc] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#4a5d4f]">
        <Icon className="size-4 text-[#2f7bd0]" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black text-[#0d3f1e]">{value}</p>
    </div>
  )
}

function CurrentConditions({ current }: { current: WeatherCurrent }) {
  const metrics = [
    {
      label: "Feels like",
      value: formatWeatherValue(current.feelsLikeC, " °C", 1),
      icon: Thermometer,
    },
    {
      label: "Humidity",
      value: formatWeatherValue(current.humidityPct, "%", 0),
      icon: Droplet,
    },
    {
      label: "Wind",
      value: formatWeatherValue(current.windSpeedKph, " km/h", 1),
      icon: Wind,
    },
    {
      label: "Wind gust",
      value: formatWeatherValue(current.windGustKph, " km/h", 1),
      icon: Wind,
    },
    {
      label: "Wind direction",
      value:
        current.windDirectionCardinal && current.windDirectionDeg !== null
          ? `${current.windDirectionCardinal} · ${current.windDirectionDeg.toFixed(0)}°`
          : "—",
      icon: Compass,
    },
    {
      label: "Rain today",
      value: formatWeatherValue(current.rainfallTodayMm, " mm", 1),
      icon: CloudRain,
    },
    {
      label: "Rain rate",
      value: formatWeatherValue(current.rainfallRateMm, " mm/h", 1),
      icon: CloudRain,
    },
    {
      label: "Pressure",
      value: formatWeatherValue(current.pressureHpa, " hPa", 1),
      icon: Gauge,
    },
    {
      label: "Dew point",
      value: formatWeatherValue(current.dewPointC, " °C", 1),
      icon: Droplet,
    },
    {
      label: "UV index",
      value: formatWeatherValue(current.uvIndex, "", 1),
      icon: Sun,
    },
    {
      label: "Solar radiation",
      value: formatWeatherValue(current.solarRadiationWm2, " W/m²", 0),
      icon: Sun,
    },
  ]

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#cfe3cf] bg-gradient-to-br from-[#0d5b2a] to-[#123f27] p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#bde8c8]">
              Current temperature
            </p>
            <p className="mt-2 text-6xl font-black sm:text-7xl">
              {formatWeatherValue(current.temperatureC, "", 1)}
              <span className="align-top text-3xl">°C</span>
            </p>
          </div>
          <div className="sm:text-right">
            <p className="font-bold">Station {current.stationId}</p>
            <p className="mt-1 text-sm text-[#d5edda]">
              Observed {formatObservationTime(current.observedAt)} IST
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Current weather measurements" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <CurrentMetric key={metric.label} {...metric} />
        ))}
      </section>
    </>
  )
}

function HistoryTable({ history }: { history: WeatherHistoryResponse }) {
  if (history.days.length === 0) {
    return (
      <p className="rounded-xl bg-[#f7faf7] p-5 text-sm text-[#4a5d4f]">
        No completed daily summaries were returned for this period.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#dce9dc]">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#edf6eb] text-left text-xs uppercase tracking-wide text-[#31533a]">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">High</th>
            <th className="px-4 py-3 text-right">Low</th>
            <th className="px-4 py-3 text-right">Humidity</th>
            <th className="px-4 py-3 text-right">Avg wind</th>
            <th className="px-4 py-3 text-right">Rain</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e4eee4] bg-white">
          {history.days.map((day) => (
            <tr key={day.date} className="text-[#21392a]">
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">
                {formatHistoryDate(day.date)}
              </th>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                {formatWeatherValue(day.temperatureHighC, " °C", 1)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {formatWeatherValue(day.temperatureLowC, " °C", 1)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {formatWeatherValue(day.humidityAveragePct, "%", 0)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {formatWeatherValue(day.windSpeedAverageKph, " km/h", 1)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#176b35]">
                {formatWeatherValue(day.rainfallMm, " mm", 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function WeatherDashboard() {
  const [current, setCurrent] = useState<WeatherCurrentResponse | null>(null)
  const [history, setHistory] = useState<WeatherHistoryResponse | null>(null)
  const [currentState, setCurrentState] = useState<LoadState>("loading")
  const [historyState, setHistoryState] = useState<LoadState>("loading")
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadCurrent = useCallback(async () => {
    setCurrentError(null)
    try {
      const payload = await readWeatherResponse<WeatherCurrentResponse>(
        "/api/weather/current",
        "current",
      )
      setCurrent(payload)
      setCurrentState("ready")
    } catch (error) {
      setCurrentState("error")
      setCurrentError(error instanceof Error ? error.message : "Live weather unavailable")
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryError(null)
    try {
      const payload = await readWeatherResponse<WeatherHistoryResponse>(
        "/api/weather/history?days=7",
        "days",
      )
      setHistory(payload)
      setHistoryState("ready")
    } catch (error) {
      setHistoryState("error")
      setHistoryError(error instanceof Error ? error.message : "Weather history unavailable")
    }
  }, [])

  useEffect(() => {
    loadCurrent()
    loadHistory()
    const refreshTimer = window.setInterval(loadCurrent, 5 * 60 * 1000)
    return () => window.clearInterval(refreshTimer)
  }, [loadCurrent, loadHistory])

  async function refreshAll() {
    setRefreshing(true)
    await Promise.all([loadCurrent(), loadHistory()])
    setRefreshing(false)
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CloudSun className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-[#0d3f1e] sm:text-3xl">
                Live Weather – Muthu Farms
              </h1>
              <p className="mt-1 text-sm text-[#4a5d4f]">
                Direct station observations and completed daily history, without external advertisements.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={AMBIENT_WEATHER_DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#b42318] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#8f1d14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Open Detailed Weather Station Dashboard
              </a>
              <button
                type="button"
                onClick={refreshAll}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-[#bfd8c3] bg-white px-4 py-2 text-sm font-bold text-[#176b35] shadow-sm hover:bg-[#f5faf4] disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                Refresh
              </button>
            </div>
            <p className="text-xs text-[#5f7464]">External Ambient Weather page · opens in a new tab</p>
          </div>
        </div>

        {currentState === "loading" ? (
          <section className="rounded-2xl border border-[#dce9dc] bg-white p-8 text-sm text-[#4a5d4f] shadow-sm">
            Connecting securely to station IUDUMA3…
          </section>
        ) : currentState === "error" || !current ? (
          <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <p className="font-bold">Live station reading is unavailable</p>
            <p className="mt-1 text-sm">{currentError ?? "Please try again shortly."}</p>
          </section>
        ) : (
          <CurrentConditions current={current.current} />
        )}

        <section id="history" className="scroll-mt-4 rounded-2xl border border-[#dce9dc] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#0d3f1e]">Previous 7 days</h2>
              <p className="mt-1 text-sm text-[#4a5d4f]">Completed daily station summaries.</p>
            </div>
            <CloudRain className="size-6 text-[#2f7bd0]" aria-hidden="true" />
          </div>

          {historyState === "loading" ? (
            <p className="rounded-xl bg-[#f7faf7] p-5 text-sm text-[#4a5d4f]">Loading history…</p>
          ) : historyState === "error" || !history ? (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              {historyError ?? "Weather history is temporarily unavailable."}
            </p>
          ) : (
            <HistoryTable history={history} />
          )}
        </section>

        <p className="pb-2 text-center text-xs text-[#5f7464]">
          Data source: Weather Underground Personal Weather Station {current?.stationId ?? "IUDUMA3"}.
          Current readings refresh every five minutes.
        </p>
      </div>
    </DashboardShell>
  )
}
