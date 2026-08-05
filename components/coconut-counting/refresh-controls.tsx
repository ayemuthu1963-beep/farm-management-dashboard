"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export const COCONUT_WEB_AUTO_REFRESH_MS = 30 * 60_000

export function CoconutCountingRefreshControls() {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  function manualRefresh() {
    startRefresh(() => {
      router.refresh()
      setLastRefresh(new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date()))
    })
  }

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), COCONUT_WEB_AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [router])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <button
        type="button"
        disabled={isRefreshing}
        onClick={manualRefresh}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        {isRefreshing ? "SYNCING" : "SYNC NOW"}
      </button>
      <div className="text-xs font-semibold text-muted-foreground">
        <p>Automatically refreshes from the server every 30 minutes.</p>
        {lastRefresh ? <p className="mt-0.5">Last manual refresh: {lastRefresh}</p> : null}
      </div>
    </div>
  )
}
