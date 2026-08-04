export type MotorId = "motor-1" | "motor-2" | "motor-3"

export type CommandSource = "rtc" | "phone" | "unknown"

export type RunStatus = "complete" | "unmatched_on" | "unmatched_off" | "needs_review" | "rejected"

export type MessageKind = "command" | "status" | "other"
export type EventType = "mtr_on_command" | "mtr_off_command" | "motor_on" | "motor_off" | "unknown"
export type AnalysisStatus =
  | "queued"
  | "analysing"
  | "awaiting_review"
  | "confirmed"
  | "partially_confirmed"
  | "failed"
  | "rejected"

export interface Motor {
  id: MotorId
  name: string
  displayOrder: number
  badgeClass: string
  dotClass: string
  accentTextClass: string
}

export interface ExtractedMessage {
  time: string
  text: string
  kind: MessageKind
}

export interface ReviewMessage {
  id: number
  motor_id: MotorId
  tile_index: number
  raw_first_line: string
  normalized_line: string
  event_type: EventType
  event_timestamp: string
  original_date_text: string
  original_time_text: string
  command_source: CommandSource
  device_name: string | null
  confidence: number | null
  included: boolean
  review_status: string
  review_notes: string | null
  source_count: number
}

export interface UploadRecord {
  id: number
  motor_id: MotorId
  original_filename: string
  mime_type: string
  file_size: number
  sha256: string
  upload_status: "uploaded" | "deleted"
  analysis_status: AnalysisStatus
  extractor_provider: string
  error_message: string | null
  uploaded_by: string
  uploaded_at: string
  analysed_at: string | null
  confirmed_at: string | null
  confirmed_by: string | null
}

export interface UploadDetail {
  upload: UploadRecord
  messages: ReviewMessage[]
}

export interface RunRecord {
  id: string
  date: string
  motorId: MotorId
  motorName: string
  run: number
  onTime: string | null
  onReason: string | null
  offTime: string | null
  offReason: string | null
  source: CommandSource
  runtimeSeconds: number
  runtimeMinutes: number
  status: RunStatus
  screenshotId: number | null
  screenshotName: string
  extractedMessages: ExtractedMessage[]
  matchingNote: string
}

export interface MotorSummary {
  motor: Motor
  totalSeconds: number
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
  perMotorSeconds: Record<MotorId, number>
  perMotorMinutes: Record<MotorId, number>
  combinedSeconds: number
  combinedMinutes: number
  completeRuns: number
  unmatched: number
  records: RunRecord[]
}
