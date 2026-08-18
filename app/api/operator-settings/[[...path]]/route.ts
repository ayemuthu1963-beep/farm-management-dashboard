import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import {
  getAuthenticatedUserAssertionHeaders,
  MfmsAdminIdentityError,
} from "@/lib/mfms-admin-identity"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ path?: string[] }> }

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function proxy(request: Request, context: RouteContext, method: "GET" | "PUT") {
  const { path = [] } = await context.params
  const suffix = path.join("/")
  const allowed = method === "GET"
    ? suffix === "" || /^irrigation-plan\/(drip-output|motor-run-schedule)$/.test(suffix)
    : /^motors\/M[1-3]$/.test(suffix)
      || /^irrigation-targets\/(P1W|P1E|P2W|P2E|JF|NM)$/.test(suffix)
      || /^irrigation-plan\/(drip-output|motor-run-schedule)$/.test(suffix)

  if (!allowed) return errorResponse("Operator settings path was not found.", 404)

  const authHeader = getBasicAuthHeader()
  if (!authHeader) return errorResponse("Harvest API credentials are not configured.", 500)

  try {
    const target = new URL(
      `/api/operator-settings${suffix ? `/${suffix}` : ""}`,
      getApiBaseUrl(),
    )
    const authenticatedUserHeaders = method === "PUT" && suffix.startsWith("irrigation-plan/")
      ? getAuthenticatedUserAssertionHeaders({
          requestHeaders: request.headers,
          method,
          target,
        })
      : {}
    const response = await fetch(target, {
      method,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...authenticatedUserHeaders,
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      body: method === "PUT" ? await request.text() : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    const responseText = await response.text()
    return new Response(responseText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    })
  } catch (error) {
    if (error instanceof MfmsAdminIdentityError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(
      error instanceof Error ? error.message : "Operator settings service is unavailable.",
      502,
    )
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, context, "GET")
}

export async function PUT(request: Request, context: RouteContext) {
  return proxy(request, context, "PUT")
}
