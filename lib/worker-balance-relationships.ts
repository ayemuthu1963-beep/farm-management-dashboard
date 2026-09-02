export const dependentWorkerAccountCodes = new Set(["6", "10"])

const pairedDependentAccountCodes = new Map([
  ["3", "10"],
  ["5", "6"],
])

export function isDependentWorkerAccount(accountCode: string | null | undefined) {
  return typeof accountCode === "string" && dependentWorkerAccountCodes.has(accountCode)
}

export function pairedDependentAccountCode(accountCode: string | null | undefined) {
  return typeof accountCode === "string" ? pairedDependentAccountCodes.get(accountCode) ?? null : null
}
