// Mock data for the Jackfruit Monitoring dashboard. No backend — all static.
// Tracks fruit counts, growth/ripeness stages per block.

export interface JackfruitSummary {
  label: string
  value: string
  unit: string
  icon: "fruit" | "trees" | "ripe" | "scale"
}

export const jackfruitSummary: JackfruitSummary[] = [
  { label: "Total Fruits", value: "342", unit: "on tree", icon: "fruit" },
  { label: "Bearing Trees", value: "58", unit: "of 64", icon: "trees" },
  { label: "Ready to Harvest", value: "26", unit: "ripe fruits", icon: "ripe" },
  { label: "Est. Yield", value: "1,240", unit: "kg this month", icon: "scale" },
]

export type RipenessStage = "Young" | "Growing" | "Mature" | "Ripe"

export interface JackfruitTree {
  treeId: string
  block: string
  fruitCount: number
  stage: RipenessStage
  estWeightKg: number
  remarks: string
}

export const jackfruitTrees: JackfruitTree[] = [
  { treeId: "JF-01", block: "Block A", fruitCount: 12, stage: "Ripe", estWeightKg: 96, remarks: "Harvest soon" },
  { treeId: "JF-02", block: "Block A", fruitCount: 8, stage: "Mature", estWeightKg: 60, remarks: "Normal" },
  { treeId: "JF-03", block: "Block B", fruitCount: 15, stage: "Growing", estWeightKg: 45, remarks: "Healthy" },
  { treeId: "JF-04", block: "Block B", fruitCount: 6, stage: "Young", estWeightKg: 12, remarks: "Normal" },
  { treeId: "JF-05", block: "Block C", fruitCount: 11, stage: "Ripe", estWeightKg: 88, remarks: "Harvest soon" },
  { treeId: "JF-06", block: "Block C", fruitCount: 9, stage: "Mature", estWeightKg: 68, remarks: "Normal" },
  { treeId: "JF-07", block: "Block D", fruitCount: 14, stage: "Growing", estWeightKg: 42, remarks: "Healthy" },
  { treeId: "JF-08", block: "Block D", fruitCount: 7, stage: "Young", estWeightKg: 14, remarks: "Normal" },
]

// Distribution of fruits across ripeness stages (for the chart)
export interface StageDistribution {
  stage: RipenessStage
  count: number
}

export const stageDistribution: StageDistribution[] = [
  { stage: "Young", count: 96 },
  { stage: "Growing", count: 118 },
  { stage: "Mature", count: 84 },
  { stage: "Ripe", count: 44 },
]
