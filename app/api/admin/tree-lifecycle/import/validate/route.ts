import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"
import { isValidIsoDate } from "@/lib/tree-lifecycle"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : ""
}

function errorMessage(detail: unknown, fallback: string): string {
  return detail && typeof detail === "object" && typeof (detail as { detail?: unknown }).detail === "string"
    ? (detail as { detail: string }).detail
    : fallback
}

export async function POST(request: Request) {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return NextResponse.json({ ok: false, errors: targetErrors }, { status: 403 })
  }

  const submitted = await request.formData().catch(() => null)
  const file = submitted?.get("file")
  const asOfDate = text(submitted?.get("as_of_date") ?? null)
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, errors: ["Select an Excel file before validating."] }, { status: 400 })
  }
  if (!asOfDate || !isValidIsoDate(asOfDate)) {
    return NextResponse.json({ ok: false, errors: ["Select a valid import as-of date."] }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, errors: ["Harvest API credentials are not configured."] }, { status: 500 })
  }

  const form = new FormData()
  form.set("file", file, file.name)
  form.set("as_of_date", asOfDate)
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/tree-lifecycle/import/validate`, {
      method: "POST",
      headers: { Authorization: authHeader, Accept: "application/json" },
      body: form,
      cache: "no-store",
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, errors: [errorMessage(data, `Harvest API returned ${response.status}.`)] },
        { status: response.status },
      )
    }
    return NextResponse.json({ ...data, ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, errors: [error instanceof Error ? error.message : "Unable to validate the plantation-date import."] },
      { status: 502 },
    )
  }
}
