import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

interface RouteContext {
  params: Promise<{ path: string[] }>
}

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params
  const url = new URL(request.url)
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const body = request.method === "GET" ? undefined : await request.text()
    const response = await fetch(`${getApiBaseUrl()}/api/inventory/${path.join("/")}${url.search}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    })

    const payload = await response.json()

    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to reach Inventory API",
      },
      { status: 503 },
    )
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export async function POST(request: Request, context: RouteContext) {
  return proxy(request, context)
}
