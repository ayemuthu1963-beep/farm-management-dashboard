export const SAPLING_MONTHS = 36

export type TreeLifecycleOverride = "AUTO" | "FORCE_HARVEST"
export type TreeLifecycleStatus = "Sapling" | "Harvest Tree"

type CalendarDate = {
  year: number
  month: number
  day: number
}

function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const asUtc = new Date(Date.UTC(year, month - 1, day))

  if (
    !Number.isInteger(year) ||
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

/**
 * Returns completed calendar months. A palm planted on 03 Aug becomes
 * 36 months old on 03 Aug three years later, not on the preceding day.
 */
export function completedMonthsSincePlanted(plantationDate: string, asOfDate: string): number | null {
  const planted = parseIsoDate(plantationDate)
  const asOf = parseIsoDate(asOfDate)
  if (!planted || !asOf) return null

  let months = (asOf.year - planted.year) * 12 + (asOf.month - planted.month)
  if (asOf.day < planted.day) months -= 1
  return Math.max(0, months)
}

export function resolveTreeLifecycleStatus(
  plantationDate: string | null | undefined,
  asOfDate: string,
  lifecycleOverride: TreeLifecycleOverride = "AUTO",
): TreeLifecycleStatus {
  if (lifecycleOverride === "FORCE_HARVEST") return "Harvest Tree"
  if (!plantationDate) return "Harvest Tree"

  const months = completedMonthsSincePlanted(plantationDate, asOfDate)
  return months !== null && months < SAPLING_MONTHS ? "Sapling" : "Harvest Tree"
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null
}
