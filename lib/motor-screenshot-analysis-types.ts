// Motor Screenshot Runtime Analysis — shared types
// STATIC FRONTEND ONLY. No backend, OCR, or DB types here.

export type MotorId = "motor-1" | "motor-2" | "motor-3"

export type CommandSource = "rtc" | "phone"

export type RunStatus = "complete" | "unmatched"

/** How an individual extracted screenshot line is interpreted. */
export type MessageKind = "command" | "status" | "other"

export interface Motor {
  id: MotorId
  /** Display name — editable here so it can be renamed in one place later. */
  name: string
  /** Tailwind classes for an accessible, professional per-motor identity. */
  badgeClass: string
  dotClass: string
  accentTextClass: string
}
export interface ExtractedMessage {
  time: string // "HH:MM" (24-hour, no seconds)
  text: string
  kind: MessageKind
}

export interface RunRecord {
  id: string
  date: string // ISO "YYYY-MM-DD"
  motorId: MotorId
  /** Run number for that motor on that date. */
  run: number

  onTime: string | null // "HH:MM" or null when the ON event is missing
  onReason: string | null
  offTime: string | null // "HH:MM" or null when the OFF event is missing
  offReason: string | null

  /** Command source for this run, used by the source filter. */
  source: CommandSource

  /**
   * Confirmed runtime stored internally as MINUTES — the source of truth.
   * Never derive this by subtracting displayed (rounded) times.
   * Unmatched records store 0 and are excluded from confirmed totals.
   */
  runtimeMinutes: number

  status: RunStatus

  // Screenshot source metadata (for the viewer). No OCR is performed.
  screenshotName: string
  extractedMessages: ExtractedMessage[]
  matchingNote: string
}

export interface MotorSummary {
  motor: Motor
  totalMinutes: number
  completeRuns: number
  firstRunTime: string | null
  lastRunTime: string | null
  rtcOperations: number
  phoneOperations: number
  unmatched: number
}

export interface DateSummary {
  date: string
  perMotorMinutes: Record<MotorId, number>
  combinedMinutes: number
  completeRuns: number
  unmatched: number
  records: RunRecord[]
}
