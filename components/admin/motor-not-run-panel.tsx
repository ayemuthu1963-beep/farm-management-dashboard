"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, RefreshCw, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  createNoRunRecords,
  loadNoRunRecords,
  voidNoRunRecord,
  type NoRunRecord,
} from "@/lib/motor-runtime-management-api"
import type { MotorId } from "@/lib/motor-screenshot-analysis-types"

const fieldClass = "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
const MOTOR_OPTIONS: Array<{ value: MotorId | "all"; label: string }> = [
  { value: "all", label: "All Motors" },
  { value: "motor-1", label: "Motor 1" },
  { value: "motor-2", label: "Motor 2" },
  { value: "motor-3", label: "Motor 3" },
]

function farmTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

function displayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00+05:30`)
  return parsed.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })
}

function auditTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value))
}

export function MotorNotRunPanel() {
  const [operationDate, setOperationDate] = useState(farmTodayIso)
  const [motor, setMotor] = useState<MotorId | "all">("all")
  const [reason, setReason] = useState("")
  const [remarks, setRemarks] = useState("")
  const [records, setRecords] = useState<NoRunRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const query = new URLSearchParams({ start_date: operationDate, end_date: operationDate })
      setRecords(await loadNoRunRecords(query))
      setError(null)
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load Motor Not Run records.")
    } finally {
      setBusy(false)
    }
  }, [operationDate])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ start_date: operationDate, end_date: operationDate })
    loadNoRunRecords(query).then((rows) => {
      if (active) setRecords(rows)
    }).catch((value) => {
      if (active) setError(value instanceof Error ? value.message : "Unable to load Motor Not Run records.")
    })
    return () => { active = false }
  }, [operationDate])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason.trim()) {
      setError("Reason is required.")
      return
    }
    const motorIds: MotorId[] = motor === "all" ? ["motor-1", "motor-2", "motor-3"] : [motor]
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await createNoRunRecords({
        operation_date: operationDate,
        motor_ids: motorIds,
        status: "Not Run",
        reason: reason.trim(),
        remarks: remarks.trim() || null,
      })
      setReason("")
      setRemarks("")
      setMessage(`${result.inserted_count} Motor Not Run record${result.inserted_count === 1 ? "" : "s"} saved.`)
      await refresh()
    } catch (value) {
      setError(value instanceof Error ? value.message : "Motor Not Run records were not saved.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(record: NoRunRecord) {
    if (!window.confirm(`Void the Not Run record for ${record.motor_id.replace("motor-", "Motor ")} on ${record.operation_date}?`)) return
    setBusy(true)
    setError(null)
    try {
      await voidNoRunRecord(record.id)
      setMessage("Motor Not Run record voided. Actual timing can now be published for that motor and date.")
      await refresh()
    } catch (value) {
      setError(value instanceof Error ? value.message : "Motor Not Run record could not be voided.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-4">
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
      <h2 className="font-serif text-lg font-bold text-sky-950">Daily Motor Not Run</h2>
      <p className="mt-1 text-sm text-sky-900/80">Confirm a genuine zero-runtime day without inventing start or end times. Existing or later actual runtime cannot coexist until this record is voided.</p>
      <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
        <label className="text-xs font-semibold">Date (Asia/Kolkata)<input type="date" required max={farmTodayIso()} value={operationDate} onChange={(event) => setOperationDate(event.target.value)} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-semibold">Motor<select value={motor} onChange={(event) => setMotor(event.target.value as MotorId | "all")} className={`${fieldClass} mt-1`}>{MOTOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="text-xs font-semibold">Status<input value="Not Run" readOnly className={`${fieldClass} mt-1 bg-muted`} /></label>
        <label className="text-xs font-semibold">Reason<input required maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Heavy rain" className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-semibold">Remarks (optional)<input maxLength={1000} value={remarks} onChange={(event) => setRemarks(event.target.value)} className={`${fieldClass} mt-1`} /></label>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-5"><Button type="submit" disabled={busy}><Save className="size-4" /> Save Not Run</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}><RefreshCw className="size-4" /> Refresh</Button><span className="text-xs text-muted-foreground">Source: Manual Admin</span></div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{message}</p>}
    </section>

    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4"><h3 className="font-serif font-bold">Confirmed no-run records for {displayDate(operationDate)}</h3></div>
      {busy && records.length === 0 ? <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted"><tr className="text-left"><th className="p-3">Date</th><th className="p-3">Motor</th><th className="p-3">Status</th><th className="p-3">Reason</th><th className="p-3">Remarks</th><th className="p-3">Source</th><th className="p-3">Entered by</th><th className="p-3">Audit timestamp (IST)</th><th className="p-3">Action</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-border"><td className="p-3">{displayDate(record.operation_date)}</td><td className="p-3 font-semibold">{record.motor_id.replace("motor-", "Motor ")}</td><td className="p-3">{record.status}</td><td className="p-3">{record.reason}</td><td className="p-3">{record.remarks || "—"}</td><td className="p-3">Manual Admin</td><td className="p-3">{record.entered_by}</td><td className="p-3">{auditTime(record.created_at)}</td><td className="p-3"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void remove(record)}><Trash2 className="size-4" /> Void</Button></td></tr>)}</tbody></table>{records.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No confirmed no-run information for this date.</p>}</div>}
    </section>
  </div>
}
