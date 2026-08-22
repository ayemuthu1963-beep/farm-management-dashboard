import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_QUESTION_CHARACTERS = 500
const MAX_REQUEST_BYTES = 4096
const PROXY_TIMEOUT_MS = 20_000
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }
const RESPONSE_FIELDS = ["analysis_plan", "answer", "blocked_reason", "chart", "cycles", "data_as_of", "data_source_status", "denominator", "metabase_call_made", "period", "period_end", "period_start", "provider_call_made", "quality_flags", "status", "table"]
const COMPOSITE_RESPONSE_FIELDS = [...RESPONSE_FIELDS, "charts", "freshness", "sections"]
const TABLE_FIELDS = new Set(["rank", "tree_no", "plot", "cycle", "start_date", "end_date", "total_nuts", "total_bunches", "harvest_records", "distinct_observed_trees", "average_nuts_per_harvested_record", "average_bunches_per_harvested_record", "nuts_per_bunch", "quality_flags", "scope", "zone", "motor", "well", "date", "runtime_display", "runtime_minutes", "estimated_delivered_litres", "allocation_count", "morning_litres", "evening_litres", "completeness", "inspection_date", "traps_inspected", "total_captures", "positive_catch_traps", "zero_catch_traps", "average_per_inspected_trap", "coverage_percent", "trap_no", "trap_type", "linked_tree", "inspection_events", "average_per_inspected_event", "last_inspection", "captures", "source_rows", "irrigation_runtime", "water_delivered", "north_morning", "north_evening", "south_morning", "south_evening", "beetle_traps_inspected", "beetle_captures"])
const METRICS = new Set(["total_nuts", "total_bunches", "harvested_tree_cycle_records", "distinct_observed_harvested_trees", "average_nuts_per_harvested_record", "average_bunches_per_harvested_record", "nuts_per_bunch"])
const IRRIGATION_METRICS = new Set(["runtime_minutes", "estimated_delivered_litres"])
const WELL_WATER_METRICS = new Set(["calibrated_litres"])
const BEETLE_METRICS = new Set(["total_captures", "inspected_traps", "positive_catch_traps", "zero_catch_traps", "average_captures_per_inspected_trap_date", "coverage", "current_active_traps", "last_inspection", "days_since_last_inspection", "global_next_inspection", "never_inspected_traps", "inspection_date_count", "repeated_groups", "source_quality"])
const PERIOD_KINDS = new Set(["latest_irrigation_dates", "last_calendar_days", "relative_day", "current_month", "previous_month", "date_range"])
const BEETLE_PERIOD_KINDS = new Set(["latest_inspection_dates", "last_calendar_days", "relative_day", "current_month", "previous_month", "date_range", "all_available"])

