"use client"

import { type FormEvent, useMemo, useRef, useState } from "react"
import {
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TableProperties,
  X,
} from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { HarvestButtonSpinner, HarvestRequestState } from "@/components/coconut/harvest-request-state"
import { detailedQueryClassifications, formatRupees } from "@/lib/coconut-harvest-data"
import type { TreeWiseQueryCycle, TreeWiseQueryData, TreeWiseQueryRow } from "@/lib/coconut-harvest-api"
import {
  buildTreeWiseQueryWorkbook,
  treeWiseWorkbookFilename,
  type TreeWiseMeasure,
  type TreeWiseMetadata,
  type TreeWiseTotal,
} from "@/lib/tree-wise-query-excel"

const PAGE_SIZE = 100
const TOTAL_COLUMN_WIDTH = 116
const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"

const measureLabels: Record<TreeWiseMeasure, string> = { bunches: "Bun", nuts: "Nuts", sale: "Sale" }
const metadataLabels: Record<TreeWiseMetadata, string> = { plot: "Plot", classification: "Class", reason: "Reason" }
const totalLabels: Record<TreeWiseTotal, string> = {
  totalBunches: "Total Bun",
  totalNuts: "Total Nuts",
  totalSale: "Total Sale",
  totalMissed: "Total Missed",
}
const totalMeasure: Partial<Record<TreeWiseTotal, TreeWiseMeasure>> = {
  totalBunches: "bunches",
  totalNuts: "nuts",
  totalSale: "sale",
}
const measureOrder: TreeWiseMeasure[] = ["bunches", "nuts", "sale"]
const metadataOrder: TreeWiseMetadata[] = ["plot", "classification", "reason"]
const totalOrder: TreeWiseTotal[] = ["totalBunches", "totalNuts", "totalSale", "totalMissed"]

type QueryStatus = "idle" | "loading" | "real" | "empty" | "error"
type SortDirection = "asc" | "desc"

interface SortConfig {
  key: string
  direction: SortDirection
}

function RangeField({ label, id, type = "number" }: { label: string; id: string; type?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex items-center gap-2">
        <input id={`${id}-from`} name={`${id}From`} type={type} placeholder="From" aria-label={`${label} from`} className={inputClass} />
        <span className="text-xs text-muted-foreground">to</span>
        <input id={`${id}-to`} name={`${id}To`} type={type} placeholder="To" aria-label={`${label} to`} className={inputClass} />
      </div>
    </fieldset>
  )
}

function ClassificationField({ label, id, name, options }: { label: string; id: string; name: string; options: readonly string[] }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <select id={id} name={name} defaultValue="All" className={inputClass}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      checked ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground"
    } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}

function SortArrows({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string
  sortKey: string
  sortConfig: SortConfig | null
  onSort: (key: string, direction: SortDirection) => void
}) {
  const activeDirection = sortConfig?.key === sortKey ? sortConfig.direction : null
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label={`Sort ${label} ascending`}
        aria-pressed={activeDirection === "asc"}
        onClick={() => onSort(sortKey, "asc")}
        className={`rounded p-0.5 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeDirection === "asc" ? "bg-primary/15 text-primary" : "text-primary/45"}`}
      >
        <ChevronUp className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`Sort ${label} descending`}
        aria-pressed={activeDirection === "desc"}
        onClick={() => onSort(sortKey, "desc")}
        className={`rounded p-0.5 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeDirection === "desc" ? "bg-primary/15 text-primary" : "text-primary/45"}`}
      >
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  )
}

function SortableLabel({ label, sortKey, sortConfig, onSort }: {
  label: string
  sortKey: string
  sortConfig: SortConfig | null
  onSort: (key: string, direction: SortDirection) => void
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span>{label}</span>
      <SortArrows label={label} sortKey={sortKey} sortConfig={sortConfig} onSort={onSort} />
    </span>
  )
}

const treeCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" })

function sortRows(rows: TreeWiseQueryRow[], sortConfig: SortConfig | null): TreeWiseQueryRow[] {
  if (!sortConfig) return rows

  return [...rows].sort((left, right) => {
    const { key, direction } = sortConfig
    let comparison = 0
    if (key === "treeNo" || key === "plot" || key === "classification" || key === "reason") {
      comparison = treeCollator.compare(String(left[key as keyof TreeWiseQueryRow] ?? ""), String(right[key as keyof TreeWiseQueryRow] ?? ""))
    } else if (key.startsWith("cycle:")) {
      const [, cycle, measure] = key.split(":") as [string, string, TreeWiseMeasure]
      comparison = (left.cycles[cycle]?.[measure] ?? 0) - (right.cycles[cycle]?.[measure] ?? 0)
    } else if (key.startsWith("total:")) {
      const total = key.slice("total:".length) as TreeWiseTotal
      comparison = Number(left[total]) - Number(right[total])
    }
    return comparison * (direction === "asc" ? 1 : -1)
  })
}

