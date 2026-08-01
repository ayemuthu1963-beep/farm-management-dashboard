import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isFutureDate(value: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  const todayIst = year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10)
  return value > todayIst
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    pheromone_installed_on?: string
    remarks?: string
  }

  const errors: string[] = []
  const warnings: string[] = []
  const pheromoneDate = (body.pheromone_installed_on ?? "").trim()

  if (!pheromoneDate) errors.push("Pheromone Installed On is required.")
  if (pheromoneDate && !isValidDate(pheromoneDate)) errors.push("Pheromone Installed On is not a valid date.")

  if (pheromoneDate && isValidDate(pheromoneDate) && isFutureDate(pheromoneDate)) {
    errors.push("Pheromone Installed On is in the future. Future-date saves need a separate confirmation step.")
    warnings.push("Future date was not saved.")
  }

  if (errors.length > 0) {
    return NextResponse.json({
      ok: false,
      errors,
      warnings,
      message: "Validation failed. No database write was performed.",
      writesEnabled: true,
    })
  }

  const safetyErrors = getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors: safetyErrors,
        warnings,
        message: "Pheromone reset was not saved.",
        writesEnabled: true,
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
        warnings,
        message: "Pheromone reset was not saved.",
        writesEnabled: true,
      },
      { status: 500 },
    )
  }

  const response = await fetch(`${getApiBaseUrl()}/api/beetle-trap/admin-settings`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      pheromone_installed_on: pheromoneDate,
      remarks: (body.remarks ?? "").trim() || null,
    }),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        warnings,
        message: "Pheromone reset was not saved.",
        writesEnabled: true,
      },
      { status: response.status },
    )
  }

  const saved = await response.json()
  const setting = saved?.setting
  if (
    saved?.ok !== true ||
    !setting ||
    !Number.isInteger(setting.id) ||
    setting.pheromone_lure_installed_date !== pheromoneDate ||
    setting.cumulative_count_start_date !== pheromoneDate ||
    setting.source !== "Manual_Admin" ||
    !String(setting.odk_submission_id ?? "").startsWith("manual:beetle-admin:")
  ) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API returned an invalid pheromone reset confirmation."],
        warnings,
        message: "Pheromone reset save could not be verified.",
        writesEnabled: true,
      },
      { status: 502 },
    )
  }
  return NextResponse.json({
    ok: true,
    errors: [],
    warnings,
    message: "Pheromone reset saved. Dashboard will now count beetles from this date.",
    writesEnabled: true,
    savedSetting: setting,
  })
}
