"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, RefreshCw, Save, ShieldCheck } from "lucide-react"
import {
  closeWorkerV2Week,
  fetchWorkerV2State,
  initializeWorkerV2,
  postWorkerV2FinancialEvent,
  saveWorkerV2Attendance,
} from "@/lib/worker-v2-api"
import { buildWorkerV2Workbook } from "@/lib/worker-v2-excel"
import type { WorkerV2AttendanceEntry, WorkerV2OpeningInput, WorkerV2StateResponse } from "@/lib/worker-v2-types"

const FRESH_START_OPENINGS: WorkerV2OpeningInput[] = ([
  ["1", "-16980.00"], ["2", "-2834.00"], ["3", "-18.00"], ["4", "0.00"],
  ["5", "-23050.00"], ["6", null], ["7", "-6950.00"], ["8", "-13000.00"],
  ["9", "-3000.00"], ["10", null], ["21", "1920.00"], ["WG-CUSTOM-7D02BF6C", "0.00"],
] as const).map(([account_code, opening_balance]) => ({ account_code, opening_balance }))

type FinancialDrafts = Record<string, { repayment: string; advance: string }>
type AttendanceDraft = {
  accountCode: string
  workDate: string
  attendanceValue: NonNullable<WorkerV2AttendanceEntry["attendance_value"]> | ""
  groupCount: string
  wageRate: string
  scheme: NonNullable<WorkerV2AttendanceEntry["scheme_snapshot"]> | ""
  dailyWage: string
}

function money(value: string | null | undefined) {
  if (value === null || value === undefined) return ""
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value))
}

function commandIds(store: React.MutableRefObject<Record<string, { eventId: string; idempotencyKey: string }>>, key: string) {
  store.current[key] ??= { eventId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }
  return store.current[key]
}