function safeError(status: number, message: string) {
  return NextResponse.json({
    answer: "", status: "BLOCKED_NOT_YET_SUPPORTED", data_as_of: "", period: null,
    period_start: null, period_end: null, cycles: [], denominator: null, quality_flags: [],
    data_source_status: "NOT_QUERIED_FAIL_CLOSED", analysis_plan: null, table: null, chart: null,
    blocked_reason: message, metabase_call_made: false, provider_call_made: false,
  }, { status, headers: NO_STORE_HEADERS })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function hasExactFields(value: Record<string, unknown>, fields: string[]) {
  return JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify(fields.toSorted())
}

function isSafePlan(value: unknown, allowComposite = true): boolean {
  if (value === null) return true
  if (!isRecord(value)) return false
  if (value.kind === "composite") {
    if (!allowComposite || !hasExactFields(value, ["kind", "domains", "period", "presentation", "execution", "subplans"])) return false
    const domains = value.domains; const period = value.period; const subplans = value.subplans
    const allowedDomains = ["harvest", "irrigation", "well_water", "beetle_monitoring"]
    if (!Array.isArray(domains) || domains.length < 2 || domains.length > 4 || !domains.every((domain) => typeof domain === "string" && allowedDomains.includes(domain)) || new Set(domains).size !== domains.length) return false
    if (!isRecord(period) || !hasExactFields(period, ["kind", "start", "end", "count"]) || !["domain_default", "date_range"].includes(String(period.kind))) return false
    if (![period.start, period.end].every((item) => item === null || (typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)))) return false
    if (period.count !== null && !(typeof period.count === "number" && Number.isInteger(period.count) && period.count >= 1 && period.count <= 31)) return false
    if (!["domain_cards", "date_aligned", "side_by_side"].includes(String(value.presentation)) || value.execution !== "independent_validated_domain_subplans") return false
    return Array.isArray(subplans) && subplans.length === domains.length && subplans.every((subplan, index) => isRecord(subplan) && subplan.domain === domains[index] && isSafePlan(subplan, false))
  }
  if (value.domain === "beetle_monitoring") {
    if (!hasExactFields(value, ["domain", "metric", "group_by", "filters", "period", "sort", "limit", "chart_type"])) return false
    const filters = value.filters; const period = value.period; const sort = value.sort
    if (!isRecord(filters) || !hasExactFields(filters, ["trap_types", "plots", "trap_numbers"]) || !isRecord(period) || !hasExactFields(period, ["kind", "count", "start", "end"]) || !isRecord(sort) || !hasExactFields(sort, ["direction"])) return false
    return typeof value.metric === "string" && BEETLE_METRICS.has(value.metric)
      && typeof value.group_by === "string" && ["none", "trap", "trap_history", "date", "trap_type", "plot"].includes(value.group_by)
      && Array.isArray(filters.trap_types) && filters.trap_types.length <= 2 && filters.trap_types.every((item) => item === "Rhinoceros Beetle" || item === "Red Palm Weevil")
      && Array.isArray(filters.plots) && filters.plots.length <= 2 && filters.plots.every((item) => item === "Plot 1" || item === "Plot 2")
      && Array.isArray(filters.trap_numbers) && filters.trap_numbers.length <= 50 && filters.trap_numbers.every((item) => typeof item === "string" && /^\d+$/.test(item))
      && typeof period.kind === "string" && BEETLE_PERIOD_KINDS.has(period.kind)
      && (period.count === null || (typeof period.count === "number" && Number.isInteger(period.count) && period.count >= -1 && period.count <= 31))
      && [period.start, period.end].every((item) => item === null || (typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)))
      && (sort.direction === "asc" || sort.direction === "desc")
      && (value.limit === null || (typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 50))
      && (value.chart_type === null || value.chart_type === "line" || value.chart_type === "bar")
  }
  if (value.domain === "irrigation" || value.domain === "well_water") {
    if (!hasExactFields(value, ["domain", "metric", "group_by", "filters", "period", "sort", "limit", "chart_type"])) return false
    const filters = value.filters; const period = value.period; const sort = value.sort
    if (!isRecord(filters) || !isRecord(period) || !hasExactFields(period, ["kind", "count", "start", "end"]) || !isRecord(sort) || !hasExactFields(sort, ["direction"])) return false
    if (typeof period.kind !== "string" || !PERIOD_KINDS.has(period.kind)) return false
    if (period.count !== null && !(typeof period.count === "number" && Number.isInteger(period.count) && period.count >= -1 && period.count <= 31)) return false
    if (![period.start, period.end].every((item) => item === null || (typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)))) return false
    if (sort.direction !== "asc" && sort.direction !== "desc") return false
    if (value.limit !== null && !(typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 50)) return false
    if (value.chart_type !== null && value.chart_type !== "line" && value.chart_type !== "bar") return false
    if (value.domain === "irrigation") return typeof value.metric === "string" && IRRIGATION_METRICS.has(value.metric)
      && typeof value.group_by === "string" && ["none", "zone", "motor", "well", "date"].includes(value.group_by)
      && hasExactFields(filters, ["zones", "motors", "wells"])
      && Array.isArray(filters.zones) && filters.zones.length <= 6 && filters.zones.every((item) => typeof item === "string" && ["P1W", "P1E", "P2W", "P2E", "JF", "NM"].includes(item))
      && Array.isArray(filters.motors) && filters.motors.length <= 3 && filters.motors.every((item) => typeof item === "string" && ["M1", "M2", "M3"].includes(item))
      && Array.isArray(filters.wells) && filters.wells.length <= 2 && filters.wells.every((item) => typeof item === "string" && ["North Well", "South Well"].includes(item))
    return typeof value.metric === "string" && WELL_WATER_METRICS.has(value.metric)
      && typeof value.group_by === "string" && ["well", "date_well"].includes(value.group_by)
      && hasExactFields(filters, ["wells", "reading_period", "quality_filter"])
      && Array.isArray(filters.wells) && filters.wells.length <= 2 && filters.wells.every((item) => typeof item === "string" && ["North Well", "South Well"].includes(item))
      && [null, "Morning", "Evening"].includes(filters.reading_period as null | string)
      && [null, "MISSING_MORNING_READING", "MISSING_EVENING_READING", "DUPLICATE_PERIOD", "CAPACITY_CONFLICT"].includes(filters.quality_filter as null | string)
  }
  if (!hasExactFields(value, ["domain", "metric", "group_by", "filters", "period", "sort", "limit", "series", "chart_type"])) return false
  const filters = value.filters; const period = value.period; const sort = value.sort
  if (!isRecord(filters) || !hasExactFields(filters, ["plots", "tree_numbers"]) || !isRecord(period) || !hasExactFields(period, ["kind", "count", "cycles"]) || !isRecord(sort) || !hasExactFields(sort, ["metric", "direction"])) return false
  return value.domain === "harvest"
    && typeof value.metric === "string" && METRICS.has(value.metric)
    && typeof value.group_by === "string" && ["none", "tree", "plot", "cycle"].includes(value.group_by)
    && Array.isArray(filters.plots) && filters.plots.length <= 2 && filters.plots.every((item) => item === "Plot 1" || item === "Plot 2")
    && Array.isArray(filters.tree_numbers) && filters.tree_numbers.length <= 50 && filters.tree_numbers.every((item) => typeof item === "string" && /^[0-9]+(?:\.[0-9]+)?$/.test(item))
    && typeof period.kind === "string" && ["latest_n", "latest_completed", "all_completed", "cycles"].includes(period.kind)
    && (period.count === null || (typeof period.count === "number" && Number.isInteger(period.count) && period.count >= 1 && period.count <= 19))
    && Array.isArray(period.cycles) && period.cycles.length <= 19 && period.cycles.every((item) => typeof item === "string" && /^\d+$/.test(item))
    && typeof sort.metric === "string" && METRICS.has(sort.metric) && (sort.direction === "asc" || sort.direction === "desc")
    && (value.limit === null || (typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 50))
    && (value.series === "none" || value.series === "plot")
    && (value.chart_type === null || value.chart_type === "line" || value.chart_type === "bar")
}

