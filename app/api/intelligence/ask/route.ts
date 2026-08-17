import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_QUESTION_CHARACTERS = 500
const MAX_REQUEST_BYTES = 4096
const PROXY_TIMEOUT_MS = 20_000
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }
const TOP10_ROW_FIELDS = ["average_nuts_per_harvested_record", "harvest_records", "plot", "quality_flags", "rank", "total_bunches", "total_nuts", "tree_no"]

function safeError(status: number, message: string) {
  return NextResponse.json({
    answer: "", status: "failed_closed", data_as_of: null, period: null, cycles: [],
    denominator: null, quality_flags: [], table_rows: [], blocked_reason: message,
    metabase_call_made: false, provider_call_made: false,
  }, { status, headers: NO_STORE_HEADERS })
}

function isSafeTableRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  if (JSON.stringify(Object.keys(row).toSorted()) !== JSON.stringify(TOP10_ROW_FIELDS)) return false
  return typeof row.rank === "number"
    && Number.isInteger(row.rank)
    && typeof row.tree_no === "string"
    && typeof row.plot === "string"
    && typeof row.total_nuts === "number"
    && Number.isInteger(row.total_nuts)
    && typeof row.total_bunches === "number"
    && Number.isInteger(row.total_bunches)
    && typeof row.harvest_records === "number"
    && Number.isInteger(row.harvest_records)
    && typeof row.average_nuts_per_harvested_record === "string"
    && Array.isArray(row.quality_flags)
    && row.quality_flags.every((flag) => typeof flag === "string")
}

function isSafeResponse(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const expected = ["answer", "blocked_reason", "cycles", "data_as_of", "denominator", "metabase_call_made", "period", "provider_call_made", "quality_flags", "status", "table_rows"]
  if (JSON.stringify(Object.keys(value).toSorted()) !== JSON.stringify(expected)) return false
  const response = value as Record<string, unknown>
  return typeof response.answer === "string"
    && typeof response.status === "string"
    && (typeof response.data_as_of === "string" || response.data_as_of === null)
    && (typeof response.period === "string" || response.period === null)
    && Array.isArray(response.cycles)
    && response.cycles.every((cycle) => typeof cycle === "string" || typeof cycle === "number")
    && (typeof response.denominator === "string" || response.denominator === null)
    && Array.isArray(response.quality_flags)
    && response.quality_flags.every((flag) => typeof flag === "string")
    && Array.isArray(response.table_rows)
    && response.table_rows.length <= 10
    && response.table_rows.every(isSafeTableRow)
    && (typeof response.blocked_reason === "string" || response.blocked_reason === null)
    && typeof response.metabase_call_made === "boolean"
    && typeof response.provider_call_made === "boolean"
}

export async function POST(request: NextRequest) {
  const environment = (process.env.MFMS_ENV ?? process.env.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  if (!new Set(["preview", "uat"]).has(environment)) return safeError(403, "MFMS Intelligence is available only in Preview.")
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > MAX_REQUEST_BYTES) return safeError(413, "The request is too large.")
  const rawPayload: unknown = await request.json().catch(() => null)
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return safeError(400, "A valid JSON question is required.")
  const fields = Object.keys(rawPayload)
  const question = (rawPayload as { question?: unknown }).question
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
      method: "POST",
      headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json", ...actorHeaders },
      body: JSON.stringify({ question: normalizedQuestion }), cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!isSafeResponse(payload)) return safeError(502, "MFMS Intelligence returned an invalid response.")
    return NextResponse.json(payload, { status: response.status, headers: NO_STORE_HEADERS })
  } catch {
    return safeError(503, "MFMS Intelligence is temporarily unavailable.")
  }
}
