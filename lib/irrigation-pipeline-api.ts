const BASE = "/api/irrigation-pipeline"

export class PipelineApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "PipelineApiError"
  }
}

export async function pipelineRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new PipelineApiError(body.detail ?? `Pipeline API returned ${response.status}.`, response.status)
  }
  return response.json() as Promise<T>
}

export function pipelineDownload(format: "nodes-geojson" | "segments-geojson" | "backup-json") {
  window.location.assign(`${BASE}/export?format=${encodeURIComponent(format)}`)
}
