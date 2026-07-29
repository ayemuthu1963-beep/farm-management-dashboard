"use client"

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Search, RotateCcw, SlidersHorizontal } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { HarvestButtonSpinner, HarvestRequestState } from "@/components/coconut/harvest-request-state"
import { detailedQueryClassifications, formatRupees } from "@/lib/coconut-harvest-data"
import type { DetailedQueryRow } from "@/lib/coconut-harvest-api"

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"

function submitParentFormFromSelect(event: KeyboardEvent<HTMLSelectElement>) {
  if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return
  }

  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
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
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select id={id} name={name} defaultValue="All" onKeyDown={submitParentFormFromSelect} className={inputClass}>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

type QueryStatus = "idle" | "loading" | "real" | "empty" | "error"
type SortDirection = "asc" | "desc"
type DetailedSortKey = keyof Pick<
  DetailedQueryRow,
  | "treeNo"
  | "harvestCycle"
  | "harvestDate"
  | "nutsB1"
  | "nutsB2"
  | "nutsB3"
  | "totalBunches"
  | "totalNuts"
  | "totalSale"
  | "missedHarvests"
  | "plot"
  | "classification"
>

interface DetailedSortConfig {
  key: DetailedSortKey
  direction: SortDirection
}

const numericTextCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

function compareDetailedRows(a: DetailedQueryRow, b: DetailedQueryRow, key: DetailedSortKey) {
  if (key === "treeNo" || key === "plot" || key === "classification") {
    return numericTextCollator.compare(String(a[key]), String(b[key]))
  }

  if (key === "harvestDate") {
    return new Date(a.harvestDate).getTime() - new Date(b.harvestDate).getTime()
  }

  return Number(a[key]) - Number(b[key])
}

