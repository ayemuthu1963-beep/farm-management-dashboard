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

export type NoRunRecord = {
  id: number
  operation_date: string
  motor_id: MotorId
  status: "Not Run"
  reason: string
  remarks: string | null
  source: "Manual_Admin"
  entered_by: string
  created_at: string
  voided_by: string | null
  voided_at: string | null
}

export type NoRunDateLoadState =
  | { status: "loading"; date: string; records: []; error: null }
  | { status: "ready"; date: string; records: NoRunRecord[]; error: null }
  | { status: "error"; date: string; records: []; error: string }

export type NoRunRequestToken = Readonly<{ date: string; generation: number }>

export function loadingNoRunDate(date: string): NoRunDateLoadState {
  return { status: "loading", date, records: [], error: null }
}

export function loadedNoRunDate(date: string, records: NoRunRecord[]): NoRunDateLoadState {
  return { status: "ready", date, records: records.filter((record) => record.operation_date === date), error: null }
}

export function failedNoRunDate(date: string, error: string): NoRunDateLoadState {
  return { status: "error", date, records: [], error }
}

export function visibleNoRunRecords(state: NoRunDateLoadState, selectedDate: string): NoRunRecord[] {
  return state.status === "ready" && state.date === selectedDate ? state.records : []
}

export function canVoidNoRunRecord(
  state: NoRunDateLoadState,
  selectedDate: string,
  record: NoRunRecord,
  mutationDate: string | null,
): boolean {
  return mutationDate === null
    && state.status === "ready"
    && state.date === selectedDate
    && record.operation_date === selectedDate
    && state.records.some((item) => item.id === record.id)
}

export function canApplyNoRunMutationCompletion(originatingDate: string, selectedDate: string): boolean {
  return originatingDate === selectedDate
}

export function createLatestNoRunRequestGuard() {
  let generation = 0
  return {
    begin(date: string): NoRunRequestToken {
      generation += 1
      return { date, generation }
    },
    invalidate(): void {
      generation += 1
    },
    isCurrent(token: NoRunRequestToken, selectedDate: string): boolean {
      return token.generation === generation && token.date === selectedDate
    },
  }
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

export async function loadNoRunRecords(query = new URLSearchParams(), signal?: AbortSignal): Promise<NoRunRecord[]> {
  return json(await fetch(`${BASE}/no-run-records?${query}`, { cache: "no-store", signal }))
}

export async function createNoRunRecords(payload: {
  operation_date: string
  motor_ids: MotorId[]
  status: "Not Run"
  reason: string
  remarks: string | null
}): Promise<{ ok: true; inserted_count: number; records: NoRunRecord[] }> {
  return json(await fetch(`${BASE}/no-run-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }))
}

export async function voidNoRunRecord(recordId: number): Promise<{ ok: true; record: NoRunRecord }> {
  return json(await fetch(`${BASE}/no-run-records/${recordId}`, { method: "DELETE" }))
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
