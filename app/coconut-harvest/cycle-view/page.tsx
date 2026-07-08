"use client"

import { useState } from "react"
import { CalendarRange, Nut, Layers, Sigma, IndianRupee, RotateCw } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { cycleSummary, harvestCycleRows, harvestCycleOptions, formatRupees } from "@/lib/coconut-harvest-data"
import { cn } from "@/lib/utils"

export default function CycleViewPage() {
  const [cycle, setCycle] = useState(String(harvestCycleOptions[0]))
  const [startDate, setStartDate] = useState("2026-01-01")
  const [endDate, setEndDate] = useState("2026-07-02")
  const [showAll, setShowAll] = useState(true)

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader breadcrumb="Cycle & Harvest View" title="Cycle and Date Range Summary" />

        {/* Controls */}
        <Panel title="Filters" icon={CalendarRange}>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="lg:w-48">
              <label htmlFor="cycle" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Harvest Cycle
              </label>
              <select
                id="cycle"
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {harvestCycleOptions.map((c) => (
                  <option key={c} value={c}>
                    Cycle {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Show Cycle
            </button>

            <div className="lg:w-44">
              <label htmlFor="start" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Start Date
              </label>
              <input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="lg:w-44">
              <label htmlFor="end" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                End Date
              </label>
              <input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Show Date Range
            </button>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              {showAll ? "Hide All Harvests" : "Show All Harvests"}
            </button>
          </div>
        </Panel>

        {/* Summary cards */}
        <StatGrid>
          <StatCard icon={Sigma} label="Total Harvests" value={cycleSummary.totalHarvests.toLocaleString("en-IN")} accent="bg-chart-2/15 text-chart-2" />
          <StatCard icon={Nut} label="Total Nuts" value={cycleSummary.totalNuts.toLocaleString("en-IN")} accent="bg-chart-1/15 text-chart-1" />
          <StatCard icon={Layers} label="Average Nuts" value={cycleSummary.averageNuts.toFixed(1)} accent="bg-chart-3/15 text-chart-3" />
          <StatCard icon={IndianRupee} label="Lifetime Sale" value={formatRupees(cycleSummary.lifetimeSale)} accent="bg-chart-4/15 text-chart-4" />
        </StatGrid>

        {/* All harvest cycles table */}
        {showAll ? (
          <Panel title="All Harvest Cycles" icon={RotateCw}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Cycle</th>
                    <th className="px-3 py-2.5">Start Date</th>
                    <th className="px-3 py-2.5">End Date</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Trees</th>
                    <th className="px-3 py-2.5 text-right">Bunches</th>
                    <th className="px-3 py-2.5 text-right">Nuts</th>
                    <th className="px-3 py-2.5 text-right">Sale Price</th>
                    <th className="px-3 py-2.5 text-right">Total Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {harvestCycleRows.map((r) => (
                    <tr key={r.cycle} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{r.cycle}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.startDate}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.endDate}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                            r.status === "Locked"
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-chart-2/15 text-chart-2",
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-foreground">{r.trees.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.bunches.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-foreground">{r.nuts.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{formatRupees(r.salePrice, 2)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground">{formatRupees(r.totalSale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>
    </DashboardShell>
  )
}