function sortDetailedRows(rows: DetailedQueryRow[], sortConfig: DetailedSortConfig | null): DetailedQueryRow[] {
  if (!sortConfig) {
    return rows
  }

  return [...rows].sort((a, b) => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1
    return compareDetailedRows(a, b, sortConfig.key) * directionMultiplier
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
  sortKey: DetailedSortKey
  align?: "left" | "right"
  sortConfig: DetailedSortConfig | null
  onSort: (key: DetailedSortKey) => void
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

function ResultsTable({ rows }: { rows: DetailedQueryRow[] }) {
  const [sortConfig, setSortConfig] = useState<DetailedSortConfig | null>(null)
  const sortedRows = useMemo(() => sortDetailedRows(rows, sortConfig), [rows, sortConfig])

  function handleSort(key: DetailedSortKey) {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" }
      }

      return { key, direction: "asc" }
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
            <SortableHeader label="Tree No" sortKey="treeNo" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Cycle" sortKey="harvestCycle" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Harvest Date" sortKey="harvestDate" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Nuts-B1" sortKey="nutsB1" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Nuts-B2" sortKey="nutsB2" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Nuts-B3" sortKey="nutsB3" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Total-B" sortKey="totalBunches" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Total Nuts" sortKey="totalNuts" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Total Sale" sortKey="totalSale" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Missed" sortKey="missedHarvests" align="right" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Plot" sortKey="plot" sortConfig={sortConfig} onSort={handleSort} />
            <SortableHeader label="Classification" sortKey="classification" sortConfig={sortConfig} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={`${row.treeNo}-${row.harvestCycle}-${row.harvestDate}`} className="border-b border-border last:border-0 hover:bg-muted/50">
              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{row.treeNo}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row.harvestCycle}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row.harvestDate}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{row.nutsB1}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{row.nutsB2}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{row.nutsB3}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{row.totalBunches}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-foreground">{row.totalNuts}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{formatRupees(row.totalSale)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{row.missedHarvests}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row.plot}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{row.classification}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function waitForBrowserPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export default function DetailedQueryPage() {
  const [rows, setRows] = useState<DetailedQueryRow[]>([])
  const [status, setStatus] = useState<QueryStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [lastQuery, setLastQuery] = useState("")
  const [exportStatus, setExportStatus] = useState<"idle" | "preparing" | "success" | "error">("idle")
  const queryInFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const requestSequence = useRef(0)
  const exportRequestInFlight = useRef(false)

  useEffect(() => () => activeRequest.current?.abort(), [])

  async function runQuery(query: string) {
    if (queryInFlight.current) {
      return
    }
    queryInFlight.current = true
    const sequence = ++requestSequence.current
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort("timeout"), 45_000)
    setStatus("loading")
    setErrorMessage("")
    try {
      const response = await fetch(`/api/coconut-harvest/detailed-query?${query}`, { signal: controller.signal })
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { referenceId?: string } | null
        const reference = errorData?.referenceId ? ` Reference: ${errorData.referenceId}.` : ""
        const message =
          response.status === 400 || response.status === 422
            ? "Some search filters are invalid."
            : response.status === 404
              ? "Detailed Query service is unavailable."
              : response.status === 408 || response.status === 504
                ? "The search took too long. Please narrow the filters and try again."
                : response.status >= 500
                  ? "Detailed Query could not be completed."
                  : "Unable to connect to the Detailed Query service."
        throw new Error(`${message}${reference}`)
      }

      const data = (await response.json()) as { rows: DetailedQueryRow[] }
      if (sequence !== requestSequence.current) return
      setRows(data.rows)
      setStatus(data.rows.length > 0 ? "real" : "empty")
    } catch (error) {
      if (sequence !== requestSequence.current) return
      const timedOut = controller.signal.aborted && controller.signal.reason === "timeout"
      setErrorMessage(timedOut
        ? "The search took too long. Please narrow the filters and try again."
        : error instanceof Error && error.name === "AbortError"
          ? "The search was cancelled."
          : error instanceof Error
            ? error.message
            : "Unable to connect to the Detailed Query service.")
      setStatus("error")
    } finally {
      window.clearTimeout(timeout)
      if (sequence === requestSequence.current) {
        queryInFlight.current = false
        activeRequest.current = null
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (queryInFlight.current) {
      return
    }
    const formData = new FormData(event.currentTarget)
    const params = new URLSearchParams()

    for (const [key, value] of formData.entries()) {
      const text = String(value).trim()
      if (text && text !== "All") {
        params.set(key, text)
      }
    }

    const query = params.toString()
    setLastQuery(query)
    await runQuery(query)
  }

  async function exportDisplayedRows() {
    if (rows.length === 0 || exportRequestInFlight.current) {
      return
    }

    exportRequestInFlight.current = true
    setExportStatus("preparing")

    try {
      await waitForBrowserPaint()

      const headers = [
        "Tree No",
        "Cycle",
        "Harvest Date",
        "Nuts-B1",
        "Nuts-B2",
        "Nuts-B3",
        "Total-B",
        "Total Nuts",
        "Total Sale",
        "Missed",
        "Plot",
        "Classification",
      ]
      const csvRows = rows.map((row) => [
        row.treeNo,
        row.harvestCycle,
        row.harvestDate,
        row.nutsB1,
        row.nutsB2,
        row.nutsB3,
        row.totalBunches,
        row.totalNuts,
        row.totalSale,
        row.missedHarvests,
        row.plot,
        row.classification,
      ])
      const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
      const csv = [headers, ...csvRows].map((line) => line.map(escapeCell).join(",")).join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "detailed-query-results.csv"
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

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader
          breadcrumb="Detailed Query"
          title="Detailed Search and Filter"
          subtitle="Apply multiple filters to get exact results. This page is ready for the detailed query backend rules."
        />

        <Panel title="Filters" icon={SlidersHorizontal}>
          <form
            onSubmit={handleSubmit}
            onReset={() => {
              requestSequence.current += 1
              activeRequest.current?.abort("reset")
              activeRequest.current = null
              queryInFlight.current = false
              setRows([])
              setStatus("idle")
              setErrorMessage("")
              setLastQuery("")
              setExportStatus("idle")
            }}
          >
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {status === "loading" ? <HarvestButtonSpinner /> : <Search className="size-4" aria-hidden="true" />}
                {status === "loading" ? "Searching..." : "Show Results"}
              </button>
              <button
                type="reset"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset Filters
              </button>
            </div>
          </form>
        </Panel>

        {status === "idle" ? null : (
          <Panel title="Detailed Query Results" icon={Search}>
            {status === "loading" ? (
              <div className="mb-3">
                <HarvestRequestState
                  tone="loading"
                  message="Searching harvest records..."
                  detail={rows.length > 0 ? "Previous results remain visible until the new search completes." : undefined}
                  compact={rows.length > 0}
                />
              </div>
            ) : null}
            {status === "real" ? (
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                  Real data loaded. Showing {rows.length.toLocaleString("en-IN")} matching records.
                </p>
                <button
                  type="button"
                  disabled={exportStatus === "preparing"}
                  onClick={exportDisplayedRows}
                  className="inline-flex min-w-[190px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {exportStatus === "preparing" ? <HarvestButtonSpinner /> : <Download className="size-4" aria-hidden="true" />}
                  {exportStatus === "preparing" ? "Preparing export…" : "Export Results to CSV"}
                </button>
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  {exportStatus === "success" ? "CSV download started." : null}
                  {exportStatus === "error" ? "Unable to prepare the CSV file. Please try again." : null}
                </p>
              </div>
            ) : null}
            {status === "empty" ? (
              <HarvestRequestState tone="empty" message="No harvest records found for the selected filters." />
            ) : null}
            {status === "error" ? (
              <div className="mb-3">
                <HarvestRequestState
                  tone="error"
                  message="Unable to load harvest data."
                  detail={errorMessage || "Please check the connection and try again."}
                  onRetry={lastQuery ? () => runQuery(lastQuery) : undefined}
                />
              </div>
            ) : null}
            {rows.length > 0 ? <ResultsTable rows={rows} /> : null}
          </Panel>
        )}
      </div>
    </DashboardShell>
  )
}
