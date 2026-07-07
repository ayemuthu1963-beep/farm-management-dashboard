"use client"

import { useState, type ReactNode } from "react"
import { Menu, X, Droplets } from "lucide-react"
import { Sidebar } from "@/components/farm/sidebar"
import { cn } from "@/lib/utils"

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <Droplets className="size-5 text-primary" aria-hidden="true" />
          Muthu Farms
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-lg border border-border bg-card p-2 text-foreground"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="lg:flex">
        {/* Sidebar: static on desktop, drawer on mobile */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-foreground/40"
            />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] border-r border-sidebar-border bg-sidebar shadow-xl">
              <div className="flex justify-end p-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-2 text-foreground"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <Sidebar />
            </div>
          </div>
        ) : null}

        <main className={cn("min-w-0 flex-1")}>{children}</main>
      </div>
    </div>
  )
}
