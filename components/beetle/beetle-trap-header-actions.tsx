"use client"

import { useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatIstDateTime } from "@/lib/format-ist-date-time"
import { OdkCentralLink } from "@/components/odk/odk-central-link"
import {
  BEETLE_TRAP_DATA_UPDATED_EVENT,
  beetleTrapSyncErrorMessage,
  beetleTrapSyncMessage,
  parseBeetleTrapSyncResult,
} from "@/lib/beetle-sync"

type SyncNotice = {
  kind: "success" | "warning" | "error"
  message: string
}

export function BeetleTrapHeaderActions() {
  const router = useRouter()
  const syncInProgressRef = useRef(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncNotice, setSyncNotice] = useState<SyncNotice | null>(null)
  const [latestSuccessfulSyncAt, setLatestSuccessfulSyncAt] = useState<string | null>(null)

  async function syncOdkNow() {
    if (syncInProgressRef.current) return

    syncInProgressRef.current = true
    setIsSyncing(true)
    setSyncNotice(null)

    try {
      const response = await fetch("/api/admin/beetle-trap/sync", {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload: unknown = await response.json().catch(() => null)
      const result = parseBeetleTrapSyncResult(payload)

      if (!response.ok || !result) {
        throw new Error(beetleTrapSyncErrorMessage(payload))
      }

      setSyncNotice({
        kind: result.status === "partial" || result.records_rejected_or_failed > 0 ? "warning" : "success",
        message: beetleTrapSyncMessage(result),
      })
      setLatestSuccessfulSyncAt(result.latest_successful_sync_at || result.sync_completed_at)
      router.refresh()
      window.dispatchEvent(new Event(BEETLE_TRAP_DATA_UPDATED_EVENT))
    } catch (error) {
      setSyncNotice({
        kind: "error",
        message: error instanceof Error ? error.message : beetleTrapSyncErrorMessage(null),
      })
    } finally {
      syncInProgressRef.current = false
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <OdkCentralLink form="beetleTrap" />
        <button
          type="button"
          onClick={syncOdkNow}
          disabled={isSyncing}
          aria-busy={isSyncing}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
          {isSyncing ? "Syncing…" : "Sync ODK Now"}
        </button>
      </div>

      {syncNotice ? (
        <div
          role={syncNotice.kind === "error" ? "alert" : "status"}
          aria-live={syncNotice.kind === "error" ? "assertive" : "polite"}
          className={
            syncNotice.kind === "error"
              ? "max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-right text-xs font-medium text-destructive"
              : syncNotice.kind === "warning"
                ? "max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-right text-xs font-medium text-foreground"
                : "max-w-md rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-right text-xs font-medium text-foreground"
          }
        >
          {syncNotice.message}
        </div>
      ) : null}

      {latestSuccessfulSyncAt ? (
        <p className="text-right text-xs text-muted-foreground" aria-live="polite">
          Latest successful sync: {formatIstDateTime(latestSuccessfulSyncAt)}
        </p>
      ) : null}
    </div>
  )
}
