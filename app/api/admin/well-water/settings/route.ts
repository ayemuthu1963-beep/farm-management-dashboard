import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BACKEND_SETTINGS_PATH = "/api/well-water/settings"

const VALID_WELLS = ["well1", "well2"]

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    well_code?: string
    capacity_liters?: number
    liters_per_inch?: number
    remarks?: string | null
  }

  const errors: string[] = []
  const wellCode = String(body.well_code ?? "").trim()

  if (!wellCode) errors.push("Well is required.")
  if (wellCode && !VALID_WELLS.includes(wellCode)) errors.push("Well must be North Well or South Well.")
  if (!isPositiveInteger(body.capacity_liters)) errors.push("Full Capacity Litres must be a positive whole number.")
  if (!isPositiveInteger(body.liters_per_inch)) errors.push("Litres Per Inch must be a positive whole number.")

  if (errors.length > 0) {
    return NextResponse.json({
      ok: false,
      errors,
      message: "Validation failed. No database write was performed.",
    })
  }

  const safetyErrors = getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors: safetyErrors,
        message: "Well Settings were not saved.",
      },
      { status: 403 },
    )
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API credentials are not configured."],
        message: "Well Settings were not saved.",
      },
      { status: 500 },
    )
  }

  const response = await fetch(`${getApiBaseUrl()}${BACKEND_SETTINGS_PATH}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      well_code: wellCode,
      capacity_liters: body.capacity_liters,
      liters_per_inch: body.liters_per_inch,
      remarks: body.remarks ?? null,
    }),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        message: "Well Settings were not saved.",
      },
      { status: response.status },
    )
  }

  const saved = await response.json()
  const oldValues = saved?.old_values
  const newValues = saved?.new_values
  if (
    saved?.ok !== true ||
    oldValues?.well_code !== wellCode ||
    newValues?.well_code !== wellCode ||
    newValues?.capacity_liters !== body.capacity_liters ||
    newValues?.liters_per_inch !== body.liters_per_inch ||
    newValues?.total_depth_inches !== oldValues?.total_depth_inches ||
    newValues?.calculation_method !== oldValues?.calculation_method ||
    newValues?.reference_offset_inches !== oldValues?.reference_offset_inches
  ) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API returned an invalid or non-preserving Well Settings confirmation."],
        message: "Well Settings save could not be verified.",
      },
      { status: 502 },
    )
  }
  return NextResponse.json({
    ok: true,
    errors: [],
    message: "Well Settings saved.",
    saved,
    remarksStored: saved?.remarks_stored === true,
  })
}
