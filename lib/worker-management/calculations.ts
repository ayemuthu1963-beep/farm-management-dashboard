import type {
  Account,
  FarmAttendance,
  LoanTransaction,
  OutsideAttendance,
  WageEntry,
} from "./types"

export const farmAttendanceMultiplier: Record<FarmAttendance, number> = {
  Full: 1,
  Half: 0.5,
  "One-third": 1 / 3,
  Absent: 0,
}

export const outsideAttendanceMultiplier: Record<OutsideAttendance, number> = {
  Full: 1,
  Absent: 0,
}

export const farmAttendanceOptions: FarmAttendance[] = ["Full", "Half", "One-third", "Absent"]
export const outsideAttendanceOptions: OutsideAttendance[] = ["Full", "Absent"]

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatRupees(amount: number): string {
  const rounded = round2(amount)
  return `₹${rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

export function formatSignedRupees(amount: number): string {
  const rounded = round2(amount)
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : ""
  return `${sign}₹${Math.abs(rounded).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

/**
 * Parses an ISO date (YYYY-MM-DD) as UTC midnight. All farm-week math is done in UTC so
 * results never shift across day boundaries in non-UTC runtimes (e.g. IST).
 */
function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function formatDisplayDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Farm weeks run Saturday–Friday (inclusive). Returns the ISO date of the Saturday that
 * starts the farm week containing the given ISO date.
 */
export function getWeekStart(iso: string): string {
  const date = parseISODate(iso)
  const day = date.getUTCDay() // 0 = Sunday … 6 = Saturday
  const diff = -((day + 1) % 7) // Saturday → 0, Sunday → -1, … Friday → -6
  date.setUTCDate(date.getUTCDate() + diff)
  return toISODate(date)
}

/**
 * Returns the ISO date of the Friday that ends the farm week containing the given ISO date,
 * i.e. exactly six days after the Saturday start (inclusive Saturday–Friday range).
 */
export function getWeekEnd(iso: string): string {
  const start = parseISODate(getWeekStart(iso))
  start.setUTCDate(start.getUTCDate() + 6)
  return toISODate(start)
}

export function isDateInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}

export function shiftWeek(weekStartIso: string, weeks: number): string {
  const date = parseISODate(weekStartIso)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return toISODate(date)
}

interface WageInput {
  farmAttendance?: FarmAttendance
  outsideAttendance?: OutsideAttendance
  groupCount?: number
}

/**
 * Computes the wage amount for a single day's entry, based on the account type:
 * - Farm: daily rate × attendance multiplier (Full / Half / One-third / Absent)
 * - Outside: daily rate × attendance multiplier (Full / Absent)
 * - Group: rate per attending head × number of heads present
 */
export function computeWageAmount(account: Account, input: WageInput): number {
  if (account.type === "Farm" && input.farmAttendance) {
    return round2(account.rate * farmAttendanceMultiplier[input.farmAttendance])
  }
  if (account.type === "Outside" && input.outsideAttendance) {
    return round2(account.rate * outsideAttendanceMultiplier[input.outsideAttendance])
  }
  if (account.type === "Group" && typeof input.groupCount === "number") {
    return round2(account.rate * input.groupCount)
  }
  return 0
}

/** Finds an existing wage entry for the same account and date, if one exists. */
export function findWageEntryForDate(
  entries: WageEntry[],
  accountId: string,
  date: string,
): WageEntry | undefined {
  return entries.find((entry) => entry.accountId === accountId && entry.date === date)
}

/**
 * Inserts or updates a wage entry, enforcing a single entry per account per date.
 * If an entry already exists for the same account and date, it is replaced in place.
 */
export function upsertWageEntry(entries: WageEntry[], entry: WageEntry): WageEntry[] {
  const index = entries.findIndex((existing) => existing.accountId === entry.accountId && existing.date === entry.date)
  if (index === -1) {
    return [...entries, entry]
  }
  const next = [...entries]
  next[index] = { ...next[index], ...entry, id: next[index].id }
  return next
}

export function getWagesForWeek(
  entries: WageEntry[],
  accountId: string,
  weekStart: string,
  weekEnd: string,
): number {
  return round2(
    entries
      .filter((entry) => entry.accountId === accountId && isDateInRange(entry.date, weekStart, weekEnd))
      .reduce((total, entry) => total + entry.wage, 0),
  )
}

/**
 * Cash-out transaction types: money handed to the worker/group. These are recorded as
 * negative amounts in the ledger (cash received by a worker reduces what they are owed).
 */
export function isCashOutTransaction(type: LoanTransaction["type"]): boolean {
  return type === "Cash Loan/Advance" || type === "Deposit Withdrawal"
}

/**
 * Cash Paid During Week = the signed total of cash-out transactions (Cash Loan/Advance,
 * Deposit Withdrawal) recorded against the account within the selected farm week. It is
 * negative because cash paid out to the worker is a cash-out event. This figure is
 * informational only — it is displayed read-only in Weekly Settlement and is NEVER
 * subtracted a second time when computing Balance to Loan.
 */
export function getCashPaidDuringWeek(
  transactions: LoanTransaction[],
  accountId: string,
  weekStart: string,
  weekEnd: string,
): number {
  return round2(
    transactions
      .filter(
        (transaction) =>
          transaction.accountId === accountId &&
          isCashOutTransaction(transaction.type) &&
          isDateInRange(transaction.date, weekStart, weekEnd),
      )
      .reduce((total, transaction) => total + transaction.amount, 0),
  )
}

/** Balance to Loan = Wages − Weekly Payment. Cash already paid during the week is informational only. */
export function getBalanceToLoan(wages: number, weeklyPayment: number): number {
  return round2(wages - weeklyPayment)
}

export function getLoanBalance(transactions: LoanTransaction[], accountId: string): number {
  return round2(
    transactions
      .filter((transaction) => transaction.accountId === accountId)
      .reduce((total, transaction) => total + transaction.amount, 0),
  )
}

export function getAccountLoanTransactions(transactions: LoanTransaction[], accountId: string): LoanTransaction[] {
  return transactions
    .filter((transaction) => transaction.accountId === accountId)
    .toSorted((a, b) => (a.date < b.date ? 1 : -1))
}
