import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"
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
  const safetyErrors = getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
  if (safetyErrors.length > 0) {
    return NextResponse.json(
      { ok: false, errors: safetyErrors, message: "Plantation-date import was not saved." },
      { status: 403 },
    )
  }

  const submitted = await request.formData().catch(() => null)
  const file = submitted?.get("file")
  const asOfDate = text(submitted?.get("as_of_date") ?? null)
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, errors: ["Select an Excel file before importing."] }, { status: 400 })
  }
  if (!asOfDate || !isValidIsoDate(asOfDate)) {
    return NextResponse.json({ ok: false, errors: ["Select a valid import as-of date."] }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json(
      { ok: false, errors: ["Harvest API credentials are not configured."], message: "Plantation-date import was not saved." },
      { status: 500 },
    )
  }

  const form = new FormData()
  form.set("file", file, file.name)
  form.set("as_of_date", asOfDate)
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/tree-lifecycle/import/apply`, {
      method: "POST",
      headers: { Authorization: authHeader, Accept: "application/json" },
      body: form,
      cache: "no-store",
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          errors: [errorMessage(data, `Harvest API returned ${response.status}.`)],
          message: "Plantation-date import was not saved.",
        },
        { status: response.status },
      )
    }
    return NextResponse.json({
      ...data,
      ok: true,
      errors: Array.isArray(data?.errors) ? data.errors : [],
      message: typeof data?.message === "string" ? data.message : "Plantation dates imported.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errors: [error instanceof Error ? error.message : "Plantation-date import was not saved."],
        message: "Plantation-date import was not saved.",
      },
      { status: 502 },
    )
  }
}
