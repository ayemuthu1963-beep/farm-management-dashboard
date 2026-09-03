export type WorkerV2MoneyFields = {
  opening_balance: string | null
  repayment_total: string | null
  advance_total: string | null
  closing_balance: string | null
}

export type WorkerV2FinancialRow = WorkerV2MoneyFields & {
  week_start: string
  account_code: string
  display_name: string
  financial_applicable: boolean
}

export type WorkerV2ComparisonRow = {
  week_start: string
  account_code: string
  v1_classified_fixture: WorkerV2FinancialRow | null
  v2: WorkerV2FinancialRow | null
  matches: boolean
}

export type WorkerV2WeekTotal = {
  week_start: string
  v1_classified_fixture: WorkerV2MoneyFields
  v2: WorkerV2MoneyFields
  matches: boolean
}

export type WorkerV2ComparisonResponse = {
  source: "SYNTHETIC_AUTHORISED_VALUES"
  classification_model: "PRODUCTION_DISTRIBUTION_PATTERN_STRICT_CONTINUITY"
  migration_boundary: {
    boundary_date: string
    mode: "STRICT_PREVIOUS_CLOSING"
    legacy_history_through: string
    strict_opening_total: string
    defective_v1_display_total: string
    classified_variance: string
    variance_explained: boolean
  }
  v1_row_count: number
  v2_classified_event_count: number
  unresolved_count: number
  unresolved_balance_records: number
  duplicate_count: number
  missing_count: number
  extra_count: number
  balance_differences: number
  canonical_sha256: string
  passed: boolean
  totals: WorkerV2WeekTotal[]
  rows: WorkerV2ComparisonRow[]
}
