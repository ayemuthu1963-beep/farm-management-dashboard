"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchDashboard } from "@/lib/worker-management-api"
import { accountTypeLabel, formatDate, formatINR } from "@/lib/worker-management-format"
import type { DashboardResponse } from "@/lib/worker-management-types"
import { Badge, Currency, EmptyState, LoadingState, Notice, SectionTitle } from "./worker-ui"

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border border-border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>{detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}</div>
}

export function WorkerDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await fetchDashboard())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the Worker Dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <SectionTitle
        eyebrow="Dashboard"
        title="Farm office overview"
        description={data?.week ? `${formatDate(data.week.start_date)} – ${formatDate(data.week.end_date)} · Saturday–Friday` : "Weekly wages, attendance, payments, and account movement."}
        actions={data?.week ? <Badge tone={data.week.status === "PAID" ? "green" : "amber"}>{data.week.status}</Badge> : null}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="mt-5">
        {loading ? <LoadingState label="Loading Worker Dashboard…" /> : null}
        {!loading && !data?.week ? <EmptyState>No work week has started. Save Daily Wage Entries to populate the dashboard.</EmptyState> : null}
        {!loading && data?.week ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Total wages" value={formatINR(data.totals.total_wages)} />
              <Metric label="Worker accounts" value={String(data.totals.account_count)} detail={`${data.totals.attended_entry_count} attended entries`} />
              <Metric label="Attendance" value={`${data.totals.attendance_person_days}`} detail="person-days" />
              <Metric label="Balance to Loan" value={formatINR(data.totals.total_balance_to_loan)} detail="Wages − Weekly Payment" />
              <Metric label="Paid / unpaid" value={`${data.totals.paid_account_count} / ${data.totals.unpaid_account_count}`} detail={`${formatINR(data.totals.total_weekly_payment)} weekly payment`} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Wage breakdown</h2><p className="mt-1 text-sm text-muted-foreground">Totals by Worker account type</p></div><Badge tone={data.totals.unpaid_account_count ? "amber" : "green"}>{data.totals.unpaid_account_count ? "Payment pending" : "Paid in full"}</Badge></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {data.breakdown.map((row) => <div key={row.account_type} className="rounded-xl bg-muted/55 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{accountTypeLabel(row.account_type)}</p><p className="mt-2 text-xl font-bold"><Currency value={row.total_wages} /></p><dl className="mt-3 space-y-1 text-xs text-muted-foreground"><div className="flex justify-between gap-2"><dt>Accounts</dt><dd className="font-semibold text-foreground">{row.account_count}</dd></div><div className="flex justify-between gap-2"><dt>Attendance</dt><dd className="font-semibold text-foreground">{row.attendance_person_days}</dd></div><div className="flex justify-between gap-2"><dt>Balance to Loan</dt><dd className="font-semibold text-foreground"><Currency value={row.total_balance_to_loan} signed /></dd></div></dl></div>)}
                </div>
              </section>
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-bold">Weekly payment summary</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The four wage columns reconcile without deducting Cash Paid During Week twice.</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Wages</dt><dd className="font-bold"><Currency value={data.totals.total_wages} /></dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cash paid during week</dt><dd className="font-bold"><Currency value={data.totals.total_cash_paid_during_week} signed /></dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Weekly Payment</dt><dd className="font-bold"><Currency value={data.totals.total_weekly_payment} /></dd></div>
                  <div className="flex justify-between gap-3 border-t border-border pt-3"><dt className="font-semibold">Balance to Loan</dt><dd className="font-bold"><Currency value={data.totals.total_balance_to_loan} signed /></dd></div>
                </dl>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
