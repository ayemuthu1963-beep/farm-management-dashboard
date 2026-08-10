import type {
  AccountType,
  CreateWorkerAccountResponse,
  DailyWageResponse,
  DashboardResponse,
  FarmScheme,
  LedgerTransaction,
  ListResponse,
  ManualTransactionType,
  SettlementResponse,
  WageReportRow,
  WageRateRecord,
  WorkerAccount,
  WorkerAccountRecord,
  WorkerSyncOperation,
  WorkerSyncPullResponse,
  WorkerSyncPushResponse,
  WorkWeek,
} from "./worker-management-types"

export class WorkerApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "WorkerApiError"
    this.status = status
  }
}

function normaliseWorkerError(value: unknown): string | null {
  if (typeof value === "string") {
    const message = value.trim()
    return message || null
  }
  if (Array.isArray(value)) {
    const messages = value
      .map((item) => normaliseWorkerError(item))
      .filter((item): item is string => Boolean(item))
    return messages.length ? messages.join("; ") : null
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return (
      normaliseWorkerError(record.message) ??
      normaliseWorkerError(record.msg) ??
      normaliseWorkerError(record.detail)
    )
  }
  return null
}

function queryString(values: Record<string, string | number | boolean | null | undefined>): string {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value))
  })
  const suffix = query.toString()
  return suffix ? `?${suffix}` : ""
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/worker-management/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as
    | { detail?: unknown; error?: unknown }
    | T
    | null
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? payload.detail : null
    const error = payload && typeof payload === "object" && "error" in payload ? payload.error : null
    throw new WorkerApiError(
      normaliseWorkerError(detail) ??
        normaliseWorkerError(error) ??
        `Worker Management request failed (${response.status}).`,
      response.status,
    )
  }
  return payload as T
}

export function fetchAccounts(filters: {
  accountType?: AccountType
  isActive?: boolean
  search?: string
  pageSize?: number
} = {}) {
  return requestJson<ListResponse<WorkerAccount>>(
    `accounts${queryString({
      account_type: filters.accountType,
      is_active: filters.isActive,
      search: filters.search,
      page_size: filters.pageSize ?? 200,
    })}`,
  )
}

export function createAccount(payload: {
  account_code: string
  account_type: AccountType
  display_name: string
  group_leader_name: string | null
  default_group_size: number | null
  daily_rate: string
  farm_scheme: FarmScheme | null
  effective_from: string
}) {
  return requestJson<CreateWorkerAccountResponse>("accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateAccount(accountId: number, payload: {
  display_name: string
  group_leader_name: string | null
  default_group_size: number | null
  expected_row_version: number
}) {
  return requestJson<WorkerAccountRecord>(`accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function changeAccountState(
  accountId: number,
  active: boolean,
  expectedRowVersion: number,
  reason: string,
) {
  return requestJson<WorkerAccountRecord>(`accounts/${accountId}/${active ? "reactivate" : "inactivate"}`, {
    method: "POST",
    body: JSON.stringify({ expected_row_version: expectedRowVersion, reason }),
  })
}

export function addWageRate(accountId: number, payload: {
  daily_rate: string
  farm_scheme: FarmScheme | null
  effective_from: string
}) {
  return requestJson<WageRateRecord>(`accounts/${accountId}/wage-rates`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function fetchDailyWages(workDate: string) {
  return requestJson<DailyWageResponse>(`daily-wages${queryString({ work_date: workDate })}`)
}

export function saveDailyWageBatch(workDate: string, items: Array<{
  account_id: number
  client_operation_id: string
  attendance: string | null
  group_attendee_count: number | null
  notes: string | null
  expected_row_version: number | null
}>) {
  return requestJson(`daily-wages/${workDate}/batch`, {
    method: "POST",
    body: JSON.stringify({ items }),
  })
}

export function fetchCurrentWeek(onDate?: string) {
  return requestJson<WorkWeek>(`weeks/current${queryString({ on_date: onDate })}`)
}

export function fetchSettlements(weekId: number) {
  return requestJson<SettlementResponse>(`weeks/${weekId}/settlements`)
}

export function updateWeeklyPayment(
  weekId: number,
  accountId: number,
  weeklyPayment: string,
  expectedRowVersion: number | null,
) {
  return requestJson(`weeks/${weekId}/settlements/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify({ weekly_payment: weeklyPayment, expected_row_version: expectedRowVersion }),
  })
}

export function closeWeek(weekId: number, expectedRowVersion: number) {
  return requestJson(`weeks/${weekId}/close`, {
    method: "POST",
    body: JSON.stringify({ expected_row_version: expectedRowVersion }),
  })
}

export function markWeekPaid(weekId: number, expectedRowVersion: number, paymentReference: string) {
  return requestJson(`weeks/${weekId}/mark-paid`, {
    method: "POST",
    body: JSON.stringify({
      expected_row_version: expectedRowVersion,
      payment_reference: paymentReference || null,
    }),
  })
}

export function reopenWeek(weekId: number, expectedRowVersion: number, reason: string) {
  return requestJson(`weeks/${weekId}/reopen`, {
    method: "POST",
    body: JSON.stringify({ expected_row_version: expectedRowVersion, reason }),
  })
}

export function fetchLedger(filters: {
  accountId?: number
  weekId?: number
  startDate?: string
  endDate?: string
  transactionType?: string
  accountType?: AccountType
  accountState?: string
  search?: string
  pageSize?: number
} = {}) {
  return requestJson<ListResponse<LedgerTransaction>>(
    `ledger/transactions${queryString({
      account_id: filters.accountId,
      week_id: filters.weekId,
      start_date: filters.startDate,
      end_date: filters.endDate,
      transaction_type: filters.transactionType,
      account_type: filters.accountType,
      account_state: filters.accountState,
      search: filters.search,
      page_size: filters.pageSize ?? 200,
    })}`,
  )
}

export function createLedgerTransaction(payload: {
  client_operation_id: string
  account_id: number
  transaction_date: string
  transaction_type: ManualTransactionType
  amount: string
  reference: string | null
  notes: string | null
}) {
  return requestJson<LedgerTransaction>("ledger/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function fetchDashboard(weekId?: number) {
  return requestJson<DashboardResponse>(`dashboard${queryString({ week_id: weekId })}`)
}

export function fetchWageReport(filters: {
  weekId?: number
  accountType?: AccountType
  settlementStatus?: string
  startDate?: string
  endDate?: string
  search?: string
  pageSize?: number
} = {}) {
  return requestJson<ListResponse<WageReportRow>>(
    `reports/wages${queryString({
      week_id: filters.weekId,
      account_type: filters.accountType,
      settlement_status: filters.settlementStatus,
      start_date: filters.startDate,
      end_date: filters.endDate,
      search: filters.search,
      page_size: filters.pageSize ?? 200,
    })}`,
  )
}

export function pushWorkerSync(operations: WorkerSyncOperation[]) {
  return requestJson<WorkerSyncPushResponse>("sync/push", {
    method: "POST",
    body: JSON.stringify({ operations }),
  })
}

export function pullWorkerSync(cursor: number, limit = 250) {
  return requestJson<WorkerSyncPullResponse>(
    `sync/pull${queryString({ cursor, limit })}`,
  )
}