function isSafeCell(value: unknown, format: string, key: string) {
  if (value === null) return format === "decimal6" || format === "integer" || (format === "text" && key === "linked_tree")
  if (format === "integer") return typeof value === "number" && Number.isInteger(value) && value >= 0
  if (format === "text") return typeof value === "string" && value.length <= 128
  if (format === "date") return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (format === "decimal6") return typeof value === "string" && /^\d+\.\d{6}$/.test(value)
  if (format === "flags") return Array.isArray(value) && value.length <= 8 && value.every((item) => typeof item === "string" && item.length <= 128)
  return false
}

function isSafeTable(value: unknown) {
  if (value === null) return true
  if (!isRecord(value) || !hasExactFields(value, ["title", "columns", "rows"]) || typeof value.title !== "string" || !Array.isArray(value.columns) || !Array.isArray(value.rows) || value.columns.length < 1 || value.columns.length > TABLE_FIELDS.size || value.rows.length > 50) return false
  const keys: string[] = []; const formats = new Map<string, string>()
  for (const rawColumn of value.columns) {
    if (!isRecord(rawColumn) || !hasExactFields(rawColumn, ["key", "label", "format"]) || typeof rawColumn.key !== "string" || !TABLE_FIELDS.has(rawColumn.key) || formats.has(rawColumn.key) || typeof rawColumn.label !== "string" || typeof rawColumn.format !== "string" || !["integer", "text", "date", "decimal6", "flags"].includes(rawColumn.format)) return false
    keys.push(rawColumn.key); formats.set(rawColumn.key, rawColumn.format)
  }
  return value.rows.every((rawRow) => isRecord(rawRow) && JSON.stringify(Object.keys(rawRow)) === JSON.stringify(keys) && keys.every((key) => isSafeCell(rawRow[key], formats.get(key) ?? "", key)))
}

