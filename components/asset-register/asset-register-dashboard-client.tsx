"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Download, Plus, ShieldAlert, ToolCase, Wrench } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import type { AssetRegisterDashboardData, FarmAsset } from "@/lib/asset-register-types"
import { assetConditionLabels, assetStatusLabels } from "@/lib/asset-register-types"
import { cn } from "@/lib/utils"

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function statusStyle(asset: FarmAsset) {
  if (asset.status === "IN_MAINTENANCE" || asset.condition === "NEEDS_REPAIR") return "bg-amber-100 text-amber-800"
  if (asset.status === "RETIRED" || asset.status === "DISPOSED" || asset.condition === "RETIRED") return "bg-muted text-muted-foreground"
  return "bg-chart-2/15 text-chart-2"
}

function downloadCsv(data: AssetRegisterDashboardData) {
  const rows = [
    ["Asset Code", "Asset", "Category", "Location", "Custodian", "Condition", "Status", "Purchase Date", "Serial Number"],
    ...data.assets.map((asset) => [
      asset.asset_code,
      asset.asset_name,
      asset.category_name,
      asset.location ?? "",
      asset.custodian ?? "",
      assetConditionLabels[asset.condition],
      assetStatusLabels[asset.status],
      asset.purchase_date ?? "",
      asset.serial_number ?? "",
    ]),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "mfms-asset-register.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export function AssetRegisterDashboardClient() {
  const [data, setData] = useState<AssetRegisterDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/asset-register/dashboard", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to load asset register")
        setData(payload)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load asset register")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const summary = data?.summary
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => data && downloadCsv(data)} disabled={!data} className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary shadow-sm hover:bg-primary/5">
          <Download className="size-4" />
          Export CSV
        </button>
        <Link href="/inventory-management/entry" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90">
          <Plus className="size-4" />
          Register Asset
        </Link>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</div>}

      <StatGrid>
        <StatCard icon={ToolCase} label="Registered Assets" value={summary?.total_assets ?? 0} sublabel="All farm assets" accent="bg-primary/10 text-primary" />
        <StatCard icon={ToolCase} label="Active" value={summary?.active_assets ?? 0} sublabel="Available for operation" accent="bg-chart-2/15 text-chart-2" />
        <StatCard icon={Wrench} label="In Maintenance" value={summary?.maintenance_assets ?? 0} sublabel="Not currently available" accent="bg-amber-100 text-amber-800" />
        <StatCard icon={ShieldAlert} label="Needs Repair" value={summary?.needs_repair_assets ?? 0} sublabel={`${summary?.retired_or_disposed_assets ?? 0} retired or disposed`} accent="bg-destructive/10 text-destructive" />
      </StatGrid>

      <Panel title="Farm Asset Register" icon={ToolCase}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                <th className="px-3 py-2.5">Asset Code</th>
                <th className="px-3 py-2.5">Asset</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Location / Custodian</th>
                <th className="px-3 py-2.5">Purchase Date</th>
                <th className="px-3 py-2.5">Condition</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-6 text-muted-foreground" colSpan={7}>Loading farm assets…</td></tr>
              ) : data?.assets.length ? data.assets.map((asset) => (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold text-primary">{asset.asset_code}</td>
                  <td className="px-3 py-2.5 font-medium">
                    {asset.asset_name}
                    {asset.manufacturer || asset.model ? <span className="block text-xs text-muted-foreground">{[asset.manufacturer, asset.model].filter(Boolean).join(" · ")}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{asset.category_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{asset.location || "—"}{asset.custodian ? <span className="block text-xs">{asset.custodian}</span> : null}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDate(asset.purchase_date)}</td>
                  <td className="px-3 py-2.5">{assetConditionLabels[asset.condition]}</td>
                  <td className="px-3 py-2.5"><span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", statusStyle(asset))}>{assetStatusLabels[asset.status]}</span></td>
                </tr>
              )) : (
                <tr><td className="px-3 py-6 text-muted-foreground" colSpan={7}>No farm assets have been registered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
