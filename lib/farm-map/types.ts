import type { PerformanceClassification } from "@/lib/farm-map/classification-styles"
import type { PlotName } from "@/lib/plot-identity"

export type { PlotName } from "@/lib/plot-identity"

export interface FarmMapCoordinateFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    treeNo: string
    plot: PlotName
    coordinateSource: string
    coordinateVersion: string
  }
}

export interface FarmMapCoordinateCollection {
  type: "FeatureCollection"
  features: FarmMapCoordinateFeature[]
}

export interface FarmMapLatestHarvest {
  date: string | null
  cycle: string | null
  totalBunches: number | null
  totalNuts: number | null
}

export interface FarmMapOperationalRecord {
  treeNo: string
  plot: string | null
  status: string | null
  lifecycleStatus: string | null
  lifecycleStatusSource: string | null
  classification: PerformanceClassification | null
  classificationReason: string | null
  classificationState: "classified" | "unknown"
  classificationPeriod: string | null
  lastUpdated: string | null
  latestHarvest: FarmMapLatestHarvest
}

export interface FarmMapOperationalPayload {
  schemaVersion: number
  dataVersion: string
  generatedAt: string
  classificationAsOf: string | null
  sourceAsOf: Record<string, string | null>
  classificationPeriod: {
    type: string
    cycleIds: string[]
    startDate: string | null
    endDate: string | null
  }
  recordCount: number
  decimalTreeNoCount: number
  classificationCounts: Record<string, number>
  records: FarmMapOperationalRecord[]
}
