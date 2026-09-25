/** Preserve the precision supplied by the stock API, including trailing zeros. */
export function formatStockUnitPrice(value: string | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined || !unit) return "Not entered"
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return "Not entered"
  const groupedInteger = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `₹${groupedInteger}${match[2] === undefined ? "" : `.${match[2]}`} / ${unit}`
}
