"use client"

import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { plot1Performance, plot2Performance, performanceCyclesUsed, type PerformanceRow } from "@/lib/coconut-harvest-data"

interface TreePerformanceData {
  performanceCyclesUsed: number[]
  plot1Performance: PerformanceRow[]
  plot2Performance: PerformanceRow[]
}

interface TreePerformanceCategoryRow {
  treeNo: string
  totalNutsLast10Cycles: number
  averageNuts: number
  harvestsCount: number
  missedHarvests: number
  minNuts: number
  maxNuts: number
}

interface TreePerformanceCategoryData {
  plot: string
  category: string
  rows: TreePerformanceCategoryRow[]
  usedMockFallback: boolean
}

interface SelectedCategory {
  plot: "Plot 1" | "Plot 2"
  category: string
}

function cleanCategory(category: string): string {
  return category.replace(/^[^\p{L}\p{N}]+/u, "").trim()
}

function PerformanceTable({
  rows,
  plot,
  onSelect,
}: {
  rows: PerformanceRow[]
  plot: "Plot 1" | "Plot 2"
  onSelect: (selection: SelectedCategory) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
            <th className="px-3 py-2.5">Rank</th>
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Criteria</th>
            <th className="px-3 py-2.5 text-right">Tree Count</th>
            <th className="px-3 py-2.5 text-right">Min Nuts</th>
            <th className="px-3 py-2.5 text-right">Max Nuts</th>
            <th className="px-3 py-2.5 text-right">Average Nuts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.rank}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect({ plot, category: cleanCategory(r.category) })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelect({ plot, category: cleanCategory(r.category) })
                }
              }}
              role="button"
              tabIndex={0}
            >
              <td className="px-3 py-2.5 font-medium text-muted-foreground">{r.rank}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-foreground">{r.category}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.criteria}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{r.treeCount.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.minNuts}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.maxNuts}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-foreground">{r.averageNuts.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CategoryDetailTable({
  data,
  status,
}: {
  data: TreePerformanceCategoryData | null
  status: string
}) {
  if (!data) {
    return null
  }

  const title = `${data.plot} - ${data.category} Trees`

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{status}</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-primary/30 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          Export This Category to Excel
        </button>
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">No trees found for this category.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                <th className="px-3 py-2.5">Tree No</th>
                <th className="px-3 py-2.5 text-right">Total Nuts Last 10 Cycles</th>
                <th className="px-3 py-2.5 text-right">Average Nuts</th>
                <th className="px-3 py-2.5 text-right">Harvests Count</th>
                <th className="px-3 py-2.5 text-right">Missed Harvests</th>
                <th className="px-3 py-2.5 text-right">Min Nuts</th>
                <th className="px-3 py-2.5 text-right">Max Nuts</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.treeNo} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-foreground">{row.treeNo}</td>
                  <td className="px-3 py-2.5 text-right text-foreground">{row.totalNutsLast10Cycles.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-foreground">{row.averageNuts.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{row.harvestsCount}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{row.missedHarvests}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{row.minNuts}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{row.maxNuts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function TreePerformancePage() {
  const [treePerformanceData, setTreePerformanceData] = useState<TreePerformanceData>({
    performanceCyclesUsed,
    plot1Performance,
    plot2Performance,
  })
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null)
  const [categoryDetailData, setCategoryDetailData] = useState<TreePerformanceCategoryData | null>(null)
  const [categoryStatus, setCategoryStatus] = useState("")

  useEffect(() => {
    let active = true

    async function loadTreePerformanceData() {
      try {
        const response = await fetch("/api/coconut-harvest/tree-performance")
        if (!response.ok) {
          return
        }
        const data = (await response.json()) as TreePerformanceData
        if (active && data.plot1Performance.length > 0 && data.plot2Performance.length > 0) {
          setTreePerformanceData(data)
        }
      } catch {
        // Keep approved mock data fallback if the real API is unavailable.
      }
    }

    loadTreePerformanceData()

    return () => {
      active = false
    }
  }, [])

  async function loadCategoryDetails(selection: SelectedCategory) {
    setSelectedCategory(selection)
    setCategoryDetailData(null)
    setCategoryStatus(`Loading real data for ${selection.plot} - ${selection.category}...`)

    try {
      const params = new URLSearchParams({
        plot: selection.plot,
        category: selection.category,
      })
      const response = await fetch(`/api/coconut-harvest/tree-performance/category?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Unable to load category details")
      }

      const data = (await response.json()) as TreePerformanceCategoryData
      setCategoryDetailData(data)
      setCategoryStatus(`Real data loaded for ${selection.plot} - ${selection.category}`)
    } catch {
      setCategoryDetailData({
        plot: selection.plot,
        category: selection.category,
        rows: [],
        usedMockFallback: true,
      })
      setCategoryStatus(`API unavailable — showing sample mock data for ${selection.plot} - ${selection.category}`)
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader breadcrumb="Tree Performance View" title="Plot 1 and Plot 2 Performance" />

        <p className="text-sm text-muted-foreground">
          Last 10 cycles used: <span className="font-medium text-foreground">{treePerformanceData.performanceCyclesUsed.join(", ")}</span>
        </p>

        <Panel title="Plot 1: Tree numbers 1 to 999" icon={Trophy}>
          <PerformanceTable rows={treePerformanceData.plot1Performance} plot="Plot 1" onSelect={loadCategoryDetails} />
          {selectedCategory?.plot === "Plot 1" && <CategoryDetailTable data={categoryDetailData} status={categoryStatus} />}
        </Panel>

        <Panel title="Plot 2: Tree numbers above 1000" icon={Trophy}>
          <PerformanceTable rows={treePerformanceData.plot2Performance} plot="Plot 2" onSelect={loadCategoryDetails} />
          {selectedCategory?.plot === "Plot 2" && <CategoryDetailTable data={categoryDetailData} status={categoryStatus} />}
        </Panel>
      </div>
    </DashboardShell>
  )
}
