"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarRange, Database, Download, Info, LoaderCircle, Printer, RefreshCw, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  addWageRate,
  createAccount,
  createLedgerTransaction,
  fetchAccounts,
  fetchCurrentWeek,
  fetchDailyWages,
  fetchSettlements,
  fetchWorkWeeks,
  saveDailyWageBatch,
  updateAccount,
  updateWeeklyPayment,
  WorkerApiError,
} from "@/lib/worker-management-api"
import {
  buildWageWeekOptions,
  formatWholeINR,
  normaliseWeeklyWageEntry,
  saturdayForDate,
  toDateInput,
  wageDaySlots,
  type WageDayKey,
  type WageWeekId,
} from "@/lib/worker-management-format"
import { MOVED_WAGE_PLACEHOLDER_NOTE } from "@/lib/worker-management-constants"
import {
  isDependentWorkerAccount,
  pairedDependentAccountCode,
} from "@/lib/worker-balance-relationships"
import {
  approvedWorkerRoster,
  compareApprovedWorkerRoster,
} from "@/lib/worker-management-roster"
import {
  buildWorkerWageWorkbook,
  calculateWageSheetTotals,
  WORKER_WAGE_TOTAL_LABEL,
  type WageWorkbookCell,
} from "@/lib/worker-wage-excel"
import type { DailyWageResponse, FarmScheme, SettlementRow, WorkerAccount, WorkWeek } from "@/lib/worker-management-types"
import { Badge, SectionTitle, WorkerButton } from "./worker-ui"

const daySlots = wageDaySlots
type DayKey = WageDayKey
type EditableAmount = number | ""

type WageRow = {
  id: string
  accountId: number | null
  accountCode: string | null
  accountType: "FARM" | "OUTSIDE" | "GROUP"
  accountRowVersion: number | null
  farmScheme: FarmScheme | null
  name: string
  loadedName: string
  rateNote: string
  baseWage: EditableAmount
  loadedBaseWage: EditableAmount
  reference: string
  loadedReference: string
  custom: boolean
  group: boolean
  days: Record<DayKey, EditableAmount>
  dailyRowVersions: Record<DayKey, number | null>
  labourers: Record<DayKey, EditableAmount>
  loanPayment: EditableAmount
  earlierLoanBalance: EditableAmount
  cashPaidInWeek: EditableAmount
  loadedCashPaidInWeek: number
  settlementRowVersion: number | null
}

const workerRates = approvedWorkerRoster

function blankWeek(): Record<DayKey, ""> {
  return Object.fromEntries(daySlots.map(({ key }) => [key, ""])) as Record<DayKey, "">
}

function emptyVersions(): Record<DayKey, null> {
  return Object.fromEntries(daySlots.map(({ key }) => [key, null])) as Record<DayKey, null>
}

function createInitialRows(): WageRow[] {
  return [
    ...workerRates.map((worker, index): WageRow => {
      const group = worker.name === "Outside Ladies"
      return {
        id: `worker-${index + 1}`,
        accountId: null,
        accountCode: null,
        accountType: group ? "GROUP" : "FARM",
        accountRowVersion: null,
        farmScheme: group ? null : "THREE_OPTION",
        name: worker.name,
        loadedName: worker.name,
        rateNote: worker.rateNote,
        baseWage: worker.fullWage,
        loadedBaseWage: worker.fullWage,
        reference: "",
        loadedReference: "",
        custom: false,
        group,
        days: blankWeek(),
        dailyRowVersions: emptyVersions(),
        labourers: blankWeek(),
        loanPayment: "" as const,
        earlierLoanBalance: "" as const,
        cashPaidInWeek: "" as const,
        loadedCashPaidInWeek: 0,
        settlementRowVersion: null,
      }
    }),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `custom-${index + 1}`,
      accountId: null,
      accountCode: null,
      accountType: "GROUP" as const,
      accountRowVersion: null,
      farmScheme: null,
      name: "",
      loadedName: "",
      rateNote: `Custom entry ${index + 1}`,
      baseWage: "" as const,
      loadedBaseWage: "" as const,
      reference: "",
      loadedReference: "",
      custom: true,
      group: true,
      days: blankWeek(),
      dailyRowVersions: emptyVersions(),
      labourers: blankWeek(),
      loanPayment: "" as const,
      earlierLoanBalance: "" as const,
      cashPaidInWeek: "" as const,
      loadedCashPaidInWeek: 0,
      settlementRowVersion: null,
    })),
  ]
}

function amount(value: EditableAmount) {
  return value === "" ? 0 : value
}

function groupDayWage(row: WageRow, day: DayKey): number | null {
  if (row.days[day] === "" || row.labourers[day] === "") return null
  return amount(row.days[day]) * amount(row.labourers[day])
}

function dailyWage(row: WageRow, day: DayKey) {
  return row.group ? (groupDayWage(row, day) ?? 0) : amount(row.days[day])
}

function weekWages(row: WageRow) {
  return daySlots.reduce((total, day) => total + dailyWage(row, day.key), 0)
}

function isDependentWorker(row: WageRow) {
  return isDependentWorkerAccount(row.accountCode)
}

function pairedDependent(rows: WageRow[], row: WageRow): WageRow | null {
  const dependentCode = pairedDependentAccountCode(row.accountCode)
  return dependentCode ? rows.find((candidate) => candidate.accountCode === dependentCode) ?? null : null
}

