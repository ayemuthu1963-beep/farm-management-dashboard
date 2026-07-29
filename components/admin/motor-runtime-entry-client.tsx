"use client"

import { useState } from "react"

const plots = [
  { plot: "Plot2_East", motors: [{ motor: 1, valve: 1 }, { motor: 2, valve: 7 }, { motor: 3, valve: 13 }] },
  { plot: "Plot2_West", motors: [{ motor: 1, valve: 2 }, { motor: 2, valve: 8 }, { motor: 3, valve: 14 }] },
  { plot: "Plot1_East", motors: [{ motor: 1, valve: 3 }, { motor: 2, valve: 9 }] },
  { plot: "Plot1_West", motors: [{ motor: 1, valve: 4 }, { motor: 2, valve: 10 }] },
  { plot: "Nutmug", motors: [{ motor: 1, valve: 5 }, { motor: 2, valve: 11 }] },
  { plot: "Jack_Fruit", motors: [{ motor: 1, valve: 6 }, { motor: 2, valve: 12 }, { motor: 3, valve: 15 }] },
]

const today = () => new Date().toISOString().slice(0, 10)

export function MotorRuntimeEntryClient() {
  const [form, setForm] = useState({ entry_date: today(), plot: "Plot1_East", motorValve: "1:3", hours: "0", minutes: "15", remarks: "Local RC Admin Console test" })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedPlot = plots.find((item) => item.plot === form.plot) ?? plots[0]

  function update(name: string, value: string) {
    setForm((current) => {
      if (name === "plot") {
        const first = plots.find((item) => item.plot === value)?.motors[0]
        return { ...current, plot: value, motorValve: first ? `${first.motor}:${first.valve}` : current.motorValve }
      }
      return { ...current, [name]: value }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const [motorNo, valveNo] = form.motorValve.split(":").map(Number)
    const hours = Number(form.hours || 0)
    const minutes = Number(form.minutes || 0)
    if (!form.entry_date || hours < 0 || minutes < 0 || minutes > 59 || hours * 60 + minutes < 1) {
      setError("Date and a valid runtime are required.")
      return
    }
    const response = await fetch("/api/admin/motor-runtime/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_date: form.entry_date,
        remarks: form.remarks || "Local RC Admin Console test",
        entries: [{ plot: form.plot, motor_no: motorNo, valve_no: valveNo, hours, minutes }],
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.detail || payload.error || "Unable to save motor runtime.")
      return
    }
    setMessage(`Saved ${payload.inserted_count ?? 1} local motor runtime entry.`)
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-bold">Entry Date<input className="rounded-lg border p-2" type="date" value={form.entry_date} onChange={(e) => update("entry_date", e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Plot<select className="rounded-lg border p-2" value={form.plot} onChange={(e) => update("plot", e.target.value)}>{plots.map((item) => <option key={item.plot}>{item.plot}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Motor / Valve<select className="rounded-lg border p-2" value={form.motorValve} onChange={(e) => update("motorValve", e.target.value)}>{selectedPlot.motors.map((item) => <option key={`${item.motor}:${item.valve}`} value={`${item.motor}:${item.valve}`}>Motor {item.motor} / Valve{item.valve}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Hours<input className="rounded-lg border p-2" type="number" min="0" max="24" value={form.hours} onChange={(e) => update("hours", e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Minutes<input className="rounded-lg border p-2" type="number" min="0" max="59" value={form.minutes} onChange={(e) => update("minutes", e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold md:col-span-3">Remarks<input className="rounded-lg border p-2" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} /></label>
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700 md:col-span-3">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 md:col-span-3">{error}</div>}
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground md:col-span-3">Save Motor Runtime Entry</button>
    </form>
  )
}
