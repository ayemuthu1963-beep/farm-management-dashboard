"use client"

import { useMemo } from "react"
import { CircleDollarSign, CreditCard, MessageCircleQuestion, Users, Wallet } from "lucide-react"
import { SectionHeader } from "@/components/worker-management/section-header"
import { AccountTypeBadge, PaidStatusBadge, SignedAmount } from "@/components/worker-management/status-badges"
import { useWorkerManagement } from "@/components/worker-management/worker-management-context"
import {
  CURRENT_WEEK_START,
  findAccount,
  formatDisplayDate,
  formatRupees,
  getLoanBalance,
  getWeekEnd,
  getWagesForWeek,
} from "@/lib/worker-management"

function Stat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Users
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 font-serif text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function DashboardSection() {
  const { accounts, wageEntries, loanTransactions, queries } = useWorkerManagement()

  const weekEnd = getWeekEnd(CURRENT_WEEK_START)

  const totals = useMemo(() => {
    const activeAccounts = accounts.filter((account) => account.status === "Active")
    const thisWeek = activeAccounts.reduce(
      (sum, account) => sum + getWagesForWeek(wageEntries, account.id, CURRENT_WEEK_START, weekEnd),
      0,
    )
    const pendingSettlement = wageEntries
      .filter((entry) => entry.date >= CURRENT_WEEK_START && entry.date <= weekEnd && entry.paidStatus === "Unpaid")
      .reduce((sum, entry) => sum + entry.wage, 0)
    const outstandingLoans = activeAccounts.reduce((sum, account) => {
      const balance = getLoanBalance(loanTransactions, account.id)
      return sum + (balance > 0 ? balance : 0)
    }, 0)
    return { activeAccounts: activeAccounts.length, thisWeek, pendingSettlement, outstandingLoans }
  }, [accounts, wageEntries, loanTransactions, weekEnd])

  const recentEntries = useMemo(
    () =>
      wageEntries
        .filter((entry) => entry.date >= CURRENT_WEEK_START && entry.date <= weekEnd)
        .toSorted((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 5),
    [wageEntries, weekEnd],
  )

  const topLoanBalances = useMemo(
    () =>
      accounts
        .map((account) => ({ account, balance: getLoanBalance(loanTransactions, account.id) }))
        .filter((entry) => entry.balance !== 0)
        .toSorted((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 5),
    [accounts, loanTransactions],
  )

  const openQueries = useMemo(
    () => queries.filter((query) => query.status === "Open").slice(0, 4),
    [queries],
  )

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Dashboard"
        description="A quick view of labour, wages and outstanding worker advances across Farm, Outside and Group accounts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active accounts" value={String(totals.activeAccounts)} detail="Farm, Outside and Group" icon={Users} />
        <Stat
          label="This week"
          value={formatRupees(totals.thisWeek)}
          detail={`Week ending ${formatDisplayDate(weekEnd)}`}
          icon={CircleDollarSign}
        />
        <Stat
          label="Pending settlement"
          value={formatRupees(totals.pendingSettlement)}
          detail="Unpaid wage entries this week"
          icon={Wallet}
        />
        <Stat
          label="Outstanding loans"
          value={formatRupees(totals.outstandingLoans)}
          detail="Amounts owed to the farm"
          icon={CreditCard}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">Recent wage activity</h2>
            <span className="text-xs text-muted-foreground">Week ending {formatDisplayDate(weekEnd)}</span>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wage entries recorded yet this week.</p>
            ) : (
              recentEntries.map((entry) => {
                const account = accounts.find((candidate) => candidate.id === entry.accountId)
                if (!account) return null
                return (
                  <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{account.name}</p>
                        <AccountTypeBadge type={account.type} />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDisplayDate(entry.date)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <p className="font-semibold">{formatRupees(entry.wage)}</p>
                      <PaidStatusBadge status={entry.paidStatus} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-xl font-bold">Loan balances</h2>
          <div className="mt-5 flex flex-col gap-4">
            {topLoanBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outstanding loan balances.</p>
            ) : (
              topLoanBalances.map(({ account, balance }) => (
                <div key={account.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.id}</p>
                  </div>
                  <SignedAmount amount={balance} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-serif text-xl font-bold">Open queries</h2>
          </div>
          <div className="mt-5 flex flex-col gap-4">
            {openQueries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open queries right now.</p>
            ) : (
              openQueries.map((query) => {
                const account = findAccount(accounts, query.accountId)
                return (
                  <div key={query.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="truncate text-sm font-medium">{query.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {account?.name ?? query.accountId} · raised {formatDisplayDate(query.date)}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