function combinedWeekWages(row: WageRow, dependent: WageRow | null = null) {
  return weekWages(row) + (dependent ? weekWages(dependent) : 0)
}

function wageToBePaid(row: WageRow, dependent: WageRow | null = null) {
  return Math.max(0, combinedWeekWages(row, dependent) - amount(row.loanPayment))
}

function presentBalance(row: WageRow): number | null {
  if (row.earlierLoanBalance === "") return null
  return amount(row.earlierLoanBalance) + amount(row.loanPayment) - amount(row.cashPaidInWeek)
}

function readAmount(rawValue: string | number | null | undefined): EditableAmount {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return ""
  const value = Number(rawValue)
  return Number.isFinite(value) ? Math.max(0, value) : ""
}

function readWholeAmountInput(rawValue: string): EditableAmount | null {
  if (rawValue === "") return ""
  if (!/^\d+$/.test(rawValue)) return null
  const value = Number(rawValue)
  return Number.isSafeInteger(value) ? value : null
}

function updateWholeAmount(rawValue: string, onChange: (value: EditableAmount) => void) {
  const value = readWholeAmountInput(rawValue)
  if (value !== null) onChange(value)
}

function MoneyInput({
  value,
  label,
  compact = false,
  tone = "black",
  negative = false,
  disabled = false,
  onChange,
}: {
  value: EditableAmount
  label: string
  compact?: boolean
  tone?: "black" | "green" | "red"
  negative?: boolean
  disabled?: boolean
  onChange: (value: EditableAmount) => void
}) {
  return (
    <div className="relative min-w-0">
      <span
        className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold",
          tone === "green" && "text-emerald-600",
          tone === "red" && "text-red-700",
          tone === "black" && "text-slate-500",
        )}
      >
        {negative && value !== "" ? "−₹" : "₹"}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-label={label}
        placeholder="—"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => updateWholeAmount(event.target.value, onChange)}
        className={cn(
          "h-10 w-full rounded-md border border-transparent bg-transparent pr-2 text-right font-semibold tabular-nums outline-none transition hover:border-slate-300 hover:bg-white focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent",
          negative ? "pl-9" : "pl-6",
          tone === "green" && "text-emerald-700",
          tone === "red" && "text-red-700",
          tone === "black" && "text-slate-950",
          compact ? "text-xs" : "text-sm",
        )}
      />
    </div>
  )
}

function LabourCountInput({
  value,
  label,
  disabled = false,
  onChange,
}: {
  value: EditableAmount
  label: string
  disabled?: boolean
  onChange: (value: EditableAmount) => void
}) {
  return (
    <label className="block min-w-0 px-1 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700">
      No
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-label={label}
        placeholder="0"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => updateWholeAmount(event.target.value, onChange)}
        className="mt-1 h-10 w-full rounded-md border border-violet-200 bg-white px-2 text-right text-xs font-bold tabular-nums text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
    </label>
  )
}

function CalculatedAmount({
  value,
  tone = "black",
  negative = false,
}: {
  value: number | null
  tone?: "black" | "green" | "red"
  negative?: boolean
}) {
  const displayedValue = value === null ? null : negative ? -Math.abs(value) : value
  return (
    <span
      className={cn(
        "block whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums",
        tone === "green" && "text-emerald-700",
        tone === "red" && "text-red-700",
        tone === "black" && "text-slate-950",
      )}
    >
      {displayedValue === null ? <span className="text-slate-400">—</span> : formatWholeINR(displayedValue)}
    </span>
  )
}

function SignedCalculatedAmount({ value }: { value: number | null }) {
  const display = value === null ? null : value > 0 ? `+${formatWholeINR(value)}` : formatWholeINR(value)
  return (
    <span
      className={cn(
        "block whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums",
        value !== null && value < 0 && "text-red-700",
        value !== null && value > 0 && "text-emerald-700",
        value === 0 && "text-slate-950",
      )}
    >
      {display === null ? <span className="text-slate-400">—</span> : display}
    </span>
  )
}

function CombinedWeekWage({ value, addend }: { value: number; addend: number | null }) {
  if (addend === null) return <CalculatedAmount value={value} tone="green" />
  return (
    <span className="block px-2 py-2 text-right text-xs font-bold tabular-nums text-emerald-700">
      <span className="block">{formatWholeINR(value)}</span>
      <span className="block">+ {formatWholeINR(addend)}</span>
      <span className="mt-1 block border-t border-sky-200 pt-1">= {formatWholeINR(value + addend)}</span>
    </span>
  )
}

