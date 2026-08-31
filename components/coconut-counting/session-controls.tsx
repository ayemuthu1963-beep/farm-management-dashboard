"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface CoconutCountingSessionControlsProps {
  sessionUuid: string
  harvestDate: string
  isActive: boolean
}

type CloseResponse = {
  ok?: boolean
  status?: string
  code?: string
  error?: string
  detail?: string
}

export function CoconutCountingSessionControls({
  sessionUuid,
  harvestDate,
  isActive,
}: CoconutCountingSessionControlsProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeResult, setCloseResult] = useState<string | null>(null)

  function cancelClose() {
    if (closing) return
    setDialogOpen(false)
    setCloseError(null)
  }

  async function confirmClose() {
    if (closing) return
    setClosing(true)
    setCloseError(null)
    setCloseResult(null)

    try {
      const response = await fetch(
        `/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}/close`,
        { method: "POST", headers: { Accept: "application/json" } },
      )
      const body = (await response.json().catch(() => ({}))) as CloseResponse
      const alreadyClosed =
        body.status === "ALREADY_CLOSED" || body.code === "ALREADY_CLOSED"
      if (!response.ok && !alreadyClosed) {
        throw new Error(
          body.error ||
            body.detail ||
            (response.status === 409
              ? "Synchronization is in progress. Retry after it completes."
              : `Unable to close this session (HTTP ${response.status}).`),
        )
      }

      setDialogOpen(false)
      setCloseResult(alreadyClosed ? "This session was already closed." : "Session closed.")
      router.refresh()
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : "Unable to close this session.")
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2" aria-live="polite">
      {isActive ? (
        <button
          type="button"
          onClick={() => {
            setCloseError(null)
            setCloseResult(null)
            setDialogOpen(true)
          }}
          disabled={closing}
          className="inline-flex items-center rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Close Session
        </button>
      ) : null}

      {closeResult ? <p role="status" className="text-xs font-semibold text-emerald-700">{closeResult}</p> : null}

      {dialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-coconut-session-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-left shadow-xl">
            <h3 id="close-coconut-session-title" className="text-lg font-bold text-foreground">
              Close this session?
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Harvest date: <strong>{harvestDate}</strong>
            </p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              Session UUID: <strong>{sessionUuid}</strong>
            </p>
            <p className="mt-3 text-sm font-semibold text-destructive">
              Later device records will be blocked after closure.
            </p>
            {closeError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                {closeError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelClose}
                disabled={closing}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClose}
                disabled={closing}
                className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >
                {closing ? "Closing…" : "Confirm close"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
