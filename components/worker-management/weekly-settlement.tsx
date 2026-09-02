"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, LockKeyhole, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  closeWeek,
  fetchCurrentWeek,
  fetchSettlements,
  markWeekPaid,
  reopenWeek,
  updateWeeklyPayment,
} from "@/lib/worker-management-api"
import {
  accountTypeLabel,
  addDays,
  defaultSettlementDate,
  formatDate,
  formatWholeINR,
  money,
  weekStatusLabel,
} from "@/lib/worker-management-format"
import type { SettlementResponse, SettlementRow } from "@/lib/worker-management-types"
import { compareApprovedWorkerRoster } from "@/lib/worker-management-roster"
import {
  isDependentWorkerAccount,
  pairedDependentAccountCode,
} from "@/lib/worker-balance-relationships"
import {
  Badge,
  EmptyState,
  LoadingState,
  Notice,
  SectionTitle,
  WorkerButton,
  WorkerInput,
} from "./worker-ui"

function isDependentWorker(row: Pick<SettlementRow, "account_code">) {
  return isDependentWorkerAccount(row.account_code)
}

function pairedDependent(rows: SettlementRow[], row: SettlementRow) {
  const dependentCode = pairedDependentAccountCode(row.account_code)
  return dependentCode ? rows.find((candidate) => candidate.account_code === dependentCode) ?? null : null
}

function combinedWeekWages(rows: SettlementRow[], row: SettlementRow) {
  return money(row.wages) + money(pairedDependent(rows, row)?.wages)
}

function SignedAmount({ value, negativeOnly = false }: { value: number | null; negativeOnly?: boolean }) {
  if (value === null) return <span aria-label="Blank financial value" />
  const displayValue = negativeOnly && value !== 0 ? -Math.abs(value) : value
  return (
    <span
      className={cn(
        "whitespace-nowrap font-bold tabular-nums",
        displayValue < 0 && "text-red-700",
        displayValue > 0 && "text-emerald-700",
        displayValue === 0 && "text-slate-950",
      )}
    >
      {displayValue > 0 ? "+" : ""}{formatWholeINR(displayValue)}
    </span>
  )
}

function WholeAmount({ value }: { value: number | null }) {
  if (value === null) return <span aria-label="Blank financial value" />
  return <span className="whitespace-nowrap font-bold tabular-nums text-emerald-700">{formatWholeINR(value)}</span>
}

function WeekWageAmount({ value, addend }: { value: number; addend: number | null }) {
  if (addend === null) return <span className="font-bold tabular-nums text-emerald-700">{formatWholeINR(value)}</span>
  return (
    <span className="inline-block text-right text-xs font-bold tabular-nums text-emerald-700">
      <span className="block">{formatWholeINR(value)}</span>
      <span className="block">+ {formatWholeINR(addend)}</span>
      <span className="mt-1 block border-t border-sky-200 pt-1">= {formatWholeINR(value + addend)}</span>
    </span>
  )
}

