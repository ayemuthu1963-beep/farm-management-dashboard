import type { Metadata } from "next"
import { WeatherDashboard } from "@/components/weather/weather-dashboard"

export const metadata: Metadata = {
  title: "MFMS-Weather",
  description: "Live and recent weather observations from the Muthu Farms station.",
}

export default function WeatherPage() {
  return <WeatherDashboard />
}
