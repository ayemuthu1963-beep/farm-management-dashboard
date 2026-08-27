import type {
  AccountState,
  AccountType,
  AttendanceValue,
  FarmScheme,
  WeekStatus,
} from "./worker-management-types"

type AccountIdentity = {
  account_code: string
  account_id?: number
  display_name?: string
}

const accountCodeCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
})

export function compareAccountCodes(left: AccountIdentity, right: AccountIdentity): number {
  const codeOrder = accountCodeCollator.compare(left.account_code.trim(), right.account_code.trim())
  if (codeOrder !== 0) return codeOrder

  const nameOrder = accountCodeCollator.compare(
    left.display_name?.trim() ?? "",
    right.display_name?.trim() ?? "",
  )
  if (nameOrder !== 0) return nameOrder

  return (left.account_id ?? 0) - (right.account_id ?? 0)
}

export function workerAccountOptionLabel(account: AccountIdentity): string {
  return `${account.account_code} · ${account.display_name ?? ""}`.trim()
}

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

export function formatWholeINR(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
  return {
    FULL: "Full",
    TWO_THIRDS: "2/3",
    HALF: "Half",
    ONE_THIRD: "1/3",
    ABSENT: "Absent",
  }[value]
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

export const wageDaySlots = [
  { key: "sat", day: "Sat" },
  { key: "sun", day: "Sun" },
  { key: "mon", day: "Mon" },
  { key: "tue", day: "Tue" },
  { key: "wed", day: "Wed" },
  { key: "thu", day: "Thu" },
  { key: "fri", day: "Fri" },
] as const

export type WageDayKey = (typeof wageDaySlots)[number]["key"]
export type WageWeekId = "current" | "previous"

export type WageWeek = {
  id: WageWeekId
  label: string
  heading: string
  startDate: string
  endDate: string
  exportFile: string
  days: Array<{
    key: WageDayKey
    day: (typeof wageDaySlots)[number]["day"]
    date: string
    isoDate: string
  }>
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function wageDateParts(value: string) {
  const date = utcDate(value)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return {
    day: date.getUTCDate(),
    day2: String(date.getUTCDate()).padStart(2, "0"),
    month: months[date.getUTCMonth()],
    month2: String(date.getUTCMonth() + 1).padStart(2, "0"),
    year: date.getUTCFullYear(),
  }
}

export function saturdayForDate(value: string): string {
  const daysSinceSaturday = (utcDate(value).getUTCDay() + 1) % 7
  return addDays(value, -daysSinceSaturday)
}

function formatWageRange(startDate: string, endDate: string, compact: boolean) {
  const start = wageDateParts(startDate)
  const end = wageDateParts(endDate)

  if (start.year !== end.year) {
    return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`
  }
  if (start.month !== end.month) {
    return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`
  }
  return compact
    ? `${start.day}–${end.day} ${end.month} ${end.year}`
    : `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`
}

function wageExportFileName(startDate: string, endDate: string) {
  const start = wageDateParts(startDate)
  const end = wageDateParts(endDate)
  return `worker-wages-${start.day2}-${start.month}-${start.year}-to-${end.day2}-${end.month}-${end.year}.xlsx`
}

function buildWageWeek(id: WageWeekId, startDate: string): WageWeek {
  const endDate = addDays(startDate, 6)
  return {
    id,
    label: `${formatWageRange(startDate, endDate, true)} · ${id === "current" ? "current week" : "last week"}`,
    heading: formatWageRange(startDate, endDate, false),
    startDate,
    endDate,
    exportFile: wageExportFileName(startDate, endDate),
    days: wageDaySlots.map((slot, index) => {
      const isoDate = addDays(startDate, index)
      const parts = wageDateParts(isoDate)
      return {
        ...slot,
        date: `${parts.day2}.${parts.month2}`,
        isoDate,
      }
    }),
  }
}

export function buildWageWeeks(anchorDate = toDateInput()): Record<WageWeekId, WageWeek> {
  const currentStart = saturdayForDate(anchorDate)
  return {
    current: buildWageWeek("current", currentStart),
    previous: buildWageWeek("previous", addDays(currentStart, -7)),
  }
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function defaultSettlementDate(date = new Date()): string {
  const indiaDate = toDateInput(date)
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(date)
  return weekday === "Sat" ? addDays(indiaDate, -1) : indiaDate
}

export function calculateDailyWage(
  dailyRate: string | number,
  attendance: AttendanceValue | null,
  attendees: number | null,
  accountType: AccountType,
): number {
  const rateInPaise = Math.round(money(dailyRate) * 100)
  if (accountType === "GROUP") return Math.round(rateInPaise * Math.max(attendees ?? 0, 0)) / 100
  if (attendance === "TWO_THIRDS") return Math.floor((rateInPaise * 2) / 300)
  if (attendance === "ONE_THIRD") return Math.floor(rateInPaise / 300)
  const fraction = { FULL: 1, HALF: 0.5, ABSENT: 0 }[attendance ?? "ABSENT"]
  return Math.round(rateInPaise * fraction) / 100
}

export function normaliseWeeklyWageEntry({
  accountType,
  farmScheme,
  dailyWage,
  labourers,
  baseWage,
}: {
  accountType: AccountType
  farmScheme: FarmScheme | null
  dailyWage: string | number | null | undefined
  labourers: string | number | null | undefined
  baseWage: string | number | null | undefined
}): {
  attendance: AttendanceValue | null
  groupAttendeeCount: number | null
  wageRateSnapshot: number
} {
  const enteredWage = Math.max(0, money(dailyWage))
  const baseRate = Math.max(0, money(baseWage))

  if (accountType === "GROUP") {
    return {
      attendance: null,
      groupAttendeeCount: Math.max(0, money(labourers)),
      wageRateSnapshot: enteredWage > 0 ? enteredWage : baseRate,
    }
  }

  if (enteredWage === 0) {
    return {
      attendance: "ABSENT",
      groupAttendeeCount: null,
      wageRateSnapshot: baseRate,
    }
  }

  if (accountType === "FARM" && farmScheme === "THREE_OPTION") {
    if (enteredWage === Math.floor((baseRate * 2) / 3)) {
      return {
        attendance: "TWO_THIRDS",
        groupAttendeeCount: null,
        wageRateSnapshot: baseRate,
      }
    }
    if (enteredWage === Math.floor(baseRate / 3)) {
      return {
        attendance: "ONE_THIRD",
        groupAttendeeCount: null,
        wageRateSnapshot: baseRate,
      }
    }
  }

  if (accountType === "FARM" && farmScheme === "TWO_OPTION" && enteredWage === baseRate / 2) {
    return {
      attendance: "HALF",
      groupAttendeeCount: null,
      wageRateSnapshot: baseRate,
    }
  }

  return {
    attendance: "FULL",
    groupAttendeeCount: null,
    wageRateSnapshot: enteredWage,
  }
}
