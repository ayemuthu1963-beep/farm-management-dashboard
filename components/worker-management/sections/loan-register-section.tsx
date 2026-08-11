"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/worker-management/section-header"
import { AccountTypeBadge, SignedAmount } from "@/components/worker-management/status-badges"
import { useWorkerManagement } from "@/components/worker-management/worker-management-context"
import { findAccount, formatDisplayDate, getLoanBalance, type LoanTransactionType } from "@/lib/worker-management"
import { LoanTransactionForm, type LoanTransactionSubmit } from "./loan-transaction-form"

type TypeFilter = "All" | LoanTransactionType

const typeFilters: TypeFilter[] = [
  "All",
  "Cash Loan/Advance",
  "Wage Repayment",
  "Cash Repayment",
  "Deposit Contribution",
  "Deposit Withdrawal",
]

export function LoanRegisterSection() {
  const { accounts, loanTransactions, setLoanTransactions } = useWorkerManagement()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All")
  const [showForm, setShowForm] = useState(false)

  const balances = useMemo(
    () =>
      accounts
        .map((account) => ({ account, balance: getLoanBalance(loanTransactions, account.id) }))
        .filter((entry) => entry.balance !== 0)
        .toSorted((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
    [accounts, loanTransactions],
  )

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return loanTransactions
      .filter((transaction) => {
        const account = findAccount(accounts, transaction.accountId)
        const matchesType = typeFilter === "All" || transaction.type === typeFilter
        const matchesQuery =
          query.length === 0 ||
          account?.name.toLowerCase().includes(query) ||
          transaction.accountId.toLowerCase().includes(query)
        return matchesType && matchesQuery
      })
      .toSorted((a, b) => (a.date < b.date ? 1 : -1))
  }, [loanTransactions, accounts, search, typeFilter])

  function handleAddTransaction(values: LoanTransactionSubmit) {
    setLoanTransactions((prev) => [
      ...prev,
      { id: `loan-${Date.now()}`, accountId: values.accountId, date: values.date, type: values.type, amount: values.amount, notes: values.notes },
    ])
    setShowForm(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Loan Register"
        description="Track every loan, advance, repayment and deposit transaction for each account, and see the running balance owed to the farm."
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-bold">Current balances</h2>
        {balances.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No accounts currently owe a balance.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map(({ account, balance }) => (
              <div key={account.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{account.id}</p>
                </div>
                <SignedAmount amount={balance} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Search transactions</span>
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by account name or ID"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              aria-label="Filter by transaction type"
            >
              {typeFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={() => setShowForm((prev) => !prev)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add transaction
          </Button>
        </div>

        {showForm ? (
          <div className="mt-5">
            <LoanTransactionForm
              accounts={accounts}
              onSubmit={handleAddTransaction}
              onCancel={() => setShowForm(false)}
            />
          </div>
        ) : null}

        {filteredTransactions.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No transactions match your filters.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-5 hidden overflow-x-auto md:block">
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
                  {filteredTransactions.map((transaction) => {
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
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-5 flex flex-col gap-3 md:hidden">
              {filteredTransactions.map((transaction) => {
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
