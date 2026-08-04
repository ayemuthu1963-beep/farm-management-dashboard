// Motor Screenshot Runtime Analysis — STATIC mock data.
// This file is the single source of truth for the preview. Codex will replace
// it with real OCR/DB-backed data during integration. Runtime is stored as
// MINUTES (runtimeMinutes) and formatted for display — never derived by
// subtracting rounded times.

import type {
  DateSummary,
  Motor,
  MotorId,
  MotorSummary,
  RunRecord,
} from "./motor-screenshot-analysis-types"

// Motor names live here so they can be renamed in one place later.
export const MOTORS: Motor[] = [
  {
    id: "motor-1",
    name: "Motor 1",
    badgeClass: "bg-[color-mix(in_oklab,var(--chart-1)_16%,transparent)] text-[var(--chart-1)]",
    dotClass: "bg-[var(--chart-1)]",
    accentTextClass: "text-[var(--chart-1)]",
  },
  {
    id: "motor-2",
    name: "Motor 2",
    badgeClass: "bg-[color-mix(in_oklab,var(--chart-2)_16%,transparent)] text-[var(--chart-2)]",
    dotClass: "bg-[var(--chart-2)]",
    accentTextClass: "text-[var(--chart-2)]",
  },
  {
    id: "motor-3",
    name: "Motor 3",
    badgeClass: "bg-[color-mix(in_oklab,var(--chart-3)_18%,transparent)] text-[var(--chart-3)]",
    dotClass: "bg-[var(--chart-3)]",
    accentTextClass: "text-[var(--chart-3)]",
  },
]

export const MOTOR_MAP: Record<MotorId, Motor> = MOTORS.reduce(
  (acc, m) => {
    acc[m.id] = m
    return acc
  },
  {} as Record<MotorId, Motor>,
)

export function getMotor(id: MotorId): Motor {
  return MOTOR_MAP[id]
}
// Static, sample selected period shown across the summary tiles.
export const SAMPLE_PERIOD = { start: "2026-07-28", end: "2026-07-31" }

// Number of source screenshots represented by this sample set.
export const SCREENSHOTS_PROCESSED = 9

const rtcOn = "RTC scheduled ON"
const rtcOff = "RTC scheduled OFF"

function complete(
  partial: Omit<RunRecord, "status"> & { status?: undefined },
): RunRecord {
  return { ...partial, status: "complete" }
}

// ---------------------------------------------------------------------------
// Records. Confirmed per-motor totals:
//   Motor 1 = 312 min (5 hr 12 min), Motor 2 = 275 min (4 hr 35 min),
//   Motor 3 = 368 min (6 hr 08 min). Combined = 955 min (15 hr 55 min).
//   Complete runs = 21, Unmatched = 2.
// ---------------------------------------------------------------------------