function formatCycleDate(cycle: TreeWiseQueryCycle): string {
  const formatter = (value: string) => {
    if (!value) return "Open"
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed)
  }
  return `${formatter(cycle.startDate)}–${formatter(cycle.endDate)}`
}

function TreeWiseTable({
  data,
  measures,
  metadata,
  totals,
}: {
  data: TreeWiseQueryData
  measures: TreeWiseMeasure[]
  metadata: TreeWiseMetadata[]
  totals: TreeWiseTotal[]
}) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [page, setPage] = useState(1)
  const sortedRows = useMemo(() => sortRows(data.rows, sortConfig), [data.rows, sortConfig])
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const minimumWidth = 140 + metadata.length * 145 + data.cycles.length * measures.length * 105 + totals.length * TOTAL_COLUMN_WIDTH

  function handleSort(key: string, direction: SortDirection) {
    setSortConfig({ key, direction })
    setPage(1)
  }

  function totalRight(index: number): number {
    return (totals.length - index - 1) * TOTAL_COLUMN_WIDTH
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
        {data.cycles.map((cycle) => <span key={cycle.cycle}><strong>C{cycle.cycle}:</strong> {formatCycleDate(cycle)}</span>)}
      </div>

      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border" tabIndex={0} aria-label="Tree-wise table; scroll horizontally to view all selected columns">
        <table className="border-collapse text-sm" style={{ minWidth: `${Math.max(760, minimumWidth)}px` }}>
          <thead>
            <tr className="bg-primary/10 text-xs font-semibold uppercase tracking-wide text-primary">
              <th rowSpan={2} className="sticky left-0 z-30 min-w-[130px] border-r border-border bg-primary/10 px-3 py-2.5 text-left">
                <SortableLabel label="Tree No." sortKey="treeNo" sortConfig={sortConfig} onSort={handleSort} />
              </th>
              {metadata.map((field) => (
                <th key={field} rowSpan={2} className={`min-w-[130px] px-3 py-2.5 text-left ${field === "reason" ? "min-w-[230px]" : ""}`}>
                  <SortableLabel label={metadataLabels[field]} sortKey={field} sortConfig={sortConfig} onSort={handleSort} />
                </th>
              ))}
              {measures.length > 0 ? data.cycles.map((cycle) => (
                <th key={cycle.cycle} colSpan={measures.length} className="border-x border-border px-3 py-2 text-center">C{cycle.cycle}</th>
              )) : null}
              {totals.length > 0 ? <th colSpan={totals.length} className="border-l border-border px-3 py-2 text-center">Totals</th> : null}
            </tr>
            <tr className="bg-primary/5 text-xs font-semibold text-primary">
              {data.cycles.flatMap((cycle) => measures.map((measure) => (
                <th key={`${cycle.cycle}-${measure}`} className="min-w-[105px] border-x border-border/60 px-2 py-2 text-right">
                  <SortableLabel label={measureLabels[measure]} sortKey={`cycle:${cycle.cycle}:${measure}`} sortConfig={sortConfig} onSort={handleSort} />
                </th>
              )))}
              {totals.map((total, index) => (
                <th
                  key={total}
                  className="sticky z-30 min-w-[116px] border-l border-border bg-primary/10 px-2 py-2 text-right"
                  style={{ right: `${totalRight(index)}px` }}
                >
                  <SortableLabel label={totalLabels[total]} sortKey={`total:${total}`} sortConfig={sortConfig} onSort={handleSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.treeNo} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="sticky left-0 z-20 whitespace-nowrap border-r border-border bg-card px-3 py-2.5 font-semibold text-foreground">{row.treeNo}</td>
                {metadata.map((field) => <td key={field} className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row[field] || "—"}</td>)}
                {data.cycles.flatMap((cycle) => measures.map((measure) => {
                  const value = row.cycles[cycle.cycle]?.[measure] ?? 0
                  const hasRecord = row.cycles[cycle.cycle]?.hasRecord ?? false
                  return (
                    <td key={`${cycle.cycle}-${measure}`} className={`border-x border-border/40 px-3 py-2.5 text-right ${hasRecord ? "text-foreground" : "bg-destructive/5 text-muted-foreground"}`}>
                      {measure === "sale" ? formatRupees(value) : value.toLocaleString("en-IN")}
                    </td>
                  )
                }))}
                {totals.map((total, index) => {
                  const value = Number(row[total])
                  return (
                    <td
                      key={total}
                      className="sticky z-20 min-w-[116px] border-l border-border bg-card px-3 py-2.5 text-right font-semibold text-foreground"
                      style={{ right: `${totalRight(index)}px` }}
                    >
                      {total === "totalSale" ? formatRupees(value) : value.toLocaleString("en-IN")}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Showing {sortedRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedRows.length)} of {sortedRows.length.toLocaleString("en-IN")} trees
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={safePage === 1} onClick={() => setPage(1)} className="rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-40">First</button>
          <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex items-center rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-40"><ChevronLeft className="size-4" />Previous</button>
          <span className="px-2 font-medium">Page {safePage} of {pageCount}</span>
          <button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="inline-flex items-center rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-40">Next<ChevronRight className="size-4" /></button>
          <button type="button" disabled={safePage === pageCount} onClick={() => setPage(pageCount)} className="rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-40">Last</button>
        </div>
      </div>
    </div>
  )
}

export default function TreeWiseQueryPage() {
  const [data, setData] = useState<TreeWiseQueryData | null>(null)
  const [status, setStatus] = useState<QueryStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [measures, setMeasures] = useState<TreeWiseMeasure[]>(["bunches", "nuts", "sale"])
  const [metadata, setMetadata] = useState<TreeWiseMetadata[]>([])
  const [totals, setTotals] = useState<TreeWiseTotal[]>(["totalBunches", "totalNuts", "totalSale", "totalMissed"])
  const [includeNoRecord, setIncludeNoRecord] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const [selectionError, setSelectionError] = useState("")
  const requestInFlight = useRef(false)

  function setMeasure(measure: TreeWiseMeasure, checked: boolean) {
    setMeasures((current) => measureOrder.filter((item) => item === measure ? checked : current.includes(item)))
    if (checked) setSelectionError("")
    if (!checked) {
      setTotals((current) => current.filter((total) => totalMeasure[total] !== measure))
    }
  }

  function setMetadataField(field: TreeWiseMetadata, checked: boolean) {
    setMetadata((current) => metadataOrder.filter((item) => item === field ? checked : current.includes(item)))
  }

  function setTotal(total: TreeWiseTotal, checked: boolean) {
    setTotals((current) => totalOrder.filter((item) => item === total ? checked : current.includes(item)))
  }

  function selectAll() {
    setMeasures(["bunches", "nuts", "sale"])
    setMetadata(["plot", "classification", "reason"])
    setTotals(["totalBunches", "totalNuts", "totalSale", "totalMissed"])
    setIncludeNoRecord(true)
    setSelectionError("")
  }

  function clearAll() {
    setMeasures([])
    setMetadata([])
    setTotals([])
    setSelectionError("")
  }

  function standardPreset() {
    setMeasures(["bunches", "nuts", "sale"])
    setMetadata([])
    setTotals(["totalBunches", "totalNuts", "totalSale", "totalMissed"])
    setIncludeNoRecord(true)
    setSelectionError("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestInFlight.current) return
    if (measures.length === 0) {
      setSelectionError("Select at least one cycle value: Bun, Nuts, or Sale.")
      return
    }

    const params = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      const text = String(value).trim()
      if (text && text !== "All") params.set(key, text)
    }
    params.set("includeNoRecord", String(includeNoRecord))

    requestInFlight.current = true
    setStatus("loading")
    setErrorMessage("")
    setSelectionError("")
    try {
      const response = await fetch(`/api/coconut-harvest/tree-wise-query?${params.toString()}`)
      const payload = (await response.json().catch(() => null)) as (TreeWiseQueryData & { error?: string; referenceId?: string }) | null
      if (!response.ok || !payload) {
        const reference = payload?.referenceId ? ` Reference: ${payload.referenceId}.` : ""
        throw new Error(`${payload?.error ?? "Unable to load the Tree-wise Table Query."}${reference}`)
      }
      setData(payload)
      setStatus(payload.rows.length > 0 ? "real" : "empty")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the Tree-wise Table Query.")
    } finally {
      requestInFlight.current = false
    }
  }

  function exportToExcel() {
    if (!data || data.rows.length === 0 || measures.length === 0 || exporting) return
    setExporting(true)
    setExportError(false)
    try {
      const workbook = buildTreeWiseQueryWorkbook({ rows: data.rows, cycles: data.cycles, measures, metadata, totals })
      const url = URL.createObjectURL(workbook)
      const link = document.createElement("a")
      link.href = url
      link.download = treeWiseWorkbookFilename()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader
          breadcrumb="Tree-wise Table Query"
          title="Tree-wise Table Query"
          subtitle="Compare selected harvest-cycle values tree by tree and export the same columns to Excel."
        />

        <Panel title="Query Filters and Table Columns" icon={SlidersHorizontal}>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <RangeField label="Tree Number" id="tree" type="text" />
              <RangeField label="Harvest Cycle" id="cycle" />
              <RangeField label="Harvest Date" id="date" type="date" />
              <RangeField label="Nuts" id="nuts" />
              <RangeField label="Sale (Rs.)" id="sale" />
              <RangeField label="No. of Missed Harvests" id="missed" />
              <ClassificationField label="Tree Classification - Plot 1" id="class-plot1" name="plot1Classification" options={detailedQueryClassifications.plot1} />
              <ClassificationField label="Tree Classification - Plot 2" id="class-plot2" name="plot2Classification" options={detailedQueryClassifications.plot2} />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <fieldset className="rounded-xl border border-border bg-muted/20 p-4">
                <legend className="px-1 text-sm font-bold text-foreground">Cycle columns</legend>
                <div className="flex flex-wrap gap-2">
                  {measureOrder.map((measure) => (
                    <Checkbox key={measure} label={measureLabels[measure]} checked={measures.includes(measure)} onChange={(checked) => setMeasure(measure, checked)} />
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-border bg-muted/20 p-4">
                <legend className="px-1 text-sm font-bold text-foreground">Tree columns</legend>
                <div className="flex flex-wrap gap-2">
                  {metadataOrder.map((field) => (
                    <Checkbox key={field} label={metadataLabels[field]} checked={metadata.includes(field)} onChange={(checked) => setMetadataField(field, checked)} />
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-border bg-muted/20 p-4">
                <legend className="px-1 text-sm font-bold text-foreground">Cumulative totals</legend>
                <div className="flex flex-wrap gap-2">
                  {totalOrder.map((total) => {
                    const requiredMeasure = totalMeasure[total]
                    return (
                      <Checkbox
                        key={total}
                        label={totalLabels[total]}
                        checked={totals.includes(total)}
                        disabled={Boolean(requiredMeasure && !measures.includes(requiredMeasure))}
                        onChange={(checked) => setTotal(total, checked)}
                      />
                    )
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={selectAll} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent"><CheckCheck className="size-4" />Select All</button>
              <button type="button" onClick={clearAll} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent"><X className="size-4" />Clear All</button>
              <button type="button" onClick={standardPreset} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15"><RotateCcw className="size-4" />Standard Preset</button>
              <Checkbox label="Include trees with no harvest record in selected cycles" checked={includeNoRecord} onChange={setIncludeNoRecord} />
            </div>

            {selectionError ? <p className="mt-3 text-sm font-medium text-destructive" role="alert">{selectionError}</p> : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={status === "loading"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-70">
                {status === "loading" ? <HarvestButtonSpinner /> : <Search className="size-4" />}
                {status === "loading" ? "Building table…" : "Show Table"}
              </button>
              <button type="reset" onClick={() => { setData(null); setStatus("idle"); setErrorMessage(""); standardPreset() }} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-accent">
                <RotateCcw className="size-4" />Reset Query
              </button>
            </div>
          </form>
        </Panel>

        {status !== "idle" ? (
          <Panel
            title="Tree-wise Query Results"
            icon={TableProperties}
            bodyClassName="min-w-0 max-w-full overflow-hidden"
            headerRight={status === "real" ? (
              <div className="flex flex-col items-end gap-1">
                <button type="button" disabled={exporting || measures.length === 0} onClick={exportToExcel} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                  {exporting ? <HarvestButtonSpinner /> : <Download className="size-4" />}
                  {exporting ? "Preparing Excel…" : "Export to Excel"}
                </button>
                {exportError ? <span className="text-xs font-medium text-destructive">Unable to prepare Excel.</span> : null}
              </div>
            ) : undefined}
          >
            {status === "loading" ? <HarvestRequestState tone="loading" message="Building the tree-wise comparison table…" /> : null}
            {status === "empty" ? <HarvestRequestState tone="empty" message="No trees matched the selected filters." /> : null}
            {status === "error" ? <HarvestRequestState tone="error" message="Unable to load the Tree-wise Table Query." detail={errorMessage} /> : null}
            {status === "real" && data ? <TreeWiseTable data={data} measures={measures} metadata={metadata} totals={totals} /> : null}
          </Panel>
        ) : null}
      </div>
    </DashboardShell>
  )
}
