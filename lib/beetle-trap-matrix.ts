export type BeetleTrapType = "Rhinoceros Beetle" | "Red Palm Weevil" | "Unknown"

export interface BeetleTrapInspectionRecord {
  inspection_date?: string | null
  beetle_count?: string | number | null
}

export interface BeetleTrapLocationRecord {
  trap_no: string
  trap_type: string
  active?: boolean
  inspection_records?: BeetleTrapInspectionRecord[] | null
}

export interface BeetleTrapMatrixColumn {
  trapNo: string
  trapType: BeetleTrapType
  total: number
}

export interface BeetleTrapMatrixRow {
  sourceDate: string
  counts: Array<number | null>
}

export interface BeetleTrapMatrix {
  traps: BeetleTrapMatrixColumn[]
  rows: BeetleTrapMatrixRow[]
}

function normalizeTrapType(value: string): BeetleTrapType {
  if (value === "Red Palm Weevil") return "Red Palm Weevil"
  if (value === "Rhinoceros Beetle") return "Rhinoceros Beetle"
  return "Unknown"
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function normalizeCount(value: string | number | null | undefined): number {
  const count = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}

function compareTrapNumbers(left: string, right: string): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftIsNumber = Number.isFinite(leftNumber)
  const rightIsNumber = Number.isFinite(rightNumber)

  if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }
  if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1
  return left.localeCompare(right, "en", { numeric: true })
}

export function buildBeetleTrapMatrix(
  locations: BeetleTrapLocationRecord[],
  dashboardDates: string[] = [],
): BeetleTrapMatrix {
  const activeLocations = locations
    .filter((location) => location.active !== false)
    .toSorted((left, right) => compareTrapNumbers(left.trap_no, right.trap_no))

  const allDates = new Set(
    dashboardDates
      .map(normalizeDate)
      .filter((date): date is string => date !== null),
  )
  const countsByTrapAndDate = new Map<string, number>()

  for (const location of activeLocations) {
    for (const record of location.inspection_records ?? []) {
      const sourceDate = normalizeDate(record.inspection_date)
      if (!sourceDate) continue
      allDates.add(sourceDate)
      const key = `${location.trap_no}\u0000${sourceDate}`
      countsByTrapAndDate.set(
        key,
        (countsByTrapAndDate.get(key) ?? 0) + normalizeCount(record.beetle_count),
      )
    }
  }

  const traps = activeLocations.map((location) => {
    let total = 0
    for (const sourceDate of allDates) {
      total += countsByTrapAndDate.get(`${location.trap_no}\u0000${sourceDate}`) ?? 0
    }
    return {
      trapNo: location.trap_no,
      trapType: normalizeTrapType(location.trap_type),
      total,
    }
  })

  const rows = [...allDates]
    .toSorted((left, right) => right.localeCompare(left))
    .map((sourceDate) => ({
      sourceDate,
      counts: traps.map((trap) => {
        const key = `${trap.trapNo}\u0000${sourceDate}`
        return countsByTrapAndDate.has(key) ? countsByTrapAndDate.get(key) ?? 0 : null
      }),
    }))

  return { traps, rows }
}
