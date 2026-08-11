"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import type { Account, LoanTransactionType } from "@/lib/worker-management"

const transactionTypes: LoanTransactionType[] = [
  "Cash Loan/Advance",
  "Wage Repayment",
  "Cash Repayment",
  "Deposit Contribution",
  "Deposit Withdrawal",
]

/**
 * Default sign per type. Negative = cash out to the worker (Cash Loan/Advance,
 * Deposit Withdrawal); positive = money coming back from the worker (Wage Repayment,
 * Cash Repayment, Deposit Contribution).
 */
const defaultSign: Record<LoanTransactionType, 1 | -1> = {
  "Cash Loan/Advance": -1,
  "Wage Repayment": 1,
  "Cash Repayment": 1,
  "Deposit Contribution": 1,
  "Deposit Withdrawal": -1,
}

export interface LoanTransactionSubmit {
  accountId: string
  date: string
  type: LoanTransactionType
  amount: number
  notes: string
}

export function LoanTransactionForm({
  accounts,
  onSubmit,
  onCancel,
}: {
  accounts: Account[]
  onSubmit: (values: LoanTransactionSubmit) => void
  onCancel: () => void
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<LoanTransactionType>("Cash Loan/Advance")
  const [sign, setSign] = useState<1 | -1>(-1)
  const [magnitude, setMagnitude] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleTypeChange(nextType: LoanTransactionType) {
    setType(nextType)
    setSign(defaultSign[nextType])
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number.parseFloat(magnitude)
    if (!accountId) {
      setError("Choose an account.")
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.")
      return
    }
    onSubmit({ accountId, date, type, amount: sign * value, notes: notes.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Account</span>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.id} · {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Transaction type</span>
          <select
            value={type}
            onChange={(event) => handleTypeChange(event.target.value as LoanTransactionType)}
            className="rounded-lg border border-input bg-background px-3 py-2"
          >
            {transactionTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Amount</span>
          <div className="flex gap-2">
            <select
              value={sign}
              onChange={(event) => setSign(Number(event.target.value) as 1 | -1)}
              aria-label="Amount sign"
              className="rounded-lg border border-input bg-background px-2 py-2"
            >
              <option value={-1}>− Cash out to worker</option>
              <option value={1}>+ Money in (repayment)</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={magnitude}
              onChange={(event) => setMagnitude(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="rounded-lg border border-input bg-background px-3 py-2"
            placeholder="e.g. Advance for family expense"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Add transaction</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
