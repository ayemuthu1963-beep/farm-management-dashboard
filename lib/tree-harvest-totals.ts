export interface TreeHarvestTotalsRow {
  nutsB1?: number | null
  nutsB2?: number | null
  nutsB3?: number | null
  totalBunches?: number | null
  totalNuts?: number | null
  totalSale?: number | null
}

export interface TreeHarvestTotals {
  nutsB1: number
  nutsB2: number
  nutsB3: number
  totalBunches: number
  totalNuts: number
  totalSale: number
}

const EMPTY_TREE_HARVEST_TOTALS: TreeHarvestTotals = {
  nutsB1: 0,
  nutsB2: 0,
  nutsB3: 0,
  totalBunches: 0,
  totalNuts: 0,
  totalSale: 0,
}

function numericValue(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Sum every record in the current search result, independent of display order. */
export function calculateTreeHarvestTotals(rows: readonly TreeHarvestTotalsRow[]): TreeHarvestTotals {
  return rows.reduce<TreeHarvestTotals>(
    (totals, row) => ({
      nutsB1: totals.nutsB1 + numericValue(row.nutsB1),
      nutsB2: totals.nutsB2 + numericValue(row.nutsB2),
      nutsB3: totals.nutsB3 + numericValue(row.nutsB3),
      totalBunches: totals.totalBunches + numericValue(row.totalBunches),
      totalNuts: totals.totalNuts + numericValue(row.totalNuts),
      // The table displays whole rupees, so its total must reconcile to the
      // visible row values instead of hidden paise from the API response.
      totalSale: totals.totalSale + Math.round(numericValue(row.totalSale)),
    }),
    { ...EMPTY_TREE_HARVEST_TOTALS },
  )
}
