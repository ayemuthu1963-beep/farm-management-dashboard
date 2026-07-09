"use client"

import { useEffect, useMemo, useState } from "react"
import { Trees, History, Eraser, BarChart3 } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import {
  treeNumbers as mockTreeNumbers,
  treeHarvestHistory as mockTreeHarvestHistory,
  formatRupees,
  type TreeHarvestRow,
} from "@/lib/coconut-harvest-data"

interface TreeViewData {
  treeNo: string
  treeHarvestHistory: TreeHarvestRow[]
}

interface TreeViewClientProps {
  initialTreeNo: string
  initialTreeOptions: string[]
  initialTreeHistory: TreeHarvestRow[]
  initialDataStatus: "idle" | "real" | "mock" | "empty"
}

export function TreeViewClient({
  initialTreeNo,
  initialTreeOptions,
  initialTreeHistory,
  initialDataStatus,
}: TreeViewClientProps) {
  const [treeNo, setTreeNo] = useState(initialTreeNo)
  const [treeOptions, setTreeOptions] = useState<string[]>(initialTreeOptions)
  const [treeHistory, setTreeHistory] = useState<TreeHarvestRow[]>(initialTreeHistory)
  const [dataStatus, setDataStatus] = useState(initialDataStatus)
  const [showPerformance, setShowPerformance] = useState(false)

  const last10Harvests = useMemo(() => treeHistory.slice(0, 10), [treeHistory])
  const sinceJan2025Harvests = useMemo(
    () => treeHistory.filter((r) => r.harvestDate >= "2025-01-01"),
    [treeHistory],
  )

  function performanceSummary(rows: TreeHarvestRow[]) {
    const nuts = rows.reduce((sum, r) => sum + r.totalNuts, 0)
    const sale = rows.reduce((sum, r) => sum + r.totalSale, 0)
    const average = rows.length > 0 ? nuts / rows.length : 0
    return { nuts, sale, average }
  }

  const last10Summary = performanceSummary(last10Harvests)
  const sinceJan2025Summary = performanceSummary(sinceJan2025Harvests)

  async function loadTreeOptions(query: string) {
    try {
      const response = await fetch(`/api/coconut-harvest/trees?q=${encodeURIComponent(query)}&limit=25`)
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as { treeNumbers: string[] }
      if (data.treeNumbers.length > 0) {
        setTreeOptions(data.treeNumbers)
      }
    } catch {
      // Keep approved mock dropdown options if the real API is unavailable.
    }
  }

  async function loadTreeHistory(selectedTreeNo = treeNo) {
    const trimmedTreeNo = selectedTreeNo.trim()

    if (!trimmedTreeNo) {
      return
    }

    try {
      const response = await fetch(`/api/coconut-harvest/trees/${encodeURIComponent(trimmedTreeNo)}`)
      if (response.status === 404) {
        setTreeNo(trimmedTreeNo)
        setTreeHistory([])
        setDataStatus("empty")
        return
      }
      if (!response.ok) {
        setTreeHistory(mockTreeHarvestHistory)
        setDataStatus("mock")
        return
      }
      const data = (await response.json()) as TreeViewData
      setTreeNo(data.treeNo)
      setTreeHistory(data.treeHarvestHistory)
      setDataStatus(data.treeHarvestHistory.length > 0 ? "real" : "empty")
    } catch {
      setTreeHistory(mockTreeHarvestHistory)
      setDataStatus("mock")
    }
  }

  useEffect(() => {
    loadTreeOptions(treeNo)
  }, [treeNo])

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
                  onChange={(e) => {
                    setTreeNo(e.target.value)
                    setTreeHistory([])
                    setDataStatus("idle")
                  }}
                  placeholder="Enter or select tree number"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <datalist id="tree-options">
                  {treeOptions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={() => loadTreeHistory()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <History className="size-4" aria-hidden="true" />
                Show Tree History
              </button>
              <button
                type="button"
                onClick={() => {
                  setTreeNo("")
                  setTreeHistory([])
                  setTreeOptions(mockTreeNumbers.map(String))
                  setDataStatus("idle")
                }}
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
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-3 text-sm font-black uppercase italic tracking-wide text-destructive">
                    Last 10 Harvest
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Nuts</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{last10Summary.nuts.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Average Nuts / Harvest</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{last10Summary.average.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sale</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{formatRupees(last10Summary.sale)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-sm font-black uppercase italic tracking-wide text-destructive">
                    Since Jan 2025
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Nuts</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{sinceJan2025Summary.nuts.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Average Nuts / Harvest</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{sinceJan2025Summary.average.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sale</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{formatRupees(sinceJan2025Summary.sale)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {dataStatus === "idle" ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                Enter or select a tree number and click Show Tree History.
              </p>
            ) : null}
            {dataStatus === "real" ? (
              <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                Real data loaded for Tree {treeNo}.
              </p>
            ) : null}
            {dataStatus === "empty" ? (
              <p className="rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-xs font-medium text-chart-4">
                No records found for Tree {treeNo}.
              </p>
            ) : null}
            {dataStatus === "mock" ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                API unavailable — showing sample mock data.
              </p>
            ) : null}
          </div>
        </Panel>

        {dataStatus === "idle" ? null : (
          <Panel title="Tree Harvest History" icon={History}>
            <div className="overflow-x-auto">
              {treeHistory.length > 0 ? (
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
                    {treeHistory.map((r) => (
                      <tr key={`${r.cycle}-${r.harvestDate}`} className="border-b border-border last:border-0 hover:bg-muted/50">
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
              ) : (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No harvest records found for tree {treeNo}.
                </p>
              )}
            </div>
          </Panel>
        )}
      </div>
    </DashboardShell>
  )
}
