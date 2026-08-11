export type WorkerStatus = "Active" | "Inactive"
export type PaymentStatus = "Pending" | "Paid"

export interface Worker {
  id: string
  name: string
  role: string
  phone: string
  joinDate: string
  dailyWage: number
  status: WorkerStatus
}

export interface WageEntry {
  id: string
  workerId: string
  date: string
  daysWorked: number
  overtimeHours: number
  advance: number
  status: PaymentStatus
}

export interface Loan {
  id: string
  workerId: string
  date: string
  amount: number
  repaid: number
  note: string
}

export const workers: Worker[] = [
  { id: "w-001", name: "Ravi Kumar", role: "Field Supervisor", phone: "+91 98420 11234", joinDate: "12 Jan 2023", dailyWage: 850, status: "Active" },
  { id: "w-002", name: "Selvam", role: "Farm Worker", phone: "+91 98420 22451", joinDate: "04 Mar 2023", dailyWage: 650, status: "Active" },
  { id: "w-003", name: "Meena", role: "Farm Worker", phone: "+91 98420 33782", joinDate: "18 Jun 2023", dailyWage: 650, status: "Active" },
  { id: "w-004", name: "Arun", role: "Irrigation Assistant", phone: "+91 98420 44903", joinDate: "29 Aug 2023", dailyWage: 700, status: "Active" },
  { id: "w-005", name: "Lakshmi", role: "Seasonal Worker", phone: "+91 98420 55871", joinDate: "02 Nov 2023", dailyWage: 600, status: "Inactive" },
]

export const wageEntries: WageEntry[] = [
  { id: "wage-001", workerId: "w-001", date: "08 Aug 2026", daysWorked: 6, overtimeHours: 3, advance: 0, status: "Pending" },
  { id: "wage-002", workerId: "w-002", date: "08 Aug 2026", daysWorked: 5, overtimeHours: 2, advance: 500, status: "Pending" },
  { id: "wage-003", workerId: "w-003", date: "08 Aug 2026", daysWorked: 6, overtimeHours: 0, advance: 0, status: "Paid" },
  { id: "wage-004", workerId: "w-004", date: "08 Aug 2026", daysWorked: 4, overtimeHours: 4, advance: 300, status: "Pending" },
]

export const loans: Loan[] = [
  { id: "loan-001", workerId: "w-002", date: "15 Jul 2026", amount: 5000, repaid: 2000, note: "Medical advance" },
  { id: "loan-002", workerId: "w-003", date: "28 Jul 2026", amount: 3000, repaid: 1000, note: "Family expense" },
  { id: "loan-003", workerId: "w-004", date: "01 Aug 2026", amount: 2500, repaid: 0, note: "House repair" },
]

export const findWorker = (id: string) => workers.find((worker) => worker.id === id)
export const calculateWage = (entry: WageEntry, worker: Worker) => entry.daysWorked * worker.dailyWage + entry.overtimeHours * 100 - entry.advance
export const loanBalance = (loan: Loan) => loan.amount - loan.repaid
export const formatRupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`

export const dashboardTotals = {
  activeWorkers: workers.filter((worker) => worker.status === "Active").length,
  thisWeek: wageEntries.reduce((total, entry) => total + calculateWage(entry, findWorker(entry.workerId)!), 0),
  pendingSettlement: wageEntries.filter((entry) => entry.status === "Pending").reduce((total, entry) => total + calculateWage(entry, findWorker(entry.workerId)!), 0),
  outstandingLoans: loans.reduce((total, loan) => total + loanBalance(loan), 0),
}

export const queries = [
  { id: "q-001", subject: "Leave request for family function", worker: "Selvam", date: "08 Aug 2026", status: "Open" },
  { id: "q-002", subject: "Wage clarification - July", worker: "Meena", date: "06 Aug 2026", status: "Resolved" },
  { id: "q-003", subject: "Request for advance", worker: "Arun", date: "04 Aug 2026", status: "Open" },
]

export const navItems = ["Dashboard", "Daily Wage Entry", "Worker Directory", "Weekly Settlement", "Loan Register", "Query"] as const
export type WorkerSection = (typeof navItems)[number]
