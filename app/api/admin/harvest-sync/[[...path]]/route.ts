import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isManualImportRuntimeEnabled(): boolean {
  return (process.env.HARVEST_MANUAL_IMPORT_ENABLED ?? "").trim().toLowerCase() === "true"
}

function isManualCorrectionRuntimeEnabled(): boolean {
  return (process.env.HARVEST_MANUAL_CORRECTION_ENABLED ?? "").trim().toLowerCase() === "true"
}

type RouteContext = { params: Promise<{ path?: string[] }> }

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST") {
  const safetyErrors = getAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length) {
    return NextResponse.json({ ok: false, error: safetyErrors.join(" ") }, { status: 403 })
  }
  const params = await context.params
  const rawSuffix = (params.path ?? []).join("/")
  if (method === "POST" && rawSuffix === "import") {
    return NextResponse.json(
      { ok: false, error: "The legacy Harvest import route is retired. Use the controlled manual-import route." },
      { status: 410 },
    )
  }
  if (method === "POST" && rawSuffix === "manual-import" && !isManualImportRuntimeEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Manual Harvest import is locked by the frontend runtime." },
      { status: 423 },
    )
  }
  if (
    method === "POST" &&
    rawSuffix === "controlled-replacements/apply" &&
    !isManualCorrectionRuntimeEnabled()
  ) {
    return NextResponse.json(
      { ok: false, error: "Controlled Harvest corrections are locked by the frontend runtime." },
      { status: 423 },
    )
  }
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, error: "Harvest API credentials are not configured." }, { status: 500 })
  }

  const suffix = (params.path ?? []).map(encodeURIComponent).join("/")
  const url = new URL(`${getApiBaseUrl()}/api/admin/harvest-sync${suffix ? `/${suffix}` : ""}`)
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({
      requestHeaders: request.headers,
      method,
      target: url,
    })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ ok: false, error: message }, { status })
  }
  const requestBody =
    method === "POST" ? JSON.stringify(await request.json().catch(() => ({}))) : undefined
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: request.headers.get("accept") ?? "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...actorHeaders,
    },
    cache: "no-store",
    body: requestBody,
  })
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    if (method === "GET" && rawSuffix === "status") {
      const message = (await response.text()).trim()
      return NextResponse.json(
        { ok: false, error: message || `Harvest API returned ${response.status}` },
        { status: response.status },
      )
    }
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
  if (method === "GET" && rawSuffix === "status" && response.ok && body && typeof body === "object") {
    return NextResponse.json(
      {
        ...body,
        manualImportEnabled:
          isManualImportRuntimeEnabled() &&
          (body as { manualImportEnabled?: unknown }).manualImportEnabled === true,
      },
      { status: response.status },
    )
  }
  if (
    method === "GET" &&
    rawSuffix === "controlled-replacements/proposal" &&
    response.ok &&
    body &&
    typeof body === "object"
  ) {
    const bodyRecord = body as {
      proposal?: { manualCorrectionEnabled?: unknown }
      manualCorrectionEnabled?: unknown
    }
    if (bodyRecord.proposal && typeof bodyRecord.proposal === "object") {
      return NextResponse.json(
        {
          ...bodyRecord,
          proposal: {
            ...bodyRecord.proposal,
            manualCorrectionEnabled:
              isManualCorrectionRuntimeEnabled() &&
              bodyRecord.proposal.manualCorrectionEnabled === true,
          },
        },
        { status: response.status },
      )
    }
    return NextResponse.json(
      {
        ...bodyRecord,
        manualCorrectionEnabled:
          isManualCorrectionRuntimeEnabled() &&
          bodyRecord.manualCorrectionEnabled === true,
      },
      { status: response.status },
    )
  }
  return NextResponse.json(body, { status: response.status })
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET")
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST")
}
