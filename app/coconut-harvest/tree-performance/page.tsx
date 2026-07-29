"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Trophy } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { HarvestButtonSpinner, HarvestRequestState } from "@/components/coconut/harvest-request-state"
import type { PerformanceRow } from "@/lib/coconut-harvest-data"

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

type SortDirection = "asc" | "desc"
type CategorySortKey = keyof Pick<
  TreePerformanceCategoryRow,
  "treeNo" | "totalNutsLast10Cycles" | "averageNuts" | "harvestsCount" | "missedHarvests" | "minNuts" | "maxNuts"
>

interface CategorySortConfig {
  key: CategorySortKey
  direction: SortDirection
}

const numericTextCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

function cleanCategory(category: string): string {
  return category.replace(/^[^\p{L}\p{N}]+/u, "").trim()
}

function waitForBrowserPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function sortCategoryRows(
  rows: TreePerformanceCategoryRow[],
  sortConfig: CategorySortConfig | null,
): TreePerformanceCategoryRow[] {
  if (!sortConfig) {
    return rows
  }

  return [...rows].sort((a, b) => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1

    if (sortConfig.key === "treeNo") {
      return numericTextCollator.compare(a.treeNo, b.treeNo) * directionMultiplier
    }

    return (Number(a[sortConfig.key]) - Number(b[sortConfig.key])) * directionMultiplier
  })
}

function SortIndicator({ direction }: { direction?: SortDirection }) {
  if (direction === "asc") {
    return <ChevronUp className="size-3.5 text-primary" aria-hidden="true" />
  }

  if (direction === "desc") {
    return <ChevronDown className="size-3.5 text-primary" aria-hidden="true" />
  }

  return <ChevronsUpDown className="size-3.5 text-primary/45" aria-hidden="true" />
}

