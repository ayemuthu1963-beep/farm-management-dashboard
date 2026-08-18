import {
  IRRIGATION_PLAN_DAYS,
  SCHEDULE_IDS,
  type IrrigationPlanDayKey,
  type MotorRunScheduleDay,
  type MotorRunScheduleRow,
  type ScheduleId,
} from "./irrigation-plan"
import type { ZoneFiveDayHistory, ZoneId } from "./irrigation-data"

export const FARM_TIME_ZONE = "Asia/Kolkata"

export const ZONE_SCHEDULE_IDS: Readonly<Record<ZoneId, ScheduleId>> = {
  P1W: "schedule-m1-p1w",
  P1E: "schedule-m1-p1e",
  P2W: "schedule-m2-p2w",
  P2E: "schedule-m3-p2e",
  JF: "schedule-m3-jf",
  NM: "schedule-m1-nm",
}

export type ScheduleLoadStatus = "loading" | "ready" | "unavailable"
export type ScheduledWaterKind = "loading" | "scheduled" | "not-scheduled" | "unavailable"
export type ActualWaterStatus =
  | "schedule-loading"
  | "schedule-unavailable"
  | "scheduled-missing"
  | "below-schedule"
  | "within-schedule"
  | "above-schedule"
  | "unscheduled-none"
  | "unscheduled-water"

export interface ScheduledWater {
  kind: ScheduledWaterKind
  litres: number | null
  display: string
}

export interface ActualWaterComparison {
  status: ActualWaterStatus
  explanation: string
  tone: "neutral" | "red" | "yellow" | "light-green" | "dark-green"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function persistedCellValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string") return value
  throw new Error("Motor Run Schedule contains an invalid persisted cell value.")
}

function validPersistedLitres(value: string): boolean {
  if (!value.trim()) return true
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
}

export function parsePersistedMotorRunScheduleRows(value: unknown): MotorRunScheduleRow[] {
  if (!Array.isArray(value) || value.length !== SCHEDULE_IDS.length) {
    throw new Error("Motor Run Schedule response must contain six persisted rows.")
  }

  const seen = new Set<ScheduleId>()
  const rows = value.map((item) => {
    if (!isRecord(item) || typeof item.scheduleId !== "string" || !SCHEDULE_IDS.includes(item.scheduleId as ScheduleId)) {
      throw new Error("Motor Run Schedule response contains an invalid stable schedule identifier.")
    }
    const scheduleId = item.scheduleId as ScheduleId
    if (seen.has(scheduleId)) throw new Error("Motor Run Schedule response contains duplicate stable schedule identifiers.")
    seen.add(scheduleId)
    const persistedDays = item.days
    if (!isRecord(persistedDays)) throw new Error(`Motor Run Schedule row ${scheduleId} has invalid day data.`)

    const days = Object.fromEntries(IRRIGATION_PLAN_DAYS.map(({ key }) => {
      const day = persistedDays[key]
      if (!isRecord(day)) throw new Error(`Motor Run Schedule row ${scheduleId} is missing ${key}.`)
      const min = persistedCellValue(day.min)
      const ltrs = persistedCellValue(day.ltrs)
      if (!validPersistedLitres(ltrs)) throw new Error(`Motor Run Schedule row ${scheduleId} has invalid ${key} litres.`)
      return [key, { min, ltrs } satisfies MotorRunScheduleDay]
    })) as Record<IrrigationPlanDayKey, MotorRunScheduleDay>

    return {
      key: scheduleId,
      scheduleId,
      motor: persistedCellValue(item.motor),
      plot: persistedCellValue(item.plot),
      days,
    }
  })

  if (seen.size !== SCHEDULE_IDS.length || SCHEDULE_IDS.some((scheduleId) => !seen.has(scheduleId))) {
    throw new Error("Motor Run Schedule response is missing a stable schedule identifier.")
  }
  return rows
}

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FARM_TIME_ZONE,
  weekday: "short",
})

