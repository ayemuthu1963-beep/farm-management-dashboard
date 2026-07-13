"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Plus, Save } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import type { InventoryCategory, InventoryMasterData, InventoryProduct, InventorySubcategory, InventoryTransactionType } from "@/lib/inventory-types"
import { transactionTypeLabels } from "@/lib/inventory-types"

const transactionOptions: Array<{ value: InventoryTransactionType; label: string }> = [
  { value: "OPENING_STOCK", label: transactionTypeLabels.OPENING_STOCK },
  { value: "PURCHASE", label: transactionTypeLabels.PURCHASE },
  { value: "USAGE", label: transactionTypeLabels.USAGE },
  { value: "RETURN_IN", label: transactionTypeLabels.RETURN_IN },
  { value: "WASTE_EXPIRED", label: transactionTypeLabels.WASTE_EXPIRED },
  { value: "ADJUSTMENT_INCREASE", label: transactionTypeLabels.ADJUSTMENT_INCREASE },
  { value: "ADJUSTMENT_DECREASE", label: transactionTypeLabels.ADJUSTMENT_DECREASE },
]

const baseUnits = ["kg", "g", "L", "ml", "number", "to_confirm"]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold uppercase text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm font-bold text-muted-foreground hover:bg-muted">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  )
}

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"

