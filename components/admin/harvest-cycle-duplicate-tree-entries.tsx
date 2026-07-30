"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Panel } from "@/components/farm/panel"

const APPROVED_DUPLICATE_SCAN_ID = 5
const DISPLAY_ROW_LIMIT = 80
const DUPLICATE_CLASSIFICATIONS = new Set(["DUPLICATE_REVIEW_REQUIRED", "SUPERSEDED"])

interface DuplicateTreeRow {
  scan_id: number
  odk_instance_id: string
  harvest_date: string | null
  original_tree_no: string
  odk_submission_timestamp: string | null
  b1: number | null
  b2: number | null
  b3: number | null
  total_nuts: number | null
  classification: string
  is_default_effective: boolean
}

interface ScanResponse {
  items?: DuplicateTreeRow[]
}

function displayDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—"
}

function classBadge(classification: string): string {
  if (classification === "SUPERSEDED") {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }
  return "border-rose-200 bg-rose-50 text-rose-700"
}

export function HarvestCycleDuplicateTreeEntries() {
  const [rows, setRows] = useState<DuplicateTreeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRows() {
      try {
        const response = await fetch(`/api/admin/harvest-sync/scans/${APPROVED_DUPLICATE_SCAN_ID}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Duplicate Tree Entries API returned HTTP ${response.status}.`)
        }
        const data = (await response.json()) as ScanResponse
        const duplicateRows = (data.items ?? [])
          .filter((row) => DUPLICATE_CLASSIFICATIONS.has(row.classification))
          .slice(0, DISPLAY_ROW_LIMIT)
        setRows(duplicateRows)
        setError(null)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : "Unable to load Duplicate Tree Entries.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadRows()
    return () => controller.abort()
  }, [])

  return (
    <Panel title="Duplicate Tree Entries" icon={AlertTriangle}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="p-2">Date</th>
              <th className="p-2">Tree</th>
              <th className="p-2">ODK Time</th>
              <th className="p-2">B1</th>
              <th className="p-2">B2</th>
              <th className="p-2">B3</th>
              <th className="p-2">Nuts</th>
              <th className="p-2">Status</th>
              <th className="p-2">Default Latest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.scan_id}-${row.odk_instance_id}`} className="border-b">
                <td className="p-2">{displayDate(row.harvest_date)}</td>
                <td className="p-2 font-bold">{row.original_tree_no}</td>
                <td className="p-2">{row.odk_submission_timestamp ?? "—"}</td>
                <td className="p-2">{row.b1}</td>
                <td className="p-2">{row.b2}</td>
                <td className="p-2">{row.b3}</td>
                <td className="p-2">{row.total_nuts}</td>
                <td className="p-2">
                  <span className={`rounded-full border px-2 py-1 ${classBadge(row.classification)}`}>
                    {row.classification}
                  </span>
                </td>
                <td className="p-2">{row.is_default_effective ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <p className="mt-3 text-xs font-semibold text-muted-foreground">Loading duplicate tree entries…</p> : null}
      {error ? <p className="mt-3 text-xs font-semibold text-destructive">{error}</p> : null}
    </Panel>
  )
}
