import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export type CoconutNumeric = number | string

export interface CoconutCountingSummary {
  session_count: number
  entry_count: number
  total_grade_a: CoconutNumeric
  total_grade_b: CoconutNumeric
  combined_total: CoconutNumeric
  physical_nuts_counted: CoconutNumeric
  recorded_harvested_nuts: CoconutNumeric
  latest_session_date: string | null
}

export interface CoconutCountingSession {
  session_uuid: string
  session_date: string
  start_time: string
  end_time: string | null
  total_grade_a: CoconutNumeric
  total_grade_b: CoconutNumeric
  combined_total: CoconutNumeric
  number_of_entries: number
  status: "ACTIVE" | "COMPLETED" | "ENDED"
  total_nuts_harvested: number | null
  device_operator_identifier: string
  source_device_id: string
  event_created_at: string
  event_updated_at: string
  server_created_at?: string
  server_updated_at: string
  physical_nuts_counted?: CoconutNumeric
  /** Supplied by the authoritative backend authorization decision. */
  authorized_to_close?: boolean
}

export interface CoconutCountingEntry {
  entry_uuid: string
  session_uuid: string
  entry_sequence: number
  entry_datetime: string
  entry_date: string
  entry_time: string
  grade_name: "Grade A" | "Grade B"
  count_type: "Fixed 200" | "Manual" | "Manual Pairs"
  pair_count: CoconutNumeric | null
  entered_pairs: CoconutNumeric | null
  pair_half_units: number | null
  count_value: CoconutNumeric
  nut_count: number | null
  physical_nuts: number | null
  sale_equivalent_half_units: number | null
  count_rule: string | null
  grade_a_value: CoconutNumeric
  grade_b_value: CoconutNumeric
  running_total_a: CoconutNumeric
  running_total_b: CoconutNumeric
  running_combined_total: CoconutNumeric | null
  latitude: number | null
  longitude: number | null
  altitude: number | null
  gps_accuracy: number | null
  gps_status: "CAPTURED" | "UNAVAILABLE" | "PENDING"
  gps_captured_at: string | null
  device_name: string
  client_sync_status: "PENDING" | "SYNCED" | "FAILED"
  event_created_at: string
  server_received_at: string
}

export interface CoconutHarvestDateRevision {
  revision_uuid: string
  revision_number: number
  previous_date: string
  new_date: string
  event_created_at: string
  server_received_at: string
}

export interface CoconutTotalNutsRevision {
  revision_uuid: string
  revision_number: number
  previous_total_nuts: number | null
  new_total_nuts: number | null
  adjusted_harvest_total: CoconutNumeric | null
  b1_physical: CoconutNumeric | null
  b2_physical: CoconutNumeric | null
  event_created_at: string
  server_received_at: string
}

export interface CoconutCountingResetEvent {
  operation_uuid: string
  prior_session_uuid: string
  new_session_uuid: string
  source_device_id: string
  event_created_at: string
  server_received_at: string
}

export interface CoconutCountingSessionDetail {
  session: CoconutCountingSession
  entries: CoconutCountingEntry[]
  harvest_date_revisions: CoconutHarvestDateRevision[]
  total_nuts_revisions: CoconutTotalNutsRevision[]
  reset_events: CoconutCountingResetEvent[]
}

export interface CoconutCountingFilters {
  fromDate: string
  toDate: string
  status?: CoconutCountingSession["status"]
  limit?: number
  offset?: number
}

export interface CoconutCountingDashboardData {
  summary: CoconutCountingSummary
  sessions: CoconutCountingSession[]
  total: number
  limit: number
  offset: number
}

interface SessionListResponse {
  sessions: CoconutCountingSession[]
  total: number
  limit: number
  offset: number
}

export class CoconutCountingApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "CoconutCountingApiError"
  }
}

async function fetchBackendJson<T>(path: string): Promise<T> {
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    throw new CoconutCountingApiError("MFMS backend credentials are not configured for this website.")
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Authorization: authHeader, Accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    let detail = ""
    try {
      const payload = (await response.json()) as { detail?: unknown }
      if (typeof payload.detail === "string") detail = payload.detail
    } catch {
      // Keep the public error concise when the backend response is not JSON.
    }
    throw new CoconutCountingApiError(
      detail || `MFMS Coconut Counting service returned HTTP ${response.status}.`,
      response.status,
    )
  }
  return (await response.json()) as T
}

function filtersToSearchParams(filters: CoconutCountingFilters): URLSearchParams {
  const params = new URLSearchParams({ from_date: filters.fromDate, to_date: filters.toDate })
  if (filters.status) params.set("status", filters.status)
  params.set("limit", String(filters.limit ?? 50))
  params.set("offset", String(filters.offset ?? 0))
  return params
}

export async function getCoconutCountingDashboard(
  filters: CoconutCountingFilters,
): Promise<CoconutCountingDashboardData> {
  const sessionParams = filtersToSearchParams(filters)
  const summaryParams = new URLSearchParams({ from_date: filters.fromDate, to_date: filters.toDate })
  const [summary, list] = await Promise.all([
    fetchBackendJson<CoconutCountingSummary>(`/api/coconut-counting/summary?${summaryParams.toString()}`),
    fetchBackendJson<SessionListResponse>(`/api/coconut-counting/sessions?${sessionParams.toString()}`),
  ])
  return { summary, ...list }
}

export async function getCoconutCountingSessionDetail(sessionUuid: string): Promise<CoconutCountingSessionDetail> {
  return fetchBackendJson<CoconutCountingSessionDetail>(
    `/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}`,
  )
}
