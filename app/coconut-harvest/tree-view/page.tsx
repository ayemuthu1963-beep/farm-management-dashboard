"use client"

import { useState } from "react"
import { Trees, History, Eraser, BarChart3 } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { treeNumbers, treeHarvestHistory, formatRupees } from "@/lib/coconut-harvest-data"

export default function TreeViewPage() {
  const [treeNo, setTreeNo] = useState("")
  const [showPerformance, setShowPerformance] = useState(false)

  // Derived totals for the (mock) selected tree performance block.
  const totalNuts = treeHarvestHistory.reduce((sum, r) => sum + r.totalNuts, 0)
  const totalSale = treeHarvestHistory.reduce((sum, r) => sum + r.totalSale, 0)
  const avgNuts = totalNuts / treeHarvestHistory.length

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader breadcrumb="Tree View" title="Select Tree" />

        {/* Controls */}
        <Panel title="Tree Selection" icon={Trees}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label htmlFor="tree-no" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Tree Number
                </label>
                <input
                  id="tree-no"
                  list="tree-options"
                  value={treeNo}
                  onChange={(e) => setTreeNo(e.target.value)}
                  placeholder="Enter or select tree number"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <datalist id="tree-options">
                  {treeNumbers.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <History className="size-4" aria-hidden="true" />
                Show Tree History
              </button>
              <button
                type="button"
                onClick={() => setTreeNo("")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
              >
                <Eraser className="size-4" aria-hidden="true" />
                Clear
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowPerformance((v) => !v)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                <BarChart3 className="size-4" aria-hidden="true" />
                {showPerformance ? "Hide Tree Performance" : "Show Tree Performance"}
              </button>
            </div>

            {showPerformance ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Nuts</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{totalNuts.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Average Nuts / Cycle</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{avgNuts.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lifetime Sale</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{formatRupees(totalSale)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        {/* History table */}
        <Panel title="Tree Harvest History" icon={History}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Harvest Cycle</th>
                  <th className="px-3 py-2.5">Harvest Date</th>
                  <th className="px-3 py-2.5 text-right">Nuts-B1</th>
                  <th className="px-3 py-2.5 text-right">Nuts-B2</th>
                  <th className="px-3 py-2.5 text-right">Nuts-B3</th>
                  <th className="px-3 py-2.5 text-right">Total-B</th>
                  <th className="px-3 py-2.5 text-right">Total Nuts</th>
                  <th className="px-3 py-2.5 text-right">Total Sale</th>
                </tr>
              </thead>
              <tbody>
                {treeHarvestHistory.map((r) => (
                  <tr key={r.cycle} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">Cycle {r.cycle}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.harvestDate}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{r.nutsB1}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{r.nutsB2}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{r.nutsB3}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{r.totalBunches}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-foreground">{r.totalNuts}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{formatRupees(r.totalSale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  )
}
