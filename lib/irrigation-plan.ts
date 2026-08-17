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

export interface DripOutputRow {
  key: string
  zone: string
  designedLph: string
  designedSecondsPer100ml: string
  measuredSecondsPer100ml: string
  dripsPerTree: string
}

export type DripOutputEditableField = Exclude<keyof DripOutputRow, "key">

export interface MotorRunScheduleDay {
  min: string
  ltrs: string
}

export interface MotorRunScheduleRow {
  key: string
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
  { zone: "P2E", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zone: "P2W", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zone: "P1E", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zone: "P1W", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "24" },
  { zone: "NM", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "150", dripsPerTree: "20" },
  { zone: "JF", designedLph: "4", designedSecondsPer100ml: "90", measuredSecondsPer100ml: "90", dripsPerTree: "16" },
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
  { motor: "1", plot: "P1E", days: scheduleDays(sixty96(), sixty96(), sixty96(), sixty96(), sixty96(), sixty96()) },
  { motor: "1", plot: "P1W", days: scheduleDays(sixty96(), sixty96(), sixty96(), sixty96(), sixty96(), sixty96()) },
  { motor: "1", plot: "NM", days: scheduleDays(sixty48(), blank(), sixty48(), blank(), sixty48(), blank()) },
  { motor: "2", plot: "P2W", days: scheduleDays(triple144(), triple144(), triple144(), triple144(), triple144(), triple144()) },
  { motor: "3", plot: "P2E", days: scheduleDays(triple144(), triple144(), triple144(), triple144(), triple144(), triple144()) },
  { motor: "3", plot: "JF", days: scheduleDays(sixty64(), blank(), blank(), blank(), sixty64(), blank()) },
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

function cloneScheduleDays(days: Record<IrrigationPlanDayKey, MotorRunScheduleDay>) {
  return Object.fromEntries(
    IRRIGATION_PLAN_DAYS.map(({ key }) => [key, { ...days[key] }]),
  ) as Record<IrrigationPlanDayKey, MotorRunScheduleDay>
}

export function initialDripOutputRows(): DripOutputRow[] {
  return defaultDripRows.map((row, index) => ({ key: `drip-${index}`, ...row }))
}

export function initialMotorRunScheduleRows(): MotorRunScheduleRow[] {
  return defaultScheduleRows.map((row, index) => ({
    key: `schedule-${index}`,
    motor: row.motor,
    plot: row.plot,
    days: cloneScheduleDays(row.days),
  }))
}

export function parseDripOutputRows(value: unknown): DripOutputRow[] {
  if (!Array.isArray(value) || value.length === 0) return initialDripOutputRows()
  return value.map((item, index) => {
    const row = isRecord(item) ? item : {}
    return {
      key: `drip-${index}`,
      zone: inputValue(row.zone),
      designedLph: inputValue(row.designedLph),
      designedSecondsPer100ml: inputValue(row.designedSecondsPer100ml),
      measuredSecondsPer100ml: inputValue(row.measuredSecondsPer100ml),
      dripsPerTree: inputValue(row.dripsPerTree),
    }
  })
}

export function parseMotorRunScheduleRows(value: unknown): MotorRunScheduleRow[] {
  if (!Array.isArray(value) || value.length === 0) return initialMotorRunScheduleRows()
  return value.map((item, index) => {
    const row = isRecord(item) ? item : {}
    const days = isRecord(row.days) ? row.days : {}
    return {
      key: `schedule-${index}`,
      motor: inputValue(row.motor),
      plot: inputValue(row.plot),
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
    rows: rows.map(({ zone, designedLph, designedSecondsPer100ml, measuredSecondsPer100ml, dripsPerTree }) => ({
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
    rows: rows.map(({ motor, plot, days }) => ({
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
