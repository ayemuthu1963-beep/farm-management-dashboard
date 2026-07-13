export type InventoryTransactionType =
  | "OPENING_STOCK"
  | "PURCHASE"
  | "USAGE"
  | "RETURN_IN"
  | "WASTE_EXPIRED"
  | "ADJUSTMENT_INCREASE"
  | "ADJUSTMENT_DECREASE"

export interface InventoryCategory {
  id: number
  category_name: string
  active: boolean
}

export interface InventorySubcategory {
  id: number
  category_id: number
  category_name: string
  subcategory_name: string
  active: boolean
}

export interface InventoryProduct {
  id: number
  product_name: string
  original_product_name?: string | null
  category_id: number
  category_name: string
  subcategory_id: number
  subcategory_name: string
  base_unit: string
  active: boolean
  current_stock?: number
}

export interface InventoryStockRow {
  product_id: number
  product_name: string
  original_product_name?: string | null
  category_name: string
  subcategory_name: string
  base_unit: string
  opening_stock: number
  purchased: number
  returned_in: number
  used: number
  wasted_expired: number
  adjustment_in: number
  adjustment_out: number
  current_stock: number
  latest_transaction_date?: string | null
  nearest_unexpired_expiry_date?: string | null
  has_expired_lot_history: boolean
  active: boolean
}

export interface InventoryTransaction {
  id: number
  transaction_date: string
  transaction_type: InventoryTransactionType
  product_name: string
  category_name: string
  subcategory_name: string
  quantity: number
  unit: string
  expiry_date?: string | null
  invoice_no?: string | null
  purpose?: string | null
  plot_zone?: string | null
  crop?: string | null
  remarks?: string | null
  source: string
  created_at: string
}

export interface InventoryDashboardData {
  summary: {
    total_products: number
    total_opening_stock_items: number
    expired_products: number
    low_stock_items: number
    total_received_transactions: number
    total_used_transactions: number
  }
  stock: InventoryStockRow[]
  transactions: InventoryTransaction[]
}

export interface InventoryMasterData {
  categories: InventoryCategory[]
  subcategories: InventorySubcategory[]
  products: InventoryProduct[]
}

export const transactionTypeLabels: Record<InventoryTransactionType, string> = {
  OPENING_STOCK: "Opening Stock",
  PURCHASE: "Stock Received",
  USAGE: "Stock Used",
  RETURN_IN: "Return In",
  WASTE_EXPIRED: "Expired/Wasted",
  ADJUSTMENT_INCREASE: "Adjustment In",
  ADJUSTMENT_DECREASE: "Adjustment Out",
}
