import { NextRequest, NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ sessionUuid: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, error: "MFMS backend credentials are not configured for this website." }, { status: 500 })
  }

  const { sessionUuid } = await context.params
  if (!sessionUuid) return NextResponse.json({ ok: false, error: "Session UUID is required." }, { status: 400 })

  const target = new URL(`${getApiBaseUrl()}/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}/close`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "POST", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ ok: false, error: message, detail: message }, { status })
  }

  const response = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: request.headers.get("accept") ?? "application/json",
        "Content-Type": "application/json",
        ...actorHeaders,
      },
      body: JSON.stringify({ session_uuid: sessionUuid }),
      cache: "no-store",
    },
  )

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => ({ ok: false, error: `Coconut Counting service returned ${response.status}.` }))
    return NextResponse.json(body, { status: response.status })
  }
  return NextResponse.json(
    { ok: false, error: (await response.text()).trim() || `Coconut Counting service returned ${response.status}.` },
    { status: response.status },
  )
}
