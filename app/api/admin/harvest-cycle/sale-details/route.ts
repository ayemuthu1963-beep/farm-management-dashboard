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

export async function POST(request: Request) {
  if (!isHarvestCycleWriteEnabled()) {
    return NextResponse.json({ ok: false, errors: ["Harvest Cycle Admin writes are not enabled for this MFMS environment."], message: "Sale details were not saved." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    harvest_cycle?: string
    total_sale_value?: string | number | null
    remarks?: string | null
  }

  const harvestCycle = String(body.harvest_cycle ?? "").trim()
  if (!harvestCycle) {
    return NextResponse.json({ ok: false, errors: ["Harvest Cycle No is required."], message: "Validation failed. No database write was performed." }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, errors: ["Harvest API credentials are not configured."], message: "Sale details were not saved." }, { status: 500 })
  }

  const target = new URL(`${getApiBaseUrl()}/api/cycles/${encodeURIComponent(harvestCycle)}/sale-details`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "PATCH", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ ok: false, errors: [message], message: "Sale details were not saved." }, { status })
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
      total_sale_value: body.total_sale_value || null,
      remarks: body.remarks || null,
    }),
  })

  const detail = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ ok: false, errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`], message: "Sale details were not saved." }, { status: response.status })
  }

  return NextResponse.json({ ok: true, errors: [], message: `Cycle ${harvestCycle} sale details saved.`, saved: detail })
}
