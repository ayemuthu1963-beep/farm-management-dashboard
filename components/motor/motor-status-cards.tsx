"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Gauge, LoaderCircle, Power, Save, Zap } from "lucide-react"
import type { MotorId, MotorStatus } from "@/lib/motor-data"
import {
  emptyMotorSettingsById,
  motorSettingsPayload,
  operatorSettingsError,
  parseMotorSettings,
  type MotorSettingsValues,
  type OperatorSettingsResponse,
  type RtcTimerFields,
  type TimeFields,
} from "@/lib/operator-settings"
import { cn } from "@/lib/utils"

const statusStyles: Record<MotorStatus["status"], string> = {
  Running: "bg-chart-2/15 text-chart-2",
  Idle: "bg-muted text-muted-foreground",
  Maintenance: "bg-chart-1/15 text-chart-1",
}

const motorCardStyles: Record<MotorStatus["id"], { card: string; icon: string; accent: string; bar: string }> = {
  M1: { card: "border-sky-200/80 bg-sky-50/75", icon: "bg-sky-500/15 text-sky-700", accent: "text-sky-700", bar: "bg-sky-500" },
  M2: { card: "border-amber-200/80 bg-amber-50/75", icon: "bg-amber-500/15 text-amber-700", accent: "text-amber-700", bar: "bg-amber-500" },
  M3: { card: "border-emerald-200/80 bg-emerald-50/75", icon: "bg-emerald-500/15 text-emerald-700", accent: "text-emerald-700", bar: "bg-emerald-500" },
}

const inputClassName = "h-8 rounded-md border border-input bg-background/90 px-1.5 text-center font-mono text-xs font-semibold text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/25"

function TimeInputGroup({
  value,
  onChange,
  label,
  maxHours = 23,
  disabled = false,
}: {
  value: TimeFields
  onChange: (value: TimeFields) => void
  label: string
  maxHours?: number
  disabled?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={maxHours}
        value={value.hours}
        placeholder="HH"
        aria-label={`${label} hours`}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, hours: event.target.value })}
        className={cn(inputClassName, "w-11")}
      />
      <span className="text-xs font-semibold text-muted-foreground">:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        value={value.minutes}
        placeholder="MM"
        aria-label={`${label} minutes`}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, minutes: event.target.value })}
        className={cn(inputClassName, "w-11")}
      />
    </div>
  )
}

function SettingInput({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.1"
      value={value}
      placeholder="**.*"
      aria-label={label}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cn(inputClassName, "w-full")}
    />
  )
}

type SaveState = "idle" | "saving" | "saved" | "error"

