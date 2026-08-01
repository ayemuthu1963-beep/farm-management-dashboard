"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, CircleDot, Gauge, Info } from "lucide-react"

type MotorId = "M1" | "M2" | "M3"

interface ValveCell {
  motor: MotorId
  motorNo: number
  valveNo: number | null
  valve: string | null
}

interface AreaRow {
  key: string
  label: string
  m1: ValveCell
  m2: ValveCell
  m3: ValveCell
}

const areaRows: AreaRow[] = [
  {
    key: "Plot2_East",
    label: "Plot 2 East",
    m1: { motor: "M1", motorNo: 1, valveNo: 1, valve: "Valve1" },
    m2: { motor: "M2", motorNo: 2, valveNo: 7, valve: "Valve7" },
    m3: { motor: "M3", motorNo: 3, valveNo: 13, valve: "Valve13" },
  },
  {
    key: "Plot2_West",
    label: "Plot 2 West",
    m1: { motor: "M1", motorNo: 1, valveNo: 2, valve: "Valve2" },
    m2: { motor: "M2", motorNo: 2, valveNo: 8, valve: "Valve8" },
    m3: { motor: "M3", motorNo: 3, valveNo: 14, valve: "Valve14" },
  },
  {
    key: "Plot1_East",
    label: "Plot 1 East",
    m1: { motor: "M1", motorNo: 1, valveNo: 3, valve: "Valve3" },
    m2: { motor: "M2", motorNo: 2, valveNo: 9, valve: "Valve9" },
    m3: { motor: "M3", motorNo: 3, valveNo: null, valve: null },
  },
  {
    key: "Plot1_West",
    label: "Plot 1 West",
    m1: { motor: "M1", motorNo: 1, valveNo: 4, valve: "Valve4" },
    m2: { motor: "M2", motorNo: 2, valveNo: 10, valve: "Valve10" },
    m3: { motor: "M3", motorNo: 3, valveNo: null, valve: null },
  },
  {
    key: "Nutmug",
    label: "Nutmeg",
    m1: { motor: "M1", motorNo: 1, valveNo: 5, valve: "Valve5" },
    m2: { motor: "M2", motorNo: 2, valveNo: 11, valve: "Valve11" },
    m3: { motor: "M3", motorNo: 3, valveNo: null, valve: null },
  },
  {
    key: "Jack_Fruit",
    label: "Jackfruit",
    m1: { motor: "M1", motorNo: 1, valveNo: 6, valve: "Valve6" },
    m2: { motor: "M2", motorNo: 2, valveNo: 12, valve: "Valve12" },
    m3: { motor: "M3", motorNo: 3, valveNo: 15, valve: "Valve15" },
  },
]

const motorHeaders: Array<{ id: MotorId; title: string; subtitle: string; className: string }> = [
  { id: "M1", title: "Motor 1", subtitle: "Valve1–Valve6", className: "from-emerald-600 to-lime-500" },
  { id: "M2", title: "Motor 2", subtitle: "Valve7–Valve12", className: "from-sky-600 to-cyan-500" },
  { id: "M3", title: "Motor 3", subtitle: "Valve13–Valve15 only", className: "from-amber-600 to-orange-500" },
]

interface Result {
  ok: boolean
  message: string
  details: string[]
}

interface RuntimeEntry {
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
}

interface RecentRuntimeEntry {
  id: number
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  total_minutes: number
  remarks: string | null
  source: string
  created_at: string
}

interface Props {
  recentEntries: RecentRuntimeEntry[]
  databaseDisplayName: string
  loadError: string | null
}

function displayPlotLabel(value: string): string {
  if (value === "Plot2_East") return "Plot 2 East"
  if (value === "Plot2_West") return "Plot 2 West"
  if (value === "Plot1_East") return "Plot 1 East"
  if (value === "Plot1_West") return "Plot 1 West"
  if (value === "Nutmug") return "Nutmeg"
  if (value === "Jack_Fruit") return "Jackfruit"
  return value
}

