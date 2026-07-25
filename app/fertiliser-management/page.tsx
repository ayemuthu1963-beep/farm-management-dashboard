'use client'

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  History,
  Layers,
  Leaf,
  PackagePlus,
  PlusCircle,
  Search,
  Send,
  ShoppingCart,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { cn } from "@/lib/utils"
import {
  duplicateConfirmationNotes,
  fertiliserCategories,
  fertiliserLocations,
  fertiliserPurposes,
  fertiliserUnits,
  formatFertiliserExpiry,
  formatFertiliserQuantity,
  getFertiliserExpiryStatus,
  getFertiliserStockStatus,
  type FertiliserExpiryStatus,
  type FertiliserProduct,
  type FertiliserStockStatus,
} from "@/lib/fertiliser-data"
import {
  adjustFertiliserStock,
  approveFertiliserRequirement,
  cancelFertiliserRequirement,
  createFertiliserRequirement,
  downloadFertiliserExport,
  fetchFertiliserLiveData,
  fetchFertiliserTransactionAllocations,
  fetchFertiliserTransactions,
  issueFertiliserStock,
  markFertiliserRequirementOrdered,
  receiveFertiliserRequirement,
  receiveFertiliserStock,
  updateFertiliserRequirement,
  type FertiliserAdjustStockResponse,
  type FertiliserAllocationApiRow,
  type FertiliserExportKind,
  type FertiliserIssueStockResponse,
  type FertiliserLiveData,
  type FertiliserIncomingStockPayload,
  type FertiliserOutgoingStockPayload,
  type FertiliserProductApiRow,
  type FertiliserRequirementApiRow,
  type FertiliserRequirementPayload,
  type FertiliserRequirementReceiptPayload,
  type FertiliserRequirementReceiptResponse,
  type FertiliserRequirementResponse,
  type FertiliserRequirementStatus,
  type FertiliserRequirementUpdatePayload,
  type FertiliserStockAdjustmentPayload,
  type FertiliserStockApiRow,
  type FertiliserTransactionApiRow,
  type FertiliserTransactionFilters,
} from "@/lib/fertiliser-api"

type ActiveTab = "overview" | "incoming" | "outgoing" | "adjustment" | "requirements" | "history" | "master"
type ModalName = "product" | "category" | null
type FormErrors = Record<string, string>
type DecimalInputMode = "decimal" | "numeric" | "text" | "search" | "email" | "tel" | "url" | "none"

const QUANTITY_PRECISION_ERROR = "Quantity must be greater than zero and may contain up to 3 decimal places."

const tabs: Array<{ id: ActiveTab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Stock Overview", icon: Boxes },
  { id: "incoming", label: "Incoming Stock", icon: PackagePlus },
  { id: "outgoing", label: "Outgoing Stock", icon: Send },
  { id: "adjustment", label: "Stock Adjustment", icon: ClipboardList },
  { id: "requirements", label: "Future Requirements", icon: ClipboardList },
  { id: "history", label: "Transaction History", icon: History },
  { id: "master", label: "Product Master", icon: Tags },
]

const stockStatusStyles: Record<FertiliserStockStatus, string> = {
  "In Stock": "bg-chart-2/15 text-chart-2",
  "Low Stock": "bg-chart-3/15 text-chart-3",
  "Out of Stock": "bg-destructive/10 text-destructive",
  "Not Entered": "bg-muted text-muted-foreground",
}

const expiryStatusStyles: Record<FertiliserExpiryStatus, string> = {
  Valid: "bg-chart-2/15 text-chart-2",
  "Expiring Soon": "bg-chart-3/15 text-chart-3",
  Expired: "bg-destructive/10 text-destructive",
  "No Expiry Entered": "bg-muted text-muted-foreground",
  "Not Entered": "bg-muted text-muted-foreground",
  "Out of Stock": "bg-muted text-muted-foreground",
}

const requirementStatusStyles: Record<FertiliserRequirementStatus, string> = {
  PLANNED: "bg-primary/10 text-primary",
  APPROVED: "bg-chart-3/15 text-chart-3",
  ORDERED: "bg-chart-4/15 text-chart-4",
  PARTIALLY_RECEIVED: "bg-chart-5/15 text-chart-5",
  RECEIVED: "bg-chart-2/15 text-chart-2",
  CANCELLED: "bg-muted text-muted-foreground",
}

const priorityStyles = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-primary/10 text-primary",
  HIGH: "bg-chart-3/15 text-chart-3",
  URGENT: "bg-destructive/10 text-destructive",
}

const stockStatusExportValues: Record<string, string> = {
  "In Stock": "IN_STOCK",
  "Low Stock": "LOW_STOCK",
  "Out of Stock": "OUT_OF_STOCK",
  "Not Entered": "NOT_ENTERED",
}

const expiryStatusExportValues: Record<string, string> = {
  Valid: "VALID",
  "Expiring Soon": "EXPIRING_SOON",
  Expired: "EXPIRED",
  "No Expiry Entered": "NO_EXPIRY",
  "Not Entered": "NOT_ENTERED",
}

function groupProducts(products: FertiliserProduct[], categories: string[]) {
  return categories
    .map((category) => ({ category, products: products.filter((product) => product.category === category) }))
    .filter((group) => group.products.length > 0)
}

function displayStockStatus(status: string | undefined): FertiliserStockStatus {
  if (status === "LOW_STOCK") return "Low Stock"
  if (status === "OUT_OF_STOCK") return "Out of Stock"
  if (status === "NOT_ENTERED") return "Not Entered"
  return "In Stock"
}

function displayExpiryStatus(status: string | undefined): FertiliserExpiryStatus {
  if (status === "EXPIRED") return "Expired"
  if (status === "EXPIRING_SOON") return "Expiring Soon"
  if (status === "NO_EXPIRY") return "No Expiry Entered"
  if (status === "NOT_ENTERED") return "Not Entered"
  if (status === "OUT_OF_STOCK") return "Out of Stock"
  return "Valid"
}

function numberFromApi(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatApiQuantity(value: string | null, unit: string | null) {
  if (value === null || unit === null) return "Not Entered"
  const numeric = Number(value)
  const displayValue = Number.isFinite(numeric) ? numeric.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : value
  return `${displayValue} ${unit}`
}

function mapStockRowsToProducts(rows: FertiliserStockApiRow[]): FertiliserProduct[] {
  return rows.map((row) => ({
    id: `DB-${row.product_id}`,
    productId: row.product_id,
    sNo: row.display_order ?? row.source_row_number ?? row.product_id,
    excelRow: row.source_row_number ?? row.product_id,
    category: row.category_name,
    name: row.product_name,
    quantity: numberFromApi(row.quantity),
    unit: row.unit ?? "",
    quantityText: formatApiQuantity(row.quantity, row.unit),
    expiryDate: row.nearest_expiry_date,
    source: "mfms_server_uat",
    minimumStock: numberFromApi(row.minimum_stock) ?? 0,
    stockStatus: displayStockStatus(row.stock_status),
    expiryStatus: displayExpiryStatus(row.expiry_status),
    lastMovement: row.last_movement_date,
  }))
}

function validatePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
}

function validateDecimalQuantity(value: string) {
  if (!/^\d+(?:\.\d{1,3})?$/.test(value)) return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1 text-xs font-semibold text-destructive">{children}</p>
}

