"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Sprout,
  Citrus,
  Droplets,
  Gauge,
  Bug,
  Wrench,
  Leaf,
  BarChart3,
  Settings,
  CalendarDays,
  Clock,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { todayDate, todayTime } from "@/lib/well-data"

interface NavItem {
  label: string
  icon: LucideIcon
  href: string
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/" },
  { label: "Coconut Harvest", icon: Sprout, href: "/coconut-harvest" },
  { label: "Jackfruit Monitoring", icon: Citrus, href: "/jackfruit-monitoring" },
  { label: "Well Water", icon: Droplets, href: "/well-water" },
  { label: "Motor Runtime", icon: Gauge, href: "/motor-runtime" },
  { label: "Beetle Trap", icon: Bug, href: "/beetle-trap" },
  { label: "Pipeline Inspection", icon: Wrench, href: "/pipeline-layout" },
  { label: "Fertiliser Management", icon: Leaf, href: "/fertiliser-management" },
  { label: "Reports", icon: BarChart3, href: "#" },
  { label: "Settings", icon: Settings, href: "#" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col gap-1 overflow-y-auto bg-sidebar p-3"
    >
      <ul className="flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = item.href !== "#" && pathname === item.href
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 rounded-xl border border-sidebar-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Today&apos;s Date &amp; Time</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <span>{todayDate}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          <span>{todayTime}</span>
        </div>
      </div>
    </nav>
  )
}
