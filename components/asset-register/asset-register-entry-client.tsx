"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, FolderPlus, Save } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import type { AssetCategory, AssetCondition, AssetStatus } from "@/lib/asset-register-types"
import { assetConditionLabels, assetStatusLabels } from "@/lib/asset-register-types"

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>
}

export function AssetRegisterEntryClient() {
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCategory, setShowCategory] = useState(false)
  const [form, setForm] = useState({ asset_code: "", asset_name: "", category_id: "", manufacturer: "", model: "", serial_number: "", location: "", custodian: "", purchase_date: "", purchase_cost: "", condition: "GOOD" as AssetCondition, status: "ACTIVE" as AssetStatus, notes: "" })

  async function loadCategories() {
    const response = await fetch("/api/asset-register/categories", { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to load asset categories")
    setCategories(payload)
  }

  useEffect(() => {
    loadCategories().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load asset categories"))
  }, [])

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    if (!form.asset_code.trim() || !form.asset_name.trim() || !form.category_id) {
      setError("Asset code, asset name and category are required.")
      return
    }
    try {
      const response = await fetch("/api/asset-register/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category_id: Number(form.category_id),
          purchase_date: form.purchase_date || null,
          purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
          manufacturer: form.manufacturer || null,
          model: form.model || null,
          serial_number: form.serial_number || null,
          location: form.location || null,
          custodian: form.custodian || null,
          notes: form.notes || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to register asset")
      setMessage(`Asset ${payload.asset_code} registered.`)
      setForm({ asset_code: "", asset_name: "", category_id: "", manufacturer: "", model: "", serial_number: "", location: "", custodian: "", purchase_date: "", purchase_cost: "", condition: "GOOD", status: "ACTIVE", notes: "" })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to register asset")
    }
  }

  async function createCategory(data: FormData) {
    setError(null)
    setMessage(null)
    const response = await fetch("/api/asset-register/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_name: String(data.get("category_name") || ""), description: String(data.get("description") || "") || null }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.detail || payload.error || "Unable to save asset category")
      return
    }
    setShowCategory(false)
    setMessage("Asset category saved.")
    await loadCategories()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory-management" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"><ArrowLeft className="size-4" /> Back to Asset Register</Link>
        <button type="button" onClick={() => setShowCategory(true)} className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5"><FolderPlus className="size-4" /> Add Asset Category</button>
      </div>
      {message && <div className="rounded-lg border border-chart-2/20 bg-chart-2/10 p-3 text-sm font-bold text-chart-2">{message}</div>}
      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</div>}
      <Panel title="Register Durable Farm Asset" icon={Save}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field label="Asset Code"><input className={inputClass} value={form.asset_code} onChange={(event) => update("asset_code", event.target.value)} placeholder="e.g. PUMP-001" required /></Field>
          <Field label="Asset Name"><input className={inputClass} value={form.asset_name} onChange={(event) => update("asset_name", event.target.value)} placeholder="e.g. Borewell Pump" required /></Field>
          <Field label="Category"><select className={inputClass} value={form.category_id} onChange={(event) => update("category_id", event.target.value)} required><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}</select></Field>
          <Field label="Manufacturer"><input className={inputClass} value={form.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} /></Field>
          <Field label="Model"><input className={inputClass} value={form.model} onChange={(event) => update("model", event.target.value)} /></Field>
          <Field label="Serial Number"><input className={inputClass} value={form.serial_number} onChange={(event) => update("serial_number", event.target.value)} /></Field>
          <Field label="Location"><input className={inputClass} value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="e.g. Pump House" /></Field>
          <Field label="Custodian"><input className={inputClass} value={form.custodian} onChange={(event) => update("custodian", event.target.value)} /></Field>
          <Field label="Purchase Date"><input className={inputClass} type="date" value={form.purchase_date} onChange={(event) => update("purchase_date", event.target.value)} /></Field>
          <Field label="Purchase Cost"><input className={inputClass} type="number" min="0" step="0.01" value={form.purchase_cost} onChange={(event) => update("purchase_cost", event.target.value)} /></Field>
          <Field label="Condition"><select className={inputClass} value={form.condition} onChange={(event) => update("condition", event.target.value)}>{Object.entries(assetConditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Operational Status"><select className={inputClass} value={form.status} onChange={(event) => update("status", event.target.value)}>{Object.entries(assetStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <div className="lg:col-span-3"><Field label="Notes"><textarea className={inputClass} rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field></div>
          <div className="lg:col-span-3"><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground hover:bg-primary/90"><Save className="size-4" /> Register Asset</button></div>
        </form>
      </Panel>
      {showCategory && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold uppercase">Add Asset Category</h2><button type="button" onClick={() => setShowCategory(false)} className="rounded-md px-2 py-1 text-sm font-bold text-muted-foreground hover:bg-muted">Close</button></div><form action={createCategory} className="flex flex-col gap-4"><Field label="Category Name"><input name="category_name" className={inputClass} required /></Field><Field label="Description"><input name="description" className={inputClass} /></Field><button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save Category</button></form></div></div>}
    </div>
  )
}
