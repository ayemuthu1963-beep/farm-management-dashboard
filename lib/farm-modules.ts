export interface FarmModule {
  title: string
  description: string
  href: string
  icon: string
  /** Tailwind classes for the soft tinted icon backdrop */
  tint: string
  available: boolean
}

/**
 * The 7 existing subpages. `available: true` means the module is built out.
 * Add new modules to this array as they are created — the grid leaves room
 * for growth and shows "Coming soon" placeholders automatically.
 */
export const farmModules: FarmModule[] = [
  {
    title: "Coconut Harvest",
    description: "Track yields, harvest cycles and tree health",
    href: "#",
    icon: "/icons/coconut-harvest.png",
    tint: "bg-[oklch(0.95_0.05_145)]",
    available: false,
  },
  {
    title: "Jackfruit Monitoring",
    description: "Monitor growth stages and ripeness",
    href: "#",
    icon: "/icons/jackfruit-monitoring.png",
    tint: "bg-[oklch(0.95_0.06_120)]",
    available: false,
  },
  {
    title: "Well Water Level",
    description: "Daily well readings, pumping & recharge",
    href: "/well-water",
    icon: "/icons/well-water-level.png",
    tint: "bg-[oklch(0.94_0.05_235)]",
    available: true,
  },
  {
    title: "Motor Runtime",
    description: "Pump run hours and motor performance",
    href: "#",
    icon: "/icons/motor-runtime.png",
    tint: "bg-[oklch(0.94_0.05_255)]",
    available: false,
  },
  {
    title: "Beetle Trap Monitoring",
    description: "Pheromone trap catches and pest alerts",
    href: "#",
    icon: "/icons/beetle-trap.png",
    tint: "bg-[oklch(0.95_0.05_145)]",
    available: false,
  },
  {
    title: "Pipeline Layout & Inspection",
    description: "Irrigation network status and leaks",
    href: "#",
    icon: "/icons/pipeline-inspection.png",
    tint: "bg-[oklch(0.94_0.05_235)]",
    available: false,
  },
  {
    title: "Fertiliser Management",
    description: "Application schedules and stock levels",
    href: "#",
    icon: "/icons/fertiliser-management.png",
    tint: "bg-[oklch(0.94_0.06_90)]",
    available: false,
  },
]
