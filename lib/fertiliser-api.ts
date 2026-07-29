export type FertiliserApiStockStatus = "NOT_ENTERED" | "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK"
export type FertiliserApiExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID" | "NO_EXPIRY" | "NOT_ENTERED" | "OUT_OF_STOCK"

export interface FertiliserCategoryApiRow {
  category_id: number
  category_name: string
  display_order: number
  is_active: boolean
  product_count: number
}

export interface FertiliserProductApiRow {
  product_id: number
  category_id: number
  category_name: string
  product_name: string
  default_unit: string | null
  minimum_stock: string
  expiry_required: boolean
  display_order: number
  source_row_number: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FertiliserStockApiRow {
  product_id: number
  category_id: number
  category_name: string
  product_name: string
  category_display_order?: number
  quantity: string | null
  unit: string | null
  minimum_stock: string
  stock_status: FertiliserApiStockStatus
  nearest_expiry_date: string | null
  eligible_available_quantity: string
  expiry_status: FertiliserApiExpiryStatus
  active_batch_count: number
  last_movement_date: string | null
  last_movement_type: string | null
  display_order: number
  source_row_number: number | null
}

export interface FertiliserSummaryApi {
  total_products: number
  total_categories: number
  products_with_stock: number
  products_not_entered: number
  out_of_stock: number
  low_stock: number
  in_stock: number
  expired_products: number
  expiring_within_90_days: number
  no_expiry_entered: number
  future_requirements: number
  items_requiring_purchase: number
  items_requiring_purchase_note?: string
  stock_status_rule: string
  expiry_status_rule: string
}

export interface FertiliserTransactionApiRow {
  transaction_id: number
  transaction_date: string
  transaction_type: string
  category: string
  product: string
  quantity: string
  unit: string
  batch_number: string | null
  expiry_date: string | null
  purpose: string | null
  crop: string | null
  plot_location: string | null
  supplier_name?: string | null
  source: string
  reference_number: string | null
  requirement_id?: number | null
  remarks: string | null
  created_at: string
}

export interface FertiliserIncomingStockPayload {
  transaction_date: string
  product_id: number
  quantity: string
  unit: string
  batch_number?: string | null
  expiry_date?: string | null
  supplier_name?: string | null
  reference_number?: string | null
  remarks?: string | null
}

export interface FertiliserReceiveStockResponse {
  ok: boolean
  batch_id: number
  batch_reused: boolean
  transaction: FertiliserTransactionApiRow & {
    batch_id: number
    supplier_name: string | null
  }
  stock: FertiliserStockApiRow
  source: string
  write_scope: string
  batch_matching_rule: string
}

export interface FertiliserOutgoingStockPayload {
  transaction_date: string
  product_id: number
  quantity: string
  unit: string
  purpose: string
  crop?: string | null
  plot_location: string
  remarks?: string | null
}

export interface FertiliserStockAdjustmentPayload {
  transaction_date: string
  product_id: number
  adjustment_type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"
  quantity: string
  unit: string
  batch_id?: number | null
  reason: string
  remarks?: string | null
}

export interface FertiliserAllocationApiRow {
  allocation_id: number
  transaction_id: number
  batch_id: number
  allocated_quantity: string
  batch_number: string | null
  expiry_date: string | null
  received_date: string | null
  created_at: string
}

export interface FertiliserIssueStockResponse {
  ok: boolean
  transaction: FertiliserTransactionApiRow & {
    product_id: number
    plot_location: string
  }
  allocations: FertiliserAllocationApiRow[]
  allocation_total: string
  stock: FertiliserStockApiRow
  source: string
  write_scope: string
  fefo_ordering_rule: string
}

export interface FertiliserAdjustStockResponse {
  ok: boolean
  transaction: FertiliserTransactionApiRow & {
    product_id: number
    batch_id?: number | null
  }
  batch_id: number | null
  allocations: FertiliserAllocationApiRow[]
  allocation_total: string | null
  stock: FertiliserStockApiRow
  source: string
  write_scope: string
  adjustment_rule: string
}

export interface FertiliserTransactionFilters {
  date_from?: string
  date_to?: string
  category?: string
  product?: string
  transaction_type?: string
  source?: string
  plot_location?: string
  search?: string
}

export type FertiliserRequirementStatus =
  | "PLANNED"
  | "APPROVED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED"

export type FertiliserRequirementPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"
export type FertiliserPurchaseStatus = "STOCK_AVAILABLE" | "PURCHASE_REQUIRED"

export interface FertiliserRequirementApiRow {
  requirement_id: number
  requirement_date: string
  required_by_date: string
  product_id: number
  product_name: string
  category_id: number
  category_name: string
  required_quantity: string
  unit: string
  current_stock: string | null
  shortfall: string
  received_quantity: string
  remaining_quantity: string
  purchase_status: FertiliserPurchaseStatus
  purpose: string
  crop: string | null
  plot_location: string
  planned_application_date: string | null
  priority: FertiliserRequirementPriority
  supplier_name: string | null
  estimated_unit_cost: string | null
  estimated_total_cost: string | null
  remarks: string | null
  status: FertiliserRequirementStatus
  created_at: string
  updated_at: string
}

export interface FertiliserRequirementPayload {
  requirement_date: string
  required_by_date: string
  product_id: number
  required_quantity: string
  unit: string
  purpose: string
  crop?: string | null
  plot_location: string
  planned_application_date?: string | null
  priority: FertiliserRequirementPriority
  supplier_name?: string | null
  estimated_unit_cost?: string | null
  remarks?: string | null
}

export type FertiliserRequirementUpdatePayload = Partial<Omit<FertiliserRequirementPayload, "requirement_date" | "product_id" | "unit">>

export interface FertiliserRequirementReceiptPayload {
  receipt_date: string
  received_quantity: string
  batch_number?: string | null
  expiry_date?: string | null
  supplier_name?: string | null
  reference_number?: string | null
  remarks?: string | null
}

export interface FertiliserRequirementResponse {
  ok: boolean
  requirement: FertiliserRequirementApiRow
  write_scope: string
}

export interface FertiliserRequirementReceiptResponse extends FertiliserRequirementResponse {
  batch_id: number
  batch_reused: boolean
  transaction: FertiliserTransactionApiRow & {
    product_id: number
    batch_id: number
    requirement_id: number
    supplier_name: string | null
  }
  source: string
}

export interface FertiliserLiveData {
  categories: FertiliserCategoryApiRow[]
  products: FertiliserProductApiRow[]
  stock: FertiliserStockApiRow[]
  summary: FertiliserSummaryApi
  transactions: FertiliserTransactionApiRow[]
  requirements: FertiliserRequirementApiRow[]
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? String(payload.error)
      : `Fertiliser API request failed: ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export async function fetchFertiliserLiveData(): Promise<FertiliserLiveData> {
  const [categories, products, stock, summary, transactions, requirements] = await Promise.all([
    fetchJson<FertiliserCategoryApiRow[]>("/api/fertiliser/categories"),
    fetchJson<FertiliserProductApiRow[]>("/api/fertiliser/products"),
    fetchJson<FertiliserStockApiRow[]>("/api/fertiliser/stock"),
    fetchJson<FertiliserSummaryApi>("/api/fertiliser/summary"),
    fetchJson<FertiliserTransactionApiRow[]>("/api/fertiliser/transactions"),
    fetchJson<FertiliserRequirementApiRow[]>("/api/fertiliser/requirements"),
  ])

  return { categories, products, stock, summary, transactions, requirements }
}

export async function fetchFertiliserTransactions(filters: FertiliserTransactionFilters = {}): Promise<FertiliserTransactionApiRow[]> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return fetchJson<FertiliserTransactionApiRow[]>(`/api/fertiliser/transactions${params.toString() ? `?${params.toString()}` : ""}`)
}

function fertiliserWriteError(
  body: unknown,
  prefix: string,
): Error & { fieldErrors?: unknown } {
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : null
  const detail = payload?.detail
  const detailMessage =
    detail && typeof detail === "object" && "message" in detail
      ? String((detail as { message?: unknown }).message ?? "")
      : ""
  const reason =
    (payload && typeof payload.error === "string" && payload.error)
    || detailMessage
    || "The Preview server rejected the request."
  const error = new Error(`${prefix}: ${reason}`) as Error & { fieldErrors?: unknown }
  error.fieldErrors = detail
  return error
}

export async function receiveFertiliserStock(payload: FertiliserIncomingStockPayload): Promise<FertiliserReceiveStockResponse> {
  const response = await fetch("/api/fertiliser/stock/receive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw fertiliserWriteError(body, "Incoming stock save failed")
  }

  return body as FertiliserReceiveStockResponse
}

export async function issueFertiliserStock(payload: FertiliserOutgoingStockPayload): Promise<FertiliserIssueStockResponse> {
  const response = await fetch("/api/fertiliser/stock/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw fertiliserWriteError(body, "Outgoing stock issue failed")
  }

  return body as FertiliserIssueStockResponse
}

export async function adjustFertiliserStock(payload: FertiliserStockAdjustmentPayload): Promise<FertiliserAdjustStockResponse> {
  const response = await fetch("/api/fertiliser/stock/adjust", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw fertiliserWriteError(body, "Stock adjustment failed")
  }

  return body as FertiliserAdjustStockResponse
}

export async function fetchFertiliserTransactionAllocations(transactionId: number): Promise<FertiliserAllocationApiRow[]> {
  return fetchJson<FertiliserAllocationApiRow[]>(`/api/fertiliser/transactions/${transactionId}/allocations`)
}

export async function fetchFertiliserRequirements(): Promise<FertiliserRequirementApiRow[]> {
  return fetchJson<FertiliserRequirementApiRow[]>("/api/fertiliser/requirements")
}

async function sendRequirementRequest<T>(
  path: string,
  method: "POST" | "PATCH",
  payload: unknown = {},
  failurePrefix = "Future requirement request failed",
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw fertiliserWriteError(body, failurePrefix)
  }

  return body as T
}

export function createFertiliserRequirement(payload: FertiliserRequirementPayload): Promise<FertiliserRequirementResponse> {
  return sendRequirementRequest<FertiliserRequirementResponse>(
    "/api/fertiliser/requirements",
    "POST",
    payload,
    "Future requirement save failed",
  )
}

export function updateFertiliserRequirement(requirementId: number, payload: FertiliserRequirementUpdatePayload): Promise<FertiliserRequirementResponse> {
  return sendRequirementRequest<FertiliserRequirementResponse>(`/api/fertiliser/requirements/${requirementId}`, "PATCH", payload)
}

export function approveFertiliserRequirement(requirementId: number): Promise<FertiliserRequirementResponse> {
  return sendRequirementRequest<FertiliserRequirementResponse>(`/api/fertiliser/requirements/${requirementId}/approve`, "POST")
}

export function markFertiliserRequirementOrdered(requirementId: number): Promise<FertiliserRequirementResponse> {
  return sendRequirementRequest<FertiliserRequirementResponse>(`/api/fertiliser/requirements/${requirementId}/mark-ordered`, "POST")
}

export function cancelFertiliserRequirement(requirementId: number): Promise<FertiliserRequirementResponse> {
  return sendRequirementRequest<FertiliserRequirementResponse>(`/api/fertiliser/requirements/${requirementId}/cancel`, "POST")
}

export function receiveFertiliserRequirement(requirementId: number, payload: FertiliserRequirementReceiptPayload): Promise<FertiliserRequirementReceiptResponse> {
  return sendRequirementRequest<FertiliserRequirementReceiptResponse>(`/api/fertiliser/requirements/${requirementId}/receive`, "POST", payload)
}

export type FertiliserExportKind = "stock" | "products" | "transactions" | "requirements"

export async function downloadFertiliserExport(kind: FertiliserExportKind, filters: Record<string, string | undefined> = {}): Promise<string> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value)
  })
  const response = await fetch(`/api/fertiliser/export/${kind}${params.toString() ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body === "object" && "error" in body
      ? String(body.error)
      : `Fertiliser export failed: ${response.status}`
    throw new Error(message)
  }

  const disposition = response.headers.get("content-disposition") ?? ""
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
  const filename = filenameMatch?.[1] ?? `MFMS_Fertiliser_${kind}.xlsx`
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return filename
}
