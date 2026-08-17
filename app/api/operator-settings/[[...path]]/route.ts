import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

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
    ? suffix === ""
    : /^motors\/M[1-3]$/.test(suffix)
      || /^irrigation-targets\/(P1W|P1E|P2W|P2E|JF|NM)$/.test(suffix)
      || /^irrigation-plan\/(drip-output|motor-run-schedule)$/.test(suffix)

  if (!allowed) return errorResponse("Operator settings path was not found.", 404)

  const authHeader = getBasicAuthHeader()
  if (!authHeader) return errorResponse("Harvest API credentials are not configured.", 500)

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/operator-settings${suffix ? `/${suffix}` : ""}`, {
      method,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      body: method === "PUT" ? await request.text() : undefined,
    })
    const responseText = await response.text()
    return new Response(responseText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    })
  } catch {
    return errorResponse("Operator settings service is unavailable.", 502)
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, context, "GET")
}

export async function PUT(request: Request, context: RouteContext) {
  return proxy(request, context, "PUT")
}
