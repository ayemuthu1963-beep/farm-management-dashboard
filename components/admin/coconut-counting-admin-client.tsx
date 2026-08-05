"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Database, Save, ShieldCheck } from "lucide-react"
import type { CoconutCountingEntry, CoconutCountingSessionDetail } from "@/lib/coconut-counting-api"

interface Props {
  detail: CoconutCountingSessionDetail
}

interface SaveResult {
  ok: boolean
  message: string
}

interface EntryField {
  name: keyof CoconutCountingEntry
  label: string
  kind: "text" | "number" | "date" | "datetime" | "select"
  nullable?: boolean
  options?: string[]
  step?: string
}

const entryFields: EntryField[] = [
  { name: "entry_datetime", label: "Entry date/time", kind: "datetime" },
  { name: "entry_date", label: "Entry date", kind: "date" },
  { name: "entry_time", label: "Entry time text", kind: "text" },
  { name: "grade_name", label: "Grade", kind: "select", options: ["Grade A", "Grade B"] },
  { name: "count_type", label: "Count type", kind: "select", options: ["Fixed 200", "Manual", "Manual Pairs"] },
  { name: "pair_count", label: "Pair count", kind: "number", nullable: true, step: "0.5" },
  { name: "entered_pairs", label: "Entered pairs", kind: "number", nullable: true, step: "0.5" },
  { name: "pair_half_units", label: "Pair half-units", kind: "number", nullable: true, step: "1" },
  { name: "count_value", label: "Sale count value", kind: "number", step: "0.5" },
  { name: "nut_count", label: "Nut count", kind: "number", nullable: true, step: "1" },
  { name: "physical_nuts", label: "Physical nuts", kind: "number", nullable: true, step: "1" },
  { name: "sale_equivalent_half_units", label: "Sale equivalent half-units", kind: "number", nullable: true, step: "1" },
  { name: "count_rule", label: "Count rule", kind: "text", nullable: true },
  { name: "grade_a_value", label: "Grade A contribution", kind: "number", step: "0.5" },
  { name: "grade_b_value", label: "Grade B contribution", kind: "number", step: "0.5" },
  { name: "latitude", label: "Latitude", kind: "number", nullable: true, step: "any" },
  { name: "longitude", label: "Longitude", kind: "number", nullable: true, step: "any" },
  { name: "altitude", label: "Altitude", kind: "number", nullable: true, step: "any" },
  { name: "gps_accuracy", label: "GPS accuracy", kind: "number", nullable: true, step: "any" },
  { name: "gps_status", label: "GPS status", kind: "select", options: ["CAPTURED", "UNAVAILABLE", "PENDING"] },
  { name: "gps_captured_at", label: "GPS captured date/time", kind: "datetime", nullable: true },
  { name: "device_name", label: "Device name", kind: "text" },
]

function dateTimeInputValue(value: unknown): string {
  if (!value) return ""
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 16)
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function inputValue(field: EntryField, value: unknown): string {
  if (value === null || value === undefined) return ""
  return field.kind === "datetime" ? dateTimeInputValue(value) : String(value)
}

function responseError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const value = payload as { message?: unknown; detail?: unknown; errors?: unknown }
  if (typeof value.message === "string") return value.message
  if (typeof value.detail === "string") return value.detail
  if (Array.isArray(value.detail) && value.detail.length) {
    const first = value.detail[0] as { msg?: unknown }
    if (first && typeof first.msg === "string") return first.msg
  }
  if (Array.isArray(value.errors) && typeof value.errors[0] === "string") return value.errors[0]
  return fallback
}

function ResultBox({ result }: { result: SaveResult | null }) {
  if (!result) return null
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${result.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      {result.message}
    </div>
  )
}

