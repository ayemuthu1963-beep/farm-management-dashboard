"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, CheckCircle2, Droplets, LoaderCircle, Save } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { irrigationEnvironmentCopy } from "@/lib/public-environment"
import {
  IRRIGATION_PLAN_DAYS,
  calculatedLphPerTree,
  calculatedMeasuredLph,
  dripOutputFieldError,
  dripOutputPayload,
  dripOutputValidationMessages,
  formatIrrigationPlanNumber,
  initialDripOutputRows,
  initialMotorRunScheduleRows,
  irrigationPlanError,
  motorRunSchedulePayload,
  motorScheduleValidationMessages,
  parseDripOutputRows,
  type DripOutputEditableField,
  type DripOutputRow,
  type IrrigationPlanDayKey,
  type IrrigationPlanResponse,
  type MotorRunScheduleRow,
} from "@/lib/irrigation-plan"
import { parsePersistedMotorRunScheduleRows, type ScheduleLoadStatus } from "@/lib/irrigation-schedule-comparison"
import { cn } from "@/lib/utils"

const irrigationEnvironment = irrigationEnvironmentCopy(
  process.env.NEXT_PUBLIC_MFMS_ENV,
  process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL,
)

type SaveState = "idle" | "saving" | "saved" | "error"

function dripSnapshot(rows: DripOutputRow[]): string {
  return JSON.stringify(dripOutputPayload(rows))
}

function scheduleSnapshot(rows: MotorRunScheduleRow[]): string {
  return JSON.stringify(motorRunSchedulePayload(rows))
}

