export type AssetCondition = "GOOD" | "FAIR" | "NEEDS_REPAIR" | "RETIRED"
export type AssetStatus = "ACTIVE" | "IN_MAINTENANCE" | "RETIRED" | "DISPOSED"

export interface AssetCategory {
  id: number
  category_name: string
  active: boolean
}

export interface FarmAsset {
  id: number
  asset_code: string
  asset_name: string
  category_id: number
  category_name: string
  manufacturer?: string | null
  model?: string | null
  serial_number?: string | null
  location?: string | null
  custodian?: string | null
  purchase_date?: string | null
  purchase_cost?: number | string | null
  condition: AssetCondition
  status: AssetStatus
  notes?: string | null
  active: boolean
  created_at?: string
}

export interface AssetRegisterDashboardData {
  summary: {
    total_assets: number
    active_assets: number
    maintenance_assets: number
    needs_repair_assets: number
    retired_or_disposed_assets: number
  }
  assets: FarmAsset[]
}

export const assetConditionLabels: Record<AssetCondition, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  NEEDS_REPAIR: "Needs Repair",
  RETIRED: "Retired",
}

export const assetStatusLabels: Record<AssetStatus, string> = {
  ACTIVE: "Active",
  IN_MAINTENANCE: "In Maintenance",
  RETIRED: "Retired",
  DISPOSED: "Disposed",
}