function SessionEditForm({ detail }: Props) {
  const session = detail.session
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<SaveResult | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const changes: Record<string, unknown> = {}
    const textFields = ["session_date", "start_time", "end_time", "device_operator_identifier", "status"] as const
    for (const name of textFields) {
      const next = String(data.get(name) ?? "").trim()
      const previous = session[name] ?? ""
      if (next !== String(previous)) changes[name] = name === "end_time" && !next ? null : next
    }
    const totalText = String(data.get("total_nuts_harvested") ?? "").trim()
    if (totalText !== String(session.total_nuts_harvested ?? "")) {
      changes.total_nuts_harvested = totalText ? Number(totalText) : null
    }
    if (!Object.keys(changes).length) {
      setResult({ ok: false, message: "No session values were changed." })
      return
    }

    setSaving(true)
    setResult(null)
    try {
      const response = await fetch(`/api/admin/coconut-counting/sessions/${encodeURIComponent(session.session_uuid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(changes),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(responseError(payload, `Session edit failed with HTTP ${response.status}.`))
      setResult({ ok: true, message: "Session changes saved and added to the audit history." })
      router.refresh()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Session edit failed." })
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = "mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div><h2 className="font-black uppercase text-amber-950">Edit selected session</h2><p className="text-xs text-amber-900">Session UUID is protected: {session.session_uuid}</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-bold">Harvest date<input className={fieldClass} name="session_date" type="date" defaultValue={session.session_date} /></label>
        <label className="text-sm font-bold">Start time<input className={fieldClass} name="start_time" defaultValue={session.start_time} /></label>
        <label className="text-sm font-bold">End time<input className={fieldClass} name="end_time" defaultValue={session.end_time ?? ""} placeholder="Blank if not ended" /></label>
        <label className="text-sm font-bold">Operator identifier<input className={fieldClass} name="device_operator_identifier" defaultValue={session.device_operator_identifier} /></label>
        <label className="text-sm font-bold">Status<select className={fieldClass} name="status" defaultValue={session.status}><option>ACTIVE</option><option>COMPLETED</option><option>ENDED</option></select></label>
        <label className="text-sm font-bold">Total nuts harvested<input className={fieldClass} name="total_nuts_harvested" type="number" min="0" step="1" defaultValue={session.total_nuts_harvested ?? ""} /></label>
      </div>
      <ResultBox result={result} />
      <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-black uppercase text-white hover:bg-amber-700 disabled:opacity-60"><Save className="size-4" />{saving ? "Saving" : "Save session changes"}</button>
    </form>
  )
}

function EntryEditForm({ entry }: { entry: CoconutCountingEntry }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<SaveResult | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const changes: Record<string, unknown> = {}
    for (const field of entryFields) {
      const nextText = String(data.get(String(field.name)) ?? "").trim()
      const previousText = inputValue(field, entry[field.name])
      if (nextText === previousText) continue
      if (!nextText && field.nullable) changes[field.name] = null
      else if (field.kind === "number") changes[field.name] = Number(nextText)
      else if (field.kind === "datetime") changes[field.name] = new Date(nextText).toISOString()
      else changes[field.name] = nextText
    }
    if (!Object.keys(changes).length) {
      setResult({ ok: false, message: "No entry values were changed." })
      return
    }
    setSaving(true)
    setResult(null)
    try {
      const response = await fetch(`/api/admin/coconut-counting/entries/${encodeURIComponent(entry.entry_uuid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(changes),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(responseError(payload, `Entry edit failed with HTTP ${response.status}.`))
      setResult({ ok: true, message: "Entry saved; running and session totals were recalculated." })
      router.refresh()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Entry edit failed." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 font-bold text-foreground">Entry {entry.entry_sequence} · {entry.grade_name} · {entry.count_type}</summary>
      <form onSubmit={save} className="space-y-4 border-t border-border p-4">
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Protected: entry UUID {entry.entry_uuid}; sequence {entry.entry_sequence}; running totals and server timestamps are calculated/read-only.</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {entryFields.map((field) => (
            <label key={String(field.name)} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {field.label}
              {field.kind === "select" ? (
                <select name={String(field.name)} defaultValue={inputValue(field, entry[field.name])} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium normal-case text-foreground">
                  {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  name={String(field.name)}
                  type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : field.kind === "datetime" ? "datetime-local" : "text"}
                  step={field.step}
                  min={field.kind === "number" && !["latitude", "longitude", "altitude"].includes(String(field.name)) ? "0" : undefined}
                  defaultValue={inputValue(field, entry[field.name])}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium normal-case text-foreground"
                />
              )}
            </label>
          ))}
        </div>
        <ResultBox result={result} />
        <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black uppercase text-primary-foreground hover:opacity-90 disabled:opacity-60"><Save className="size-4" />{saving ? "Saving" : "Save entry changes"}</button>
      </form>
    </details>
  )
}

export function CoconutCountingAdminClient({ detail }: Props) {
  const adminEdits = detail.admin_edits ?? []
  return (
    <div className="space-y-5">
      <SessionEditForm detail={detail} />
      <section className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-sm">
        <div className="flex items-start gap-3"><Database className="mt-0.5 size-5 text-primary" /><div><h2 className="font-black uppercase">Edit count entries</h2><p className="text-xs text-muted-foreground">Open an entry to amend its Coconut Counting business values. Totals are recalculated after saving.</p></div></div>
        {detail.entries.length ? detail.entries.map(entry => <EntryEditForm key={entry.entry_uuid} entry={entry} />) : <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">This session has no count entries.</p>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3"><h2 className="font-black uppercase">Admin edit audit history</h2><p className="text-xs text-muted-foreground">Every saved change records the authenticated Preview user and complete before/after values.</p></div>
        {adminEdits.length ? (
          <div className="divide-y divide-border">
            {adminEdits.map(edit => (
              <article key={edit.edit_uuid} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{edit.target_type} · {edit.changed_fields.join(", ")}</p><p className="text-xs text-muted-foreground">{edit.admin_username} · {new Date(edit.edited_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div>
                <details className="rounded-lg bg-muted/60 px-3 py-2"><summary className="cursor-pointer text-xs font-bold uppercase">View before / after</summary><div className="mt-2 grid gap-2 xl:grid-cols-2"><pre className="overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">Before{`\n`}{JSON.stringify(edit.before_values, null, 2)}</pre><pre className="overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">After{`\n`}{JSON.stringify(edit.after_values, null, 2)}</pre></div></details>
              </article>
            ))}
          </div>
        ) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No webpage admin edits have been recorded for this session.</p>}
      </section>
    </div>
  )
}
