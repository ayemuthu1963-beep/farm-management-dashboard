"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, History } from "lucide-react"
import { Panel } from "@/components/farm/panel"

const GROUP_PAGE_SIZE = 10
const ERROR_PAGE_SIZE = 25
const EXACT_PAGE_SIZE = 25

const EXACT_AUDIT_CLASSIFICATIONS = new Set([
  "READY_EXACT_DUPLICATE",
  "SUPERSEDED_EXACT_DUPLICATE",
  "SUPERSEDED",
  "DUPLICATE_REVIEW_REQUIRED",
])

const EXPLICIT_ERROR_CLASSIFICATIONS = new Set([
  "UNMATCHED_TREE",
  "INVALID_DATA",
  "ODK_HAS_ISSUES",
  "ODK_REJECTED",
  "ODK_DELETED",
  "LATE_SUBMISSION",
  "IMPORT_ERROR",
  "FAILED",
])

const NON_ERROR_CLASSIFICATIONS = new Set([
  "READY_NEW",
  "READY_EXACT_DUPLICATE",
  "SUPERSEDED_EXACT_DUPLICATE",
  "SUPERSEDED",
  "ALREADY_IMPORTED",
])

interface ScanSummary {
  id: number
  status: string
  scan_started_at: string | null
  scan_ended_at: string | null
  cycle_no: string | null
}

interface ScanItem {
  id: number
  scan_id: number
  odk_instance_id: string
  harvest_date: string | null
  original_tree_no: string | null
  classification: string
  issue_type: string | null
  odk_submission_timestamp: string | null
  b1: number | null
  b2: number | null
  b3: number | null
  total_bunches: number | null
  total_nuts: number | null
  group_key: string | null
  note: string | null
  submitter_name: string | null
  device_id: string | null
  tree_exists_in_master?: boolean
  supervisor_decision?: string | null
  supervisor_reason?: string | null
  selected_effective_instance_id?: string | null
  supervisor_admin_user?: string | null
  supervisor_decision_at?: string | null
}

interface ScanResponse {
  scan: ScanSummary
  items: ScanItem[]
}

interface ExactAuditGroup {
  key: string
  rows: ScanItem[]
  retained: ScanItem
  superseded: ScanItem[]
}

function displayDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—"
}

