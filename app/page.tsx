import { DashboardShell } from "@/components/farm/dashboard-shell"
import { HomeHero } from "@/components/farm/home-hero"
import { WeatherWidget } from "@/components/farm/weather-widget"
import { ModuleGrid } from "@/components/farm/module-grid"

export default function HomePage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-3 sm:p-5">
        <HomeHero />
        <WeatherWidget />
        <ModuleGrid />
      </div>
    </DashboardShell>
  )
}
