import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"])

function safePath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) return null
  return segments.map(encodeURIComponent).join("/")
}

function writeSafetyErrors(method: string): string[] {
  if (!WRITE_METHODS.has(method)) return []
  return getAdminTargetSafetyErrors(process.env, getApiBaseUrl())
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const targetPath = safePath(path)
  if (!targetPath) return NextResponse.json({ detail: "Invalid Motor Runtime management path." }, { status: 400 })
  const errors = writeSafetyErrors(request.method)
  if (errors.length) return NextResponse.json({ errors }, { status: 403 })
  const authorization = getBasicAuthHeader()
  if (!authorization) return NextResponse.json({ detail: "Harvest API credentials are not configured." }, { status: 503 })

  const incoming = new URL(request.url)
  const target = new URL(`${getApiBaseUrl()}/api/motor-runtime/management/${targetPath}${incoming.search}`)
  const headers = new Headers({ Authorization: authorization, Accept: "application/json" })
  if (WRITE_METHODS.has(request.method)) {
    try {
      const actorHeaders = getAuthenticatedUserAssertionHeaders({
        requestHeaders: request.headers,
        method: request.method,
        target,
      })
      Object.entries(actorHeaders).forEach(([name, value]) => headers.set(name, value))
    } catch (error) {
      const status = error instanceof MfmsAdminIdentityError ? error.status : 503
      const detail = error instanceof Error ? error.message : "MFMS administrator authentication is required."
      return NextResponse.json({ detail }, { status })
    }
  }
  let body: BodyInit | undefined
  if (!new Set(["GET", "HEAD"]).has(request.method)) {
    const contentType = request.headers.get("content-type") ?? ""
    body = await request.arrayBuffer()
    if (contentType) headers.set("Content-Type", contentType)
  }
  try {
    const response = await fetch(
      target,
      { method: request.method, headers, body, cache: "no-store" },
    )
    const responseHeaders = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "X-Content-Type-Options": "nosniff",
    })
    return new NextResponse(response.body, { status: response.status, headers: responseHeaders })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Motor Runtime backend is unavailable." },
      { status: 502 },
    )
  }
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy
