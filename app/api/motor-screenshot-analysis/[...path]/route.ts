import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"])

function targetSafetyErrors(method: string, targetPath: string): string[] {
  if (!WRITE_METHODS.has(method)) return []
  const errors = getAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  const environment = (process.env.MFMS_ENV ?? "").trim().toLowerCase()
  if (
    ["production", "prod"].includes(environment) &&
    targetPath !== "excel-imports" &&
    !targetPath.startsWith("excel-imports/")
  ) {
    errors.push("Production permits deterministic Excel motor imports only; screenshot OCR and text writes remain disabled.")
  }
  return errors
}

function safePath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) return null
  return segments.map(encodeURIComponent).join("/")
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const targetPath = safePath(path)
  if (!targetPath) return NextResponse.json({ detail: "Invalid motor screenshot API path." }, { status: 400 })
  const safetyErrors = targetSafetyErrors(request.method, targetPath)
  if (safetyErrors.length > 0) return NextResponse.json({ errors: safetyErrors }, { status: 403 })
  const authHeader = getBasicAuthHeader()
  if (!authHeader) return NextResponse.json({ detail: "Harvest API credentials are not configured." }, { status: 503 })

  const incomingUrl = new URL(request.url)
  const target = new URL(`${getApiBaseUrl()}/api/motor-screenshot-analysis/${targetPath}${incomingUrl.search}`)
  const headers = new Headers({ Authorization: authHeader, Accept: request.headers.get("accept") ?? "application/json" })
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
    if (contentType.startsWith("multipart/form-data")) {
      body = await request.formData()
    } else {
      body = await request.arrayBuffer()
      if (contentType) headers.set("Content-Type", contentType)
    }
  }
  try {
    const response = await fetch(target, { method: request.method, headers, body, cache: "no-store" })
    const responseHeaders = new Headers({ "Cache-Control": "private, no-store" })
    const responseType = response.headers.get("content-type")
    const disposition = response.headers.get("content-disposition")
    if (responseType) responseHeaders.set("Content-Type", responseType)
    if (disposition) responseHeaders.set("Content-Disposition", disposition)
    responseHeaders.set("X-Content-Type-Options", "nosniff")
    return new NextResponse(response.body, { status: response.status, headers: responseHeaders })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Motor screenshot backend is unavailable." },
      { status: 502 },
    )
  }
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy
