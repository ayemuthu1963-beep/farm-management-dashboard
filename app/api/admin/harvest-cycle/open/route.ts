import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isPreviewWriteEnabled(): boolean {
  const explicitFlag = (process.env.MFMS_ENABLE_PREVIEW_HARVEST_CYCLE_WRITES ?? "").toLowerCase()

  if (explicitFlag === "false") return false
  return getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl()).length === 0
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function POST(request: Request) {
  if (!isPreviewWriteEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest Cycle Admin writes are not enabled for this MFMS environment."],
        message: "Harvest cycle was not opened.",
      },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    cycle_no?: number | string
    start_date?: string
    harvest_cycle?: string
    harvest_start_date?: string
    remarks?: string | null
  }

  const errors: string[] = []
  const harvestCycle = String(body.cycle_no ?? body.harvest_cycle ?? "").trim()
  const startDate = String(body.start_date ?? body.harvest_start_date ?? "").trim()
  const remarks = String(body.remarks ?? "").trim()

  if (!harvestCycle) errors.push("Harvest Cycle No is required.")
  if (harvestCycle && !/^\d+$/.test(harvestCycle)) errors.push("Harvest Cycle No must be a positive integer.")
  if (harvestCycle && /^\d+$/.test(harvestCycle) && Number(harvestCycle) <= 0) errors.push("Harvest Cycle No must be a positive integer.")
  if (!startDate) errors.push("Harvest Start Date is required.")
  if (startDate && !isValidDate(startDate)) errors.push("Harvest Start Date is not a valid date.")

  if (errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors,
        message: "Validation failed. No database write was performed.",
      },
      { status: 400 },
    )
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API credentials are not configured."],
        message: "Harvest cycle was not opened.",
      },
      { status: 500 },
    )
  }

  const response = await fetch(`${getApiBaseUrl()}/api/cycles`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      harvest_cycle: harvestCycle,
      harvest_start_date: startDate,
      remarks: remarks || null,
    }),
  })

  const detail = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        message: "Harvest cycle was not opened.",
      },
      { status: response.status },
    )
  }

  return NextResponse.json({
    ok: true,
    errors: [],
    message: `Cycle ${harvestCycle} opened.`,
    saved: detail,
  })
}
