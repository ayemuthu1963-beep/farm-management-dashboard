"use client"

import { useState } from "react"

const today = () => new Date().toISOString().slice(0, 10)

export function BeetleTrapEntryClient() {
  const [form, setForm] = useState({ trap_no: "75", inspection_date: today(), inspection_time: "07:30:00", beetle_count: "1", remarks: "Local RC Admin Console test" })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const beetleCount = Number(form.beetle_count)
    if (!form.trap_no.trim() || !form.inspection_date || beetleCount < 0) {
      setError("Trap number, date and non-negative beetle count are required.")
      return
    }
    const response = await fetch("/api/admin/beetle-trap/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trap_no: form.trap_no,
        inspection_date: form.inspection_date,
        inspection_time: form.inspection_time || null,
        beetle_count: beetleCount,
        remarks: form.remarks,
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.detail || payload.error || "Unable to save beetle count.")
      return
    }
    setMessage(`Saved local beetle count ${payload.inserted_row?.beetle_count_id ?? ""}.`)
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-bold">Trap No<input className="rounded-lg border p-2" value={form.trap_no} onChange={(e) => setForm({ ...form, trap_no: e.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Inspection Date<input className="rounded-lg border p-2" type="date" value={form.inspection_date} onChange={(e) => setForm({ ...form, inspection_date: e.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Inspection Time<input className="rounded-lg border p-2" type="time" step="1" value={form.inspection_time} onChange={(e) => setForm({ ...form, inspection_time: e.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Beetle Count<input className="rounded-lg border p-2" type="number" min="0" value={form.beetle_count} onChange={(e) => setForm({ ...form, beetle_count: e.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold md:col-span-2">Remarks<input className="rounded-lg border p-2" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700 md:col-span-3">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 md:col-span-3">{error}</div>}
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground md:col-span-3">Save Beetle Trap Entry</button>
    </form>
  )
}
