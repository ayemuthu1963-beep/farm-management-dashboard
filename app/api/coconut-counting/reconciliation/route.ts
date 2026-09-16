import { NextResponse } from "next/server"

import {
  CoconutCountingReconciliationApiError,
  getCoconutCountingReconciliation,
} from "@/lib/coconut-counting-reconciliation-api"

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

  try {
    const payload = await getCoconutCountingReconciliation(requestedCycle ?? undefined)
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof CoconutCountingReconciliationApiError
      ? error.message
      : "The Coconut Counting reconciliation service is unavailable."
    const status = error instanceof CoconutCountingReconciliationApiError
      ? (error.status ?? 503)
      : 503
    return NextResponse.json({ error: message }, { status })
  }
}
