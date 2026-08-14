"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Search,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchAccounts, fetchCurrentWeek, fetchDailyWages } from "@/lib/worker-management-api"
import { MOVED_WAGE_PLACEHOLDER_NOTE } from "@/lib/worker-management-constants"
import {
  accountTypeLabel,
  addDays,
  compareAccountCodes,
  formatDate,
  formatWholeINR,
  toDateInput,
} from "@/lib/worker-management-format"
import {
  cacheDailyWages,
  cacheWorkerAccounts,
  readCachedDailyWages,
  readCachedWorkerAccounts,
} from "@/lib/worker-management-offline"
import type {
  AccountType,
  AttendanceValue,
  DailyWageItem,
  DailyWageResponse,
  WorkWeek,
  WorkerAccount,
} from "@/lib/worker-management-types"
import { buttonClassName, EmptyState, LoadingState, Notice, SectionTitle, WorkerButton } from "./worker-ui"
import { useWorkerOffline } from "./worker-offline-provider"

type AttendanceRosterAccount = Pick<
  WorkerAccount,
  "account_id" | "account_code" | "account_type" | "display_name" | "group_leader_name"
>

type DailyResponses = Record<string, DailyWageResponse>

const attendanceLabels: Record<AttendanceValue, string> = {
  FULL: "Full attendance",
  TWO_THIRDS: "Two-thirds attendance",
  HALF: "Half attendance",
  ONE_THIRD: "One-third attendance",
  ABSENT: "Absent",
}

const partialLabels: Partial<Record<AttendanceValue, string>> = {
  TWO_THIRDS: "2/3",
  HALF: "1/2",
  ONE_THIRD: "1/3",
}

function weekBounds(value: string): Pick<WorkWeek, "start_date" | "end_date"> {
  const date = new Date(`${value}T00:00:00Z`)
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7
  const start = addDays(value, -daysSinceSaturday)
  return { start_date: start, end_date: addDays(start, 6) }
}

function datesForWeek(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startDate, index))
}

function dayHeading(value: string): { weekday: string; date: string } {
  const date = new Date(`${value}T00:00:00`)
  return {
    weekday: date.toLocaleDateString("en-IN", { weekday: "short" }),
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  }
}

function mergeRoster(
  accounts: AttendanceRosterAccount[],
  responses: DailyWageResponse[],
): AttendanceRosterAccount[] {
  const roster = new Map<number, AttendanceRosterAccount>()
  accounts.forEach((account) => roster.set(account.account_id, account))
  responses.forEach((response) => {
    response.items.forEach((item) => {
      if (!roster.has(item.account_id)) {
        roster.set(item.account_id, {
          account_id: item.account_id,
          account_code: item.account_code,
          account_type: item.account_type,
          display_name: item.display_name,
          group_leader_name: item.group_leader_name,
        })
      }
    })
  })
  return [...roster.values()].toSorted(compareAccountCodes)
}

function attendanceItem(response: DailyWageResponse | undefined, accountId: number): DailyWageItem | null {
  const item = response?.items.find((candidate) => candidate.account_id === accountId)
  if (!item || item.is_default || item.notes === MOVED_WAGE_PLACEHOLDER_NOTE) return null
  if (item.account_type === "GROUP") return item.group_attendee_count === null ? null : item
  return item.attendance_value === null ? null : item
}

function AttendanceMark({ item, workerName }: { item: DailyWageItem | null; workerName: string }) {
  if (!item) {
    return (
      <span
        className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-label={`No attendance entered for ${workerName}`}
        title="No entry"
      >
        <Minus className="size-4" aria-hidden="true" />
      </span>
    )
  }

  if (item.account_type === "GROUP") {
    const count = item.group_attendee_count ?? 0
    return count === 0 ? (
      <span
        className="inline-flex size-9 items-center justify-center rounded-full bg-red-100 text-red-700"
        aria-label={`${workerName}: absent`}
        title="Absent"
      >
        <X className="size-5 stroke-[3]" aria-hidden="true" />
      </span>
    ) : (
      <span
        className="inline-flex min-w-9 items-center justify-center rounded-full bg-blue-100 px-2 py-2 text-xs font-black text-blue-700"
        aria-label={`${workerName}: ${count} group workers attended`}
        title={`${count} group workers attended`}
      >
        {count}
      </span>
    )
  }

  const attendance = item.attendance_value
  if (attendance === "FULL") {
    return (
      <span
        className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        aria-label={`${workerName}: full attendance`}
        title="Full attendance"
      >
        <Check className="size-5 stroke-[3]" aria-hidden="true" />
      </span>
    )
  }
  if (attendance === "ABSENT") {
    return (
      <span
        className="inline-flex size-9 items-center justify-center rounded-full bg-red-100 text-red-700"
        aria-label={`${workerName}: absent`}
        title="Absent"
      >
        <X className="size-5 stroke-[3]" aria-hidden="true" />
      </span>
    )
  }

  if (!attendance) return null
  const label = partialLabels[attendance]
  return label ? (
    <span
      className="inline-flex min-w-10 items-center justify-center rounded-full bg-blue-100 px-2 py-2 text-xs font-black text-blue-700"
      aria-label={`${workerName}: ${attendanceLabels[attendance]}`}
      title={attendanceLabels[attendance]}
    >
      {label}
    </span>
  ) : null
}

