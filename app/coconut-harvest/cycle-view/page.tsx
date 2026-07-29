"use client"

import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  IndianRupee,
  Layers,
  Nut,
  RotateCw,
  Sigma,
} from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { StatCard } from "@/components/farm/stat-card"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { HarvestButtonSpinner, HarvestRequestState } from "@/components/coconut/harvest-request-state"
import {
  formatRupees,
  type CycleSummary,
  type HarvestCycleRow,
} from "@/lib/coconut-harvest-data"
import type { HarvestSummaryData } from "@/lib/coconut-harvest-api"
import { cn } from "@/lib/utils"

interface CycleViewData {
  cycleSummary: CycleSummary
  harvestCycleRows: HarvestCycleRow[]
  harvestCycleOptions: number[]
}

const emptySummary: CycleSummary = {
  totalHarvests: 0,
  totalBunches: 0,
  totalNuts: 0,
  averageNuts: 0,
  lifetimeSale: 0,
}

type SortDirection = "asc" | "desc"
type CycleSortKey = keyof Pick<
  HarvestCycleRow,
  "cycle" | "startDate" | "endDate" | "status" | "trees" | "bunches" | "nuts" | "salePrice" | "totalSale"
>

interface CycleSortConfig {
  key: CycleSortKey
  direction: SortDirection
}

interface CycleDetailRow {
  treeNo: string
  harvestDate: string
  nutsB1: number
  nutsB2: number
  nutsB3: number
  totalBunches: number
  totalNuts: number
  salePrice: number
  totalSale: number
  plot: string
  classification: string
  remarks: string | null
}

interface CycleDetailData {
  cycle: number
  rows: CycleDetailRow[]
}

type CycleDetailStatus = "idle" | "loading" | "real" | "empty" | "error"
type CycleDetailSortKey = keyof Omit<CycleDetailRow, "remarks">

interface CycleDetailSortConfig {
  key: CycleDetailSortKey
  direction: SortDirection
}

const numericTextCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

function waitForBrowserPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function sortIndicator(direction: SortDirection | undefined) {
  if (direction === "asc") {
    return <ChevronUp className="size-3.5 text-primary" aria-hidden="true" />
  }

  if (direction === "desc") {
    return <ChevronDown className="size-3.5 text-primary" aria-hidden="true" />
  }

  return <ChevronsUpDown className="size-3.5 text-primary/45" aria-hidden="true" />
}

function CycleSortableHeader({
  label,
  sortKey,
  align = "left",
  sortConfig,
  onSort,
}: {
  label: string
  sortKey: CycleSortKey
  align?: "left" | "right"
  sortConfig: CycleSortConfig | null
  onSort: (key: CycleSortKey) => void
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
        {sortIndicator(direction)}
      </button>
    </th>
  )
}

function CycleDetailSortableHeader({
  label,
  sortKey,
  align = "left",
  sortConfig,
  onSort,
}: {
  label: string
  sortKey: CycleDetailSortKey
  align?: "left" | "right"
  sortConfig: CycleDetailSortConfig | null
  onSort: (key: CycleDetailSortKey) => void
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
        {sortIndicator(direction)}
      </button>
    </th>
  )
}

function compareCycles(a: HarvestCycleRow, b: HarvestCycleRow, key: CycleSortKey) {
  if (key === "startDate" || key === "endDate") {
    return a[key].localeCompare(b[key])
  }

  if (key === "status") {
    return a.status.localeCompare(b.status)
  }

  return a[key] - b[key]
}

function sortCycles(rows: HarvestCycleRow[], sortConfig: CycleSortConfig | null) {
  if (!sortConfig) {
    return rows
  }

  return [...rows].sort((a, b) => {
    const comparison = compareCycles(a, b, sortConfig.key)
    return sortConfig.direction === "asc" ? comparison : -comparison
  })
}

function compareCycleDetails(a: CycleDetailRow, b: CycleDetailRow, key: CycleDetailSortKey) {
  if (key === "treeNo" || key === "plot" || key === "classification") {
    return numericTextCollator.compare(String(a[key]), String(b[key]))
  }

  if (key === "harvestDate") {
    return a.harvestDate.localeCompare(b.harvestDate)
  }

  return a[key] - b[key]
}

function sortCycleDetails(rows: CycleDetailRow[], sortConfig: CycleDetailSortConfig | null) {
  if (!sortConfig) {
    return rows
  }

  return [...rows].sort((a, b) => {
    const comparison = compareCycleDetails(a, b, sortConfig.key)
    return sortConfig.direction === "asc" ? comparison : -comparison
  })
}

