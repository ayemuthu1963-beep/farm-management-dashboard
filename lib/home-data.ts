import type { LucideIcon } from "lucide-react"
import { homepageNavigationItems } from "@/lib/mfms-navigation"

export interface WeatherData {
  temperature: string
  condition: string
  humidity: string
  wind: string
  rainfall: string
  detailUrl: string
  ctaLabel: string
}

export const weatherData: WeatherData = {
  temperature: "—",
  condition: "Connecting to station…",
  humidity: "—",
  wind: "—",
  rainfall: "—",
  detailUrl:
    homepageNavigationItems.find((item) => item.id === "todays-weather")?.href ??
    "/weather",
  ctaLabel:
    homepageNavigationItems.find((item) => item.id === "todays-weather")?.ctaLabel ??
    "View Detailed Weather",
}

export interface ModuleCardData {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  /** external links open in a new tab */
  external?: boolean
  /** shows the "COMING SOON" badge instead of an action link */
  comingSoon?: boolean
  /** action link label shown when the module is available */
  ctaLabel?: string
}

// Weather and Farm Calendar are rendered separately; every other homepage card is
// projected from the same authoritative configuration used by the sidebar.
export const moduleCards: ModuleCardData[] = homepageNavigationItems
  .filter((item) => item.id !== "todays-weather" && item.id !== "farm-calendar")
  .map((item) => ({
    id: item.id,
    title: item.label,
    description: item.description ?? "",
    icon: item.icon,
    href: item.href,
    external: item.external,
    comingSoon: item.status === "coming-soon",
    ctaLabel: item.ctaLabel,
  }))
