"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Cloud,
  CloudOff,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { cn } from "@/lib/utils"
import { WorkerOfflineProvider, useWorkerOffline } from "./worker-offline-provider"

const moduleNavigation: ReadonlyArray<{
  href: string
  label: string
  icon: LucideIcon
}> = [
  { href: "/worker-management", label: "Daily Wage Entry", icon: CalendarDays },
  { href: "/worker-management/workers", label: "Worker Management", icon: Users },
  { href: "/worker-management/weekly-settlement", label: "Weekly Settlement", icon: WalletCards },
  { href: "/worker-management/loan-register", label: "Loan Register", icon: WalletCards },
  { href: "/worker-management/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worker-management/query", label: "Query", icon: Search },
]

function isActive(pathname: string, href: string) {
  return href === "/worker-management" ? pathname === href : pathname.startsWith(href)
}

function ModuleNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Worker Management navigation" className="space-y-1 p-3">
      {moduleNavigation.map((item) => {
        const Icon = item.icon
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
function WorkerModuleContent({ children }: { children: ReactNode }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const { online, waiting, conflicts, syncing, lastSync, syncNow } = useWorkerOffline()
  const statusLabel = !online
    ? waiting ? `Offline · ${waiting} waiting` : "Offline"
    : conflicts
      ? `${conflicts} conflict${conflicts === 1 ? "" : "s"}`
      : waiting
        ? `${waiting} waiting`
        : syncing
          ? "Syncing"
          : "Synced"
  const StatusIcon = !online ? CloudOff : conflicts ? TriangleAlert : syncing ? RefreshCw : Cloud

  return (
    <DashboardShell>
      <div className="worker-surface min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavigationOpen(true)}
            className="rounded-lg border border-border p-2 text-foreground lg:hidden"
            aria-label="Open Worker Management navigation"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Users className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold">Muthu Farms</p>
            <p className="truncate text-xs text-muted-foreground">Worker management</p>
          </div>
          <button
            type="button"
            onClick={() => void syncNow().catch(() => undefined)}
            disabled={!online || syncing}
            className={cn(
              "ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              conflicts ? "bg-red-50 text-red-700" : online ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-900",
            )}
            title={lastSync ? `Last sync ${new Date(lastSync).toLocaleString("en-IN")}` : "Not yet synchronised"}
          >
            <StatusIcon className={cn("size-3.5", syncing && "animate-spin")} aria-hidden="true" />
            {statusLabel}
          </button>
        </header>

        {!online || waiting || conflicts ? (
          <div
            role="status"
            className={cn(
              "border-b px-4 py-2 text-xs font-semibold sm:px-6",
              conflicts
                ? "border-red-200 bg-red-50 text-red-800"
                : !online
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-800",
            )}
          >
            {conflicts
              ? `${conflicts} item${conflicts === 1 ? " requires" : "s require"} review before syncing.`
              : !online
                ? `Daily wage and loan entries save on this device. Settlement and worker setup require a connection. ${waiting ? `${waiting} item${waiting === 1 ? " is" : "s are"} waiting to sync.` : "No items are waiting."}`
                : `${waiting} saved item${waiting === 1 ? " is" : "s are"} waiting to sync.`}
          </div>
        ) : null}

        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-border bg-card lg:block">
            <div className="sticky top-16">
              <div className="border-b border-border px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Data Entry</p>
                <p className="mt-1 text-sm font-semibold">Keep the week moving</p>
              </div>
              <ModuleNavigation />
            </div>
          </aside>

          <main className="min-w-0 p-4 sm:p-6 xl:p-8">{children}</main>
        </div>

        {mobileNavigationOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close Worker Management navigation"
              onClick={() => setMobileNavigationOpen(false)}
              className="absolute inset-0 bg-foreground/40"
            />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[88%] border-r border-border bg-card shadow-xl">
              <div className="flex items-start justify-between border-b border-border p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Data Entry</p>
                  <p className="mt-1 font-semibold">Worker Management</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 hover:bg-muted"
                  onClick={() => setMobileNavigationOpen(false)}
                  aria-label="Close Worker Management navigation"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <ModuleNavigation onNavigate={() => setMobileNavigationOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  )
}

export function WorkerModuleShell({ children }: { children: ReactNode }) {
  return (
    <WorkerOfflineProvider>
      <WorkerModuleContent>{children}</WorkerModuleContent>
    </WorkerOfflineProvider>
  )
}
