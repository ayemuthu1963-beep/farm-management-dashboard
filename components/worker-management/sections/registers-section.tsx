"use client"

import { useMemo, useState } from "react"
import { RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/worker-management/section-header"
import {
  AccountTypeBadge,
  PaidStatusBadge,
  SignedAmount,
  SyncStatusBadge,
} from "@/components/worker-management/status-badges"
import { useWorkerManagement } from "@/components/worker-management/worker-management-context"
import {
  CURRENT_WEEK_START,
  findAccount,
  formatDisplayDate,
  formatRupees,
  getLoanBalance,
  getWeekEnd,
  shiftWeek,
  type AccountType,
  type PaidStatus,
  type WageEntry,
} from "@/lib/worker-management"

type AccountTypeFilter = "All" | AccountType
type PaidStatusFilter = "All" | PaidStatus
type RegisterTab = "Wage Register" | "Loan Register"

const accountTypeFilters: AccountTypeFilter[] = ["All", "Farm", "Outside", "Group"]
const paidStatusFilters: PaidStatusFilter[] = ["All", "Paid", "Unpaid"]

interface Filters {
  week: string // week start ISO, "all", or "custom"
  from: string
  to: string
  accountType: AccountTypeFilter
  accountId: string // "All" or an account id
  paidStatus: PaidStatusFilter
}

function makeDefaultFilters(): Filters {
  return {
    week: CURRENT_WEEK_START,
    from: CURRENT_WEEK_START,
    to: getWeekEnd(CURRENT_WEEK_START),
    accountType: "All",
    accountId: "All",
    paidStatus: "All",
  }
}

function attendanceLabel(entry: WageEntry): string {
  if (entry.farmAttendance) return entry.farmAttendance
  if (entry.outsideAttendance) return entry.outsideAttendance
  if (typeof entry.groupCount === "number") return `${entry.groupCount} head${entry.groupCount === 1 ? "" : "s"}`
  return "—"
}

export function RegistersSection() {
  const { accounts, wageEntries, loanTransactions } = useWorkerManagement()
  const [draft, setDraft] = useState<Filters>(makeDefaultFilters)
  const [applied, setApplied] = useState<Filters>(makeDefaultFilters)
  const [tab, setTab] = useState<RegisterTab>("Wage Register")

  const weekOptions = useMemo(() => Array.from({ length: 8 }, (_, index) => shiftWeek(CURRENT_WEEK_START, -index)), [])

  const accountOptions = useMemo(
    () => accounts.toSorted((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )

  function handleWeekChange(value: string) {
    if (value === "all") {
      setDraft((prev) => ({ ...prev, week: "all", from: "", to: "" }))
    } else {
      setDraft((prev) => ({ ...prev, week: value, from: value, to: getWeekEnd(value) }))
    }
  }

  function applyFilters() {
    setApplied(draft)
  }

  function clearFilters() {
    const defaults = makeDefaultFilters()
    setDraft(defaults)
    setApplied(defaults)
  }

  const wageRows = useMemo(() => {
    return wageEntries
      .filter((entry) => {
        const account = findAccount(accounts, entry.accountId)
        if (!account) return false
        if (applied.from && entry.date < applied.from) return false
        if (applied.to && entry.date > applied.to) return false
        if (applied.accountType !== "All" && account.type !== applied.accountType) return false
        if (applied.accountId !== "All" && entry.accountId !== applied.accountId) return false
        if (applied.paidStatus !== "All" && entry.paidStatus !== applied.paidStatus) return false
        return true
      })
      .toSorted((a, b) => (a.date < b.date ? 1 : -1))
  }, [wageEntries, accounts, applied])

  const loanRows = useMemo(() => {
    return loanTransactions
      .filter((transaction) => {
        const account = findAccount(accounts, transaction.accountId)
        if (!account) return false
        if (applied.from && transaction.date < applied.from) return false
        if (applied.to && transaction.date > applied.to) return false
        if (applied.accountType !== "All" && account.type !== applied.accountType) return false
        if (applied.accountId !== "All" && transaction.accountId !== applied.accountId) return false
        return true
      })
      .toSorted((a, b) => (a.date < b.date ? 1 : -1))
  }, [loanTransactions, accounts, applied])

  const wageTotal = wageRows.reduce((sum, entry) => sum + entry.wage, 0)
  const loanNet = loanRows.reduce((sum, transaction) => sum + transaction.amount, 0)

  const selectedAccount = applied.accountId === "All" ? null : findAccount(accounts, applied.accountId)

  const rangeLabel =
    applied.from && applied.to
      ? `${formatDisplayDate(applied.from)} – ${formatDisplayDate(applied.to)}`
      : "All dates"

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Registers & History"
        description="Filter the seeded wage and loan records into printable-style registers, and review a single worker's history across the farm week."
      />

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-serif text-lg font-bold">Filters</h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Farm week (Sat–Fri)</span>
            <select
              value={draft.week}
              onChange={(event) => handleWeekChange(event.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2"
            >
              {weekOptions.map((weekStart) => (
                <option key={weekStart} value={weekStart}>
                  {formatDisplayDate(weekStart)} – {formatDisplayDate(getWeekEnd(weekStart))}
                </option>
              ))}
              <option value="all">All weeks</option>
              {draft.week === "custom" ? <option value="custom">Custom range</option> : null}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">From</span>
            <input
              type="date"
              value={draft.from}
              onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value, week: "custom" }))}
              className="rounded-lg border border-input bg-background px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">To</span>
            <input
              type="date"
              value={draft.to}
              onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value, week: "custom" }))}
              className="rounded-lg border border-input bg-background px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Account type</span>
            <select
              value={draft.accountType}
              onChange={(event) => setDraft((prev) => ({ ...prev, accountType: event.target.value as AccountTypeFilter }))}
              className="rounded-lg border border-input bg-background px-3 py-2"
            >
              {accountTypeFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Account name</span>
            <select
              value={draft.accountId}
              onChange={(event) => setDraft((prev) => ({ ...prev, accountId: event.target.value }))}
              className="rounded-lg border border-input bg-background px-3 py-2"
            >
              <option value="All">All accounts</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Payment status</span>
            <select
              value={draft.paidStatus}
              onChange={(event) => setDraft((prev) => ({ ...prev, paidStatus: event.target.value as PaidStatusFilter }))}
              className="rounded-lg border border-input bg-background px-3 py-2"
            >
              {paidStatusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={applyFilters}>
            Apply
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </div>

      {/* Worker history summary (shown when a single account is selected) */}
      {selectedAccount ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="font-serif text-lg font-bold">{selectedAccount.name}</p>
              <AccountTypeBadge type={selectedAccount.type} />
            </div>
            <span className="text-xs text-muted-foreground">{selectedAccount.id}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="font-medium">{selectedAccount.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Joined</dt>
              <dd className="font-medium">{formatDisplayDate(selectedAccount.joinDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {selectedAccount.type === "Group" ? "Rate / head" : "Daily rate"}
              </dt>
              <dd className="font-medium">{formatRupees(selectedAccount.rate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Loan balance (all time)</dt>
              <dd>
                <SignedAmount amount={getLoanBalance(loanTransactions, selectedAccount.id)} />
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {/* Register tabs */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5" role="tablist" aria-label="Register type">
            {(["Wage Register", "Loan Register"] as RegisterTab[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tab === option}
                onClick={() => setTab(option)}
                className={
                  tab === option
                    ? "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                    : "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              >
                {option}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        </div>

        {tab === "Wage Register" ? (
          wageRows.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No wage entries match these filters.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-3 py-3">Attendance</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Wage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wageRows.map((entry) => {
                      const account = findAccount(accounts, entry.accountId)
                      return (
                        <tr key={entry.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-4 text-muted-foreground">{formatDisplayDate(entry.date)}</td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{account?.name ?? entry.accountId}</p>
                              {account ? <AccountTypeBadge type={account.type} /> : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{entry.accountId}</p>
                          </td>
                          <td className="px-3 py-4">{attendanceLabel(entry)}</td>
                          <td className="px-3 py-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <PaidStatusBadge status={entry.paidStatus} />
                              <SyncStatusBadge status={entry.syncStatus} />
                            </div>
                          </td>
                          <td className="px-3 py-4 text-right font-semibold">{formatRupees(entry.wage)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="px-3 py-3" colSpan={4}>
                        Total ({wageRows.length} entr{wageRows.length === 1 ? "y" : "ies"})
                      </td>
                      <td className="px-3 py-3 text-right text-primary">{formatRupees(wageTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mt-4 flex flex-col gap-3 md:hidden">
                {wageRows.map((entry) => {
                  const account = findAccount(accounts, entry.accountId)
                  return (
                    <div key={entry.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account?.name ?? entry.accountId}</p>
                            {account ? <AccountTypeBadge type={account.type} /> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.accountId} · {formatDisplayDate(entry.date)}
                          </p>
                        </div>
                        <p className="font-semibold">{formatRupees(entry.wage)}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{attendanceLabel(entry)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <PaidStatusBadge status={entry.paidStatus} />
                        <SyncStatusBadge status={entry.syncStatus} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm font-semibold">
                  <span>Total ({wageRows.length})</span>
                  <span className="text-primary">{formatRupees(wageTotal)}</span>
                </div>
              </div>
            </>
          )
        ) : loanRows.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No loan transactions match these filters.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Notes</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loanRows.map((transaction) => {
                    const account = findAccount(accounts, transaction.accountId)
                    return (
                      <tr key={transaction.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-4 text-muted-foreground">{formatDisplayDate(transaction.date)}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account?.name ?? transaction.accountId}</p>
                            {account ? <AccountTypeBadge type={account.type} /> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{transaction.accountId}</p>
                        </td>
                        <td className="px-3 py-4">{transaction.type}</td>
                        <td className="px-3 py-4 text-muted-foreground">{transaction.notes || "—"}</td>
                        <td className="px-3 py-4 text-right">
                          <SignedAmount amount={transaction.amount} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-3 py-3" colSpan={4}>
                      Net ({loanRows.length} transaction{loanRows.length === 1 ? "" : "s"})
                    </td>
                    <td className="px-3 py-3 text-right">
                      <SignedAmount amount={loanNet} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-4 flex flex-col gap-3 md:hidden">
              {loanRows.map((transaction) => {
                const account = findAccount(accounts, transaction.accountId)
                return (
                  <div key={transaction.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{account?.name ?? transaction.accountId}</p>
                          {account ? <AccountTypeBadge type={account.type} /> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {transaction.accountId} · {formatDisplayDate(transaction.date)}
                        </p>
                      </div>
                      <SignedAmount amount={transaction.amount} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{transaction.type}</p>
                    {transaction.notes ? <p className="mt-1 text-xs text-muted-foreground">{transaction.notes}</p> : null}
                  </div>
                )
              })}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm font-semibold">
                <span>Net ({loanRows.length})</span>
                <SignedAmount amount={loanNet} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
