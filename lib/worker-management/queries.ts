export type QueryStatus = "Open" | "Resolved"

export interface WorkerQuery {
  id: string
  accountId: string
  subject: string
  detail: string
  date: string
  status: QueryStatus
  resolutionNote?: string
}

export const initialQueries: WorkerQuery[] = [
  {
    id: "query-001",
    accountId: "FW-002",
    subject: "Overtime not reflected",
    detail: "Selvam says Tuesday's extra irrigation hours are missing from this week's entry.",
    date: "2026-08-11",
    status: "Open",
  },
  {
    id: "query-002",
    accountId: "GR-001",
    subject: "Headcount mismatch",
    detail: "Harvest Group A reports 6 members attended on 10 Aug but only 4 were recorded.",
    date: "2026-08-10",
    status: "Open",
  },
  {
    id: "query-003",
    accountId: "OW-001",
    subject: "Advance repayment amount",
    detail: "Muthu Raja asked to confirm how much of his advance was deducted last week.",
    date: "2026-08-05",
    status: "Resolved",
    resolutionNote: "Confirmed ₹600 was deducted as cash repayment on 09 Aug.",
  },
  {
    id: "query-004",
    accountId: "FW-004",
    subject: "Wage rate query",
    detail: "Arun asked whether his daily rate changed after the irrigation training.",
    date: "2026-08-02",
    status: "Resolved",
    resolutionNote: "Rate confirmed unchanged at ₹700/day; training was unpaid.",
  },
]
