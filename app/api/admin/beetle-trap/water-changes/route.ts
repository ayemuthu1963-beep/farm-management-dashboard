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
  const body = (await request.json().catch(() => ({}))) as { water_changed_on?: string }
  const waterChangedOn = (body.water_changed_on ?? "").trim()
  const errors: string[] = []
  const warnings: string[] = []

  if (!waterChangedOn) errors.push("Water Changed is required.")
  if (waterChangedOn && !isValidDate(waterChangedOn)) errors.push("Water Changed is not a valid date.")
  if (waterChangedOn && isValidDate(waterChangedOn) && isFutureDate(waterChangedOn)) {
    errors.push("Water Changed is in the future. Future-date saves need a separate confirmation step.")
    warnings.push("Future date was not saved.")
  }
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors, warnings, message: "Validation failed. No database write was performed.", writesEnabled: true })
  }

  const safetyErrors = getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length > 0) {
    return NextResponse.json({ ok: false, errors: safetyErrors, warnings, message: "Water change was not saved.", writesEnabled: true }, { status: 403 })
  }
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, errors: ["Harvest API credentials are not configured."], warnings, message: "Water change was not saved.", writesEnabled: true }, { status: 500 })
  }

  const response = await fetch(`${getApiBaseUrl()}/api/beetle-trap/water-changes`, {
    method: "POST",
    headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ water_changed_on: waterChangedOn }),
  })
  const saved = await response.json().catch(() => ({}))
  if (!response.ok || saved?.ok !== true || saved?.water_change?.water_changed_on !== waterChangedOn) {
    return NextResponse.json(
      { ok: false, errors: [typeof saved?.detail === "string" ? saved.detail : `Harvest API returned ${response.status}.`], warnings, message: "Water change was not saved.", writesEnabled: true },
      { status: response.ok ? 502 : response.status },
    )
  }
  return NextResponse.json({
    ok: true,
    errors: [],
    warnings: saved.created === false ? ["This water-change date was already recorded; no duplicate event was created."] : warnings,
    message: saved.created === false ? "Water change was already recorded for all active traps." : "Water change saved for all active traps.",
    writesEnabled: true,
    savedWaterChange: saved.water_change,
  })
}
