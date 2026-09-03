import type {
  WorkerV2AttendanceRequest,
  WorkerV2CloseRequest,
  WorkerV2FinancialEventRequest,
  WorkerV2InitializeRequest,
  WorkerV2StateResponse,
} from "./worker-v2-types"

export class WorkerV2ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "WorkerV2ApiError"
    this.status = status
  }
}

async function workerV2Request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/worker-management/v2${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as T | { detail?: string } | null
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? payload.detail : null
    throw new WorkerV2ApiError(detail || `Worker V2 request failed (${response.status}).`, response.status)
  }
  return payload as T
}

export function fetchWorkerV2State(): Promise<WorkerV2StateResponse> {
  return workerV2Request<WorkerV2StateResponse>("/comparison", { method: "GET" })
}

export function initializeWorkerV2(payload: WorkerV2InitializeRequest) {
  return workerV2Request<Record<string, unknown>>("/initialize", { method: "POST", body: JSON.stringify(payload) })
}

export function postWorkerV2FinancialEvent(payload: WorkerV2FinancialEventRequest) {
  return workerV2Request<Record<string, unknown>>("/events", { method: "POST", body: JSON.stringify(payload) })
}

export function saveWorkerV2Attendance(weekStart: string, payload: WorkerV2AttendanceRequest) {
  return workerV2Request<Record<string, unknown>>(`/weeks/${weekStart}/attendance`, { method: "PUT", body: JSON.stringify(payload) })
}

export function closeWorkerV2Week(weekStart: string, payload: WorkerV2CloseRequest) {
  return workerV2Request<Record<string, unknown>>(`/weeks/${weekStart}/close`, { method: "POST", body: JSON.stringify(payload) })
}
