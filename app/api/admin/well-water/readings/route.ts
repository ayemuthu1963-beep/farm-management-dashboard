import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BACKEND_READINGS_PATH = "/api/well-water/readings"

const VALID_WELLS = ["well1", "well2"]

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isWholeNumber(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    reading_id?: number | string | null
    reading_date?: string
    well_code?: string
    feet?: number | null
    inches?: number | null
    remarks?: string | null
  }

  const errors: string[] = []
  const readingDate = String(body.reading_date ?? "").trim()
  const wellCode = String(body.well_code ?? "").trim()
  const rawReadingId = body.reading_id === null || body.reading_id === undefined ? "" : String(body.reading_id).trim()
  const correctionReadingId = rawReadingId ? Number(rawReadingId) : null
  const isCorrection = correctionReadingId !== null
  const hasFeet = body.feet !== null && body.feet !== undefined
  const hasInches = body.inches !== null && body.inches !== undefined
  const feet = hasFeet ? body.feet : 0
  const inches = hasInches ? body.inches : 0

  if (correctionReadingId !== null && (!Number.isInteger(correctionReadingId) || correctionReadingId <= 0)) {
    errors.push("Correction Reading ID must be a positive whole number.")
  }
  if (!readingDate) errors.push("Reading Date is required.")
  if (readingDate && !isValidDate(readingDate)) errors.push("Reading Date is not a valid date.")
  if (!wellCode) errors.push("Well is required.")
  if (wellCode && !VALID_WELLS.includes(wellCode)) errors.push("Well must be North Well or South Well.")
  if (!hasFeet && !hasInches) errors.push("Enter Feet or Inches.")
  if (!isWholeNumber(feet)) errors.push("Feet must be a whole number and cannot be negative.")
  if (!isWholeNumber(inches)) errors.push("Inches must be a whole number and cannot be negative.")
  if (isWholeNumber(inches) && inches > 11) errors.push("Inches must be between 0 and 11.")
  if (wellCode === "well2" && feet === 0 && inches === 0 && (hasFeet || hasInches)) {
    errors.push("South Well reading cannot be 0 feet and 0 inches.")
  }

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
        message: "Manual well reading was not saved.",
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
        message: "Manual well reading was not saved.",
      },
      { status: 500 },
    )
  }

  const backendPath = isCorrection ? `${BACKEND_READINGS_PATH}/${correctionReadingId}` : BACKEND_READINGS_PATH
  const response = await fetch(`${getApiBaseUrl()}${backendPath}`, {
    method: isCorrection ? "PATCH" : "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      reading_date: readingDate,
      well_code: wellCode,
      feet,
      inches,
      remarks: body.remarks ?? null,
    }),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        message: isCorrection ? "Manual well reading correction was not saved." : "Manual well reading was not saved.",
      },
      { status: response.status },
    )
  }

  const saved = await response.json()
  const changedRow = isCorrection ? saved?.updated_row : saved?.inserted_row
  if (
    saved?.ok !== true ||
    !changedRow ||
    !Number.isInteger(changedRow.reading_id) ||
    (isCorrection && changedRow.reading_id !== correctionReadingId) ||
    changedRow.reading_date !== readingDate ||
    changedRow.well_code !== wellCode ||
    changedRow.feet !== feet ||
    changedRow.inches !== inches ||
    !String(changedRow.odk_submission_id ?? "").startsWith("manual:well-water:")
  ) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API returned an invalid manual Well Water save confirmation."],
        message: "Manual well reading save could not be verified.",
      },
      { status: 502 },
    )
  }
  return NextResponse.json({
    ok: true,
    errors: [],
    message: isCorrection ? "Manual well reading correction saved." : "Manual well reading saved.",
    saved,
    remarksStored: saved?.remarks_stored === true,
  })
}
