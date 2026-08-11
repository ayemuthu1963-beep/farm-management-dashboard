import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"
import { WELL_WATER_SYNC_FAILURE_MESSAGE } from "@/lib/well-water-sync"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SYNC_PROXY_TIMEOUT_MS = 130_000
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }
export async function POST(request: NextRequest) {
  const safetyErrors = getAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length) {
    return NextResponse.json(
      { status: "failed", message: safetyErrors.join(" ") },
      { status: 403, headers: NO_STORE_HEADERS },
    )
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json(
      { status: "failed", message: "Well Water API credentials are not configured." },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }

  const target = new URL(`${getApiBaseUrl()}/api/admin/well-water/sync`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "POST", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ status: "failed", message }, { status, headers: NO_STORE_HEADERS })
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...actorHeaders,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SYNC_PROXY_TIMEOUT_MS),
    })
    const payload = await response.json().catch(() => null)

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { status: "failed", message: WELL_WATER_SYNC_FAILURE_MESSAGE },
        { status: response.ok ? 502 : response.status, headers: NO_STORE_HEADERS },
      )
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return NextResponse.json(
      { status: "failed", message: WELL_WATER_SYNC_FAILURE_MESSAGE },
      { status: timedOut ? 504 : 503, headers: NO_STORE_HEADERS },
    )
  }
}
