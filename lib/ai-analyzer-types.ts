export type AnalyzerCompleteness = "complete" | "partial" | "no_data" | "not_configured" | "unavailable"
export type AnalyzerSeverity = "information" | "warning" | "critical"

export type AnalyzerSource = {
  source_name: string
  source_timestamp: string | null
  data_period_start: string | null
  data_period_end: string | null
  completeness_status: AnalyzerCompleteness
  units: Record<string, string>
  calculated_metrics: Record<string, unknown>
  missing_data_warnings: string[]
}
export type AnalyzerEvidenceValue = {
  name: string
  value: string | number | boolean | null
  unit: string
  source_name: string
}

export type AnalyzerSourceReference = {
  source_name: string
  record_ids: string[]
  source_timestamp: string | null
}

export type AnalyzerAlert = {
  alert_id: string
  rule_id: string
  rule_version: string
  severity: AnalyzerSeverity
  crop: string | null
  plot: string | null
  zone: string | null
  tree: string | null
  start_date: string | null
  end_date: string | null
  title: string
  deterministic_condition: string
  evidence_values: AnalyzerEvidenceValue[]
  source_records: AnalyzerSourceReference[]
  source_timestamps: Record<string, string | null>
  data_completeness_status: AnalyzerCompleteness
  confidence: "low" | "medium" | "high"
  ai_explanation: string | null
  suggested_field_checks: string[]
  generation_timestamp: string
  model_name: string | null
  prompt_version: string | null
  deterministic_fallback_explanation: string
  evidence_hash: string
  ai_usage: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
    estimated_cost_usd: number
    cache_hit: boolean
  } | null
}

export type AnalyzerResponse = {
  generated_at: string
  farm_status: "normal" | "attention" | "critical" | "data_incomplete"
  alert_counts: Record<AnalyzerSeverity, number>
  sources: AnalyzerSource[]
  alerts: AnalyzerAlert[]
  deterministic_rules_version: string
  ai_enabled: boolean
  ai_model: string | null
  prompt_version: string
  read_only: true
}
