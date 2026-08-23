import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }
const RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function safeError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS })
}

async function readLimitedBody(response: Response): Promise<Uint8Array | null> {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > RESPONSE_LIMIT_BYTES) {
      await reader.cancel("Analyzer response exceeds the configured limit.")
      return null
    }
    chunks.push(value)
  }
  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function safeString(value: unknown, max = 2000): value is string {
  return typeof value === "string" && value.length <= max
}

function safeNullableString(value: unknown, max = 2000): boolean {
  return value === null || safeString(value, max)
}

function isSafeSource(value: unknown): boolean {
  if (!isRecord(value)) return false
  return safeString(value.source_name, 80)
    && safeNullableString(value.source_timestamp, 80)
    && safeNullableString(value.data_period_start, 20)
    && safeNullableString(value.data_period_end, 20)
    && ["complete", "partial", "no_data", "not_configured", "unavailable"].includes(String(value.completeness_status))
    && isRecord(value.units)
    && Object.entries(value.units).every(([key, unit]) => key.length <= 120 && safeString(unit, 80))
    && isRecord(value.calculated_metrics)
    && Array.isArray(value.missing_data_warnings)
    && value.missing_data_warnings.length <= 20
    && value.missing_data_warnings.every((warning) => safeString(warning, 300))
}

function isSafeEvidenceValue(value: unknown): boolean {
  if (!isRecord(value)) return false
  return safeString(value.name, 120)
    && (value.value === null || typeof value.value === "string" || typeof value.value === "number" || typeof value.value === "boolean")
    && safeString(value.unit, 80)
    && safeString(value.source_name, 80)
}

function isSafeSourceReference(value: unknown): boolean {
  if (!isRecord(value)) return false
  return safeString(value.source_name, 80)
    && Array.isArray(value.record_ids)
    && value.record_ids.length <= 50
    && value.record_ids.every((id) => safeString(id, 128))
    && safeNullableString(value.source_timestamp, 80)
}

function isSafeAiUsage(value: unknown): boolean {
  if (!isRecord(value)) return false
  return [value.input_tokens, value.output_tokens, value.total_tokens, value.estimated_cost_microusd, value.provider_attempts]
    .every((item) => Number.isInteger(item) && Number(item) >= 0)
    && safeString(value.estimated_cost_usd, 32)
    && /^\d+\.\d{6}$/.test(String(value.estimated_cost_usd))
    && typeof value.cache_hit === "boolean"
}

function isSafeAlert(value: unknown): boolean {
  if (!isRecord(value)) return false
  const severity = String(value.severity)
  const completeness = String(value.data_completeness_status)
  const confidence = String(value.confidence)
  return safeString(value.alert_id, 180)
    && safeString(value.rule_id, 120)
    && safeString(value.rule_version, 80)
    && ["information", "warning", "critical"].includes(severity)
    && [value.crop, value.plot, value.zone, value.tree, value.start_date, value.end_date, value.ai_explanation, value.model_name, value.prompt_version].every((item) => safeNullableString(item, 1000))
    && safeString(value.title, 300)
    && safeString(value.deterministic_condition, 1000)
    && Array.isArray(value.evidence_values)
    && value.evidence_values.length <= 30
    && value.evidence_values.every(isSafeEvidenceValue)
    && Array.isArray(value.source_records)
    && value.source_records.length <= 12
    && value.source_records.every(isSafeSourceReference)
    && isRecord(value.source_timestamps)
    && ["complete", "partial", "no_data", "not_configured", "unavailable"].includes(completeness)
    && ["low", "medium", "high"].includes(confidence)
    && Array.isArray(value.suggested_field_checks)
    && value.suggested_field_checks.length <= 5
    && value.suggested_field_checks.every((check) => safeString(check, 300))
    && safeString(value.generation_timestamp, 80)
    && safeString(value.deterministic_fallback_explanation, 2000)
    && safeString(value.evidence_hash, 128)
    && (value.ai_usage === null || isSafeAiUsage(value.ai_usage))
}

function isSafeGenerationResult(value: unknown): boolean {
  if (!isRecord(value)) return false
  return ["generated", "cache_hit", "disabled", "blocked", "fallback"].includes(String(value.status))
    && isSafeAlert(value.alert)
    && typeof value.provider_call_made === "boolean"
    && safeNullableString(value.reason_code, 120)
}