export function InventoryEntryClient() {
  const [master, setMaster] = useState<InventoryMasterData>({ categories: [], subcategories: [], products: [] })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<"category" | "subcategory" | "product" | null>(null)
  const [form, setForm] = useState({
    transaction_type: "PURCHASE" as InventoryTransactionType,
    transaction_date: today(),
    category_id: "",
    subcategory_id: "",
    product_id: "",
    quantity: "",
    unit: "",
    expiry_date: "",
    invoice_no: "",
    purpose: "",
    plot_zone: "",
    crop: "",
    remarks: "",
  })

  async function loadMaster() {
    const response = await fetch("/api/inventory/master-data", { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to load inventory master data")
    setMaster(payload)
  }

  useEffect(() => {
    loadMaster().catch((err) => setError(err instanceof Error ? err.message : "Unable to load master data"))
  }, [])

  const filteredSubcategories = useMemo(
    () => master.subcategories.filter((item) => String(item.category_id) === form.category_id),
    [master.subcategories, form.category_id],
  )
  const filteredProducts = useMemo(
    () => master.products.filter((item) => String(item.subcategory_id) === form.subcategory_id),
    [master.products, form.subcategory_id],
  )
  const selectedProduct = master.products.find((item) => String(item.id) === form.product_id)

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function selectProduct(productId: string) {
    const product = master.products.find((item) => String(item.id) === productId)
    setForm((current) => ({
      ...current,
      product_id: productId,
      unit: product?.base_unit && product.base_unit !== "to_confirm" ? product.base_unit : current.unit,
    }))
  }

  async function submitTransaction(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    if (!form.product_id || !form.quantity || !form.transaction_date) {
      setError("Product, date and quantity are required.")
      return
    }
    if (form.transaction_type === "USAGE" && (!form.purpose.trim() || !form.plot_zone.trim() || !form.crop.trim())) {
      setError("Stock Used requires purpose, plot/zone and crop.")
      return
    }
    try {
      const response = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(form.product_id),
          transaction_date: form.transaction_date,
          transaction_type: form.transaction_type,
          quantity: Number(form.quantity),
          unit: form.unit,
          expiry_date: form.expiry_date || null,
          invoice_no: form.invoice_no || null,
          purpose: form.purpose || null,
          plot_zone: form.plot_zone || null,
          crop: form.crop || null,
          remarks: form.remarks || null,
          entered_by: "MFMS Web Admin",
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to save transaction")
      setMessage(`${transactionTypeLabels[form.transaction_type]} saved successfully.`)
      setForm((current) => ({ ...current, quantity: "", invoice_no: "", purpose: "", plot_zone: "", crop: "", remarks: "" }))
      await loadMaster()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transaction")
    }
  }

  async function createCategory(data: FormData) {
    await createMaster("/api/inventory/categories", {
      category_name: String(data.get("category_name") || ""),
      description: String(data.get("description") || ""),
    })
  }

  async function createSubcategory(data: FormData) {
    await createMaster("/api/inventory/subcategories", {
      category_id: Number(data.get("category_id")),
      subcategory_name: String(data.get("subcategory_name") || ""),
      description: String(data.get("description") || ""),
    })
  }

  async function createProduct(data: FormData) {
    await createMaster("/api/inventory/products", {
      product_name: String(data.get("product_name") || ""),
      original_product_name: String(data.get("original_product_name") || "") || null,
      category_id: Number(data.get("category_id")),
      subcategory_id: Number(data.get("subcategory_id")),
      base_unit: String(data.get("base_unit") || ""),
      expiry_required: data.get("expiry_required") === "on",
      remarks: String(data.get("remarks") || ""),
    })
  }

  async function createMaster(url: string, payload: object) {
    setError(null)
    setMessage(null)
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    if (!response.ok) {
      setError(result.detail || result.error || "Unable to save master record")
      return
    }
    setMessage("Master record saved.")
    setModal(null)
    await loadMaster()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory-management" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Inventory Dashboard
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModal("category")} className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5">
            + Add Category
          </button>
          <button type="button" onClick={() => setModal("subcategory")} className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5">
            + Add Subcategory
          </button>
          <button type="button" onClick={() => setModal("product")} className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5">
            + Add Product
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-chart-2/20 bg-chart-2/10 p-3 text-sm font-bold text-chart-2">{message}</div>}
      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</div>}

      <Panel title="Inventory Entry" icon={Save}>
        <form onSubmit={submitTransaction} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field label="Transaction Type">
            <select className={inputClass} value={form.transaction_type} onChange={(e) => update("transaction_type", e.target.value)}>
              {transactionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Transaction Date">
            <input className={inputClass} type="date" value={form.transaction_date} onChange={(e) => update("transaction_date", e.target.value)} />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={form.category_id} onChange={(e) => setForm((current) => ({ ...current, category_id: e.target.value, subcategory_id: "", product_id: "", unit: "" }))}>
              <option value="">Select category</option>
              {master.categories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
            </select>
          </Field>
          <Field label="Subcategory">
            <select className={inputClass} value={form.subcategory_id} onChange={(e) => setForm((current) => ({ ...current, subcategory_id: e.target.value, product_id: "", unit: "" }))}>
              <option value="">Select subcategory</option>
              {filteredSubcategories.map((item) => <option key={item.id} value={item.id}>{item.subcategory_name}</option>)}
            </select>
          </Field>
          <Field label="Product">
            <select className={inputClass} value={form.product_id} onChange={(e) => selectProduct(e.target.value)}>
              <option value="">Select product</option>
              {filteredProducts.map((item) => <option key={item.id} value={item.id}>{item.product_name} ({item.current_stock ?? 0} {item.base_unit})</option>)}
            </select>
          </Field>
          <Field label="Quantity">
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <input className={inputClass} type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
              <input className={inputClass} value={form.unit || selectedProduct?.base_unit || ""} onChange={(e) => update("unit", e.target.value)} placeholder="Unit" />
            </div>
          </Field>
          <Field label="Expiry Date">
            <input className={inputClass} type="date" value={form.expiry_date} onChange={(e) => update("expiry_date", e.target.value)} />
          </Field>
          <Field label="Invoice No">
            <input className={inputClass} value={form.invoice_no} onChange={(e) => update("invoice_no", e.target.value)} placeholder="For stock received" />
          </Field>
          <Field label="Purpose">
            <input className={inputClass} value={form.purpose} onChange={(e) => update("purpose", e.target.value)} placeholder="Required for Stock Used" />
          </Field>
          <Field label="Plot / Zone">
            <input className={inputClass} value={form.plot_zone} onChange={(e) => update("plot_zone", e.target.value)} placeholder="Required for Stock Used" />
          </Field>
          <Field label="Crop">
            <input className={inputClass} value={form.crop} onChange={(e) => update("crop", e.target.value)} placeholder="Required for Stock Used" />
          </Field>
          <Field label="Remarks">
            <input className={inputClass} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} />
          </Field>
          <div className="lg:col-span-3">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground hover:bg-primary/90">
              <Save className="size-4" />
              Save Inventory Entry
            </button>
          </div>
        </form>
      </Panel>

      {modal === "category" && (
        <Modal title="Add Category" onClose={() => setModal(null)}>
          <form action={createCategory} className="flex flex-col gap-4">
            <Field label="Category Name"><input name="category_name" className={inputClass} required /></Field>
            <Field label="Description"><input name="description" className={inputClass} /></Field>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save Category</button>
          </form>
        </Modal>
      )}
      {modal === "subcategory" && (
        <Modal title="Add Subcategory" onClose={() => setModal(null)}>
          <form action={createSubcategory} className="flex flex-col gap-4">
            <Field label="Category">
              <select name="category_id" className={inputClass} required>
                <option value="">Select category</option>
                {master.categories.map((item: InventoryCategory) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory Name"><input name="subcategory_name" className={inputClass} required /></Field>
            <Field label="Description"><input name="description" className={inputClass} /></Field>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save Subcategory</button>
          </form>
        </Modal>
      )}
      {modal === "product" && (
        <Modal title="Add Product" onClose={() => setModal(null)}>
          <form action={createProduct} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product Name"><input name="product_name" className={inputClass} required /></Field>
            <Field label="Original Name"><input name="original_product_name" className={inputClass} /></Field>
            <Field label="Category">
              <select name="category_id" className={inputClass} required>
                <option value="">Select category</option>
                {master.categories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory">
              <select name="subcategory_id" className={inputClass} required>
                <option value="">Select subcategory</option>
                {master.subcategories.map((item: InventorySubcategory) => <option key={item.id} value={item.id}>{item.category_name} / {item.subcategory_name}</option>)}
              </select>
            </Field>
            <Field label="Base Unit">
              <select name="base_unit" className={inputClass} required>
                {baseUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 pt-7 text-sm font-semibold">
              <input name="expiry_required" type="checkbox" />
              Expiry required
            </label>
            <div className="sm:col-span-2">
              <Field label="Remarks"><input name="remarks" className={inputClass} /></Field>
            </div>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground sm:col-span-2">Save Product</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
