import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseCycle(value: string | null): number | null {
  if (value === null || value === "") return null
  if (!/^\d{1,3}$/.test(value)) return Number.NaN
  const cycle = Number(value)
  return Number.isInteger(cycle) && cycle >= 1 && cycle <= 100 ? cycle : Number.NaN
}

export async function GET(request: Request) {
  const requestedCycle = parseCycle(new URL(request.url).searchParams.get("cycle"))
  if (Number.isNaN(requestedCycle)) {
    return NextResponse.json({ error: "Harvest cycle must be an integer from 1 to 100." }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured." }, { status: 500 })
  }

  const target = new URL(`${getApiBaseUrl()}/api/coconut-counting/reconciliation`)
  if (requestedCycle !== null) target.searchParams.set("harvest_cycle", String(requestedCycle))

  try {
    const response = await fetch(target, {
      headers: { Authorization: authHeader, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = typeof payload.detail === "string" ? payload.detail : `Harvest API returned ${response.status}.`
      return NextResponse.json({ error }, { status: response.status })
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "The Coconut Counting service timed out."
      : "The Coconut Counting service is unavailable."
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
