"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, RefreshCw, ShieldCheck } from "lucide-react"
import { fetchWorkerV2Comparison } from "@/lib/worker-v2-api"
import { buildWorkerV2Workbook } from "@/lib/worker-v2-excel"
import type { WorkerV2ComparisonResponse, WorkerV2MoneyFields } from "@/lib/worker-v2-types"

function money(value: string | null | undefined) {
  if (value === null || value === undefined) return ""
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function financialCells(values: WorkerV2MoneyFields | null) {
  if (!values) return ["", "", "", ""]
  return [
    money(values.opening_balance),
    money(values.repayment_total),
    money(values.advance_total),
    money(values.closing_balance),
  ]
}

export function WorkerV2Comparison() {
  const [data, setData] = useState<WorkerV2ComparisonResponse | null>(null)
  const [selectedWeek, setSelectedWeek] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWorkerV2Comparison()
      setData(response)
      setSelectedWeek((current) => (
        response.totals.some((item) => item.week_start === current)
          ? current
          : response.totals.at(-1)?.week_start || ""
      ))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Worker V2 comparison could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function initialLoad() {
      try {
        const response = await fetchWorkerV2Comparison()
        if (!active) return
        setData(response)
        setSelectedWeek(response.totals.at(-1)?.week_start || "")
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Worker V2 comparison could not be loaded.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialLoad()
    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(
    () => data?.rows.filter((row) => row.week_start === selectedWeek) ?? [],
    [data, selectedWeek],
  )
  const total = data?.totals.find((item) => item.week_start === selectedWeek) ?? null

  const download = useCallback(() => {
    if (!data || !selectedWeek || !total) return
    const bytes = buildWorkerV2Workbook(data, selectedWeek)
    const blob = new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `worker-v2-comparison-${selectedWeek}.xlsx`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [data, selectedWeek, total])

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] space-y-5 bg-slate-50 p-4 text-slate-950 md:p-7">
      <header className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
              <ShieldCheck className="h-4 w-4" /> Preview-only read comparison
            </div>
            <h1 className="text-2xl font-bold">Worker Management V2 reconciliation</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Synthetic authorised V1-classified fixture values and API-authoritative V2 values are shown side by side. This page has no Save or financial write control.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reload read-only
            </button>
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={!data || !selectedWeek || !total}>
              <Download className="h-4 w-4" /> Excel from API values
            </button>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</div> : null}
      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Reconciliation", data.passed ? "PASS" : "FAIL"],
              ["Balance differences", String(data.balance_differences)],
              ["Duplicates", String(data.duplicate_count)],
              ["Missing / extra", `${data.missing_count} / ${data.extra_count}`],
              ["Unresolved balance", String(data.unresolved_balance_records)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                <div className={`mt-1 text-xl font-bold ${value === "PASS" ? "text-emerald-700" : "text-slate-900"}`}>{value}</div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <label className="flex items-center gap-3 text-sm font-semibold">
                Work week
                <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
                  {data.totals.map((item) => <option key={item.week_start} value={item.week_start}>{item.week_start}</option>)}
                </select>
              </label>
              <div className="font-mono text-xs text-slate-500">Dataset SHA-256: {data.canonical_sha256}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th rowSpan={2} className="border border-slate-700 px-3 py-2 text-left">Code</th>
                    <th rowSpan={2} className="border border-slate-700 px-3 py-2 text-left">Worker</th>
                    <th colSpan={4} className="border border-slate-700 px-3 py-2">V1 classified fixture</th>
                    <th colSpan={4} className="border border-slate-700 px-3 py-2">V2 API</th>
                    <th rowSpan={2} className="border border-slate-700 px-3 py-2">Match</th>
                  </tr>
                  <tr className="bg-slate-800 text-white">
                    {["Opening", "Repayment", "Advance", "Closing", "Opening", "Repayment", "Advance", "Closing"].map((label, index) => <th key={`${label}-${index}`} className="border border-slate-700 px-3 py-2 text-right">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const identity = row.v2 ?? row.v1_classified_fixture
                    return (
                      <tr key={`${row.week_start}-${row.account_code}`} className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-200 px-3 py-2 font-mono">{row.account_code}</td>
                        <td className="border border-slate-200 px-3 py-2">
                          <div className="font-semibold">{identity?.display_name}</div>
                          {!identity?.financial_applicable ? <div className="text-xs text-slate-500">Blank / not applicable</div> : null}
                        </td>
                        {[...financialCells(row.v1_classified_fixture), ...financialCells(row.v2)].map((value, index) => <td key={index} className="border border-slate-200 px-3 py-2 text-right tabular-nums">{value}</td>)}
                        <td className={`border border-slate-200 px-3 py-2 text-center font-bold ${row.matches ? "text-emerald-700" : "text-red-700"}`}>{row.matches ? "YES" : "NO"}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {total ? (
                  <tfoot>
                    <tr className="bg-slate-900 font-bold text-white">
                      <td className="border border-slate-700 px-3 py-3" colSpan={2}>API-provided totals</td>
                      {[...financialCells(total.v1_classified_fixture), ...financialCells(total.v2)].map((value, index) => <td key={index} className="border border-slate-700 px-3 py-3 text-right tabular-nums">{value}</td>)}
                      <td className="border border-slate-700 px-3 py-3 text-center">{total.matches ? "YES" : "NO"}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        </>
      ) : loading ? <div className="rounded-xl border border-slate-200 bg-white p-5">Loading read-only comparison…</div> : null}
    </main>
  )
}
