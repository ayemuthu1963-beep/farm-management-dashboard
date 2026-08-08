import { createHmac } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { isBeetleTrapManualSyncAvailable } from "@/lib/beetle-sync-availability"
import { beetleTrapSyncErrorMessage } from "@/lib/beetle-sync"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SYNC_PROXY_TIMEOUT_MS = 130_000
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }
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
    if (separator <= 0 || separator === decoded.length - 1) return null
    const username = decoded.slice(0, separator)
    if (username.length > 128 || /[\u0000-\u001f\u007f]/.test(username)) return null
    return username
  } catch {
    return null
  }
}

function getAuthenticatedUserAssertionHeaders(username: string, target: URL): Record<string, string> {
  const signingSecret = process.env.HARVEST_API_PASSWORD
  if (!signingSecret) return {}

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const canonical = [timestamp, "POST", `${target.pathname}${target.search}`, username].join("\n")
  const signature = createHmac("sha256", signingSecret).update(canonical, "utf8").digest("hex")
  return {
    [AUTHENTICATED_USER_HEADER]: username,
    [AUTHENTICATED_USER_TIMESTAMP_HEADER]: timestamp,
    [AUTHENTICATED_USER_SIGNATURE_HEADER]: signature,
  }
}

export async function POST(request: NextRequest) {
  if (
    !isBeetleTrapManualSyncAvailable() ||
    getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl()).length > 0
  ) {
    return NextResponse.json(
      { status: "failed", message: "Beetle Trap ODK sync is not enabled for this MFMS environment." },
      { status: 403, headers: NO_STORE_HEADERS },
    )
  }

  const authenticatedUsername = getAuthenticatedPreviewUsername(request)
  if (!authenticatedUsername) {
    return NextResponse.json(
      { status: "failed", message: "MFMS administrator authentication is required." },
      { status: 401, headers: NO_STORE_HEADERS },
    )
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json(
      { status: "failed", message: "Beetle Trap API credentials are not configured." },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }

  try {
    const target = new URL(`${getApiBaseUrl()}/api/admin/beetle-trap/sync`)
    const response = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...getAuthenticatedUserAssertionHeaders(authenticatedUsername, target),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SYNC_PROXY_TIMEOUT_MS),
    })
    const payload: unknown = await response.json().catch(() => null)

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { status: "failed", message: beetleTrapSyncErrorMessage(null) },
        { status: response.ok ? 502 : response.status, headers: NO_STORE_HEADERS },
      )
    }

    return NextResponse.json(payload, { status: response.status, headers: NO_STORE_HEADERS })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return NextResponse.json(
      { status: "failed", message: beetleTrapSyncErrorMessage(null) },
      { status: timedOut ? 504 : 503, headers: NO_STORE_HEADERS },
    )
  }
}
