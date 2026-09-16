import "server-only"

import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import type { CoconutCountingReconciliationResponse } from "@/lib/coconut-counting-reconciliation"

const RECONCILIATION_TIMEOUT_MS = 15_000

export class CoconutCountingReconciliationApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "CoconutCountingReconciliationApiError"
  }
}

export async function getCoconutCountingReconciliation(
  harvestCycle?: number,
): Promise<CoconutCountingReconciliationResponse> {
  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    throw new CoconutCountingReconciliationApiError(
      "Harvest API credentials are not configured for the reconciliation table.",
      500,
    )
  }

  const target = new URL(`${getApiBaseUrl()}/api/coconut-counting/reconciliation`)
  if (harvestCycle !== undefined) target.searchParams.set("harvest_cycle", String(harvestCycle))

  let response: Response
  try {
    response = await fetch(target, {
      headers: { Authorization: authHeader, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(RECONCILIATION_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    throw new CoconutCountingReconciliationApiError(
      timedOut
        ? "The Coconut Counting reconciliation service timed out."
        : "The Coconut Counting reconciliation service is unavailable.",
      503,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new CoconutCountingReconciliationApiError(
      "The Coconut Counting reconciliation service returned an invalid response.",
      502,
    )
  }

  if (!response.ok) {
    const detail = typeof payload === "object"
      && payload !== null
      && "detail" in payload
      && typeof payload.detail === "string"
      ? payload.detail
      : `The Coconut Counting reconciliation service returned HTTP ${response.status}.`
    throw new CoconutCountingReconciliationApiError(detail, response.status)
  }

  if (
    typeof payload !== "object"
    || payload === null
    || !("cycles" in payload)
    || !Array.isArray(payload.cycles)
    || !("unassigned_session_count" in payload)
    || typeof payload.unassigned_session_count !== "number"
  ) {
    throw new CoconutCountingReconciliationApiError(
      "The Coconut Counting reconciliation service returned an invalid response.",
      502,
    )
  }

  return payload as CoconutCountingReconciliationResponse
}
