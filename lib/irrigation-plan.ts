export const IRRIGATION_PLAN_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const

export type IrrigationPlanDayKey = (typeof IRRIGATION_PLAN_DAYS)[number]["key"]
export type DripZoneId = "zone-p2e" | "zone-p2w" | "zone-p1e" | "zone-p1w" | "zone-nm" | "zone-jf"
export type ScheduleId = "schedule-m1-p1e" | "schedule-m1-p1w" | "schedule-m1-nm" | "schedule-m2-p2w" | "schedule-m3-p2e" | "schedule-m3-jf"

export const DRIP_ZONE_IDS: readonly DripZoneId[] = ["zone-p2e", "zone-p2w", "zone-p1e", "zone-p1w", "zone-nm", "zone-jf"]
export const SCHEDULE_IDS: readonly ScheduleId[] = ["schedule-m1-p1e", "schedule-m1-p1w", "schedule-m1-nm", "schedule-m2-p2w", "schedule-m3-p2e", "schedule-m3-jf"]

export interface DripOutputRow {
  key: string
  zoneId: DripZoneId
  zone: string
  designedLph: string
  designedSecondsPer100ml: string
  measuredSecondsPer100ml: string
  dripsPerTree: string
}

export type DripOutputEditableField = Exclude<keyof DripOutputRow, "key" | "zoneId">

export interface MotorRunScheduleDay {
  min: string
  ltrs: string
}

export interface MotorRunScheduleRow {
  key: string
  scheduleId: ScheduleId
  motor: string
  plot: string
  days: Record<IrrigationPlanDayKey, MotorRunScheduleDay>
}

export interface IrrigationPlanResponse {
  irrigationPlan?: {
    dripOutput?: { rows?: unknown; updatedAt?: string }
    motorRunSchedule?: { rows?: unknown; updatedAt?: string }
  }
  rows?: unknown
  detail?: unknown
  error?: unknown
  ok?: boolean
}

const defaultDripRows: Omit<DripOutputRow, "key">[] = [
  { zoneId: "zone-p2e", zone: "P1E", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zoneId: "zone-p2w", zone: "P1W", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zoneId: "zone-p1e", zone: "P2E", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zoneId: "zone-p1w", zone: "P2W", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zoneId: "zone-nm", zone: "NM", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "150", dripsPerTree: "20" },
  { zoneId: "zone-jf", zone: "JF", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "16" },
]

function scheduleDay(min = "", ltrs = ""): MotorRunScheduleDay {
  return { min, ltrs }
}

function scheduleDays(
  mon: MotorRunScheduleDay,
  tue: MotorRunScheduleDay,
  wed: MotorRunScheduleDay,
  thu: MotorRunScheduleDay,
  fri: MotorRunScheduleDay,
  sat: MotorRunScheduleDay,
): Record<IrrigationPlanDayKey, MotorRunScheduleDay> {
  return { mon, tue, wed, thu, fri, sat, sun: scheduleDay() }
}

const sixty96 = () => scheduleDay("60", "96")
const sixty48 = () => scheduleDay("60", "48")
const sixty64 = () => scheduleDay("60", "64")
const triple144 = () => scheduleDay("30×3", "144")
const blank = () => scheduleDay()

const defaultScheduleRows: Omit<MotorRunScheduleRow, "key">[] = [
  { scheduleId: "schedule-m1-p1e", motor: "1", plot: "P2E", days: scheduleDays(sixty96(), sixty96(), sixty96(), sixty96(), sixty96(), sixty96()) },
  { scheduleId: "schedule-m1-p1w", motor: "1", plot: "P2W", days: scheduleDays(sixty96(), sixty96(), sixty96(), sixty96(), sixty96(), sixty96()) },
  { scheduleId: "schedule-m1-nm", motor: "1", plot: "NM", days: scheduleDays(sixty48(), blank(), sixty48(), blank(), sixty48(), blank()) },
  { scheduleId: "schedule-m2-p2w", motor: "2", plot: "P1W", days: scheduleDays(triple144(), triple144(), triple144(), triple144(), triple144(), triple144()) },
  { scheduleId: "schedule-m3-p2e", motor: "3", plot: "P1E", days: scheduleDays(triple144(), triple144(), triple144(), triple144(), triple144(), triple144()) },
  { scheduleId: "schedule-m3-jf", motor: "3", plot: "JF", days: scheduleDays(sixty64(), blank(), blank(), blank(), sixty64(), blank()) },
]

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

