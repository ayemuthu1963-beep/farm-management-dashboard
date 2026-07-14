import Image from "next/image"
import { Droplet, Wind, CloudRain, ArrowRight } from "lucide-react"
import type { WeatherData } from "@/lib/home-data"

interface WeatherCardProps {
  data: WeatherData
}

export function WeatherCard({ data }: WeatherCardProps) {
  const stats = [
    { label: "Humidity", value: data.humidity, icon: Droplet },
    { label: "Wind", value: data.wind, icon: Wind },
    { label: "Rainfall", value: data.rainfall, icon: CloudRain },
  ]

  return (
    <a
      href={data.detailUrl}
      target="_blank"
      rel="noopener noreferrer"
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
                {data.temperature.replace("°C", "")}
                <span className="align-top text-xl font-bold">°C</span>
              </p>
              <p className="mt-2 text-sm text-[#4a5d4f]">{data.condition}</p>
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
    </a>
  )
}
