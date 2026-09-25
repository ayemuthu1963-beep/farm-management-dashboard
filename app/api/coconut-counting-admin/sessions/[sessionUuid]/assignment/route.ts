import { NextResponse } from "next/server"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { isSessionAssignmentWriteAllowed } from "@/lib/coconut-counting-write-gate"
import { COCONUT_COUNTING_SESSION_ASSIGNMENT_PRODUCTION_WRITE_APPROVAL } from "@/lib/coconut-counting-write-policy"
import { getAuthenticatedUserAssertionHeaders, MfmsAdminIdentityError } from "@/lib/mfms-admin-identity"
import { getAdminTargetSafetyErrors } from "@/lib/preview-admin-write-safety"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ sessionUuid: string }> }

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function writesEnabled(apiBaseUrl: string): boolean {
  const targetSafetyErrors = getAdminTargetSafetyErrors(process.env, apiBaseUrl)
  return isSessionAssignmentWriteAllowed({
    explicitFlagValue: process.env.MFMS_COCONUT_COUNTING_ASSIGNMENT_WRITES_ENABLED,
    targetSafetyErrors,
    sourceProductionApproval: COCONUT_COUNTING_SESSION_ASSIGNMENT_PRODUCTION_WRITE_APPROVAL,
    runtime: {
      MFMS_ENV: process.env.MFMS_ENV,
      NEXT_PUBLIC_MFMS_ENV: process.env.NEXT_PUBLIC_MFMS_ENV,
      NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL,
      MFMS_BUILD_ENVIRONMENT: process.env.MFMS_BUILD_ENVIRONMENT,
      MFMS_GIT_COMMIT: process.env.MFMS_GIT_COMMIT,
    },
  })
}

function nullableInteger(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}

export async function PATCH(request: Request, context: RouteContext) {
  let apiBaseUrl: string
  try {
    apiBaseUrl = getApiBaseUrl()
  } catch {
    return errorResponse("MFMS backend routing is not configured for this website.", 503)
  }

  if (!writesEnabled(apiBaseUrl)) {
    return errorResponse("Cycle and Plot assignment writes are not enabled for this MFMS environment.", 403)
  }

  const { sessionUuid } = await context.params
  if (!SESSION_UUID_PATTERN.test(sessionUuid)) {
    return errorResponse("A valid Coconut Counting session UUID is required.", 400)
  }

  const body = (await request.json().catch(() => null)) as {
    harvest_cycle?: unknown
    plot?: unknown
    expected_harvest_cycle?: unknown
    expected_plot?: unknown
    reason?: unknown
  } | null
  const harvestCycle = nullableInteger(body?.harvest_cycle)
  const plot = nullableInteger(body?.plot)
  const expectedHarvestCycle = nullableInteger(body?.expected_harvest_cycle)
  const expectedPlot = nullableInteger(body?.expected_plot)
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
  if (harvestCycle === undefined || harvestCycle === null || harvestCycle < 1 || harvestCycle > 100) {
    return errorResponse("Harvest cycle must be a whole number from 1 to 100.", 400)
  }
  if (plot !== 1 && plot !== 2) {
    return errorResponse("Plot must be 1 or 2.", 400)
  }
  if (
    expectedHarvestCycle === undefined
    || (expectedHarvestCycle !== null && (expectedHarvestCycle < 1 || expectedHarvestCycle > 100))
  ) {
    return errorResponse("Expected harvest cycle must be null or a whole number from 1 to 100.", 400)
  }
  if (
    expectedPlot === undefined
    || (expectedPlot !== null && expectedPlot !== 1 && expectedPlot !== 2)
  ) {
    return errorResponse("Expected plot must be null, 1 or 2.", 400)
  }
  const overwritesAssignedValue =
    (expectedHarvestCycle !== null && expectedHarvestCycle !== harvestCycle)
    || (expectedPlot !== null && expectedPlot !== plot)
  if (overwritesAssignedValue && !reason) {
    return errorResponse("A reason is required when changing an existing Cycle or Plot assignment.", 400)
  }
  if (reason.length > 500) {
    return errorResponse("Correction reason must be 500 characters or fewer.", 400)
  }

  const serviceAuthorization = getBasicAuthHeader()
  if (!serviceAuthorization) {
    return errorResponse("MFMS backend credentials are not configured for this website.", 503)
  }
  const target = new URL(
    `${apiBaseUrl}/api/coconut-counting/sessions/${encodeURIComponent(sessionUuid)}/assignment`,
  )
  let actorHeaders: Record<string, string>
  try {
    actorHeaders = getAuthenticatedUserAssertionHeaders({
      requestHeaders: request.headers,
      method: "PATCH",
      target,
    })
  } catch (error) {
    const status = error instanceof MfmsAdminIdentityError ? error.status : 503
    const message = error instanceof Error ? error.message : "MFMS administrator authentication is required."
    return errorResponse(message, status)
  }

  try {
    const response = await fetch(target, {
      method: "PATCH",
      headers: {
        Authorization: serviceAuthorization,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...actorHeaders,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        harvest_cycle: harvestCycle,
        plot,
        expected_harvest_cycle: expectedHarvestCycle,
        expected_plot: expectedPlot,
        reason: reason || null,
      }),
    })
    const responseText = await response.text()
    return new Response(responseText, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    return errorResponse(
      timedOut
        ? "Saving Cycle and Plot timed out. The result may be unknown; refresh the page before retrying."
        : "The Coconut Counting Cycle and Plot assignment could not be saved.",
      timedOut ? 504 : 503,
    )
  }
}
