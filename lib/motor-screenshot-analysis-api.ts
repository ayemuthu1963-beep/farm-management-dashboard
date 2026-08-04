import { motorFromApi } from "./motor-screenshot-analysis-config"
import type {
  CommandSource,
  Motor,
  MotorId,
  MotorSummary,
  ReviewMessage,
  RunRecord,
  RunStatus,
  UploadDetail,
  UploadRecord,
} from "./motor-screenshot-analysis-types"

type ApiRecord = {
  id: number
  motor_id: MotorId
  motor_name: string
  operation_date: string
  motor_on_at: string | null
  motor_off_at: string | null
  runtime_seconds: number | null
  on_reason: string | null
  off_reason: string | null
  command_source: CommandSource
  status: RunStatus
  review_notes: string | null
  on_screenshot_id: number | null
  off_screenshot_id: number | null
}

type ApiSummaryMotor = {
  motor_id: MotorId
  motor_name: string
  display_order: number
  confirmed_runtime_seconds: number
  complete_runs: number
  unmatched_or_review: number
  rtc_operations: number
  phone_operations: number
  first_run_at: string | null
  last_run_at: string | null
}

export type RecordsQuery = {
  startDate?: string
  endDate?: string
  motorId?: MotorId | "all"
  source?: CommandSource | "all"
  status?: RunStatus | "all"
  search?: string
  sort?: string
  page?: number
  pageSize?: number
}

export type RecordsResponse = {
  records: RunRecord[]
  pagination: { page: number; page_size: number; total: number; pages: number }
}

export type SummaryResponse = {
  motors: MotorSummary[]
  combinedSeconds: number
  completeRuns: number
  unmatched: number
  screenshotsProcessed: number
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload.detail === "string"
      ? payload.detail
      : Array.isArray(payload.errors) && typeof payload.errors[0] === "string"
        ? payload.errors[0]
        : `Request failed with status ${response.status}.`
    throw new Error(message)
  }
  return payload as T
}

function localTime(value: string | null, includeSeconds = false): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(value))
}

export async function loadMotors(): Promise<Motor[]> {
  const response = await fetch("/api/motor-screenshot-analysis/motors", { cache: "no-store" })
  const rows = await jsonResponse<Array<{ id: string; name: string; display_order: number }>>(response)
  return rows.map(motorFromApi)
}

export async function loadRecords(query: RecordsQuery): Promise<RecordsResponse> {
  const params = new URLSearchParams()
  if (query.startDate) params.set("start_date", query.startDate)
  if (query.endDate) params.set("end_date", query.endDate)
  if (query.motorId && query.motorId !== "all") params.set("motor_id", query.motorId)
  if (query.source && query.source !== "all") params.set("source", query.source)
  if (query.status && query.status !== "all") params.set("status", query.status)
  if (query.search?.trim()) params.set("search", query.search.trim())
  params.set("sort", query.sort ?? "date_desc")
  params.set("page", String(query.page ?? 1))
  params.set("page_size", String(query.pageSize ?? 20))
  const response = await fetch(`/api/motor-screenshot-analysis/records?${params}`, { cache: "no-store" })
  const payload = await jsonResponse<{ items: ApiRecord[]; pagination: RecordsResponse["pagination"] }>(response)
  const runs = new Map<string, number>()
  return {
    records: payload.items.map((row) => {
      const key = `${row.operation_date}:${row.motor_id}`
      const run = (runs.get(key) ?? 0) + 1
      runs.set(key, run)
      const screenshotId = row.on_screenshot_id ?? row.off_screenshot_id
      return {
        id: String(row.id),
        date: row.operation_date,
        motorId: row.motor_id,
        motorName: row.motor_name,
        run,
        onTime: localTime(row.motor_on_at),
        onReason: row.on_reason,
        offTime: localTime(row.motor_off_at),
        offReason: row.off_reason,
        source: row.command_source,
        runtimeSeconds: row.runtime_seconds ?? 0,
        runtimeMinutes: Math.round((row.runtime_seconds ?? 0) / 60),
        status: row.status,
        screenshotId,
        screenshotName: screenshotId ? `Screenshot ${screenshotId}` : "No screenshot available",
        extractedMessages: [],
        matchingNote: row.review_notes ?? (row.status === "complete" ? "Confirmed MOTOR ON/OFF session." : "Owner review required."),
      }
    }),
    pagination: payload.pagination,
  }
}

export async function loadSummary(query: Pick<RecordsQuery, "startDate" | "endDate" | "motorId">): Promise<SummaryResponse> {
  const params = new URLSearchParams()
  if (query.startDate) params.set("start_date", query.startDate)
  if (query.endDate) params.set("end_date", query.endDate)
  if (query.motorId && query.motorId !== "all") params.set("motor_id", query.motorId)
  const response = await fetch(`/api/motor-screenshot-analysis/summary?${params}`, { cache: "no-store" })
  const payload = await jsonResponse<{
    motors: ApiSummaryMotor[]
    combined_runtime_seconds: number
    complete_runs: number
    unmatched_or_review: number
    screenshots_processed: number
  }>(response)
  return {
    motors: payload.motors.map((row) => ({
      motor: motorFromApi({ id: row.motor_id, name: row.motor_name, display_order: row.display_order }),
      totalSeconds: Number(row.confirmed_runtime_seconds),
      totalMinutes: Math.round(Number(row.confirmed_runtime_seconds) / 60),
      completeRuns: row.complete_runs,
      firstRunTime: localTime(row.first_run_at),
      lastRunTime: localTime(row.last_run_at),
      rtcOperations: row.rtc_operations,
      phoneOperations: row.phone_operations,
      unmatched: row.unmatched_or_review,
    })),
    combinedSeconds: payload.combined_runtime_seconds,
    completeRuns: payload.complete_runs,
    unmatched: payload.unmatched_or_review,
    screenshotsProcessed: payload.screenshots_processed,
  }
}

export async function uploadScreenshots(motorId: MotorId, files: File[]): Promise<{ uploads: UploadRecord[]; duplicates: unknown[] }> {
  const body = new FormData()
  body.set("motor_id", motorId)
  for (const file of files) body.append("files", file, file.name)
  return jsonResponse(await fetch("/api/motor-screenshot-analysis/uploads", { method: "POST", body }))
}

export async function getUpload(uploadId: number): Promise<UploadDetail> {
  return jsonResponse(await fetch(`/api/motor-screenshot-analysis/uploads/${uploadId}`, { cache: "no-store" }))
}

export async function analyseUpload(uploadId: number): Promise<UploadDetail> {
  return jsonResponse(await fetch(`/api/motor-screenshot-analysis/uploads/${uploadId}/analyse`, { method: "POST" }))
}

export async function updateReviewMessage(message: ReviewMessage): Promise<ReviewMessage> {
  return jsonResponse(await fetch(`/api/motor-screenshot-analysis/messages/${message.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raw_first_line: message.raw_first_line,
      event_type: message.event_type,
      event_timestamp: message.event_timestamp,
      original_date_text: message.original_date_text,
      original_time_text: message.original_time_text,
      command_source: message.command_source,
      device_name: message.device_name,
      confidence: message.confidence,
      included: message.included,
      review_notes: message.review_notes,
    }),
  }))
}

export async function confirmUpload(uploadId: number) {
  return jsonResponse(await fetch(`/api/motor-screenshot-analysis/uploads/${uploadId}/confirm`, { method: "POST" }))
}

export async function rejectUpload(uploadId: number) {
  return jsonResponse(await fetch(`/api/motor-screenshot-analysis/uploads/${uploadId}/reject`, { method: "POST" }))
}