function databaseRows(
  accounts: WorkerAccount[],
  dailyResponses: DailyWageResponse[],
  settlements: SettlementRow[],
): WageRow[] {
  const settlementByAccount = new Map(settlements.map((row) => [row.account_id, row]))
  const sortedAccounts = [...accounts].sort(compareApprovedWorkerRoster)

  const persisted = sortedAccounts.map((account): WageRow => {
    const group = account.account_type === "GROUP"
    const custom = account.account_code.startsWith("WG-CUSTOM-")
    const entries = Object.fromEntries(
      daySlots.map((day, index) => [
        day.key,
        dailyResponses[index]?.items.find((item) => item.account_id === account.account_id) ?? null,
      ]),
    ) as Record<DayKey, DailyWageResponse["items"][number] | null>
    const firstAvailableRate = dailyResponses[0]?.available_accounts.find(
      (item) => item.account_id === account.account_id,
    )?.daily_rate
    const baseWage = readAmount(
      entries.sat?.wage_rate_snapshot ?? firstAvailableRate ?? account.daily_rate ?? "",
    )
    const settlement = settlementByAccount.get(account.account_id)
    const signedCash = Number(settlement?.cash_paid_during_week ?? 0)
    const currentSignedBalance = Number(settlement?.current_signed_balance ?? account.signed_balance ?? 0)
    const openingSignedBalance = Number(settlement?.opening_signed_balance ?? currentSignedBalance - signedCash)
    const cashPaid = Math.max(0, -signedCash)

    return {
      id: `account-${account.account_id}`,
      accountId: account.account_id,
      accountCode: account.account_code,
      accountType: account.account_type,
      accountRowVersion: account.row_version,
      farmScheme: account.farm_scheme,
      name: custom && /^Custom entry \d+$/i.test(account.display_name) ? "" : account.display_name,
      loadedName: account.display_name,
      rateNote: custom ? account.display_name : `Full wage ${formatWholeINR(baseWage)}`,
      baseWage,
      loadedBaseWage: baseWage,
      reference: account.operator_reference ?? "",
      loadedReference: account.operator_reference ?? "",
      custom,
      group,
      days: Object.fromEntries(
        daySlots.map((day) => {
          const entry = entries[day.key]
          const entered = Boolean(
            entry &&
              !entry.is_default &&
              entry.notes !== MOVED_WAGE_PLACEHOLDER_NOTE &&
              (group ? entry.group_attendee_count !== null : entry.attendance_value !== null),
          )
          return [
            day.key,
            entered
              ? !group && entry?.attendance_value === "ABSENT"
                ? 0
                : readAmount(
                    group
                      ? entry?.wage_rate_snapshot ?? baseWage
                      : entry?.daily_wage_amount ?? baseWage,
                  )
              : "",
          ]
        }),
      ) as Record<DayKey, EditableAmount>,
      dailyRowVersions: Object.fromEntries(
        daySlots.map((day) => [day.key, entries[day.key]?.row_version ?? null]),
      ) as Record<DayKey, number | null>,
      labourers: Object.fromEntries(
        daySlots.map((day) => {
          const entry = entries[day.key]
          const entered = Boolean(
            entry &&
              !entry.is_default &&
              entry.notes !== MOVED_WAGE_PLACEHOLDER_NOTE &&
              entry.group_attendee_count !== null,
          )
          return [day.key, group && entered ? entry?.group_attendee_count ?? "" : ""]
        }),
      ) as Record<DayKey, EditableAmount>,
      loanPayment: "",
      earlierLoanBalance: openingSignedBalance,
      cashPaidInWeek: cashPaid || "",
      loadedCashPaidInWeek: cashPaid,
      settlementRowVersion: settlement?.row_version ?? null,
    }
  })

  const populated = persisted.map((row) => {
    if (isDependentWorker(row)) return row
    const settlement = row.accountId === null ? null : settlementByAccount.get(row.accountId)
    if (!settlement || settlement.settlement_id === null) return row
    const dependent = pairedDependent(persisted, row)
    return {
      ...row,
      loanPayment: Math.max(0, combinedWeekWages(row, dependent) - Number(settlement.weekly_payment)),
    }
  })

  const customCount = populated.filter((row) => row.custom).length
  return [
    ...populated,
    ...createInitialRows()
      .filter((row) => row.custom)
      .slice(customCount, 3)
      .map((row, index) => ({ ...row, id: `custom-${customCount + index + 1}` })),
  ]
}

