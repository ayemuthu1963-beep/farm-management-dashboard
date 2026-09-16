"use client"

import { useEffect, useState } from "react"
import { Pencil, Save, X } from "lucide-react"

import { HarvestButtonSpinner } from "@/components/coconut/harvest-request-state"
import {
  formatReconciliationNumber,
  type CoconutCountingReconciliationPlot,
} from "@/lib/coconut-counting-reconciliation"

const HARVESTED_SAVE_TIMEOUT_MS = 15_000

export function CoconutCountingHarvestedEditor({
  summary,
  onSaved,
  idPrefix,
}: {
  summary: CoconutCountingReconciliationPlot
  onSaved: () => Promise<void>
  idPrefix: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(summary.harvested === null ? "" : String(summary.harvested))
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!editing) setValue(summary.harvested === null ? "" : String(summary.harvested))
  }, [editing, summary.harvested])

  async function save() {
    const harvested = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(harvested)) {
      setError("Enter a non-negative whole number.")
      return
    }
    if (summary.harvested_revision > 0 && !reason.trim()) {
      setError("Enter a reason for this correction.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch(
        `/api/coconut-counting-admin/cycles/${summary.harvest_cycle}/plots/${summary.plot}/harvested`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            harvested_nuts: harvested,
            expected_revision: summary.harvested_revision,
            reason: reason.trim() || null,
          }),
          signal: AbortSignal.timeout(HARVESTED_SAVE_TIMEOUT_MS),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
      if (!response.ok) throw new Error(payload.error ?? payload.detail ?? "Harvested total could not be saved.")
      await onSaved()
      setReason("")
      setEditing(false)
    } catch (caught) {
      const timedOut = caught instanceof Error && (caught.name === "TimeoutError" || caught.name === "AbortError")
      if (timedOut) {
        setError("Saving Harvested timed out after 15 seconds. The save outcome may be unknown; Refresh the harvest table before retrying.")
      } else {
        setError(caught instanceof Error ? caught.message : "Harvested total could not be saved.")
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="font-bold tabular-nums">{formatReconciliationNumber(summary.harvested)}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-primary hover:bg-accent"
        >
          <Pencil className="size-3" aria-hidden="true" />
          {summary.harvested === null ? "Enter" : "Edit"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-w-48 flex-col items-stretch gap-1.5">
      <label className="sr-only" htmlFor={`${idPrefix}-harvested-${summary.harvest_cycle}-${summary.plot}`}>
        Cycle {summary.harvest_cycle} Plot {summary.plot} Harvested
      </label>
      <input
        id={`${idPrefix}-harvested-${summary.harvest_cycle}-${summary.plot}`}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={saving}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
      />
      {summary.harvested_revision > 0 ? (
        <>
          <label className="sr-only" htmlFor={`${idPrefix}-harvested-reason-${summary.harvest_cycle}-${summary.plot}`}>
            Reason for correction
          </label>
          <input
            id={`${idPrefix}-harvested-reason-${summary.harvest_cycle}-${summary.plot}`}
            type="text"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={saving}
            placeholder="Reason for correction"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </>
      ) : null}
      {error ? <p className="text-left text-xs font-medium text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError("")
            setReason("")
          }}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-accent disabled:opacity-60"
        >
          <X className="size-3" aria-hidden="true" /> Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <HarvestButtonSpinner /> : <Save className="size-3" aria-hidden="true" />}
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  )
}
