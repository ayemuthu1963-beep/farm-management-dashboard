"use client"

import { useState } from "react"

const today = () => new Date().toISOString().slice(0, 10)

export function WellWaterEntryClient() {
  const [form, setForm] = useState({ reading_date: today(), well_code: "well1", feet: "1", inches: "1", remarks: "Local RC Admin Console test" })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const feet = Number(form.feet || 0)
    const inches = Number(form.inches || 0)
    if (!form.reading_date || feet < 0 || inches < 0 || inches > 11 || feet + inches === 0) {
      setError("Date, well and a valid feet/inches reading are required.")
      return
    }
    const response = await fetch("/api/admin/well-water/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_date: form.reading_date, well_code: form.well_code, feet, inches, remarks: form.remarks }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.detail || payload.error || "Unable to save well reading.")
      return
    }
    setMessage(`Saved local reading ${payload.inserted_row?.reading_id ?? ""}. Remarks are not stored by this table.`)
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-bold">Reading Date<input className="rounded-lg border p-2" type="date" value={form.reading_date} onChange={(e) => setForm({ ...form, reading_date: e.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Well<select className="rounded-lg border p-2" value={form.well_code} onChange={(e) => setForm({ ...form, well_code: e.target.value })}><option value="well1">North Well</option><option value="well2">South Well</option></select></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">Feet<input className="rounded-lg border p-2" type="number" min="0" value={form.feet} onChange={(e) => setForm({ ...form, feet: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-sm font-bold">Inches<input className="rounded-lg border p-2" type="number" min="0" max="11" value={form.inches} onChange={(e) => setForm({ ...form, inches: e.target.value })} /></label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-bold md:col-span-3">Remarks<input className="rounded-lg border p-2" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700 md:col-span-3">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 md:col-span-3">{error}</div>}
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground md:col-span-3">Save Well Reading</button>
    </form>
  )
}