function isSafeAnalyzerResponse(value: unknown): boolean {
  if (!isRecord(value)) return false
  const counts = value.alert_counts
  return safeString(value.generated_at, 80)
    && ["normal", "attention", "critical", "data_incomplete"].includes(String(value.farm_status))
    && isRecord(counts)
    && ["information", "warning", "critical"].every((severity) => Number.isInteger(counts[severity]) && Number(counts[severity]) >= 0)
    && Array.isArray(value.sources)
    && value.sources.length === 8
    && value.sources.every(isSafeSource)
    && Array.isArray(value.alerts)
    && value.alerts.length <= 1000
    && value.alerts.every(isSafeAlert)
    && safeString(value.deterministic_rules_version, 80)
    && typeof value.ai_enabled === "boolean"
    && safeNullableString(value.ai_model, 120)
    && safeString(value.prompt_version, 120)
    && value.read_only === true
}

export async function GET(request: NextRequest) {
  const environment = (process.env.MFMS_ENV ?? process.env.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  if (!new Set(["preview", "uat"]).has(environment)) return safeError(403, "AI Farm Analyzer is available only in Preview.")
  const authHeader = getBasicAuthHeader()
  if (!authHeader) return safeError(503, "The Preview backend is not configured.")
  const target = new URL(`${getApiBaseUrl()}/api/ai-analyzer`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "GET", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    return safeError(status, "An authenticated Preview session is required.")
  }
  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json", ...actorHeaders },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const contentLength = Number(response.headers.get("content-length") ?? "0")
    if (Number.isFinite(contentLength) && contentLength > RESPONSE_LIMIT_BYTES) return safeError(502, "AI Farm Analyzer returned an oversized response.")
    const responseBody = await readLimitedBody(response)
    if (!responseBody) return safeError(502, "AI Farm Analyzer returned an oversized response.")
    let payload: unknown = null
    try {
      payload = JSON.parse(new TextDecoder().decode(responseBody))
    } catch {
      payload = null
    }
    if (!response.ok) return safeError(response.status, "AI Farm Analyzer is temporarily unavailable.")
    if (!isSafeAnalyzerResponse(payload)) return safeError(502, "AI Farm Analyzer returned an invalid response.")
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS })
  } catch {
    return safeError(503, "AI Farm Analyzer is temporarily unavailable.")
  }
}

export async function POST(request: NextRequest) {
  const environment = (process.env.MFMS_ENV ?? process.env.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  if (!new Set(["preview", "uat"]).has(environment)) return safeError(403, "AI Farm Analyzer is available only in Preview.")
  const authHeader = getBasicAuthHeader()
  if (!authHeader) return safeError(503, "The Preview backend is not configured.")

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return safeError(400, "A valid alert request is required.")
  }
  if (!isRecord(requestBody)
    || Object.keys(requestBody).some((key) => !["alert_id", "evidence_hash"].includes(key))
    || !safeString(requestBody.alert_id, 180)
    || !safeString(requestBody.evidence_hash, 128)
    || !/^[a-f0-9]{64}$/i.test(requestBody.evidence_hash)) {
    return safeError(400, "A valid single-alert generation request is required.")
  }

  const target = new URL(`${getApiBaseUrl()}/api/ai-analyzer/alerts/${encodeURIComponent(requestBody.alert_id)}/explanation`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "POST", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    return safeError(status, "An authenticated Preview session is required.")
  }
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json", ...actorHeaders },
      body: JSON.stringify({ evidence_hash: requestBody.evidence_hash }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    })
    const contentLength = Number(response.headers.get("content-length") ?? "0")
    if (Number.isFinite(contentLength) && contentLength > RESPONSE_LIMIT_BYTES) return safeError(502, "AI Farm Analyzer returned an oversized response.")
    const responseBody = await readLimitedBody(response)
    if (!responseBody) return safeError(502, "AI Farm Analyzer returned an oversized response.")
    let payload: unknown = null
    try {
      payload = JSON.parse(new TextDecoder().decode(responseBody))
    } catch {
      payload = null
    }
    if (!response.ok) return safeError(response.status, "AI explanation is temporarily unavailable.")
    if (!isSafeGenerationResult(payload)) return safeError(502, "AI Farm Analyzer returned an invalid explanation response.")
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS })
  } catch {
    return safeError(503, "AI explanation is temporarily unavailable.")
  }
}