function DailyEarnings({ item, workerName }: { item: DailyWageItem | null; workerName: string }) {
  if (!item) {
    return (
      <span className="text-muted-foreground" aria-label={`No earnings entered for ${workerName}`}>
        —
      </span>
    )
  }

  const amount = formatWholeINR(item.daily_wage_amount)
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        Number(item.daily_wage_amount) > 0 ? "text-emerald-700" : "text-muted-foreground",
      )}
      aria-label={`${workerName} earned ${amount}`}
    >
      {amount}
    </span>
  )
}

function accountTone(accountType: AccountType): "green" | "blue" | "muted" {
  if (accountType === "FARM") return "green"
  if (accountType === "OUTSIDE") return "blue"
  return "muted"
}

export function DailyAttendance() {
  const { lastSync } = useWorkerOffline()
  const [weekAnchor, setWeekAnchor] = useState(toDateInput)
  const [week, setWeek] = useState<Pick<WorkWeek, "start_date" | "end_date">>(() => weekBounds(toDateInput()))
  const [accounts, setAccounts] = useState<AttendanceRosterAccount[]>([])
  const [responses, setResponses] = useState<DailyResponses>({})
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const currentWeek = await fetchCurrentWeek(weekAnchor)
      const dates = datesForWeek(currentWeek.start_date)
      const [accountResponse, ...dailyResponses] = await Promise.all([
        fetchAccounts({ isActive: true, pageSize: 200 }),
        ...dates.map((date) => fetchDailyWages(date)),
      ])
      await Promise.all([
        cacheWorkerAccounts(accountResponse.items),
        ...dailyResponses.map((response) => cacheDailyWages(response)),
      ])
      setWeek(currentWeek)
      setAccounts(mergeRoster(accountResponse.items, dailyResponses))
      setResponses(Object.fromEntries(dailyResponses.map((response) => [response.work_date, response])))
    } catch (loadError) {
      const fallbackWeek = weekBounds(weekAnchor)
      const dates = datesForWeek(fallbackWeek.start_date)
      const [cachedAccounts, ...cachedDays] = await Promise.all([
        readCachedWorkerAccounts(),
        ...dates.map((date) => readCachedDailyWages(date)),
      ])
      const availableDays = cachedDays.filter((value): value is DailyWageResponse => value !== null)
      if (cachedAccounts.length || availableDays.length) {
        const cachedWeek = availableDays[0]?.week ?? fallbackWeek
        setWeek(cachedWeek)
        setAccounts(mergeRoster(cachedAccounts, availableDays))
        setResponses(Object.fromEntries(availableDays.map((response) => [response.work_date, response])))
        setNotice("Showing attendance saved on this device. Some days may be unavailable until the connection returns.")
      } else {
        setAccounts([])
        setResponses({})
        setError(loadError instanceof Error ? loadError.message : "Unable to load daily attendance.")
      }
    } finally {
      setLoading(false)
    }
  }, [weekAnchor])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [lastSync, load])

  const dates = useMemo(() => datesForWeek(week.start_date), [week.start_date])
  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter((account) =>
      !query || `${account.account_code} ${account.display_name} ${account.group_leader_name ?? ""}`.toLowerCase().includes(query),
    )
  }, [accounts, search])

  const enteredCells = useMemo(
    () => accounts.reduce(
      (total, account) => total + dates.filter((date) => attendanceItem(responses[date], account.account_id)).length,
      0,
    ),
    [accounts, dates, responses],
  )
  const totalCells = accounts.length * dates.length
  const today = toDateInput()

  return (
    <div>
      <SectionTitle
        eyebrow="Daily Attendance"
        title={`${formatDate(week.start_date)} – ${formatDate(week.end_date)}`}
        description="All active workers in the Saturday–Friday work week. This is a read-only attendance view; use Daily Wage Entry to make changes."
        actions={
          <Link href="/worker-management" className={buttonClassName("primary")}>
            Enter daily wages
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[auto_minmax(220px,1fr)_auto] md:items-end">
        <div className="flex gap-2">
          <WorkerButton
            variant="secondary"
            className="min-w-11 px-0"
            aria-label="Previous week"
            onClick={() => setWeekAnchor((current) => addDays(current, -7))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </WorkerButton>
          <WorkerButton
            variant="secondary"
            className="min-w-11 px-0"
            aria-label="Next week"
            onClick={() => setWeekAnchor((current) => addDays(current, 7))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </WorkerButton>
        </div>
        <label className="text-sm font-semibold">
          Week containing
          <input
            type="date"
            value={weekAnchor}
            onChange={(event) => setWeekAnchor(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <WorkerButton variant="ghost" onClick={() => setWeekAnchor(toDateInput())}>
          Current week
        </WorkerButton>
      </div>

      {notice ? <div className="mb-4"><Notice tone="warning">{notice}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice tone="error">{error}</Notice></div> : null}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-md">
          <span className="sr-only">Search worker or ID</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search worker or ID"
            className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            {accounts.length} workers
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-2 text-primary">
            {enteredCells} of {totalCells} entries marked
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground" aria-label="Attendance legend">
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-3.5 stroke-[3]" aria-hidden="true" /></span> Full</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex size-6 items-center justify-center rounded-full bg-red-100 text-red-700"><X className="size-3.5 stroke-[3]" aria-hidden="true" /></span> Absent</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">1/3 · 1/2 · 2/3</span> Partial</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">No.</span> Group count</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex size-6 items-center justify-center rounded-full bg-muted"><Minus className="size-3.5" aria-hidden="true" /></span> No entry</span>
      </div>

      {loading ? <LoadingState label="Loading daily attendance…" /> : null}
      {!loading && !visibleAccounts.length ? (
        <EmptyState>{search ? "No workers match this search." : "No active workers are available for this week."}</EmptyState>
      ) : null}
      {!loading && visibleAccounts.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <caption className="sr-only">Daily attendance for all workers from {week.start_date} to {week.end_date}</caption>
              <thead>
                <tr className="border-b border-border bg-muted/65">
                  <th scope="col" className="sticky left-0 z-20 min-w-64 bg-muted px-4 py-3 text-left font-bold shadow-[8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                    Worker
                  </th>
                  {dates.map((date) => {
                    const heading = dayHeading(date)
                    return (
                      <th key={date} scope="col" className={cn("min-w-24 px-2 py-3 text-center", date === today && "bg-primary/10 text-primary")}>
                        <span className="block font-bold">{heading.weekday}</span>
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">{heading.date}</span>
                        {date === today ? <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Today</span> : null}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleAccounts.map((account) => (
                  <Fragment key={account.account_id}>
                    <tr className="border-b border-border/60 hover:bg-muted/35">
                      <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left shadow-[8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                        <span className="block font-bold text-foreground">{account.display_name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span>{account.account_code}</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5",
                            accountTone(account.account_type) === "green" && "bg-primary/10 text-primary",
                            accountTone(account.account_type) === "blue" && "bg-blue-100 text-blue-700",
                            accountTone(account.account_type) === "muted" && "bg-muted text-muted-foreground",
                          )}>
                            {accountTypeLabel(account.account_type)}
                          </span>
                        </span>
                      </th>
                      {dates.map((date) => (
                        <td key={date} className={cn("px-2 py-3 text-center", date === today && "bg-primary/[0.035]")}>
                          <AttendanceMark item={attendanceItem(responses[date], account.account_id)} workerName={account.display_name} />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border bg-emerald-50/45 last:border-b-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-emerald-50 px-4 py-2.5 text-left text-xs font-bold text-emerald-800 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.45)]"
                        aria-label={`${account.display_name} amount earned`}
                      >
                        Amount earned
                      </th>
                      {dates.map((date) => (
                        <td key={date} className={cn("px-2 py-2.5 text-center text-xs", date === today && "bg-primary/[0.05]")}>
                          <DailyEarnings item={attendanceItem(responses[date], account.account_id)} workerName={account.display_name} />
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
