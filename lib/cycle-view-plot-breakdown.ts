import type { HarvestCyclePlotRow, HarvestCycleRow } from "@/lib/coconut-harvest-data"

export interface CyclePlotSourceRow {
  treeNo: string
  harvestDate: string
  totalBunches: number
  totalNuts: number
}

interface MutablePlotTotals {
  plot: HarvestCyclePlotRow["plot"]
  startDate: string
  endDate: string
  trees: number
  bunches: number
  nuts: number
}

const PLOT_BREAKDOWN_CYCLES = new Set([19, 20])
const TREE_NUMBER_PATTERN = /^\d+(?:\.1)?$/

export function cycleNeedsPlotBreakdown(cycle: number): boolean {
  return PLOT_BREAKDOWN_CYCLES.has(cycle)
}

function toNumber(value: string | undefined): number {
  if (!value) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let cell = ""
  let inQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const next = csv[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      record.push(cell)
      cell = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1
      }
      record.push(cell)
      if (record.some((value) => value.trim() !== "")) {
        records.push(record)
      }
      record = []
      cell = ""
      continue
    }

    cell += char
  }

  if (cell || record.length > 0) {
    record.push(cell)
    if (record.some((value) => value.trim() !== "")) {
      records.push(record)
    }
  }

  return records
}

export function parseCyclePlotCsv(csv: string, cycle: number): CyclePlotSourceRow[] | null {
  const records = parseCsvRecords(csv)
  if (records.length === 0 || (records.length === 1 && records[0][0] === "no_records")) {
    return []
  }

  const headers = records[0]
  const treeNoIndex = headers.indexOf("tree_no")
  const harvestDateIndex = headers.indexOf("harvest_date")
  const totalBunchesIndex = headers.indexOf("total_bunches")
  const totalNutsIndex = headers.indexOf("total_nuts")
  const harvestCycleIndex = headers.indexOf("harvest_cycle")

  if ([treeNoIndex, harvestDateIndex, totalBunchesIndex, totalNutsIndex, harvestCycleIndex].some((index) => index === -1)) {
    return null
  }

  return records.slice(1).flatMap((cells) => {
    const rowCycle = (cells[harvestCycleIndex] ?? "").trim()
    if (rowCycle && Number(rowCycle) !== cycle) {
      return []
    }

    return [{
      treeNo: cells[treeNoIndex] ?? "",
      harvestDate: cells[harvestDateIndex] ?? "",
      totalBunches: toNumber(cells[totalBunchesIndex]),
      totalNuts: toNumber(cells[totalNutsIndex]),
    }]
  })
}

function plotForTreeNumber(treeNo: string): HarvestCyclePlotRow["plot"] {
  const normalized = treeNo.trim()
  if (!TREE_NUMBER_PATTERN.test(normalized)) {
    throw new Error(`Invalid TreeNo in cycle plot breakdown: ${treeNo || "<blank>"}`)
  }

  const integerStem = Math.trunc(Number(normalized))
  if (!Number.isSafeInteger(integerStem) || integerStem < 1 || integerStem > 2250) {
    throw new Error(`TreeNo outside Plot 1/Plot 2 range: ${treeNo}`)
  }

  return integerStem <= 1000 ? "Plot 1" : "Plot 2"
}

function updateDateRange(plot: MutablePlotTotals, harvestDate: string) {
  const normalized = harvestDate.trim()
  if (!normalized) {
    return
  }

  if (!plot.startDate || normalized < plot.startDate) {
    plot.startDate = normalized
  }
  if (!plot.endDate || normalized > plot.endDate) {
    plot.endDate = normalized
  }
}

function requireReconciliation(cycle: HarvestCycleRow, plots: MutablePlotTotals[]) {
  const trees = plots.reduce((sum, plot) => sum + plot.trees, 0)
  const bunches = plots.reduce((sum, plot) => sum + plot.bunches, 0)
  const nuts = plots.reduce((sum, plot) => sum + plot.nuts, 0)

  if (trees !== cycle.trees || bunches !== cycle.bunches || nuts !== cycle.nuts) {
    throw new Error(
      `Cycle ${cycle.cycle} plot totals do not reconcile ` +
        `(trees ${trees}/${cycle.trees}, bunches ${bunches}/${cycle.bunches}, nuts ${nuts}/${cycle.nuts})`,
    )
  }
}

export function buildCyclePlotBreakdown(
  cycle: HarvestCycleRow,
  rows: readonly CyclePlotSourceRow[],
): HarvestCyclePlotRow[] {
  const plots: MutablePlotTotals[] = [
    { plot: "Plot 1", startDate: "", endDate: "", trees: 0, bunches: 0, nuts: 0 },
    { plot: "Plot 2", startDate: "", endDate: "", trees: 0, bunches: 0, nuts: 0 },
  ]

  for (const row of rows) {
    const plotName = plotForTreeNumber(row.treeNo)
    const plot = plots[plotName === "Plot 1" ? 0 : 1]
    updateDateRange(plot, row.harvestDate)
    plot.bunches += row.totalBunches
    plot.nuts += row.totalNuts
    if (row.totalNuts > 0) {
      plot.trees += 1
    }
  }

  requireReconciliation(cycle, plots)

  const authoritativeTotalSale = cycle.totalSale
  if (cycle.nuts === 0 && authoritativeTotalSale !== 0) {
    throw new Error(`Cycle ${cycle.cycle} has sale value without nuts`)
  }

  const saleRoundingScale = Number.isInteger(authoritativeTotalSale) ? 1 : 100
  const plot1Sale = cycle.nuts > 0
    ? Math.round(((authoritativeTotalSale * plots[0].nuts) / cycle.nuts) * saleRoundingScale) / saleRoundingScale
    : 0
  const plot2Sale = authoritativeTotalSale - plot1Sale

  return plots.map((plot, index) => ({
    ...plot,
    totalSale: index === 0 ? plot1Sale : plot2Sale,
  }))
}

export function applyCyclePlotBreakdown(
  cycle: HarvestCycleRow,
  rows: readonly CyclePlotSourceRow[] | null,
): HarvestCycleRow {
  if (rows === null) {
    if (cycleNeedsPlotBreakdown(cycle.cycle)) {
      throw new Error(`Cycle ${cycle.cycle} plot breakdown is unavailable from the harvest export`)
    }
    return cycle
  }

  const trees = rows.reduce((count, row) => count + (row.totalNuts > 0 ? 1 : 0), 0)
  const cycleWithCorrectedTrees = { ...cycle, trees }

  return cycleNeedsPlotBreakdown(cycle.cycle)
    ? {
        ...cycleWithCorrectedTrees,
        plotRows: buildCyclePlotBreakdown(cycleWithCorrectedTrees, rows),
      }
    : cycleWithCorrectedTrees
}
