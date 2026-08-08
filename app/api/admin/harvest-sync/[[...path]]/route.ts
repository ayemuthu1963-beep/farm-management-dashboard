import { createHmac } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isPreviewWriteEnabled(): boolean {
  return getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl()).length === 0
}

function isManualImportRuntimeEnabled(): boolean {
  return (process.env.HARVEST_MANUAL_IMPORT_ENABLED ?? "").trim().toLowerCase() === "true"
}

function isManualCorrectionRuntimeEnabled(): boolean {
  return (process.env.HARVEST_MANUAL_CORRECTION_ENABLED ?? "").trim().toLowerCase() === "true"
}

type RouteContext = { params: Promise<{ path?: string[] }> }

const AUTHENTICATED_USER_HEADER = "X-MFMS-Authenticated-User"
const AUTHENTICATED_USER_TIMESTAMP_HEADER = "X-MFMS-Authenticated-User-Timestamp"
const AUTHENTICATED_USER_SIGNATURE_HEADER = "X-MFMS-Authenticated-User-Signature"

function getAuthenticatedPreviewUsername(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")
  const match = authorization?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i)
  if (!match) return null

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator <= 0) return null
    const username = decoded.slice(0, separator)
    if (
      username.length > 128 ||
      /[\u0000-\u001f\u007f]/.test(username)
    ) {
      return null
    }
    return username
  } catch {
    return null
  }
}

function getAuthenticatedUserAssertionHeaders(
  request: NextRequest,
  method: "GET" | "POST",
  target: URL,
): Record<string, string> {
  const username = getAuthenticatedPreviewUsername(request)
  const signingSecret = process.env.HARVEST_API_PASSWORD
  if (!username || !signingSecret) return {}

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const canonical = [
    timestamp,
    method,
    `${target.pathname}${target.search}`,
    username,
  ].join("\n")
  const signature = createHmac("sha256", signingSecret)
    .update(canonical, "utf8")
    .digest("hex")

  return {
    [AUTHENTICATED_USER_HEADER]: username,
    [AUTHENTICATED_USER_TIMESTAMP_HEADER]: timestamp,
    [AUTHENTICATED_USER_SIGNATURE_HEADER]: signature,
  }
}

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST") {
  if (!isPreviewWriteEnabled()) {
    return NextResponse.json({ ok: false, error: "Harvest manual review is not enabled for this MFMS environment." }, { status: 403 })
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
  const requestBody =
    method === "POST" ? JSON.stringify(await request.json().catch(() => ({}))) : undefined
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: request.headers.get("accept") ?? "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...getAuthenticatedUserAssertionHeaders(request, method, url),
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