function submitParentFormFromSelect(event: KeyboardEvent<HTMLSelectElement>) {
  if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return
  }

  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

export default function CycleViewPage() {
  const [cycleViewData, setCycleViewData] = useState<CycleViewData>({
    cycleSummary: emptySummary,
    harvestCycleRows: [],
    harvestCycleOptions: [],
  })
  const [cycle, setCycle] = useState("")
  const [startDate, setStartDate] = useState("2026-01-01")
  const [endDate, setEndDate] = useState("2026-07-02")
  const [showAll, setShowAll] = useState(true)
  const [summaryLabel, setSummaryLabel] = useState("Latest harvest cycle")
  const [dataStatus, setDataStatus] = useState<"loading" | "real" | "empty" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [cycleSortConfig, setCycleSortConfig] = useState<CycleSortConfig | null>(null)
  const [selectedDetailCycle, setSelectedDetailCycle] = useState<HarvestCycleRow | null>(null)
  const [cycleDetailRows, setCycleDetailRows] = useState<CycleDetailRow[]>([])
  const [cycleDetailStatus, setCycleDetailStatus] = useState<CycleDetailStatus>("idle")
  const [cycleDetailError, setCycleDetailError] = useState("")
  const [cycleDetailSortConfig, setCycleDetailSortConfig] = useState<CycleDetailSortConfig | null>(null)
  const [cycleDetailExportStatus, setCycleDetailExportStatus] = useState<"idle" | "preparing" | "success" | "error">("idle")
  const summaryRequestInFlight = useRef(false)
  const detailRequestInFlight = useRef<number | null>(null)
  const detailExportInFlight = useRef(false)
  const allCyclesPanelRef = useRef<HTMLDivElement>(null)
  const detailPanelRef = useRef<HTMLDivElement>(null)
  const { harvestCycleRows, harvestCycleOptions } = cycleViewData
  const sortedHarvestCycleRows = useMemo(
    () => sortCycles(harvestCycleRows, cycleSortConfig),
    [harvestCycleRows, cycleSortConfig],
  )
  const sortedCycleDetailRows = useMemo(
    () => sortCycleDetails(cycleDetailRows, cycleDetailSortConfig),
    [cycleDetailRows, cycleDetailSortConfig],
  )
  const selectedCycleRow = useMemo(
    () => harvestCycleRows.find((row) => String(row.cycle) === cycle),
    [cycle, harvestCycleRows],
  )
  const defaultCycleSummary = useMemo(
    () =>
      selectedCycleRow
        ? {
            totalHarvests: selectedCycleRow.trees,
            totalBunches: selectedCycleRow.bunches,
            totalNuts: selectedCycleRow.nuts,
            averageNuts: selectedCycleRow.trees > 0 ? selectedCycleRow.nuts / selectedCycleRow.trees : 0,
            lifetimeSale: selectedCycleRow.totalSale,
          }
        : cycleViewData.cycleSummary,
    [cycleViewData.cycleSummary, selectedCycleRow],
  )
  const [displaySummary, setDisplaySummary] = useState<CycleSummary>(emptySummary)

  async function loadCycleData() {
    setDataStatus("loading")
    setErrorMessage("")
    try {
      const response = await fetch("/api/coconut-harvest/cycles")
      if (!response.ok) {
        throw new Error("Unable to load harvest cycle data")
      }
      const data = (await response.json()) as CycleViewData
      if (data.harvestCycleRows.length > 0) {
        setCycleViewData(data)
        setCycle(String(data.harvestCycleOptions[0]))
        setDisplaySummary(data.cycleSummary)
        setSummaryLabel(`Cycle ${data.harvestCycleOptions[0]}`)
        setDataStatus("real")
        return
      }
      setDataStatus("empty")
    } catch {
      setErrorMessage("Please check the connection and try again.")
      setDataStatus("error")
    }
  }

  useEffect(() => {
    loadCycleData()
  }, [])

  useEffect(() => {
    setDisplaySummary(defaultCycleSummary)
  }, [defaultCycleSummary])

  async function loadCycleSummary() {
    if (!cycle || summaryRequestInFlight.current || dataStatus === "loading") {
      return
    }

    summaryRequestInFlight.current = true
    setIsSummaryLoading(true)
    setErrorMessage("")
    try {
      const response = await fetch(`/api/coconut-harvest/harvest-summary?harvest_cycle=${encodeURIComponent(cycle)}`)
      if (!response.ok) {
        throw new Error("Unable to load selected cycle summary")
      }
      const data = (await response.json()) as HarvestSummaryData
      setDisplaySummary({
        totalHarvests: data.treesHarvested,
        totalBunches: data.totalBunches,
        totalNuts: data.totalNuts,
        averageNuts: data.treesHarvested > 0 ? data.totalNuts / data.treesHarvested : 0,
        lifetimeSale: data.totalSale,
      })
      setSummaryLabel(data.label)
      setDataStatus("real")
    } catch {
      setErrorMessage("Please check the connection and try again.")
      setDataStatus("error")
    } finally {
      summaryRequestInFlight.current = false
      setIsSummaryLoading(false)
    }
  }

  async function loadDateRangeSummary() {
    if (summaryRequestInFlight.current || dataStatus === "loading") {
      return
    }

    summaryRequestInFlight.current = true
    setIsSummaryLoading(true)
    setErrorMessage("")
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
      const response = await fetch(`/api/coconut-harvest/harvest-summary?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Unable to load date-range summary")
      }
      const data = (await response.json()) as HarvestSummaryData
      setDisplaySummary({
        totalHarvests: data.treesHarvested,
        totalBunches: data.totalBunches,
        totalNuts: data.totalNuts,
        averageNuts: data.treesHarvested > 0 ? data.totalNuts / data.treesHarvested : 0,
        lifetimeSale: data.totalSale,
      })
      setSummaryLabel(`${data.startDate} to ${data.endDate}`)
      setDataStatus("real")
    } catch {
      setErrorMessage("Please check the connection and try again.")
      setDataStatus("error")
    } finally {
      summaryRequestInFlight.current = false
      setIsSummaryLoading(false)
    }
  }

  function handleCycleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loadCycleSummary()
  }

  function handleDateRangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loadDateRangeSummary()
  }

  function handleCycleSort(key: CycleSortKey) {
    setCycleSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" }
      }

      return { key, direction: "asc" }
    })
  }

  function handleCycleDetailSort(key: CycleDetailSortKey) {
    setCycleDetailSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" }
      }

      return { key, direction: "asc" }
    })
  }

  async function loadCycleDetails(row: HarvestCycleRow) {
    if (detailRequestInFlight.current === row.cycle) {
      return
    }

    detailRequestInFlight.current = row.cycle
    setSelectedDetailCycle(row)
    setCycleDetailStatus("loading")
    setCycleDetailError("")
    setCycleDetailRows([])
    setCycleDetailExportStatus("idle")

    try {
      const params = new URLSearchParams({
        cycle: String(row.cycle),
      })
      const response = await fetch(`/api/coconut-harvest/cycle-details?${params.toString()}`)
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorBody?.error ?? "Unable to load cycle details")
      }

      const data = (await response.json()) as CycleDetailData
      setCycleDetailRows(data.rows)
      setCycleDetailStatus(data.rows.length > 0 ? "real" : "empty")
      requestAnimationFrame(() => detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch (error) {
      setCycleDetailError(error instanceof Error ? error.message : "Please check the connection and try again.")
      setCycleDetailStatus("error")
    } finally {
      detailRequestInFlight.current = null
    }
  }

  function handleCycleRowClick(row: HarvestCycleRow) {
    const selectedText = window.getSelection()?.toString().trim()
    if (selectedText) {
      return
    }

    loadCycleDetails(row)
  }

  async function exportCycleDetailsToCsv() {
    if (!selectedDetailCycle || detailExportInFlight.current || cycleDetailStatus !== "real" || sortedCycleDetailRows.length === 0) {
      return
    }

    detailExportInFlight.current = true
    setCycleDetailExportStatus("preparing")

    try {
      await waitForBrowserPaint()

      const headers = [
        "Harvest Cycle",
        "Tree No",
        "Harvest Date",
        "Bunch 1 Nuts",
        "Bunch 2 Nuts",
        "Bunch 3 Nuts",
        "Total Bunches",
        "Total Nuts",
        "Sale Price",
        "Total Sale",
        "Plot",
        "Classification",
        "Remarks",
      ]
      const csvRows = sortedCycleDetailRows.map((row) => [
        selectedDetailCycle.cycle,
        row.treeNo,
        row.harvestDate,
        row.nutsB1,
        row.nutsB2,
        row.nutsB3,
        row.totalBunches,
        row.totalNuts,
        row.salePrice,
        row.totalSale,
        row.plot,
        row.classification,
        row.remarks,
      ])
      const csv = [headers, ...csvRows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `harvest-cycle-${selectedDetailCycle.cycle}-results.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await waitForBrowserPaint()
      setCycleDetailExportStatus("success")
    } catch {
      setCycleDetailExportStatus("error")
    } finally {
      detailExportInFlight.current = false
    }
  }

  function returnToSummaryTable() {
    setSelectedDetailCycle(null)
    setCycleDetailRows([])
    setCycleDetailStatus("idle")
    setCycleDetailError("")
    setCycleDetailExportStatus("idle")
    requestAnimationFrame(() => allCyclesPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function handleCycleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: HarvestCycleRow) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    loadCycleDetails(row)
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader breadcrumb="Cycle & Harvest View" title="Harvest and Date Range Summary" />

        {/* Controls */}
        <Panel title="Filters" icon={CalendarRange}>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <form onSubmit={handleCycleSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="lg:w-48">
                <label htmlFor="cycle" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Harvest Cycle
                </label>
                <select
                  id="cycle"
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value)}
                  onKeyDown={submitParentFormFromSelect}
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
                type="submit"
                disabled={!cycle || isSummaryLoading || dataStatus === "loading"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {isSummaryLoading ? <HarvestButtonSpinner /> : null}
                {isSummaryLoading ? "Loading..." : "Show Cycle"}
              </button>
            </form>

            <form onSubmit={handleDateRangeSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-end">
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
                type="submit"
                disabled={isSummaryLoading || dataStatus === "loading"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {isSummaryLoading ? <HarvestButtonSpinner /> : null}
                {isSummaryLoading ? "Loading..." : "Show Date Range"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              {showAll ? "Hide All Harvests" : "Show All Harvests"}
            </button>
          </div>
          <div className="mt-3">
            {dataStatus === "loading" ? (
              <HarvestRequestState tone="loading" message="Loading harvest data..." compact />
            ) : null}
            {isSummaryLoading && dataStatus !== "loading" ? (
              <div className="mt-3">
                <HarvestRequestState tone="loading" message="Calculating harvest summary..." compact />
              </div>
            ) : null}
            {dataStatus === "real" ? (
              <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                Real PostgreSQL data loaded: {summaryLabel}.
              </p>
            ) : null}
            {dataStatus === "empty" ? (
              <HarvestRequestState tone="empty" message="No harvest cycle records found." compact />
            ) : null}
            {dataStatus === "error" ? (
              <HarvestRequestState
                tone="error"
                message="Unable to load harvest data."
                detail={errorMessage || "Please check the connection and try again."}
                onRetry={harvestCycleRows.length === 0 ? loadCycleData : undefined}
              />
            ) : null}
          </div>
        </Panel>

        {/* Summary cards */}
        {dataStatus === "loading" ? (
          <Panel title="Harvest Summary" icon={Sigma}>
            <HarvestRequestState tone="loading" message="Loading harvest data..." />
          </Panel>
        ) : dataStatus === "real" || harvestCycleRows.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Sigma} label="Total Trees Harvested" value={displaySummary.totalHarvests.toLocaleString("en-IN")} accent="bg-chart-2/15 text-chart-2" />
            <StatCard icon={Layers} label="Total Bunches" value={displaySummary.totalBunches.toLocaleString("en-IN")} accent="bg-primary/10 text-primary" />
            <StatCard icon={Nut} label="Total Nuts" value={displaySummary.totalNuts.toLocaleString("en-IN")} accent="bg-chart-1/15 text-chart-1" />
            <StatCard icon={BarChart3} label="Average Nuts" value={displaySummary.averageNuts.toFixed(1)} accent="bg-chart-3/15 text-chart-3" />
            <StatCard icon={IndianRupee} label="Total Sale" value={displaySummary.lifetimeSale.toLocaleString("en-IN")} accent="bg-chart-4/15 text-chart-4" />
          </div>
        ) : null}

        {/* All harvest cycles table */}
        {showAll && harvestCycleRows.length > 0 && !selectedDetailCycle ? (
          <div ref={allCyclesPanelRef}>
          <Panel title="All Harvest Cycles" icon={RotateCw}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <CycleSortableHeader label="Cycle" sortKey="cycle" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Start Date" sortKey="startDate" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="End Date" sortKey="endDate" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Status" sortKey="status" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Trees" sortKey="trees" align="right" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Bunches" sortKey="bunches" align="right" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Nuts" sortKey="nuts" align="right" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Sale Price" sortKey="salePrice" align="right" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                    <CycleSortableHeader label="Total Sale" sortKey="totalSale" align="right" sortConfig={cycleSortConfig} onSort={handleCycleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedHarvestCycleRows.map((r) => (
                    <tr
                      key={r.cycle}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open Harvest Cycle ${r.cycle} details`}
                      onClick={() => handleCycleRowClick(r)}
                      onKeyDown={(event) => handleCycleRowKeyDown(event, r)}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
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
            <p className="mt-3 text-xs text-muted-foreground">
              Click a harvest cycle row, or focus it and press Enter or Space, to view the full records for that cycle.
            </p>
          </Panel>
          </div>
        ) : null}

        {selectedDetailCycle ? (
          <div ref={detailPanelRef}>
          <Panel title={`Harvest Cycle ${selectedDetailCycle.cycle} Details`} icon={Layers}>
            <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-8">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Harvest Cycle</p>
                <p className="font-semibold text-foreground">{selectedDetailCycle.cycle}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Start Date</p>
                <p className="font-semibold text-foreground">{selectedDetailCycle.startDate}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">End Date</p>
                <p className="font-semibold text-foreground">{selectedDetailCycle.endDate}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Trees Harvested</p>
                <p className="font-semibold text-foreground">{selectedDetailCycle.trees.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Total Bunches</p>
                <p className="font-semibold text-foreground">{selectedDetailCycle.bunches.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Total Nuts</p>
                <p className="font-semibold text-foreground">{selectedDetailCycle.nuts.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Sale Price</p>
                <p className="font-semibold text-foreground">{formatRupees(selectedDetailCycle.salePrice, 2)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Total Sale</p>
                <p className="font-semibold text-foreground">{formatRupees(selectedDetailCycle.totalSale)}</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={returnToSummaryTable}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to Harvest and Date Range Summary
              </button>
              {cycleDetailStatus === "real" ? (
                <>
                  <button
                    type="button"
                    disabled={cycleDetailExportStatus === "preparing"}
                    onClick={exportCycleDetailsToCsv}
                    className="inline-flex min-w-[190px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {cycleDetailExportStatus === "preparing" ? <HarvestButtonSpinner /> : <Download className="size-4" aria-hidden="true" />}
                    {cycleDetailExportStatus === "preparing" ? "Preparing export…" : "Export Results to CSV"}
                  </button>
                  <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                    {cycleDetailExportStatus === "success" ? "CSV download started." : null}
                    {cycleDetailExportStatus === "error" ? "Unable to prepare the CSV file. Please try again." : null}
                  </p>
                </>
              ) : null}
            </div>

            {cycleDetailStatus === "loading" ? (
              <HarvestRequestState tone="loading" message="Loading cycle details..." />
            ) : null}

            {cycleDetailStatus === "empty" ? (
              <HarvestRequestState tone="empty" message="No Harvest records are available for this cycle." />
            ) : null}

            {cycleDetailStatus === "error" ? (
              <HarvestRequestState
                tone="error"
                message="Unable to load cycle details."
                detail={cycleDetailError || "Please check the connection and try again."}
                onRetry={() => loadCycleDetails(selectedDetailCycle)}
              />
            ) : null}

            {cycleDetailStatus === "real" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                      <CycleDetailSortableHeader label="Tree No" sortKey="treeNo" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Harvest Date" sortKey="harvestDate" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Bunch 1 Nuts" sortKey="nutsB1" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Bunch 2 Nuts" sortKey="nutsB2" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Bunch 3 Nuts" sortKey="nutsB3" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Total Bunches" sortKey="totalBunches" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Total Nuts" sortKey="totalNuts" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Sale Price" sortKey="salePrice" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Total Sale" sortKey="totalSale" align="right" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Plot" sortKey="plot" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <CycleDetailSortableHeader label="Classification" sortKey="classification" sortConfig={cycleDetailSortConfig} onSort={handleCycleDetailSort} />
                      <th className="px-3 py-2.5" scope="col">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCycleDetailRows.map((row, index) => (
                      <tr key={`${row.treeNo}-${row.harvestDate}-${index}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{row.treeNo}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row.harvestDate}</td>
                        <td className="px-3 py-2.5 text-right text-foreground">{row.nutsB1}</td>
                        <td className="px-3 py-2.5 text-right text-foreground">{row.nutsB2}</td>
                        <td className="px-3 py-2.5 text-right text-foreground">{row.nutsB3}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{row.totalBunches}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-foreground">{row.totalNuts}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{formatRupees(row.salePrice, 2)}</td>
                        <td className="px-3 py-2.5 text-right text-foreground">{formatRupees(row.totalSale)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row.plot || "Not available"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{row.classification || "Not available"}</td>
                        <td className="min-w-48 px-3 py-2.5 text-muted-foreground">{row.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Panel>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  )
}