function isSafeChart(value: unknown, table: unknown) {
  if (value === null) return true
  if (!isRecord(value) || !hasExactFields(value, ["type", "x_field", "y_fields", "series_field", "rows"]) || !isRecord(table)) return false
  const tableRows = table.rows
  if (!Array.isArray(tableRows)) return false
  if (!["line", "bar"].includes(String(value.type)) || typeof value.x_field !== "string" || !TABLE_FIELDS.has(value.x_field) || !Array.isArray(value.y_fields) || value.y_fields.length < 1 || value.y_fields.length > 3 || !value.y_fields.every((field) => typeof field === "string" && TABLE_FIELDS.has(field)) || (value.series_field !== null && value.series_field !== "plot" && value.series_field !== "well") || !Array.isArray(value.rows) || value.rows.length > 50 || value.rows.length !== tableRows.length) return false
  const keys = [value.x_field, ...value.y_fields] as string[]
  if (value.series_field && !keys.includes(value.series_field)) keys.push(value.series_field)
  return value.rows.every((rawRow, index) => isRecord(rawRow) && isRecord(tableRows[index]) && JSON.stringify(Object.keys(rawRow)) === JSON.stringify(keys) && keys.every((key) => rawRow[key] === (tableRows[index] as Record<string, unknown>)[key]))
}

function isSafeSection(value: unknown) {
  if (!isRecord(value) || !hasExactFields(value, ["domain", "title", "headline", "period", "data_as_of", "denominator", "quality_flags", "data_source_status", "table", "chart"])) return false
  if (!["harvest", "irrigation", "well_water", "beetle_monitoring"].includes(String(value.domain))) return false
  if (![value.title, value.headline, value.data_as_of, value.data_source_status].every((item) => typeof item === "string")) return false
  if (value.period !== null && typeof value.period !== "string") return false
  if (value.denominator !== null && typeof value.denominator !== "string") return false
  if (!Array.isArray(value.quality_flags) || value.quality_flags.length > 16 || !value.quality_flags.every((flag) => typeof flag === "string" && flag.length <= 160)) return false
  return isSafeTable(value.table) && isSafeChart(value.chart, value.table)
}

function isSafeFreshness(value: unknown, domains: string[]) {
  if (!isRecord(value) || !hasExactFields(value, ["domains", "oldest_source_refresh", "oldest_source_domain", "quality_flags"]) || !isRecord(value.domains)) return false
  if (JSON.stringify(Object.keys(value.domains)) !== JSON.stringify(domains) || !Object.values(value.domains).every((item) => typeof item === "string" && item.length > 0)) return false
  if (typeof value.oldest_source_domain !== "string" || !domains.includes(value.oldest_source_domain) || typeof value.oldest_source_refresh !== "string" || value.oldest_source_refresh !== value.domains[value.oldest_source_domain]) return false
  return Array.isArray(value.quality_flags) && value.quality_flags.length <= 1 && value.quality_flags.every((flag) => flag === "DATA_FRESHNESS_DIFFERS_BY_DOMAIN")
}