function SortableHeader({
  label,
  sortKey,
  align = "left",
  sortConfig,
  onSort,
}: {
  label: string
  sortKey: CategorySortKey
  align?: "left" | "right"
  sortConfig: CategorySortConfig | null
  onSort: (key: CategorySortKey) => void
}) {
  const direction = sortConfig?.key === sortKey ? sortConfig.direction : undefined

  return (
    <th className="px-3 py-2.5" scope="col" aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full cursor-pointer items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          align === "right" ? "justify-end text-right" : "justify-start text-left"
        }`}
      >
        <span>{label}</span>
        <SortIndicator direction={direction} />
      </button>
    </th>
  )
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
  isLoading,
  onRetry,
}: {
  data: TreePerformanceCategoryData | null
  status: string
  isLoading: boolean
  onRetry?: () => void
}) {
  const [exportStatus, setExportStatus] = useState<"idle" | "preparing" | "success" | "error">("idle")
  const [sortConfig, setSortConfig] = useState<CategorySortConfig | null>(null)
  const exportRequestInFlight = useRef(false)
  const sortedRows = useMemo(() => sortCategoryRows(data?.rows ?? [], sortConfig), [data?.rows, sortConfig])

  function handleSort(key: CategorySortKey) {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" }
      }

      return { key, direction: "asc" }
    })
  }

  async function exportCategory() {
    if (!data || exportRequestInFlight.current) {
      return
    }

    exportRequestInFlight.current = true
    setExportStatus("preparing")

    try {
      const params = new URLSearchParams({ plot: data.plot, category: data.category })
      const response = await fetch(`/api/coconut-harvest/tree-performance/export?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Unable to prepare category export")
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get("content-disposition") ?? ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
      const filename = filenameMatch?.[1] ?? `tree-performance-${data.plot}-${data.category}.xlsx`
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await waitForBrowserPaint()
      setExportStatus("success")
    } catch {
      setExportStatus("error")
    } finally {
      exportRequestInFlight.current = false
    }
  }

  if (!data && !isLoading && !status.toLowerCase().startsWith("unable")) {
    return null
  }

  const title = data ? `${data.plot} - ${data.category} Trees` : "Loading category details"

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{status}</p>
        </div>
        {data ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              disabled={isLoading || exportStatus === "preparing"}
              onClick={exportCategory}
              className="inline-flex min-w-[210px] cursor-pointer items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {exportStatus === "preparing" ? <HarvestButtonSpinner /> : <Download className="size-4" aria-hidden="true" />}
              {exportStatus === "preparing" ? "Preparing Excel…" : "Export This Category to Excel"}
            </button>
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {exportStatus === "success" ? "Excel download started." : null}
              {exportStatus === "error" ? "Unable to prepare the Excel file. Please try again." : null}
            </p>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4">
          <HarvestRequestState tone="loading" message="Loading harvest data..." compact />
        </div>
      ) : status.toLowerCase().startsWith("unable") ? (
        <div className="mt-4">
          <HarvestRequestState
            tone="error"
            message="Unable to load harvest data."
            detail="Please check the connection and try again."
            onRetry={onRetry}
          />
        </div>
      ) : data?.rows.length === 0 ? (
        <div className="mt-4">
          <HarvestRequestState tone="empty" message="No harvest records found for this tree category." />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                <SortableHeader label="Tree No" sortKey="treeNo" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Total Nuts Last 10 Harvests" sortKey="totalNutsLast10Cycles" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Average Nuts" sortKey="averageNuts" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Harvests Count" sortKey="harvestsCount" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Missed Harvests" sortKey="missedHarvests" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Min Nuts" sortKey="minNuts" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Max Nuts" sortKey="maxNuts" align="right" sortConfig={sortConfig} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
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
    performanceCyclesUsed: [],
    plot1Performance: [],
    plot2Performance: [],
  })
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null)
  const [categoryDetailData, setCategoryDetailData] = useState<TreePerformanceCategoryData | null>(null)
  const [categoryStatus, setCategoryStatus] = useState("")
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [pageStatus, setPageStatus] = useState<"loading" | "real" | "empty" | "error">("loading")
  const pageRequestInFlight = useRef(false)
  const categoryRequestInFlight = useRef(false)

  async function loadTreePerformanceData() {
    if (pageRequestInFlight.current) {
      return
    }
    pageRequestInFlight.current = true
    setPageStatus("loading")
    try {
      const response = await fetch("/api/coconut-harvest/tree-performance")
      if (!response.ok) {
        throw new Error("Unable to load tree performance data")
      }
      const data = (await response.json()) as TreePerformanceData
      if (data.plot1Performance.length > 0 && data.plot2Performance.length > 0) {
        setTreePerformanceData(data)
        setPageStatus("real")
        return
      }
      setPageStatus("empty")
    } catch {
      setPageStatus("error")
    } finally {
      pageRequestInFlight.current = false
    }
  }

  useEffect(() => {
    loadTreePerformanceData()
  }, [])

  async function loadCategoryDetails(selection: SelectedCategory) {
    if (categoryRequestInFlight.current) {
      return
    }

    categoryRequestInFlight.current = true
    setSelectedCategory(selection)
    setCategoryDetailData(null)
    setCategoryLoading(true)
    setCategoryStatus(`Loading harvest data for ${selection.plot} - ${selection.category}...`)

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
      setCategoryDetailData(null)
      setCategoryStatus(`Unable to load live data for ${selection.plot} - ${selection.category}`)
    } finally {
      categoryRequestInFlight.current = false
      setCategoryLoading(false)
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader breadcrumb="Tree Performance View" title="Plot 1 and Plot 2 Performance" />

        <p className="text-sm text-muted-foreground">
          Last 10 harvests used: <span className="font-medium text-foreground">{treePerformanceData.performanceCyclesUsed.join(", ") || (pageStatus === "loading" ? "Loading..." : "Not available")}</span>
        </p>
        {pageStatus === "loading" ? (
          <Panel title="Tree Performance" icon={Trophy}>
            <HarvestRequestState tone="loading" message="Loading harvest data..." />
          </Panel>
        ) : null}
        {pageStatus === "error" ? (
          <HarvestRequestState
            tone="error"
            message="Unable to load harvest data."
            detail="Please check the connection and try again."
            onRetry={loadTreePerformanceData}
          />
        ) : null}
        {pageStatus === "empty" ? (
          <HarvestRequestState tone="empty" message="No harvest records found for tree performance." />
        ) : null}

        {pageStatus === "real" ? (
          <>
            <Panel title="Plot 1: Tree numbers 1 to 999" icon={Trophy}>
              <PerformanceTable rows={treePerformanceData.plot1Performance} plot="Plot 1" onSelect={loadCategoryDetails} />
              {selectedCategory?.plot === "Plot 1" && (
                <CategoryDetailTable
                  data={categoryDetailData}
                  status={categoryStatus}
                  isLoading={categoryLoading}
                  onRetry={selectedCategory ? () => loadCategoryDetails(selectedCategory) : undefined}
                />
              )}
            </Panel>

            <Panel title="Plot 2: Tree numbers above 1000" icon={Trophy}>
              <PerformanceTable rows={treePerformanceData.plot2Performance} plot="Plot 2" onSelect={loadCategoryDetails} />
              {selectedCategory?.plot === "Plot 2" && (
                <CategoryDetailTable
                  data={categoryDetailData}
                  status={categoryStatus}
                  isLoading={categoryLoading}
                  onRetry={selectedCategory ? () => loadCategoryDetails(selectedCategory) : undefined}
                />
              )}
            </Panel>
          </>
        ) : null}
      </div>
    </DashboardShell>
  )
}
