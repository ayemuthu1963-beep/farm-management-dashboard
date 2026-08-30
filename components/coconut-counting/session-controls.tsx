"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

interface SessionControlsProps {
  sessionUuid: string
  harvestDate: string
  isActive: boolean
  authorizedToClose: boolean
}

const REFRESH_INTERVAL_MS = 300_000

export function CoconutCountingSessionControls({
  sessionUuid,
  harvestDate,
  isActive,
  authorizedToClose,
}: SessionControlsProps) {
  const router = useRouter()
  const refreshInFlight = useRef(false)
  const lastRefreshAt = useRef(Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const refresh = useCallback(() => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    setRefreshing(true)
    setRefreshFailed(false)
    try {
      router.refresh()
      lastRefreshAt.current = Date.now()
    } catch {
      setRefreshFailed(true)
    } finally {
      refreshInFlight.current = false
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (document.visibilityState !== "visible") return
      timer = setTimeout(() => {
        refresh()
        schedule()
      }, Math.max(0, REFRESH_INTERVAL_MS - (Date.now() - lastRefreshAt.current)))
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastRefreshAt.current >= REFRESH_INTERVAL_MS) refresh()
        schedule()
      } else if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
    }
    schedule()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [refresh])

  async function closeSession() {
    if (closing || refreshing) return
    setClosing(true)
    setCloseError(null)
    try {
      const response = await fetch(`/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}/close`, { method: "POST" })
      const body = (await response.json().catch(() => ({}))) as { status?: string; code?: string; error?: string; detail?: string }
      const alreadyClosed = body.status === "ALREADY_CLOSED" || body.code === "ALREADY_CLOSED"
      if (!response.ok && !alreadyClosed) throw new Error(body.error || body.detail || (response.status === 409 ? "The session has a close conflict or upload is in progress." : `Unable to close session (HTTP ${response.status}).`))
      setCloseOpen(false)
      refresh()
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : "Unable to close session.")
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <button type="button" onClick={refresh} disabled={refreshing || closing} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
      <span className="text-xs text-muted-foreground">{refreshFailed ? "Refresh failed — Retry" : refreshing ? "Refresh in progress" : `Last successful refresh ${new Date(lastRefreshAt.current).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span>
      {isActive && authorizedToClose ? (
        <>
          <button type="button" onClick={() => setCloseOpen(true)} disabled={refreshing || closing} className="inline-flex items-center rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">Close Session</button>
          {closeOpen ? <div role="dialog" aria-modal="true" aria-labelledby="close-session-title" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"><div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"><h3 id="close-session-title" className="text-lg font-bold text-foreground">Close this session?</h3><p className="mt-3 text-sm text-muted-foreground">Harvest date: <strong>{harvestDate}</strong></p><p className="mt-1 break-all text-sm text-muted-foreground">Session UUID: <strong>{sessionUuid}</strong></p><p className="mt-3 text-sm font-semibold text-destructive">Later records will be blocked after closure.</p>{closeError ? <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{closeError}</p> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setCloseOpen(false); setCloseError(null) }} disabled={closing} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={closeSession} disabled={closing} className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60">{closing ? "Closing…" : "Confirm close"}</button></div></div></div> : null}
        </>
      ) : null}
    </div>
  )
}
