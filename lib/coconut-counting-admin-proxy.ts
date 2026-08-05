import { createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }
const MAX_ADMIN_EDIT_BYTES = 64 * 1024
const AUTHENTICATED_USER_HEADER = "X-MFMS-Authenticated-User"
const AUTHENTICATED_USER_TIMESTAMP_HEADER = "X-MFMS-Authenticated-User-Timestamp"
const AUTHENTICATED_USER_SIGNATURE_HEADER = "X-MFMS-Authenticated-User-Signature"
const PREVIEW_BACKEND_HOSTS = new Set(["preview.muthufarms.com", "harvest-api-pilot", "127.0.0.1", "localhost"])

function getAuthenticatedPreviewUsername(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")
  const match = authorization?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i)
  if (!match) return null
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator <= 0 || separator === decoded.length - 1) return null
    const username = decoded.slice(0, separator)
    const suppliedPassword = decoded.slice(separator + 1)
    const expectedPassword = process.env.HARVEST_API_PASSWORD ?? ""
    if (username.length > 128 || /[\u0000-\u001f\u007f]/.test(username)) return null
    const suppliedBuffer = Buffer.from(suppliedPassword, "utf8")
    const expectedBuffer = Buffer.from(expectedPassword, "utf8")
    if (!expectedPassword || suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null
    return username
  } catch {
    return null
  }
}

function getCoconutCountingAdminSafetyErrors(request: NextRequest): string[] {
  const errors: string[] = []
  const mfmsEnvironment = (process.env.MFMS_ENV ?? "").trim().toLowerCase()
  const vercelEnvironment = (process.env.VERCEL_ENV ?? "").trim().toLowerCase()
  if (mfmsEnvironment && !["preview", "uat"].includes(mfmsEnvironment)) {
    errors.push("Coconut Counting admin edits are restricted to Preview/UAT.")
  }
  if (vercelEnvironment && vercelEnvironment !== "preview") {
    errors.push("Coconut Counting admin edits are disabled outside Vercel Preview.")
  }
  if (!mfmsEnvironment && !vercelEnvironment) {
    errors.push("Preview/UAT environment identity is not configured.")
  }

  try {
    const target = new URL(getApiBaseUrl())
    if (target.username || target.password || !PREVIEW_BACKEND_HOSTS.has(target.hostname.toLowerCase())) {
      errors.push("The configured Coconut Counting backend is not an approved Preview target.")
    }
  } catch {
    errors.push("The configured Coconut Counting backend URL is invalid.")
  }

  const origin = request.headers.get("origin")
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) errors.push("Cross-site admin edits are not allowed.")
    } catch {
      errors.push("The admin edit request origin is invalid.")
    }
  }
  return errors
}

function authenticatedUserAssertionHeaders(username: string, target: URL): Record<string, string> {
  const signingSecret = process.env.HARVEST_API_PASSWORD
  if (!signingSecret) return {}
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const canonical = [timestamp, "PATCH", `${target.pathname}${target.search}`, username].join("\n")
  const signature = createHmac("sha256", signingSecret).update(canonical, "utf8").digest("hex")
  return {
    [AUTHENTICATED_USER_HEADER]: username,
    [AUTHENTICATED_USER_TIMESTAMP_HEADER]: timestamp,
    [AUTHENTICATED_USER_SIGNATURE_HEADER]: signature,
  }
}

export async function proxyCoconutCountingAdminPatch(request: NextRequest, backendPath: string) {
  const safetyErrors = getCoconutCountingAdminSafetyErrors(request)
  if (safetyErrors.length) {
    return NextResponse.json({ ok: false, errors: safetyErrors, message: "No database write was performed." }, { status: 403, headers: NO_STORE_HEADERS })
  }

  const username = getAuthenticatedPreviewUsername(request)
  if (!username) {
    return NextResponse.json({ ok: false, errors: ["Preview authentication is required."], message: "No database write was performed." }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, errors: ["MFMS backend credentials are not configured."], message: "No database write was performed." }, { status: 500, headers: NO_STORE_HEADERS })
  }

  const rawBody = await request.text()
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_ADMIN_EDIT_BYTES) {
    return NextResponse.json({ ok: false, errors: ["The admin edit request is empty or too large."], message: "No database write was performed." }, { status: 413, headers: NO_STORE_HEADERS })
  }
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid")
  } catch {
    return NextResponse.json({ ok: false, errors: ["The admin edit request must be a JSON object."], message: "No database write was performed." }, { status: 400, headers: NO_STORE_HEADERS })
  }

  const target = new URL(`${getApiBaseUrl()}${backendPath}`)
  try {
    const response = await fetch(target, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authenticatedUserAssertionHeaders(username, target),
      },
      cache: "no-store",
      body: rawBody,
      signal: AbortSignal.timeout(20_000),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: false, errors: [`MFMS backend returned HTTP ${response.status}.`], message: "The edit result could not be verified." }, { status: response.ok ? 502 : response.status, headers: NO_STORE_HEADERS })
    }
    return NextResponse.json(payload, { status: response.status, headers: NO_STORE_HEADERS })
  } catch {
    return NextResponse.json({ ok: false, errors: ["The Preview Coconut Counting service is unavailable."], message: "No database write was confirmed." }, { status: 503, headers: NO_STORE_HEADERS })
  }
}
