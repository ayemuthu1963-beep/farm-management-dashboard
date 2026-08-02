export const BEETLE_TRAP_DATA_UPDATED_EVENT = "mfms:beetle-trap-data-updated"

export interface BeetleTrapSyncResult {
  status: "completed" | "partial"
  submissions_checked: number
  new_records_imported: number
  already_imported_records_skipped: number
  records_rejected_or_failed: number
  sync_completed_at: string
  latest_successful_sync_at: string
  message: string
}

export function parseBeetleTrapSyncResult(value: unknown): BeetleTrapSyncResult | null {
  if (!value || typeof value !== "object") return null
  const result = value as Partial<BeetleTrapSyncResult>
  if (
    (result.status !== "completed" && result.status !== "partial") ||
    typeof result.new_records_imported !== "number" ||
    typeof result.already_imported_records_skipped !== "number" ||
    typeof result.records_rejected_or_failed !== "number" ||
    typeof result.sync_completed_at !== "string" ||
    typeof result.latest_successful_sync_at !== "string"
  ) {
    return null
  }
  return result as BeetleTrapSyncResult
}

export function beetleTrapSyncMessage(result: BeetleTrapSyncResult): string {
  if (typeof result.message === "string" && result.message.trim()) return result.message
  return `Sync completed: ${result.new_records_imported} new records imported, ${result.already_imported_records_skipped} already up to date.`
}

export function beetleTrapSyncErrorMessage(value: unknown): string {
  if (value && typeof value === "object") {
    const response = value as { message?: unknown; detail?: unknown }
    if (typeof response.message === "string" && response.message.trim()) return response.message
    if (typeof response.detail === "string" && response.detail.trim()) return response.detail
  }
  return "ODK sync could not be completed. Existing Beetle Trap data has not been changed."
}