function isSafePanelChart(value: unknown, sections: Array<Record<string, unknown>>) {
  if (!isRecord(value) || !hasExactFields(value, ["domain", "title", "type", "x_field", "y_fields", "series_field", "rows"]) || typeof value.domain !== "string" || typeof value.title !== "string") return false
  const section = sections.find((item) => item.domain === value.domain)
  if (!section) return false
  return isSafeChart({ type: value.type, x_field: value.x_field, y_fields: value.y_fields, series_field: value.series_field, rows: value.rows }, section.table)
}

function isSafeResponse(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || (!hasExactFields(value, RESPONSE_FIELDS) && !hasExactFields(value, COMPOSITE_RESPONSE_FIELDS))) return false
  if (typeof value.answer !== "string" || typeof value.status !== "string" || !["ANSWERED", "BLOCKED_GOVERNANCE", "BLOCKED_SECURITY", "BLOCKED_NOT_YET_SUPPORTED", "BLOCKED_LIMIT", "CLARIFICATION_REQUIRED"].includes(value.status) || (value.data_as_of !== null && typeof value.data_as_of !== "string") || typeof value.data_source_status !== "string") return false
  if (![value.period, value.period_start, value.period_end, value.denominator, value.blocked_reason].every((item) => item === null || typeof item === "string")) return false
  if (!Array.isArray(value.cycles) || value.cycles.length > 19 || !value.cycles.every((cycle) => typeof cycle === "string" && /^\d+$/.test(cycle))) return false
  if (!Array.isArray(value.quality_flags) || value.quality_flags.length > 32 || !value.quality_flags.every((flag) => typeof flag === "string")) return false
  const baseValid = typeof value.metabase_call_made === "boolean" && typeof value.provider_call_made === "boolean"
    && isSafePlan(value.analysis_plan) && isSafeTable(value.table) && isSafeChart(value.chart, value.table)
  if (!baseValid || !hasExactFields(value, COMPOSITE_RESPONSE_FIELDS)) return baseValid
  if (!Array.isArray(value.sections) || value.sections.length < 2 || value.sections.length > 4 || !value.sections.every(isSafeSection)) return false
  const sections = value.sections as Array<Record<string, unknown>>
  const domains = sections.map((section) => String(section.domain))
  if (new Set(domains).size !== domains.length || !isSafeFreshness(value.freshness, domains)) return false
  return Array.isArray(value.charts) && value.charts.length <= 4 && value.charts.every((chart) => isSafePanelChart(chart, sections))
}

export async function POST(request: NextRequest) {
  const environment = (process.env.MFMS_ENV ?? process.env.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  if (!new Set(["preview", "uat"]).has(environment)) return safeError(403, "MFMS Intelligence is available only in Preview.")
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > MAX_REQUEST_BYTES) return safeError(413, "The request is too large.")
  const rawPayload: unknown = await request.json().catch(() => null)
  if (!isRecord(rawPayload)) return safeError(400, "A valid JSON question is required.")
  const fields = Object.keys(rawPayload); const question = rawPayload.question
  if (fields.length !== 1 || fields[0] !== "question" || typeof question !== "string") return safeError(400, "Only the question field is accepted.")
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion || normalizedQuestion.length > MAX_QUESTION_CHARACTERS) return safeError(422, `Question must contain 1 to ${MAX_QUESTION_CHARACTERS} characters.`)

  const authHeader = getBasicAuthHeader()
  if (!authHeader) return safeError(503, "The Preview backend is not configured.")
  const target = new URL(`${getApiBaseUrl()}/api/intelligence/ask`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "POST", target })
  } catch (error) {
    const code = error instanceof MfmsAdminIdentityError ? error.status : 503
    return safeError(code, "An authenticated Preview session is required.")
  }
  try {
    const response = await fetch(target, {
      method: "POST", headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json", ...actorHeaders },
      body: JSON.stringify({ question: normalizedQuestion }), cache: "no-store", signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!isSafeResponse(payload)) return safeError(502, "MFMS Intelligence returned an invalid response.")
    return NextResponse.json(payload, { status: response.status, headers: NO_STORE_HEADERS })
  } catch {
    return safeError(503, "MFMS Intelligence is temporarily unavailable.")
  }
}
