"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Droplet, Wind, CloudRain, ArrowRight } from "lucide-react"
import type { WeatherData } from "@/lib/home-data"
import type {
  WeatherApiErrorResponse,
  WeatherCurrentResponse,
} from "@/lib/weather-types"
import {
  formatObservationTime,
  formatWeatherValue,
} from "@/lib/weather-format"

interface WeatherCardProps {
  data: WeatherData
}

export function WeatherCard({ data }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherCurrentResponse | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let isActive = true

    async function loadCurrentWeather() {
      try {
        const response = await fetch("/api/weather/current", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        const payload = (await response.json()) as
          | WeatherCurrentResponse
          | WeatherApiErrorResponse

        if (!response.ok || !("current" in payload)) {
          throw new Error("Weather data unavailable")
        }

        if (isActive) {
          setWeather(payload)
          setStatus("ready")
        }
      } catch {
        if (isActive) setStatus("error")
      }
    }

    loadCurrentWeather()
    const refreshTimer = window.setInterval(loadCurrentWeather, 5 * 60 * 1000)

    return () => {
      isActive = false
      window.clearInterval(refreshTimer)
    }
  }, [])

  const current = weather?.current
  const temperature = current
    ? formatWeatherValue(current.temperatureC, "", 1)
    : data.temperature
  const stats = [
    {
      label: "Humidity",
      value: current
        ? formatWeatherValue(current.humidityPct, "%", 0)
        : data.humidity,
      icon: Droplet,
    },
    {
      label: "Wind",
      value: current
        ? formatWeatherValue(current.windSpeedKph, " km/h", 1)
        : data.wind,
      icon: Wind,
    },
    {
      label: "Rain today",
      value: current
        ? formatWeatherValue(current.rainfallTodayMm, " mm", 1)
        : data.rainfall,
      icon: CloudRain,
    },
  ]

  const condition = current
    ? `Updated ${formatObservationTime(current.observedAt)}`
    : status === "error"
      ? "Live station temporarily unavailable"
      : data.condition

  return (
    <Link
      href={data.detailUrl}
      className="flex min-h-[280px] flex-col rounded-xl border border-[#dce9dc] bg-white/95 p-6 text-[#071f13] shadow-[0_8px_22px_rgba(0,0,0,0.09)] transition-shadow hover:shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <div className="flex flex-1 gap-4">
        <Image
          src="/mfms/icons/todays-weather.png"
          alt="Today's weather"
          width={112}
          height={112}
          className="size-20 shrink-0 rounded-2xl object-contain sm:size-24"
        />
        <div className="flex flex-1 flex-col">
          <h3 className="text-lg font-extrabold tracking-wide text-[#0d3f1e]">LIVE WEATHER – MUTHU FARMS</h3>
          <div className="mt-2 flex flex-1 items-start justify-between gap-3">
            <div>
              <p className="text-4xl font-black leading-none">
                {temperature}
                <span className="align-top text-xl font-bold">°C</span>
              </p>
              <p className="mt-2 text-sm text-[#4a5d4f]" aria-live="polite">
                {condition}
              </p>
            </div>
            <ul className="space-y-2 text-right">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <li key={stat.label} className="flex items-center justify-end gap-2">
                    <Icon className="size-4 text-[#2f7bd0]" aria-hidden="true" />
                    <span className="text-xs leading-tight text-[#4a5d4f]">
                      {stat.label}
                      <br />
                      <b className="text-sm text-[#071f13]">{stat.value}</b>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0a7a37]">
        {data.ctaLabel}
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  )
}
