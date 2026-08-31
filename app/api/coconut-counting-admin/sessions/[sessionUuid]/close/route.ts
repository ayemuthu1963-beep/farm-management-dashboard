import { NextRequest, NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import {
  getAuthenticatedUserAssertionHeaders,
  MfmsAdminIdentityError,
} from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ sessionUuid: string }> }

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: NO_STORE_HEADERS },
  )
}

export async function POST(request: NextRequest, context: RouteContext) {
  let apiBaseUrl: string
  try {
    apiBaseUrl = getApiBaseUrl()
  } catch {
    return errorResponse("MFMS backend routing is not configured for this website.", 503)
  }

  const safetyErrors = getAdminTargetSafetyErrors(process.env, apiBaseUrl)
  if (safetyErrors.length) return errorResponse(safetyErrors.join(" "), 403)

  const serviceAuthorization = getBasicAuthHeader()
  if (!serviceAuthorization) {
    return errorResponse("MFMS backend credentials are not configured for this website.", 503)
  }

  const { sessionUuid } = await context.params
  if (!SESSION_UUID_PATTERN.test(sessionUuid)) {
    return errorResponse("A valid Coconut Counting session UUID is required.", 400)
  }

  const target = new URL(
    `${apiBaseUrl}/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}/close`,
  )
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({
      requestHeaders: request.headers,
      method: "POST",
      target,
    })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message =
      error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return errorResponse(message, status)
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: serviceAuthorization,
        Accept: "application/json",
        ...actorHeaders,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const responseText = await response.text()
    return new Response(responseText, {
      status: response.status,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return errorResponse(
      timedOut
        ? "The Coconut Counting close request timed out."
        : "The Coconut Counting service is unavailable.",
      timedOut ? 504 : 503,
    )
  }
}
