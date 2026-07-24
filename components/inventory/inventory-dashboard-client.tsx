"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Download, PackageCheck, PackageOpen, Plus, TriangleAlert, Warehouse } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import type { InventoryDashboardData, InventoryStockRow } from "@/lib/inventory-types"
import { transactionTypeLabels } from "@/lib/inventory-types"
import { cn } from "@/lib/utils"

function number(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function formatQty(value: number | string | null | undefined, unit?: string) {
  const n = number(value)
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function statusFor(row: InventoryStockRow): { label: string; className: string } {
  if (number(row.current_stock) <= 0) return { label: "Zero Stock", className: "bg-destructive/10 text-destructive" }
  if (row.has_expired_lot_history) return { label: "Has Expired Lot", className: "bg-amber-100 text-amber-800" }
  return { label: "Available", className: "bg-chart-2/15 text-chart-2" }
}

function downloadCsv(data: InventoryDashboardData) {
  const headers = [
    "Product",
    "Category",
    "Subcategory",
    "Opening Stock",
    "Received",
    "Used",
    "Balance",
    "Unit",
    "Nearest Expiry",
    "Status",
  ]
  const lines = [
    headers,
    ...data.stock.map((row) => [
      row.product_name,
      row.category_name,
      row.subcategory_name,
      row.opening_stock,
      number(row.purchased) + number(row.returned_in) + number(row.adjustment_in),
      number(row.used) + number(row.wasted_expired) + number(row.adjustment_out),
      row.current_stock,
      row.base_unit,
      row.nearest_unexpired_expiry_date ?? "",
      statusFor(row).label,
    ]),
  ]
  const csv = lines
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "inventory-stock-balance.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export function InventoryDashboardClient() {
  const [data, setData] = useState<InventoryDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/inventory/dashboard", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to load inventory")
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load inventory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totals = useMemo(() => {
    const stock = data?.stock ?? []
    return {
      opening: stock.reduce((sum, row) => sum + number(row.opening_stock), 0),
      received: stock.reduce((sum, row) => sum + number(row.purchased) + number(row.returned_in) + number(row.adjustment_in), 0),
      used: stock.reduce((sum, row) => sum + number(row.used) + number(row.wasted_expired) + number(row.adjustment_out), 0),
      balance: stock.reduce((sum, row) => sum + number(row.current_stock), 0),
    }
  }, [data])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => data && downloadCsv(data)}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary shadow-sm hover:bg-primary/5"
          disabled={!data}
        >
          <Download className="size-4" />
          Export to Excel
        </button>
        <Link
          href="/inventory-management/entry"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="size-4" />
          New Entry
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <StatGrid>
        <StatCard icon={Warehouse} label="Opening Stock" value={formatQty(totals.opening)} sublabel="All units combined" accent="bg-primary/10 text-primary" />
        <StatCard icon={PackageOpen} label="Received" value={formatQty(totals.received)} sublabel="Purchase / return / adjustment in" accent="bg-chart-2/15 text-chart-2" />
        <StatCard icon={PackageCheck} label="Used" value={formatQty(totals.used)} sublabel="Used / expired / adjustment out" accent="bg-chart-4/15 text-chart-4" />
        <StatCard icon={TriangleAlert} label="Balance" value={formatQty(totals.balance)} sublabel={`${data?.summary.expired_products ?? 0} expired-lot products`} accent="bg-amber-100 text-amber-800" />
      </StatGrid>

      <Panel title="Inventory Stock Balance" icon={Warehouse}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5 text-right">Opening Stock</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Used</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-3 py-2.5">Expiry</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-6 text-muted-foreground" colSpan={8}>Loading inventory…</td></tr>
              ) : data?.stock.length ? (
                data.stock.map((row) => {
                  const status = statusFor(row)
                  const received = number(row.purchased) + number(row.returned_in) + number(row.adjustment_in)
                  const used = number(row.used) + number(row.wasted_expired) + number(row.adjustment_out)
                  return (
                    <tr key={row.product_id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.product_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.category_name} / {row.subcategory_name}</td>
                      <td className="px-3 py-2.5 text-right">{formatQty(row.opening_stock, row.base_unit)}</td>
                      <td className="px-3 py-2.5 text-right">{formatQty(received, row.base_unit)}</td>
                      <td className="px-3 py-2.5 text-right">{formatQty(used, row.base_unit)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground">{formatQty(row.current_stock, row.base_unit)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.nearest_unexpired_expiry_date)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", status.className)}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr><td className="px-3 py-6 text-muted-foreground" colSpan={8}>No inventory products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent Inventory Transactions" icon={PackageOpen}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Quantity</th>
                <th className="px-3 py-2.5">Purpose / Invoice</th>
                <th className="px-3 py-2.5">Source</th>
              </tr>
            </thead>
            <tbody>
              {(data?.transactions ?? []).slice(0, 25).map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDate(tx.transaction_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{transactionTypeLabels[tx.transaction_type]}</td>
                  <td className="px-3 py-2.5 font-medium">{tx.product_name}</td>
                  <td className="px-3 py-2.5 text-right">{formatQty(tx.quantity, tx.unit)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{tx.purpose || tx.invoice_no || tx.remarks || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{tx.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
