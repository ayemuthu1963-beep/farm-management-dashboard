import type { LoanTransaction } from "./types"

/**
 * Sign convention (aligned with the worker prototype ledger):
 * - Cash received BY the worker/group is NEGATIVE (shown red):
 *     Cash Loan/Advance, Deposit Withdrawal.
 * - Money coming back FROM the worker/group is POSITIVE (shown dark/green):
 *     Wage Repayment, Cash Repayment, Deposit Contribution.
 * A negative running balance therefore means the account owes cash to the farm.
 */
export const initialLoanTransactions: LoanTransaction[] = [
  {
    id: "loan-001",
    accountId: "FW-002",
    date: "2026-07-15",
    type: "Cash Loan/Advance",
    amount: -5000,
    notes: "Medical advance",
  },
  {
    id: "loan-002",
    accountId: "FW-002",
    date: "2026-08-05",
    type: "Wage Repayment",
    amount: 1200,
    notes: "Deducted from previous week's settlement",
  },
  {
    id: "loan-003",
    accountId: "FW-002",
    date: "2026-08-06",
    type: "Cash Repayment",
    amount: 800,
    notes: "Paid in cash during previous week",
  },
  {
    id: "loan-004",
    accountId: "FW-003",
    date: "2026-07-28",
    type: "Cash Loan/Advance",
    amount: -3000,
    notes: "Family expense",
  },
  {
    id: "loan-005",
    accountId: "FW-003",
    date: "2026-08-06",
    type: "Wage Repayment",
    amount: 1000,
    notes: "Deducted from previous week's settlement",
  },
  {
    id: "loan-006",
    accountId: "FW-004",
    date: "2026-08-10",
    type: "Cash Loan/Advance",
    amount: -2500,
    notes: "House repair advance paid this week",
  },
  {
    id: "loan-007",
    accountId: "FW-004",
    date: "2026-08-07",
    type: "Cash Repayment",
    amount: 500,
    notes: "Paid in cash during previous week",
  },
  {
    id: "loan-008",
    accountId: "FW-001",
    date: "2026-06-10",
    type: "Deposit Contribution",
    amount: 2000,
    notes: "Voluntary savings contribution",
  },
  {
    id: "loan-009",
    accountId: "FW-001",
    date: "2026-08-12",
    type: "Deposit Withdrawal",
    amount: -1000,
    notes: "Withdrew part of savings for festival expenses this week",
  },
  {
    id: "loan-010",
    accountId: "OW-001",
    date: "2026-07-20",
    type: "Cash Loan/Advance",
    amount: -1500,
    notes: "Advance against upcoming work",
  },
  {
    id: "loan-011",
    accountId: "OW-001",
    date: "2026-08-07",
    type: "Cash Repayment",
    amount: 600,
    notes: "Paid in cash during previous week",
  },
  {
    id: "loan-012",
    accountId: "GR-001",
    date: "2026-07-25",
    type: "Cash Loan/Advance",
    amount: -4000,
    notes: "Group advance for tools",
  },
  {
    id: "loan-013",
    accountId: "GR-001",
    date: "2026-08-07",
    type: "Wage Repayment",
    amount: 1500,
    notes: "Deducted from previous week's settlement",
  },
]
