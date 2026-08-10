export type AccountType = "FARM" | "OUTSIDE" | "GROUP"
export type FarmScheme = "TWO_OPTION" | "THREE_OPTION"
export type AttendanceValue = "ABSENT" | "ONE_THIRD" | "HALF" | "FULL"
export type AccountState = "LOAN_OUTSTANDING" | "SETTLED" | "DEPOSIT_HELD"
export type WeekStatus = "NOT_STARTED" | "DRAFT" | "CLOSED" | "PAID" | "REOPENED"
export type SettlementStatus = "DRAFT" | "CLOSED" | "PAID" | null
export type ManualTransactionType =
  | "CASH_ADVANCE"
  | "EXTRA_WAGE_CASH"
  | "DEPOSIT_WITHDRAWAL"
  | "CASH_REPAYMENT"
  | "DEPOSIT_CONTRIBUTION"

export type Pagination = {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export type WorkerAccount = {
  account_id: number
  account_code: string
  account_type: AccountType
  display_name: string
  group_leader_name: string | null
  default_group_size: number | null
  is_active: boolean
  inactive_at: string | null
  inactive_reason: string | null
  row_version: number
  wage_rate_id: number | null
  daily_rate: string | null
  farm_scheme: FarmScheme | null
  rate_basis: "PER_DAY" | "PER_WORKER_DAY" | null
  effective_from: string | null
  effective_to: string | null
  signed_balance: string
  account_state: AccountState
}

export type WorkerAccountRecord = Omit<
  WorkerAccount,
  | "wage_rate_id"
  | "daily_rate"
  | "farm_scheme"
  | "rate_basis"
  | "effective_from"
  | "effective_to"
  | "signed_balance"
  | "account_state"
>

export type WageRateRecord = {
  wage_rate_id: number
  account_id: number
  daily_rate: string
  farm_scheme: FarmScheme | null
  rate_basis: "PER_DAY" | "PER_WORKER_DAY"
  effective_from: string
  effective_to: string | null
}

export type CreateWorkerAccountResponse = {
  account: WorkerAccountRecord
  wage_rate: WageRateRecord
}

export type WorkWeek = {
  week_id: number | null
  start_date: string
  end_date: string
  status: WeekStatus
  version_no: number
  row_version: number | null
}

export type DailyWageItem = {
  attendance_id: number | null
  account_id: number
  account_code: string
  account_type: AccountType
  display_name: string
  group_leader_name: string | null
  default_group_size: number | null
  work_date: string
  attendance_value: AttendanceValue | null
  group_attendee_count: number | null
  wage_rate_snapshot: string
  scheme_snapshot: FarmScheme | null
  daily_wage_amount: string
  notes: string | null
  entry_status: string
  row_version: number | null
  is_default: boolean
}

export type AvailableDailyAccount = Pick<
  WorkerAccount,
  | "account_id"
  | "account_code"
  | "account_type"
  | "display_name"
  | "group_leader_name"
  | "default_group_size"
  | "wage_rate_id"
  | "daily_rate"
  | "farm_scheme"
  | "rate_basis"
>

export type DailyWageResponse = {
  work_date: string
  week: WorkWeek
  items: DailyWageItem[]
  available_accounts: AvailableDailyAccount[]
}

export type SettlementRow = {
  account_id: number
  account_code: string
  account_type: AccountType
  display_name: string
  is_active: boolean
  wages: string
  cash_paid_during_week: string
  weekly_payment: string
  balance_to_loan: string
  settlement_id: number | null
  settlement_status: SettlementStatus
  ledger_transaction_id: number | null
  row_version: number | null
  current_signed_balance: string
  projected_signed_balance: string
}

export type SettlementResponse = {
  week: WorkWeek
  items: SettlementRow[]
}

export type LedgerTransaction = {
  transaction_id: number
  account_id: number
  week_id: number | null
  transaction_date: string
  transaction_type: string
  signed_amount: string
  reference: string | null
  notes: string | null
  source_type: string
  posting_status: string
  reversal_of_transaction_id: number | null
  created_at: string
  account_code: string
  account_type: AccountType
  display_name: string
  group_leader_name: string | null
  running_balance: string
  current_signed_balance: string
  current_account_state: AccountState
}

export type DashboardBreakdown = {
  week_id: number
  start_date: string
  end_date: string
  week_status: WeekStatus
  week_version: number
  account_type: AccountType
  account_count: number
  attendance_person_days: string
  attended_entry_count: number
  total_wages: string
  total_cash_paid_during_week: string
  total_weekly_payment: string
  total_balance_to_loan: string
  paid_account_count: number
  unpaid_account_count: number
}

export type DashboardTotals = Omit<
  DashboardBreakdown,
  "week_id" | "start_date" | "end_date" | "week_status" | "week_version" | "account_type"
>

export type DashboardResponse = {
  week: WorkWeek | null
  breakdown: DashboardBreakdown[]
  totals: DashboardTotals
}

export type WageReportRow = SettlementRow & {
  week_id: number
  start_date: string
  end_date: string
  week_status: WeekStatus
  week_version: number
  settlement_status: SettlementStatus
  group_leader_name: string | null
}

export type ListResponse<T> = {
  items: T[]
  pagination: Pagination
}
