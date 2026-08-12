import "server-only"

import { getBasicAuthHeader } from "@/lib/api"
import type { FarmMapOperationalPayload } from "@/lib/farm-map/types"

const PRODUCTION_LOOPBACK_PORT = /(?:127\.0\.0\.1|localhost):8001(?:\/|$)/i

function previewApiBaseUrl(): string {
  const configured = process.env.HARVEST_API_BASE_URL?.trim().replace(/\/$/, "")
  if (!configured) throw new Error("Preview Harvest API base URL is not configured")
  if (PRODUCTION_LOOPBACK_PORT.test(configured)) {
    throw new Error("Production Harvest API target is prohibited for this Preview Farm Map")
  }
  return configured
}

export async function fetchFarmMapTrees(): Promise<FarmMapOperationalPayload> {
  const authHeader = getBasicAuthHeader()
  if (!authHeader) throw new Error("Harvest API credentials are not configured")

  const response = await fetch(`${previewApiBaseUrl()}/api/farm-map/trees`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Farm Map API returned ${response.status}`)

  const payload = (await response.json()) as FarmMapOperationalPayload
  if (
    payload.recordCount !== 2_117 ||
    payload.decimalTreeNoCount !== 15 ||
    !Array.isArray(payload.records) ||
    payload.records.length !== 2_117
  ) {
    throw new Error("Farm Map API integrity check failed")
  }
  return payload
}
