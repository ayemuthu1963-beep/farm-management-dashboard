import type { WorkerV2ComparisonResponse } from "./worker-v2-types"

export class WorkerV2ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "WorkerV2ApiError"
    this.status = status
  }
}

export async function fetchWorkerV2Comparison(): Promise<WorkerV2ComparisonResponse> {
  const response = await fetch("/api/worker-management/v2/comparison", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as
    | WorkerV2ComparisonResponse
    | { detail?: string }
    | null
  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : null
    throw new WorkerV2ApiError(detail || `Worker V2 request failed (${response.status}).`, response.status)
  }
  return payload as WorkerV2ComparisonResponse
}
