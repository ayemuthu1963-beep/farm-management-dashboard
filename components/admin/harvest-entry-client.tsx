"use client"

import type { FormEvent } from "react"
import { useMemo, useRef, useState } from "react"
import Link from "next/link"

type SaveResult = {
  ok: boolean
  inserted: boolean
  harvest_cycle: string | null
  record: {
    harvest_record_id: number
    tree_no: string
    harvest_date: string
    bunch1_nuts: number | null
    bunch2_nuts: number | null
    bunch3_nuts: number | null
    total_bunches: number
    total_nuts: number
    remarks: string | null
    odk_submission_id: string
    source: string
    created_at: string
  }
}

const today = () => new Date().toISOString().slice(0, 10)

function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseOptionalInteger(value: string): number | null {
  if (value.trim() === "") {
    return null
  }
  return Number(value)
}

function errorText(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const maybe = payload as { detail?: unknown; error?: unknown }
    if (typeof maybe.detail === "string") {
      return maybe.detail
    }
    if (Array.isArray(maybe.detail) && maybe.detail.length > 0) {
      return maybe.detail.map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      }).join(" ")
    }
    if (typeof maybe.error === "string") {
      return maybe.error
    }
  }
  return fallback
}

export function HarvestEntryClient() {
  const [treeNo, setTreeNo] = useState("1")
  const [harvestDate, setHarvestDate] = useState(today())
  const [bunchCount, setBunchCount] = useState("2")
  const [bunch1, setBunch1] = useState("10")
  const [bunch2, setBunch2] = useState("12")
  const [bunch3, setBunch3] = useState("")
  const [remarks, setRemarks] = useState("Local RC Admin Console harvest test")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SaveResult | null>(null)
  const requestIdRef = useRef(newRequestId())

  const count = Number(bunchCount)
  const visibleValues = useMemo(() => {
    return [bunch1, bunch2, bunch3].slice(0, count).map(parseOptionalInteger)
  }, [bunch1, bunch2, bunch3, count])
  const totalNuts = visibleValues.reduce<number>((sum, value) => sum + (value !== null && Number.isFinite(value) ? value : 0), 0)

  function updateBunchCount(value: string) {
    setBunchCount(value)
    const nextCount = Number(value)
    if (nextCount < 3) {
      setBunch3("")
    }
    if (nextCount < 2) {
      setBunch2("")
    }
  }

  function clearForm() {
    setTreeNo("")
    setHarvestDate(today())
    setBunchCount("1")
    setBunch1("")
    setBunch2("")
    setBunch3("")
    setRemarks("")
    setError(null)
    setResult(null)
    requestIdRef.current = newRequestId()
  }

  function validate() {
    const cleanTree = treeNo.trim()
    if (!cleanTree) {
      return "Tree Number is required."
    }
    if (!harvestDate) {
      return "Harvest Date is required."
    }
    if (![1, 2, 3].includes(count)) {
      return "Bunch Count must be 1, 2 or 3."
    }
    for (let index = 0; index < count; index += 1) {
      const raw = [bunch1, bunch2, bunch3][index]
      if (raw.trim() === "") {
        return `Bunch ${index + 1} Nuts is required.`
      }
      if (!/^\d+$/.test(raw.trim())) {
        return `Bunch ${index + 1} Nuts must be a whole number.`
      }
    }
    if (totalNuts <= 0) {
      return "At least one bunch must contain more than 0 nuts."
    }
    if (remarks.length > 500) {
      return "Remarks must be 500 characters or fewer."
    }
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin/harvest/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tree_no: treeNo.trim(),
          harvest_date: harvestDate,
          bunch_count: count,
          bunch1_nuts: parseOptionalInteger(bunch1),
          bunch2_nuts: count >= 2 ? parseOptionalInteger(bunch2) : null,
          bunch3_nuts: count >= 3 ? parseOptionalInteger(bunch3) : null,
          remarks: remarks.trim() || null,
          client_request_id: requestIdRef.current,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(errorText(payload, "Unable to save harvest entry."))
        return
      }
      setResult(payload as SaveResult)
      setTreeNo("")
      setHarvestDate(today())
      setBunchCount("1")
      setBunch1("")
      setBunch2("")
      setBunch3("")
      setRemarks("")
      requestIdRef.current = newRequestId()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend unavailable. Please confirm the local API is running.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-bold text-foreground">
            Tree Number
            <input
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={treeNo}
              onChange={(event) => setTreeNo(event.target.value)}
              placeholder="Example: 845.1"
              autoComplete="off"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-foreground">
            Harvest Date
            <input
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              type="date"
              value={harvestDate}
              max={today()}
              onChange={(event) => setHarvestDate(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-foreground">
            Bunch Count
            <select
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={bunchCount}
              onChange={(event) => updateBunchCount(event.target.value)}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-foreground">
            Bunch 1 Nuts
            <input
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={bunch1}
              onChange={(event) => setBunch1(event.target.value)}
            />
          </label>

          {count >= 2 && (
            <label className="flex flex-col gap-1 text-sm font-bold text-foreground">
              Bunch 2 Nuts
              <input
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={bunch2}
                onChange={(event) => setBunch2(event.target.value)}
              />
            </label>
          )}

          {count >= 3 && (
            <label className="flex flex-col gap-1 text-sm font-bold text-foreground">
              Bunch 3 Nuts
              <input
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={bunch3}
                onChange={(event) => setBunch3(event.target.value)}
              />
            </label>
          )}

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:col-span-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Calculated</p>
            <p className="mt-1 text-2xl font-black text-foreground">Total Nuts: {totalNuts.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Total bunches are calculated by the database from non-zero bunch fields.</p>
          </div>

          <label className="flex flex-col gap-1 text-sm font-bold text-foreground md:col-span-3">
            Remarks
            <textarea
              className="min-h-24 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={remarks}
              maxLength={500}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional notes"
            />
          </label>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold uppercase text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Harvest Entry"}
          </button>
          <button
            type="button"
            onClick={clearForm}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-extrabold uppercase text-foreground hover:border-primary/40"
          >
            Clear Form
          </button>
          <Link
            href="/admin"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-extrabold uppercase text-foreground hover:border-primary/40"
          >
            Back to Admin Console
          </Link>
        </div>
      </form>

      {result && (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em]">Harvest entry saved</p>
          <h2 className="mt-2 text-xl font-black uppercase">Record #{result.record.harvest_record_id}</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div><dt className="font-bold">Tree Number</dt><dd>{result.record.tree_no}</dd></div>
            <div><dt className="font-bold">Harvest Date</dt><dd>{result.record.harvest_date}</dd></div>
            <div><dt className="font-bold">Harvest Cycle</dt><dd>{result.harvest_cycle ?? "Not assigned"}</dd></div>
            <div><dt className="font-bold">Total Bunches</dt><dd>{result.record.total_bunches}</dd></div>
            <div><dt className="font-bold">Total Nuts</dt><dd>{result.record.total_nuts}</dd></div>
            <div><dt className="font-bold">Source</dt><dd>Manual Admin</dd></div>
          </dl>
          {!result.inserted && <p className="mt-3 text-sm font-bold">This was an idempotent retry. No duplicate row was created.</p>}
          <Link href="/coconut-harvest" className="mt-4 inline-flex rounded-lg bg-green-700 px-4 py-2 text-sm font-extrabold uppercase text-white">
            Open Coconut Harvest Dashboard
          </Link>
        </section>
      )}
    </div>
  )
}
