export const STANDARD_PUMP_LITRES_PER_HOUR = 50_000
export const JACKFRUIT_NUTMEG_PUMP_LITRES_PER_HOUR = 36_000

const reducedRatePlots = new Set(["jack_fruit", "jackfruit", "nutmug", "nutmeg"])

function normalisePlot(plot: string): string {
  return plot.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

export function pumpLitresPerHourForPlot(plot: string): number {
  return reducedRatePlots.has(normalisePlot(plot))
    ? JACKFRUIT_NUTMEG_PUMP_LITRES_PER_HOUR
    : STANDARD_PUMP_LITRES_PER_HOUR
}

export function pumpedLitresForRuntimeMinutes(totalMinutes: number, plot: string): number {
  const minutes = Number.isFinite(totalMinutes) ? Math.max(0, totalMinutes) : 0
  return Math.round((minutes / 60) * pumpLitresPerHourForPlot(plot))
}
