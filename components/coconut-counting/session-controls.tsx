"use client"

import { useEffect, useState } from "react"

interface SessionControlsProps {
  sessionUuid: string
  harvestDate: string
  isActive: boolean
  pageRefreshing: boolean
  syncInProgress?: boolean
  uploadInProgress?: boolean
}

export function CoconutCountingSessionControls({ sessionUuid, harvestDate, isActive, pageRefreshing, syncInProgress, uploadInProgress }: SessionControlsProps) {
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [pageRefreshActive, setPageRefreshActive] = useState(pageRefreshing)
  useEffect(() => { const onRefresh = (event: Event) => setPageRefreshActive((event as CustomEvent<boolean>).detail); window.addEventListener("coconut-counting-refresh", onRefresh); return () => window.removeEventListener("coconut-counting-refresh", onRefresh) }, [])
  const blocked = pageRefreshActive || closing || Boolean(syncInProgress || uploadInProgress)

  async function closeSession() {
    if (blocked) return
    setClosing(true); setCloseError(null)
    try {
      const response = await fetch(`/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}/close`, { method: "POST" })
      const body = (await response.json().catch(() => ({}))) as { status?: string; code?: string; error?: string; detail?: string }
      const alreadyClosed = body.status === "ALREADY_CLOSED" || body.code === "ALREADY_CLOSED"
      if (!response.ok && !alreadyClosed) throw new Error(body.error || body.detail || `Unable to close session (HTTP ${response.status}).`)
      setCloseOpen(false)
      window.location.reload()
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : "Unable to close session.")
    } finally { setClosing(false) }
  }

  if (!isActive) return null
  return <>
    <button type="button" onClick={() => setCloseOpen(true)} disabled={blocked} className="inline-flex items-center rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">Close Session</button>
    {closeOpen ? <div role="dialog" aria-modal="true" aria-labelledby="close-session-title" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"><div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"><h3 id="close-session-title" className="text-lg font-bold text-foreground">Close this session?</h3><p className="mt-3 text-sm text-muted-foreground">Harvest date: <strong>{harvestDate}</strong></p><p className="mt-1 break-all text-sm text-muted-foreground">Session UUID: <strong>{sessionUuid}</strong></p><p className="mt-3 text-sm font-semibold text-destructive">Later records will be blocked after closure.</p>{syncInProgress || uploadInProgress ? <p role="alert" className="mt-3 text-sm font-semibold text-amber-700">The backend reports an upload or sync in progress. Try again when it completes.</p> : null}{closeError ? <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{closeError}</p> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setCloseOpen(false); setCloseError(null) }} disabled={closing} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={closeSession} disabled={blocked} className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60">{closing ? "Closing…" : "Confirm close"}</button></div></div></div> : null}
  </>
}
