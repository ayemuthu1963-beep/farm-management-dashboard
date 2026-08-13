"use client"

import { useMemo, useState } from "react"
import { CalendarRange, Info, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatWholeINR } from "@/lib/worker-management-format"
import { Badge, SectionTitle, WorkerButton } from "./worker-ui"

const workDays = [
  { key: "sat", date: "15.08", day: "Sat" },
  { key: "sun", date: "16.08", day: "Sun" },
  { key: "mon", date: "17.08", day: "Mon" },
  { key: "tue", date: "18.08", day: "Tue" },
  { key: "wed", date: "19.08", day: "Wed" },
  { key: "thu", date: "20.08", day: "Thu" },
  { key: "fri", date: "21.08", day: "Fri" },
] as const

type DayKey = (typeof workDays)[number]["key"]
type EditableAmount = number | ""

type WageRow = {
  id: string
  name: string
  rateNote: string
  custom: boolean
  days: Record<DayKey, EditableAmount>
  wageCashPaid: EditableAmount
  earlierLoanBalance: EditableAmount
  cashPaidInWeek: EditableAmount
}

const workerRates = [
  { name: "Kuppan", fullWage: 400, rateNote: "Full wage ₹400" },
  { name: "Arunan", fullWage: 400, rateNote: "₹400 / ₹266 / ₹133" },
  { name: "Sivan", fullWage: 350, rateNote: "₹350 / ₹233 / ₹116" },
  { name: "Lokesh", fullWage: 300, rateNote: "₹300 / ₹200 / ₹100" },
  { name: "Tiruma", fullWage: 300, rateNote: "₹300 / ₹150" },
  { name: "Rani", fullWage: 300, rateNote: "₹300 / ₹150" },
  { name: "Vijaya", fullWage: 300, rateNote: "₹300 / ₹150" },
  { name: "Mary", fullWage: 300, rateNote: "₹300 / ₹150" },
  { name: "Raja Mani", fullWage: 300, rateNote: "₹300 / ₹150" },
  { name: "Chitra", fullWage: 300, rateNote: "₹300 / ₹150" },
  { name: "Outside Ladies", fullWage: 320, rateNote: "₹320 / ₹160" },
] as const

function fullWeek(fullWage: number): Record<DayKey, number> {
  return Object.fromEntries(workDays.map(({ key }) => [key, fullWage])) as Record<DayKey, number>
}

function blankWeek(): Record<DayKey, ""> {
  return Object.fromEntries(workDays.map(({ key }) => [key, ""])) as Record<DayKey, "">
}

function createInitialRows(): WageRow[] {
  return [
    ...workerRates.map((worker, index) => ({
      id: `worker-${index + 1}`,
      name: worker.name,
      rateNote: worker.rateNote,
      custom: false,
      days: fullWeek(worker.fullWage),
      wageCashPaid: "" as const,
      earlierLoanBalance: "" as const,
      cashPaidInWeek: "" as const,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `custom-${index + 1}`,
      name: "",
      rateNote: `Custom entry ${index + 1}`,
      custom: true,
      days: blankWeek(),
      wageCashPaid: "" as const,
      earlierLoanBalance: "" as const,
      cashPaidInWeek: "" as const,
    })),
  ]
}

function amount(value: EditableAmount) {
  return value === "" ? 0 : value
}

function weekWages(row: WageRow) {
  return workDays.reduce((total, day) => total + amount(row.days[day.key]), 0)
}

function loanRepayment(row: WageRow): number | null {
  if (row.wageCashPaid === "") return null
  return weekWages(row) - amount(row.wageCashPaid)
}

function presentBalance(row: WageRow): number | null {
  const repayment = loanRepayment(row)
  if (repayment === null || row.earlierLoanBalance === "") return null
  return amount(row.earlierLoanBalance) - repayment + amount(row.cashPaidInWeek)
}

function readAmount(rawValue: string): EditableAmount {
  if (rawValue === "") return ""
  const value = Number(rawValue)
  return Number.isFinite(value) ? Math.max(0, value) : ""
}

function MoneyInput({
  value,
  label,
  onChange,
}: {
  value: EditableAmount
  label: string
  onChange: (value: EditableAmount) => void
}) {
  return (
    <div className="relative min-w-24">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        aria-label={label}
        placeholder="—"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(readAmount(event.target.value))}
        className="h-10 w-full rounded-md border border-transparent bg-transparent pl-6 pr-2 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15"
      />
    </div>
  )
}

