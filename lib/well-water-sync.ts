export const WELL_WATER_SYNC_FAILURE_MESSAGE =
  "ODK sync could not be completed. Existing data has not been changed."

export interface WellWaterSyncCompletedResult {
  status: "completed"
  submissions_checked: number
  new_records_imported: number
  already_imported_records_skipped: number
  historical_records_skipped: number
  records_rejected_or_failed: number
  sync_started_at: string
  sync_completed_at: string
  latest_successful_sync_at: string
  message: string
}

export interface WellWaterSyncFailureResult {
  status: "conflict" | "failed"
  message: string
  sync_started_at?: string
  sync_completed_at?: string
}

export type WellWaterSyncResult =
  | WellWaterSyncCompletedResult
  | WellWaterSyncFailureResult

export function isCompletedWellWaterSync(
  value: unknown,
): value is WellWaterSyncCompletedResult {
  if (!value || typeof value !== "object") return false
  const result = value as Partial<WellWaterSyncCompletedResult>
  return (
    result.status === "completed" &&
    typeof result.new_records_imported === "number" &&
    typeof result.already_imported_records_skipped === "number" &&
    typeof result.sync_completed_at === "string"
  )
}

export function formatWellWaterSyncSuccess(
  result: WellWaterSyncCompletedResult,
): string {
  const newRecords = result.new_records_imported
  const alreadyImported = result.already_imported_records_skipped
  const rejected = result.records_rejected_or_failed
  const rejectedMessage =
    rejected > 0
      ? ` ${rejected} ${rejected === 1 ? "record was" : "records were"} rejected or failed.`
      : ""
  return `Sync completed: ${newRecords} new ${newRecords === 1 ? "record" : "records"} imported, ${alreadyImported} already up to date.${rejectedMessage}`
}

export function getWellWaterSyncErrorMessage(value: unknown): string {
  if (value && typeof value === "object") {
    const result = value as { message?: unknown; detail?: unknown }
    if (typeof result.message === "string" && result.message.trim()) {
      return result.message
    }
    if (typeof result.detail === "string" && result.detail.trim()) {
      return result.detail
    }
  }
  return WELL_WATER_SYNC_FAILURE_MESSAGE
}
