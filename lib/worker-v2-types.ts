export type WorkerV2MoneyFields = {
  opening_balance: string | null
  repayment_total: string | null
  advance_total: string | null
  closing_balance: string | null
}

export type WorkerV2FinancialRow = WorkerV2MoneyFields & {
  week_start: string
  week_end: string
  week_status: "PLANNED" | "OPEN" | "CLOSED"
  account_code: string
  display_name: string
  account_type: "FARM" | "GROUP" | "TEMPLATE"
  financial_applicable: boolean
  own_earnings: string
  has_repayment: boolean
  has_advance: boolean
}

export type WorkerV2WeekTotal = WorkerV2MoneyFields & {
  week_start: string
  own_earnings: string
}

export type WorkerV2AttendanceEntry = {
  attendance_id: string
  week_start: string
  account_code: string
  work_date: string
  attendance_value: "ABSENT" | "ONE_THIRD" | "HALF" | "TWO_THIRDS" | "FULL" | null
  group_attendee_count: number | null
  wage_rate_snapshot: string
  scheme_snapshot: "TWO_OPTION" | "THREE_OPTION" | null
  daily_wage_amount: string
  row_version: number
}

export type WorkerV2StateResponse = {
  source: "V2_FRESH_START"
  start_week: "2026-08-29"
  historical_records_imported: 0
  initialization: {
    initialized: boolean
    initialization_id: string | null
    week_start: string | null
    opening_total: string | null
    initialized_at: string | null
    initialized_by: string | null
  }
  duplicate_count: number
  missing_opening_count: number
  unresolved_count: number
  unresolved_balance_records: number
  canonical_sha256: string
  passed: boolean
  totals: WorkerV2WeekTotal[]
  rows: WorkerV2FinancialRow[]
  attendance_entries: WorkerV2AttendanceEntry[]
}

export type WorkerV2OpeningInput = {
  account_code: string
  opening_balance: string | null
}

export type WorkerV2InitializeRequest = {
  initialization_id: string
  idempotency_key: string
  week_start: string
  opening_balances: WorkerV2OpeningInput[]
  reason: string
}

export type WorkerV2FinancialEventRequest = {
  event_id: string
  idempotency_key: string
  business_key: string
  account_code: string
  week_start: string
  event_date: string
  event_type: "ADVANCE" | "REPAYMENT"
  amount: string
  effect_sign: 1
  reason: string
}

export type WorkerV2AttendanceRequest = {
  attendance_id: string
  idempotency_key: string
  account_code: string
  work_date: string
  attendance_value: WorkerV2AttendanceEntry["attendance_value"]
  group_attendee_count: number
  wage_rate_snapshot: string
  scheme_snapshot: WorkerV2AttendanceEntry["scheme_snapshot"]
  daily_wage_amount: string
  expected_row_version: number | null
}

export type WorkerV2CloseRequest = {
  idempotency_key: string
  close_event_id: string
  reason: string
}
