"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Droplets, Gauge, Ruler, Waves } from "lucide-react"
import { Panel } from "@/components/farm/panel"

export interface WellLatestReading {
  wellCode: string
  wellName: string
  readingDate: string | null
  readingTime: string | null
  feet: number | null
  inches: number | null
  totalInches: number | null
  capacityLiters: number | null
  litersPerInch: number | null
  levelFeetDecimal: number | null
}

export interface WellSetting {
  wellCode: "well1" | "well2"
  wellName: string
  capacityLiters: number
  litersPerInch: number
  totalDepthInches: number | null
  calculationMethod: string | null
  referenceOffsetInches: number | null
}

interface Props {
  summary: {
    totalReadings: number
    latestReadingDate: string | null
    latest: WellLatestReading[]
  }
  settings: WellSetting[]
}

interface ValidationResult {
  ok: boolean
  message: string
  details: string[]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 })
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value.trim()) && Number(value) > 0
}

function isNonNegativeIntegerIfEntered(value: string): boolean {
  if (!value.trim()) return true
  return /^\d+$/.test(value.trim()) && Number(value) >= 0
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function ResultBox({ result }: { result: ValidationResult | null }) {
  if (!result) return null
  return (
    <div className={`rounded-xl border p-4 text-sm ${result.ok ? "border-sky-300 bg-sky-50 text-sky-900" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
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

function WellCard({ title, wellName, well, setting, icon: Icon }: { title: string; wellName: string; well: WellLatestReading | null; setting: WellSetting; icon: typeof Droplets }) {
  return (
    <div className="rounded-2xl border border-border bg-[#fffdf2] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{title}</p>
          <h2 className="text-xl font-extrabold text-foreground">{setting.wellName || well?.wellName || wellName}</h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Full Capacity</p>
          <p className="font-extrabold text-foreground">{formatNumber(setting.capacityLiters)} L</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Litres / Inch</p>
          <p className="font-extrabold text-foreground">{formatNumber(setting.litersPerInch)} L</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Latest Date</p>
          <p className="font-semibold text-foreground">{formatDate(well?.readingDate)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Latest Level</p>
          <p className="font-semibold text-foreground">{well ? `${well.feet ?? 0} ft ${well.inches ?? 0} in` : "—"}</p>
        </div>
      </div>
    </div>
  )
}

export function WellWaterAdminClient({ summary, settings }: Props) {
  const router = useRouter()
  const [settingsResult, setSettingsResult] = useState<ValidationResult | null>(null)
  const [readingResult, setReadingResult] = useState<ValidationResult | null>(null)
  const [latestRows, setLatestRows] = useState<WellLatestReading[]>(summary.latest)
  const [settingsRows, setSettingsRows] = useState<WellSetting[]>(settings)
  const [settingsWell, setSettingsWell] = useState<"well1" | "well2">("well1")
  const [capacityInput, setCapacityInput] = useState(String(settings.find((row) => row.wellCode === "well1")?.capacityLiters ?? ""))
  const [litersPerInchInput, setLitersPerInchInput] = useState(String(settings.find((row) => row.wellCode === "well1")?.litersPerInch ?? ""))
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSavingReading, setIsSavingReading] = useState(false)

  const northWell = useMemo(() => latestRows.find((row) => row.wellCode === "well1") ?? null, [latestRows])
  const southWell = useMemo(() => latestRows.find((row) => row.wellCode === "well2") ?? null, [latestRows])
  const northSetting = settingsRows.find((row) => row.wellCode === "well1")!
  const southSetting = settingsRows.find((row) => row.wellCode === "well2")!

  useEffect(() => {
    setLatestRows(summary.latest)
  }, [summary.latest])

  useEffect(() => {
    setSettingsRows(settings)
  }, [settings])

  function selectSettingsWell(wellCode: "well1" | "well2") {
    setSettingsWell(wellCode)
    const selected = settingsRows.find((row) => row.wellCode === wellCode)
    setCapacityInput(selected ? String(selected.capacityLiters) : "")
    setLitersPerInchInput(selected ? String(selected.litersPerInch) : "")
    setSettingsResult(null)
  }

  async function saveSettings(form: HTMLFormElement) {
    const formData = new FormData(form)
    const well = String(formData.get("settings_well") ?? "").trim()
    const capacity = String(formData.get("capacity_liters") ?? "").trim()
    const litersPerInch = String(formData.get("liters_per_inch") ?? "").trim()
    const remarks = String(formData.get("settings_remarks") ?? "").trim()
    const errors: string[] = []

    if (!well) errors.push("Well is required.")
    if (well && !["well1", "well2"].includes(well)) errors.push("Well must be North Well or South Well.")
    if (!capacity) errors.push("Full Capacity Litres is required.")
    if (capacity && !isPositiveInteger(capacity)) errors.push("Full Capacity Litres must be a positive whole number.")
    if (!litersPerInch) errors.push("Litres Per Inch is required.")
    if (litersPerInch && !isPositiveInteger(litersPerInch)) errors.push("Litres Per Inch must be a positive whole number.")

    if (errors.length > 0) {
      setSettingsResult({ ok: false, message: "Well Settings validation failed. No database write was performed.", details: errors })
      return
    }

    setIsSavingSettings(true)
    setSettingsResult(null)
    try {
      const response = await fetch("/api/admin/well-water/settings", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          well_code: well,
          capacity_liters: Number(capacity),
          liters_per_inch: Number(litersPerInch),
          remarks: remarks || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors.map(String) : [data?.message ?? "Well Settings were not saved."]
        setSettingsResult({ ok: false, message: "Well Settings save failed.", details: apiErrors })
        return
      }

      const savedRow = data?.saved?.new_values
      if (
        savedRow?.well_code !== well ||
        !Number.isInteger(savedRow?.capacity_liters) ||
        savedRow.capacity_liters <= 0 ||
        !Number.isInteger(savedRow?.liters_per_inch) ||
        savedRow.liters_per_inch <= 0
      ) {
        setSettingsResult({
          ok: false,
          message: "Well Settings response could not be verified.",
          details: ["Reload the page before making another settings change."],
        })
        router.refresh()
        return
      }

      setSettingsRows((rows) =>
        rows.map((row) =>
          row.wellCode === well
            ? {
                ...row,
                wellName: String(savedRow.well_name ?? row.wellName),
                capacityLiters: savedRow.capacity_liters,
                litersPerInch: savedRow.liters_per_inch,
                totalDepthInches: savedRow.total_depth_inches ?? null,
                calculationMethod: savedRow.calculation_method ?? null,
                referenceOffsetInches: savedRow.reference_offset_inches ?? null,
              }
            : row,
        ),
      )
      setCapacityInput(String(savedRow.capacity_liters))
      setLitersPerInchInput(String(savedRow.liters_per_inch))
      const wellLabel = well === "well1" ? "North Well" : "South Well"
      const details = [`${wellLabel} settings saved to MFMS database.`, "ODK Central was not modified."]
      if (data?.saved?.remarks_stored === false || data?.remarksStored === false) {
        details.push("Remarks were not stored because the current well settings table has no remarks column.")
      }
      setSettingsResult({ ok: true, message: "Well Settings saved.", details })
      const remarksInput = form.elements.namedItem("settings_remarks")
      if (remarksInput instanceof HTMLInputElement) remarksInput.value = ""
      router.refresh()
    } catch (error) {
      setSettingsResult({
        ok: false,
        message: "Well Settings save failed.",
        details: [error instanceof Error ? error.message : "Unknown save error."],
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function saveReading(form: HTMLFormElement) {
    const formData = new FormData(form)
    const readingIdText = String(formData.get("reading_id") ?? "").trim()
    const readingDate = String(formData.get("reading_date") ?? "").trim()
    const well = String(formData.get("reading_well") ?? "").trim()
    const feetText = String(formData.get("reading_feet") ?? "").trim()
    const inchesText = String(formData.get("reading_inches") ?? "").trim()
    const remarks = String(formData.get("reading_remarks") ?? "").trim()
    const errors: string[] = []
    const feet = feetText ? Number(feetText) : 0
    const inches = inchesText ? Number(inchesText) : 0
    const isCorrection = Boolean(readingIdText)

    if (readingIdText && !isPositiveInteger(readingIdText)) errors.push("Correction Reading ID must be a positive whole number.")
    if (!readingDate) errors.push("Reading Date is required.")
    if (readingDate && !isValidDate(readingDate)) errors.push("Reading Date is not a valid date.")
    if (!well) errors.push("Well is required.")
    if (well && !["well1", "well2"].includes(well)) errors.push("Well must be North Well or South Well.")
    if (!feetText && !inchesText) errors.push("Enter Feet or Inches.")
    if (!isNonNegativeIntegerIfEntered(feetText)) errors.push("Feet must be a whole number and cannot be negative.")
    if (!isNonNegativeIntegerIfEntered(inchesText)) errors.push("Inches must be a whole number and cannot be negative.")
    if (Number.isInteger(inches) && inches > 11) errors.push("Inches must be between 0 and 11.")
    if (well === "well2" && feet === 0 && inches === 0 && (feetText || inchesText)) {
      errors.push("South Well reading cannot be 0 feet and 0 inches.")
    }

    if (errors.length > 0) {
      setReadingResult({ ok: false, message: "Manual Reading / Correction validation failed. No database write was performed.", details: errors })
      return
    }

    setIsSavingReading(true)
    setReadingResult(null)
    try {
      const response = await fetch("/api/admin/well-water/readings", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reading_id: readingIdText || null,
          reading_date: readingDate,
          well_code: well,
          feet: feetText ? feet : null,
          inches: inchesText ? inches : null,
          remarks: remarks || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors.map(String) : [data?.message ?? "Manual well reading was not saved."]
        setReadingResult({ ok: false, message: "Manual Reading / Correction save failed.", details: apiErrors })
        return
      }

      const changedRow = data?.saved?.updated_row ?? data?.saved?.inserted_row
      if (!String(changedRow?.odk_submission_id ?? "").startsWith("manual:well-water:")) {
        setReadingResult({
          ok: false,
          message: "Manual Reading / Correction response could not be verified.",
          details: ["No ODK submission was accepted as a manual correction. Reload before trying again."],
        })
        router.refresh()
        return
      }
      const details = [
        isCorrection ? `Manual reading ${readingIdText} corrected.` : `${well === "well1" ? "North Well" : "South Well"} manual reading saved.`,
        `Manual ID: ${changedRow.odk_submission_id}`,
        `Total inches: ${changedRow.total_inches ?? feet * 12 + inches}`,
        "ODK Central was not modified.",
      ]
      if (data?.saved?.remarks_stored === false || data?.remarksStored === false) {
        details.push("Remarks were not stored because the current well readings table has no remarks column.")
      }
      setReadingResult({ ok: true, message: "Manual Reading / Correction saved.", details })
      form.reset()
      router.refresh()
    } catch (error) {
      setReadingResult({
        ok: false,
        message: "Manual Reading / Correction save failed.",
        details: [error instanceof Error ? error.message : "Unknown save error."],
      })
    } finally {
      setIsSavingReading(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="Current Well Water Status" icon={Droplets}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <WellCard title="North Well Settings" wellName="North Well" well={northWell} setting={northSetting} icon={Droplets} />
          <WellCard title="South Well Settings" wellName="South Well" well={southWell} setting={southSetting} icon={Waves} />
          <WellCard title="Latest North Well Reading" wellName="North Well" well={northWell} setting={northSetting} icon={Ruler} />
          <WellCard title="Latest South Well Reading" wellName="South Well" well={southWell} setting={southSetting} icon={Gauge} />
          <div className="rounded-2xl border border-border bg-[#fffdf2] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Droplets className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Total Well Readings</p>
                <h2 className="text-3xl font-extrabold text-foreground">{summary.totalReadings}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Latest reading date: <span className="font-bold text-foreground">{formatDate(summary.latestReadingDate)}</span></p>
            <p className="mt-1 text-sm text-muted-foreground">Remarks are not stored in the current Well Water tables.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Well Settings Admin" icon={Droplets}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void saveSettings(event.currentTarget)
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-bold text-foreground">
              Well *
              <select
                name="settings_well"
                required
                value={settingsWell}
                onChange={(event) => selectSettingsWell(event.target.value as "well1" | "well2")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="well1">North Well</option>
                <option value="well2">South Well</option>
              </select>
            </label>
            <label className="text-sm font-bold text-foreground">
              Full Capacity Litres *
              <input name="capacity_liters" type="number" min="1" step="1" required inputMode="numeric" value={capacityInput} onChange={(event) => setCapacityInput(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Litres Per Inch *
              <input name="liters_per_inch" type="number" min="1" step="1" required inputMode="numeric" value={litersPerInchInput} onChange={(event) => setLitersPerInchInput(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Remarks
              <input name="settings_remarks" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
          </div>
          <button type="submit" disabled={isSavingSettings} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70">
            {isSavingSettings ? "Saving Well Settings..." : "Save Well Settings"}
          </button>
          <ResultBox result={settingsResult} />
        </form>
      </Panel>

      <Panel title="Manual Reading / Correction" icon={Ruler}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void saveReading(event.currentTarget)
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-6">
            <label className="text-sm font-bold text-foreground">
              Correction Reading ID
              <input name="reading_id" type="number" min="1" step="1" inputMode="numeric" placeholder="Optional manual ID" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Reading Date *
              <input name="reading_date" type="date" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Well *
              <select name="reading_well" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                <option value="">Select well</option>
                <option value="well1">North Well</option>
                <option value="well2">South Well</option>
              </select>
            </label>
            <label className="text-sm font-bold text-foreground">
              Feet
              <input name="reading_feet" type="number" min="0" step="1" inputMode="numeric" placeholder="0" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Inches
              <input name="reading_inches" type="number" min="0" max="11" step="1" inputMode="numeric" placeholder="0-11" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Remarks
              <input name="reading_remarks" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            </label>
          </div>
          <button type="submit" disabled={isSavingReading} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70">
            {isSavingReading ? "Saving Manual Reading..." : "Save Manual Reading / Correction"}
          </button>
          <p className="text-sm text-muted-foreground">Leave Correction Reading ID blank to add a new manual reading. Corrections are allowed only for records whose source ID starts with <code>manual:well-water:</code>; ODK submissions are read-only.</p>
          <ResultBox result={readingResult} />
        </form>
      </Panel>
    </div>
  )
}
