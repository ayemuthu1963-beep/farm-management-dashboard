import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isPreviewWriteEnabled(): boolean {
  const publicEnv = (process.env.NEXT_PUBLIC_MFMS_ENV ?? "").toLowerCase()
  const appEnv = (process.env.MFMS_ENV ?? "").toLowerCase()
  if (publicEnv === "production" || appEnv === "production") return false
  return publicEnv === "preview" || publicEnv === "uat" || appEnv === "preview" || appEnv === "uat"
}

type RouteContext = { params: Promise<{ path?: string[] }> | { path?: string[] } }

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST") {
  if (!isPreviewWriteEnabled()) {
    return NextResponse.json({ ok: false, error: "Harvest ODK Sync is enabled only for Preview." }, { status: 403 })
  }
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, error: "Harvest API credentials are not configured." }, { status: 500 })
  }

  const params = await context.params
  const suffix = (params.path ?? []).map(encodeURIComponent).join("/")
  const url = new URL(`${getApiBaseUrl()}/api/admin/harvest-sync${suffix ? `/${suffix}` : ""}`)
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: request.headers.get("accept") ?? "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    body: method === "POST" ? JSON.stringify(await request.json().catch(() => ({}))) : undefined,
  })
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        ...(response.headers.get("content-disposition")
          ? { "Content-Disposition": response.headers.get("content-disposition")! }
          : {}),
        ...(response.headers.get("x-content-sha256")
          ? { "X-Content-SHA256": response.headers.get("x-content-sha256")! }
          : {}),
      },
    })
  }
  const body = await response.json().catch(() => ({ ok: false, error: `Harvest API returned ${response.status}` }))
  return NextResponse.json(body, { status: response.status })
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET")
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST")
}
