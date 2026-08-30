"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

const REFRESH_INTERVAL_MS = 300_000

export function CoconutCountingRefreshStatus({ refreshedAt, loadError }: { refreshedAt: number; loadError: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failed, setFailed] = useState(Boolean(loadError))
  const [lastSuccessful, setLastSuccessful] = useState(refreshedAt)
  const lastAttempt = useRef(refreshedAt)
  const refreshInFlight = useRef(false)
  const hiddenAt = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (refreshedAt === lastAttempt.current) return
    refreshInFlight.current = false
    lastAttempt.current = refreshedAt
    if (loadError === null) {
      setLastSuccessful(refreshedAt)
    }
    setFailed(Boolean(loadError))
    window.dispatchEvent(new CustomEvent("coconut-counting-refresh", { detail: false }))
  }, [refreshedAt, loadError])

  const refresh = useCallback(() => {
    if (refreshInFlight.current || isPending) return false
    refreshInFlight.current = true
    lastAttempt.current = Date.now()
    setFailed(false)
    window.dispatchEvent(new CustomEvent("coconut-counting-refresh", { detail: true }))
    startTransition(() => router.refresh())
    return true
  }, [isPending, router])

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
    const schedule = () => {
      clearTimer()
      if (document.visibilityState !== "visible") return
      timer.current = setTimeout(() => {
        timer.current = null
        refresh()
        schedule()
      }, REFRESH_INTERVAL_MS)
    }
    const visibility = () => {
      clearTimer()
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now()
        return
      }
      const hiddenFor = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current
      hiddenAt.current = null
      if (hiddenFor >= REFRESH_INTERVAL_MS) refresh()
      schedule()
    }
    schedule()
    document.addEventListener("visibilitychange", visibility)
    return () => {
      clearTimer()
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [refresh])

  const error = loadError || (failed ? "The latest Coconut Counting refresh failed." : null)
  return <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
    <span className="font-semibold">APK sync status: unavailable / not reported by backend</span>
    <button type="button" onClick={refresh} disabled={isPending} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 font-bold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
      <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />{isPending ? "Refresh in progress" : error ? "Retry" : "Refresh now"}
    </button>
    {error ? <span role="alert" className="font-semibold text-destructive">Refresh failed: {error}</span> : <span>Last successful website refresh: {new Date(lastSuccessful).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
  </div>
}
