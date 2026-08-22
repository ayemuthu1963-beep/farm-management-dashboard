/**
 * MFMS plot identity contract.
 *
 * The public plot names changed in August 2026, but stored motor and pipeline
 * identifiers remain tied to the same physical valves and pipework. Keep the
 * translation here so the migration never renumbers hardware or trees.
 */

export const PLOT_NAMES = ["Plot 1", "Plot 2"] as const

export type PlotName = (typeof PLOT_NAMES)[number]

export const EXPECTED_COCONUT_PLOT_COUNTS: Record<PlotName, number> = {
  "Plot 1": 1_163,
  "Plot 2": 954,
}

export function isPlotName(value: unknown): value is PlotName {
  return value === "Plot 1" || value === "Plot 2"
}

/**
 * Decimal suffixes belong to their integer tree number (for example 1001.1).
 * Tree 1000 is deliberately unassigned pending field reconciliation.
 */
export function plotNameForTreeNo(treeNo: string): PlotName | "Other" {
  const match = treeNo.trim().match(/^(\d+)(?:\.\d+)?$/)
  if (!match) return "Other"

  const baseTreeNo = Number(match[1])
  if (baseTreeNo >= 1 && baseTreeNo <= 999) return "Plot 2"
  if (baseTreeNo >= 1001) return "Plot 1"
  return "Other"
}

export const plotTreeRangeLabels: Record<PlotName, string> = {
  "Plot 1": "Tree numbers 1001 onward",
  "Plot 2": "Tree numbers 1 to 999",
}

export type StoredMotorPlot =
  | "Plot1_East"
  | "Plot1_West"
  | "Plot2_East"
  | "Plot2_West"
  | "Nutmug"
  | "Jack_Fruit"

export const motorPlotDisplayLabels: Record<StoredMotorPlot, string> = {
  Plot1_East: "Plot 2 East",
  Plot1_West: "Plot 2 West",
  Plot2_East: "Plot 1 East",
  Plot2_West: "Plot 1 West",
  Nutmug: "Nutmeg",
  Jack_Fruit: "Jackfruit",
}

export type StoredPipelineZone = "P1W" | "P1E" | "P2W" | "P2E" | "JF" | "NM"

/** Stable database zone code -> current public zone code. */
export const pipelineZoneDisplayCodes: Record<StoredPipelineZone, StoredPipelineZone> = {
  P1W: "P2W",
  P1E: "P2E",
  P2W: "P1W",
  P2E: "P1E",
  JF: "JF",
  NM: "NM",
}
