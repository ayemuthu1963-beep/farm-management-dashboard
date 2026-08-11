import type { Account, AccountType } from "./types"

export const accountIdPrefix: Record<AccountType, string> = {
  Farm: "FW",
  Outside: "OW",
  Group: "GR",
}

export const initialAccounts: Account[] = [
  {
    id: "FW-001",
    type: "Farm",
    name: "Ravi Kumar",
    phone: "+91 98420 11234",
    joinDate: "2023-01-12",
    rate: 850,
    status: "Active",
    statusHistory: [{ date: "2023-01-12", status: "Active", note: "Joined as Field Supervisor" }],
  },
  {
    id: "FW-002",
    type: "Farm",
    name: "Selvam",
    phone: "+91 98420 22451",
    joinDate: "2023-03-04",
    rate: 650,
    status: "Active",
    statusHistory: [{ date: "2023-03-04", status: "Active", note: "Joined as Farm Worker" }],
  },
  {
    id: "FW-003",
    type: "Farm",
    name: "Meena",
    phone: "+91 98420 33782",
    joinDate: "2023-06-18",
    rate: 650,
    status: "Active",
    statusHistory: [{ date: "2023-06-18", status: "Active", note: "Joined as Farm Worker" }],
  },
  {
    id: "FW-004",
    type: "Farm",
    name: "Arun",
    phone: "+91 98420 44903",
    joinDate: "2023-08-29",
    rate: 700,
    status: "Active",
    statusHistory: [{ date: "2023-08-29", status: "Active", note: "Joined as Irrigation Assistant" }],
  },
  {
    id: "FW-005",
    type: "Farm",
    name: "Lakshmi",
    phone: "+91 98420 55871",
    joinDate: "2023-11-02",
    rate: 600,
    status: "Inactive",
    statusHistory: [
      { date: "2023-11-02", status: "Active", note: "Joined as Seasonal Worker" },
      { date: "2026-06-20", status: "Inactive", note: "Left at end of season" },
    ],
  },
  {
    id: "OW-001",
    type: "Outside",
    name: "Muthu Raja",
    phone: "+91 98420 66120",
    joinDate: "2025-02-10",
    rate: 750,
    status: "Active",
    statusHistory: [{ date: "2025-02-10", status: "Active", note: "Registered as outside labour" }],
  },
  {
    id: "OW-002",
    type: "Outside",
    name: "Kannan",
    phone: "+91 98420 77341",
    joinDate: "2025-05-22",
    rate: 750,
    status: "Active",
    statusHistory: [{ date: "2025-05-22", status: "Active", note: "Registered as outside labour" }],
  },
  {
    id: "OW-003",
    type: "Outside",
    name: "Ganesan",
    phone: "+91 98420 88452",
    joinDate: "2024-09-14",
    rate: 700,
    status: "Inactive",
    statusHistory: [
      { date: "2024-09-14", status: "Active", note: "Registered as outside labour" },
      { date: "2026-04-01", status: "Inactive", note: "Not called back for the current season" },
    ],
  },
  {
    id: "GR-001",
    type: "Group",
    name: "Harvest Group A",
    joinDate: "2024-01-08",
    rate: 550,
    status: "Active",
    groupHead: "Selvam",
    memberCount: 6,
    statusHistory: [{ date: "2024-01-08", status: "Active", note: "Formed for coconut harvest work" }],
  },
  {
    id: "GR-002",
    type: "Group",
    name: "Weeding Group B",
    joinDate: "2024-04-16",
    rate: 500,
    status: "Active",
    groupHead: "Meena",
    memberCount: 4,
    statusHistory: [{ date: "2024-04-16", status: "Active", note: "Formed for weeding and land clearing" }],
  },
]

export function nextAccountId(type: AccountType, existing: Account[]): string {
  const prefix = accountIdPrefix[type]
  const numbers = existing
    .filter((account) => account.type === type)
    .map((account) => Number.parseInt(account.id.split("-")[1] ?? "0", 10))
    .filter((value) => !Number.isNaN(value))
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  return `${prefix}-${String(next).padStart(3, "0")}`
}

export function findAccount(accounts: Account[], accountId: string) {
  return accounts.find((account) => account.id === accountId)
}
