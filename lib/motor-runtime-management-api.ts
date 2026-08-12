import type { MotorId } from "./motor-screenshot-analysis-types"

export type PlotOption = {
  motor_id: MotorId
  motor_no: number
  plot: string
  plot_label: string
  valve_no: number
}

export type ManagedAllocation = {
  id?: number
  sequence_no?: number
  plot: string
  valve_no: number
  starts_at?: string
  ends_at?: string
  runtime_minutes?: number
  start_time?: string
  end_time?: string
  start_next_day?: boolean
  end_next_day?: boolean
}

export type ManagedSessionPayload = {
  source_import_id: number | null
  source_runtime_session_id: number | null
  motor_id: MotorId
  operation_date: string
  run_no: number
  source_motor_on_at: string | null
  source_motor_off_at: string | null
  source_runtime_seconds: number | null
  on_time: string | null
  off_time: string | null
  off_next_day: boolean
  reason: string | null
  allocations: ManagedAllocation[]
}

export type ManagedSession = {
  id: number
  motor_id: MotorId
  motor_name: string
  operation_date: string
  run_no: number
  source_import_id: number | null
  source_motor_on_at: string | null
  source_motor_off_at: string | null
  source_runtime_seconds: number | null
  motor_on_at: string | null
  motor_off_at: string | null
  runtime_minutes: number | null
  reason: string | null
  workflow_status: "draft" | "published" | "void"
  updated_at: string
  published_at: string | null
  allocations: ManagedAllocation[]
}

export type ManagementConflict = {
  session_id: number
  motor_id: MotorId
  operation_date: string
  run_no: number
  plot: string
  starts_at: string
  ends_at: string
  conflict_type: "same_motor_overlap" | "same_plot_overlap"
  candidate_plot: string
  candidate_starts_at: string
  candidate_ends_at: string
}

export type ManagedSessionResult = {
  session: ManagedSession
  warnings: string[]
  conflicts: ManagementConflict[]
  publishable: boolean
}

export type AllEvent = {
  id: number
  import_id: number
  motor_id: MotorId
  motor_name: string
  original_filename: string
  worksheet_name: string
  row_number: number
  tile_no: number | null
  raw_first_line: string
  normalized_line: string
  original_date_text: string
  original_time_text: string
  event_timestamp: string | null
  timestamp_precision: "second" | "minute" | "unknown"
  remarks: string
  row_event_type: string
  parser_warning: string | null
}

export type PageResult<T> = {
  items: T[]
  pagination: { page: number; page_size: number; total: number; pages: number }
}

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload?.detail
    const message = typeof detail === "string"
      ? detail
      : typeof detail?.message === "string"
        ? detail.message
        : Array.isArray(payload?.errors)
          ? payload.errors.join(" ")
          : `Request failed with status ${response.status}.`
    const error = new Error(message) as Error & { detail?: unknown }
    error.detail = detail
    throw error
  }
  return payload as T
}

const BASE = "/api/admin/motor-runtime/management"

export async function loadPlotOptions(): Promise<PlotOption[]> {
  const payload = await json<unknown>(await fetch(`${BASE}/plot-options`, { cache: "no-store" }))
  if (Array.isArray(payload)) return payload as PlotOption[]
  if (payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: PlotOption[] }).items
  }
  return []
}

export async function loadAllEvents(query: URLSearchParams): Promise<PageResult<AllEvent>> {
  return json(await fetch(`${BASE}/events?${query}`, { cache: "no-store" }))
}

export async function loadManagedSessions(query: URLSearchParams): Promise<PageResult<ManagedSession>> {
  return json(await fetch(`${BASE}/sessions?${query}`, { cache: "no-store" }))
}

export async function saveManagedSession(payload: ManagedSessionPayload, sessionId?: number): Promise<ManagedSessionResult> {
  return json(await fetch(`${BASE}/sessions${sessionId ? `/${sessionId}` : ""}`, {
    method: sessionId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }))
}

export async function publishManagedSession(sessionId: number): Promise<{ session: ManagedSession }> {
  return json(await fetch(`${BASE}/sessions/${sessionId}/publish`, { method: "POST" }))
}

export async function voidManagedSession(sessionId: number): Promise<{ session: ManagedSession }> {
  return json(await fetch(`${BASE}/sessions/${sessionId}/void`, { method: "POST" }))
}

export async function updateLegacyRuntimeEntry(entryId: string, payload: {
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  remarks: string | null
}): Promise<unknown> {
  return json(await fetch(`${BASE}/legacy-entries/${encodeURIComponent(entryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }))
}

export async function voidLegacyRuntimeEntry(entryId: string): Promise<unknown> {
  return json(await fetch(`${BASE}/legacy-entries/${encodeURIComponent(entryId)}/void`, { method: "POST" }))
}
