// Static mock data only. No backend, no API calls.

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
  temperature: "32°C",
  condition: "Partly Cloudy",
  humidity: "62%",
  wind: "12 km/h",
  rainfall: "0.0 mm",
  detailUrl: "https://ambientweather.net/dashboard/3c60e933cba3de37fedd489ab60dd376",
  ctaLabel: "View Detailed Weather",
}

export interface ModuleCardData {
  id: string
  title: string
  description: string
  icon: string
  href: string
  /** external links open in a new tab */
  external?: boolean
  /** shows the "COMING SOON" badge instead of an action link */
  comingSoon?: boolean
  /** action link label shown when the module is available */
  ctaLabel?: string
}

// Card order is frozen per the approved reference.
// Cards 2-8 are built dashboards; cards 9-12 are future modules (Coming Soon).
// (Card 1 "Today's Weather" is rendered separately by <WeatherCard />.)
export const moduleCards: ModuleCardData[] = [
  {
    id: "coconut-harvest",
    title: "Coconut Harvest",
    description: "Track yields, harvest cycles and tree health",
    icon: "/mfms/icons/coconut-harvest.png",
    href: "/coconut-harvest",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "jackfruit-monitoring",
    title: "Jackfruit Monitoring",
    description: "Monitor growth stages and ripeness",
    icon: "/mfms/icons/jackfruit-monitoring.png",
    href: "/jackfruit-monitoring",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "well-water-level",
    title: "Well Water Level",
    description: "Daily well readings, pumping & recharge",
    icon: "/mfms/icons/well-water-level.png",
    href: "/well-water",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "motor-runtime",
    title: "Motor Runtime",
    description: "Pump run hours and motor performance",
    icon: "/mfms/icons/motor-runtime.png",
    href: "/motor-runtime",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "beetle-trap-monitoring",
    title: "Beetle Trap Monitoring",
    description: "Pheromone trap catches and pest alerts",
    icon: "/mfms/icons/beetle-trap-monitoring.png",
    href: "/beetle-trap",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "pipeline-layout-inspection",
    title: "Pipeline Layout & Inspection",
    description: "Irrigation network status and leaks",
    icon: "/mfms/icons/pipeline-layout-inspection.png",
    href: "/pipeline-layout",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "fertiliser-management",
    title: "Fertiliser Management",
    description: "Application schedules and stock levels",
    icon: "/mfms/icons/fertiliser-management.png",
    href: "/fertiliser-management",
    ctaLabel: "Open Dashboard",
  },
  {
    id: "weather-history",
    title: "Weather History",
    description: "Past weather records and seasonal trends",
    icon: "/mfms/icons/weather-history.png",
    href: "/under-construction",
    comingSoon: true,
  },
  {
    id: "farm-reports",
    title: "Farm Reports",
    description: "Consolidated reports and analytics",
    icon: "/mfms/icons/farm-reports.png",
    href: "/under-construction",
    comingSoon: true,
  },
  {
    id: "worker-management",
    title: "Worker Management",
    description: "Labour records, attendance and tasks",
    icon: "/mfms/icons/worker-management.png",
    href: "/under-construction",
    comingSoon: true,
  },
  {
    id: "inventory-management",
    title: "Inventory Management",
    description: "Stock, tools and supplies tracking",
    icon: "/mfms/icons/inventory-management.png",
    href: "/under-construction",
    comingSoon: true,
  },
]