function SaveFooter({
  label,
  dirty,
  disabled,
  state,
  error,
  onSave,
}: {
  label: string
  dirty: boolean
  disabled: boolean
  state: SaveState
  error: string | null
  onSave: () => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-5 text-sm" role="status" aria-live="polite">
        {state === "saved" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Saved successfully
          </span>
        ) : error ? (
          <span className="font-semibold text-destructive">{error}</span>
        ) : dirty ? (
          <span className="font-semibold text-amber-700">Unsaved changes</span>
        ) : (
          <span className="text-muted-foreground">All changes saved</span>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "saving" ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
        {state === "saving" ? "Saving…" : `Save ${label}`}
      </button>
    </div>
  )
}

function DripOutputTable({
  rows,
  onChange,
  dirty,
  isLoading,
  loadError,
  saveState,
  saveError,
  onSave,
}: {
  rows: DripOutputRow[]
  onChange: (key: string, field: DripOutputEditableField, value: string) => void
  dirty: boolean
  isLoading: boolean
  loadError: string | null
  saveState: SaveState
  saveError: string | null
  onSave: () => void
}) {
  const validationMessages = dripOutputValidationMessages(rows)
  const inputsDisabled = isLoading || Boolean(loadError) || saveState === "saving"
  const inputClass = (hasError: boolean) => cn(
    "w-full min-w-[4.5rem] rounded-md border bg-background px-2 py-1.5 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
    hasError ? "border-destructive" : "border-input",
  )

  return (
    <Panel title="Drip Output" icon={Droplets} className="min-w-0 max-w-full" bodyClassName="min-w-0">
      {loadError ? <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">{loadError}</p> : null}
      {validationMessages.length > 0 ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800" role="alert">
          {validationMessages[0]}
        </p>
      ) : null}
      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border" tabIndex={0} aria-label="Drip Output table; scroll horizontally when needed">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="bg-muted/50 text-xs font-bold text-muted-foreground">
            <tr>
              <th className="whitespace-nowrap px-2 py-3 text-left">Zone</th>
              <th className="whitespace-nowrap px-2 py-3 text-right">Designed LPH</th>
              <th className="whitespace-nowrap px-2 py-3 text-right">Designed Sec/100 ml</th>
              <th className="whitespace-nowrap px-2 py-3 text-right">Measured Sec/100 ml</th>
              <th className="whitespace-nowrap bg-muted/80 px-2 py-3 text-right">Measured LPH</th>
              <th className="whitespace-nowrap px-2 py-3 text-right">Drips/tree</th>
              <th className="whitespace-nowrap bg-muted/80 px-2 py-3 text-right">LPH/tree</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const measuredLph = formatIrrigationPlanNumber(calculatedMeasuredLph(row))
              const lphPerTree = formatIrrigationPlanNumber(calculatedLphPerTree(row))
              return (
                <tr key={row.key} className="bg-card align-top">
                  <td className="px-2 py-2">
                    <input
                      value={row.zone}
                      disabled={inputsDisabled}
                      onChange={(event) => onChange(row.key, "zone", event.target.value)}
                      aria-label={`${row.zone || "Unnamed"} zone`}
                      aria-invalid={Boolean(dripOutputFieldError(row, "zone"))}
                      className={cn(inputClass(Boolean(dripOutputFieldError(row, "zone"))), "min-w-[4rem] text-left font-bold")}
                    />
                  </td>
                  {([
                    ["designedLph", "Designed LPH"],
                    ["designedSecondsPer100ml", "Designed Sec/100 ml"],
                    ["measuredSecondsPer100ml", "Measured Sec/100 ml"],
                  ] as const).map(([field, label]) => (
                    <td key={field} className="px-2 py-2">
                      <input
                        value={row[field]}
                        disabled={inputsDisabled}
                        inputMode="decimal"
                        onChange={(event) => onChange(row.key, field, event.target.value)}
                        aria-label={`${row.zone || "Unnamed row"} ${label}`}
                        aria-invalid={Boolean(dripOutputFieldError(row, field))}
                        className={inputClass(Boolean(dripOutputFieldError(row, field)))}
                      />
                    </td>
                  ))}
                  <td className="bg-muted/35 px-3 py-3 text-right font-bold text-foreground" aria-readonly="true">
                    <output aria-label={`${row.zone || "Unnamed row"} Measured LPH`}>{measuredLph}</output>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.dripsPerTree}
                      disabled={inputsDisabled}
                      inputMode="decimal"
                      onChange={(event) => onChange(row.key, "dripsPerTree", event.target.value)}
                      aria-label={`${row.zone || "Unnamed row"} Drips/tree`}
                      aria-invalid={Boolean(dripOutputFieldError(row, "dripsPerTree"))}
                      className={inputClass(Boolean(dripOutputFieldError(row, "dripsPerTree")))}
                    />
                  </td>
                  <td className="bg-muted/35 px-3 py-3 text-right font-bold text-foreground" aria-readonly="true">
                    <output aria-label={`${row.zone || "Unnamed row"} LPH/tree`}>{lphPerTree}</output>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Calculated columns are read-only. Measured LPH = 360 ÷ measured seconds; LPH/tree = Measured LPH × Drips/tree.</p>
      <SaveFooter
        label="Drip Output"
        dirty={dirty}
        disabled={isLoading || Boolean(loadError) || !dirty || validationMessages.length > 0 || saveState === "saving"}
        state={saveState}
        error={saveError}
        onSave={onSave}
      />
    </Panel>
  )
}

function MotorRunScheduleTable({
  rows,
  onIdentityChange,
  onDayChange,
  dirty,
  isLoading,
  loadError,
  saveState,
  saveError,
  onSave,
}: {
  rows: MotorRunScheduleRow[]
  onIdentityChange: (key: string, field: "motor" | "plot", value: string) => void
  onDayChange: (key: string, day: IrrigationPlanDayKey, field: "min" | "ltrs", value: string) => void
  dirty: boolean
  isLoading: boolean
  loadError: string | null
  saveState: SaveState
  saveError: string | null
  onSave: () => void
}) {
  const validationMessages = motorScheduleValidationMessages(rows)
  const inputsDisabled = isLoading || Boolean(loadError) || saveState === "saving"
  const inputClass = "w-full min-w-[3.75rem] rounded-md border border-input bg-background px-1.5 py-1.5 text-center text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"

  return (
    <Panel title="Motor Run Schedule" icon={CalendarDays} className="min-w-0 max-w-full" bodyClassName="min-w-0">
      {loadError ? <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">{loadError}</p> : null}
      {validationMessages.length > 0 ? <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800" role="alert">{validationMessages[0]}</p> : null}
      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border" tabIndex={0} aria-label="Motor Run Schedule table; scroll horizontally when needed">
        <table className="w-full min-w-[1240px] border-collapse text-sm">
          <thead className="bg-muted/50 text-xs font-bold text-muted-foreground">
            <tr className="border-b border-border">
              <th rowSpan={2} className="whitespace-nowrap px-2 py-3 text-center">Motor</th>
              <th rowSpan={2} className="whitespace-nowrap px-2 py-3 text-left">Plot</th>
              {IRRIGATION_PLAN_DAYS.map(({ key, label }) => <th key={key} colSpan={2} className="whitespace-nowrap border-l border-border px-2 py-2 text-center">{label}</th>)}
            </tr>
            <tr>
              {IRRIGATION_PLAN_DAYS.flatMap(({ key }) => [
                <th key={`${key}-min`} className="whitespace-nowrap border-l border-border px-2 py-2 text-center">Min</th>,
                <th key={`${key}-ltrs`} className="whitespace-nowrap px-2 py-2 text-center">Ltrs</th>,
              ])}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className="bg-card">
                <td className="px-2 py-2">
                  <input value={row.motor} disabled={inputsDisabled} onChange={(event) => onIdentityChange(row.key, "motor", event.target.value)} aria-label={`${row.plot || "Unnamed plot"} Motor`} className={cn(inputClass, "min-w-[3.5rem] font-bold")} />
                </td>
                <td className="px-2 py-2">
                  <input value={row.plot} disabled={inputsDisabled} onChange={(event) => onIdentityChange(row.key, "plot", event.target.value)} aria-label={`${row.motor || "Unnamed motor"} Plot`} className={cn(inputClass, "min-w-[4rem] text-left font-bold")} />
                </td>
                {IRRIGATION_PLAN_DAYS.flatMap(({ key, label }) => [
                  <td key={`${row.key}-${key}-min`} className="border-l border-border px-1.5 py-2">
                    <input value={row.days[key].min} disabled={inputsDisabled} onChange={(event) => onDayChange(row.key, key, "min", event.target.value)} aria-label={`${row.plot || "Unnamed plot"} ${label} Min`} className={inputClass} />
                  </td>,
                  <td key={`${row.key}-${key}-ltrs`} className="px-1.5 py-2">
                    <input value={row.days[key].ltrs} disabled={inputsDisabled} inputMode="decimal" onChange={(event) => onDayChange(row.key, key, "ltrs", event.target.value)} aria-label={`${row.plot || "Unnamed plot"} ${label} Ltrs`} className={inputClass} />
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Min and Ltrs are separate editable values. Blank schedule cells remain empty; “30×3” means three separate 30-minute runs.</p>
      <SaveFooter
        label="Motor Run Schedule"
        dirty={dirty}
        disabled={isLoading || Boolean(loadError) || !dirty || validationMessages.length > 0 || saveState === "saving"}
        state={saveState}
        error={saveError}
        onSave={onSave}
      />
    </Panel>
  )
}

interface IrrigationPlanTablesProps {
  persistedScheduleRows: MotorRunScheduleRow[]
  scheduleLoadStatus: ScheduleLoadStatus
  scheduleLoadError: string | null
  onPersistedScheduleChange: (rows: MotorRunScheduleRow[]) => void
  onPersistedScheduleUnavailable: (message: string) => void
}

export function IrrigationPlanTables({
  persistedScheduleRows,
  scheduleLoadStatus,
  scheduleLoadError,
  onPersistedScheduleChange,
  onPersistedScheduleUnavailable,
}: IrrigationPlanTablesProps) {
  const initialDrip = useMemo(() => initialDripOutputRows(), [])
  const [dripRows, setDripRows] = useState(initialDrip)
  const [scheduleRows, setScheduleRows] = useState(() => (
    scheduleLoadStatus === "ready" ? persistedScheduleRows : initialMotorRunScheduleRows()
  ))
  const [savedDrip, setSavedDrip] = useState(() => dripSnapshot(initialDrip))
  const [savedSchedule, setSavedSchedule] = useState(() => scheduleSnapshot(scheduleRows))
  const [dripIsLoading, setDripIsLoading] = useState(true)
  const [dripLoadError, setDripLoadError] = useState<string | null>(null)
  const [dripSaveState, setDripSaveState] = useState<SaveState>("idle")
  const [scheduleSaveState, setScheduleSaveState] = useState<SaveState>("idle")
  const [dripSaveError, setDripSaveError] = useState<string | null>(null)
  const [scheduleSaveError, setScheduleSaveError] = useState<string | null>(null)
  const dripSaving = useRef(false)
  const scheduleSaving = useRef(false)

  const currentDrip = dripSnapshot(dripRows)
  const currentSchedule = scheduleSnapshot(scheduleRows)
  const dripDirty = currentDrip !== savedDrip
  const scheduleDirty = currentSchedule !== savedSchedule

  useEffect(() => {
    let isActive = true
    async function loadDripOutput() {
      try {
        const dripResponse = await fetch("/api/operator-settings/irrigation-plan/drip-output", { cache: "no-store" })
        const dripPayload = (await dripResponse.json().catch(() => ({}))) as IrrigationPlanResponse
        if (!dripResponse.ok) throw new Error(irrigationPlanError(dripPayload, "Drip Output could not be loaded."))
        if (!isActive) return
        const loadedDrip = parseDripOutputRows(dripPayload.rows)
        setDripRows(loadedDrip)
        setSavedDrip(dripSnapshot(loadedDrip))
        setDripLoadError(null)
      } catch (error) {
        if (isActive) setDripLoadError(error instanceof Error ? error.message : "Drip Output could not be loaded.")
      } finally {
        if (isActive) setDripIsLoading(false)
      }
    }
    void loadDripOutput()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!dripDirty && !scheduleDirty) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [dripDirty, scheduleDirty])

  function updateDripRow(key: string, field: DripOutputEditableField, value: string) {
    setDripRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row))
    setDripSaveState("idle")
    setDripSaveError(null)
  }

  function updateScheduleIdentity(key: string, field: "motor" | "plot", value: string) {
    setScheduleRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row))
    setScheduleSaveState("idle")
    setScheduleSaveError(null)
  }

  function updateScheduleDay(key: string, day: IrrigationPlanDayKey, field: "min" | "ltrs", value: string) {
    setScheduleRows((current) => current.map((row) => row.key === key ? {
      ...row,
      days: { ...row.days, [day]: { ...row.days[day], [field]: value } },
    } : row))
    setScheduleSaveState("idle")
    setScheduleSaveError(null)
  }

  async function saveDripOutput() {
    if (dripSaving.current || !dripDirty || dripOutputValidationMessages(dripRows).length > 0) return
    dripSaving.current = true
    setDripSaveState("saving")
    setDripSaveError(null)
    try {
      const response = await fetch("/api/operator-settings/irrigation-plan/drip-output", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dripOutputPayload(dripRows)),
      })
      const payload = (await response.json().catch(() => ({}))) as IrrigationPlanResponse
      if (!response.ok || payload.ok !== true) throw new Error(irrigationPlanError(payload, "Drip Output could not be saved."))
      if (!Array.isArray(payload.rows)) throw new Error("Drip Output save response was incomplete.")
      const savedRows = parseDripOutputRows(payload.rows)
      setDripRows(savedRows)
      setSavedDrip(dripSnapshot(savedRows))
      setDripSaveState("saved")
    } catch (error) {
      setDripSaveState("error")
      setDripSaveError(error instanceof Error ? error.message : "Drip Output could not be saved.")
    } finally {
      dripSaving.current = false
    }
  }

  async function saveMotorRunSchedule() {
    if (scheduleSaving.current || !scheduleDirty || motorScheduleValidationMessages(scheduleRows).length > 0) return
    scheduleSaving.current = true
    setScheduleSaveState("saving")
    setScheduleSaveError(null)
    let saveAccepted = false
    try {
      const response = await fetch("/api/operator-settings/irrigation-plan/motor-run-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(motorRunSchedulePayload(scheduleRows)),
      })
      const payload = (await response.json().catch(() => ({}))) as IrrigationPlanResponse
      if (!response.ok || payload.ok !== true) throw new Error(irrigationPlanError(payload, "Motor Run Schedule could not be saved."))
      saveAccepted = true

      const persistedResponse = await fetch("/api/operator-settings/irrigation-plan/motor-run-schedule", { cache: "no-store" })
      const persistedPayload = (await persistedResponse.json().catch(() => ({}))) as IrrigationPlanResponse
      if (!persistedResponse.ok) throw new Error(irrigationPlanError(persistedPayload, "Saved Motor Run Schedule could not be refreshed."))
      const savedRows = parsePersistedMotorRunScheduleRows(persistedPayload.rows)
      setScheduleRows(savedRows)
      setSavedSchedule(scheduleSnapshot(savedRows))
      setScheduleSaveState("saved")
      onPersistedScheduleChange(savedRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Motor Run Schedule could not be saved."
      setScheduleSaveState("error")
      setScheduleSaveError(message)
      if (saveAccepted) onPersistedScheduleUnavailable(message)
    } finally {
      scheduleSaving.current = false
    }
  }

  return (
    <section aria-labelledby="irrigation-plan-heading" className="min-w-0 space-y-3">
      <div>
        <h2 id="irrigation-plan-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Irrigation Plan</h2>
        <p className="text-xs text-muted-foreground">Editable drip measurements and weekly motor schedule stored in the {irrigationEnvironment.databaseName}.</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.8fr)]">
        <DripOutputTable rows={dripRows} onChange={updateDripRow} dirty={dripDirty} isLoading={dripIsLoading} loadError={dripLoadError} saveState={dripSaveState} saveError={dripSaveError} onSave={() => { void saveDripOutput() }} />
        <MotorRunScheduleTable rows={scheduleRows} onIdentityChange={updateScheduleIdentity} onDayChange={updateScheduleDay} dirty={scheduleDirty} isLoading={scheduleLoadStatus === "loading"} loadError={scheduleLoadError} saveState={scheduleSaveState} saveError={scheduleSaveError} onSave={() => { void saveMotorRunSchedule() }} />
      </div>
    </section>
  )
}