function MotorSettings({
  motor,
  settings,
  disabled,
  saveState,
  onChange,
  onSave,
}: {
  motor: MotorStatus
  settings: MotorSettingsValues
  disabled: boolean
  saveState: SaveState
  onChange: (values: MotorSettingsValues) => void
  onSave: () => void
}) {
  function updateRtcTimer(index: number, edge: keyof RtcTimerFields, value: TimeFields) {
    onChange({
      ...settings,
      rtcTimers: settings.rtcTimers.map((timer, timerIndex) => (
        timerIndex === index ? { ...timer, [edge]: value } : timer
      )),
    })
  }

  return (
    <div className="mt-4 border-t border-foreground/10 pt-4">
      <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-[minmax(0,1.45fr)_minmax(9rem,0.75fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">Max Run Time :</span>
            <TimeInputGroup
              value={settings.maxRunTime}
              label={`${motor.name} max run time`}
              maxHours={99}
              disabled={disabled}
              onChange={(maxRunTime) => onChange({ ...settings, maxRunTime })}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-bold text-foreground">RTC timer :</legend>
            {settings.rtcTimers.map((timer, index) => (
              <div key={`${motor.id}-rtc-${index + 1}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">{index + 1}.</span>
                <TimeInputGroup
                  value={timer.from}
                  label={`${motor.name} RTC timer ${index + 1} start`}
                  disabled={disabled}
                  onChange={(value) => updateRtcTimer(index, "from", value)}
                />
                <span className="text-[11px] font-semibold text-muted-foreground">to</span>
                <TimeInputGroup
                  value={timer.to}
                  label={`${motor.name} RTC timer ${index + 1} end`}
                  disabled={disabled}
                  onChange={(value) => updateRtcTimer(index, "to", value)}
                />
              </div>
            ))}
          </fieldset>
        </div>

        <fieldset className="border-t border-foreground/10 pt-4 min-[520px]:border-l min-[520px]:border-t-0 min-[520px]:pl-4 min-[520px]:pt-0">
          <legend className="mb-3 text-xs font-bold text-foreground">Current Setting :</legend>
          <div className="space-y-3 text-xs">
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                <span aria-hidden="true" />
                <span className="text-center font-semibold text-muted-foreground">Dry Run</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                <span className="font-semibold text-foreground">3 Phase</span>
                <SettingInput
                  value={settings.threePhaseDryRun}
                  label={`${motor.name} 3 Phase dry run setting`}
                  disabled={disabled}
                  onChange={(threePhaseDryRun) => onChange({ ...settings, threePhaseDryRun })}
                />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                <span className="font-semibold text-foreground">2 Phase</span>
                <SettingInput
                  value={settings.twoPhaseDryRun}
                  label={`${motor.name} 2 Phase dry run setting`}
                  disabled={disabled}
                  onChange={(twoPhaseDryRun) => onChange({ ...settings, twoPhaseDryRun })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                <span aria-hidden="true" />
                <span className="text-center font-semibold text-muted-foreground">Over Load</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                <span className="font-semibold text-foreground">3 Phase</span>
                <SettingInput
                  value={settings.threePhaseOverLoad}
                  label={`${motor.name} 3 Phase overload setting`}
                  disabled={disabled}
                  onChange={(threePhaseOverLoad) => onChange({ ...settings, threePhaseOverLoad })}
                />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                <span className="font-semibold text-foreground">2 Phase</span>
                <SettingInput
                  value={settings.twoPhaseOverLoad}
                  label={`${motor.name} 2 Phase overload setting`}
                  disabled={disabled}
                  onChange={(twoPhaseOverLoad) => onChange({ ...settings, twoPhaseOverLoad })}
                />
              </div>
            </div>
          </div>
        </fieldset>
      </div>
      <div className="mt-3 flex min-h-7 items-center justify-end gap-2 border-t border-foreground/10 pt-3">
        {saveState === "error" ? <span className="text-[11px] font-medium text-destructive">Could not save</span> : null}
        {saveState === "saved" ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-3" aria-hidden="true" /> Saved
          </span>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saveState === "saving"}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-input bg-background/90 px-2.5 text-[11px] font-bold text-foreground shadow-sm transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveState === "saving" ? <LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> : <Save className="size-3" aria-hidden="true" />}
          {saveState === "saving" ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  )
}

function StatusCard({
  motor,
  settings,
  disabled,
  saveState,
  onSettingsChange,
  onSave,
}: {
  motor: MotorStatus
  settings: MotorSettingsValues
  disabled: boolean
  saveState: SaveState
  onSettingsChange: (settings: MotorSettingsValues) => void
  onSave: () => void
}) {
  const running = motor.status === "Running"
  const styles = motorCardStyles[motor.id]
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-4 shadow-sm", styles.card)}>
      <div className={cn("absolute inset-x-0 top-0 h-1", styles.bar)} />
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", running ? "bg-chart-2/15 text-chart-2" : styles.icon)}>
          {running ? <Zap className="size-6" aria-hidden="true" /> : <Gauge className="size-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("truncate text-sm font-extrabold", styles.accent)}>{motor.name}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusStyles[motor.status])}>
              <Power className="size-3" aria-hidden="true" />
              {motor.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{motor.well}</p>
          <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-foreground">
            <Clock className={cn("size-4", styles.accent)} aria-hidden="true" />
            {motor.runHoursToday.toFixed(2)} hrs selected range
          </div>
          <p className="text-[11px] text-muted-foreground">Latest entry: {motor.lastStart}</p>
        </div>
      </div>
      <MotorSettings
        motor={motor}
        settings={settings}
        disabled={disabled}
        saveState={saveState}
        onChange={onSettingsChange}
        onSave={onSave}
      />
    </div>
  )
}

export function MotorStatusCards({ motors }: { motors: MotorStatus[] }) {
  const [settingsByMotor, setSettingsByMotor] = useState<Record<MotorId, MotorSettingsValues>>(emptyMotorSettingsById)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStates, setSaveStates] = useState<Record<MotorId, SaveState>>({ M1: "idle", M2: "idle", M3: "idle" })

  useEffect(() => {
    let isActive = true

    async function loadSettings() {
      try {
        const response = await fetch("/api/operator-settings", { cache: "no-store" })
        const payload = (await response.json().catch(() => ({}))) as OperatorSettingsResponse
        if (!response.ok) throw new Error(operatorSettingsError(payload, "Motor settings could not be loaded."))
        if (!isActive) return

        const loaded = emptyMotorSettingsById()
        for (const motorId of ["M1", "M2", "M3"] as const) {
          loaded[motorId] = parseMotorSettings(payload.motorSettings?.[motorId]?.values)
        }
        setSettingsByMotor(loaded)
        setLoadError(null)
      } catch (error) {
        if (isActive) setLoadError(error instanceof Error ? error.message : "Motor settings could not be loaded.")
      } finally {
        if (isActive) setIsLoadingSettings(false)
      }
    }

    void loadSettings()
    return () => { isActive = false }
  }, [])

  function updateMotorSettings(motorId: MotorId, values: MotorSettingsValues) {
    setSettingsByMotor((current) => ({ ...current, [motorId]: values }))
    setSaveStates((current) => ({ ...current, [motorId]: "idle" }))
  }

  async function saveMotorSettings(motorId: MotorId) {
    setSaveStates((current) => ({ ...current, [motorId]: "saving" }))
    try {
      const response = await fetch(`/api/operator-settings/motors/${motorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(motorSettingsPayload(settingsByMotor[motorId])),
      })
      const payload = (await response.json().catch(() => ({}))) as OperatorSettingsResponse & { ok?: boolean; values?: unknown }
      if (!response.ok || payload.ok !== true) {
        throw new Error(operatorSettingsError(payload, `${motorId} settings could not be saved.`))
      }
      setSettingsByMotor((current) => ({ ...current, [motorId]: parseMotorSettings(payload.values) }))
      setSaveStates((current) => ({ ...current, [motorId]: "saved" }))
    } catch {
      setSaveStates((current) => ({ ...current, [motorId]: "error" }))
    }
  }

  const settingsDisabled = isLoadingSettings || Boolean(loadError)

  return (
    <div>
      {loadError ? <p className="mb-2 text-xs font-semibold text-destructive">{loadError} Refresh the page to try again.</p> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {motors.map((motor) => (
          <StatusCard
            key={motor.id}
            motor={motor}
            settings={settingsByMotor[motor.id]}
            disabled={settingsDisabled}
            saveState={saveStates[motor.id]}
            onSettingsChange={(values) => updateMotorSettings(motor.id, values)}
            onSave={() => { void saveMotorSettings(motor.id) }}
          />
        ))}
      </div>
    </div>
  )
}
