import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TRAP_TYPES = ["Red Palm Weevil", "Rhinoceros Beetle"]
const VALID_ADMIN_ACTIONS = ["new-trap", "amend-location", "change-type"]

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    x?: string
    y?: string
    trap_no?: string
    trap_type?: string
    admin_action?: string
  }

  const errors: string[] = []
  const warnings: string[] = []
  const trapNo = (body.trap_no ?? "").trim()
  const trapType = (body.trap_type ?? "").trim()
  const adminAction = (body.admin_action ?? "").trim()
  const xRaw = (body.x ?? "").trim()
  const yRaw = (body.y ?? "").trim()
  const x = Number(xRaw)
  const y = Number(yRaw)

  if (!VALID_ADMIN_ACTIONS.includes(adminAction)) {
    errors.push("Admin action must be New Trap, Amend Trap Location, or Change Trap Type Only.")
  }

  if (!trapNo) errors.push("Trap number is required.")

  const trapTypeRequired = adminAction === "new-trap" || adminAction === "change-type"
  const locationRequired = adminAction === "new-trap" || adminAction === "amend-location"

  if (trapTypeRequired && !trapType) errors.push("Trap type is required for this admin action.")
  if (trapType && !VALID_TRAP_TYPES.includes(trapType)) {
    errors.push("Trap type must be exactly Red Palm Weevil or Rhinoceros Beetle.")
  }

  const hasX = Boolean(xRaw)
  const hasY = Boolean(yRaw)
  const shouldValidateCoordinates = locationRequired || hasX || hasY

  if (locationRequired && !hasX) {
    errors.push("X longitude is required for this admin action.")
  }
  if (locationRequired && !hasY) {
    errors.push("Y latitude is required for this admin action.")
  }
  if (!locationRequired && hasX !== hasY) {
    errors.push("Both X longitude and Y latitude are required when changing a location.")
  }
  if (hasX && !Number.isFinite(x)) errors.push("X longitude must be a valid number.")
  if (hasY && !Number.isFinite(y)) errors.push("Y latitude must be a valid number.")

  const hasNumericCoordinates = shouldValidateCoordinates && hasX && hasY && Number.isFinite(x) && Number.isFinite(y)
  const looksReversed = hasNumericCoordinates && inRange(x, 9, 12) && inRange(y, 76, 78)
  if (looksReversed) {
    errors.push("Coordinates appear reversed. X should be longitude around 77.x and Y should be latitude around 10.x.")
  }

  if (hasNumericCoordinates && !inRange(x, 76.5, 77.5)) {
    errors.push("X should be longitude around Muthu Farms, approximately 77.x.")
  }
  if (hasNumericCoordinates && !inRange(y, 10, 11)) {
    errors.push("Y should be latitude around Muthu Farms, approximately 10.x.")
  }

  if (trapNo && /^[0-9]+$/.test(trapNo) === false) {
    warnings.push("Trap number is accepted as text, but please confirm this non-numeric trap code is intended.")
  }

  if (errors.length > 0) {
    return NextResponse.json({
      ok: false,
      errors,
      warnings,
      message: "Validation failed. No database write was performed.",
      writesEnabled: adminAction === "change-type" || adminAction === "amend-location" || adminAction === "new-trap",
    })
  }

  const writesEnabled = adminAction === "change-type" || adminAction === "amend-location" || adminAction === "new-trap"

  if (!writesEnabled) {
    return NextResponse.json({
      ok: true,
      errors: [],
      warnings,
      message: "Validation passed. No database write was performed. This admin action is still validation-only.",
      writesEnabled: false,
    })
  }

  const safetyErrors = getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors: safetyErrors,
        warnings,
        message: "Trap admin change was not saved.",
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
        message: "Trap type was not changed.",
        writesEnabled: writesEnabled,
      },
      { status: 500 },
    )
  }

  const apiPath = adminAction === "change-type" ? "/api/beetle-trap/trap-type" : adminAction === "new-trap" ? "/api/beetle-trap/trap-location/new" : "/api/beetle-trap/trap-location"
  const requestBody =
    adminAction === "change-type"
      ? {
          trap_no: trapNo,
          trap_type: trapType,
        }
      : adminAction === "new-trap"
        ? {
            trap_no: trapNo,
            longitude: x,
            latitude: y,
            trap_type: trapType,
          }
        : {
            // Location amendments must never alter the existing trap type.
            trap_no: trapNo,
            longitude: x,
            latitude: y,
          }

  const response = await fetch(`${getApiBaseUrl()}${apiPath}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        warnings,
        message: adminAction === "change-type" ? "Trap type was not changed." : adminAction === "new-trap" ? "New trap was not added." : "Trap location was not changed.",
        writesEnabled: true,
      },
      { status: response.status },
    )
  }

  const saved = await response.json()
  const saveIsValid =
    saved?.ok === true &&
    saved?.trap_no === trapNo &&
    (adminAction === "change-type"
      ? saved?.new_trap_type === trapType && saved?.after?.source === "Manual_Admin"
      : adminAction === "new-trap"
        ? saved?.new_trap?.trap_no === trapNo &&
          saved?.new_trap?.trap_type === trapType &&
          saved?.new_trap?.source === "Manual_Admin" &&
          String(saved?.new_trap?.odk_submission_id ?? "").startsWith("manual:beetle-trap-location:")
        : Number(saved?.new_latitude) === y &&
          Number(saved?.new_longitude) === x &&
          saved?.old_trap_type === saved?.new_trap_type &&
          saved?.after?.source === "Manual_Admin")

  if (!saveIsValid) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API returned an invalid trap admin save confirmation."],
        warnings,
        message: "Trap admin save could not be verified.",
        writesEnabled: true,
      },
      { status: 502 },
    )
  }
  const message =
    adminAction === "change-type"
      ? `Trap type changed from ${saved.old_trap_type} to ${saved.new_trap_type}.`
      : adminAction === "new-trap"
        ? `New trap ${saved.trap_no} added.`
        : `Trap location changed from ${saved.old_latitude}, ${saved.old_longitude} to ${saved.new_latitude}, ${saved.new_longitude}.`

  return NextResponse.json({
    ok: true,
    errors: [],
    warnings,
    message,
    writesEnabled: true,
    savedTrap: saved,
  })
}
