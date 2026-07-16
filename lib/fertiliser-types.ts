// Fertiliser Management - TypeScript Type Definitions
// This file defines all data structures for the fertiliser management module

export interface FertiliserCategory {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface FertiliserProduct {
  id: string
  categoryId: string
  category: string
  name: string
  unit: string
  minimumStock: number
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface FertiliserStockBatch {
  id: string
  productId: string
  batchNumber?: string
  expiryDate: string | null
  quantity: number
  unit: string
  status: 'available' | 'expired' | 'reserved'
  createdAt: string
  updatedAt: string
}

export interface FertiliserStockSummary {
  productId: string
  productName: string
  category: string
  totalStock: number
  unit: string
  minimumStock: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  earliestExpiry: string | null
  expiryStatus: 'valid' | 'expiring_soon' | 'expired' | 'none'
  batchCount: number
}

export interface FertiliserTransaction {
  id: string
  type: 'opening' | 'incoming' | 'outgoing' | 'adjustment' | 'disposal'
  date: string
  productId: string
  productName: string
  category: string
  quantity: number
  unit: string
  reference: string
  remarks: string
  batchId?: string
  batchNumber?: string
  expiryDate?: string | null
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface FertiliserFutureRequirement {
  id: string
  productId: string
  productName: string
  category: string
  requiredQuantity: number
  unit: string
  currentStock: number
  shortfall: number
  requiredByDate: string
  plannedApplicationDate: string
  purpose: string
  crop: string
  plot: string
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  status: 'Planned' | 'Approved' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled'
  estimatedUnitCost: number
  estimatedTotalCost: number
  supplier?: string
  remarks?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface IncomingStockPayload {
  date: string
  productId: string
  quantity: number
  unit: string
  batchNumber?: string
  expiryDate?: string | null
  reference: string
  remarks: string
  supplierId?: string
}

export interface OutgoingStockPayload {
  date: string
  productId: string
  quantity: number
  unit: string
  reference: string
  remarks: string
  purpose: string
  plot?: string
  issuedTo?: string
}

export interface StockAdjustmentPayload {
  date: string
  productId: string
  quantity: number // negative for decrease, positive for increase
  unit: string
  reason: string
  remarks: string
  reference?: string
}

export interface CreateProductPayload {
  categoryId: string
  name: string
  unit: string
  minimumStock: number
  status: 'active' | 'inactive'
}

export interface CreateCategoryPayload {
  name: string
  description?: string
}

export interface ExcelImportMapping {
  rowNumber: number
  sNo: number
  category: string
  productName: string
  quantityAvailable: number
  unit: string
  expiryDate: string | null
  status: 'success' | 'error'
  message?: string
}

// Mock data types
export interface MockFertiliserData {
  products: FertiliserProduct[]
  categories: string[]
  transactions: FertiliserTransaction[]
  futureRequirements: FertiliserFutureRequirement[]
  purposes: string[]
  crops: string[]
  locations: string[]
  suppliers: string[]
}
