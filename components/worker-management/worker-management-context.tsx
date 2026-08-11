"use client"

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import {
  initialAccounts,
  initialLoanTransactions,
  initialWageEntries,
  type Account,
  type LoanTransaction,
  type WageEntry,
} from "@/lib/worker-management"

interface WorkerManagementContextValue {
  accounts: Account[]
  setAccounts: Dispatch<SetStateAction<Account[]>>
  wageEntries: WageEntry[]
  setWageEntries: Dispatch<SetStateAction<WageEntry[]>>
  loanTransactions: LoanTransaction[]
  setLoanTransactions: Dispatch<SetStateAction<LoanTransaction[]>>
  /** Editable weekly payment overrides, keyed by `${accountId}__${weekStart}`. */
  weeklyPayments: Record<string, number>
  setWeeklyPayments: Dispatch<SetStateAction<Record<string, number>>>
}

const WorkerManagementContext = createContext<WorkerManagementContextValue | null>(null)

export function weeklyPaymentKey(accountId: string, weekStart: string) {
  return `${accountId}__${weekStart}`
}

export function WorkerManagementProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [wageEntries, setWageEntries] = useState<WageEntry[]>(initialWageEntries)
  const [loanTransactions, setLoanTransactions] = useState<LoanTransaction[]>(initialLoanTransactions)
  const [weeklyPayments, setWeeklyPayments] = useState<Record<string, number>>({})

  const value = useMemo(
    () => ({
      accounts,
      setAccounts,
      wageEntries,
      setWageEntries,
      loanTransactions,
      setLoanTransactions,
      weeklyPayments,
      setWeeklyPayments,
    }),
    [accounts, wageEntries, loanTransactions, weeklyPayments],
  )

  return <WorkerManagementContext.Provider value={value}>{children}</WorkerManagementContext.Provider>
}

export function useWorkerManagement() {
  const context = useContext(WorkerManagementContext)
  if (!context) {
    throw new Error("useWorkerManagement must be used within a WorkerManagementProvider")
  }
  return context
}
