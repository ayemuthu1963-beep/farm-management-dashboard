"use client"

import { ChevronLeft, ChevronRight, ChevronsUpDown, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RunRecord } from "@/lib/motor-screenshot-analysis-types"
import { formatDate, formatRuntime, formatTime } from "@/lib/motor-screenshot-analysis-format"
import { MotorBadge } from "./motor-badge"
import { StatusBadge } from "./status-badge"
import { RuntimeRecordCard } from "./runtime-record-card"

export type RecordSort = "date_desc" | "date_asc" | "runtime_desc" | "runtime_asc" | "motor_asc"

export function RuntimeRecordsTable({
  records,
  pagination,
  sort,
  onSort,
  onPage,
  onPageSize,
  onViewScreenshot,
}: {
  records: RunRecord[]
  pagination: { page: number; page_size: number; total: number; pages: number }
  sort: RecordSort
  onSort: (sort: RecordSort) => void
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
  onViewScreenshot: (record: RunRecord) => void
}) {
  const dateSort: RecordSort = sort === "date_desc" ? "date_asc" : "date_desc"
  const runtimeSort: RecordSort = sort === "runtime_desc" ? "runtime_asc" : "runtime_desc"
  const headerButton = (label: string, next: RecordSort) => (
    <button type="button" onClick={() => onSort(next)} className="inline-flex items-center gap-1 hover:text-foreground">{label}<ChevronsUpDown className="size-3" /></button>
  )
  return (
    <section aria-labelledby="records-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div><h2 id="records-heading" className="font-serif text-lg font-bold text-foreground">Runtime records</h2><p className="text-sm text-muted-foreground">{pagination.total} database record{pagination.total === 1 ? "" : "s"} match</p></div>
        <p className="text-xs text-muted-foreground">Sorting and pagination are applied by the backend.</p>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-border bg-muted/50 text-left">
            <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{headerButton("Date", dateSort)}</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{headerButton("Motor", "motor_asc")}</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Run</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motor ON</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ON Reason / Command</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motor OFF</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">OFF Reason / Command</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{headerButton("Runtime", runtimeSort)}</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screenshot</th>
          </tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className={cn("border-b border-border/70 last:border-0", record.status !== "complete" && "bg-destructive/5")}>
                <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{formatDate(record.date)}</td>
                <td className="px-3 py-2.5"><MotorBadge motorId={record.motorId} name={record.motorName} /></td>
                <td className="px-3 py-2.5 text-foreground">{record.run}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{formatTime(record.onTime)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{record.onReason ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{formatTime(record.offTime)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{record.offReason ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{record.status === "complete" ? formatRuntime(record.runtimeMinutes) : "—"}</td>
                <td className="px-3 py-2.5"><StatusBadge status={record.status} /></td>
                <td className="px-3 py-2.5"><button type="button" disabled={!record.screenshotId} onClick={() => onViewScreenshot(record)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium disabled:opacity-40"><ImageIcon className="size-3.5" /> View</button></td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">No records match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 p-4 md:hidden">
        {records.map((record) => <RuntimeRecordCard key={record.id} record={record} onViewScreenshot={onViewScreenshot} />)}
        {records.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No records match the current filters.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Rows per page
          <select value={pagination.page_size} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground">{[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select>
        </label>
        <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Page {pagination.page} of {Math.max(1, pagination.pages)}</span>
          <Button type="button" variant="outline" size="icon" className="size-8" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
          <Button type="button" variant="outline" size="icon" className="size-8" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </section>
  )
}
