import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getPreviewAdminTargetSafetyErrors, getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"
import { isValidIsoDate } from "@/lib/tree-lifecycle"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BACKEND_LIFECYCLE_PATH = "/api/tree-lifecycle"
const VALID_ACTIONS = new Set(["REPLACEMENT_PLANTED", "PROMOTE_EARLY_HARVEST", "RESTORE_AUTOMATIC"])

type LifecycleAction = "REPLACEMENT_PLANTED" | "PROMOTE_EARLY_HARVEST" | "RESTORE_AUTOMATIC"

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function errorMessage(detail: unknown, fallback: string): string {
  return detail && typeof detail === "object" && typeof (detail as { detail?: unknown }).detail === "string"
    ? (detail as { detail: string }).detail
    : fallback
}

export async function GET() {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return NextResponse.json({ ok: false, errors: targetErrors }, { status: 403 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ ok: false, errors: ["Harvest API credentials are not configured."] }, { status: 500 })
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${BACKEND_LIFECYCLE_PATH}`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
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
      { ok: false, errors: [error instanceof Error ? error.message : "Unable to load Tree Lifecycle data."] },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    tree_no?: string
    plantation_date?: string
    effective_date?: string
    reason?: string
  }
  const action = text(body.action) as LifecycleAction
  const treeNo = text(body.tree_no)
  const plantationDate = text(body.plantation_date)
  const effectiveDate = text(body.effective_date)
  const reason = text(body.reason)
  const errors: string[] = []

  if (!VALID_ACTIONS.has(action)) errors.push("Select a valid Tree Lifecycle action.")
  if (!treeNo) errors.push("Select an exact Tree Number from Tree Master.")

  if (action === "REPLACEMENT_PLANTED") {
    if (!plantationDate) errors.push("New plantation date is required for a replacement tree.")
    if (plantationDate && !isValidIsoDate(plantationDate)) errors.push("New plantation date is invalid.")
  } else {
    if (!effectiveDate) errors.push("Effective date is required.")
    if (effectiveDate && !isValidIsoDate(effectiveDate)) errors.push("Effective date is invalid.")
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
        message: "Tree Lifecycle change was not saved.",
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
        message: "Tree Lifecycle change was not saved.",
      },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${BACKEND_LIFECYCLE_PATH}/actions`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        action,
        tree_no: treeNo,
        plantation_date: action === "REPLACEMENT_PLANTED" ? plantationDate : undefined,
        effective_date: action === "REPLACEMENT_PLANTED" ? plantationDate : effectiveDate,
        reason: reason || null,
      }),
    })
    const saved = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          errors: [errorMessage(saved, `Harvest API returned ${response.status}.`)],
          message: "Tree Lifecycle change was not saved.",
        },
        { status: response.status },
      )
    }

    if (saved?.ok !== true || saved?.tree_no !== treeNo || saved?.action !== action) {
      return NextResponse.json(
        {
          ok: false,
          errors: ["Harvest API returned an invalid Tree Lifecycle save confirmation."],
          message: "Tree Lifecycle change could not be verified.",
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      errors: [],
      message: typeof saved.message === "string" ? saved.message : "Tree Lifecycle change saved.",
      saved,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errors: [error instanceof Error ? error.message : "Tree Lifecycle change was not saved."],
        message: "Tree Lifecycle change was not saved.",
      },
      { status: 502 },
    )
  }
}
