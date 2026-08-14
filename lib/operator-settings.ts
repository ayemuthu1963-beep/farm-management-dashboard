import type { MotorId } from "@/lib/motor-data"
import type { ZoneId } from "@/lib/irrigation-data"

export interface TimeFields {
  hours: string
  minutes: string
}

export interface RtcTimerFields {
  from: TimeFields
  to: TimeFields
}

export interface MotorSettingsValues {
  maxRunTime: TimeFields
  rtcTimers: RtcTimerFields[]
  threePhaseDryRun: string
  threePhaseOverLoad: string
  twoPhaseDryRun: string
  twoPhaseOverLoad: string
}

export interface OperatorSettingsResponse {
  motorSettings?: Partial<Record<MotorId, { values?: unknown; updatedAt?: string }>>
  irrigationTargets?: Partial<Record<ZoneId, { target?: unknown; updatedAt?: string }>>
  detail?: unknown
  error?: unknown
}

export function operatorSettingsError(payload: Pick<OperatorSettingsResponse, "detail" | "error">, fallback: string): string {
  if (typeof payload.error === "string") return payload.error
  if (typeof payload.detail === "string") return payload.detail
  if (Array.isArray(payload.detail)) {
    const firstMessage = payload.detail.find((item) => isRecord(item) && typeof item.msg === "string")
    if (isRecord(firstMessage) && typeof firstMessage.msg === "string") return firstMessage.msg
  }
  return fallback
}

function emptyTimeFields(): TimeFields {
  return { hours: "", minutes: "" }
}

export function emptyMotorSettings(): MotorSettingsValues {
  return {
    maxRunTime: emptyTimeFields(),
    rtcTimers: Array.from({ length: 4 }, () => ({ from: emptyTimeFields(), to: emptyTimeFields() })),
    threePhaseDryRun: "",
    threePhaseOverLoad: "",
    twoPhaseDryRun: "",
    twoPhaseOverLoad: "",
  }
}

export function emptyMotorSettingsById(): Record<MotorId, MotorSettingsValues> {
  return { M1: emptyMotorSettings(), M2: emptyMotorSettings(), M3: emptyMotorSettings() }
}

export function emptyIrrigationTargets(): Record<ZoneId, string> {
  return { P1E: "", P1W: "", P2E: "", P2W: "", JF: "", NM: "" }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function inputValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : typeof value === "string"
      ? value
      : ""
}

function timeFields(value: unknown): TimeFields {
  if (!isRecord(value)) return emptyTimeFields()
  return { hours: inputValue(value.hours), minutes: inputValue(value.minutes) }
}

export function parseMotorSettings(value: unknown): MotorSettingsValues {
  if (!isRecord(value)) return emptyMotorSettings()
  const timers = Array.isArray(value.rtcTimers) ? value.rtcTimers : []
  return {
    maxRunTime: timeFields(value.maxRunTime),
    rtcTimers: Array.from({ length: 4 }, (_, index) => {
      const timer = isRecord(timers[index]) ? timers[index] : {}
      return { from: timeFields(timer.from), to: timeFields(timer.to) }
    }),
    threePhaseDryRun: inputValue(value.threePhaseDryRun),
    threePhaseOverLoad: inputValue(value.threePhaseOverLoad),
    twoPhaseDryRun: inputValue(value.twoPhaseDryRun),
    twoPhaseOverLoad: inputValue(value.twoPhaseOverLoad),
  }
}

function nullableNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function serializableTimeFields(value: TimeFields) {
  return { hours: nullableNumber(value.hours), minutes: nullableNumber(value.minutes) }
}

function nullableString(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

export function motorSettingsPayload(values: MotorSettingsValues) {
  return {
    maxRunTime: serializableTimeFields(values.maxRunTime),
    rtcTimers: values.rtcTimers.map((timer) => ({
      from: serializableTimeFields(timer.from),
      to: serializableTimeFields(timer.to),
    })),
    threePhaseDryRun: nullableString(values.threePhaseDryRun),
    threePhaseOverLoad: nullableString(values.threePhaseOverLoad),
    twoPhaseDryRun: nullableString(values.twoPhaseDryRun),
    twoPhaseOverLoad: nullableString(values.twoPhaseOverLoad),
  }
}