export const RUN_RECORDS: RunRecord[] = [
  // ----- Motor 1 -----
  complete({
    id: "m1-28-1",
    date: "2026-07-28",
    motorId: "motor-1",
    run: 1,
    onTime: "06:30",
    onReason: rtcOn,
    offTime: "07:39",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 69,
    screenshotName: "motor1_28jul_rtc.png",
    extractedMessages: [
      { time: "06:30", text: "MOTOR ON", kind: "status" },
      { time: "07:39", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m1-29-1",
    date: "2026-07-29",
    motorId: "motor-1",
    run: 1,
    onTime: "06:15",
    onReason: rtcOn,
    offTime: "07:00",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 45,
    screenshotName: "motor1_29jul_rtc.png",
    extractedMessages: [
      { time: "06:15", text: "MOTOR ON", kind: "status" },
      { time: "07:00", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m1-29-2",
    date: "2026-07-29",
    motorId: "motor-1",
    run: 2,
    onTime: "17:20",
    onReason: "SM-G965F \u2014 MTRON at 17:18",
    offTime: "18:00",
    offReason: "SM-G965F \u2014 MTROF at 18:00",
    source: "phone",
    runtimeMinutes: 40,
    screenshotName: "motor1_29jul_phone.png",
    extractedMessages: [
      { time: "17:18", text: "MTRON", kind: "command" },
      { time: "17:20", text: "MOTOR ON", kind: "status" },
      { time: "18:00", text: "MTROF", kind: "command" },
      { time: "18:00", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote:
      "Phone command MTRON preceded MOTOR ON by ~2 min (start delay). Matched with MOTOR OFF.",
  }),
  complete({
    id: "m1-30-1",
    date: "2026-07-30",
    motorId: "motor-1",
    run: 1,
    onTime: "09:14",
    onReason: rtcOn,
    offTime: "09:35",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 21,
    screenshotName: "motor1_30jul_rtc_am.png",
    extractedMessages: [
      { time: "09:14", text: "MOTOR ON", kind: "status" },
      { time: "09:35", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m1-30-2",
    date: "2026-07-30",
    motorId: "motor-1",
    run: 2,
    onTime: "11:36",
    onReason: rtcOn,
    offTime: "12:35",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 58,
    screenshotName: "motor1_30jul_rtc_mid.png",
    extractedMessages: [
      { time: "11:36", text: "MOTOR ON", kind: "status" },
      { time: "12:35", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m1-30-3",
    date: "2026-07-30",
    motorId: "motor-1",
    run: 3,
    onTime: "13:36",
    onReason: rtcOn,
    offTime: "14:35",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 58,
    screenshotName: "motor1_30jul_rtc_pm.png",
    extractedMessages: [
      { time: "13:36", text: "MOTOR ON", kind: "status" },
      { time: "14:35", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m1-30-4",
    date: "2026-07-30",
    motorId: "motor-1",
    run: 4,
    onTime: "15:14",
    onReason: "SM-G965F \u2014 MTRON at 15:12",
    offTime: "15:34",
    offReason: "SM-G965F \u2014 MTROF at 15:34",
    source: "phone",
    runtimeMinutes: 21,
    screenshotName: "motor1_30jul_phone.png",
    extractedMessages: [
      { time: "15:12", text: "MTRON", kind: "command" },
      { time: "15:14", text: "MOTOR ON", kind: "status" },
      { time: "15:34", text: "MTROF", kind: "command" },
      { time: "15:34", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote:
      "Phone command MTRON preceded MOTOR ON by ~2 min (start delay). Matched with MOTOR OFF.",
  }),

  // ----- Motor 2 -----
  complete({
    id: "m2-28-1",
    date: "2026-07-28",
    motorId: "motor-2",
    run: 1,
    onTime: "07:00",
    onReason: rtcOn,
    offTime: "07:45",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 45,
    screenshotName: "motor2_28jul_rtc.png",
    extractedMessages: [
      { time: "07:00", text: "MOTOR ON", kind: "status" },
      { time: "07:45", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  // Unmatched MOTOR OFF (no preceding MOTOR ON) — excluded from totals.
  {
    id: "m2-28-x",
    date: "2026-07-28",
    motorId: "motor-2",
    run: 2,
    onTime: null,
    onReason: null,
    offTime: "19:30",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 0,
    status: "unmatched",
    screenshotName: "motor2_28jul_partial.png",
    extractedMessages: [{ time: "19:30", text: "MOTOR OFF", kind: "status" }],
    matchingNote:
      "Unmatched MOTOR OFF — no corresponding MOTOR ON found. Excluded from confirmed runtime.",
  },
  complete({
    id: "m2-29-1",
    date: "2026-07-29",
    motorId: "motor-2",
    run: 1,
    onTime: "06:40",
    onReason: rtcOn,
    offTime: "07:33",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 53,
    screenshotName: "motor2_29jul_rtc.png",
    extractedMessages: [
      { time: "06:40", text: "MOTOR ON", kind: "status" },
      { time: "07:33", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m2-29-2",
    date: "2026-07-29",
    motorId: "motor-2",
    run: 2,
    onTime: "16:10",
    onReason: "SM-G965F \u2014 MTRON at 16:08",
    offTime: "16:50",
    offReason: "SM-G965F \u2014 MTROF at 16:50",
    source: "phone",
    runtimeMinutes: 40,
    screenshotName: "motor2_29jul_phone.png",
    extractedMessages: [
      { time: "16:08", text: "MTRON", kind: "command" },
      { time: "16:10", text: "MOTOR ON", kind: "status" },
      { time: "16:50", text: "MTROF", kind: "command" },
      { time: "16:50", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote:
      "Phone command MTRON preceded MOTOR ON by ~2 min (start delay). Matched with MOTOR OFF.",
  }),
  complete({
    id: "m2-30-1",
    date: "2026-07-30",
    motorId: "motor-2",
    run: 1,
    onTime: "08:00",
    onReason: rtcOn,
    offTime: "08:42",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 42,
    screenshotName: "motor2_30jul_rtc_am.png",
    extractedMessages: [
      { time: "08:00", text: "MOTOR ON", kind: "status" },
      { time: "08:42", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m2-30-2",
    date: "2026-07-30",
    motorId: "motor-2",
    run: 2,
    onTime: "12:10",
    onReason: rtcOn,
    offTime: "12:40",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 30,
    screenshotName: "motor2_30jul_rtc_mid.png",
    extractedMessages: [
      { time: "12:10", text: "MOTOR ON", kind: "status" },
      { time: "12:40", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m2-30-3",
    date: "2026-07-30",
    motorId: "motor-2",
    run: 3,
    onTime: "18:05",
    onReason: "SM-G965F \u2014 MTRON at 18:03",
    offTime: "18:35",
    offReason: "SM-G965F \u2014 MTROF at 18:35",
    source: "phone",
    runtimeMinutes: 30,
    screenshotName: "motor2_30jul_phone.png",
    extractedMessages: [
      { time: "18:03", text: "MTRON", kind: "command" },
      { time: "18:05", text: "MOTOR ON", kind: "status" },
      { time: "18:35", text: "MTROF", kind: "command" },
      { time: "18:35", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote:
      "Phone command MTRON preceded MOTOR ON by ~2 min (start delay). Matched with MOTOR OFF.",
  }),
  complete({
    id: "m2-31-1",
    date: "2026-07-31",
    motorId: "motor-2",
    run: 1,
    onTime: "06:20",
    onReason: rtcOn,
    offTime: "06:55",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 35,
    screenshotName: "motor2_31jul_rtc.png",
    extractedMessages: [
      { time: "06:20", text: "MOTOR ON", kind: "status" },
      { time: "06:55", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),

  // ----- Motor 3 -----
  complete({
    id: "m3-28-1",
    date: "2026-07-28",
    motorId: "motor-3",
    run: 1,
    onTime: "06:45",
    onReason: rtcOn,
    offTime: "07:30",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 45,
    screenshotName: "motor3_28jul_rtc.png",
    extractedMessages: [
      { time: "06:45", text: "MOTOR ON", kind: "status" },
      { time: "07:30", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m3-29-1",
    date: "2026-07-29",
    motorId: "motor-3",
    run: 1,
    onTime: "06:50",
    onReason: rtcOn,
    offTime: "07:45",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 55,
    screenshotName: "motor3_29jul_rtc.png",
    extractedMessages: [
      { time: "06:50", text: "MOTOR ON", kind: "status" },
      { time: "07:45", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m3-29-2",
    date: "2026-07-29",
    motorId: "motor-3",
    run: 2,
    onTime: "15:30",
    onReason: "SM-G965F \u2014 MTRON at 15:28",
    offTime: "16:13",
    offReason: "SM-G965F \u2014 MTROF at 16:13",
    source: "phone",
    runtimeMinutes: 43,
    screenshotName: "motor3_29jul_phone.png",
    extractedMessages: [
      { time: "15:28", text: "MTRON", kind: "command" },
      { time: "15:30", text: "MOTOR ON", kind: "status" },
      { time: "16:13", text: "MTROF", kind: "command" },
      { time: "16:13", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote:
      "Phone command MTRON preceded MOTOR ON by ~2 min (start delay). Matched with MOTOR OFF.",
  }),
  complete({
    id: "m3-30-1",
    date: "2026-07-30",
    motorId: "motor-3",
    run: 1,
    onTime: "07:10",
    onReason: rtcOn,
    offTime: "08:15",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 65,
    screenshotName: "motor3_30jul_rtc_am.png",
    extractedMessages: [
      { time: "07:10", text: "MOTOR ON", kind: "status" },
      { time: "08:15", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m3-30-2",
    date: "2026-07-30",
    motorId: "motor-3",
    run: 2,
    onTime: "12:00",
    onReason: rtcOn,
    offTime: "13:00",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 60,
    screenshotName: "motor3_30jul_rtc_mid.png",
    extractedMessages: [
      { time: "12:00", text: "MOTOR ON", kind: "status" },
      { time: "13:00", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
  complete({
    id: "m3-30-3",
    date: "2026-07-30",
    motorId: "motor-3",
    run: 3,
    onTime: "17:40",
    onReason: "SM-G965F \u2014 MTRON at 17:38",
    offTime: "18:40",
    offReason: "SM-G965F \u2014 MTROF at 18:40",
    source: "phone",
    runtimeMinutes: 60,
    screenshotName: "motor3_30jul_phone.png",
    extractedMessages: [
      { time: "17:38", text: "MTRON", kind: "command" },
      { time: "17:40", text: "MOTOR ON", kind: "status" },
      { time: "18:40", text: "MTROF", kind: "command" },
      { time: "18:40", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote:
      "Phone command MTRON preceded MOTOR ON by ~2 min (start delay). Matched with MOTOR OFF.",
  }),
  // Unmatched MOTOR ON (no MOTOR OFF) on 30 Jul — excluded from totals.
  {
    id: "m3-30-x",
    date: "2026-07-30",
    motorId: "motor-3",
    run: 4,
    onTime: "20:10",
    onReason: "SM-G965F \u2014 MTRON at 20:08",
    offTime: null,
    offReason: null,
    source: "phone",
    runtimeMinutes: 0,
    status: "unmatched",
    screenshotName: "motor3_30jul_partial.png",
    extractedMessages: [
      { time: "20:08", text: "MTRON", kind: "command" },
      { time: "20:10", text: "MOTOR ON", kind: "status" },
    ],
    matchingNote:
      "Unmatched MOTOR ON — no corresponding MOTOR OFF found. Excluded from confirmed runtime.",
  },
  complete({
    id: "m3-31-1",
    date: "2026-07-31",
    motorId: "motor-3",
    run: 1,
    onTime: "06:30",
    onReason: rtcOn,
    offTime: "07:10",
    offReason: rtcOff,
    source: "rtc",
    runtimeMinutes: 40,
    screenshotName: "motor3_31jul_rtc.png",
    extractedMessages: [
      { time: "06:30", text: "MOTOR ON", kind: "status" },
      { time: "07:10", text: "MOTOR OFF", kind: "status" },
    ],
    matchingNote: "MOTOR ON matched with MOTOR OFF on the same day.",
  }),
]

// ---------------------------------------------------------------------------
// Derived helpers (pure functions over a supplied record list so filters work).
// ---------------------------------------------------------------------------

function toMinutesOfDay(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export function summariseMotor(records: RunRecord[], motorId: MotorId): MotorSummary {
  const motor = getMotor(motorId)
  const own = records.filter((r) => r.motorId === motorId)
  const completed = own.filter((r) => r.status === "complete")

  const onTimes = completed.map((r) => r.onTime).filter((t): t is string => Boolean(t))
  const offTimes = completed.map((r) => r.offTime).filter((t): t is string => Boolean(t))

  const firstRunTime =
    onTimes.length > 0
      ? onTimes.reduce((a, b) => (toMinutesOfDay(a) <= toMinutesOfDay(b) ? a : b))
      : null
  const lastRunTime =
    offTimes.length > 0
      ? offTimes.reduce((a, b) => (toMinutesOfDay(a) >= toMinutesOfDay(b) ? a : b))
      : null

  return {
    motor,
    totalMinutes: completed.reduce((sum, r) => sum + r.runtimeMinutes, 0),
    completeRuns: completed.length,
    firstRunTime,
    lastRunTime,
    rtcOperations: completed.filter((r) => r.source === "rtc").length,
    phoneOperations: completed.filter((r) => r.source === "phone").length,
    unmatched: own.filter((r) => r.status === "unmatched").length,
  }
}

export function summariseAllMotors(records: RunRecord[]): MotorSummary[] {
  return MOTORS.map((m) => summariseMotor(records, m.id))
}

export function combinedMinutes(records: RunRecord[]): number {
  return records
    .filter((r) => r.status === "complete")
    .reduce((sum, r) => sum + r.runtimeMinutes, 0)
}

export function countCompleteRuns(records: RunRecord[]): number {
  return records.filter((r) => r.status === "complete").length
}

export function countUnmatched(records: RunRecord[]): number {
  return records.filter((r) => r.status === "unmatched").length
}

export function groupByDate(records: RunRecord[]): DateSummary[] {
  const byDate = new Map<string, RunRecord[]>()
  for (const r of records) {
    const list = byDate.get(r.date) ?? []
    list.push(r)
    byDate.set(r.date, list)
  }

  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest first
    .map(([date, recs]) => {
      const perMotorMinutes = { "motor-1": 0, "motor-2": 0, "motor-3": 0 } as Record<
        MotorId,
        number
      >
      for (const r of recs) {
        if (r.status === "complete") perMotorMinutes[r.motorId] += r.runtimeMinutes
      }
      return {
        date,
        perMotorMinutes,
        combinedMinutes: combinedMinutes(recs),
        completeRuns: countCompleteRuns(recs),
        unmatched: countUnmatched(recs),
        records: recs.sort((a, b) => {
          if (a.motorId !== b.motorId) return a.motorId < b.motorId ? -1 : 1
          return a.run - b.run
        }),
      }
    })
}
