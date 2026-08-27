type RosterAccount = {
  account_code: string
}

export const approvedWorkerRoster = [
  { accountCode: "1", name: "Kuppan", fullWage: 620, rateNote: "Full wage ₹620" },
  { accountCode: "2", name: "Arunan", fullWage: 400, rateNote: "₹400 / ₹266 / ₹133" },
  { accountCode: "3", name: "Sivan", fullWage: 350, rateNote: "₹350 / ₹233 / ₹116" },
  { accountCode: "4", name: "Lokesh", fullWage: 300, rateNote: "₹300 / ₹200 / ₹100" },
  { accountCode: "5", name: "Tiruma", fullWage: 300, rateNote: "₹300 / ₹150" },
  { accountCode: "6", name: "Rani", fullWage: 300, rateNote: "₹300 / ₹150" },
  { accountCode: "8", name: "Mary", fullWage: 300, rateNote: "₹300 / ₹150" },
  { accountCode: "9", name: "Raja Mani", fullWage: 300, rateNote: "₹300 / ₹150" },
  { accountCode: "10", name: "Chitra", fullWage: 300, rateNote: "₹300 / ₹150" },
  { accountCode: "7", name: "Vijaya", fullWage: 300, rateNote: "₹300 / ₹150" },
  { accountCode: "21", name: "Outside Ladies", fullWage: 320, rateNote: "₹320 / ₹160" },
] as const

const approvedRosterOrder = new Map<string, number>(
  approvedWorkerRoster.map((worker, index) => [worker.accountCode, index]),
)
const accountCodeCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" })

export function compareApprovedWorkerRoster(left: RosterAccount, right: RosterAccount): number {
  const leftOrder = approvedRosterOrder.get(left.account_code.trim()) ?? 1000
  const rightOrder = approvedRosterOrder.get(right.account_code.trim()) ?? 1000
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return accountCodeCollator.compare(left.account_code.trim(), right.account_code.trim())
}
