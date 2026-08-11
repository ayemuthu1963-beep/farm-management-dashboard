"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/worker-management/section-header"
import { AccountTypeBadge, SignedAmount } from "@/components/worker-management/status-badges"
import { useWorkerManagement, weeklyPaymentKey } from "@/components/worker-management/worker-management-context"
import {
  CURRENT_WEEK_START,
  formatDisplayDate,
  formatRupees,
  getBalanceToLoan,
  getCashPaidDuringWeek,
  getWagesForWeek,
  getWeekEnd,
  shiftWeek,
} from "@/lib/worker-management"

export function SettlementSection() {
  const { accounts, wageEntries, loanTransactions, weeklyPayments, setWeeklyPayments } = useWorkerManagement()
  const [weekStart, setWeekStart] = useState(CURRENT_WEEK_START)
  const weekEnd = getWeekEnd(weekStart)

  const rows = useMemo(() => {
    return accounts
      .filter((account) => account.status === "Active")
      .map((account) => {
        const wages = getWagesForWeek(wageEntries, account.id, weekStart, weekEnd)
        const cashPaidDuringWeek = getCashPaidDuringWeek(loanTransactions, account.id, weekStart, weekEnd)
        const key = weeklyPaymentKey(account.id, weekStart)
        const weeklyPayment = weeklyPayments[key] ?? wages
        const balanceToLoan = getBalanceToLoan(wages, weeklyPayment)
        return { account, wages, cashPaidDuringWeek, weeklyPayment, balanceToLoan, key }
      })
      .filter((row) => row.wages !== 0 || row.cashPaidDuringWeek !== 0)
  }, [accounts, wageEntries, loanTransactions, weekStart, weekEnd, weeklyPayments])

  function updateWeeklyPayment(key: string, value: number) {
    setWeeklyPayments((prev) => ({ ...prev, [key]: value }))
  }

  const totalWages = rows.reduce((sum, row) => sum + row.wages, 0)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Weekly Settlement"
        description="Review wages for the week, note any cash already paid, and record the actual weekly payment for each account."
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setWeekStart((prev) => shiftWeek(prev, -1))} aria-label="Previous week">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Week</p>
              <p className="font-serif text-xl font-bold">
                {formatDisplayDate(weekStart)} – {formatDisplayDate(weekEnd)}
              </p>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setWeekStart((prev) => shiftWeek(prev, 1))} aria-label="Next week">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <p className="font-serif text-2xl font-bold text-primary">{formatRupees(totalWages)}</p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No wage activity recorded for this week yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3 text-right">Wages</th>
                    <th className="px-3 py-3 text-right">Cash paid during week</th>
                    <th className="px-3 py-3 text-right">Weekly payment</th>
                    <th className="px-3 py-3 text-right">Balance to loan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.account.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{row.account.name}</p>
                          <AccountTypeBadge type={row.account.type} />
                        </div>
                        <p className="text-xs text-muted-foreground">{row.account.id}</p>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold">{formatRupees(row.wages)}</td>
                      <td className="px-3 py-4 text-right text-muted-foreground">{formatRupees(row.cashPaidDuringWeek)}</td>
                      <td className="px-3 py-4 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.weeklyPayment}
                          onChange={(event) => updateWeeklyPayment(row.key, Number.parseFloat(event.target.value) || 0)}
                          aria-label={`${row.account.name} weekly payment`}
                          className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-right"
                        />
                      </td>
                      <td className="px-3 py-4 text-right">
                        <SignedAmount amount={row.balanceToLoan} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-4 flex flex-col gap-3 md:hidden">
              {rows.map((row) => (
                <div key={row.account.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{row.account.name}</p>
                        <AccountTypeBadge type={row.account.type} />
                      </div>
                      <p className="text-xs text-muted-foreground">{row.account.id}</p>
                    </div>
                    <SignedAmount amount={row.balanceToLoan} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Wages</dt>
                      <dd className="font-semibold">{formatRupees(row.wages)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Cash paid during week</dt>
                      <dd className="text-muted-foreground">{formatRupees(row.cashPaidDuringWeek)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Weekly payment</dt>
                      <dd>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.weeklyPayment}
                          onChange={(event) => updateWeeklyPayment(row.key, Number.parseFloat(event.target.value) || 0)}
                          aria-label={`${row.account.name} weekly payment`}
                          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5"
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
