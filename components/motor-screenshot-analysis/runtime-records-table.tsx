"use client"

import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  ImageIcon,
  Printer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getMotor } from "@/lib/motor-screenshot-analysis-mock-data"
import type { RunRecord } from "@/lib/motor-screenshot-analysis-types"
import { formatDate, formatRuntime, formatTime } from "@/lib/motor-screenshot-analysis-format"
import { MotorBadge } from "./motor-badge"
import { StatusBadge } from "./status-badge"
import { RuntimeRecordCard } from "./runtime-record-card"

type SortKey = "date" | "motorId" | "run" | "onTime" | "offTime" | "runtimeMinutes" | "status"
type SortDir = "asc" | "desc"

const PLACEHOLDER_MESSAGE = "This function will be connected during backend integration."

const COLUMNS: { key: SortKey; label: string; sortable: boolean }[] = [
  { key: "date", label: "Date", sortable: true },
  { key: "motorId", label: "Motor", sortable: true },
  { key: "run", label: "Run", sortable: true },
  { key: "onTime", label: "Motor ON", sortable: true },
  { key: "onTime", label: "ON Reason / Command", sortable: false },
  { key: "offTime", label: "Motor OFF", sortable: true },
  { key: "offTime", label: "OFF Reason / Command", sortable: false },
  { key: "runtimeMinutes", label: "Runtime", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "status", label: "Screenshot", sortable: false },
]

export function RuntimeRecordsTable({
  records,
  onViewScreenshot,
}: {
  records: RunRecord[]
  onViewScreenshot: (record: RunRecord) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const copy = [...records]
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] ?? ""
      let bv: string | number = b[sortKey] ?? ""
      if (sortKey === "motorId") {
        av = getMotor(a.motorId).name
        bv = getMotor(b.motorId).name
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return copy
  }, [records, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize)

  function toggleSort(key: SortKey, sortable: boolean) {
    if (!sortable) return
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(0)
  }

  function firePlaceholder() {
    setNotice(PLACEHOLDER_MESSAGE)
    window.setTimeout(() => setNotice(null), 3000)
  }

  return (
    <section aria-labelledby="records-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 id="records-heading" className="font-serif text-lg font-bold text-foreground">
            Runtime records
          </h2>
          <p className="text-sm text-muted-foreground">
            {sorted.length} record{sorted.length === 1 ? "" : "s"} in view
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={firePlaceholder}>
            <Download className="size-4" aria-hidden="true" />
            Export to Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={firePlaceholder}>
            <Printer className="size-4" aria-hidden="true" />
            Print Report
          </Button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="border-b border-border bg-accent/50 px-4 py-2 text-sm text-foreground"
        >
          {notice}
        </div>
      )}

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {COLUMNS.map((col, i) => (
                <th
                  key={`${col.label}-${i}`}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key, col.sortable)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      <ChevronsUpDown className="size-3" aria-hidden="true" />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  r.status === "unmatched" && "bg-destructive/5",
                )}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
                  {formatDate(r.date)}
                </td>
                <td className="px-3 py-2.5">
                  <MotorBadge motorId={r.motorId} />
                </td>
                <td className="px-3 py-2.5 text-foreground">{r.run}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                  {formatTime(r.onTime)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.onReason ?? "\u2014"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                  {formatTime(r.offTime)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.offReason ?? "\u2014"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                  {r.status === "unmatched" ? "\u2014" : formatRuntime(r.runtimeMinutes)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onViewScreenshot(r)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    aria-label={`View screenshot for ${getMotor(r.motorId).name} run ${r.run}`}
                  >
                    <ImageIcon className="size-3.5" aria-hidden="true" />
                    View
                  </button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-muted-foreground">
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 p-4 md:hidden">
        {pageRows.map((r) => (
          <RuntimeRecordCard key={r.id} record={r} onViewScreenshot={onViewScreenshot} />
        ))}
        {pageRows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No records match the current filters.
          </p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <div className="flex items-center gap-2">
          <label htmlFor="rows-per-page" className="text-xs text-muted-foreground">
            Rows per page
          </label>
          <select
            id="rows-per-page"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(0)
            }}
            className="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  )
}