const WEEKDAY_KEYS: Record<string, IrrigationPlanDayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
}

export function farmWeekdayForDate(date: string): IrrigationPlanDayKey | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const [, year, month, day] = match
  const instant = new Date(`${year}-${month}-${day}T12:00:00+05:30`)
  if (Number.isNaN(instant.getTime())) return null
  const roundTrip = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
  if (roundTrip !== date) return null
  return WEEKDAY_KEYS[weekdayFormatter.format(instant)] ?? null
}

export function formatLitresPerTree(value: number): string {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 20 })} L/Tree`
}

export function formatActualWater(day: Pick<ZoneFiveDayHistory, "perTreeLitres">): string {
  return day.perTreeLitres === null ? "No records" : formatLitresPerTree(day.perTreeLitres)
}

export function scheduledWaterForZoneDate(
  rows: readonly MotorRunScheduleRow[],
  loadStatus: ScheduleLoadStatus,
  zoneId: ZoneId,
  date: string,
): ScheduledWater {
  if (loadStatus === "loading") return { kind: "loading", litres: null, display: "Loading…" }
  if (loadStatus === "unavailable") return { kind: "unavailable", litres: null, display: "Unavailable" }

  const weekday = farmWeekdayForDate(date)
  const scheduleId = ZONE_SCHEDULE_IDS[zoneId]
  const matches = rows.filter((row) => row.scheduleId === scheduleId)
  if (!weekday || matches.length !== 1) return { kind: "unavailable", litres: null, display: "Unavailable" }

  const rawLitres = matches[0].days[weekday]?.ltrs
  if (typeof rawLitres !== "string") return { kind: "unavailable", litres: null, display: "Unavailable" }
  if (!rawLitres.trim()) return { kind: "not-scheduled", litres: null, display: "Not scheduled" }
  const litres = Number(rawLitres)
  if (!Number.isFinite(litres) || litres < 0) return { kind: "unavailable", litres: null, display: "Unavailable" }
  if (litres === 0) return { kind: "not-scheduled", litres: null, display: "Not scheduled" }
  return { kind: "scheduled", litres, display: formatLitresPerTree(litres) }
}

export function compareActualWater(
  scheduled: ScheduledWater,
  actualLitres: number | null,
): ActualWaterComparison {
  if (scheduled.kind === "loading") {
    return { status: "schedule-loading", tone: "neutral", explanation: "Scheduled water is still loading" }
  }
  if (scheduled.kind === "unavailable") {
    return { status: "schedule-unavailable", tone: "neutral", explanation: "Scheduled water is unavailable; no comparison was made" }
  }
  if (scheduled.kind === "not-scheduled") {
    if (actualLitres !== null && actualLitres > 0) {
      return { status: "unscheduled-water", tone: "dark-green", explanation: "Water supplied on an unscheduled day" }
    }
    return { status: "unscheduled-none", tone: "neutral", explanation: "No water supplied on an unscheduled day" }
  }

  const scheduledLitres = scheduled.litres
  if (scheduledLitres === null || scheduledLitres <= 0) {
    return { status: "schedule-unavailable", tone: "neutral", explanation: "Scheduled water is unavailable; no comparison was made" }
  }
  if (actualLitres === null) {
    return { status: "scheduled-missing", tone: "red", explanation: "No actual irrigation record for a scheduled day" }
  }
  if (actualLitres === 0) {
    return { status: "scheduled-missing", tone: "red", explanation: "Zero actual water supplied for a scheduled day" }
  }
  if (actualLitres < scheduledLitres) {
    return { status: "below-schedule", tone: "yellow", explanation: "Actual water is below the scheduled amount" }
  }
  if (actualLitres <= scheduledLitres * 1.5) {
    return { status: "within-schedule", tone: "light-green", explanation: "Actual water is within 50% above the scheduled amount" }
  }
  return { status: "above-schedule", tone: "dark-green", explanation: "Actual water is more than 50% above the scheduled amount" }
}