function DataNotice({ mode, error, onRetry }: { mode: "loading" | "live" | "fallback"; error?: string; onRetry?: () => void }) {
  if (mode === "loading") {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold uppercase tracking-wide">LOADING LIVE FERTILISER DATA</p>
            <p className="text-primary/85">Reading Fertiliser product master, stock, transactions, and requirements from the MFMS Preview database.</p>
          </div>
        </div>
      </div>
    )
  }

  if (mode === "live") {
    return (
      <div className="rounded-xl border border-chart-2/25 bg-chart-2/10 px-4 py-3 text-sm text-chart-2">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold uppercase tracking-wide">LIVE PREVIEW DATABASE DATA</p>
            <p className="text-chart-2/85">Stock Overview, Product Master, Transaction History, and Future Requirements are read from `mfms_server_uat`. Writes remain guarded to Preview only.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold uppercase tracking-wide">LIVE FERTILISER DATA UNAVAILABLE</p>
          <p className="text-destructive/85">The live Preview Fertiliser API did not load. No mock balances are being displayed. {error ? `Reason: ${error}` : null}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="mt-2 rounded-lg border border-destructive/30 bg-white px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/5">
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function FilterControls({
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  stockFilter,
  setStockFilter,
  expiryFilter,
  setExpiryFilter,
  categories,
}: {
  search: string
  setSearch: (value: string) => void
  categoryFilter: string
  setCategoryFilter: (value: string) => void
  stockFilter: string
  setStockFilter: (value: string) => void
  expiryFilter: string
  setExpiryFilter: (value: string) => void
  categories: string[]
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
      <label className="block text-sm">
        <span className="mb-1 flex items-center gap-2 font-semibold text-foreground"><Search className="size-4" aria-hidden="true" /> Search</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product or category" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 flex items-center gap-2 font-semibold text-foreground"><Filter className="size-4" aria-hidden="true" /> Category</span>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-foreground">Stock status</span>
        <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
          <option value="all">All stock statuses</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="Not Entered">Not Entered</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-foreground">Expiry status</span>
        <select value={expiryFilter} onChange={(event) => setExpiryFilter(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
          <option value="all">All expiry statuses</option>
          <option value="Valid">Valid</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
          <option value="No Expiry Entered">No Expiry Entered</option>
          <option value="Not Entered">Not Entered</option>
        </select>
      </label>
    </div>
  )
}

function ProductRegister({
  groupedProducts,
  expandedCategories,
  toggleCategory,
}: {
  groupedProducts: Array<{ category: string; products: FertiliserProduct[] }>
  expandedCategories: Set<string>
  toggleCategory: (category: string) => void
}) {
  if (groupedProducts.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No products match the selected filters.</div>
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Product Name</th>
              <th className="px-3 py-2.5">Quantity</th>
              <th className="px-3 py-2.5">Unit</th>
              <th className="px-3 py-2.5">Expiry Date</th>
              <th className="px-3 py-2.5">Expiry Status</th>
              <th className="px-3 py-2.5">Stock Status</th>
              <th className="px-3 py-2.5">Last Movement</th>
            </tr>
          </thead>
          <tbody>
            {groupedProducts.map((group) => {
              const isExpanded = expandedCategories.has(group.category)
              if (!isExpanded) {
                return (
                  <tr key={group.category} className="border-b border-border bg-muted/35">
                    <td className="px-3 py-3 align-top">
                      <button type="button" onClick={() => toggleCategory(group.category)} className="flex w-full items-center justify-between gap-3 text-left font-bold text-foreground">
                        <span className="flex items-center gap-2">
                          <ChevronRight className="size-4" aria-hidden="true" />
                          {group.category}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{group.products.length} products</span>
                      </button>
                    </td>
                    <td colSpan={7} className="px-3 py-3 text-sm text-muted-foreground">Category collapsed</td>
                  </tr>
                )
              }

              return (
                <Fragment key={group.category}>
                  {group.products.map((product, itemIndex) => {
                    const stockStatus = product.stockStatus ?? getFertiliserStockStatus(product)
                    const expiryStatus = product.expiryStatus ?? getFertiliserExpiryStatus(product.expiryDate)
                    const movementLabel = product.lastMovement ? "LIVE MOVEMENT" : undefined
                    const movementDate = product.lastMovement

                    return (
                      <tr key={product.id} data-product-row className="border-b border-border last:border-0 hover:bg-muted/35">
                        {itemIndex === 0 ? (
                          <td rowSpan={group.products.length} className="border-r border-border bg-muted/45 px-3 py-3 align-top">
                            <button type="button" onClick={() => toggleCategory(group.category)} className="flex w-full items-start justify-between gap-3 text-left font-bold text-foreground">
                              <span className="flex min-w-0 items-start gap-2">
                                <ChevronDown className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span className="break-words">{group.category}</span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{group.products.length}</span>
                            </button>
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5 font-semibold text-foreground">
                          <span className="block break-words">{product.name}</span>
                          <span className="mt-0.5 block text-xs font-medium text-muted-foreground">S.No {product.sNo}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{product.quantityText || formatFertiliserQuantity(product)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{product.unit || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatFertiliserExpiry(product.expiryDate)}</td>
                        <td className="px-3 py-2.5"><Badge className={expiryStatusStyles[expiryStatus]}>{expiryStatus}</Badge></td>
                        <td className="px-3 py-2.5"><Badge className={stockStatusStyles[stockStatus]}>{stockStatus}</Badge></td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {movementLabel ? (
                            <>
                              <span className="block font-medium text-foreground">{movementLabel}</span>
                              <span className="block text-xs">{movementDate}</span>
                            </>
                          ) : (
                            "No movement"
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {groupedProducts.map((group) => {
          const isExpanded = expandedCategories.has(group.category)
          return (
            <section key={group.category} className="rounded-xl border border-border bg-card">
              <button type="button" onClick={() => toggleCategory(group.category)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-bold text-foreground">
                <span className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                  {group.category}
                </span>
                <span className="text-xs text-muted-foreground">{group.products.length}</span>
              </button>
              {isExpanded ? (
                <div className="space-y-3 border-t border-border p-3">
                  {group.products.map((product) => {
                    const stockStatus = product.stockStatus ?? getFertiliserStockStatus(product)
                    const expiryStatus = product.expiryStatus ?? getFertiliserExpiryStatus(product.expiryDate)
                    return (
                      <article key={product.id} data-product-card className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">S.No {product.sNo}</p>
                            <h3 className="font-bold text-foreground">{product.name}</h3>
                          </div>
                          <Badge className={stockStatusStyles[stockStatus]}>{stockStatus}</Badge>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="font-semibold text-foreground">{product.quantityText || formatFertiliserQuantity(product)}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">Unit</dt><dd className="font-semibold text-foreground">{product.unit || "—"}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">Expiry</dt><dd className="font-semibold text-foreground">{formatFertiliserExpiry(product.expiryDate)}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">Expiry Status</dt><dd><Badge className={expiryStatusStyles[expiryStatus]}>{expiryStatus}</Badge></dd></div>
                        </dl>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ProductMasterReadOnlyTable({ products }: { products: FertiliserProductApiRow[] }) {
  if (products.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No Product Master rows are available.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Product Name</th>
            <th className="px-3 py-2.5">Default Unit</th>
            <th className="px-3 py-2.5">Minimum Stock</th>
            <th className="px-3 py-2.5">Expiry Required</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Source Row</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.product_id} className="border-b border-border last:border-0 hover:bg-muted/35">
              <td className="px-3 py-2.5 text-muted-foreground">{product.category_name}</td>
              <td className="px-3 py-2.5 font-semibold text-foreground">{product.product_name}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{product.default_unit ?? "Not Entered"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{Number(product.minimum_stock).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{product.expiry_required ? "Yes" : "No"}</td>
              <td className="px-3 py-2.5"><Badge className={product.is_active ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground"}>{product.is_active ? "Active" : "Inactive"}</Badge></td>
              <td className="px-3 py-2.5 text-muted-foreground">{product.source_row_number ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TransactionHistoryTable({
  liveTransactions,
}: {
  liveTransactions: FertiliserTransactionApiRow[] | null
}) {
  if (liveTransactions) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead><tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary"><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5">Quantity</th><th className="px-3 py-2.5">Purpose</th><th className="px-3 py-2.5">Crop</th><th className="px-3 py-2.5">Plot / Location</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5">Remarks</th></tr></thead>
          <tbody>{liveTransactions.map((txn) => <tr key={txn.transaction_id} className="border-b border-border last:border-0 hover:bg-muted/35"><td className="px-3 py-2.5 text-muted-foreground">{txn.transaction_date}</td><td className="px-3 py-2.5"><Badge className="bg-muted text-foreground">{txn.transaction_type}</Badge></td><td className="px-3 py-2.5 font-semibold text-foreground">{txn.product}</td><td className="px-3 py-2.5 text-muted-foreground">{txn.category}</td><td className="px-3 py-2.5 text-muted-foreground">{Number(txn.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })} {txn.unit}</td><td className="px-3 py-2.5 text-muted-foreground">{txn.source}</td><td className="px-3 py-2.5 text-muted-foreground">{txn.reference_number ?? "—"}</td><td className="px-3 py-2.5 text-muted-foreground">{txn.remarks ?? "—"}</td></tr>)}</tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-6 text-sm font-semibold text-destructive">
      LIVE FERTILISER DATA UNAVAILABLE. Transaction rows are not shown from mock data.
    </div>
  )
}

function TransactionHistoryTableV2({
  liveTransactions,
  allocationDetails,
  loadingAllocationId,
  onLoadAllocations,
}: {
  liveTransactions: FertiliserTransactionApiRow[] | null
  allocationDetails: Record<number, FertiliserAllocationApiRow[]>
  loadingAllocationId: number | null
  onLoadAllocations: (transactionId: number) => void
}) {
  if (!liveTransactions) return <TransactionHistoryTable liveTransactions={null} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5">Type</th>
            <th className="px-3 py-2.5">Product</th>
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Quantity</th>
            <th className="px-3 py-2.5">Purpose</th>
            <th className="px-3 py-2.5">Crop</th>
            <th className="px-3 py-2.5">Plot / Location</th>
            <th className="px-3 py-2.5">Source</th>
            <th className="px-3 py-2.5">Reference</th>
            <th className="px-3 py-2.5">Remarks</th>
            <th className="px-3 py-2.5">Allocations</th>
          </tr>
        </thead>
        <tbody>
          {liveTransactions.map((txn) => {
            const canShowAllocations = ["OUTGOING", "ADJUSTMENT_OUT", "DISPOSAL"].includes(txn.transaction_type)
            const allocations = allocationDetails[txn.transaction_id]
            return (
              <Fragment key={txn.transaction_id}>
                <tr className="border-b border-border last:border-0 hover:bg-muted/35">
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.transaction_date}</td>
                  <td className="px-3 py-2.5"><Badge className="bg-muted text-foreground">{txn.transaction_type}</Badge></td>
                  <td className="px-3 py-2.5 font-semibold text-foreground">{txn.product}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.category}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{Number(txn.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })} {txn.unit}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.purpose ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.crop ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.plot_location ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.source}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.reference_number ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{txn.remarks ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {canShowAllocations ? (
                      <button type="button" onClick={() => onLoadAllocations(txn.transaction_id)} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted">
                        {loadingAllocationId === txn.transaction_id ? "Loading..." : allocations ? "Refresh" : "Show"}
                      </button>
                    ) : "—"}
                  </td>
                </tr>
                {allocations ? (
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={12} className="px-3 py-2.5 text-xs text-muted-foreground">
                      {allocations.length === 0 ? "No allocation rows." : allocations.map((allocation) => `Batch ${allocation.batch_id}: ${Number(allocation.allocated_quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${txn.unit} (${allocation.expiry_date ?? "No expiry"})`).join(" | ")}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function FertiliserManagementPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [expiryFilter, setExpiryFilter] = useState("all")
  const [expandedCategories, setExpandedCategories] = useState(() => new Set(fertiliserCategories))
  const [message, setMessage] = useState("")
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [exportingKind, setExportingKind] = useState<FertiliserExportKind | null>(null)
  const [exportMessage, setExportMessage] = useState("")
  const [activeModal, setActiveModal] = useState<ModalName>(null)
  const [liveData, setLiveData] = useState<FertiliserLiveData | null>(null)
  const [dataMode, setDataMode] = useState<"loading" | "live" | "fallback">("loading")
  const [dataError, setDataError] = useState("")
  const [incomingProductId, setIncomingProductId] = useState("")
  const [incomingUnit, setIncomingUnit] = useState("")
  const [incomingSubmitting, setIncomingSubmitting] = useState(false)
  const [outgoingProductId, setOutgoingProductId] = useState("")
  const [outgoingUnit, setOutgoingUnit] = useState("")
  const [outgoingSubmitting, setOutgoingSubmitting] = useState(false)
  const [outgoingResult, setOutgoingResult] = useState<FertiliserIssueStockResponse | null>(null)
  const [adjustmentProductId, setAdjustmentProductId] = useState("")
  const [adjustmentUnit, setAdjustmentUnit] = useState("")
  const [adjustmentType, setAdjustmentType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT">("ADJUSTMENT_IN")
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false)
  const [adjustmentResult, setAdjustmentResult] = useState<FertiliserAdjustStockResponse | null>(null)
  const [historyFilters, setHistoryFilters] = useState<FertiliserTransactionFilters>({})
  const [historyRows, setHistoryRows] = useState<FertiliserTransactionApiRow[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [allocationDetails, setAllocationDetails] = useState<Record<number, FertiliserAllocationApiRow[]>>({})
  const [loadingAllocationId, setLoadingAllocationId] = useState<number | null>(null)
  const [requirementProductId, setRequirementProductId] = useState("")
  const [requirementUnit, setRequirementUnit] = useState("")
  const [requirementSubmitting, setRequirementSubmitting] = useState(false)
  const [requirementActionId, setRequirementActionId] = useState<number | null>(null)
  const [requirementEditId, setRequirementEditId] = useState<number | null>(null)
  const [requirementReceiveId, setRequirementReceiveId] = useState<number | null>(null)
  const [requirementResult, setRequirementResult] = useState<FertiliserRequirementResponse | FertiliserRequirementReceiptResponse | null>(null)
  const [requirementStatusFilter, setRequirementStatusFilter] = useState("all")
  const [requirementPriorityFilter, setRequirementPriorityFilter] = useState("all")
  const [requirementPurchaseFilter, setRequirementPurchaseFilter] = useState("all")
  const [requirementCategoryFilter, setRequirementCategoryFilter] = useState("all")
  const [requirementRequiredByFilter, setRequirementRequiredByFilter] = useState("")

  useEffect(() => {
    let cancelled = false

    fetchFertiliserLiveData()
      .then((data) => {
        if (cancelled) return
        setLiveData(data)
        setDataMode("live")
        setDataError("")
        setExpandedCategories(new Set(data.categories.map((category) => category.category_name)))
      })
      .catch((error) => {
        if (cancelled) return
        setLiveData(null)
        setDataMode("fallback")
        setDataError(error instanceof Error ? error.message : "Unable to load Fertiliser API")
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refreshLiveData = async () => {
    const data = await fetchFertiliserLiveData()
    setLiveData(data)
    setDataMode("live")
    setDataError("")
    setExpandedCategories(new Set(data.categories.map((category) => category.category_name)))
    return data
  }

  const categoriesForUi = useMemo(
    () => liveData?.categories.map((category) => category.category_name) ?? [],
    [liveData],
  )

  const stockProducts = useMemo(
    () => liveData ? mapStockRowsToProducts(liveData.stock) : [],
    [liveData],
  )

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return stockProducts.filter((product) => {
      const matchesSearch = !term || product.name.toLowerCase().includes(term) || product.category.toLowerCase().includes(term) || String(product.sNo).includes(term)
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
      const matchesStock = stockFilter === "all" || (product.stockStatus ?? getFertiliserStockStatus(product)) === stockFilter
      const matchesExpiry = expiryFilter === "all" || (product.expiryStatus ?? getFertiliserExpiryStatus(product.expiryDate)) === expiryFilter
      return matchesSearch && matchesCategory && matchesStock && matchesExpiry
    })
  }, [categoryFilter, expiryFilter, search, stockFilter, stockProducts])

  const groupedFilteredProducts = useMemo(() => groupProducts(filteredProducts, categoriesForUi), [categoriesForUi, filteredProducts])
  const quantityEntered = liveData?.summary.products_with_stock ?? stockProducts.filter((product) => product.quantity !== null).length
  const expiredProducts = liveData?.summary.expired_products ?? stockProducts.filter((product) => (product.expiryStatus ?? getFertiliserExpiryStatus(product.expiryDate)) === "Expired").length
  const noExpiryProducts = liveData?.summary.no_expiry_entered ?? stockProducts.filter((product) => (product.expiryStatus ?? getFertiliserExpiryStatus(product.expiryDate)) === "No Expiry Entered").length
  const productCount = liveData?.summary.total_products ?? stockProducts.length
  const categoryCount = liveData?.summary.total_categories ?? categoriesForUi.length
  const productMasterRows = useMemo(() => {
    const sourceRows = liveData?.products ?? []
    const term = search.trim().toLowerCase()
    return sourceRows.filter((product) => {
      const matchesSearch = !term || product.product_name.toLowerCase().includes(term) || product.category_name.toLowerCase().includes(term) || String(product.source_row_number ?? "").includes(term)
      const matchesCategory = categoryFilter === "all" || product.category_name === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [categoryFilter, liveData, search])

  const resetMessage = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(""), 3500)
  }

  const exportFertiliserData = async (kind: FertiliserExportKind) => {
    const filters: Record<string, string | undefined> = {}
    if (kind === "stock") {
      filters.search = search.trim() || undefined
      filters.category_name = categoryFilter !== "all" ? categoryFilter : undefined
      filters.stock_status = stockFilter !== "all" ? stockStatusExportValues[stockFilter] : undefined
      filters.expiry_status = expiryFilter !== "all" ? expiryStatusExportValues[expiryFilter] : undefined
    } else if (kind === "products") {
      filters.search = search.trim() || undefined
      filters.category_name = categoryFilter !== "all" ? categoryFilter : undefined
    } else if (kind === "transactions") {
      Object.assign(filters, historyFilters)
    } else if (kind === "requirements") {
      filters.status = requirementStatusFilter !== "all" ? requirementStatusFilter : undefined
      filters.priority = requirementPriorityFilter !== "all" ? requirementPriorityFilter : undefined
      filters.category = requirementCategoryFilter !== "all" ? requirementCategoryFilter : undefined
      filters.required_by_to = requirementRequiredByFilter || undefined
      filters.purchase_status = requirementPurchaseFilter !== "all" ? requirementPurchaseFilter : undefined
    }

    setExportingKind(kind)
    setExportMessage("")
    try {
      const filename = await downloadFertiliserExport(kind, filters)
      setExportMessage(`Export generated: ${filename}`)
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Fertiliser export failed")
    } finally {
      setExportingKind(null)
    }
  }

  const selectedIncomingProduct = useMemo(() => {
    const productId = Number(incomingProductId)
    if (!Number.isFinite(productId)) return null
    return liveData?.products.find((product) => product.product_id === productId) ?? null
  }, [incomingProductId, liveData])

  const selectedOutgoingStock = useMemo(() => {
    const productId = Number(outgoingProductId)
    if (!Number.isFinite(productId)) return null
    return liveData?.stock.find((product) => product.product_id === productId) ?? null
  }, [outgoingProductId, liveData])

  const selectedAdjustmentStock = useMemo(() => {
    const productId = Number(adjustmentProductId)
    if (!Number.isFinite(productId)) return null
    return liveData?.stock.find((product) => product.product_id === productId) ?? null
  }, [adjustmentProductId, liveData])

  const selectedRequirementStock = useMemo(() => {
    const productId = Number(requirementProductId)
    if (!Number.isFinite(productId)) return null
    return liveData?.stock.find((product) => product.product_id === productId) ?? null
  }, [requirementProductId, liveData])

  const filteredRequirements = useMemo(() => {
    const rows = liveData?.requirements ?? []
    return rows.filter((requirement) => {
      if (requirementStatusFilter !== "all" && requirement.status !== requirementStatusFilter) return false
      if (requirementPriorityFilter !== "all" && requirement.priority !== requirementPriorityFilter) return false
      if (requirementPurchaseFilter !== "all" && requirement.purchase_status !== requirementPurchaseFilter) return false
      if (requirementCategoryFilter !== "all" && requirement.category_name !== requirementCategoryFilter) return false
      if (requirementRequiredByFilter && requirement.required_by_date > requirementRequiredByFilter) return false
      return true
    })
  }, [liveData, requirementCategoryFilter, requirementPriorityFilter, requirementPurchaseFilter, requirementRequiredByFilter, requirementStatusFilter])

  const requirementSummary = useMemo(() => {
    const rows = liveData?.requirements ?? []
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: rows.length,
      planned: rows.filter((row) => row.status === "PLANNED").length,
      approved: rows.filter((row) => row.status === "APPROVED").length,
      ordered: rows.filter((row) => row.status === "ORDERED").length,
      partiallyReceived: rows.filter((row) => row.status === "PARTIALLY_RECEIVED").length,
      received: rows.filter((row) => row.status === "RECEIVED").length,
      cancelled: rows.filter((row) => row.status === "CANCELLED").length,
      purchaseRequired: rows.filter((row) => row.purchase_status === "PURCHASE_REQUIRED").length,
      stockAvailable: rows.filter((row) => row.purchase_status === "STOCK_AVAILABLE").length,
      estimatedTotalCost: rows.reduce((sum, row) => sum + (Number(row.estimated_total_cost ?? 0) || 0), 0),
      overdue: rows.filter((row) => row.required_by_date < today && !["RECEIVED", "CANCELLED"].includes(row.status)).length,
    }
  }, [liveData])

  const toggleCategory = (category: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const handleIncomingProductChange = (value: string) => {
    setIncomingProductId(value)
    const productId = Number(value)
    const product = liveData?.products.find((item) => item.product_id === productId)
    setIncomingUnit(product?.default_unit ?? "")
  }

  const handleOutgoingProductChange = (value: string) => {
    setOutgoingProductId(value)
    const productId = Number(value)
    const product = liveData?.stock.find((item) => item.product_id === productId)
    setOutgoingUnit(product?.unit ?? "")
    setOutgoingResult(null)
  }

  const handleAdjustmentProductChange = (value: string) => {
    setAdjustmentProductId(value)
    const productId = Number(value)
    const product = liveData?.stock.find((item) => item.product_id === productId)
    setAdjustmentUnit(product?.unit ?? "")
    setAdjustmentResult(null)
  }

  const handleRequirementProductChange = (value: string) => {
    setRequirementProductId(value)
    const productId = Number(value)
    const product = liveData?.products.find((item) => item.product_id === productId)
    setRequirementUnit(product?.default_unit ?? "")
    setRequirementResult(null)
  }

  const apiFieldErrorsToFormErrors = (fieldErrors: unknown): FormErrors => {
    const errors: FormErrors = {}
    if (fieldErrors && typeof fieldErrors === "object" && "field_errors" in fieldErrors) {
      const nested = (fieldErrors as { field_errors?: Record<string, string> }).field_errors
      if (nested) return nested
    }
    if (Array.isArray(fieldErrors)) {
      fieldErrors.forEach((item) => {
        if (item && typeof item === "object" && "loc" in item && "msg" in item) {
          const loc = (item as { loc?: Array<string | number>; msg?: string }).loc ?? []
          const field = String(loc[loc.length - 1] ?? "form")
          errors[field] = String((item as { msg?: string }).msg ?? "Invalid value")
        }
      })
    }
    return errors
  }

  const submitIncomingStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dataMode !== "live" || !liveData) {
      setFormErrors({ form: "Incoming Stock saves require live local database data." })
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const errors: FormErrors = {}
    const productId = Number(formData.get("product"))
    const quantity = String(formData.get("quantity") ?? "").trim()
    const transactionDate = String(formData.get("transactionDate") ?? "").trim()
    const expiryDate = String(formData.get("expiryDate") ?? "").trim()
    const product = liveData.products.find((item) => item.product_id === productId)

    if (!transactionDate) errors.transaction_date = "Date is required"
    if (!product) errors.product_id = "Product is required"
    if (!validateDecimalQuantity(quantity)) errors.quantity = QUANTITY_PRECISION_ERROR
    if (!incomingUnit) errors.unit = "Unit is required"
    if (product?.default_unit && incomingUnit !== product.default_unit) errors.unit = `Unit must be ${product.default_unit}`
    if (product?.expiry_required && !expiryDate) errors.expiry_date = "Expiry date is required for this product"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload: FertiliserIncomingStockPayload = {
      transaction_date: transactionDate,
      product_id: productId,
      quantity,
      unit: incomingUnit,
      batch_number: String(formData.get("batchNumber") ?? "").trim() || null,
      expiry_date: expiryDate || null,
      supplier_name: String(formData.get("supplier") ?? "").trim() || null,
      reference_number: String(formData.get("reference") ?? "").trim() || null,
      remarks: String(formData.get("remarks") ?? "").trim() || null,
    }

    setIncomingSubmitting(true)
    setFormErrors({})
    try {
      const result = await receiveFertiliserStock(payload)
      await refreshLiveData()
      resetMessage(`Incoming stock saved. Transaction ${result.transaction.transaction_id}; batch ${result.batch_id}; source ${result.source}.`)
      form.reset()
      setIncomingProductId("")
      setIncomingUnit("")
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setIncomingSubmitting(false)
    }
  }

  const submitOutgoingStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dataMode !== "live" || !liveData) {
      setFormErrors({ form: "Outgoing Stock saves require live local database data." })
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const errors: FormErrors = {}
    const productId = Number(formData.get("product"))
    const quantity = String(formData.get("quantity") ?? "").trim()
    const transactionDate = String(formData.get("transactionDate") ?? "").trim()
    const purpose = String(formData.get("purpose") ?? "").trim()
    const crop = String(formData.get("crop") ?? "").trim()
    const plotLocation = String(formData.get("plotLocation") ?? "").trim()
    const remarks = String(formData.get("remarks") ?? "").trim()
    const product = liveData.stock.find((item) => item.product_id === productId)
    const available = product ? numberFromApi(product.eligible_available_quantity) ?? 0 : 0

    if (!transactionDate) errors.transaction_date = "Date is required"
    if (!product) errors.product_id = "Product with eligible stock is required"
    if (product?.quantity === null) errors.product_id = "Blank-quantity products cannot be issued"
    if (product && available <= 0) errors.quantity = "No valid non-expired stock is available for this product"
    if (!validateDecimalQuantity(quantity)) errors.quantity = QUANTITY_PRECISION_ERROR
    if (validateDecimalQuantity(quantity) && Number(quantity) > available) errors.quantity = `Insufficient eligible stock. Available: ${formatApiQuantity(product?.eligible_available_quantity ?? null, product?.unit ?? null)}`
    if (!outgoingUnit) errors.unit = "Unit is required"
    if (product?.unit && outgoingUnit !== product.unit) errors.unit = `Unit must be ${product.unit}`
    if (!purpose) errors.purpose = "Purpose is required"
    if (!plotLocation) errors.plot_location = "Plot/location is required"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload: FertiliserOutgoingStockPayload = {
      transaction_date: transactionDate,
      product_id: productId,
      quantity,
      unit: outgoingUnit,
      purpose,
      crop: crop || null,
      plot_location: plotLocation,
      remarks: remarks || null,
    }

    setOutgoingSubmitting(true)
    setFormErrors({})
    setOutgoingResult(null)
    try {
      const result = await issueFertiliserStock(payload)
      await refreshLiveData()
      setOutgoingResult(result)
      resetMessage(`Outgoing stock issued. Transaction ${result.transaction.transaction_id}; ${result.allocations.length} FEFO allocation${result.allocations.length === 1 ? "" : "s"}; source ${result.source}.`)
      form.reset()
      setOutgoingProductId("")
      setOutgoingUnit("")
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setOutgoingSubmitting(false)
    }
  }

  const submitAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dataMode !== "live" || !liveData) {
      setFormErrors({ form: "Stock Adjustment saves require live local database data." })
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const errors: FormErrors = {}
    const productId = Number(formData.get("product"))
    const quantity = String(formData.get("quantity") ?? "").trim()
    const transactionDate = String(formData.get("transactionDate") ?? "").trim()
    const reason = String(formData.get("reason") ?? "").trim()
    const remarks = String(formData.get("remarks") ?? "").trim()
    const product = liveData.stock.find((item) => item.product_id === productId)
    const available = product ? numberFromApi(product.eligible_available_quantity) ?? 0 : 0

    if (!transactionDate) errors.transaction_date = "Date is required"
    if (!product) errors.product_id = "Product is required"
    if (product?.quantity === null) errors.product_id = adjustmentType === "ADJUSTMENT_OUT" ? "Blank-quantity products cannot be adjusted out" : "Select a product with a default unit"
    if (!validateDecimalQuantity(quantity)) errors.quantity = QUANTITY_PRECISION_ERROR
    if (adjustmentType === "ADJUSTMENT_OUT" && product && available <= 0) errors.quantity = "No valid non-expired stock is available for this product"
    if (adjustmentType === "ADJUSTMENT_OUT" && validateDecimalQuantity(quantity) && Number(quantity) > available) errors.quantity = `Insufficient eligible stock. Available: ${formatApiQuantity(product?.eligible_available_quantity ?? null, product?.unit ?? null)}`
    if (!adjustmentUnit) errors.unit = "Unit is required"
    if (product?.unit && adjustmentUnit !== product.unit) errors.unit = `Unit must be ${product.unit}`
    if (!reason) errors.reason = "Reason is required"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload: FertiliserStockAdjustmentPayload = {
      transaction_date: transactionDate,
      product_id: productId,
      adjustment_type: adjustmentType,
      quantity,
      unit: adjustmentUnit,
      batch_id: null,
      reason,
      remarks: remarks || null,
    }

    setAdjustmentSubmitting(true)
    setFormErrors({})
    setAdjustmentResult(null)
    try {
      const result = await adjustFertiliserStock(payload)
      const data = await refreshLiveData()
      setHistoryRows(data.transactions)
      setAdjustmentResult(result)
      resetMessage(`Stock adjustment saved. Transaction ${result.transaction.transaction_id}; source ${result.source}.`)
      form.reset()
      setAdjustmentProductId("")
      setAdjustmentUnit("")
      setAdjustmentType("ADJUSTMENT_IN")
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setAdjustmentSubmitting(false)
    }
  }

  const submitRequirement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dataMode !== "live" || !liveData) {
      setFormErrors({ form: "Future Requirement saves require live local database data." })
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const errors: FormErrors = {}
    const productId = Number(formData.get("product"))
    const product = liveData.products.find((item) => item.product_id === productId)
    const requiredQuantity = String(formData.get("requiredQuantity") ?? "").trim()
    const requirementDate = String(formData.get("requirementDate") ?? "").trim()
    const requiredByDate = String(formData.get("requiredByDate") ?? "").trim()
    const purpose = String(formData.get("purpose") ?? "").trim()
    const plotLocation = String(formData.get("plotLocation") ?? "").trim()
    const estimatedUnitCost = String(formData.get("estimatedUnitCost") ?? "").trim()

    if (!requirementDate) errors.requirement_date = "Requirement date is required"
    if (!requiredByDate) errors.required_by_date = "Required-by date is required"
    if (requirementDate && requiredByDate && requiredByDate < requirementDate) errors.required_by_date = "Required-by date must be on or after requirement date"
    if (!product) errors.product_id = "Product is required"
    if (!validateDecimalQuantity(requiredQuantity)) errors.required_quantity = QUANTITY_PRECISION_ERROR
    if (!requirementUnit) errors.unit = "Unit is required"
    if (product?.default_unit && requirementUnit !== product.default_unit) errors.unit = `Unit must be ${product.default_unit}`
    if (!purpose) errors.purpose = "Purpose is required"
    if (!plotLocation) errors.plot_location = "Plot/location is required"
    if (estimatedUnitCost && Number(estimatedUnitCost) < 0) errors.estimated_unit_cost = "Estimated unit cost must be zero or positive"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload: FertiliserRequirementPayload = {
      requirement_date: requirementDate,
      required_by_date: requiredByDate,
      product_id: productId,
      required_quantity: requiredQuantity,
      unit: requirementUnit,
      purpose,
      crop: String(formData.get("crop") ?? "").trim() || null,
      plot_location: plotLocation,
      planned_application_date: String(formData.get("plannedApplicationDate") ?? "").trim() || null,
      priority: String(formData.get("priority") ?? "MEDIUM") as FertiliserRequirementPayload["priority"],
      supplier_name: String(formData.get("supplier") ?? "").trim() || null,
      estimated_unit_cost: estimatedUnitCost || null,
      remarks: String(formData.get("remarks") ?? "").trim() || null,
    }

    setRequirementSubmitting(true)
    setFormErrors({})
    try {
      const result = await createFertiliserRequirement(payload)
      const data = await refreshLiveData()
      setHistoryRows(data.transactions)
      setRequirementResult(result)
      resetMessage(`Future requirement saved as PLANNED. Requirement ${result.requirement.requirement_id}.`)
      form.reset()
      setRequirementProductId("")
      setRequirementUnit("")
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setRequirementSubmitting(false)
    }
  }

  const runRequirementAction = async (requirement: FertiliserRequirementApiRow, action: "approve" | "ordered" | "cancel") => {
    setRequirementActionId(requirement.requirement_id)
    setFormErrors({})
    try {
      const result =
        action === "approve"
          ? await approveFertiliserRequirement(requirement.requirement_id)
          : action === "ordered"
            ? await markFertiliserRequirementOrdered(requirement.requirement_id)
            : await cancelFertiliserRequirement(requirement.requirement_id)
      const data = await refreshLiveData()
      setHistoryRows(data.transactions)
      setRequirementResult(result)
      resetMessage(`Requirement ${result.requirement.requirement_id} is now ${result.requirement.status}.`)
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setRequirementActionId(null)
    }
  }

  const submitRequirementEdit = async (event: FormEvent<HTMLFormElement>, requirement: FertiliserRequirementApiRow) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const errors: FormErrors = {}
    const requiredByDate = String(formData.get("requiredByDate") ?? "").trim()
    const requiredQuantity = String(formData.get("requiredQuantity") ?? "").trim()
    const purpose = String(formData.get("purpose") ?? "").trim()
    const plotLocation = String(formData.get("plotLocation") ?? "").trim()
    const estimatedUnitCost = String(formData.get("estimatedUnitCost") ?? "").trim()

    if (!requiredByDate) errors.required_by_date = "Required-by date is required"
    if (requiredByDate && requiredByDate < requirement.requirement_date) errors.required_by_date = "Required-by date must be on or after requirement date"
    if (!validateDecimalQuantity(requiredQuantity)) errors.required_quantity = QUANTITY_PRECISION_ERROR
    if (!purpose) errors.purpose = "Purpose is required"
    if (!plotLocation) errors.plot_location = "Plot/location is required"
    if (estimatedUnitCost && Number(estimatedUnitCost) < 0) errors.estimated_unit_cost = "Estimated unit cost must be zero or positive"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload: FertiliserRequirementUpdatePayload = {
      required_by_date: requiredByDate,
      required_quantity: requiredQuantity,
      purpose,
      crop: String(formData.get("crop") ?? "").trim() || null,
      plot_location: plotLocation,
      planned_application_date: String(formData.get("plannedApplicationDate") ?? "").trim() || null,
      priority: String(formData.get("priority") ?? "MEDIUM") as FertiliserRequirementPayload["priority"],
      supplier_name: String(formData.get("supplier") ?? "").trim() || null,
      estimated_unit_cost: estimatedUnitCost || null,
      remarks: String(formData.get("remarks") ?? "").trim() || null,
    }

    setRequirementActionId(requirement.requirement_id)
    setFormErrors({})
    try {
      const result = await updateFertiliserRequirement(requirement.requirement_id, payload)
      const data = await refreshLiveData()
      setHistoryRows(data.transactions)
      setRequirementResult(result)
      setRequirementEditId(null)
      resetMessage(`Requirement ${result.requirement.requirement_id} updated while PLANNED.`)
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setRequirementActionId(null)
    }
  }

  const submitRequirementReceipt = async (event: FormEvent<HTMLFormElement>, requirement: FertiliserRequirementApiRow) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const errors: FormErrors = {}
    const receiptDate = String(formData.get("receiptDate") ?? "").trim()
    const receivedQuantity = String(formData.get("receivedQuantity") ?? "").trim()

    if (!receiptDate) errors.receipt_date = "Receipt date is required"
    if (!validateDecimalQuantity(receivedQuantity)) errors.received_quantity = QUANTITY_PRECISION_ERROR
    if (Number(receivedQuantity) > Number(requirement.remaining_quantity)) errors.received_quantity = `Receipt cannot exceed remaining ${formatApiQuantity(requirement.remaining_quantity, requirement.unit)}`

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload: FertiliserRequirementReceiptPayload = {
      receipt_date: receiptDate,
      received_quantity: receivedQuantity,
      batch_number: String(formData.get("batchNumber") ?? "").trim() || null,
      expiry_date: String(formData.get("expiryDate") ?? "").trim() || null,
      supplier_name: String(formData.get("supplier") ?? "").trim() || null,
      reference_number: String(formData.get("reference") ?? "").trim() || null,
      remarks: String(formData.get("remarks") ?? "").trim() || null,
    }

    setRequirementActionId(requirement.requirement_id)
    setFormErrors({})
    try {
      const result = await receiveFertiliserRequirement(requirement.requirement_id, payload)
      const data = await refreshLiveData()
      setHistoryRows(data.transactions)
      setRequirementResult(result)
      resetMessage(`Requirement receipt saved. Transaction ${result.transaction.transaction_id}; status ${result.requirement.status}.`)
      form.reset()
      setRequirementReceiveId(null)
    } catch (error) {
      const apiError = error as Error & { fieldErrors?: unknown }
      const apiErrors = apiFieldErrorsToFormErrors(apiError.fieldErrors)
      setFormErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: apiError.message })
    } finally {
      setRequirementActionId(null)
    }
  }

  const submitHistoryFilters = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const filters: FertiliserTransactionFilters = {
      date_from: String(formData.get("dateFrom") ?? "").trim() || undefined,
      date_to: String(formData.get("dateTo") ?? "").trim() || undefined,
      category: String(formData.get("category") ?? "").trim() || undefined,
      product: String(formData.get("product") ?? "").trim() || undefined,
      transaction_type: String(formData.get("transactionType") ?? "").trim() || undefined,
      source: String(formData.get("source") ?? "").trim() || undefined,
      plot_location: String(formData.get("plotLocation") ?? "").trim() || undefined,
      search: String(formData.get("search") ?? "").trim() || undefined,
    }
    setHistoryFilters(filters)
    setHistoryLoading(true)
    setHistoryError("")
    try {
      const rows = await fetchFertiliserTransactions(filters)
      setHistoryRows(rows)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Unable to filter transaction history")
    } finally {
      setHistoryLoading(false)
    }
  }

  const resetHistoryFilters = async () => {
    setHistoryFilters({})
    setHistoryLoading(true)
    setHistoryError("")
    try {
      const rows = await fetchFertiliserTransactions()
      setHistoryRows(rows)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Unable to load transaction history")
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadAllocationDetails = async (transactionId: number) => {
    setLoadingAllocationId(transactionId)
    try {
      const rows = await fetchFertiliserTransactionAllocations(transactionId)
      setAllocationDetails((current) => ({ ...current, [transactionId]: rows }))
    } finally {
      setLoadingAllocationId(null)
    }
  }

  const validateDisabledMasterForm = (event: FormEvent<HTMLFormElement>, kind: "Product" | "Category") => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const errors: FormErrors = {}

    if (kind === "Category") {
      if (!String(formData.get("categoryName") ?? "").trim()) errors.categoryName = "Category name is required"
    } else if (kind === "Product") {
      if (!String(formData.get("productName") ?? "").trim()) errors.productName = "Product name is required"
      if (!formData.get("category")) errors.category = "Category is required"
    } else {
      if (!formData.get("product")) errors.product = "Product is required"
      if (!validatePositiveNumber(formData.get(kind === "Future Requirement" ? "requiredQuantity" : "quantity"))) errors.quantity = "Quantity must be greater than zero"
      if (kind === "Outgoing" && !formData.get("purpose")) errors.purpose = "Purpose is required"
      if (kind === "Future Requirement" && !formData.get("requiredByDate")) errors.requiredByDate = "Required date is required"
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    resetMessage(`${kind} form validated. Product/category writes are disabled for this Preview workflow, so no database write occurred.`)
    event.currentTarget.reset()
    if (kind === "Product" || kind === "Category") setActiveModal(null)
  }

  const productOptions = stockProducts.map((product) => (
    <option key={product.id} value={product.productId ?? product.id}>{product.sNo}. {product.name} — {product.category}</option>
  ))
  const outgoingProductOptions = (liveData?.stock ?? [])
    .filter((product) => product.quantity !== null && (numberFromApi(product.eligible_available_quantity) ?? 0) > 0)
    .map((product) => (
      <option key={product.product_id} value={product.product_id}>
        {product.source_row_number ?? product.product_id}. {product.product_name} — {product.category_name} ({formatApiQuantity(product.eligible_available_quantity, product.unit)} available)
      </option>
    ))
  const adjustmentProductOptions = (liveData?.stock ?? [])
    .filter((product) => product.unit !== null)
    .map((product) => (
      <option key={product.product_id} value={product.product_id}>
        {product.source_row_number ?? product.product_id}. {product.product_name} — {product.category_name} ({formatApiQuantity(product.eligible_available_quantity, product.unit)} eligible)
      </option>
    ))
  const requirementProductOptions = (liveData?.products ?? [])
    .filter((product) => product.is_active)
    .map((product) => (
      <option key={product.product_id} value={product.product_id}>
        {product.source_row_number ?? product.product_id}. {product.product_name} — {product.category_name}
      </option>
    ))

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Leaf className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">Fertiliser Management</h1>
              <p className="text-sm text-muted-foreground">Read-only Fertiliser overview connected to the local development database</p>
            </div>
          </div>
          <Badge className="border border-primary/25 bg-primary/10 text-primary">{dataMode === "live" ? "LIVE PREVIEW DATABASE DATA" : dataMode === "loading" ? "LOADING LIVE FERTILISER DATA" : "LIVE DATA UNAVAILABLE"}</Badge>
        </div>

        <DataNotice mode={dataMode} error={dataError} onRetry={() => void refreshLiveData().catch((error) => {
          setLiveData(null)
          setDataMode("fallback")
          setDataError(error instanceof Error ? error.message : "Unable to load Fertiliser API")
        })} />

        <div className="overflow-x-auto rounded-xl border border-border bg-card p-2">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <Icon className="size-4" aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {message ? <div className="rounded-lg bg-chart-2/10 p-3 text-sm font-semibold text-chart-2">{message}</div> : null}
        {exportMessage ? <div className={cn("rounded-lg p-3 text-sm font-semibold", exportMessage.toLowerCase().includes("failed") ? "bg-destructive/10 text-destructive" : "bg-chart-2/10 text-chart-2")}>{exportMessage}</div> : null}

        {activeTab === "overview" ? (
          <div className="space-y-5">
            <StatGrid>
              <StatCard icon={Leaf} label="Products" value={productCount} sublabel={dataMode === "live" ? "Database rows" : "Live data required"} accent="bg-primary/10 text-primary" />
              <StatCard icon={Layers} label="Categories" value={categoryCount} sublabel="Grouped once" accent="bg-chart-4/15 text-chart-4" />
              <StatCard icon={CheckCircle2} label="Quantity Entered" value={quantityEntered} sublabel="Rows" accent="bg-chart-2/15 text-chart-2" />
              <StatCard icon={AlertTriangle} label="Expired" value={expiredProducts} sublabel={`${noExpiryProducts} no expiry`} accent="bg-destructive/10 text-destructive" />
            </StatGrid>
            <FilterControls search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} stockFilter={stockFilter} setStockFilter={setStockFilter} expiryFilter={expiryFilter} setExpiryFilter={setExpiryFilter} categories={categoriesForUi} />
            <Panel title="Complete Product and Stock Register" icon={Boxes} headerRight={<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={exportingKind === "stock" || dataMode !== "live"} onClick={() => exportFertiliserData("stock")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{exportingKind === "stock" ? "Exporting..." : "Export Stock Register"}</button><button type="button" onClick={() => setExpandedCategories(new Set(categoriesForUi))} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">Expand All</button><button type="button" onClick={() => setExpandedCategories(new Set())} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">Collapse All</button></div>}>
              <ProductRegister groupedProducts={groupedFilteredProducts} expandedCategories={expandedCategories} toggleCategory={toggleCategory} />
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                {duplicateConfirmationNotes.map((note) => <p key={note}>{note}</p>)}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === "incoming" ? (
          <Panel title="Incoming Stock" icon={PackagePlus}>
            <FormIntro text="Receive stock into the MFMS Preview database only. This creates one batch/transaction after the backend confirms the save." />
            {formErrors.form ? <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{formErrors.form}</div> : null}
            <form onSubmit={submitIncomingStock} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField label="Date" name="transactionDate" type="date" error={formErrors.transaction_date} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Product</span>
                <select name="product" value={incomingProductId} onChange={(event) => handleIncomingProductChange(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
                  <option value="">Select product</option>
                  {productOptions}
                </select>
                <FieldError>{formErrors.product_id}</FieldError>
              </label>
              <InputField label="Quantity" name="quantity" type="number" step="0.001" min="0.001" inputMode="decimal" error={formErrors.quantity} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Unit</span>
                <input name="unit" value={incomingUnit} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground outline-none" placeholder="Auto-filled from Product Master" />
                <FieldError>{formErrors.unit}</FieldError>
              </label>
              <InputField label="Batch number" name="batchNumber" />
              <InputField label={selectedIncomingProduct?.expiry_required ? "Expiry date (required)" : "Expiry date"} name="expiryDate" type="date" error={formErrors.expiry_date} />
              <InputField label="Supplier" name="supplier" />
              <InputField label="Reference" name="reference" />
              <InputField label="Remarks" name="remarks" />
              <div className="md:col-span-2">
                <button type="submit" disabled={incomingSubmitting || dataMode !== "live"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  <ShoppingCart className="size-4" aria-hidden="true" />
                  {incomingSubmitting ? "Saving Incoming Stock..." : "Save Incoming Stock"}
                </button>
              </div>
            </form>
          </Panel>
        ) : null}

        {activeTab === "outgoing" ? (
          <Panel title="Outgoing Stock with FEFO Allocation" icon={Send}>
            <FormIntro text="Issue stock from the MFMS Preview database only. FEFO allocation is automatic: earliest valid expiry first, null-expiry batches last." />
            {formErrors.form ? <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{formErrors.form}</div> : null}
            <form onSubmit={submitOutgoingStock} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField label="Date" name="transactionDate" type="date" error={formErrors.transaction_date} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Product</span>
                <select name="product" value={outgoingProductId} onChange={(event) => handleOutgoingProductChange(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
                  <option value="">Select product with valid stock</option>
                  {outgoingProductOptions}
                </select>
                <FieldError>{formErrors.product_id}</FieldError>
              </label>
              <div className="rounded-lg border border-border bg-muted/45 p-3 text-sm">
                <p className="font-semibold text-foreground">Available Stock</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedOutgoingStock ? formatApiQuantity(selectedOutgoingStock.eligible_available_quantity, selectedOutgoingStock.unit) : "Select a product"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Expired, inactive, and zero-balance batches are excluded.</p>
              </div>
              <InputField label="Quantity" name="quantity" type="number" step="0.001" min="0.001" inputMode="decimal" error={formErrors.quantity} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Unit</span>
                <input name="unit" value={outgoingUnit} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground outline-none" placeholder="Auto-filled from selected product" />
                <FieldError>{formErrors.unit}</FieldError>
              </label>
              <SelectField label="Purpose" name="purpose" error={formErrors.purpose}><option value="">Select purpose</option>{fertiliserPurposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</SelectField>
              <InputField label="Crop (optional)" name="crop" />
              <SelectField label="Plot / location" name="plotLocation" error={formErrors.plot_location}><option value="">Select location</option>{fertiliserLocations.map((location) => <option key={location} value={location}>{location}</option>)}</SelectField>
              <InputField label="Remarks" name="remarks" />
              <div className="md:col-span-2">
                <button type="submit" disabled={outgoingSubmitting || dataMode !== "live"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  <ShoppingCart className="size-4" aria-hidden="true" />
                  {outgoingSubmitting ? "Issuing Outgoing Stock..." : "Issue Outgoing Stock"}
                </button>
              </div>
            </form>
            {outgoingResult ? (
              <div className="mt-5 rounded-xl border border-chart-2/25 bg-chart-2/10 p-4 text-sm">
                <p className="font-bold text-chart-2">Outgoing stock issued with FEFO allocation.</p>
                <dl className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Transaction</dt><dd className="text-foreground">{outgoingResult.transaction.transaction_id}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Issued</dt><dd className="text-foreground">{formatApiQuantity(outgoingResult.transaction.quantity, outgoingResult.transaction.unit)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Purpose</dt><dd className="text-foreground">{outgoingResult.transaction.purpose}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Plot / location</dt><dd className="text-foreground">{outgoingResult.transaction.plot_location}</dd></div>
                </dl>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-sm">
                    <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-chart-2"><th className="px-2 py-2">Batch</th><th className="px-2 py-2">Expiry</th><th className="px-2 py-2">Received</th><th className="px-2 py-2">Allocated</th></tr></thead>
                    <tbody>{outgoingResult.allocations.map((allocation) => <tr key={allocation.allocation_id} className="border-t border-chart-2/20"><td className="px-2 py-2">{allocation.batch_number ?? `Batch ${allocation.batch_id}`}</td><td className="px-2 py-2">{allocation.expiry_date ?? "No expiry"}</td><td className="px-2 py-2">{allocation.received_date ?? "Not entered"}</td><td className="px-2 py-2 font-semibold">{formatApiQuantity(allocation.allocated_quantity, outgoingResult.transaction.unit)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Panel>
        ) : null}

        {activeTab === "adjustment" ? (
          <Panel title="Stock Adjustment" icon={ClipboardList}>
            <FormIntro text="Record MFMS Preview stock corrections without editing history. Adjustment In adds stock; Adjustment Out uses automatic FEFO allocation and excludes expired stock." />
            {formErrors.form ? <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{formErrors.form}</div> : null}
            <form onSubmit={submitAdjustment} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField label="Date" name="transactionDate" type="date" error={formErrors.transaction_date} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Adjustment Type</span>
                <select name="adjustmentType" value={adjustmentType} onChange={(event) => { setAdjustmentType(event.target.value as "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"); setAdjustmentResult(null) }} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
                  <option value="ADJUSTMENT_IN">ADJUSTMENT_IN</option>
                  <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Product</span>
                <select name="product" value={adjustmentProductId} onChange={(event) => handleAdjustmentProductChange(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
                  <option value="">Select product</option>
                  {adjustmentProductOptions}
                </select>
                <FieldError>{formErrors.product_id}</FieldError>
              </label>
              <div className="rounded-lg border border-border bg-muted/45 p-3 text-sm">
                <p className="font-semibold text-foreground">Available Stock</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedAdjustmentStock ? formatApiQuantity(selectedAdjustmentStock.eligible_available_quantity, selectedAdjustmentStock.unit) : "Select a product"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Adjustment Out uses only non-expired eligible stock.</p>
              </div>
              <InputField label="Quantity" name="quantity" type="number" step="0.001" min="0.001" inputMode="decimal" error={formErrors.quantity} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Unit</span>
                <input name="unit" value={adjustmentUnit} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground outline-none" placeholder="Auto-filled from selected product" />
                <FieldError>{formErrors.unit}</FieldError>
              </label>
              <InputField label="Reason" name="reason" error={formErrors.reason} />
              <InputField label="Remarks" name="remarks" />
              <div className="md:col-span-2">
                <button type="submit" disabled={adjustmentSubmitting || dataMode !== "live"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  <ShoppingCart className="size-4" aria-hidden="true" />
                  {adjustmentSubmitting ? "Saving Adjustment..." : "Save Stock Adjustment"}
                </button>
              </div>
            </form>
            {adjustmentResult ? (
              <div className="mt-5 rounded-xl border border-chart-2/25 bg-chart-2/10 p-4 text-sm">
                <p className="font-bold text-chart-2">Stock adjustment saved.</p>
                <dl className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Transaction</dt><dd className="text-foreground">{adjustmentResult.transaction.transaction_id}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Type</dt><dd className="text-foreground">{adjustmentResult.transaction.transaction_type}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Quantity</dt><dd className="text-foreground">{formatApiQuantity(adjustmentResult.transaction.quantity, adjustmentResult.transaction.unit)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Reason</dt><dd className="text-foreground">{adjustmentResult.transaction.purpose}</dd></div>
                </dl>
                {adjustmentResult.allocations.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[620px] border-collapse text-sm">
                      <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-chart-2"><th className="px-2 py-2">Batch</th><th className="px-2 py-2">Expiry</th><th className="px-2 py-2">Received</th><th className="px-2 py-2">Allocated</th></tr></thead>
                      <tbody>{adjustmentResult.allocations.map((allocation) => <tr key={allocation.allocation_id} className="border-t border-chart-2/20"><td className="px-2 py-2">{allocation.batch_number ?? `Batch ${allocation.batch_id}`}</td><td className="px-2 py-2">{allocation.expiry_date ?? "No expiry"}</td><td className="px-2 py-2">{allocation.received_date ?? "Not entered"}</td><td className="px-2 py-2 font-semibold">{formatApiQuantity(allocation.allocated_quantity, adjustmentResult.transaction.unit)}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {activeTab === "requirements" ? (
          <Panel title="Future Requirements" icon={ClipboardList}>
            <FormIntro text="Create Preview planned requirements, move them through approval/order/receipt workflow, and receive stock against a linked requirement. Product and category writes remain disabled." />
            {formErrors.form ? <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{formErrors.form}</div> : null}
            <div className="mt-5">
              <StatGrid>
                <StatCard icon={ClipboardList} label="Total" value={requirementSummary.total} sublabel="Requirements" />
                <StatCard icon={AlertTriangle} label="Purchase Required" value={requirementSummary.purchaseRequired} sublabel="Shortfall > 0" accent="bg-destructive/10 text-destructive" />
                <StatCard icon={ShoppingCart} label="Ordered" value={requirementSummary.ordered} sublabel="Awaiting receipt" accent="bg-chart-4/15 text-chart-4" />
                <StatCard icon={PackagePlus} label="Partial" value={requirementSummary.partiallyReceived} sublabel="Part received" accent="bg-chart-5/15 text-chart-5" />
                <StatCard icon={CheckCircle2} label="Received" value={requirementSummary.received} sublabel="Completed" accent="bg-chart-2/15 text-chart-2" />
                <StatCard icon={AlertTriangle} label="Overdue" value={requirementSummary.overdue} sublabel="Not complete/cancelled" accent="bg-chart-3/15 text-chart-3" />
              </StatGrid>
            </div>
            <form onSubmit={submitRequirement} className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
              <InputField label="Requirement date" name="requirementDate" type="date" error={formErrors.requirement_date} />
              <InputField label="Required by date" name="requiredByDate" type="date" error={formErrors.required_by_date} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Product</span>
                <select name="product" value={requirementProductId} onChange={(event) => handleRequirementProductChange(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">
                  <option value="">Select product</option>
                  {requirementProductOptions}
                </select>
                <FieldError>{formErrors.product_id}</FieldError>
              </label>
              <InputField label="Required quantity" name="requiredQuantity" type="number" step="0.001" min="0.001" inputMode="decimal" error={formErrors.required_quantity} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-foreground">Unit</span>
                <input name="unit" value={requirementUnit} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground outline-none" placeholder="Select product" />
                <FieldError>{formErrors.unit}</FieldError>
              </label>
              <SelectField label="Priority" name="priority" error={formErrors.priority}><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option></SelectField>
              <InputField label="Purpose" name="purpose" error={formErrors.purpose} />
              <SelectField label="Plot / Location" name="plotLocation" error={formErrors.plot_location}><option value="">Select location</option>{fertiliserLocations.map((location) => <option key={location} value={location}>{location}</option>)}</SelectField>
              <InputField label="Crop" name="crop" />
              <InputField label="Planned application date" name="plannedApplicationDate" type="date" />
              <InputField label="Supplier" name="supplier" />
              <InputField label="Estimated unit cost" name="estimatedUnitCost" type="number" step="0.01" min="0" inputMode="decimal" error={formErrors.estimated_unit_cost} />
              <InputField label="Remarks" name="remarks" />
              <div className="rounded-lg border border-border bg-muted/45 p-3 text-sm">
                <p className="font-semibold text-foreground">Current Stock</p>
                <p className="mt-1 text-muted-foreground">{selectedRequirementStock ? formatApiQuantity(selectedRequirementStock.quantity, selectedRequirementStock.unit) : "Select a product"}</p>
              </div>
              <div className="md:col-span-3">
                <button type="submit" disabled={requirementSubmitting || dataMode !== "live"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  {requirementSubmitting ? "Saving Requirement..." : "Create Requirement"}
                </button>
              </div>
            </form>
            {requirementResult ? (
              <div className="mt-4 rounded-xl border border-chart-2/25 bg-chart-2/10 p-4 text-sm">
                <p className="font-bold text-chart-2">Requirement workflow updated.</p>
                <p className="mt-1 text-muted-foreground">Requirement {requirementResult.requirement.requirement_id}: {requirementResult.requirement.status}; remaining {formatApiQuantity(requirementResult.requirement.remaining_quantity, requirementResult.requirement.unit)}.</p>
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
              <SelectField label="Status" name="requirementStatusFilter"><option value="all">All statuses</option>{["PLANNED","APPROVED","ORDERED","PARTIALLY_RECEIVED","RECEIVED","CANCELLED"].map((status) => <option key={status} value={status}>{status}</option>)}</SelectField>
              <SelectField label="Priority" name="requirementPriorityFilter"><option value="all">All priorities</option>{["LOW","MEDIUM","HIGH","URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</SelectField>
              <SelectField label="Category" name="requirementCategoryFilter"><option value="all">All categories</option>{categoriesForUi.map((category) => <option key={category} value={category}>{category}</option>)}</SelectField>
              <SelectField label="Purchase" name="requirementPurchaseFilter"><option value="all">All</option><option value="PURCHASE_REQUIRED">Purchase Required</option><option value="STOCK_AVAILABLE">Stock Available</option></SelectField>
              <InputField label="Required by no later than" name="requirementRequiredByFilter" type="date" />
              <div className="flex items-end gap-2 md:col-span-5">
                <button type="button" onClick={() => {
                  const status = (document.querySelector('select[name="requirementStatusFilter"]') as HTMLSelectElement | null)?.value ?? "all"
                  const priority = (document.querySelector('select[name="requirementPriorityFilter"]') as HTMLSelectElement | null)?.value ?? "all"
                  const category = (document.querySelector('select[name="requirementCategoryFilter"]') as HTMLSelectElement | null)?.value ?? "all"
                  const purchase = (document.querySelector('select[name="requirementPurchaseFilter"]') as HTMLSelectElement | null)?.value ?? "all"
                  const requiredBy = (document.querySelector('input[name="requirementRequiredByFilter"]') as HTMLInputElement | null)?.value ?? ""
                  setRequirementStatusFilter(status); setRequirementPriorityFilter(priority); setRequirementCategoryFilter(category); setRequirementPurchaseFilter(purchase); setRequirementRequiredByFilter(requiredBy)
                }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Apply Filters</button>
                <button type="button" onClick={() => { setRequirementStatusFilter("all"); setRequirementPriorityFilter("all"); setRequirementCategoryFilter("all"); setRequirementPurchaseFilter("all"); setRequirementRequiredByFilter("") }} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">Reset</button>
                <button type="button" disabled={exportingKind === "requirements" || dataMode !== "live"} onClick={() => exportFertiliserData("requirements")} className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60">{exportingKind === "requirements" ? "Exporting..." : "Export Requirements"}</button>
                <span className="text-xs text-muted-foreground">{filteredRequirements.length} shown</span>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-sm">
                <thead><tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary"><th className="px-3 py-2.5">ID</th><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Required</th><th className="px-3 py-2.5">Current</th><th className="px-3 py-2.5">Shortfall</th><th className="px-3 py-2.5">Received</th><th className="px-3 py-2.5">Remaining</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Required By</th><th className="px-3 py-2.5">Est. Total</th><th className="px-3 py-2.5">Actions</th></tr></thead>
                <tbody>
                  {filteredRequirements.length === 0 ? <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">No future requirements yet.</td></tr> : null}
                  {filteredRequirements.map((item) => (
                    <Fragment key={item.requirement_id}>
                      <tr className="border-b border-border align-top">
                        <td className="px-3 py-2.5 font-semibold text-foreground">#{item.requirement_id}</td>
                        <td className="px-3 py-2.5"><p className="font-semibold text-foreground">{item.product_name}</p><p className="text-xs text-muted-foreground">{item.category_name}</p><p className="text-xs text-muted-foreground">{item.purpose}</p></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatApiQuantity(item.required_quantity, item.unit)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatApiQuantity(item.current_stock, item.unit)}</td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">{formatApiQuantity(item.shortfall, item.unit)}<br /><Badge className={item.purchase_status === "PURCHASE_REQUIRED" ? "bg-destructive/10 text-destructive" : "bg-chart-2/15 text-chart-2"}>{item.purchase_status}</Badge></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatApiQuantity(item.received_quantity, item.unit)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatApiQuantity(item.remaining_quantity, item.unit)}</td>
                        <td className="px-3 py-2.5"><Badge className={requirementStatusStyles[item.status]}>{item.status}</Badge></td>
                        <td className="px-3 py-2.5"><Badge className={priorityStyles[item.priority]}>{item.priority}</Badge></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.required_by_date}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.estimated_total_cost ? Number(item.estimated_total_cost).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-2">
                            {item.status === "PLANNED" ? <button type="button" disabled={requirementActionId === item.requirement_id} onClick={() => runRequirementAction(item, "approve")} className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">Approve</button> : null}
                            {item.status === "PLANNED" ? <button type="button" disabled={requirementActionId === item.requirement_id} onClick={() => setRequirementEditId(requirementEditId === item.requirement_id ? null : item.requirement_id)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">{requirementEditId === item.requirement_id ? "Close Edit" : "Edit planned"}</button> : null}
                            {item.status === "APPROVED" ? <button type="button" disabled={requirementActionId === item.requirement_id} onClick={() => runRequirementAction(item, "ordered")} className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">Mark Ordered</button> : null}
                            {item.status === "PLANNED" || item.status === "APPROVED" || (item.status === "ORDERED" && Number(item.received_quantity) === 0) ? <button type="button" disabled={requirementActionId === item.requirement_id} onClick={() => runRequirementAction(item, "cancel")} className="rounded-md border border-destructive/30 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">Cancel</button> : null}
                            {item.status === "ORDERED" || item.status === "PARTIALLY_RECEIVED" ? <button type="button" onClick={() => setRequirementReceiveId(requirementReceiveId === item.requirement_id ? null : item.requirement_id)} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">{item.status === "ORDERED" ? "Receive Stock" : "Receive Remaining"}</button> : null}
                            {item.status === "RECEIVED" || item.status === "CANCELLED" ? <span className="text-xs text-muted-foreground">View only</span> : null}
                          </div>
                        </td>
                      </tr>
                      {requirementEditId === item.requirement_id ? (
                        <tr className="border-b border-border bg-muted/30">
                          <td colSpan={12} className="px-3 py-3">
                            <form onSubmit={(event) => submitRequirementEdit(event, item)} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                              <InputField label="Required by date" name="requiredByDate" type="date" defaultValue={item.required_by_date} error={formErrors.required_by_date} />
                              <InputField label="Required quantity" name="requiredQuantity" type="number" step="0.001" min="0.001" inputMode="decimal" defaultValue={item.required_quantity} error={formErrors.required_quantity} />
                              <SelectField label="Priority" name="priority" defaultValue={item.priority} error={formErrors.priority}><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option></SelectField>
                              <InputField label="Purpose" name="purpose" defaultValue={item.purpose} error={formErrors.purpose} />
                              <SelectField label="Plot / Location" name="plotLocation" defaultValue={item.plot_location} error={formErrors.plot_location}><option value="">Select location</option>{fertiliserLocations.map((location) => <option key={location} value={location}>{location}</option>)}</SelectField>
                              <InputField label="Crop" name="crop" defaultValue={item.crop ?? ""} />
                              <InputField label="Planned application date" name="plannedApplicationDate" type="date" defaultValue={item.planned_application_date ?? ""} />
                              <InputField label="Supplier" name="supplier" defaultValue={item.supplier_name ?? ""} />
                              <InputField label="Estimated unit cost" name="estimatedUnitCost" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={item.estimated_unit_cost ?? ""} error={formErrors.estimated_unit_cost} />
                              <InputField label="Remarks" name="remarks" defaultValue={item.remarks ?? ""} />
                              <div className="flex items-end gap-2 md:col-span-2">
                                <button type="submit" disabled={requirementActionId === item.requirement_id} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">Save Planned Edit</button>
                                <button type="button" onClick={() => setRequirementEditId(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">Cancel Edit</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                      {requirementReceiveId === item.requirement_id ? (
                        <tr className="border-b border-border bg-muted/30">
                          <td colSpan={12} className="px-3 py-3">
                            <form onSubmit={(event) => submitRequirementReceipt(event, item)} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                              <InputField label="Receipt date" name="receiptDate" type="date" error={formErrors.receipt_date} />
                              <InputField label="Received quantity" name="receivedQuantity" type="number" step="0.001" min="0.001" inputMode="decimal" error={formErrors.received_quantity} />
                              <InputField label="Batch number" name="batchNumber" />
                              <InputField label="Expiry date" name="expiryDate" type="date" error={formErrors.expiry_date} />
                              <InputField label="Supplier" name="supplier" />
                              <InputField label="Reference" name="reference" />
                              <InputField label="Remarks" name="remarks" />
                              <div className="flex items-end"><button type="submit" disabled={requirementActionId === item.requirement_id} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">Save Receipt</button></div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}

        {activeTab === "history" ? (
          <Panel title="Transaction History" icon={History}>
            <div className="mb-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{dataMode === "live" ? `Read-only view of ${liveData?.transactions.length ?? 0} Fertiliser transactions. Editing and deletion are not enabled.` : "LIVE FERTILISER DATA UNAVAILABLE. No mock transaction rows are displayed."}</div>
            {dataMode === "live" ? (
              <form onSubmit={submitHistoryFilters} className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
                <InputField label="Date from" name="dateFrom" type="date" />
                <InputField label="Date to" name="dateTo" type="date" />
                <SelectField label="Category" name="category"><option value="">All categories</option>{categoriesForUi.map((category) => <option key={category} value={category}>{category}</option>)}</SelectField>
                <InputField label="Product search" name="product" />
                <SelectField label="Type" name="transactionType"><option value="">All types</option>{["OPENING", "INCOMING", "OUTGOING", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((type) => <option key={type} value={type}>{type}</option>)}</SelectField>
                <SelectField label="Source" name="source"><option value="">All sources</option><option value="Excel_Import">Excel_Import</option><option value="Manual_Admin_TEST">Manual_Admin_TEST</option></SelectField>
                <SelectField label="Plot / location" name="plotLocation"><option value="">All locations</option>{fertiliserLocations.map((location) => <option key={location} value={location}>{location}</option>)}</SelectField>
                <InputField label="Reference / remarks / reason" name="search" />
                <div className="flex items-end gap-2 md:col-span-4">
                  <button type="submit" disabled={historyLoading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{historyLoading ? "Filtering..." : "Apply Filters"}</button>
                  <button type="button" onClick={resetHistoryFilters} disabled={historyLoading} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60">Reset</button>
                  <button type="button" disabled={exportingKind === "transactions" || dataMode !== "live"} onClick={() => exportFertiliserData("transactions")} className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60">{exportingKind === "transactions" ? "Exporting..." : "Export Transactions"}</button>
                  <span className="text-xs text-muted-foreground">{Object.keys(historyFilters).filter((key) => Boolean(historyFilters[key as keyof FertiliserTransactionFilters])).length} active filters</span>
                </div>
              </form>
            ) : null}
            {historyError ? <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{historyError}</div> : null}
            <TransactionHistoryTableV2 liveTransactions={dataMode === "live" ? historyRows ?? liveData?.transactions ?? [] : []} allocationDetails={allocationDetails} loadingAllocationId={loadingAllocationId} onLoadAllocations={loadAllocationDetails} />
          </Panel>
        ) : null}

        {activeTab === "master" ? (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={exportingKind === "products" || dataMode !== "live"} onClick={() => exportFertiliserData("products")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{exportingKind === "products" ? "Exporting Product Master..." : "Export Product Master"}</button>
              <button type="button" disabled title="Coming in a later batch" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground"><PlusCircle className="size-4" aria-hidden="true" /> Add Product — Read-only in FERT-04</button>
              <button type="button" disabled title="Coming in a later batch" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground"><PlusCircle className="size-4" aria-hidden="true" /> Add Category — Read-only in FERT-04</button>
            </div>
            <FilterControls search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} stockFilter={stockFilter} setStockFilter={setStockFilter} expiryFilter={expiryFilter} setExpiryFilter={setExpiryFilter} categories={categoriesForUi} />
            <Panel title="Product Master" icon={Tags}>
              {dataMode === "live" ? (
                <ProductMasterReadOnlyTable products={productMasterRows} />
              ) : (
                <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-6 text-sm font-semibold text-destructive">
                  LIVE FERTILISER DATA UNAVAILABLE. Product Master rows are not shown from mock data.
                </div>
              )}
            </Panel>
          </div>
        ) : null}

        {activeModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-foreground">Add {activeModal === "product" ? "Product" : "Category"} — Disabled</h2>
                <button type="button" onClick={() => setActiveModal(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-5" aria-hidden="true" /><span className="sr-only">Close</span></button>
              </div>
              <form onSubmit={(event) => validateDisabledMasterForm(event, activeModal === "product" ? "Product" : "Category")} className="space-y-4">
                {activeModal === "product" ? (
                  <>
                    <InputField label="Product name" name="productName" error={formErrors.productName} />
                    <SelectField label="Category" name="category" error={formErrors.category}><option value="">Select category</option>{fertiliserCategories.map((category) => <option key={category} value={category}>{category}</option>)}</SelectField>
                    <SelectField label="Unit" name="unit"><option value="">Select unit</option>{fertiliserUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</SelectField>
                  </>
                ) : (
                  <InputField label="Category name" name="categoryName" error={formErrors.categoryName} />
                )}
                <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">This modal validates only. It will not create a product/category until a later database-backed batch is approved.</div>
                <SubmitRow />
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  )
}

function FormIntro({ text }: { text: string }) {
  return <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{text}</div>
}

function InputField({
  label,
  name,
  type = "text",
  step,
  min,
  inputMode,
  defaultValue,
  error,
}: {
  label: string
  name: string
  type?: string
  step?: string
  min?: string
  inputMode?: DecimalInputMode
  defaultValue?: string
  error?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-foreground">{label}</span>
      <input name={name} type={type} step={step} min={min} inputMode={inputMode} defaultValue={defaultValue} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary" />
      <FieldError>{error}</FieldError>
    </label>
  )
}

function SelectField({ label, name, defaultValue, error, children }: { label: string; name: string; defaultValue?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-foreground">{label}</span>
      <select name={name} defaultValue={defaultValue} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary">{children}</select>
      <FieldError>{error}</FieldError>
    </label>
  )
}

function SubmitRow() {
  return (
    <div className="md:col-span-2">
      <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <ShoppingCart className="size-4" aria-hidden="true" />
        Validate Disabled Form
      </button>
    </div>
  )
}
