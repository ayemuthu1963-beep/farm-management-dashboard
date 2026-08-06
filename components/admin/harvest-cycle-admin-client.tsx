"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertTriangle, CalendarRange, CheckCircle2, CircleDollarSign, History, LockKeyhole, RefreshCw, ShieldCheck, Sprout } from "lucide-react"
import { Panel } from "@/components/farm/panel"

export interface HarvestCycleSummary {
  harvestCycle: string
  harvestStartDate: string
  harvestEndDate: string | null
  harvestStatus: string
  totalSaleValue: number | null
  totalTreesHarvested: number | null
  totalBunches: number | null
  totalNuts: number | null
  salePricePerNut: number | null
}

interface Props {
  cycles: HarvestCycleSummary[]
  latestCycle: HarvestCycleSummary | null
  openCycle: HarvestCycleSummary | null
  lastClosedCycle: HarvestCycleSummary | null
}

interface ValidationResult {
  ok: boolean
  message: string
  details: string[]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isNonNegativeNumericText(value: string): boolean {
  if (!value.trim()) return true
  return /^\d+(\.\d+)?$/.test(value.trim()) && Number(value) >= 0
}

function latestCycleEndDate(cycles: HarvestCycleSummary[]): string | null {
  const endDates = cycles.map((cycle) => cycle.harvestEndDate).filter((value): value is string => Boolean(value))
  return endDates.length > 0 ? endDates.sort().at(-1) ?? null : null
}

function nextCycleNumber(cycles: HarvestCycleSummary[]): string {
  const numericCycles = cycles
    .map((cycle) => Number(cycle.harvestCycle))
    .filter((cycle) => Number.isInteger(cycle) && cycle > 0)
  return String((numericCycles.length > 0 ? Math.max(...numericCycles) : 0) + 1)
}

function nextCycleStartDate(cycles: HarvestCycleSummary[]): string {
  const latestEnd = latestCycleEndDate(cycles)
  if (!latestEnd) return ""
  const nextDay = new Date(`${latestEnd}T00:00:00Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  return nextDay.toISOString().slice(0, 10)
}

function StatusCard({ title, cycle, icon: Icon }: { title: string; cycle: HarvestCycleSummary | null; icon: typeof CalendarRange }) {
  return (
    <div className="rounded-2xl border border-border bg-[#fffdf2] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{title}</p>
          <h2 className="text-xl font-extrabold text-foreground">{cycle ? `Cycle ${cycle.harvestCycle}` : "—"}</h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Status</p>
          <p className="font-extrabold text-primary">{cycle?.harvestStatus ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Sale Value</p>
          <p className="font-extrabold text-foreground">{formatCurrency(cycle?.totalSaleValue)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Start Date</p>
          <p className="font-semibold text-foreground">{formatDate(cycle?.harvestStartDate)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">End Date</p>
          <p className="font-semibold text-foreground">{formatDate(cycle?.harvestEndDate)}</p>
        </div>
      </div>
    </div>
  )
}

function ResultBox({ result }: { result: ValidationResult | null }) {
  if (!result) return null
  return (
    <div className={`rounded-xl border p-4 text-sm ${result.ok ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      <div className="flex items-start gap-2">
        {result.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
        <div>
          <p className="font-extrabold">{result.message}</p>
          {result.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export function HarvestCycleAdminClient({ cycles, latestCycle, openCycle, lastClosedCycle }: Props) {
  const [openResult, setOpenResult] = useState<ValidationResult | null>(null)
  const [closeResult, setCloseResult] = useState<ValidationResult | null>(null)
  const [saleResult, setSaleResult] = useState<ValidationResult | null>(null)
  const [cycleNo, setCycleNo] = useState(() => nextCycleNumber(cycles))
  const [startDate, setStartDate] = useState(() => nextCycleStartDate(cycles))
  const [openRemarks, setOpenRemarks] = useState("")
  const [isSavingOpen, setIsSavingOpen] = useState(false)
  const [isSavingClose, setIsSavingClose] = useState(false)
  const [isSavingSale, setIsSavingSale] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()

  const cycleMap = useMemo(() => new Map(cycles.map((cycle) => [cycle.harvestCycle, cycle])), [cycles])

  function validateOpenCycle(): string[] {
    const errors: string[] = []
    const trimmedCycleNo = cycleNo.trim()
    const trimmedStartDate = startDate.trim()

    if (!trimmedCycleNo) errors.push("Harvest Cycle No is required.")
    if (trimmedCycleNo && !/^\d+$/.test(trimmedCycleNo)) errors.push("Harvest Cycle No must be a positive integer.")
    if (trimmedCycleNo && /^\d+$/.test(trimmedCycleNo) && Number(trimmedCycleNo) <= 0) errors.push("Harvest Cycle No must be a positive integer.")
    if (trimmedCycleNo && cycleMap.has(trimmedCycleNo)) errors.push(`Harvest Cycle ${trimmedCycleNo} already exists.`)
    if (!trimmedStartDate) errors.push("Harvest Start Date is required.")
    if (trimmedStartDate && !isValidDate(trimmedStartDate)) errors.push("Harvest Start Date is not a valid date.")
    if (openCycle) errors.push(`Cannot open new cycle while Cycle ${openCycle.harvestCycle} is still Open.`)
    if (trimmedStartDate && isValidDate(trimmedStartDate)) {
      const overlapping = cycles.find((cycle) => {
        if (!cycle.harvestEndDate) return trimmedStartDate >= cycle.harvestStartDate
        return trimmedStartDate >= cycle.harvestStartDate && trimmedStartDate <= cycle.harvestEndDate
      })
      if (overlapping) {
        errors.push(`Date range overlaps existing Cycle ${overlapping.harvestCycle} (${formatDate(overlapping.harvestStartDate)} to ${formatDate(overlapping.harvestEndDate)}).`)
      }
      const latestEnd = latestCycleEndDate(cycles)
      if (latestEnd && trimmedStartDate <= latestEnd) {
        errors.push(`Harvest Start Date must be after the previous cycle End Date (${formatDate(latestEnd)}).`)
      }
    }

    return errors
  }

  async function saveOpenCycle() {
    const errors = validateOpenCycle()

    if (errors.length > 0) {
      setOpenResult({ ok: false, message: "Open New Harvest Cycle validation failed. No database write was performed.", details: errors })
      return
    }

    setIsSavingOpen(true)
    setOpenResult(null)
    try {
      const response = await fetch("/api/admin/harvest-cycle/open", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cycle_no: Number(cycleNo.trim()),
          start_date: startDate.trim(),
          remarks: openRemarks.trim() || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors.map(String) : [data?.message ?? "Harvest cycle was not opened."]
        setOpenResult({ ok: false, message: "Open New Harvest Cycle save failed.", details: apiErrors })
        return
      }
      setOpenResult({
        ok: true,
        message: "Open New Harvest Cycle saved.",
        details: [`Cycle ${cycleNo.trim()} was opened in Preview without an End Date.`, "No harvest records were changed."],
      })
      startRefresh(() => window.location.reload())
    } catch (error) {
      setOpenResult({
        ok: false,
        message: "Open New Harvest Cycle save failed.",
        details: [error instanceof Error ? error.message : "Unknown save error."],
      })
    } finally {
      setIsSavingOpen(false)
    }
  }

  async function saveCloseCycle(formData: FormData) {
    const closeCycleNo = String(formData.get("close_cycle_no") ?? "").trim()
    const closeEndDate = String(formData.get("close_end_date") ?? "").trim()
    const saleValue = String(formData.get("close_sale_value") ?? "").trim()
    const remarks = String(formData.get("close_remarks") ?? "").trim()
    const errors: string[] = []
    const cycle = cycleMap.get(closeCycleNo)

    if (!closeCycleNo) errors.push("Harvest Cycle No is required.")
    if (closeCycleNo && !cycle) errors.push(`Harvest Cycle ${closeCycleNo} does not exist.`)
    if (cycle && cycle.harvestStatus !== "Open") errors.push(`Harvest Cycle ${closeCycleNo} is not currently Open.`)
    if (!closeEndDate) errors.push("Harvest End Date is required.")
    if (closeEndDate && !isValidDate(closeEndDate)) errors.push("Harvest End Date is not a valid date.")
    if (cycle && closeEndDate && isValidDate(closeEndDate) && closeEndDate < cycle.harvestStartDate) {
      errors.push("Harvest End Date cannot be before Harvest Start Date.")
    }
    if (saleValue && !isNonNegativeNumericText(saleValue)) errors.push("Total Sale Value must be numeric and cannot be negative.")

    if (errors.length > 0) {
      setCloseResult({ ok: false, message: "Close Current Harvest Cycle validation failed. No database write was performed.", details: errors })
      return
    }

    setIsSavingClose(true)
    setCloseResult(null)
    try {
      const response = await fetch("/api/admin/harvest-cycle/close", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          harvest_cycle: closeCycleNo,
          harvest_end_date: closeEndDate,
          total_sale_value: saleValue || null,
          remarks: remarks || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors.map(String) : [data?.message ?? "Harvest cycle was not closed."]
        setCloseResult({ ok: false, message: "Close Current Harvest Cycle save failed.", details: apiErrors })
        return
      }
      setCloseResult({
        ok: true,
        message: "Close Current Harvest Cycle saved.",
        details: [`Cycle ${closeCycleNo} was marked Locked.`, "Preview database was updated."],
      })
      startRefresh(() => window.location.reload())
    } catch (error) {
      setCloseResult({
        ok: false,
        message: "Close Current Harvest Cycle save failed.",
        details: [error instanceof Error ? error.message : "Unknown save error."],
      })
    } finally {
      setIsSavingClose(false)
    }
  }

  async function saveSaleDetails(formData: FormData) {
    const saleCycleNo = String(formData.get("sale_cycle_no") ?? "").trim()
    const saleValue = String(formData.get("sale_value") ?? "").trim()
    const remarks = String(formData.get("sale_remarks") ?? "").trim()
    const errors: string[] = []

    if (!saleCycleNo) errors.push("Harvest Cycle No is required.")
    if (saleCycleNo && !cycleMap.has(saleCycleNo)) errors.push(`Harvest Cycle ${saleCycleNo} does not exist.`)
    if (!saleValue) errors.push("Total Sale Value is required.")
    if (saleValue && !isNonNegativeNumericText(saleValue)) errors.push("Total Sale Value must be numeric and cannot be negative.")

    if (errors.length > 0) {
      setSaleResult({ ok: false, message: "Update Sale Details validation failed. No database write was performed.", details: errors })
      return
    }

    setIsSavingSale(true)
    setSaleResult(null)
    try {
      const response = await fetch("/api/admin/harvest-cycle/sale-details", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          harvest_cycle: saleCycleNo,
          total_sale_value: saleValue,
          remarks: remarks || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors.map(String) : [data?.message ?? "Sale details were not saved."]
        setSaleResult({ ok: false, message: "Update Sale Details save failed.", details: apiErrors })
        return
      }
      setSaleResult({
        ok: true,
        message: "Update Sale Details saved.",
        details: [`Cycle ${saleCycleNo} total sale value and remarks were updated.`, "Preview database was updated."],
      })
      startRefresh(() => window.location.reload())
    } catch (error) {
      setSaleResult({
        ok: false,
        message: "Update Sale Details save failed.",
        details: [error instanceof Error ? error.message : "Unknown save error."],
      })
    } finally {
      setIsSavingSale(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-black uppercase tracking-wide">Preview database write enabled</p>
            <p className="mt-1 font-semibold">New Harvest Cycles created here are saved only to the MFMS Preview database.</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide">Production is not targeted by this workflow.</p>
          </div>
        </div>
      </section>

      <Panel title="Current Harvest Cycle Status" icon={CalendarRange}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <StatusCard title="Latest Harvest Cycle" cycle={latestCycle} icon={CalendarRange} />
          <StatusCard title="Current Open Cycle" cycle={openCycle} icon={Sprout} />
          <StatusCard title="Last Closed Cycle" cycle={lastClosedCycle} icon={LockKeyhole} />
          <div className="rounded-2xl border border-border bg-[#fffdf2] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CircleDollarSign className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Total Cycles</p>
                <h2 className="text-3xl font-extrabold text-foreground">{cycles.length}</h2>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Sale Price per Nut is derived from cycle summary where nuts and sale value are available.</p>
              <p className="mt-1 font-semibold text-foreground">Latest sale price: {formatNumber(latestCycle?.salePricePerNut)}</p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Open New Harvest Cycle" icon={Sprout}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-foreground">
              Harvest Cycle No *
              <input value={cycleNo} onChange={(event) => setCycleNo(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Harvest Start Date *
              <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Remarks
              <input value={openRemarks} onChange={(event) => setOpenRemarks(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
          </div>
          <button type="button" onClick={() => void saveOpenCycle()} disabled={isSavingOpen || isRefreshing} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
            {isSavingOpen || isRefreshing ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : null}
            {isSavingOpen ? "Opening Cycle..." : "Open New Cycle"}
          </button>
          <ResultBox result={openResult} />
        </div>
      </Panel>

      <Panel title="Close Current Harvest Cycle" icon={LockKeyhole}>
        <form action={saveCloseCycle} className="space-y-4">
          {!openCycle ? (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold text-muted-foreground">
              No Harvest Cycle is currently Open. Open the next cycle before using this form.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-foreground">
              Harvest Cycle No *
              <input name="close_cycle_no" inputMode="numeric" defaultValue={openCycle?.harvestCycle ?? ""} disabled={!openCycle} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Harvest End Date *
              <input name="close_end_date" type="date" disabled={!openCycle} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Total Sale Value
              <input name="close_sale_value" inputMode="decimal" disabled={!openCycle} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <label className="text-sm font-bold text-foreground md:col-span-2">
              Remarks
              <input name="close_remarks" disabled={!openCycle} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
          </div>
          <button type="submit" disabled={!openCycle || isSavingClose || isRefreshing} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
            {isSavingClose ? "Closing Cycle..." : "Close Current Cycle"}
          </button>
          <ResultBox result={closeResult} />
        </form>
      </Panel>

      <Panel title="Update Sale Details" icon={CircleDollarSign}>
        <form action={saveSaleDetails} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-foreground">
              Harvest Cycle No *
              <input name="sale_cycle_no" inputMode="numeric" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Total Sale Value *
              <input name="sale_value" inputMode="decimal" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="text-sm font-bold text-foreground">
              Remarks
              <input name="sale_remarks" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
          </div>
          <button type="submit" disabled={isSavingSale || isRefreshing} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
            {isSavingSale ? "Saving Sale Details..." : "Save Sale Details"}
          </button>
          <ResultBox result={saleResult} />
        </form>
      </Panel>

      <Panel title="Harvest Cycle History" icon={History}>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Read-only dates, status, harvest totals and sale details for every recorded Harvest Cycle.
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[980px] text-left text-xs">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className="p-3">Cycle</th>
                <th className="p-3">Start Date</th>
                <th className="p-3">End Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Trees</th>
                <th className="p-3 text-right">Bunches</th>
                <th className="p-3 text-right">Nuts</th>
                <th className="p-3 text-right">Sale Value</th>
                <th className="p-3 text-right">Sale Price / Nut</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.harvestCycle} className="border-b last:border-b-0">
                  <td className="p-3 font-black">{cycle.harvestCycle}</td>
                  <td className="p-3">{formatDate(cycle.harvestStartDate)}</td>
                  <td className="p-3">{formatDate(cycle.harvestEndDate)}</td>
                  <td className="p-3">
                    <span className="rounded-full border px-2 py-1 font-bold">{cycle.harvestStatus}</span>
                  </td>
                  <td className="p-3 text-right">{formatNumber(cycle.totalTreesHarvested)}</td>
                  <td className="p-3 text-right">{formatNumber(cycle.totalBunches)}</td>
                  <td className="p-3 text-right">{formatNumber(cycle.totalNuts)}</td>
                  <td className="p-3 text-right">{formatCurrency(cycle.totalSaleValue)}</td>
                  <td className="p-3 text-right">{formatNumber(cycle.salePricePerNut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cycles.length === 0 ? (
          <p className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground">No Harvest Cycle history is available.</p>
        ) : null}
      </Panel>
    </div>
  )
}
