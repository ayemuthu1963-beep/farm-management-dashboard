import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getPreviewAdminTargetSafetyErrors, getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ path?: string[] }>
}

const allowedPaths = [
  /^rounds$/,
  /^template$/,
  /^import\/(validate|apply)$/,
  /^rounds\/\d+\/(source|coverage)$/,
  /^rounds\/\d+\/reverse$/,
  /^observations\/\d+$/,
]

function errorMessage(detail: unknown, fallback: string): string {
  return detail && typeof detail === "object" && typeof (detail as { detail?: unknown }).detail === "string"
    ? (detail as { detail: string }).detail
    : fallback
}

async function proxy(request: Request, context: RouteContext) {
  const method = request.method.toUpperCase()
  const safetyErrors = method === "GET"
    ? getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
    : getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length > 0) return NextResponse.json({ ok: false, errors: safetyErrors }, { status: 403 })

  const path = (await context.params).path?.join("/") ?? "rounds"
  if (!allowedPaths.some((pattern) => pattern.test(path))) {
    return NextResponse.json({ ok: false, errors: ["Unsupported bunch-tying administrator operation."] }, { status: 404 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) return NextResponse.json({ ok: false, errors: ["Harvest API credentials are not configured."] }, { status: 500 })

  const incomingUrl = new URL(request.url)
  const target = new URL(`${getApiBaseUrl()}/api/coconut-bunch-tying/${path}${incomingUrl.search}`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method, target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 500
    return NextResponse.json({ ok: false, errors: [error instanceof Error ? error.message : "Administrator identity is unavailable."] }, { status })
  }

  const headers = new Headers({ Authorization: authHeader, Accept: request.headers.get("accept") ?? "application/json", ...actorHeaders })
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)

  try {
    const response = await fetch(target, {
      method,
      headers,
      body: method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })
    const responseType = response.headers.get("content-type") ?? "application/octet-stream"
    if (!response.ok) {
      const data = responseType.includes("application/json") ? await response.json().catch(() => ({})) : {}
      return NextResponse.json({ ok: false, errors: [errorMessage(data, `Harvest API returned ${response.status}.`)] }, { status: response.status })
    }
    const responseHeaders = new Headers({ "Content-Type": responseType, "Cache-Control": "no-store" })
    const disposition = response.headers.get("content-disposition")
    if (disposition) responseHeaders.set("Content-Disposition", disposition)
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers: responseHeaders })
  } catch (error) {
    return NextResponse.json({ ok: false, errors: [error instanceof Error ? error.message : "Unable to reach the bunch-tying service."] }, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