const dripZoneDisplayById: Record<DripZoneId, string> = Object.fromEntries(
  defaultDripRows.map((row) => [row.zoneId, row.zone]),
) as Record<DripZoneId, string>

const schedulePlotDisplayById: Record<ScheduleId, string> = Object.fromEntries(
  defaultScheduleRows.map((row) => [row.scheduleId, row.plot]),
) as Record<ScheduleId, string>

export function irrigationPlanZoneDisplay(zoneId: DripZoneId): string {
  return dripZoneDisplayById[zoneId]
}

export function irrigationSchedulePlotDisplay(scheduleId: ScheduleId): string {
  return schedulePlotDisplayById[scheduleId]
}

function cloneScheduleDays(days: Record<IrrigationPlanDayKey, MotorRunScheduleDay>) {
  return Object.fromEntries(
    IRRIGATION_PLAN_DAYS.map(({ key }) => [key, { ...days[key] }]),
  ) as Record<IrrigationPlanDayKey, MotorRunScheduleDay>
}

export function initialDripOutputRows(): DripOutputRow[] {
  return defaultDripRows.map((row) => ({ key: row.zoneId, ...row }))
}

export function initialMotorRunScheduleRows(): MotorRunScheduleRow[] {
  return defaultScheduleRows.map((row) => ({
    key: row.scheduleId,
    scheduleId: row.scheduleId,
    motor: row.motor,
    plot: row.plot,
    days: cloneScheduleDays(row.days),
  }))
}

export function parseDripOutputRows(value: unknown): DripOutputRow[] {
  if (!Array.isArray(value) || value.length === 0) return initialDripOutputRows()
  if (value.length !== DRIP_ZONE_IDS.length) throw new Error("Drip Output response must contain six rows.")
  const seen = new Set<DripZoneId>()
  return value.map((item, index) => {
    const row = isRecord(item) ? item : {}
    const fallbackId = DRIP_ZONE_IDS[index]
    const suppliedId = typeof row.zoneId === "string" && DRIP_ZONE_IDS.includes(row.zoneId as DripZoneId)
      ? row.zoneId as DripZoneId
      : fallbackId
    if (seen.has(suppliedId)) throw new Error("Drip Output response contains duplicate stable zone identifiers.")
    seen.add(suppliedId)
    return {
      key: suppliedId,
      zoneId: suppliedId,
      zone: irrigationPlanZoneDisplay(suppliedId),
      designedLph: inputValue(row.designedLph),
      designedSecondsPer100ml: inputValue(row.designedSecondsPer100ml),
      measuredSecondsPer100ml: inputValue(row.measuredSecondsPer100ml),
      dripsPerTree: inputValue(row.dripsPerTree),
    }
  })
}

export function parseMotorRunScheduleRows(value: unknown): MotorRunScheduleRow[] {
  if (!Array.isArray(value) || value.length === 0) return initialMotorRunScheduleRows()
  if (value.length !== SCHEDULE_IDS.length) throw new Error("Motor Run Schedule response must contain six rows.")
  const seen = new Set<ScheduleId>()
  return value.map((item, index) => {
    const row = isRecord(item) ? item : {}
    const days = isRecord(row.days) ? row.days : {}
    const fallbackId = SCHEDULE_IDS[index]
    const suppliedId = typeof row.scheduleId === "string" && SCHEDULE_IDS.includes(row.scheduleId as ScheduleId)
      ? row.scheduleId as ScheduleId
      : fallbackId
    if (seen.has(suppliedId)) throw new Error("Motor Run Schedule response contains duplicate stable identifiers.")
    seen.add(suppliedId)
    return {
      key: suppliedId,
      scheduleId: suppliedId,
      motor: inputValue(row.motor),
      plot: irrigationSchedulePlotDisplay(suppliedId),
      days: Object.fromEntries(IRRIGATION_PLAN_DAYS.map(({ key }) => {
        const day = isRecord(days[key]) ? days[key] : {}
        return [key, { min: inputValue(day.min), ltrs: inputValue(day.ltrs) }]
      })) as Record<IrrigationPlanDayKey, MotorRunScheduleDay>,
    }
  })
}

function positiveNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function calculatedMeasuredLph(row: Pick<DripOutputRow, "measuredSecondsPer100ml">): number | null {
  const seconds = positiveNumber(row.measuredSecondsPer100ml)
  return seconds === null ? null : 360 / seconds
}

export function calculatedLphPerTree(row: Pick<DripOutputRow, "measuredSecondsPer100ml" | "dripsPerTree">): number | null {
  const measuredLph = calculatedMeasuredLph(row)
  const drips = positiveNumber(row.dripsPerTree)
  return measuredLph === null || drips === null ? null : measuredLph * drips
}

export function formatIrrigationPlanNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  const rounded = Math.round((value + Number.EPSILON) * 10_000) / 10_000
  return String(rounded)
}

export function dripOutputFieldError(row: DripOutputRow, field: DripOutputEditableField): string | null {
  if (field === "zone") return row.zone.trim() ? null : "Zone is required."
  const labels: Record<Exclude<DripOutputEditableField, "zone">, string> = {
    designedLph: "Designed LPH",
    designedSecondsPer100ml: "Designed Sec/100 ml",
    measuredSecondsPer100ml: "Measured Sec/100 ml",
    dripsPerTree: "Drips/tree",
  }
  return positiveNumber(row[field]) === null ? `${labels[field]} must be greater than zero.` : null
}

export function dripOutputValidationMessages(rows: DripOutputRow[]): string[] {
  return rows.flatMap((row) => ([
    "zone",
    "designedLph",
    "designedSecondsPer100ml",
    "measuredSecondsPer100ml",
    "dripsPerTree",
  ] as DripOutputEditableField[])
    .map((field) => dripOutputFieldError(row, field))
    .filter((message): message is string => Boolean(message))
    .map((message) => `${row.zone.trim() || "Unnamed row"}: ${message}`))
}

export function motorScheduleValidationMessages(rows: MotorRunScheduleRow[]): string[] {
  return rows.flatMap((row) => {
    const label = `${row.motor.trim() || "Unnamed motor"} / ${row.plot.trim() || "Unnamed plot"}`
    return [
      row.motor.trim() ? null : `${label}: Motor is required.`,
      row.plot.trim() ? null : `${label}: Plot is required.`,
    ].filter((message): message is string => Boolean(message))
  })
}

export function dripOutputPayload(rows: DripOutputRow[]) {
  return {
    rows: rows.map(({ zoneId, zone, designedLph, designedSecondsPer100ml, measuredSecondsPer100ml, dripsPerTree }) => ({
      zoneId,
      zone,
      designedLph,
      designedSecondsPer100ml,
      measuredSecondsPer100ml,
      dripsPerTree,
    })),
  }
}

export function motorRunSchedulePayload(rows: MotorRunScheduleRow[]) {
  return {
    rows: rows.map(({ scheduleId, motor, plot, days }) => ({
      scheduleId,
      motor,
      plot,
      days: Object.fromEntries(IRRIGATION_PLAN_DAYS.map(({ key }) => [key, { ...days[key] }])),
    })),
  }
}

export function irrigationPlanError(payload: Pick<IrrigationPlanResponse, "detail" | "error">, fallback: string): string {
  if (typeof payload.error === "string") return payload.error
  if (typeof payload.detail === "string") return payload.detail
  if (Array.isArray(payload.detail)) {
    const first = payload.detail.find((item) => isRecord(item) && typeof item.msg === "string")
    if (isRecord(first) && typeof first.msg === "string") return first.msg
  }
  return fallback
}
