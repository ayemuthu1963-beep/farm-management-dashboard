"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Save, X } from "lucide-react"

import { HarvestButtonSpinner } from "@/components/coconut/harvest-request-state"
import { createRequestAbortScope } from "@/lib/coconut-counting-reconciliation"

const ASSIGNMENT_SAVE_TIMEOUT_MS = 15_000

type AssignmentResponse = {
  error?: string
  detail?: string
}

export function CoconutCountingSessionAssignmentEditor({
  sessionUuid,
  harvestDate,
  currentCycle,
  currentPlot,
  suggestedCycle,
}: {
  sessionUuid: string
  harvestDate: string
  currentCycle: number | null
  currentPlot: 1 | 2 | null
  suggestedCycle: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cycle, setCycle] = useState("")
  const [plot, setPlot] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedMessage, setSavedMessage] = useState("")

  const isCorrection = currentCycle !== null || currentPlot !== null

  function beginEdit() {
    setCycle(String(currentCycle ?? suggestedCycle ?? ""))
    setPlot(currentPlot === null ? "" : String(currentPlot))
    setReason("")
    setError("")
    setSavedMessage("")
    setOpen(true)
  }

  function cancelEdit() {
    if (saving) return
    setOpen(false)
    setError("")
  }

  async function saveAssignment() {
    if (saving) return
    const nextCycle = Number(cycle)
    const nextPlot = Number(plot)
    if (!/^\d{1,3}$/.test(cycle) || !Number.isSafeInteger(nextCycle) || nextCycle < 1 || nextCycle > 100) {
      setError("Cycle must be a whole number from 1 to 100.")
      return
    }
    if (nextPlot !== 1 && nextPlot !== 2) {
      setError("Select Plot 1 or Plot 2.")
      return
    }
    if (nextCycle === currentCycle && nextPlot === currentPlot) {
      setOpen(false)
      return
    }
    const overwritesAssignedValue =
      (currentCycle !== null && nextCycle !== currentCycle)
      || (currentPlot !== null && nextPlot !== currentPlot)
    if (overwritesAssignedValue && !reason.trim()) {
      setError("Enter a reason for changing an existing assignment.")
      return
    }

    setSaving(true)
    setError("")
    const abortScope = createRequestAbortScope(ASSIGNMENT_SAVE_TIMEOUT_MS)
    try {
      const response = await fetch(
        `/api/coconut-counting-admin/sessions/${encodeURIComponent(sessionUuid)}/assignment`,
        {
          method: "PATCH",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            harvest_cycle: nextCycle,
            plot: nextPlot,
            expected_harvest_cycle: currentCycle,
            expected_plot: currentPlot,
            reason: reason.trim() || null,
          }),
          signal: abortScope.signal,
        },
      )
      const body = (await response.json().catch(() => ({}))) as AssignmentResponse
      if (!response.ok) {
        throw new Error(body.error ?? body.detail ?? `Unable to save Cycle and Plot (HTTP ${response.status}).`)
      }
      setOpen(false)
      setSavedMessage(`Cycle ${nextCycle} / Plot ${nextPlot} saved.`)
      router.refresh()
    } catch (caught) {
      if (abortScope.didTimeout()) {
        setError("Saving Cycle and Plot timed out. The result may be unknown; refresh the page before retrying.")
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to save Cycle and Plot.")
      }
    } finally {
      abortScope.cleanup()
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1" aria-live="polite">
      <button
        type="button"
        onClick={beginEdit}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-primary hover:bg-accent"
      >
        <Pencil className="size-3" aria-hidden="true" />
        {isCorrection ? "Edit Cycle / Plot" : "Assign Cycle / Plot"}
      </button>
      {savedMessage ? <p role="status" className="text-xs font-semibold text-emerald-700">{savedMessage}</p> : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`assign-session-${sessionUuid}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-left shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`assign-session-${sessionUuid}`} className="text-lg font-bold text-foreground">
                  {isCorrection ? "Edit Cycle and Plot" : "Assign Cycle and Plot"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Harvest date: <strong>{harvestDate}</strong></p>
              </div>
              <button type="button" onClick={cancelEdit} disabled={saving} aria-label="Close Cycle and Plot editor" className="rounded-md p-1 hover:bg-accent disabled:opacity-60">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Harvest cycle
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  value={cycle}
                  onChange={(event) => setCycle(event.target.value)}
                  disabled={saving}
                  className="h-10 rounded-lg border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Plot
                <select
                  value={plot}
                  onChange={(event) => setPlot(event.target.value)}
                  disabled={saving}
                  className="h-10 rounded-lg border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select plot</option>
                  <option value="1">Plot 1</option>
                  <option value="2">Plot 2</option>
                </select>
              </label>
            </div>

            {isCorrection ? (
              <label className="mt-4 grid gap-1.5 text-sm font-semibold text-foreground">
                Reason for correction
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={saving}
                  placeholder="Required only when changing an existing Cycle or Plot"
                  className="rounded-lg border border-input bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ) : null}

            <p className="mt-4 break-all text-xs text-muted-foreground">Session {sessionUuid}</p>
            <p className="mt-2 text-xs text-muted-foreground">This changes the website record only. The APK does not need to be amended.</p>
            {error ? <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cancelEdit} disabled={saving} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={saveAssignment} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {saving ? <HarvestButtonSpinner /> : <Save className="size-4" aria-hidden="true" />}
                {saving ? "Saving…" : "Save Cycle / Plot"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
