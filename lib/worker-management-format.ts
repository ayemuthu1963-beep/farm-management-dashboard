import type { AccountState, AccountType, AttendanceValue, WeekStatus } from "./worker-management-types"

export function money(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatINR(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money(value))
}

export function formatSignedINR(value: string | number | null | undefined): string {
  const numeric = money(value)
  return `${numeric > 0 ? "+" : ""}${formatINR(numeric)}`
}

export function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatDayDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function accountTypeLabel(value: AccountType): string {
  return { FARM: "Farm Worker", OUTSIDE: "Outside Worker", GROUP: "Group" }[value]
}

export function attendanceLabel(value: AttendanceValue): string {
  return { FULL: "Full", HALF: "Half", ONE_THIRD: "1/3", ABSENT: "Absent" }[value]
}

export function weekStatusLabel(value: WeekStatus): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

export function accountStateLabel(value: AccountState): string {
  return {
    LOAN_OUTSTANDING: "Loan Outstanding",
    SETTLED: "Settled",
    DEPOSIT_HELD: "Deposit Held",
  }[value]
}

export function toDateInput(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function calculateDailyWage(
  dailyRate: string | number,
  attendance: AttendanceValue | null,
  attendees: number | null,
  accountType: AccountType,
): number {
  const rateInPaise = Math.round(money(dailyRate) * 100)
  if (accountType === "GROUP") return Math.round(rateInPaise * Math.max(attendees ?? 0, 0)) / 100
  const fraction = { FULL: 1, HALF: 0.5, ONE_THIRD: 1 / 3, ABSENT: 0 }[
    attendance ?? "ABSENT"
  ]
  return Math.round(rateInPaise * fraction) / 100
}
