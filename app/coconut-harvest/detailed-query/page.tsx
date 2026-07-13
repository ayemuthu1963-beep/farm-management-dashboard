"use client"

import { useState } from "react"
import { Search, RotateCcw, SlidersHorizontal } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { formatRupees, treeClassifications } from "@/lib/coconut-harvest-data"
import type { DetailedQueryRow } from "@/lib/coconut-harvest-api"

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"

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

function ClassificationField({ label, id, name }: { label: string; id: string; name: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select id={id} name={name} defaultValue="All" className={inputClass}>
        {treeClassifications.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

type QueryStatus = "idle" | "real" | "empty" | "error"

function ResultsTable({ rows }: { rows: DetailedQueryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
            <th className="px-3 py-2.5">Tree No</th>
            <th className="px-3 py-2.5">Cycle</th>
            <th className="px-3 py-2.5">Harvest Date</th>
            <th className="px-3 py-2.5 text-right">Nuts-B1</th>
            <th className="px-3 py-2.5 text-right">Nuts-B2</th>
            <th className="px-3 py-2.5 text-right">Nuts-B3</th>
            <th className="px-3 py-2.5 text-right">Total-B</th>
            <th className="px-3 py-2.5 text-right">Total Nuts</th>
            <th className="px-3 py-2.5 text-right">Total Sale</th>
            <th className="px-3 py-2.5 text-right">Missed</th>
            <th className="px-3 py-2.5">Plot</th>
            <th className="px-3 py-2.5">Classification</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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

export default function DetailedQueryPage() {
  const [rows, setRows] = useState<DetailedQueryRow[]>([])
  const [status, setStatus] = useState<QueryStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = new URLSearchParams()

    for (const [key, value] of formData.entries()) {
      const text = String(value).trim()
      if (text && text !== "All") {
        params.set(key, text)
      }
    }

    try {
      const response = await fetch(`/api/coconut-harvest/detailed-query?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Unable to load detailed query data")
      }

      const data = (await response.json()) as { rows: DetailedQueryRow[] }
      setRows(data.rows)
      setStatus(data.rows.length > 0 ? "real" : "empty")
    } catch (error) {
      setRows([])
      setErrorMessage(error instanceof Error ? error.message : "Unable to load detailed query data")
      setStatus("error")
    }
  }

  function exportDisplayedRows() {
    if (rows.length === 0) {
      return
    }

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
    link.click()
    URL.revokeObjectURL(url)
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
              setRows([])
              setStatus("idle")
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <RangeField label="Tree Number" id="tree" type="text" />
              <RangeField label="Harvest Cycle" id="cycle" />
              <RangeField label="Harvest Date" id="date" type="date" />
              <RangeField label="Nuts" id="nuts" />
              <RangeField label="Sale (Rs.)" id="sale" />
              <RangeField label="No. of Missed Harvests" id="missed" />
              <ClassificationField label="Tree Classification - Plot 1" id="class-plot1" name="plot1Classification" />
              <ClassificationField label="Tree Classification - Plot 2" id="class-plot2" name="plot2Classification" />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Search className="size-4" aria-hidden="true" />
                Show Results
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
            {status === "real" ? (
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                  Real data loaded. Showing {rows.length.toLocaleString("en-IN")} matching records.
                </p>
                <button
                  type="button"
                  onClick={exportDisplayedRows}
                  className="inline-flex items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
                >
                  Export Results to Excel
                </button>
              </div>
            ) : null}
            {status === "empty" ? (
              <p className="rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-8 text-center text-sm font-medium text-chart-4">
                No records found for selected filters.
              </p>
            ) : null}
            {status === "error" ? (
              <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {errorMessage || "Unable to load live PostgreSQL detailed query data."}
              </p>
            ) : null}
            {rows.length > 0 ? <ResultsTable rows={rows} /> : null}
          </Panel>
        )}
      </div>
    </DashboardShell>
  )
}
