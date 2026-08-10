"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import {
  fetchAccounts,
  fetchCurrentWeek,
  fetchLedger,
} from "@/lib/worker-management-api"
import {
  accountStateLabel,
  formatDate,
  formatSignedINR,
  money,
  toDateInput,
} from "@/lib/worker-management-format"
import {
  cacheWorkerAccounts,
  discardWorkerOperation,
  getPendingLedgerOperations,
  queueLedgerOperation,
  readCachedWorkerAccounts,
  type WorkerLocalOperation,
} from "@/lib/worker-management-offline"
import type {
  LedgerTransaction,
  ManualTransactionType,
  WorkerAccount,
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
import { useWorkerOffline } from "./worker-offline-provider"

const transactionOptions: Array<{ value: ManualTransactionType; label: string; sign: "negative" | "positive" }> = [
  { value: "CASH_ADVANCE", label: "Cash advance / loan received", sign: "negative" },
  { value: "EXTRA_WAGE_CASH", label: "Extra wage cash received", sign: "negative" },
  { value: "DEPOSIT_WITHDRAWAL", label: "Deposit withdrawal", sign: "negative" },
  { value: "CASH_REPAYMENT", label: "Cash loan repayment", sign: "positive" },
  { value: "DEPOSIT_CONTRIBUTION", label: "Deposit contribution", sign: "positive" },
]

const negativeTransactionTypes = new Set<ManualTransactionType>([
  "CASH_ADVANCE",
  "EXTRA_WAGE_CASH",
  "DEPOSIT_WITHDRAWAL",
])

function transactionLabel(value: string): string {
  if (value === "SETTLEMENT_TRANSFER") return "Loan received from wages"
  return transactionOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ")
}

type LedgerForm = {
  date: string
  accountId: string
  type: ManualTransactionType
  amount: string
  reference: string
  notes: string
}

export function LoanRegister() {
  const { online, lastSync, syncNow, refreshStatus } = useWorkerOffline()
  const [accounts, setAccounts] = useState<WorkerAccount[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [week, setWeek] = useState<WorkWeek | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<WorkerLocalOperation[]>([])
  const [form, setForm] = useState<LedgerForm>({
    date: toDateInput(),
    accountId: "",
    type: "CASH_ADVANCE",
    amount: "",
    reference: "",
    notes: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [accountResult, currentWeek] = await Promise.all([
        fetchAccounts({ pageSize: 200 }),
        fetchCurrentWeek(),
      ])
      const ledgerResult = await fetchLedger({
        weekId: currentWeek.week_id ?? undefined,
        pageSize: 200,
      })
      await cacheWorkerAccounts(accountResult.items)
      setAccounts(accountResult.items)
      setWeek(currentWeek)
      setTransactions(ledgerResult.items)
      setPendingOperations(await getPendingLedgerOperations())
      setForm((current) => ({
        ...current,
        accountId: current.accountId || String(accountResult.items.find((account) => account.is_active)?.account_id ?? ""),
      }))
    } catch (loadError) {
      const cachedAccounts = await readCachedWorkerAccounts()
      const localOperations = await getPendingLedgerOperations()
      if (cachedAccounts.length) {
        setAccounts(cachedAccounts)
        setPendingOperations(localOperations)
        setTransactions([])
        setWeek(null)
        setNotice("Offline account list loaded. New transactions will be saved on this device.")
        setForm((current) => ({
          ...current,
          accountId: current.accountId || String(cachedAccounts.find((account) => account.is_active)?.account_id ?? ""),
        }))
      } else {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the Loan Register.")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [lastSync, load])

  const summaries = useMemo(
    () =>
      accounts.map((account) => {
        const movements = transactions
          .filter((transaction) => transaction.account_id === account.account_id)
          .toSorted((left, right) =>
            `${left.transaction_date}-${left.transaction_id}`.localeCompare(
              `${right.transaction_date}-${right.transaction_id}`,
            ),
          )
        const first = movements[0]
        const opening = first
          ? money(first.running_balance) - money(first.signed_amount)
          : money(account.signed_balance)
        const cashPaid = movements
          .filter((movement) =>
            ["CASH_ADVANCE", "EXTRA_WAGE_CASH", "DEPOSIT_WITHDRAWAL"].includes(
              movement.transaction_type,
            ),
          )
          .reduce((sum, movement) => sum + money(movement.signed_amount), 0)
        const wageTransfer = movements
          .filter((movement) => movement.transaction_type === "SETTLEMENT_TRANSFER")
          .reduce((sum, movement) => sum + money(movement.signed_amount), 0)
        const other = movements.reduce((sum, movement) => sum + money(movement.signed_amount), 0) - cashPaid - wageTransfer
        return { account, opening, cashPaid, wageTransfer, other, balance: money(account.signed_balance) }
      }),
    [accounts, transactions],
  )

  const addTransaction = async () => {
    if (!form.accountId || !form.date || Number(form.amount) <= 0) {
      setError("Date, worker/group account, and a positive amount are required.")
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    let queued = false
    try {
      await queueLedgerOperation({
        account_id: Number(form.accountId),
        transaction_date: form.date,
        transaction_type: form.type,
        amount: Number(form.amount).toFixed(2),
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      })
      queued = true
      setNotice("Loan Register transaction saved on this device.")
      setForm((current) => ({ ...current, amount: "", reference: "", notes: "" }))
      setFormOpen(false)
      await refreshStatus()
      if (online) {
        const result = await syncNow()
        setNotice(
          result.conflicts
            ? "The transaction needs conflict review. It remains saved on this device."
            : "Loan Register transaction synced online.",
        )
      }
      await load()
    } catch (saveError) {
      if (queued) {
        setNotice("Transaction remains saved on this device and will sync when possible.")
        setPendingOperations(await getPendingLedgerOperations())
        await refreshStatus()
      } else {
        setError(saveError instanceof Error ? saveError.message : "Unable to save this transaction.")
      }
    } finally {
      setSaving(false)
    }
  }

  const dismissConflict = async (operationId: string) => {
    setError("")
    try {
      await discardWorkerOperation(operationId)
      setPendingOperations(await getPendingLedgerOperations())
      await refreshStatus()
      setNotice("Reviewed device transaction removed from the sync queue.")
    } catch (dismissError) {
      setError(
        dismissError instanceof Error
          ? dismissError.message
          : "Unable to remove the reviewed transaction.",
      )
    }
  }

  return (
    <div>
      <SectionTitle
        eyebrow="Loan Register"
        title="Signed worker accounts"
        description="Cash received by a worker is negative and red. Repayments, wage transfers toward a loan, and deposit contributions are positive and black. Multiple weekly advances are allowed."
        actions={<WorkerButton onClick={() => setFormOpen((open) => !open)}><Plus className="size-4" aria-hidden="true" />Add Transaction</WorkerButton>}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <div className="mt-3"><Notice tone="success">{notice}</Notice></div> : null}

      {formOpen ? (
        <div className="mt-5 rounded-xl border border-primary/30 bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-primary">New signed movement</p><h2 className="text-lg font-bold">Loan or deposit transaction</h2></div><Badge tone={transactionOptions.find((option) => option.value === form.type)?.sign === "negative" ? "red" : "green"}>{transactionOptions.find((option) => option.value === form.type)?.sign === "negative" ? "Negative" : "Positive"}</Badge></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WorkerInput label="Date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            <WorkerSelect label="Worker / Group account" value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}>
              <option value="">Select account</option>
              {accounts.filter((account) => account.is_active).map((account) => <option key={account.account_id} value={account.account_id}>{account.display_name} · {account.account_code}</option>)}
            </WorkerSelect>
            <WorkerSelect label="Transaction type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ManualTransactionType }))}>
              {transactionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </WorkerSelect>
            <WorkerInput label="Amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} hint="Enter a positive amount; the transaction type applies the sign." />
            <WorkerInput label="Reference" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Medical advance, cash repayment…" />
            <WorkerInput label="Notes (optional)" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <div className="mt-4 flex gap-2"><WorkerButton onClick={addTransaction} disabled={saving}>{saving ? "Saving…" : "Save Transaction"}</WorkerButton><WorkerButton variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</WorkerButton></div>
        </div>
      ) : null}

      {pendingOperations.length ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-amber-950">Device transaction queue</p>
              <p className="text-xs text-amber-900">Each advance has its own operation ID and can sync only once.</p>
            </div>
            <Badge tone="amber">{pendingOperations.length} pending</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {pendingOperations.map((operation) => {
              if (operation.entity_type !== "LEDGER") return null
              const account = accounts.find((item) => item.account_id === operation.payload.account_id)
              const negative = negativeTransactionTypes.has(operation.payload.transaction_type)
              return (
                <div key={operation.operation_id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{account?.display_name ?? `Account ${operation.payload.account_id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(operation.payload.transaction_date)} · {transactionLabel(operation.payload.transaction_type)}
                      </p>
                    </div>
                    <p className={negative ? "font-bold text-red-600" : "font-bold"}>
                      {negative ? "−" : "+"}{formatSignedINR(operation.payload.amount).replace(/^\+/, "")}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {operation.state === "CONFLICT"
                        ? operation.detail || "Conflict review required"
                        : operation.state === "SAVED_ON_DEVICE"
                          ? "Saved on Device"
                          : "Waiting to Sync"}
                    </p>
                    {operation.state === "CONFLICT" ? (
                      <WorkerButton variant="ghost" onClick={() => void dismissConflict(operation.operation_id)}>
                        Dismiss after review
                      </WorkerButton>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        {loading ? <LoadingState label="Loading signed worker accounts…" /> : null}
        {!loading && !summaries.length ? <EmptyState>Add a Worker or Group account to begin the Loan Register.</EmptyState> : null}
        {!loading && summaries.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Worker / Group</th><th className="px-4 py-3 text-right">Existing Loan / Deposit</th><th className="px-4 py-3 text-right">Cash Paid During Week</th><th className="px-4 py-3 text-right">Loan Received from Wages</th><th className="px-4 py-3 text-right">Balance Loan / Deposit</th></tr></thead>
                <tbody>{summaries.map(({ account, opening, cashPaid, wageTransfer, other, balance }) => <tr key={account.account_id} className="border-t border-border"><td className="px-4 py-4"><p className="font-bold">{account.display_name}</p><p className="text-xs text-muted-foreground">{account.account_code} · {accountStateLabel(account.account_state)}</p></td><td className={`px-4 py-4 text-right font-semibold ${opening < 0 ? "text-red-600" : ""}`}>{formatSignedINR(opening)}</td><td className="px-4 py-4 text-right font-semibold text-red-600">{formatSignedINR(cashPaid)}</td><td className={`px-4 py-4 text-right font-semibold ${wageTransfer < 0 ? "text-red-600" : ""}`}>{formatSignedINR(wageTransfer)}</td><td className={`px-4 py-4 text-right font-bold ${balance < 0 ? "text-red-600" : ""}`}>{formatSignedINR(balance)}{other ? <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Other movements {formatSignedINR(other)}</span> : null}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">{summaries.map(({ account, opening, cashPaid, wageTransfer, other, balance }) => <article key={account.account_id} className="rounded-xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{account.display_name}</h2><p className="text-xs text-muted-foreground">{account.account_code}</p></div><Badge tone={balance < 0 ? "red" : balance > 0 ? "green" : "muted"}>{accountStateLabel(account.account_state)}</Badge></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Existing</dt><dd className={`font-bold ${opening < 0 ? "text-red-600" : ""}`}>{formatSignedINR(opening)}</dd></div><div><dt className="text-xs text-muted-foreground">Cash paid</dt><dd className="font-bold text-red-600">{formatSignedINR(cashPaid)}</dd></div><div><dt className="text-xs text-muted-foreground">From wages</dt><dd className={`font-bold ${wageTransfer < 0 ? "text-red-600" : ""}`}>{formatSignedINR(wageTransfer)}</dd></div><div><dt className="text-xs text-muted-foreground">Balance</dt><dd className={`font-bold ${balance < 0 ? "text-red-600" : ""}`}>{formatSignedINR(balance)}</dd></div></dl>{other ? <p className="mt-3 text-xs text-muted-foreground">Other weekly movements {formatSignedINR(other)}</p> : null}</article>)}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Transaction register</h2><p className="text-sm text-muted-foreground">{week?.week_id ? `${formatDate(week.start_date)} – ${formatDate(week.end_date)}` : "Recent movements"}</p></div><Badge tone="muted">{transactions.length} entries</Badge></div>
        {!loading && !transactions.length ? <EmptyState>No signed movements have been posted for this week.</EmptyState> : null}
        {transactions.length ? <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Running Balance</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.transaction_id} className="border-t border-border"><td className="px-4 py-4">{formatDate(transaction.transaction_date)}</td><td className="px-4 py-4 font-semibold">{transaction.display_name}</td><td className="px-4 py-4 text-muted-foreground">{transactionLabel(transaction.transaction_type)}</td><td className="px-4 py-4 text-muted-foreground">{transaction.reference || "—"}</td><td className="px-4 py-4 text-right font-bold"><Currency value={transaction.signed_amount} signed /></td><td className="px-4 py-4 text-right font-semibold"><Currency value={transaction.running_balance} signed /></td></tr>)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{transactions.map((transaction) => <article key={transaction.transaction_id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{transaction.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(transaction.transaction_date)} · {transactionLabel(transaction.transaction_type)}</p></div><Currency value={transaction.signed_amount} signed className="font-bold" /></div><p className="mt-3 text-sm text-muted-foreground">{transaction.reference || transaction.notes || "No reference"}</p><p className="mt-2 text-xs text-muted-foreground">Running balance <Currency value={transaction.running_balance} signed className="font-semibold" /></p></article>)}</div></div> : null}
      </div>
    </div>
  )
}
