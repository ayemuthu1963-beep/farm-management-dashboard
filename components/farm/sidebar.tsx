"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  isNavigationItemActive,
  sidebarNavigationItems,
} from "@/lib/mfms-navigation"

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const liveDate = now
    ? now.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "--"
  const liveTime = now
    ? now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--"

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col gap-1 overflow-y-auto bg-sidebar p-3"
    >
      <ul className="flex flex-col gap-1">
        {sidebarNavigationItems.map((item) => {
          const Icon = item.icon
          const active = isNavigationItemActive(pathname, item)
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {item.status === "coming-soon" ? (
                  <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                    Soon
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 rounded-xl border border-sidebar-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Today&apos;s Date &amp; Time</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <span>{liveDate}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          <span>{liveTime}</span>
        </div>
      </div>
    </nav>
  )
}