function displayValue(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

function naturalTreeCompare(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function groupKey(item: ScanItem): string {
  return item.group_key ?? `${displayDate(item.harvest_date)}|${item.original_tree_no ?? ""}`
}

function businessSignature(item: ScanItem, cycleNo: string | null): string {
  return JSON.stringify([
    String(item.original_tree_no ?? "").trim(),
    displayDate(item.harvest_date),
    cycleNo ?? "",
    item.total_bunches,
    item.b1,
    item.b2,
    item.b3,
    item.total_nuts,
  ])
}

function earliestSubmission(rows: ScanItem[]): ScanItem {
  return [...rows].sort((left, right) => {
    const timeCompared = String(left.odk_submission_timestamp ?? "").localeCompare(
      String(right.odk_submission_timestamp ?? ""),
    )
    if (timeCompared !== 0) return timeCompared
    return left.odk_instance_id.localeCompare(right.odk_instance_id)
  })[0]
}

function statusBadge(classification: string): string {
  if (classification === "UNMATCHED_TREE") return "border-orange-200 bg-orange-50 text-orange-800"
  if (classification === "DUPLICATE_REVIEW_REQUIRED") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-amber-200 bg-amber-50 text-amber-800"
}

function Pagination({
  page,
  pageCount,
  total,
  unit,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  unit: string
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-between text-xs font-bold">
      <button
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Previous
      </button>
      <span>
        Page {page} of {pageCount} · {total.toLocaleString("en-IN")} {unit}
      </span>
      <button
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
      >
        Next
      </button>
    </div>
  )
}

export function HarvestCycleDuplicateTreeEntries() {
  const [scans, setScans] = useState<ScanSummary[]>([])
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conflictPage, setConflictPage] = useState(1)
  const [errorPage, setErrorPage] = useState(1)
  const [exactPage, setExactPage] = useState(1)

  async function loadScan(scanId: number) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/harvest-sync/scans/${scanId}`, { cache: "no-store" })
      const data = (await response.json()) as ScanResponse & { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? `Harvest Sync scan API returned HTTP ${response.status}.`)
      }
      setScanData(data)
      setSelectedScanId(scanId)
      const dates = [...new Set(data.items.map((item) => displayDate(item.harvest_date)).filter((value) => value !== "—"))]
        .sort()
      setDateFilter((current) => (current && dates.includes(current) ? current : (dates.at(-1) ?? "")))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Harvest Cycle review issues.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    async function bootstrap() {
      try {
        const response = await fetch("/api/admin/harvest-sync/scans", {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = (await response.json()) as { scans?: ScanSummary[]; detail?: string; error?: string }
        if (!response.ok) {
          throw new Error(data.detail ?? data.error ?? `Harvest Sync scan list returned HTTP ${response.status}.`)
        }
        const completedScans = (data.scans ?? []).filter((scan) => scan.status === "SCANNED")
        setScans(completedScans)
        if (completedScans[0]) await loadScan(completedScans[0].id)
        else setLoading(false)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : "Unable to load Harvest Sync scans.")
        setLoading(false)
      }
    }

    void bootstrap()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    setConflictPage(1)
    setErrorPage(1)
    setExactPage(1)
  }, [selectedScanId, dateFilter])

  const selectedItems = useMemo(
    () =>
      (scanData?.items ?? [])
        .filter((item) => !dateFilter || displayDate(item.harvest_date) === dateFilter)
        .sort((left, right) => {
          const treeCompared = naturalTreeCompare(left.original_tree_no, right.original_tree_no)
          if (treeCompared !== 0) return treeCompared
          return String(left.odk_submission_timestamp ?? "").localeCompare(String(right.odk_submission_timestamp ?? ""))
        }),
    [scanData, dateFilter],
  )

  const selectedGroups = useMemo(() => {
    const grouped = new Map<string, ScanItem[]>()
    for (const item of selectedItems) {
      const key = groupKey(item)
      grouped.set(key, [...(grouped.get(key) ?? []), item])
    }
    return [...grouped.entries()]
  }, [selectedItems])

  const conflictingGroups = useMemo(
    () =>
      selectedGroups.filter(([, rows]) => {
        if (rows.length < 2) return false
        const signatures = new Set(rows.map((item) => businessSignature(item, scanData?.scan.cycle_no ?? null)))
        return signatures.size > 1 && rows.some((item) => item.classification === "DUPLICATE_REVIEW_REQUIRED")
      }),
    [scanData, selectedGroups],
  )

  const conflictingGroupKeys = useMemo(
    () => new Set(conflictingGroups.map(([key]) => key)),
    [conflictingGroups],
  )

  const exactAuditGroups = useMemo<ExactAuditGroup[]>(
    () =>
      selectedGroups
        .filter(([, rows]) => {
          if (rows.length < 2) return false
          if (!rows.every((item) => EXACT_AUDIT_CLASSIFICATIONS.has(item.classification))) return false
          return new Set(rows.map((item) => businessSignature(item, scanData?.scan.cycle_no ?? null))).size === 1
        })
        .map(([key, rows]) => {
          const retained =
            rows.find((item) => item.classification === "READY_EXACT_DUPLICATE") ?? earliestSubmission(rows)
          return { key, rows, retained, superseded: rows.filter((item) => item !== retained) }
        }),
    [scanData, selectedGroups],
  )

  const errorRows = useMemo(
    () =>
      selectedItems.filter((item) => {
        if (conflictingGroupKeys.has(groupKey(item))) return false
        if (exactAuditGroups.some((group) => group.key === groupKey(item))) return false
        if (EXPLICIT_ERROR_CLASSIFICATIONS.has(item.classification)) return true
        if (item.classification === "DUPLICATE_REVIEW_REQUIRED") return true
        return !NON_ERROR_CLASSIFICATIONS.has(item.classification)
      }),
    [conflictingGroupKeys, exactAuditGroups, selectedItems],
  )

  const visibleConflicts = conflictingGroups.slice(
    (conflictPage - 1) * GROUP_PAGE_SIZE,
    conflictPage * GROUP_PAGE_SIZE,
  )
  const visibleErrors = errorRows.slice((errorPage - 1) * ERROR_PAGE_SIZE, errorPage * ERROR_PAGE_SIZE)
  const visibleExactGroups = exactAuditGroups.slice(
    (exactPage - 1) * EXACT_PAGE_SIZE,
    exactPage * EXACT_PAGE_SIZE,
  )
  const conflictPageCount = Math.max(1, Math.ceil(conflictingGroups.length / GROUP_PAGE_SIZE))
  const errorPageCount = Math.max(1, Math.ceil(errorRows.length / ERROR_PAGE_SIZE))
  const exactPageCount = Math.max(1, Math.ceil(exactAuditGroups.length / EXACT_PAGE_SIZE))
  const selectedDateOptions = useMemo(
    () =>
      [...new Set((scanData?.items ?? []).map((item) => displayDate(item.harvest_date)).filter((value) => value !== "—"))]
        .sort()
        .reverse(),
    [scanData],
  )

  return (
    <div className="space-y-5">
      <Panel title="Harvest Issue Review Source" icon={History}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Scan
            <select
              aria-label="Harvest Sync Scan"
              value={selectedScanId ?? ""}
              onChange={(event) => void loadScan(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            >
              {scans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  Scan {scan.id} — {scan.scan_ended_at ?? scan.scan_started_at ?? "timestamp unavailable"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Harvest Date
            <select
              aria-label="Harvest Date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            >
              {selectedDateOptions.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p className="rounded-xl border bg-background p-3">
            <span className="block text-xs font-bold uppercase text-muted-foreground">Active Scan ID</span>
            <span className="font-black">{selectedScanId ? `Scan ${selectedScanId}` : "—"}</span>
          </p>
          <p className="rounded-xl border bg-background p-3">
            <span className="block text-xs font-bold uppercase text-muted-foreground">Scan Timestamp</span>
            <span className="font-bold">
              {scanData?.scan.scan_ended_at ?? scanData?.scan.scan_started_at ?? "—"}
            </span>
          </p>
          <p className="rounded-xl border bg-background p-3">
            <span className="block text-xs font-bold uppercase text-muted-foreground">Selected Harvest Date</span>
            <span className="font-black">{dateFilter || "—"}</span>
          </p>
        </div>
        {loading ? <p className="mt-3 text-sm font-semibold text-muted-foreground">Loading persisted scan…</p> : null}
        {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
      </Panel>

      <Panel title="CONFLICTING DUPLICATE TREE ENTRIES — REVIEW REQUIRED" icon={AlertTriangle}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          {conflictingGroups.length.toLocaleString("en-IN")} conflicting groups ·{" "}
          {conflictingGroups.flatMap(([, rows]) => rows).length.toLocaleString("en-IN")} candidate submissions.
          Every material Harvest value is compared within the selected Tree Number/date/cycle group.
        </p>
        <div className="space-y-3">
          {visibleConflicts.map(([key, rows]) => {
            const first = rows[0]
            const decisionRow = rows.find((row) => row.supervisor_decision)
            return (
              <details key={key} className="rounded-xl border bg-background">
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Tree {displayValue(first.original_tree_no)} · {displayDate(first.harvest_date)} · {rows.length} candidate
                  submissions
                  {decisionRow?.selected_effective_instance_id ? " · Supervisor decision saved" : ""}
                </summary>
                <div className="border-t p-4">
                  {decisionRow?.supervisor_decision ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
                      <p className="font-black">Saved supervisor decision: {decisionRow.supervisor_decision}</p>
                      <p className="mt-1">
                        Selected: <span className="font-mono">{decisionRow.selected_effective_instance_id ?? "—"}</span>
                      </p>
                      <p className="mt-1">Reason: {decisionRow.supervisor_reason ?? "—"}</p>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2">Tree Number</th>
                          <th className="p-2">Harvest Date</th>
                          <th className="p-2">ODK Time</th>
                          <th className="p-2">ODK Instance ID</th>
                          <th className="p-2">Submitter / Device</th>
                          <th className="p-2">B1</th>
                          <th className="p-2">B2</th>
                          <th className="p-2">B3</th>
                          <th className="p-2">Bunch Count</th>
                          <th className="p-2">Total Nuts</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Supervisor Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                            <td className="p-2 font-bold">{displayValue(row.original_tree_no)}</td>
                            <td className="p-2">{displayDate(row.harvest_date)}</td>
                            <td className="p-2">{displayValue(row.odk_submission_timestamp)}</td>
                            <td className="p-2 font-mono">{row.odk_instance_id}</td>
                            <td className="p-2">
                              {displayValue(row.submitter_name)} / {displayValue(row.device_id)}
                            </td>
                            <td className="p-2">{displayValue(row.b1)}</td>
                            <td className="p-2">{displayValue(row.b2)}</td>
                            <td className="p-2">{displayValue(row.b3)}</td>
                            <td className="p-2">{displayValue(row.total_bunches)}</td>
                            <td className="p-2">{displayValue(row.total_nuts)}</td>
                            <td className="p-2">
                              <span className={`rounded-full border px-2 py-1 ${statusBadge(row.classification)}`}>
                                {row.classification}
                              </span>
                            </td>
                            <td className="p-2">
                              {row.odk_instance_id === decisionRow?.selected_effective_instance_id
                                ? `Selected${decisionRow.supervisor_reason ? ` — ${decisionRow.supervisor_reason}` : ""}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )
          })}
          {!loading && conflictingGroups.length === 0 ? (
            <p className="rounded-xl border p-3 text-sm text-muted-foreground">
              No conflicting duplicate groups match the selected scan and Harvest date.
            </p>
          ) : null}
        </div>
        <Pagination
          page={conflictPage}
          pageCount={conflictPageCount}
          total={conflictingGroups.length}
          unit="groups"
          onPageChange={setConflictPage}
        />
      </Panel>

      <Panel title="TREE NUMBER / DATA ERRORS — CORRECTION REQUIRED" icon={AlertTriangle}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          {errorRows.length.toLocaleString("en-IN")} unresolved records for the selected scan and Harvest date.
          Tree Numbers are never changed automatically.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b">
                <th className="p-2">Submitted Tree Number</th>
                <th className="p-2">Harvest Date</th>
                <th className="p-2">ODK Time</th>
                <th className="p-2">ODK Instance ID</th>
                <th className="p-2">Submitter / Device</th>
                <th className="p-2">Error Classification</th>
                <th className="p-2">Exact Error Message</th>
                <th className="p-2">Exists in TREE MASTER</th>
                <th className="p-2">Supervisor Decision</th>
              </tr>
            </thead>
            <tbody>
              {visibleErrors.map((row) => (
                <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                  <td className="p-2 font-bold">{displayValue(row.original_tree_no)}</td>
                  <td className="p-2">{displayDate(row.harvest_date)}</td>
                  <td className="p-2">{displayValue(row.odk_submission_timestamp)}</td>
                  <td className="p-2 font-mono">{row.odk_instance_id}</td>
                  <td className="p-2">
                    {displayValue(row.submitter_name)} / {displayValue(row.device_id)}
                  </td>
                  <td className="p-2">
                    <span className={`rounded-full border px-2 py-1 ${statusBadge(row.classification)}`}>
                      {row.classification}
                    </span>
                  </td>
                  <td className="p-2">{displayValue(row.note)}</td>
                  <td className="p-2">{row.tree_exists_in_master ? "Yes" : "No"}</td>
                  <td className="p-2">
                    {row.supervisor_decision
                      ? `${row.supervisor_decision}${row.supervisor_reason ? ` — ${row.supervisor_reason}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && errorRows.length === 0 ? (
          <p className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground">
            No Tree Number or data errors match the selected scan and Harvest date.
          </p>
        ) : null}
        <Pagination
          page={errorPage}
          pageCount={errorPageCount}
          total={errorRows.length}
          unit="records"
          onPageChange={setErrorPage}
        />
      </Panel>

      <details className="rounded-xl border border-border bg-card shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-700" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground sm:text-base">
              EXACT DUPLICATES — AUTOMATICALLY RESOLVED
            </h2>
          </div>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {exactAuditGroups.length.toLocaleString("en-IN")} groups ·{" "}
            {exactAuditGroups.reduce((total, group) => total + group.superseded.length, 0).toLocaleString("en-IN")} source
            submissions superseded. Expand for read-only audit details.
          </p>
        </summary>
        <div className="border-t p-4 sm:p-5">
          <div className="space-y-3">
            {visibleExactGroups.map((group) => (
              <details key={group.key} className="rounded-xl border bg-background">
                <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">
                  Tree {displayValue(group.retained.original_tree_no)} · {displayDate(group.retained.harvest_date)} ·{" "}
                  {group.superseded.length} automatically superseded
                </summary>
                <div className="border-t p-4 text-xs">
                  <p>
                    <span className="font-bold">Retained ODK instance:</span>{" "}
                    <span className="font-mono">{group.retained.odk_instance_id}</span>
                  </p>
                  <p className="mt-1">
                    <span className="font-bold">Reason:</span> Automatically resolved under standing exact-duplicate
                    rule
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2">Disposition</th>
                          <th className="p-2">ODK Instance ID</th>
                          <th className="p-2">Submitter / Device</th>
                          <th className="p-2">ODK Time</th>
                          <th className="p-2">B1</th>
                          <th className="p-2">B2</th>
                          <th className="p-2">B3</th>
                          <th className="p-2">Bunch Count</th>
                          <th className="p-2">Total Nuts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[group.retained, ...group.superseded].map((row) => (
                          <tr key={row.odk_instance_id} className="border-b">
                            <td className="p-2 font-bold">{row === group.retained ? "Retained" : "Superseded"}</td>
                            <td className="p-2 font-mono">{row.odk_instance_id}</td>
                            <td className="p-2">
                              {displayValue(row.submitter_name)} / {displayValue(row.device_id)}
                            </td>
                            <td className="p-2">{displayValue(row.odk_submission_timestamp)}</td>
                            <td className="p-2">{displayValue(row.b1)}</td>
                            <td className="p-2">{displayValue(row.b2)}</td>
                            <td className="p-2">{displayValue(row.b3)}</td>
                            <td className="p-2">{displayValue(row.total_bunches)}</td>
                            <td className="p-2">{displayValue(row.total_nuts)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))}
          </div>
          {!loading && exactAuditGroups.length === 0 ? (
            <p className="rounded-xl border p-3 text-sm text-muted-foreground">
              No automatically resolved exact duplicates match the selected scan and Harvest date.
            </p>
          ) : null}
          <Pagination
            page={exactPage}
            pageCount={exactPageCount}
            total={exactAuditGroups.length}
            unit="groups"
            onPageChange={setExactPage}
          />
        </div>
      </details>
    </div>
  )
}
