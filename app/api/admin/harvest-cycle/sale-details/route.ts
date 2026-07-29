import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isPreviewWriteEnabled(): boolean {
  const publicEnv = (process.env.NEXT_PUBLIC_MFMS_ENV ?? "").toLowerCase()
  const appEnv = (process.env.MFMS_ENV ?? "").toLowerCase()
  const explicitFlag = (process.env.MFMS_ENABLE_PREVIEW_HARVEST_CYCLE_WRITES ?? "").toLowerCase()

  if (publicEnv === "production" || appEnv === "production") return false
  if (explicitFlag === "true") return true
  return publicEnv === "preview" || publicEnv === "uat" || appEnv === "preview" || appEnv === "uat"
}

export async function POST(request: Request) {
  if (!isPreviewWriteEnabled()) {
    return NextResponse.json({ ok: false, errors: ["Harvest Cycle Admin writes are enabled only for Preview."], message: "Sale details were not saved." }, { status: 403 })
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

  const response = await fetch(`${getApiBaseUrl()}/api/cycles/${encodeURIComponent(harvestCycle)}/sale-details`, {
    method: "PATCH",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
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
