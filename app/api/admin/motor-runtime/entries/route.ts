import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getPreviewAdminTargetSafetyErrors, getPreviewAdminWriteSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BACKEND_ENTRIES_PATH = "/api/motor-runtime/entries"

const validMappings = new Map<string, number>([
  ["Plot2_East:1", 1],
  ["Plot2_West:1", 2],
  ["Plot1_East:1", 3],
  ["Plot1_West:1", 4],
  ["Nutmug:1", 5],
  ["Jack_Fruit:1", 6],
  ["Plot2_East:2", 7],
  ["Plot2_West:2", 8],
  ["Plot1_East:2", 9],
  ["Plot1_West:2", 10],
  ["Nutmug:2", 11],
  ["Jack_Fruit:2", 12],
  ["Plot2_East:3", 13],
  ["Plot2_West:3", 14],
  ["Jack_Fruit:3", 15],
])

interface RuntimeEntry {
  plot?: string
  motor_no?: number
  valve_no?: number
  hours?: number
  minutes?: number
}


function assertMotorRuntimeWriteTarget(): string[] {
  return getPreviewAdminWriteSafetyErrors(process.env, getApiBaseUrl())
}
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validatePayload(body: { entry_date?: string; remarks?: string; entries?: RuntimeEntry[] }) {
  const errors: string[] = []
  const entryDate = (body.entry_date ?? "").trim()
  const entries = Array.isArray(body.entries) ? body.entries : []

  if (!entryDate) errors.push("Entry date is required.")
  if (entryDate && !isValidDate(entryDate)) errors.push("Entry date is not a valid date.")
  if (entries.length === 0) errors.push("Enter runtime for at least one enabled motor/valve cell.")
  if (entries.length > validMappings.size) errors.push(`No more than ${validMappings.size} motor/valve entries can be saved at once.`)

  const seenMappings = new Set<string>()
  for (const entry of entries) {
    const label = `${entry.plot ?? "Unknown plot"} Motor ${entry.motor_no ?? "?"}`
    if (!entry.plot) errors.push(`${label}: Plot is required.`)
    if (!Number.isInteger(entry.motor_no) || ![1, 2, 3].includes(entry.motor_no ?? 0)) {
      errors.push(`${label}: Motor number must be 1, 2, or 3.`)
    }
    if (!Number.isInteger(entry.valve_no)) errors.push(`${label}: Valve number is required.`)
    if (!Number.isInteger(entry.hours) || (entry.hours ?? -1) < 0 || (entry.hours ?? 25) > 24) {
      errors.push(`${label}: Hours must be a whole number from 0 to 24.`)
    }
    if (!Number.isInteger(entry.minutes) || (entry.minutes ?? -1) < 0 || (entry.minutes ?? 60) > 59) {
      errors.push(`${label}: Minutes must be a whole number from 0 to 59.`)
    }
    if ((entry.hours ?? 0) * 60 + (entry.minutes ?? 0) < 1) {
      errors.push(`${label}: Runtime cannot be 0 hours and 0 minutes.`)
    }

    if (entry.plot && Number.isInteger(entry.motor_no) && Number.isInteger(entry.valve_no)) {
      const mappingKey = `${entry.plot}:${entry.motor_no}`
      if (seenMappings.has(mappingKey)) {
        errors.push(`${entry.plot} Motor ${entry.motor_no} was entered more than once.`)
      }
      seenMappings.add(mappingKey)
      const expectedValve = validMappings.get(mappingKey)
      if (!expectedValve) {
        errors.push(`${entry.plot} is not valid for Motor ${entry.motor_no}.`)
      } else if (expectedValve !== entry.valve_no) {
        errors.push(`${entry.plot} Motor ${entry.motor_no} must use Valve${expectedValve}.`)
      }
    }
  }

  return { errors, entryDate, entries }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    entry_date?: string
    remarks?: string
    entries?: RuntimeEntry[]
  }

  const { errors, entryDate, entries } = validatePayload(body)
  if (errors.length > 0) {
    return NextResponse.json({
      ok: false,
      errors,
      message: "Validation failed. No database write was performed.",
    })
  }

  const safetyErrors = assertMotorRuntimeWriteTarget()
  if (safetyErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors: safetyErrors,
        message: "Motor runtime entries were not saved.",
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
        message: "Motor runtime entries were not saved.",
      },
      { status: 500 },
    )
  }

  const target = new URL(`${getApiBaseUrl()}${BACKEND_ENTRIES_PATH}`)
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({ requestHeaders: request.headers, method: "POST", target })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return NextResponse.json({ ok: false, errors: [message], message: "Motor runtime entries were not saved." }, { status })
  }

  const response = await fetch(target, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...actorHeaders,
    },
    cache: "no-store",
    body: JSON.stringify({
      entry_date: entryDate,
      remarks: (body.remarks ?? "").trim() || null,
      entries,
    }),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        message: "Motor runtime entries were not saved.",
      },
      { status: response.status },
    )
  }

  const saved = await response.json()
  if (
    saved?.ok !== true ||
    saved?.inserted_count !== entries.length ||
    !Array.isArray(saved?.inserted_rows) ||
    saved.inserted_rows.length !== entries.length ||
    saved.inserted_rows.some(
      (row: unknown) =>
        !row ||
        typeof row !== "object" ||
        !Number.isInteger((row as { id?: unknown }).id) ||
        (row as { source?: unknown }).source !== "Manual_Admin",
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API returned an invalid Motor Runtime save confirmation."],
        message: "Motor runtime save could not be verified.",
      },
      { status: 502 },
    )
  }
  return NextResponse.json({
    ok: true,
    errors: [],
    message: `${saved.inserted_count} motor runtime entr${saved.inserted_count === 1 ? "y" : "ies"} saved.`,
    saved,
  })
}

export async function GET(request: Request) {
  const targetErrors = getPreviewAdminTargetSafetyErrors(process.env, getApiBaseUrl())
  if (targetErrors.length > 0) {
    return NextResponse.json({ ok: false, errors: targetErrors, entries: [] }, { status: 403 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json(
      {
        ok: false,
        errors: ["Harvest API credentials are not configured."],
        entries: [],
      },
      { status: 500 },
    )
  }

  const incoming = new URL(request.url)
  const query = new URLSearchParams(incoming.searchParams)
  query.set("limit", "1000")
  const response = await fetch(`${getApiBaseUrl()}${BACKEND_ENTRIES_PATH}?${query}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        errors: [typeof detail.detail === "string" ? detail.detail : `Harvest API returned ${response.status}.`],
        entries: [],
      },
      { status: response.status },
    )
  }

  const entries = await response.json()
  return NextResponse.json({
    ok: true,
    entries: Array.isArray(entries) ? entries : [],
  })
}
