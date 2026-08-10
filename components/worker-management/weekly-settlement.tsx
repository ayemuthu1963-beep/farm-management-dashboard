"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, LockKeyhole, RotateCcw } from "lucide-react"
import {
  closeWeek,
  fetchCurrentWeek,
  fetchSettlements,
  markWeekPaid,
  reopenWeek,
  updateWeeklyPayment,
} from "@/lib/worker-management-api"
import { accountTypeLabel, formatDate, formatINR, money, weekStatusLabel } from "@/lib/worker-management-format"
import type { SettlementResponse } from "@/lib/worker-management-types"
import {
  Badge,
  Currency,
  EmptyState,
  LoadingState,
  Notice,
  SectionTitle,
  WorkerButton,
  WorkerInput,
} from "./worker-ui"

export function WeeklySettlement() {
  const [data, setData] = useState<SettlementResponse | null>(null)
  const [payments, setPayments] = useState<Record<number, string>>({})
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
      const week = await fetchCurrentWeek()
      if (week.week_id === null) {
        setData({ week, items: [] })
        setPayments({})
        return
      }
      const result = await fetchSettlements(week.week_id)
      setData(result)
      setPayments(Object.fromEntries(result.items.map((item) => [item.account_id, item.weekly_payment])))
      setDirtyIds(new Set())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load weekly settlement.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () =>
      (data?.items ?? []).map((item) => {
        const weeklyPayment = Math.max(0, money(payments[item.account_id]))
        return {
          ...item,
          enteredWeeklyPayment: weeklyPayment,
          enteredBalanceToLoan: money(item.wages) - weeklyPayment,
        }
      }),
    [data, payments],
  )

  const totals = rows.reduce(
    (current, row) => ({
      wages: current.wages + money(row.wages),
      cashPaid: current.cashPaid + money(row.cash_paid_during_week),
      payment: current.payment + row.enteredWeeklyPayment,
      balance: current.balance + row.enteredBalanceToLoan,
    }),
    { wages: 0, cashPaid: 0, payment: 0, balance: 0 },
  )

  const editable = data?.week.status === "DRAFT" || data?.week.status === "REOPENED"

  const persistPayments = async () => {
    if (!data?.week.week_id || !dirtyIds.size) return 0
    const changedRows = data.items.filter((item) => dirtyIds.has(item.account_id))
    await Promise.all(
      changedRows.map((item) =>
        updateWeeklyPayment(
          data.week.week_id as number,
          item.account_id,
          Math.max(0, money(payments[item.account_id])).toFixed(2),
          item.row_version,
        ),
      ),
    )
    return changedRows.length
  }

  const savePayments = async () => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const savedCount = await persistPayments()
      setNotice(`${savedCount} weekly payment${savedCount === 1 ? "" : "s"} saved.`)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save weekly payments.")
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
        if (dirtyIds.size) await persistPayments()
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
        description="Wages = Weekly Payment + Balance to Loan. Cash Paid During Week is read-only from the Loan Register and is not deducted twice."
        actions={data ? <Badge tone={data.week.status === "PAID" ? "green" : data.week.status === "CLOSED" ? "blue" : "amber"}>{weekStatusLabel(data.week.status)}</Badge> : null}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <div className="mt-3"><Notice tone="success">{notice}</Notice></div> : null}

      <div className="mt-5">
        {loading ? <LoadingState label="Loading weekly settlement…" /> : null}
        {!loading && !rows.length ? <EmptyState>Save at least one Daily Wage Entry to start this work week.</EmptyState> : null}
        {!loading && rows.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Worker / Group</th>
                    <th className="px-4 py-3 text-right">Wages</th>
                    <th className="px-4 py-3 text-right">Cash Paid During Week</th>
                    <th className="px-4 py-3 text-right">Weekly Payment</th>
                    <th className="px-4 py-3 text-right">Balance to Loan</th>
                    <th className="px-4 py-3 text-right">Projected Account</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.account_id} className="border-t border-border align-middle">
                      <td className="px-4 py-4"><p className="font-bold">{row.display_name}</p><p className="text-xs text-muted-foreground">{row.account_code} · {accountTypeLabel(row.account_type)}</p></td>
                      <td className="px-4 py-4 text-right font-semibold"><Currency value={row.wages} /></td>
                      <td className="px-4 py-4 text-right font-semibold"><Currency value={row.cash_paid_during_week} signed /></td>
                      <td className="px-4 py-4 text-right">
                        <input
                          aria-label={`Weekly Payment for ${row.display_name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          disabled={!editable}
                          value={payments[row.account_id] ?? "0.00"}
                          onChange={(event) => {
                            setPayments((current) => ({ ...current, [row.account_id]: event.target.value }))
                            setDirtyIds((current) => new Set(current).add(row.account_id))
                          }}
                          className="h-10 w-32 rounded-lg border border-input bg-background px-3 text-right font-semibold tabular-nums disabled:opacity-70"
                        />
                      </td>
                      <td className={`px-4 py-4 text-right font-bold ${row.enteredBalanceToLoan < 0 ? "text-red-600" : "text-foreground"}`}>
                        {row.enteredBalanceToLoan > 0 ? "+" : ""}{formatINR(row.enteredBalanceToLoan)}
                      </td>
                      <td className="px-4 py-4 text-right"><Currency value={row.projected_signed_balance} signed /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold">
                  <tr>
                    <td className="px-4 py-4">Total</td>
                    <td className="px-4 py-4 text-right">{formatINR(totals.wages)}</td>
                    <td className="px-4 py-4 text-right text-red-600">{formatINR(totals.cashPaid)}</td>
                    <td className="px-4 py-4 text-right">{formatINR(totals.payment)}</td>
                    <td className={`px-4 py-4 text-right ${totals.balance < 0 ? "text-red-600" : ""}`}>{totals.balance > 0 ? "+" : ""}{formatINR(totals.balance)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {rows.map((row) => (
                <article key={row.account_id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{row.display_name}</h2><p className="text-xs text-muted-foreground">{row.account_code} · {accountTypeLabel(row.account_type)}</p></div><Badge tone={row.settlement_status === "PAID" ? "green" : "muted"}>{row.settlement_status ?? "Draft"}</Badge></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Wages</dt><dd className="mt-1 font-bold"><Currency value={row.wages} /></dd></div>
                    <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Cash paid in week</dt><dd className="mt-1 font-bold"><Currency value={row.cash_paid_during_week} signed /></dd></div>
                    <label className="rounded-lg bg-muted/55 p-3"><span className="text-xs text-muted-foreground">Weekly Payment</span><input aria-label={`Weekly Payment for ${row.display_name}`} type="number" min="0" step="0.01" inputMode="decimal" disabled={!editable} value={payments[row.account_id] ?? "0.00"} onChange={(event) => { setPayments((current) => ({ ...current, [row.account_id]: event.target.value })); setDirtyIds((current) => new Set(current).add(row.account_id)) }} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 font-bold tabular-nums" /></label>
                    <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">Balance to Loan</dt><dd className={`mt-1 font-bold ${row.enteredBalanceToLoan < 0 ? "text-red-600" : ""}`}>{row.enteredBalanceToLoan > 0 ? "+" : ""}{formatINR(row.enteredBalanceToLoan)}</dd></div>
                  </dl>
                </article>
              ))}
              <div className="rounded-xl bg-primary p-4 text-primary-foreground"><p className="text-xs font-semibold uppercase tracking-wide opacity-80">Week total</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="opacity-75">Wages</p><p className="font-bold">{formatINR(totals.wages)}</p></div><div><p className="opacity-75">Weekly Payment</p><p className="font-bold">{formatINR(totals.payment)}</p></div><div><p className="opacity-75">Cash paid</p><p className="font-bold">{formatINR(totals.cashPaid)}</p></div><div><p className="opacity-75">Balance to Loan</p><p className="font-bold">{totals.balance > 0 ? "+" : ""}{formatINR(totals.balance)}</p></div></div></div>
            </div>
          </div>
        ) : null}
      </div>

      {rows.length ? (
        <div className="mt-5 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          {editable ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-bold">Draft settlement</h2><p className="text-sm text-muted-foreground">Save payment changes, then close after Friday evening.</p></div>
              <div className="flex flex-wrap gap-2"><WorkerButton onClick={savePayments} disabled={saving || !dirtyIds.size}><CheckCircle2 className="size-4" aria-hidden="true" />{saving ? "Saving…" : `Save Payments (${dirtyIds.size})`}</WorkerButton><WorkerButton variant="secondary" onClick={() => runWeekAction("close")} disabled={saving || data?.week.row_version === null}><LockKeyhole className="size-4" aria-hidden="true" />Close Week</WorkerButton></div>
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