function CalculatedAmount({ value, signed = false }: { value: number | null; signed?: boolean }) {
  return (
    <span
      className={cn(
        "block whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums",
        signed && value !== null && value < 0 ? "text-red-700" : "text-slate-900",
      )}
    >
      {value === null ? <span className="text-slate-400">—</span> : formatWholeINR(value)}
    </span>
  )
}

export function WeeklyWageTablePreview() {
  const [rows, setRows] = useState<WageRow[]>(createInitialRows)

  const totals = useMemo(
    () => ({
      wages: rows.reduce((total, row) => total + weekWages(row), 0),
      cash: rows.reduce((total, row) => total + amount(row.wageCashPaid), 0),
      advances: rows.reduce((total, row) => total + amount(row.cashPaidInWeek), 0),
    }),
    [rows],
  )

  function updateRow(rowId: string, update: (row: WageRow) => WageRow) {
    setRows((current) => current.map((row) => (row.id === rowId ? update(row) : row)))
  }

  function updateDay(rowId: string, day: DayKey, value: EditableAmount) {
    updateRow(rowId, (row) => ({ ...row, days: { ...row.days, [day]: value } }))
  }

  return (
    <div className="mx-auto w-full max-w-[1880px]">
      <SectionTitle
        eyebrow="Weekly wage sheet"
        title="Worker wages"
        description="Enter or amend each day's wage, then complete the cash and loan columns. Calculated totals update immediately."
        actions={
          <WorkerButton variant="secondary" onClick={() => setRows(createInitialRows())}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset sample
          </WorkerButton>
        }
      />

      <div className="mb-4 flex flex-col gap-3 border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-bold">Static design preview.</span> You can edit every white wage field, but changes are not saved yet.
          </p>
        </div>
        <Badge tone="amber">Operator preview</Badge>
      </div>

      <div className="mb-4 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Week wages</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatWholeINR(totals.wages)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Wage cash entered</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatWholeINR(totals.cash)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Advances entered</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatWholeINR(totals.advances)}</p>
        </div>
      </div>

      <section className="overflow-hidden border border-slate-300 bg-white shadow-sm" aria-label="Weekly worker wage table">
        <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-950 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
              <CalendarRange className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Work week</p>
              <h2 className="text-lg font-bold">15 Aug – 21 Aug 2026</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300">Saturday to Friday · {workerRates.length} workers · 3 custom rows</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1820px] w-full border-collapse text-left">
            <thead className="sticky top-16 z-20 text-xs">
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-30 w-48 min-w-48 border-b border-r border-slate-300 bg-slate-100 px-3 py-3 font-bold uppercase tracking-[0.1em] text-slate-700"
                >
                  Worker name
                </th>
                <th colSpan={7} scope="colgroup" className="border-b border-r border-emerald-300 bg-emerald-700 px-3 py-2 text-center font-bold uppercase tracking-[0.12em] text-white">
                  Daily full wage · operator editable
                </th>
                <th rowSpan={2} scope="col" className="w-32 border-b border-r border-sky-300 bg-sky-700 px-3 py-3 text-center font-bold text-white">
                  Week wages
                  <span className="mt-1 block font-normal text-sky-100">7-day total</span>
                </th>
                <th rowSpan={2} scope="col" className="w-36 border-b border-r border-sky-300 bg-sky-700 px-3 py-3 text-center font-bold text-white">
                  Wage cash paid
                  <span className="mt-1 block font-normal text-sky-100">Enter manually</span>
                </th>
                <th rowSpan={2} scope="col" className="w-36 border-b border-r border-amber-300 bg-amber-600 px-3 py-3 text-center font-bold text-white">
                  To loan repayment
                  <span className="mt-1 block font-normal text-amber-100">Wages less cash</span>
                </th>
                <th rowSpan={2} scope="col" className="w-36 border-b border-r border-amber-300 bg-amber-600 px-3 py-3 text-center font-bold text-white">
                  Earlier loan balance
                  <span className="mt-1 block font-normal text-amber-100">Previous week</span>
                </th>
                <th rowSpan={2} scope="col" className="w-36 border-b border-r border-rose-300 bg-rose-700 px-3 py-3 text-center font-bold text-white">
                  Cash paid in week
                  <span className="mt-1 block font-normal text-rose-100">Advance wages</span>
                </th>
                <th rowSpan={2} scope="col" className="w-36 border-b border-slate-500 bg-slate-800 px-3 py-3 text-center font-bold text-white">
                  Present balance
                  <span className="mt-1 block font-normal text-slate-300">Calculated</span>
                </th>
              </tr>
              <tr>
                {workDays.map((workDay) => (
                  <th
                    key={workDay.key}
                    scope="col"
                    className="w-28 border-b border-r border-emerald-300 bg-emerald-50 px-2 py-2 text-center text-emerald-950"
                  >
                    <span className="block font-bold">{workDay.date}</span>
                    <span className="mt-0.5 block font-medium text-emerald-700">{workDay.day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className={cn("group", row.custom ? "bg-slate-50" : rowIndex % 2 ? "bg-slate-50/60" : "bg-white")}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 border-b border-r border-slate-300 px-3 py-2 align-middle",
                      row.custom ? "bg-slate-100" : rowIndex % 2 ? "bg-slate-50" : "bg-white",
                    )}
                  >
                    {row.custom ? (
                      <input
                        type="text"
                        value={row.name}
                        placeholder={row.rateNote}
                        aria-label={`${row.rateNote} name`}
                        onChange={(event) => updateRow(row.id, (current) => ({ ...current, name: event.target.value }))}
                        className="h-10 w-full rounded-md border border-dashed border-slate-300 bg-white px-2 text-sm font-semibold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                      />
                    ) : (
                      <>
                        <span className="block text-sm font-bold text-slate-950">{row.name}</span>
                        <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{row.rateNote}</span>
                      </>
                    )}
                  </th>
                  {workDays.map((workDay) => (
                    <td key={workDay.key} className="border-b border-r border-slate-200 bg-emerald-50/35 p-1">
                      <MoneyInput
                        value={row.days[workDay.key]}
                        label={`${row.name || row.rateNote}, ${workDay.date} ${workDay.day} wage`}
                        onChange={(value) => updateDay(row.id, workDay.key, value)}
                      />
                    </td>
                  ))}
                  <td className="border-b border-r border-slate-200 bg-sky-50/80">
                    <CalculatedAmount value={weekWages(row)} />
                  </td>
                  <td className="border-b border-r border-slate-200 bg-sky-50/40 p-1">
                    <MoneyInput
                      value={row.wageCashPaid}
                      label={`${row.name || row.rateNote}, wage cash paid`}
                      onChange={(value) => updateRow(row.id, (current) => ({ ...current, wageCashPaid: value }))}
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 bg-amber-50/80">
                    <CalculatedAmount value={loanRepayment(row)} />
                  </td>
                  <td className="border-b border-r border-slate-200 bg-amber-50/40 p-1">
                    <MoneyInput
                      value={row.earlierLoanBalance}
                      label={`${row.name || row.rateNote}, earlier loan balance`}
                      onChange={(value) => updateRow(row.id, (current) => ({ ...current, earlierLoanBalance: value }))}
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 bg-rose-50/50 p-1">
                    <MoneyInput
                      value={row.cashPaidInWeek}
                      label={`${row.name || row.rateNote}, cash paid in week`}
                      onChange={(value) => updateRow(row.id, (current) => ({ ...current, cashPaidInWeek: value }))}
                    />
                  </td>
                  <td className="border-b border-slate-200 bg-slate-100">
                    <CalculatedAmount value={presentBalance(row)} signed />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950 text-white">
                <th scope="row" className="sticky left-0 z-10 border-r border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold">
                  Sheet total
                </th>
                {workDays.map((workDay) => (
                  <td key={workDay.key} className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">
                    {formatWholeINR(rows.reduce((total, row) => total + amount(row.days[workDay.key]), 0))}
                  </td>
                ))}
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.wages)}</td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.cash)}</td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">
                  {formatWholeINR(rows.reduce((total, row) => total + (loanRepayment(row) ?? 0), 0))}
                </td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">
                  {formatWholeINR(rows.reduce((total, row) => total + amount(row.earlierLoanBalance), 0))}
                </td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.advances)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">
                  {formatWholeINR(rows.reduce((total, row) => total + (presentBalance(row) ?? 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Present balance = earlier loan balance − loan repayment + cash advance paid during the week.
      </p>
    </div>
  )
}
