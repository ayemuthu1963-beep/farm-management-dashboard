import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ cycle: string; plot: string }> }

function writesEnabled(): boolean {
  const flag = (process.env.MFMS_HARVEST_CYCLE_WRITES_ENABLED ?? "").trim().toLowerCase()
  return flag === "true" && getAdminTargetSafetyErrors(process.env, getApiBaseUrl()).length === 0
}

function parseInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null
  return value
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!writesEnabled()) {
    return NextResponse.json(
      { error: "Harvested total writes are not enabled for this MFMS environment." },
      { status: 403 },
    )
  }

  const { cycle: cycleParam, plot: plotParam } = await context.params
  const cycle = Number(cycleParam)
  const plot = Number(plotParam)
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > 100) {
    return NextResponse.json({ error: "Harvest cycle must be an integer from 1 to 100." }, { status: 400 })
  }
  if (plot !== 1 && plot !== 2) {
    return NextResponse.json({ error: "Plot must be 1 or 2." }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as {
    harvested_nuts?: unknown
    expected_revision?: unknown
    reason?: unknown
  } | null
  const harvestedNuts = parseInteger(body?.harvested_nuts)
  const expectedRevision = parseInteger(body?.expected_revision)
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
  if (harvestedNuts === null || harvestedNuts < 0) {
    return NextResponse.json({ error: "Harvested must be a non-negative whole number." }, { status: 400 })
  }
  if (expectedRevision === null || expectedRevision < 0) {
    return NextResponse.json({ error: "Expected revision must be a non-negative whole number." }, { status: 400 })
  }
  if (expectedRevision > 0 && !reason) {
    return NextResponse.json({ error: "A reason is required when correcting an existing Harvested total." }, { status: 400 })
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: "Correction reason must be 500 characters or fewer." }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured." }, { status: 500 })
  }

  const target = new URL(
    `${getApiBaseUrl()}/api/coconut-counting/cycles/${cycle}/plots/${plot}/harvested`,
  )
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({
      requestHeaders: request.headers,
      method: "PATCH",
      target,
    })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ error: message }, { status })
  }

  try {
    const response = await fetch(target, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...actorHeaders,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        harvested_nuts: harvestedNuts,
        expected_revision: expectedRevision,
        reason: reason || null,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = typeof payload.detail === "string" ? payload.detail : `Harvest API returned ${response.status}.`
      return NextResponse.json({ error }, { status: response.status })
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "The Harvested total update timed out."
      : "The Harvested total could not be saved."
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
