import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"])

function safePath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) return null
  return segments.map(encodeURIComponent).join("/")
}

function writeSafetyErrors(method: string): string[] {
  if (!WRITE_METHODS.has(method)) return []
  const environment = (process.env.MFMS_ENV ?? "").trim().toLowerCase()
  if (["preview", "uat"].includes(environment)) {
    return getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  }
  if (["local", "development", "test"].includes(environment)) {
    const target = (process.env.MFMS_TARGET_DATABASE ?? "").trim().toLowerCase()
    if (["harvest", "production", "mfms_production"].includes(target)) {
      return ["Production database names are rejected for local Motor Runtime writes."]
    }
    try {
      const host = new URL(getApiBaseUrl()).hostname.toLowerCase()
      return ["127.0.0.1", "localhost", "::1"].includes(host)
        ? []
        : ["Local Motor Runtime writes require a loopback backend."]
    } catch {
      return ["Motor Runtime API base URL is invalid."]
    }
  }
  return ["Motor Runtime management writes are disabled in this frontend environment."]
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
  const headers = new Headers({ Authorization: authorization, Accept: "application/json" })
  let body: BodyInit | undefined
  if (!new Set(["GET", "HEAD"]).has(request.method)) {
    const contentType = request.headers.get("content-type") ?? ""
    body = await request.arrayBuffer()
    if (contentType) headers.set("Content-Type", contentType)
  }
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/motor-runtime/management/${targetPath}${incoming.search}`,
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
