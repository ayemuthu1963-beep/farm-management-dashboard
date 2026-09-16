import type { CoconutCountingSession, CoconutNumeric } from "@/lib/coconut-counting-api"

export type ReconciliationNumeric = number | string

export interface CoconutCountingReconciliationSession {
  session_uuid: string
  harvest_cycle: number
  plot: 1 | 2
  harvest_date: string
  status: "ACTIVE" | "COMPLETED" | "ENDED"
  entries: number
  grade_a: ReconciliationNumeric
  grade_b: ReconciliationNumeric
  count_b: ReconciliationNumeric
  combined: ReconciliationNumeric
  physical: ReconciliationNumeric
  last_sync: string
}

export interface CoconutCountingReconciliationPlot {
  harvest_cycle: number
  plot: 1 | 2
  session_count: number
  entries: number
  grade_a: ReconciliationNumeric
  grade_b: ReconciliationNumeric
  count_b: ReconciliationNumeric
  combined: ReconciliationNumeric
  physical: ReconciliationNumeric
  harvested: number | null
  rejection: ReconciliationNumeric | null
  grade_a_percent: ReconciliationNumeric | null
  grade_b_percent: ReconciliationNumeric | null
  rejection_percent: ReconciliationNumeric | null
  harvested_revision: number
  harvested_updated_at: string | null
  harvested_updated_by: string | null
  last_sync: string
}

export interface CoconutCountingCycleReconciliation {
  harvest_cycle: number
  sessions: CoconutCountingReconciliationSession[]
  plots: CoconutCountingReconciliationPlot[]
}

export interface CoconutCountingReconciliationResponse {
  cycles: CoconutCountingCycleReconciliation[]
  unassigned_session_count: number
}

export type CoconutCountingReconciliationStatus = "loading" | "ready" | "empty" | "error"

export type CoconutCountingReconciliationInitialResult =
  | { status: "ready"; data: CoconutCountingReconciliationResponse }
  | { status: "empty"; data: CoconutCountingReconciliationResponse }
  | { status: "error"; error: string }

export interface CoconutCountingReconciliationInitialState {
  data: CoconutCountingReconciliationResponse | null
  cycleOptions: number[]
  selectedCycle: number | null
  status: Exclude<CoconutCountingReconciliationStatus, "loading">
  error: string
}

export interface CoconutCountingWorkbookValues {
  gradeA: number
  countB: number
  gradeB: number
  combined: number
  physical: number
}

export function reconciliationDataResult(
  data: CoconutCountingReconciliationResponse,
): CoconutCountingReconciliationInitialResult {
  return data.cycles.length > 0
    ? { status: "ready", data }
    : { status: "empty", data }
}

export function reconciliationInitialState(
  result: CoconutCountingReconciliationInitialResult,
): CoconutCountingReconciliationInitialState {
  if (result.status === "error") {
    return {
      data: null,
      cycleOptions: [],
      selectedCycle: null,
      status: "error",
      error: result.error,
    }
  }

  const cycleOptions = result.data.cycles.map((cycle) => cycle.harvest_cycle)
  return {
    data: result.data,
    cycleOptions,
    selectedCycle: cycleOptions[0] ?? null,
    status: result.status,
    error: "",
  }
}

export function reconciliationNumber(value: ReconciliationNumeric | CoconutNumeric | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function calculateWorkbookValues(
  gradeAValue: ReconciliationNumeric | CoconutNumeric | null | undefined,
  countBValue: ReconciliationNumeric | CoconutNumeric | null | undefined,
): CoconutCountingWorkbookValues {
  const gradeA = reconciliationNumber(gradeAValue) ?? 0
  const countB = reconciliationNumber(countBValue) ?? 0
  const gradeB = countB * 2
  return {
    gradeA,
    countB,
    gradeB,
    combined: gradeA + countB,
    physical: gradeA + gradeB,
  }
}

export function workbookValuesForSession(session: CoconutCountingSession): CoconutCountingWorkbookValues {
  return calculateWorkbookValues(session.total_grade_a, session.total_grade_b)
}

export function formatReconciliationNumber(value: ReconciliationNumeric | null | undefined): string {
  const number = reconciliationNumber(value)
  return number === null ? "—" : number.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

export function formatReconciliationPercent(value: ReconciliationNumeric | null): string {
  const number = reconciliationNumber(value)
  return number === null ? "—" : `${number.toLocaleString("en-IN", { maximumFractionDigits: 0 })}%`
}