export function WorkerV2Comparison() {
  const [data, setData] = useState<WorkerV2StateResponse | null>(null)
  const [selectedWeek, setSelectedWeek] = useState("")
  const [financialDrafts, setFinancialDrafts] = useState<FinancialDrafts>({})
  const [attendance, setAttendance] = useState<AttendanceDraft>({
    accountCode: "", workDate: "2026-08-29", attendanceValue: "", groupCount: "", wageRate: "", scheme: "", dailyWage: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const commandStore = useRef<Record<string, { eventId: string; idempotencyKey: string }>>({})
  const initializationIds = useRef({ initializationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() })
  const closeIds = useRef<Record<string, { eventId: string; idempotencyKey: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWorkerV2State()
      setData(response)
      setSelectedWeek((current) => response.totals.some((item) => item.week_start === current) ? current : response.totals.at(-1)?.week_start || "")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Worker V2 could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => data?.rows.filter((row) => row.week_start === selectedWeek) ?? [], [data, selectedWeek])
  const total = data?.totals.find((item) => item.week_start === selectedWeek) ?? null
  const selectedRow = rows.find((row) => row.account_code === attendance.accountCode) ?? null
  const existingAttendance = data?.attendance_entries.find((row) => row.account_code === attendance.accountCode && row.work_date === attendance.workDate) ?? null
  const weekOpen = rows.at(0)?.week_status === "OPEN"

  const initialize = async () => {
    setBusy("initialize")
    setError(null)
    setNotice(null)
    try {
      await initializeWorkerV2({
        initialization_id: initializationIds.current.initializationId,
        idempotency_key: initializationIds.current.idempotencyKey,
        week_start: "2026-08-29",
        opening_balances: FRESH_START_OPENINGS,
        reason: "Owner-approved Worker V2 fresh start",
      })
      setNotice("Worker V2 was initialized once with the approved API-validated opening total of −₹63,912.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Worker V2 initialization failed safely.")
    } finally {
      setBusy(null)
    }
  }

  const recordFinancial = async (accountCode: string, eventType: "REPAYMENT" | "ADVANCE") => {
    const draft = financialDrafts[accountCode]?.[eventType === "REPAYMENT" ? "repayment" : "advance"] ?? ""
    const amount = Number(draft)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a financial amount greater than zero.")
      return
    }
    const key = `${selectedWeek}:${accountCode}:${eventType}`
    const ids = commandIds(commandStore, key)
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await postWorkerV2FinancialEvent({
        event_id: ids.eventId,
        idempotency_key: ids.idempotencyKey,
        business_key: `V2:OWNER-ENTRY:${selectedWeek}:${accountCode}:${eventType}`,
        account_code: accountCode,
        week_start: selectedWeek,
        event_date: selectedWeek,
        event_type: eventType,
        amount: amount.toFixed(2),
        effect_sign: 1,
        reason: "Owner-entered Worker V2 weekly value",
      })
      setNotice(`${eventType === "ADVANCE" ? "Advance" : "Repayment"} recorded once for account ${accountCode}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Worker V2 financial entry failed safely.")
    } finally {
      setBusy(null)
    }
  }

  const saveAttendance = async () => {
    if (!selectedRow) return setError("Select a Worker V2 account.")
    const wageRate = Number(attendance.wageRate)
    const dailyWage = attendance.dailyWage === "" ? 0 : Number(attendance.dailyWage)
    const groupCount = attendance.groupCount === "" ? 0 : Number(attendance.groupCount)
    if (!Number.isFinite(wageRate) || wageRate <= 0 || !Number.isFinite(dailyWage) || dailyWage < 0 || !Number.isInteger(groupCount) || groupCount < 0) {
      return setError("Wage rate must be positive; daily wage and group count must be zero or positive.")
    }
    const key = `attendance:${attendance.workDate}:${attendance.accountCode}:${existingAttendance?.row_version ?? "new"}`
    const ids = commandIds(commandStore, key)
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await saveWorkerV2Attendance(selectedWeek, {
        attendance_id: existingAttendance?.attendance_id ?? ids.eventId,
        idempotency_key: ids.idempotencyKey,
        account_code: attendance.accountCode,
        work_date: attendance.workDate,
        attendance_value: attendance.attendanceValue || null,
        group_attendee_count: groupCount,
        wage_rate_snapshot: wageRate.toFixed(2),
        scheme_snapshot: attendance.scheme || null,
        daily_wage_amount: dailyWage.toFixed(2),
        expected_row_version: existingAttendance?.row_version ?? null,
      })
      setNotice(`Attendance/wage saved for account ${attendance.accountCode} on ${attendance.workDate}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Worker V2 attendance entry failed safely.")
    } finally {
      setBusy(null)
    }
  }

  const closeWeek = async () => {
    if (!window.confirm(`Close Worker V2 week ${selectedWeek}? Closed weeks cannot be edited.`)) return
    closeIds.current[selectedWeek] ??= { eventId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }
    const ids = closeIds.current[selectedWeek]
    setBusy(`close:${selectedWeek}`)
    setError(null)
    try {
      await closeWorkerV2Week(selectedWeek, { idempotency_key: ids.idempotencyKey, close_event_id: ids.eventId, reason: "Owner-approved Worker V2 weekly close" })
      setNotice(`Week ${selectedWeek} closed atomically; its closing balances are the next week openings.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Worker V2 close failed safely.")
    } finally {
      setBusy(null)
    }
  }

  const download = () => {
    if (!data || !selectedWeek || !total) return
    const bytes = buildWorkerV2Workbook(data, selectedWeek)
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `worker-v2-${selectedWeek}.xlsx`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] space-y-5 bg-slate-50 p-4 text-slate-950 md:p-7">
      <header className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700"><ShieldCheck className="h-4 w-4" /> Preview V2 owner testing</div>
            <h1 className="text-2xl font-bold">Worker Management V2 fresh start</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">V2 starts on 29 Aug 2026. V1 remains the unchanged read-only history. All balances and workbook values below come from the V2 API.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" disabled={loading || busy !== null}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reload</button>
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={!data || !selectedWeek || !total}><Download className="h-4 w-4" /> Excel from API</button>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">{notice}</div> : null}
      {data && !data.initialization.initialized ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold">One-time owner initialization required</h2>
          <p className="mt-1 text-sm">This exact request contains all 12 accounts, keeps Rani and Chitra blank, includes Vijaya and group accounts, and must total −₹63,912. The backend rejects any different table.</p>
          <button type="button" onClick={() => void initialize()} disabled={busy !== null} className="mt-3 rounded-lg bg-amber-900 px-4 py-2 text-sm font-bold text-white">Initialize approved opening once</button>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[["Fresh start", data.initialization.initialized ? "INITIALIZED" : "PENDING"], ["Opening total", money(data.initialization.opening_total)], ["Historical imported", String(data.historical_records_imported)], ["Duplicates", String(data.duplicate_count)], ["Unresolved", String(data.unresolved_balance_records)]].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <label className="flex items-center gap-3 text-sm font-semibold">Work week <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">{data.totals.map((item) => <option key={item.week_start}>{item.week_start}</option>)}</select></label>
              <div className="font-mono text-xs text-slate-500">Dataset SHA-256: {data.canonical_sha256}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="bg-slate-900 text-white">{["Code", "Worker", "Opening", "Repayment", "Advance", "Present", "Earnings", "Owner entry"].map((label) => <th key={label} className="border border-slate-700 px-3 py-2 text-left">{label}</th>)}</tr></thead>
                <tbody>{rows.map((row) => {
                  const draft = financialDrafts[row.account_code] ?? { repayment: "", advance: "" }
                  return <tr key={`${row.week_start}-${row.account_code}`} className="odd:bg-white even:bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2 font-mono">{row.account_code}</td>
                    <td className="border border-slate-200 px-3 py-2"><div className="font-semibold">{row.display_name}</div>{!row.financial_applicable ? <div className="text-xs text-slate-500">Financial fields intentionally blank</div> : null}</td>
                    {[row.opening_balance, row.repayment_total, row.advance_total, row.closing_balance, row.own_earnings].map((value, index) => <td key={index} className="border border-slate-200 px-3 py-2 text-right tabular-nums">{money(value)}</td>)}
                    <td className="border border-slate-200 px-3 py-2">{row.financial_applicable && row.week_status === "OPEN" ? <div className="flex min-w-[280px] gap-2">
                      <input aria-label={`${row.display_name} repayment`} value={draft.repayment} onChange={(event) => setFinancialDrafts((current) => ({ ...current, [row.account_code]: { ...draft, repayment: event.target.value } }))} disabled={row.has_repayment} inputMode="decimal" placeholder={row.has_repayment ? "Recorded" : "Repayment"} className="w-24 rounded border px-2 py-1" />
                      <button type="button" disabled={row.has_repayment || busy !== null} onClick={() => void recordFinancial(row.account_code, "REPAYMENT")} className="rounded border px-2 py-1">Save</button>
                      <input aria-label={`${row.display_name} advance`} value={draft.advance} onChange={(event) => setFinancialDrafts((current) => ({ ...current, [row.account_code]: { ...draft, advance: event.target.value } }))} disabled={row.has_advance} inputMode="decimal" placeholder={row.has_advance ? "Recorded" : "Advance"} className="w-24 rounded border px-2 py-1" />
                      <button type="button" disabled={row.has_advance || busy !== null} onClick={() => void recordFinancial(row.account_code, "ADVANCE")} className="rounded border px-2 py-1">Save</button>
                    </div> : <span className="text-slate-500">{row.week_status === "CLOSED" ? "Closed" : "Not applicable"}</span>}</td>
                  </tr>
                })}</tbody>
                {total ? <tfoot><tr className="bg-slate-900 font-bold text-white"><td colSpan={2} className="border border-slate-700 px-3 py-3">API-provided totals</td>{[total.opening_balance, total.repayment_total, total.advance_total, total.closing_balance, total.own_earnings].map((value, index) => <td key={index} className="border border-slate-700 px-3 py-3 text-right">{money(value)}</td>)}<td className="border border-slate-700" /></tr></tfoot> : null}
              </table>
            </div>
          </section>

          {data.initialization.initialized && weekOpen ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Attendance and wage entry</h2>
            <p className="mt-1 text-sm text-slate-600">Blank attendance, daily wage and count inputs are sent as zero/empty values. Saved totals are reloaded from the API.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-7">
              <select aria-label="Attendance account" value={attendance.accountCode} onChange={(event) => setAttendance((current) => ({ ...current, accountCode: event.target.value }))} className="rounded border px-2 py-2"><option value="">Select worker</option>{rows.map((row) => <option key={row.account_code} value={row.account_code}>{row.display_name}</option>)}</select>
              <input aria-label="Work date" type="date" min={selectedWeek} max={rows.at(0)?.week_end} value={attendance.workDate} onChange={(event) => setAttendance((current) => ({ ...current, workDate: event.target.value }))} className="rounded border px-2 py-2" />
              <select aria-label="Attendance value" value={attendance.attendanceValue} onChange={(event) => setAttendance((current) => ({ ...current, attendanceValue: event.target.value as AttendanceDraft["attendanceValue"] }))} className="rounded border px-2 py-2"><option value="">Blank / zero</option><option value="ABSENT">Absent</option><option value="ONE_THIRD">One third</option><option value="HALF">Half</option><option value="TWO_THIRDS">Two thirds</option><option value="FULL">Full</option></select>
              <input aria-label="Group count" inputMode="numeric" placeholder="Group count (0)" value={attendance.groupCount} onChange={(event) => setAttendance((current) => ({ ...current, groupCount: event.target.value }))} className="rounded border px-2 py-2" />
              <input aria-label="Wage rate" inputMode="decimal" placeholder="Wage rate" value={attendance.wageRate} onChange={(event) => setAttendance((current) => ({ ...current, wageRate: event.target.value }))} className="rounded border px-2 py-2" />
              <input aria-label="Daily wage" inputMode="decimal" placeholder="Daily wage (0)" value={attendance.dailyWage} onChange={(event) => setAttendance((current) => ({ ...current, dailyWage: event.target.value }))} className="rounded border px-2 py-2" />
              <button type="button" onClick={() => void saveAttendance()} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded bg-blue-700 px-3 py-2 font-bold text-white"><Save className="h-4 w-4" /> Save day</button>
            </div>
            {existingAttendance ? <div className="mt-3 text-sm text-slate-600">Existing API row version {existingAttendance.row_version}; saving uses optimistic concurrency.</div> : null}
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => void closeWeek()} disabled={busy !== null} className="rounded bg-red-800 px-4 py-2 text-sm font-bold text-white">Close week atomically</button></div>
          </section> : null}
        </>
      ) : loading ? <div className="rounded-xl border bg-white p-5">Loading Worker V2…</div> : null}
    </main>
  )
}
