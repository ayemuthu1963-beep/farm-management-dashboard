import { Sun, CloudSun, Cloud, CloudRain, CloudLightning, type LucideProps } from "lucide-react"
import type { WeatherCondition } from "@/lib/weather-data"

const iconMap = {
  sunny: Sun,
  "partly-cloudy": CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
} as const

export function WeatherIcon({ condition, ...props }: { condition: WeatherCondition } & LucideProps) {
  const Icon = iconMap[condition]
  return <Icon aria-hidden="true" {...props} />
}
