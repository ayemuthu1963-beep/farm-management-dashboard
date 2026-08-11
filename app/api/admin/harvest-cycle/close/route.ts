import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isHarvestCycleWriteEnabled(): boolean {
  const explicitFlag = (process.env.MFMS_HARVEST_CYCLE_WRITES_ENABLED ?? "").trim().toLowerCase()
  return explicitFlag === "true" && getAdminTargetSafetyErrors(process.env, getApiBaseUrl()).length === 0
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function POST(request: Request) {
  if (!isHarvestCycleWriteEnabled()) {
    return NextResponse.json({ ok: false, errors: ["Harvest Cycle Admin writes are not enabled for this MFMS environment."], message: "Harvest cycle was not closed." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    harvest_cycle?: string
    harvest_end_date?: string
    total_sale_value?: string | number | null
    remarks?: string | null
  }

  const harvestCycle = String(body.harvest_cycle ?? "").trim()
  const endDate = String(body.harvest_end_date ?? "").trim()
  const errors: string[] = []

  if (!harvestCycle) errors.push("Harvest Cycle No is required.")
  if (!endDate) errors.push("Harvest End Date is required.")
  if (endDate && !isValidDate(endDate)) errors.push("Harvest End Date is not a valid date.")

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors, message: "Validation failed. No database write was performed." }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, errors: ["Harvest API credentials are not configured."], message: "Harvest cycle was not closed." }, { status: 500 })
  }

  const target = new URL(`${getApiBaseUrl()}/api/cycles/${encodeURIComponent(harvestCycle)}/close`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "PATCH", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ ok: false, errors: [message], message: "Harvest cycle was not closed." }, { status })
  }

  const response = await fetch(target, {
    method: "PATCH",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...actorHeaders,
    },
    cache: "no-store",
    body: JSON.stringify({
      harvest_end_date: endDate,
      total_sale_value: body.total_sale_value || null,
      remarks: body.remarks || null,
    }),
  })

  const detail = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ ok: false, errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`], message: "Harvest cycle was not closed." }, { status: response.status })
  }

  return NextResponse.json({ ok: true, errors: [], message: `Cycle ${harvestCycle} closed.`, saved: detail })
}