export function WeeklyWageTablePreview() {
  const topScrollRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [selectedWeekId, setSelectedWeekId] = useState<WageWeekId>("current")
  const [rows, setRows] = useState<WageRow[]>(createInitialRows)
  const [loading, setLoading] = useState(true)
  const [loadSucceeded, setLoadSucceeded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("Loading the approved roster and week from Preview…")
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info")
  const [weekId, setWeekId] = useState<number | null>(null)
  const [weekStatus, setWeekStatus] = useState("NOT_STARTED")
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null)
  const [persistedWeeks, setPersistedWeeks] = useState<WorkWeek[]>([])
  const [weekOptionsLoading, setWeekOptionsLoading] = useState(true)
  const wageWeeks = useMemo(
    () => weekAnchor ? buildWageWeekOptions(weekAnchor, persistedWeeks) : [],
    [persistedWeeks, weekAnchor],
  )
  const selectedWeek = wageWeeks.find((week) => week.id === selectedWeekId) ?? wageWeeks[0] ?? null
  const workDays = selectedWeek?.days ?? []
  const readOnly = selectedWeek?.readOnly === true || weekStatus === "CLOSED" || weekStatus === "PAID"

  useEffect(() => {
    const syncCurrentWeek = () => {
      const currentSaturday = saturdayForDate(toDateInput())
      setWeekAnchor((current) => current === currentSaturday ? current : currentSaturday)
    }
    syncCurrentWeek()
    window.addEventListener("focus", syncCurrentWeek)
    return () => window.removeEventListener("focus", syncCurrentWeek)
  }, [])

  useEffect(() => {
    let active = true
    fetchWorkWeeks()
      .then((response) => {
        if (active) setPersistedWeeks(response.items)
      })
      .catch((error) => {
        if (!active) return
        setMessageTone("error")
        setMessage(error instanceof Error ? error.message : "Saved Worker weeks could not be loaded.")
      })
      .finally(() => {
        if (active) setWeekOptionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [weekAnchor])

  const loadWeek = useCallback(async () => {
    if (!selectedWeek) return
    setLoading(true)
    setLoadSucceeded(false)
    setMessageTone("info")
    setMessage("Loading the approved roster and saved wages…")
    try {
      const [accountResponse, dailyResponses, week] = await Promise.all([
        fetchAccounts({ isActive: true, pageSize: 200 }),
        Promise.all(selectedWeek.days.map((day) => fetchDailyWages(day.isoDate))),
        fetchCurrentWeek(selectedWeek.startDate),
      ])
      const settlementResponse = week.week_id ? await fetchSettlements(week.week_id) : null
      const loadedRows = databaseRows(
        accountResponse.items,
        dailyResponses,
        settlementResponse?.items ?? [],
      )
      setRows(loadedRows)
      setWeekId(week.week_id)
      setWeekStatus(week.status)
      setLoadSucceeded(true)
      setMessageTone("success")
      const displayStatus = selectedWeek.readOnly ? "historical/closed · read-only" : week.status.toLocaleLowerCase()
      setMessage(week.week_id ? `${selectedWeek.heading} loaded · ${displayStatus}` : `${selectedWeek.heading} loaded · no entries saved`)
    } catch (error) {
      setLoadSucceeded(false)
      setMessageTone("error")
      setMessage(error instanceof Error ? error.message : "The weekly wage sheet could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [selectedWeek])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void loadWeek(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadWeek])

  const totals = useMemo(
    () =>
      calculateWageSheetTotals(
        rows.map((row) => {
          const dependent = pairedDependent(rows, row)
          return {
            dailyWages: daySlots.map((day) => dailyWage(row, day.key)),
            weekWages: weekWages(row),
            loanPayment: amount(row.loanPayment),
            wageToPay: wageToBePaid(row, dependent),
            earlierLoanBalance: amount(row.earlierLoanBalance),
            cashPaidInWeek: amount(row.cashPaidInWeek),
            presentBalance: presentBalance(row),
            includeFinancials: !isDependentWorker(row),
          }
        }),
      ),
    [rows],
  )

  function updateRow(rowId: string, update: (row: WageRow) => WageRow) {
    setRows((current) => current.map((row) => (row.id === rowId ? update(row) : row)))
  }

  function updateDay(rowId: string, day: DayKey, value: EditableAmount) {
    updateRow(rowId, (row) => ({ ...row, days: { ...row.days, [day]: value } }))
  }

  function updateLabourers(rowId: string, day: DayKey, value: EditableAmount) {
    updateRow(rowId, (row) => ({ ...row, labourers: { ...row.labourers, [day]: value } }))
  }

  function updateBaseWage(rowId: string, value: EditableAmount) {
    updateRow(rowId, (row) => ({
      ...row,
      baseWage: value,
      days: Object.fromEntries(workDays.map((day) => [day.key, value])) as Record<DayKey, EditableAmount>,
    }))
  }

  function persistRowDatabaseState(persistedRow: WageRow) {
    setRows((current) => current.map((row) => row.id === persistedRow.id
      ? {
          ...row,
          accountId: persistedRow.accountId,
          accountCode: persistedRow.accountCode,
          accountRowVersion: persistedRow.accountRowVersion,
          loadedName: persistedRow.loadedName,
          loadedReference: persistedRow.loadedReference,
          loadedBaseWage: persistedRow.loadedBaseWage,
        }
      : row))
  }

  async function saveWeek() {
    if (!selectedWeek) return
    if (readOnly) {
      setMessageTone("error")
      setMessage("Historical and closed Worker weeks are read-only.")
      return
    }
    if (!loadSucceeded) {
      setMessageTone("error")
      setMessage("Reload the weekly wage sheet successfully before saving to the Preview database.")
      return
    }
    if (weekStatus === "CLOSED" || weekStatus === "PAID") {
      setMessageTone("error")
      setMessage(`This week is ${weekStatus.toLocaleLowerCase()} and cannot be edited.`)
      return
    }

    for (const row of rows) {
      if (!row.group) continue
      for (const day of workDays) {
        const labourerCount = row.labourers[day.key]
        if (labourerCount !== "" && !Number.isSafeInteger(labourerCount)) {
          setMessageTone("error")
          setMessage(`Enter a whole number of labourers for ${row.name || row.rateNote} on ${day.date} ${day.day}.`)
          return
        }
      }
    }

    setSaving(true)
    setMessageTone("info")
    setMessage("Saving names, rates, daily wages, group counts, advances, and loan payments…")
    try {
      const persistedRows: WageRow[] = []
      for (const [rowIndex, sourceRow] of rows.entries()) {
        const enteredName = sourceRow.name.trim()
        if (sourceRow.custom && !enteredName && sourceRow.accountId === null) continue
        if (!enteredName) throw new Error(`Enter a worker name in row ${rowIndex + 1}.`)
        if (amount(sourceRow.baseWage) <= 0) throw new Error(`Enter a base wage for ${enteredName}.`)

        let row = sourceRow
        if (row.accountId === null) {
          const created = await createAccount({
            account_code: `WG-CUSTOM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            account_type: "GROUP",
            display_name: enteredName,
            group_leader_name: null,
            default_group_size: 0,
            operator_reference: row.reference.trim() || null,
            daily_rate: String(amount(row.baseWage)),
            farm_scheme: null,
            effective_from: selectedWeek.startDate,
          })
          row = {
            ...row,
            accountId: created.account.account_id,
            accountCode: created.account.account_code,
            accountRowVersion: created.account.row_version,
            loadedName: enteredName,
            loadedReference: row.reference.trim(),
            loadedBaseWage: row.baseWage,
          }
          persistRowDatabaseState(row)
        } else {
          if (row.accountRowVersion === null) throw new Error(`${enteredName} has no database row version. Reload and try again.`)
          if (enteredName !== row.loadedName || row.reference.trim() !== row.loadedReference) {
            const updated = await updateAccount(row.accountId, {
              display_name: enteredName,
              group_leader_name: null,
              default_group_size: row.group ? Math.max(0, Math.round(amount(row.labourers.sat))) : null,
              operator_reference: row.reference.trim() || null,
              expected_row_version: row.accountRowVersion,
            })
            row = {
              ...row,
              accountRowVersion: updated.row_version,
              loadedName: enteredName,
              loadedReference: row.reference.trim(),
            }
            persistRowDatabaseState(row)
          }
          if (amount(row.baseWage) !== amount(row.loadedBaseWage)) {
            await addWageRate(row.accountId as number, {
              daily_rate: String(amount(row.baseWage)),
              farm_scheme: row.accountType === "FARM" ? row.farmScheme ?? "THREE_OPTION" : null,
              effective_from: selectedWeek.startDate,
            })
            row = { ...row, loadedBaseWage: row.baseWage }
            persistRowDatabaseState(row)
          }
        }
        persistedRows.push(row)
      }

      for (const row of persistedRows.filter((candidate) => !isDependentWorker(candidate))) {
        const maximumLoanPayment = combinedWeekWages(row, pairedDependent(persistedRows, row))
        if (amount(row.loanPayment) > maximumLoanPayment) {
          throw new Error(`To loan payment for ${row.name} cannot exceed ${formatWholeINR(maximumLoanPayment)}.`)
        }
      }

      for (const [dayIndex, day] of workDays.entries()) {
        const items = persistedRows.map((row) => {
          const entry = normaliseWeeklyWageEntry({
            accountType: row.accountType,
            farmScheme: row.farmScheme,
            dailyWage: row.days[day.key],
            labourers: row.labourers[day.key],
            baseWage: row.baseWage,
          })
          return {
            account_id: row.accountId as number,
            client_operation_id: crypto.randomUUID(),
            attendance: entry.attendance,
            group_attendee_count: entry.groupAttendeeCount,
            wage_rate: String(entry.wageRateSnapshot),
            notes: "Weekly wage sheet",
            expected_row_version: row.dailyRowVersions[day.key],
          }
        })
        if (items.length) await saveDailyWageBatch(workDays[dayIndex].isoDate, items)
      }

      const activeWeek = await fetchCurrentWeek(selectedWeek.startDate)
      if (!activeWeek.week_id) throw new Error("The work week was not created after saving daily wages.")

      for (const row of persistedRows) {
        const weeklyPayment = isDependentWorker(row)
          ? 0
          : wageToBePaid(row, pairedDependent(persistedRows, row))
        await updateWeeklyPayment(
          activeWeek.week_id,
          row.accountId as number,
          String(weeklyPayment),
          row.settlementRowVersion,
        )
        const cashDifference = amount(row.cashPaidInWeek) - row.loadedCashPaidInWeek
        if (cashDifference !== 0) {
          await createLedgerTransaction({
            client_operation_id: crypto.randomUUID(),
            account_id: row.accountId as number,
            transaction_date: selectedWeek.endDate,
            transaction_type: cashDifference > 0 ? "CASH_ADVANCE" : "CASH_REPAYMENT",
            amount: String(Math.abs(cashDifference)),
            reference: "WAGE-SHEET",
            notes: "Weekly wage sheet cash adjustment",
          })
        }
      }

      setWeekId(activeWeek.week_id)
      await loadWeek()
      setMessageTone("success")
      setMessage("Weekly wage sheet saved to the Preview database.")
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The weekly wage sheet could not be saved."
      setMessageTone("error")
      setMessage(error instanceof WorkerApiError && error.status === 409 ? `${detail} Reload the sheet and try again.` : detail)
    } finally {
      setSaving(false)
    }
  }

  function reloadWeek() {
    const currentSaturday = saturdayForDate(toDateInput())
    if (weekAnchor !== currentSaturday) {
      setWeekAnchor(currentSaturday)
      return
    }
    void loadWeek()
  }

  function exportToExcel() {
    if (!selectedWeek) return
    const header = [
      "Worker name",
      "Base wage",
      "Reference",
      "Entry",
      ...workDays.map((day) => `${day.date} ${day.day}`),
      "Week wages",
      "To loan payment",
      "Wage to be paid",
      "Earlier loan balance",
      "Cash paid in week",
      "Present balance",
    ]
    const exportRows: WageWorkbookCell[][] = rows.flatMap((row) => {
      const dependent = pairedDependent(rows, row)
      const financials = isDependentWorker(row)
        ? [weekWages(row), "", "", "", "", ""]
        : [
            weekWages(row),
            row.loanPayment,
            wageToBePaid(row, dependent),
            row.earlierLoanBalance,
            row.cashPaidInWeek,
            presentBalance(row),
          ]
      if (!row.group) {
        return [[row.name, row.baseWage, row.reference, "Daily wage", ...workDays.map((day) => row.days[day.key]), ...financials]]
      }
      return [
        [row.name || row.rateNote, row.baseWage, row.reference, "No", ...workDays.map((day) => row.labourers[day.key]), "", "", "", "", "", ""],
        [
          row.name || row.rateNote,
          row.baseWage,
          row.reference,
          "Group wage (rate × labourers)",
          ...workDays.map((day) => {
            const multiplied = groupDayWage(row, day.key)
            return multiplied === null ? "" : multiplied
          }),
          ...financials,
        ],
      ]
    })
    const workbook = buildWorkerWageWorkbook({ headers: header, detailRows: exportRows, totals })
    const url = URL.createObjectURL(
      new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = selectedWeek.exportFile
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function renderNameCell(row: WageRow, rowIndex: number, rowSpan = 1) {
    return (
      <th
        rowSpan={rowSpan}
        scope="row"
        className={cn(
          "sticky left-0 z-10 border-b border-r border-slate-300 px-3 py-2 align-middle",
          row.custom ? "bg-slate-100" : rowIndex % 2 ? "bg-slate-50" : "bg-white",
        )}
      >
        <input
          type="text"
          value={row.name}
          disabled={readOnly}
          placeholder={row.custom ? row.rateNote : undefined}
          aria-label={`${row.name || row.rateNote} worker name`}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => updateRow(row.id, (current) => ({ ...current, name: event.target.value }))}
          className={cn(
            "h-9 w-full rounded-md bg-transparent px-2 text-sm font-bold text-slate-950 outline-none transition hover:border-slate-300 hover:bg-white focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15",
            row.custom ? "border border-dashed border-slate-300 bg-white placeholder:font-medium placeholder:text-slate-400" : "border border-transparent",
          )}
        />
        <div className="mt-1.5 grid grid-cols-[76px_minmax(0,1fr)] gap-1.5">
          <label className="relative block" title={row.rateNote}>
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={row.baseWage}
              disabled={readOnly}
              aria-label={`${row.name || row.rateNote} base wage`}
              placeholder="Wage"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateWholeAmount(event.target.value, (value) => updateBaseWage(row.id, value))}
              className="h-8 w-full rounded-md border border-slate-300 bg-white pl-5 pr-1 text-right text-xs font-bold tabular-nums text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
            />
          </label>
          <input
            type="text"
            value={row.reference}
            disabled={readOnly}
            maxLength={7}
            spellCheck={false}
            aria-label={`${row.name || row.rateNote} reference, maximum 7 characters`}
            placeholder="Ref (7)"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateRow(row.id, (current) => ({ ...current, reference: event.target.value }))}
            className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        {row.group ? <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700">{row.custom ? "Custom group" : "Group"}</span> : null}
      </th>
    )
  }

  function renderFinancialCells(row: WageRow, rowSpan = 1) {
    const pairedWorker = pairedDependent(rows, row)
    const dependent = isDependentWorker(row)
    return (
      <>
        <td rowSpan={rowSpan} className="border-b border-r border-slate-200 bg-sky-50/80">
          <CombinedWeekWage value={weekWages(row)} addend={pairedWorker ? weekWages(pairedWorker) : null} />
        </td>
        {dependent ? (
          <>
            <td rowSpan={rowSpan} aria-label={`${row.loadedName} to loan payment blank`} className="border-b border-r border-slate-200 bg-amber-50/80" />
            <td rowSpan={rowSpan} aria-label={`${row.loadedName} wage to be paid blank`} className="border-b border-r border-slate-200 bg-sky-50/40" />
            <td rowSpan={rowSpan} aria-label={`${row.loadedName} earlier balance blank`} className="border-b border-r border-slate-200 bg-amber-50/40" />
            <td rowSpan={rowSpan} aria-label={`${row.loadedName} cash paid blank`} className="border-b border-r border-slate-200 bg-rose-50/50" />
            <td rowSpan={rowSpan} aria-label={`${row.loadedName} present balance blank`} className="border-b border-slate-200 bg-slate-100" />
          </>
        ) : (
          <>
            <td rowSpan={rowSpan} className="border-b border-r border-slate-200 bg-amber-50/80 p-1">
              <MoneyInput
                value={row.loanPayment}
                label={`${row.name || row.rateNote}, to loan payment`}
                tone="green"
                disabled={readOnly}
                onChange={(value) => updateRow(row.id, (current) => ({ ...current, loanPayment: value }))}
              />
            </td>
            <td rowSpan={rowSpan} className="border-b border-r border-slate-200 bg-sky-50/40">
              <CalculatedAmount value={wageToBePaid(row, pairedWorker)} tone="green" />
            </td>
            <td rowSpan={rowSpan} className="border-b border-r border-slate-200 bg-amber-50/40 p-1">
              <SignedCalculatedAmount value={row.earlierLoanBalance === "" ? null : amount(row.earlierLoanBalance)} />
            </td>
            <td rowSpan={rowSpan} className="border-b border-r border-slate-200 bg-rose-50/50 p-1">
              <MoneyInput
                value={row.cashPaidInWeek}
                label={`${row.name || row.rateNote}, cash paid in week`}
                tone="red"
                negative
                disabled={readOnly}
                onChange={(value) => updateRow(row.id, (current) => ({ ...current, cashPaidInWeek: value }))}
              />
            </td>
            <td rowSpan={rowSpan} className="border-b border-slate-200 bg-slate-100">
              <SignedCalculatedAmount value={presentBalance(row)} />
            </td>
          </>
        )}
      </>
    )
  }

  if (!selectedWeek) {
    return (
      <div className="weekly-wage-print mx-auto w-full max-w-[1880px]">
        <SectionTitle
          eyebrow="Weekly wage sheet"
          title="Worker wages"
          description="Loading the current Saturday–Friday wage week…"
        />
      </div>
    )
  }

  return (
    <div className="weekly-wage-print mx-auto w-full max-w-[1880px]">
      <SectionTitle
        eyebrow="Weekly wage sheet"
        title="Worker wages"
        description="Enter each worker's daily wage. For groups, enter the number of labourers above and the wage per labourer below; the multiplied wage updates immediately."
        actions={
          <div className="weekly-wage-no-print flex flex-wrap gap-2">
            <label className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700">
              <span className="sr-only">Wage week</span>
              <select
                aria-label="Wage week"
                value={selectedWeekId}
                disabled={loading || saving || weekOptionsLoading}
                onChange={(event) => {
                  setLoadSucceeded(false)
                  setSelectedWeekId(event.target.value as WageWeekId)
                }}
                className="bg-transparent pr-1 outline-none"
              >
                {wageWeeks.map((week) => (
                  <option key={week.id} value={week.id}>{week.label}</option>
                ))}
              </select>
            </label>
            <WorkerButton onClick={() => void saveWeek()} disabled={loading || saving || !loadSucceeded || readOnly}>
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              {saving ? "Saving…" : "Save week"}
            </WorkerButton>
            <WorkerButton variant="secondary" onClick={reloadWeek} disabled={loading || saving}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
              Reload
            </WorkerButton>
            <WorkerButton variant="secondary" onClick={exportToExcel}>
              <Download className="size-4" aria-hidden="true" />
              Export to Excel
            </WorkerButton>
            <WorkerButton variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Print
            </WorkerButton>
          </div>
        }
      />

      <div
        className={cn(
          "weekly-wage-no-print mb-4 flex flex-col gap-3 border-y px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          messageTone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950",
          messageTone === "error" && "border-red-200 bg-red-50 text-red-950",
          messageTone === "info" && "border-sky-200 bg-sky-50 text-sky-950",
        )}
      >
        <div className="flex items-start gap-2">
          {messageTone === "success" ? <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <p>{message}</p>
        </div>
        <Badge tone={messageTone === "error" ? "red" : messageTone === "success" ? "green" : "blue"}>
          {weekId ? `Week #${weekId} · ${weekStatus}` : "Preview database"}
        </Badge>
      </div>

      <div className="mb-4 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Week wages</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatWholeINR(totals.wages)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Wage to be paid</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatWholeINR(totals.wageToPay)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Advances entered</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatWholeINR(totals.advances)}</p>
        </div>
      </div>

      <section className="w-fit max-w-full overflow-hidden border border-slate-300 bg-white shadow-sm" aria-label="Weekly worker wage table">
        <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-950 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
              <CalendarRange className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Work week</p>
              <h2 className="text-lg font-bold">{selectedWeek.heading}</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Saturday to Friday · {rows.filter((row) => !row.group).length} individual workers · {rows.filter((row) => row.group).length} group entries
          </p>
        </div>

        <div
          ref={topScrollRef}
          role="region"
          aria-label="Horizontal table scroll"
          tabIndex={0}
          className="weekly-wage-no-print weekly-wage-top-scroll overflow-x-scroll overflow-y-hidden border-b border-slate-300 bg-slate-100"
          onScroll={(event) => {
            if (tableScrollRef.current && tableScrollRef.current.scrollLeft !== event.currentTarget.scrollLeft) {
              tableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
            }
          }}
        >
          <div className="h-2 w-[1502px]" aria-hidden="true" />
        </div>

        <div
          ref={tableScrollRef}
          className="weekly-wage-table-scroll overflow-x-auto"
          onScroll={(event) => {
            if (topScrollRef.current && topScrollRef.current.scrollLeft !== event.currentTarget.scrollLeft) {
              topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
            }
          }}
        >
          <table className="weekly-wage-table w-[1502px] min-w-[1502px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[168px]" />
              {workDays.map((workDay) => (
                <col key={workDay.key} className="w-[100px]" />
              ))}
              <col className="w-[102px]" />
              <col className="w-[102px]" />
              <col className="w-[102px]" />
              <col className="w-[102px]" />
              <col className="w-[124px]" />
              <col className="w-[102px]" />
            </colgroup>
            <thead className="relative z-20 text-xs">
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-30 border-b border-r border-slate-300 bg-slate-100 px-2 py-3 font-bold uppercase tracking-[0.1em] text-slate-700"
                >
                  Worker name
                </th>
                <th colSpan={7} scope="colgroup" className="border-b border-r border-emerald-300 bg-emerald-700 px-3 py-2 text-center font-bold uppercase tracking-[0.12em] text-white">
                  Daily wage · groups show labour count × editable rate
                </th>
                <th rowSpan={2} scope="col" className="border-b border-r border-sky-300 bg-sky-700 px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-white">
                  Week wages
                  <span className="mt-1 block font-normal text-sky-100">7-day total</span>
                </th>
                <th rowSpan={2} scope="col" className="border-b border-r border-amber-300 bg-amber-600 px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-white">
                  To loan payment
                  <span className="mt-1 block font-normal text-amber-100">Enter manually</span>
                </th>
                <th rowSpan={2} scope="col" className="border-b border-r border-sky-300 bg-sky-700 px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-white">
                  Wage to be paid
                  <span className="mt-1 block font-normal text-sky-100">Wages less loan</span>
                </th>
                <th rowSpan={2} scope="col" className="border-b border-r border-amber-300 bg-amber-600 px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-white">
                  Earlier loan balance
                  <span className="mt-1 block font-normal text-amber-100">Previous week</span>
                </th>
                <th rowSpan={2} scope="col" className="border-b border-r border-rose-300 bg-rose-700 px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-white">
                  Cash paid in week
                  <span className="mt-1 block font-normal text-rose-100">Advance wages</span>
                </th>
                <th rowSpan={2} scope="col" className="border-b border-slate-500 bg-slate-800 px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-white">
                  Present balance
                  <span className="mt-1 block font-normal text-slate-300">Calculated</span>
                </th>
              </tr>
              <tr>
                {workDays.map((workDay) => (
                  <th
                    key={workDay.key}
                    scope="col"
                    className="border-b border-r border-emerald-300 bg-emerald-50 px-1 py-2 text-center text-emerald-950"
                  >
                    <span className="block font-bold">{workDay.date}</span>
                    <span className="mt-0.5 block font-medium text-emerald-700">{workDay.day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) =>
                row.group ? (
                  <Fragment key={row.id}>
                    <tr className="bg-violet-50/60">
                      {renderNameCell(row, rowIndex, 2)}
                      {workDays.map((workDay) => (
                        <td key={workDay.key} className="border-r border-slate-200 p-1 align-top">
                          <LabourCountInput
                            value={row.labourers[workDay.key]}
                            disabled={readOnly}
                            label={`${row.name || row.rateNote}, ${workDay.date} ${workDay.day} number of labourers`}
                            onChange={(value) => updateLabourers(row.id, workDay.key, value)}
                          />
                        </td>
                      ))}
                      {renderFinancialCells(row, 2)}
                    </tr>
                    <tr className="bg-emerald-50/40">
                      {workDays.map((workDay) => {
                        const multipliedWage = groupDayWage(row, workDay.key)
                        return (
                          <td key={workDay.key} className="border-b border-r border-t border-slate-200 p-1.5 align-top">
                            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Wage</p>
                            <MoneyInput
                              value={row.days[workDay.key]}
                              label={`${row.name || row.rateNote}, ${workDay.date} ${workDay.day} wage per labourer`}
                              compact
                              disabled={readOnly}
                              onChange={(value) => updateDay(row.id, workDay.key, value)}
                            />
                            <p
                              className={cn(
                                "mt-1 min-h-6 whitespace-nowrap border-t border-emerald-200 px-1 pt-1 text-right font-bold tabular-nums text-slate-950",
                                multipliedWage === null ? "text-sm leading-5" : "text-[11px] leading-4",
                              )}
                            >
                              {multipliedWage === null ? null : formatWholeINR(multipliedWage)}
                            </p>
                          </td>
                        )
                      })}
                    </tr>
                  </Fragment>
                ) : (
                  <tr key={row.id} className={rowIndex % 2 ? "bg-slate-50/60" : "bg-white"}>
                    {renderNameCell(row, rowIndex)}
                    {workDays.map((workDay) => (
                      <td key={workDay.key} className="border-b border-r border-slate-200 bg-emerald-50/35 p-1">
                        <MoneyInput
                          value={row.days[workDay.key]}
                          disabled={readOnly}
                          label={`${row.name}, ${workDay.date} ${workDay.day} wage`}
                          onChange={(value) => updateDay(row.id, workDay.key, value)}
                        />
                      </td>
                    ))}
                    {renderFinancialCells(row)}
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950 text-white">
                <th scope="row" className="sticky left-0 z-10 border-r border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold">
                  {WORKER_WAGE_TOTAL_LABEL}
                </th>
                {workDays.map((workDay, dayIndex) => (
                  <td key={workDay.key} className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">
                    {formatWholeINR(totals.dailyWages[dayIndex])}
                  </td>
                ))}
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.wages)}</td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.loanPayment)}</td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.wageToPay)}</td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.earlierLoanBalance)}</td>
                <td className="border-r border-slate-700 px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.advances)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">{formatWholeINR(totals.presentBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Wage to be paid = combined week wages − to loan payment. Present balance = signed earlier balance + to loan payment − cash advance paid during the week.
      </p>
    </div>
  )
}
