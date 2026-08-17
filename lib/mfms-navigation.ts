import {
  Activity,
  BarChart3,
  Bug,
  Citrus,
  CloudSun,
  Droplets,
  Gauge,
  Home,
  Leaf,
  MapPinned,
  Package,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

export type MfmsNavigationStatus = "active" | "coming-soon"

export type MfmsNavigationItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  dashboardIcon?: string
  description?: string
  status: MfmsNavigationStatus
  showOnDashboard: boolean
  showInSidebar: boolean
  order: number
  external?: boolean
  ctaLabel?: string
  activeHrefs?: readonly string[]
}

export const mfmsNavigationItems: readonly MfmsNavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: Home,
    status: "active",
    showOnDashboard: false,
    showInSidebar: true,
    order: 0,
  },
  {
    id: "todays-weather",
    label: "Today's Weather",
    href: "/weather",
    icon: CloudSun,
    dashboardIcon: "/mfms/icons/todays-weather.png",
    description: "Live weather conditions at Muthu Farms",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 1,
    ctaLabel: "Open Weather Dashboard",
  },
  {
    id: "coconut-harvest",
    label: "Coconut Harvest",
    href: "/coconut-harvest",
    icon: Sprout,
    dashboardIcon: "/mfms/icons/coconut-harvest.png",
    description: "Track yields, harvest cycles and tree health",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 2,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "live-harvest-counter",
    label: "Live Harvest Counter",
    href: "/live-harvest-counter",
    icon: Activity,
    description: "Open live harvest and coconut counting dashboards",
    status: "active",
    showOnDashboard: false,
    showInSidebar: true,
    order: 2.5,
    activeHrefs: ["/coconut-harvest/live-counter", "/coconut-counting"],
  },
  {
    id: "jackfruit-monitoring",
    label: "Jackfruit Monitoring",
    href: "/jackfruit-monitoring",
    icon: Citrus,
    dashboardIcon: "/mfms/icons/jackfruit-monitoring.png",
    description: "Monitor growth stages and ripeness",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 3,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "well-water-level",
    label: "Well Water Level",
    href: "/well-water",
    icon: Droplets,
    dashboardIcon: "/mfms/icons/well-water-level.png",
    description: "Daily well readings, pumping and morning differences",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 4,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "motor-runtime",
    label: "Motor Runtime",
    href: "/motor-runtime",
    icon: Gauge,
    dashboardIcon: "/mfms/icons/motor-runtime.png",
    description: "Pump run hours and motor performance",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 5,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "irrigation-management",
    label: "Irrigation Management",
    href: "/irrigation-management",
    icon: Droplets,
    dashboardIcon: "/mfms/icons/pipeline-layout-inspection.png",
    description:
      "Monitor irrigation water supplied to each farm zone, water per tree, motor runtime and irrigation history.",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 6,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "beetle-trap-monitoring",
    label: "Beetle Trap Monitoring",
    href: "/beetle-trap",
    icon: Bug,
    dashboardIcon: "/mfms/icons/beetle-trap-monitoring.png",
    description: "Pheromone trap catches and pest alerts",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 7,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "pipeline-layout-inspection",
    label: "Pipeline Layout & Inspection",
    href: "/pipeline-layout",
    icon: Wrench,
    dashboardIcon: "/mfms/icons/pipeline-layout-inspection.png",
    description: "Irrigation network status and leaks",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 8,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "farm-map",
    label: "Farm Map",
    href: "/farm-map",
    icon: MapPinned,
    dashboardIcon: "/mfms/icons/farm-map.svg",
    description: "Combined drone orthomosaic view of the farm",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 9,
    ctaLabel: "Open Map",
  },
  {
    id: "fertiliser-management",
    label: "Fertiliser Management",
    href: "/fertiliser-management",
    icon: Leaf,
    dashboardIcon: "/mfms/icons/fertiliser-management.png",
    description: "Application schedules and stock levels",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 10,
    ctaLabel: "Open Dashboard",
  },
  {
    id: "weather-history",
    label: "Weather History",
    href: "/weather",
    icon: CloudSun,
    dashboardIcon: "/mfms/icons/weather-history.png",
    description: "Past weather records and seasonal trends",
    status: "active",
    showOnDashboard: true,
    showInSidebar: false,
    order: 11,
    ctaLabel: "View 7-Day History",
  },
  {
    id: "farm-reports",
    label: "Farm Reports",
    href: "/under-construction",
    icon: BarChart3,
    dashboardIcon: "/mfms/icons/farm-reports.png",
    description: "Consolidated reports and analytics",
    status: "coming-soon",
    showOnDashboard: true,
    showInSidebar: true,
    order: 12,
  },
  {
    id: "worker-management",
    label: "Worker Management",
    href: "/worker-management",
    icon: Users,
    dashboardIcon: "/mfms/icons/worker-management.png",
    description: "Labour records, attendance and tasks",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 13,
    ctaLabel: "Open Worker Management",
  },
  {
    id: "mfms-intelligence",
    label: "MFMS Intelligence",
    href: "/intelligence",
    icon: Sparkles,
    dashboardIcon: "/mfms/icons/farm-reports.png",
    description: "Ask governed questions about verified harvest, irrigation, and well-water analytics",
    status: "active",
    showOnDashboard: false,
    showInSidebar: true,
    order: 13.5,
    ctaLabel: "Ask MFMS Intelligence",
  },
  {
    id: "inventory-management",
    label: "Asset Register",
    href: "/inventory-management",
    icon: Package,
    dashboardIcon: "/mfms/icons/inventory-management.png",
    description: "Independent register of durable farm assets and their operational condition",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 14,
    ctaLabel: "Open Register",
  },
  {
    id: "admin-console",
    label: "Admin Console",
    href: "/admin",
    icon: ShieldCheck,
    dashboardIcon: "/mfms/icons/farm-reports.png",
    description: "Local entry hub for farm operations testing and controlled data entry",
    status: "active",
    showOnDashboard: true,
    showInSidebar: true,
    order: 15,
    ctaLabel: "Open Console",
  },
]

export const homepageNavigationItems = mfmsNavigationItems
  .filter((item) => item.showOnDashboard)
  .toSorted((left, right) => left.order - right.order)

export const sidebarNavigationItems = mfmsNavigationItems
  .filter((item) => item.showInSidebar)
  .toSorted((left, right) => left.order - right.order)

export function isNavigationItemActive(
  pathname: string,
  item: MfmsNavigationItem,
): boolean {
  if (item.status !== "active" || item.external) {
    return false
  }
  if (item.href === "/") {
    return pathname === "/"
  }

  const matchingRootLength = (candidate: MfmsNavigationItem): number => {
    const roots = [candidate.href, ...(candidate.activeHrefs ?? [])]
    return Math.max(
      -1,
      ...roots.map((root) =>
        pathname === root || pathname.startsWith(`${root}/`) ? root.length : -1,
      ),
    )
  }

  const itemMatchLength = matchingRootLength(item)
  if (itemMatchLength < 0) return false

  const mostSpecificMatch = Math.max(
    ...mfmsNavigationItems
      .filter((candidate) => candidate.status === "active" && !candidate.external)
      .map(matchingRootLength),
  )
  return itemMatchLength === mostSpecificMatch
}
