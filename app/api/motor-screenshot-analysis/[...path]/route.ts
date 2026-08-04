import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"])

function targetSafetyErrors(method: string): string[] {
  if (!WRITE_METHODS.has(method)) return []
  const environment = (process.env.MFMS_ENV ?? "").trim().toLowerCase()
  if (environment === "preview" || environment === "uat") {
    return getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  }
  if (environment === "local" || environment === "development" || environment === "test") {
    const target = (process.env.MFMS_TARGET_DATABASE ?? "").trim().toLowerCase()
    if (["harvest", "production", "mfms_production"].includes(target)) {
      return ["Production database names are rejected for local motor screenshot writes."]
    }
    try {
      const host = new URL(getApiBaseUrl()).hostname.toLowerCase()
      if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
        return ["Local motor screenshot writes require a loopback backend."]
      }
    } catch {
      return ["Motor screenshot API base URL is invalid."]
    }
    return []
  }
  return ["Motor screenshot writes are disabled in this frontend environment."]
}

function safePath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) return null
  return segments.map(encodeURIComponent).join("/")
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const targetPath = safePath(path)
  if (!targetPath) return NextResponse.json({ detail: "Invalid motor screenshot API path." }, { status: 400 })
  const safetyErrors = targetSafetyErrors(request.method)
  if (safetyErrors.length > 0) return NextResponse.json({ errors: safetyErrors }, { status: 403 })
  const authHeader = getBasicAuthHeader()
  if (!authHeader) return NextResponse.json({ detail: "Harvest API credentials are not configured." }, { status: 503 })

  const incomingUrl = new URL(request.url)
  const target = `${getApiBaseUrl()}/api/motor-screenshot-analysis/${targetPath}${incomingUrl.search}`
  const headers = new Headers({ Authorization: authHeader, Accept: request.headers.get("accept") ?? "application/json" })
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
