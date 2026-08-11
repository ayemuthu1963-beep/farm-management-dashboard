export type AccountType = "Farm" | "Outside" | "Group"
export type AccountStatus = "Active" | "Inactive"

export type FarmAttendance = "Full" | "Half" | "One-third" | "Absent"
export type OutsideAttendance = "Full" | "Absent"

export type SyncStatus = "Saved on device" | "Waiting to sync" | "Synced" | "Conflict"
export type PaidStatus = "Paid" | "Unpaid"

export type LoanTransactionType =
  | "Cash Loan/Advance"
  | "Wage Repayment"
  | "Cash Repayment"
  | "Deposit Contribution"
  | "Deposit Withdrawal"

export interface StatusEvent {
  date: string
  status: AccountStatus
  note: string
}

export interface Account {
  id: string
  type: AccountType
  name: string
  phone?: string
  joinDate: string
  /** Daily wage for Farm/Outside accounts, or rate per attending head for Group accounts. */
  rate: number
  status: AccountStatus
  statusHistory: StatusEvent[]
  /** Group accounts only */
  groupHead?: string
  memberCount?: number
}

export interface WageEntry {
  id: string
  accountId: string
  /** ISO date, yyyy-mm-dd */
  date: string
  farmAttendance?: FarmAttendance
  outsideAttendance?: OutsideAttendance
  groupCount?: number
  wage: number
  syncStatus: SyncStatus
  paidStatus: PaidStatus
}

export interface LoanTransaction {
  id: string
  accountId: string
  /** ISO date, yyyy-mm-dd */
  date: string
  type: LoanTransactionType
  /** Positive increases the balance the account owes the farm; negative reduces it. */
  amount: number
  notes: string
}

export const navItems = [
  "Dashboard",
  "Daily Wage Entry",
  "Worker Directory",
  "Weekly Settlement",
  "Loan Register",
  "Query",
] as const

export type WorkerSection = (typeof navItems)[number]
