"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchCurrentWeek, fetchLedger, fetchWageReport } from "@/lib/worker-management-api"
import { accountTypeLabel, formatDate } from "@/lib/worker-management-format"
import type {
  AccountType,
  LedgerTransaction,
  WageReportRow,
  WorkWeek,
} from "@/lib/worker-management-types"
import {
  Badge,
  Currency,
  EmptyState,
  LoadingState,
  Notice,
  SectionTitle,
  WorkerButton,
  WorkerInput,
  WorkerSelect,
} from "./worker-ui"

type Register = "wage" | "loan"
type Filters = {
  startDate: string
  endDate: string
  accountType: "" | AccountType
  search: string
  paymentStatus: "" | "PAID" | "UNPAID"
}

const emptyFilters: Filters = {
  startDate: "",
  endDate: "",
  accountType: "",
  search: "",
  paymentStatus: "",
}

export function WorkerQuery() {
  const [register, setRegister] = useState<Register>("wage")
  const [week, setWeek] = useState<WorkWeek | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [wages, setWages] = useState<WageReportRow[]>([])
  const [ledger, setLedger] = useState<LedgerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (selectedFilters: Filters) => {
    setLoading(true)
    setError("")
    try {
      const currentWeek = await fetchCurrentWeek()
      const [wageResult, ledgerResult] = await Promise.all([
        fetchWageReport({
          weekId: currentWeek.week_id ?? undefined,
          accountType: selectedFilters.accountType || undefined,
          settlementStatus: selectedFilters.paymentStatus === "PAID" ? "PAID" : undefined,
          startDate: selectedFilters.startDate || undefined,
          endDate: selectedFilters.endDate || undefined,
          search: selectedFilters.search || undefined,
          pageSize: 200,
        }),
        fetchLedger({
          weekId: currentWeek.week_id ?? undefined,
          startDate: selectedFilters.startDate || undefined,
          endDate: selectedFilters.endDate || undefined,
          accountType: selectedFilters.accountType || undefined,
          search: selectedFilters.search || undefined,
          pageSize: 200,
        }),
      ])
      setWeek(currentWeek)
      setWages(
        selectedFilters.paymentStatus === "UNPAID"
          ? wageResult.items.filter((row) => row.settlement_status !== "PAID")
          : wageResult.items,
      )
      setLedger(ledgerResult.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to run the Worker query.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(emptyFilters)
  }, [load])

  const clear = () => {
    setFilters(emptyFilters)
    void load(emptyFilters)
  }

  return (
    <div>
      <SectionTitle
        eyebrow="Query"
        title="Registers and worker history"
        description="Filter by week, custom dates, worker type, worker/group name, and payment status."
        actions={week?.week_id ? <Badge tone="muted">{formatDate(week.start_date)} – {formatDate(week.end_date)}</Badge> : null}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}

      <form
        className="mt-5 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void load(filters)
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <WorkerInput label="From" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
          <WorkerInput label="To" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
          <WorkerSelect label="Worker type" value={filters.accountType} onChange={(event) => setFilters((current) => ({ ...current, accountType: event.target.value as Filters["accountType"] }))}><option value="">All types</option><option value="FARM">Farm Worker</option><option value="OUTSIDE">Outside Worker</option><option value="GROUP">Group</option></WorkerSelect>
          <WorkerInput label="Worker / Group" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, ID, or leader" />
          <WorkerSelect label="Payment status" value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value as Filters["paymentStatus"] }))}><option value="">All</option><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></WorkerSelect>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><WorkerButton type="submit" disabled={loading}>{loading ? "Applying…" : "Apply Filters"}</WorkerButton><WorkerButton variant="secondary" onClick={clear} disabled={loading}>Clear</WorkerButton></div>
      </form>

      <div className="mt-5 flex gap-2">
        <WorkerButton variant={register === "wage" ? "primary" : "secondary"} onClick={() => setRegister("wage")}>Wage Register</WorkerButton>
        <WorkerButton variant={register === "loan" ? "primary" : "secondary"} onClick={() => setRegister("loan")}>Loan Register</WorkerButton>
      </div>

      <div className="mt-4">
        {loading ? <LoadingState label="Running Worker Management query…" /> : null}
        {!loading && register === "wage" && !wages.length ? <EmptyState>No wage rows match these filters.</EmptyState> : null}
        {!loading && register === "loan" && !ledger.length ? <EmptyState>No Loan Register rows match these filters.</EmptyState> : null}

        {!loading && register === "wage" && wages.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Week</th><th className="px-4 py-3">Worker / Group</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Wages</th><th className="px-4 py-3 text-right">Weekly Payment</th><th className="px-4 py-3 text-right">Balance to Loan</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{wages.map((row) => <tr key={`${row.week_id}-${row.account_id}-${row.week_version}`} className="border-t border-border"><td className="px-4 py-4 text-muted-foreground">{formatDate(row.start_date)} – {formatDate(row.end_date)}</td><td className="px-4 py-4 font-bold">{row.display_name}</td><td className="px-4 py-4 text-muted-foreground">{accountTypeLabel(row.account_type)}</td><td className="px-4 py-4 text-right"><Currency value={row.wages} /></td><td className="px-4 py-4 text-right"><Currency value={row.weekly_payment} /></td><td className="px-4 py-4 text-right font-bold"><Currency value={row.balance_to_loan} signed /></td><td className="px-4 py-4"><Badge tone={row.settlement_status === "PAID" ? "green" : "amber"}>{row.settlement_status ?? "Draft"}</Badge></td></tr>)}</tbody></table></div>
            <div className="space-y-3 p-3 md:hidden">{wages.map((row) => <article key={`${row.week_id}-${row.account_id}-${row.week_version}`} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{row.display_name}</p><p className="text-xs text-muted-foreground">{accountTypeLabel(row.account_type)} · {formatDate(row.start_date)}</p></div><Badge tone={row.settlement_status === "PAID" ? "green" : "amber"}>{row.settlement_status ?? "Draft"}</Badge></div><dl className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-muted-foreground">Wages</dt><dd className="font-bold"><Currency value={row.wages} /></dd></div><div><dt className="text-muted-foreground">Payment</dt><dd className="font-bold"><Currency value={row.weekly_payment} /></dd></div><div><dt className="text-muted-foreground">To Loan</dt><dd className="font-bold"><Currency value={row.balance_to_loan} signed /></dd></div></dl></article>)}</div>
          </div>
        ) : null}

        {!loading && register === "loan" && ledger.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody>{ledger.map((row) => <tr key={row.transaction_id} className="border-t border-border"><td className="px-4 py-4">{formatDate(row.transaction_date)}</td><td className="px-4 py-4 font-bold">{row.display_name}</td><td className="px-4 py-4 text-muted-foreground">{row.transaction_type.replaceAll("_", " ")}</td><td className="px-4 py-4 text-muted-foreground">{row.reference || "—"}</td><td className="px-4 py-4 text-right font-bold"><Currency value={row.signed_amount} signed /></td><td className="px-4 py-4 text-right font-semibold"><Currency value={row.running_balance} signed /></td></tr>)}</tbody></table></div>
            <div className="space-y-3 p-3 md:hidden">{ledger.map((row) => <article key={row.transaction_id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{row.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(row.transaction_date)} · {row.transaction_type.replaceAll("_", " ")}</p></div><Currency value={row.signed_amount} signed className="font-bold" /></div><p className="mt-3 text-sm text-muted-foreground">{row.reference || "No reference"}</p></article>)}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
