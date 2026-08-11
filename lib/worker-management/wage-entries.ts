import { findAccount, initialAccounts } from "./accounts"
import { computeWageAmount } from "./calculations"
import type { WageEntry } from "./types"

/** Current farm week: Saturday 08 Aug 2026 – Friday 14 Aug 2026 (partially entered, unpaid). */
export const CURRENT_WEEK_START = "2026-08-08"
/** Previous farm week: Saturday 01 Aug 2026 – Friday 07 Aug 2026 (fully entered and paid). */
export const PREVIOUS_WEEK_START = "2026-08-01"

interface SeedRow {
  accountId: string
  date: string
  farmAttendance?: WageEntry["farmAttendance"]
  outsideAttendance?: WageEntry["outsideAttendance"]
  groupCount?: number
  syncStatus: WageEntry["syncStatus"]
  paidStatus: WageEntry["paidStatus"]
}

const seedRows: SeedRow[] = [
  // Previous week (Paid, Synced)
  { accountId: "FW-001", date: "2026-08-03", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-001", date: "2026-08-05", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-001", date: "2026-08-07", farmAttendance: "Half", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-002", date: "2026-08-03", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-002", date: "2026-08-05", farmAttendance: "One-third", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-002", date: "2026-08-07", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-003", date: "2026-08-03", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-003", date: "2026-08-05", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-003", date: "2026-08-07", farmAttendance: "Absent", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-004", date: "2026-08-03", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-004", date: "2026-08-05", farmAttendance: "Half", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "FW-004", date: "2026-08-07", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "OW-001", date: "2026-08-03", outsideAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "OW-001", date: "2026-08-05", outsideAttendance: "Absent", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "OW-002", date: "2026-08-03", outsideAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "OW-002", date: "2026-08-07", outsideAttendance: "Full", syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "GR-001", date: "2026-08-03", groupCount: 6, syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "GR-001", date: "2026-08-05", groupCount: 5, syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "GR-001", date: "2026-08-07", groupCount: 6, syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "GR-002", date: "2026-08-03", groupCount: 4, syncStatus: "Synced", paidStatus: "Paid" },
  { accountId: "GR-002", date: "2026-08-07", groupCount: 3, syncStatus: "Synced", paidStatus: "Paid" },

  // Current week (Unpaid, mixed sync status to demonstrate the legend)
  { accountId: "FW-001", date: "2026-08-10", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Unpaid" },
  { accountId: "FW-001", date: "2026-08-11", farmAttendance: "Full", syncStatus: "Waiting to sync", paidStatus: "Unpaid" },
  { accountId: "FW-002", date: "2026-08-10", farmAttendance: "Half", syncStatus: "Synced", paidStatus: "Unpaid" },
  { accountId: "FW-002", date: "2026-08-11", farmAttendance: "Full", syncStatus: "Saved on device", paidStatus: "Unpaid" },
  { accountId: "FW-003", date: "2026-08-10", farmAttendance: "Full", syncStatus: "Synced", paidStatus: "Unpaid" },
  { accountId: "FW-003", date: "2026-08-11", farmAttendance: "One-third", syncStatus: "Conflict", paidStatus: "Unpaid" },
  { accountId: "FW-004", date: "2026-08-10", farmAttendance: "Absent", syncStatus: "Synced", paidStatus: "Unpaid" },
  { accountId: "FW-004", date: "2026-08-11", farmAttendance: "Full", syncStatus: "Saved on device", paidStatus: "Unpaid" },
  { accountId: "OW-001", date: "2026-08-10", outsideAttendance: "Full", syncStatus: "Synced", paidStatus: "Unpaid" },
  { accountId: "OW-002", date: "2026-08-10", outsideAttendance: "Absent", syncStatus: "Waiting to sync", paidStatus: "Unpaid" },
  { accountId: "GR-001", date: "2026-08-10", groupCount: 6, syncStatus: "Synced", paidStatus: "Unpaid" },
  { accountId: "GR-001", date: "2026-08-11", groupCount: 4, syncStatus: "Saved on device", paidStatus: "Unpaid" },
  { accountId: "GR-002", date: "2026-08-10", groupCount: 4, syncStatus: "Synced", paidStatus: "Unpaid" },
]

export const initialWageEntries: WageEntry[] = seedRows.map((row, index) => {
  const account = findAccount(initialAccounts, row.accountId)
  if (!account) {
    throw new Error(`Unknown account id in wage entry seed data: ${row.accountId}`)
  }
  return {
    id: `wage-${String(index + 1).padStart(3, "0")}`,
    accountId: row.accountId,
    date: row.date,
    farmAttendance: row.farmAttendance,
    outsideAttendance: row.outsideAttendance,
    groupCount: row.groupCount,
    wage: computeWageAmount(account, row),
    syncStatus: row.syncStatus,
    paidStatus: row.paidStatus,
  }
})