export function WeeklySettlement() {
  const [selectedDate, setSelectedDate] = useState(defaultSettlementDate)
  const [data, setData] = useState<SettlementResponse | null>(null)
  const [loanPayments, setLoanPayments] = useState<Record<number, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [reopenReason, setReopenReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const week = await fetchCurrentWeek(selectedDate)
      if (week.week_id === null) {
        setData({ week, items: [] })
        setLoanPayments({})
        return
      }
      const result = await fetchSettlements(week.week_id)
      setData(result)
      setLoanPayments(Object.fromEntries(
        result.items
          .filter((item) => !isDependentWorker(item))
          .map((item) => [
            item.account_id,
            String(item.settlement_id === null
              ? 0
              : Math.max(0, combinedWeekWages(result.items, item) - money(item.weekly_payment))),
          ]),
      ))
      setDirtyIds(new Set())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load weekly settlement.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [load])

  const rows = useMemo(() => {
    return (data?.items ?? []).toSorted(compareApprovedWorkerRoster).map((item) => {
      const dependent = isDependentWorker(item)
      const pairedWorker = pairedDependent(data?.items ?? [], item)
      const ownWeekWages = money(item.wages)
      const dependentWeekWages = pairedWorker ? money(pairedWorker.wages) : null
      const totalWeekWages = ownWeekWages + (dependentWeekWages ?? 0)
      if (dependent) {
        return {
          ...item,
          dependent,
          ownWeekWages,
          dependentWeekWages,
          totalWeekWages,
          toLoanPayment: null,
          wageToBePaid: null,
          earlierLoanBalance: null,
          cashPaidInWeek: null,
          presentBalance: null,
        }
      }

      const toLoanPayment = Math.max(0, money(loanPayments[item.account_id]))
      const signedCash = money(item.cash_paid_during_week)
      const cashPaidInWeek = Math.max(0, -signedCash)
      const earlierLoanBalance = money(item.opening_signed_balance)

      return {
        ...item,
        dependent,
        ownWeekWages,
        dependentWeekWages,
        totalWeekWages,
        toLoanPayment,
        wageToBePaid: Math.max(0, totalWeekWages - toLoanPayment),
        earlierLoanBalance,
        cashPaidInWeek,
        presentBalance: earlierLoanBalance + toLoanPayment - cashPaidInWeek,
      }
    })
  }, [data, loanPayments])

  const totals = rows.reduce(
    (current, row) => ({
      wages: current.wages + row.ownWeekWages,
      loanPayment: current.loanPayment + (row.toLoanPayment ?? 0),
      wageToBePaid: current.wageToBePaid + (row.wageToBePaid ?? 0),
      earlierBalance: current.earlierBalance + (row.earlierLoanBalance ?? 0),
      cashPaid: current.cashPaid + (row.cashPaidInWeek ?? 0),
      presentBalance: current.presentBalance + (row.presentBalance ?? 0),
    }),
    { wages: 0, loanPayment: 0, wageToBePaid: 0, earlierBalance: 0, cashPaid: 0, presentBalance: 0 },
  )

  const editable = data?.week.is_read_only !== true
    && (data?.week.status === "DRAFT" || data?.week.status === "REOPENED")

  const persistLoanPayments = async () => {
    if (!data?.week.week_id || !dirtyIds.size) return 0
    const changedRows = rows.filter((row) => dirtyIds.has(row.account_id) && !row.dependent)
    for (const row of changedRows) {
      if ((row.toLoanPayment ?? 0) > row.totalWeekWages) {
        throw new Error(`To loan payment for ${row.display_name} cannot exceed ${formatWholeINR(row.totalWeekWages)}.`)
      }
    }
    await Promise.all(
      changedRows.map((row) =>
        updateWeeklyPayment(
          data.week.week_id as number,
          row.account_id,
          String(row.wageToBePaid ?? 0),
          row.row_version,
        ),
      ),
    )
    return changedRows.length
  }

  const saveLoanPayments = async () => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const savedCount = await persistLoanPayments()
      setNotice(`${savedCount} loan payment${savedCount === 1 ? "" : "s"} saved.`)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save loan payments.")
    } finally {
      setSaving(false)
    }
  }

  const runWeekAction = async (action: "close" | "paid" | "reopen") => {
    if (!data?.week.week_id || data.week.row_version === null) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      if (action === "close") {
        if (dirtyIds.size) await persistLoanPayments()
        await closeWeek(data.week.week_id, data.week.row_version)
        setNotice("The week is closed. Review the final rows before marking payment complete.")
      } else if (action === "paid") {
        await markWeekPaid(data.week.week_id, data.week.row_version, paymentReference.trim())
        setNotice("The week is marked Paid.")
        setPaymentReference("")
      } else {
        if (!reopenReason.trim()) {
          setError("A reason is required to reopen the week.")
          return
        }
        await reopenWeek(data.week.week_id, data.week.row_version, reopenReason.trim())
        setNotice("The week is reopened for correction.")
        setReopenReason("")
      }
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update the week.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle
        eyebrow="Weekly Settlement"
        title={data ? `${formatDate(data.week.start_date)} – ${formatDate(data.week.end_date)}` : "Saturday–Friday settlement"}
        description="Matches the Weekly Wage Sheet: Wage to be paid = combined week wages − to loan payment. Present balance = signed earlier balance + to loan payment − cash paid in week."
        actions={data ? <Badge tone={data.week.status === "PAID" ? "green" : data.week.status === "CLOSED" ? "blue" : "amber"}>{weekStatusLabel(data.week.status)}</Badge> : null}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <div className="mt-3"><Notice tone="success">{notice}</Notice></div> : null}

      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[auto_minmax(190px,260px)_auto] sm:items-end">
        <WorkerButton variant="secondary" onClick={() => setSelectedDate((current) => addDays(current, -7))}>
          Previous week
        </WorkerButton>
        <WorkerInput
          label="Week containing"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
        />
        <WorkerButton variant="secondary" onClick={() => setSelectedDate((current) => addDays(current, 7))}>
          Next week
        </WorkerButton>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          On Saturday, this page opens the week that ended Friday so payment can be completed immediately.
        </p>
      </div>

      <div className="mt-5">
        {loading ? <LoadingState label="Loading weekly settlement…" /> : null}
        {!loading && !rows.length ? <EmptyState>Save at least one Daily Wage Entry to start this work week.</EmptyState> : null}
        {!loading && rows.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Worker name</th>
                    <th className="px-4 py-3 text-right">Week wages</th>
                    <th className="px-4 py-3 text-right">To loan payment</th>
                    <th className="px-4 py-3 text-right">Wage to be paid</th>
                    <th className="px-4 py-3 text-right">Earlier loan balance</th>
                    <th className="px-4 py-3 text-right">Cash paid in week</th>
                    <th className="px-4 py-3 text-right">Present balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.account_id} className="border-t border-border align-middle">
                      <td className="px-4 py-4"><p className="font-bold">{row.display_name}</p><p className="text-xs text-muted-foreground">{row.account_code} · {accountTypeLabel(row.account_type)}</p></td>
                      <td className="px-4 py-4 text-right"><WeekWageAmount value={row.ownWeekWages} addend={row.dependentWeekWages} /></td>
                      {row.dependent ? (
                        <>
                          <td aria-label={`${row.display_name} to loan payment blank`} />
                          <td aria-label={`${row.display_name} wage to be paid blank`} />
                          <td aria-label={`${row.display_name} earlier loan balance blank`} />
                          <td aria-label={`${row.display_name} cash paid in week blank`} />
                          <td aria-label={`${row.display_name} present balance blank`} />
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4 text-right">
                            <div className="relative ml-auto w-32">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-emerald-700">₹</span>
                              <input
                                aria-label={`To loan payment for ${row.display_name}`}
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                disabled={!editable}
                                value={loanPayments[row.account_id] ?? "0"}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) => {
                                  setLoanPayments((current) => ({ ...current, [row.account_id]: event.target.value }))
                                  setDirtyIds((current) => new Set(current).add(row.account_id))
                                }}
                                className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-right font-semibold tabular-nums text-emerald-700 disabled:opacity-70"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right"><WholeAmount value={row.wageToBePaid} /></td>
                          <td className="px-4 py-4 text-right"><SignedAmount value={row.earlierLoanBalance} /></td>
                          <td className="px-4 py-4 text-right"><SignedAmount value={row.cashPaidInWeek} negativeOnly /></td>
                          <td className="px-4 py-4 text-right"><SignedAmount value={row.presentBalance} /></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold">
                  <tr>
                    <td className="px-4 py-4">Total</td>
                    <td className="px-4 py-4 text-right text-emerald-700">{formatWholeINR(totals.wages)}</td>
                    <td className="px-4 py-4 text-right text-emerald-700">{formatWholeINR(totals.loanPayment)}</td>
                    <td className="px-4 py-4 text-right text-emerald-700">{formatWholeINR(totals.wageToBePaid)}</td>
                    <td className="px-4 py-4 text-right"><SignedAmount value={totals.earlierBalance} /></td>
                    <td className="px-4 py-4 text-right"><SignedAmount value={totals.cashPaid} negativeOnly /></td>
                    <td className="px-4 py-4 text-right"><SignedAmount value={totals.presentBalance} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {rows.map((row) => (
                <article key={row.account_id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{row.display_name}</h2><p className="text-xs text-muted-foreground">{row.account_code} · {accountTypeLabel(row.account_type)}</p></div><Badge tone={row.settlement_status === "PAID" ? "green" : "muted"}>{row.settlement_status ?? "Draft"}</Badge></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Week wages</dt><dd className="mt-1 text-right"><WeekWageAmount value={row.ownWeekWages} addend={row.dependentWeekWages} /></dd></div>
                    {row.dependent ? (
                      <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Guardian account</dt><dd className="mt-1 text-sm font-semibold">Financial values included with {row.display_name === "Rani" ? "Tiruma" : "Sivan"}.</dd></div>
                    ) : (
                      <>
                        <label className="rounded-lg bg-muted/55 p-3"><span className="text-xs text-muted-foreground">To loan payment</span><input aria-label={`To loan payment for ${row.display_name}`} type="number" min="0" step="1" inputMode="numeric" disabled={!editable} value={loanPayments[row.account_id] ?? "0"} onChange={(event) => { setLoanPayments((current) => ({ ...current, [row.account_id]: event.target.value })); setDirtyIds((current) => new Set(current).add(row.account_id)) }} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-right font-bold tabular-nums text-emerald-700" /></label>
                        <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Wage to be paid</dt><dd className="mt-1 text-right"><WholeAmount value={row.wageToBePaid} /></dd></div>
                        <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Earlier loan balance</dt><dd className="mt-1 text-right"><SignedAmount value={row.earlierLoanBalance} /></dd></div>
                        <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Cash paid in week</dt><dd className="mt-1 text-right"><SignedAmount value={row.cashPaidInWeek} negativeOnly /></dd></div>
                        <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Present balance</dt><dd className="mt-1 text-right"><SignedAmount value={row.presentBalance} /></dd></div>
                      </>
                    )}
                  </dl>
                </article>
              ))}
              <div className="rounded-xl bg-primary p-4 text-primary-foreground"><p className="text-xs font-semibold uppercase tracking-wide opacity-80">Week total</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="opacity-75">Week wages</p><p className="font-bold">{formatWholeINR(totals.wages)}</p></div><div><p className="opacity-75">To loan payment</p><p className="font-bold">{formatWholeINR(totals.loanPayment)}</p></div><div><p className="opacity-75">Wage to be paid</p><p className="font-bold">{formatWholeINR(totals.wageToBePaid)}</p></div><div><p className="opacity-75">Cash paid in week</p><p className="font-bold">{totals.cashPaid ? `-${formatWholeINR(totals.cashPaid)}` : formatWholeINR(0)}</p></div></div></div>
            </div>
          </div>
        ) : null}
      </div>

      {rows.length ? (
        <div className="mt-5 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          {editable ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-bold">Draft settlement</h2><p className="text-sm text-muted-foreground">To loan payment matches the Weekly Wage Sheet. Save changes, then close after Friday evening.</p></div>
              <div className="flex flex-wrap gap-2"><WorkerButton onClick={saveLoanPayments} disabled={saving || !dirtyIds.size}><CheckCircle2 className="size-4" aria-hidden="true" />{saving ? "Saving…" : `Save Loan Payments (${dirtyIds.size})`}</WorkerButton><WorkerButton variant="secondary" onClick={() => runWeekAction("close")} disabled={saving || data?.week.row_version === null}><LockKeyhole className="size-4" aria-hidden="true" />Close Week</WorkerButton></div>
            </div>
          ) : null}
          {data?.week.status === "CLOSED" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><WorkerInput label="Saturday payment reference (optional)" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Bank / cash reference" /><WorkerButton onClick={() => runWeekAction("paid")} disabled={saving}><CheckCircle2 className="size-4" aria-hidden="true" />Mark Paid</WorkerButton></div>
          ) : null}
          {data?.week.status === "CLOSED" || data?.week.status === "PAID" ? (
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto] sm:items-end"><WorkerInput label="Reason to reopen" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Required audit reason" /><WorkerButton variant="secondary" onClick={() => runWeekAction("reopen")} disabled={saving || !reopenReason.trim()}><RotateCcw className="size-4" aria-hidden="true" />Reopen Week</WorkerButton></div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