function fieldName(row: AreaRow, motor: MotorId, kind: "hours" | "minutes") {
  return `${row.key}_${motor}_${kind}`
}

function readWholeNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim()
  if (!text) return null
  if (!/^\d+$/.test(text)) return Number.NaN
  return Number(text)
}

function RuntimeInputs({ row, cell }: { row: AreaRow; cell: ValveCell }) {
  if (!cell.valve) {
    return (
      <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-sm font-bold text-muted-foreground">
        —
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/15 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-primary">
        <CircleDot className="size-5" aria-hidden="true" />
        <span>{cell.valve}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Hours
          <input
            name={fieldName(row, cell.motor, "hours")}
            type="number"
            min="0"
            max="24"
            step="1"
            inputMode="numeric"
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Minutes
          <input
            name={fieldName(row, cell.motor, "minutes")}
            type="number"
            min="0"
            max="59"
            step="1"
            inputMode="numeric"
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </label>
      </div>
    </div>
  )
}

function ResultBox({ result }: { result: Result | null }) {
  if (!result) return null
  return (
    <div className={`rounded-xl border p-4 text-sm ${result.ok ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      <div className="flex items-start gap-2">
        {result.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
        <div>
          <p className="font-extrabold">{result.message}</p>
          {result.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const parsed = new Date(normalizedValue)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  })
}

export function MotorRuntimeAdminClient({ recentEntries, databaseDisplayName, loadError }: Props) {
  const [result, setResult] = useState<Result | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const enabledCells = useMemo(
    () =>
      areaRows.flatMap((row) =>
        ([row.m1, row.m2, row.m3] as ValveCell[])
          .filter((cell) => Boolean(cell.valve) && cell.valveNo !== null)
          .map((cell) => ({ row, cell })),
      ),
    [],
  )

  async function save(form: HTMLFormElement) {
    const formData = new FormData(form)
    const errors: string[] = []
    const entries: RuntimeEntry[] = []
    const entryDate = String(formData.get("entry_date") ?? "").trim()
    const remarks = String(formData.get("remarks") ?? "").trim()

    if (!entryDate) {
      errors.push("Entry date is required.")
    }

    for (const { row, cell } of enabledCells) {
      const hoursValue = readWholeNumber(formData.get(fieldName(row, cell.motor, "hours")))
      const minutesValue = readWholeNumber(formData.get(fieldName(row, cell.motor, "minutes")))

      if (hoursValue === null && minutesValue === null) continue

      const hours = hoursValue ?? 0
      const minutes = minutesValue ?? 0
      const label = `${cell.motor} ${cell.valve} ${row.label}`

      if (!Number.isInteger(hours) || hours < 0 || hours > 24) {
        errors.push(`${label}: Hours must be a whole number from 0 to 24.`)
      }
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
        errors.push(`${label}: Minutes must be a whole number from 0 to 59.`)
      }
      if ((Number.isFinite(hours) ? hours : 0) === 0 && (Number.isFinite(minutes) ? minutes : 0) === 0) {
        errors.push(`${label}: Runtime cannot be 0 hours and 0 minutes.`)
      }

      if (Number.isInteger(hours) && Number.isInteger(minutes) && cell.valveNo !== null) {
        entries.push({
          plot: row.key,
          motor_no: cell.motorNo,
          valve_no: cell.valveNo,
          hours,
          minutes,
        })
      }
    }

    if (entries.length === 0) {
      errors.push("Enter runtime for at least one enabled motor/valve cell before saving.")
    }

    if (errors.length > 0) {
      setResult({ ok: false, message: "Validation failed. No database write was performed.", details: errors })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/admin/motor-runtime/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_date: entryDate, remarks, entries }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) {
        setResult({
          ok: false,
          message: data.message ?? "Motor runtime entries were not saved.",
          details: Array.isArray(data.errors) ? data.errors : [`Request failed with status ${response.status}.`],
        })
        return
      }

      setResult({
        ok: true,
        message: data.message ?? "Motor runtime entries saved.",
        details: [
          `${entries.length} runtime entr${entries.length === 1 ? "y was" : "ies were"} saved to the ${databaseDisplayName}.`,
          "ODK Central was not modified.",
        ],
      })
      form.reset()
      router.refresh()
    } catch (error) {
      setResult({
        ok: false,
        message: "Motor runtime entries were not saved.",
        details: [error instanceof Error ? error.message : "Unknown save error."],
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-extrabold">Manual admin save enabled for {databaseDisplayName}</p>
            <p>Entries saved here write to the {databaseDisplayName}. ODK Central is not modified.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {motorHeaders.map((motor) => (
          <div key={motor.id} className={`rounded-2xl bg-gradient-to-br ${motor.className} p-4 text-white shadow-sm`}>
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-white/90">
                <Gauge className="size-9 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold uppercase tracking-tight">{motor.title}</h2>
                <p className="text-sm font-semibold text-white/85">{motor.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save(event.currentTarget)
        }}
        className="space-y-4"
      >
        {loadError && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-extrabold">Unable to load recent Motor Runtime entries.</p>
            <p className="mt-1">{loadError}</p>
          </div>
        )}
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:grid-cols-[220px_1fr]">
          <label className="text-sm font-bold text-foreground">
            Entry Date *
            <input name="entry_date" type="date" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="text-sm font-bold text-foreground">
            Remarks
            <input name="remarks" placeholder="Optional remarks" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10 text-left text-xs font-extrabold uppercase tracking-wide text-primary">
                <th className="px-4 py-3">Area</th>
                {motorHeaders.map((motor) => (
                  <th key={motor.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-5" aria-hidden="true" />
                      <span>{motor.title}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areaRows.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-4 align-top font-extrabold text-foreground">{row.label}</td>
                  <td className="px-4 py-4 align-top">
                    <RuntimeInputs row={row} cell={row.m1} />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <RuntimeInputs row={row} cell={row.m2} />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <RuntimeInputs row={row} cell={row.m3} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <p className="font-bold text-primary">Confirmed Motor 3 mapping</p>
          <p className="mt-1">Plot 2 East → Motor 3 Valve13, Plot 2 West → Motor 3 Valve14, Jackfruit → Motor 3 Valve15.</p>
          <p className="mt-1">Motor 3 does not apply to Plot 1 East, Plot 1 West, or Nutmeg, so those cells are disabled.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSaving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Saving..." : "Save Motor Runtime Entry"}
          </button>
          <span className="text-sm text-muted-foreground">Only filled enabled cells are saved. Blank cells are ignored.</span>
        </div>

        <ResultBox result={result} />
      </form>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-foreground">Recent Motor Runtime Entries</h2>
          <p className="text-sm text-muted-foreground">Latest 20 entries, newest entry date first.</p>
        </div>

        {loadError ? null : recentEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm font-semibold text-muted-foreground">
            No motor runtime entries saved yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-primary/10 text-left text-xs font-extrabold uppercase tracking-wide text-primary">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Plot</th>
                  <th className="px-3 py-3">Motor</th>
                  <th className="px-3 py-3">Valve</th>
                  <th className="px-3 py-3">Hours</th>
                  <th className="px-3 py-3">Minutes</th>
                  <th className="px-3 py-3">Total Minutes</th>
                  <th className="px-3 py-3">Remarks</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Created At</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-foreground">{formatDate(entry.entry_date)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{displayPlotLabel(entry.plot)}</td>
                    <td className="whitespace-nowrap px-3 py-3">Motor {entry.motor_no}</td>
                    <td className="whitespace-nowrap px-3 py-3">Valve{entry.valve_no}</td>
                    <td className="px-3 py-3">{entry.hours}</td>
                    <td className="px-3 py-3">{entry.minutes}</td>
                    <td className="px-3 py-3 font-bold">{entry.total_minutes}</td>
                    <td className="px-3 py-3">{entry.remarks || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{entry.source}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDateTime(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
