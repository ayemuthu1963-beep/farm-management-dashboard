"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchAccounts, fetchDailyWages } from "@/lib/worker-management-api"
import { MOVED_WAGE_PLACEHOLDER_NOTE } from "@/lib/worker-management-constants"
import {
  addDays,
  calculateDailyWage,
  compareAccountCodes,
  formatDayDate,
  formatWholeINR,
  money,
  toDateInput,
  workerAccountOptionLabel,
} from "@/lib/worker-management-format"
import {
  attachAttendanceServerSnapshots,
  cacheDailyWages,
  cacheWorkerAccounts,
  getAttendanceOperations,
  queueAttendanceOperations,
  readCachedDailyWages,
  resolveAttendanceConflict,
  type WorkerLocalOperation,
} from "@/lib/worker-management-offline"
import type {
  AttendanceValue,
  AvailableDailyAccount,
  DailyWageItem,
  DailyWageResponse,
} from "@/lib/worker-management-types"
import {
  Badge,
  EmptyState,
  LoadingState,
  Notice,
  SectionTitle,
  WorkerButton,
} from "./worker-ui"
import { useWorkerOffline } from "./worker-offline-provider"

const attendanceLabels: Record<AttendanceValue, string> = {
  FULL: "Full",
  TWO_THIRDS: "2/3",
  HALF: "Half",
  ONE_THIRD: "1/3",
  ABSENT: "Absent",
}

function availableAttendance(item: DailyWageItem): AttendanceValue[] {
  if (item.account_type === "OUTSIDE") return ["FULL", "ABSENT"]
  if (item.account_type !== "FARM") return []
  return item.scheme_snapshot === "THREE_OPTION"
    ? ["FULL", "TWO_THIRDS", "ONE_THIRD", "ABSENT"]
    : ["FULL", "HALF", "ABSENT"]
}

function addAvailableAccount(account: AvailableDailyAccount, workDate: string): DailyWageItem {
  const attendees = null
  const attendance: AttendanceValue | null = null
  return {
    attendance_id: null,
    account_id: account.account_id,
    account_code: account.account_code,
    account_type: account.account_type,
    display_name: account.display_name,
    group_leader_name: account.group_leader_name,
    default_group_size: account.default_group_size,
    work_date: workDate,
    attendance_value: attendance,
    group_attendee_count: attendees,
    wage_rate_snapshot: account.daily_rate ?? "0.00",
    scheme_snapshot: account.farm_scheme,
    daily_wage_amount: calculateDailyWage(
      account.daily_rate ?? "0.00",
      attendance,
      attendees,
      account.account_type,
    ).toFixed(2),
    notes: null,
    entry_status: "DRAFT",
    row_version: null,
    is_default: true,
  }
}

function latestAttendanceStates(operations: WorkerLocalOperation[]): Map<number, WorkerLocalOperation> {
  const states = new Map<number, WorkerLocalOperation>()
  operations.forEach((operation) => {
    if (operation.entity_type !== "ATTENDANCE") return
    const existing = states.get(operation.payload.account_id)
    if (!existing || (existing.state === "SYNCED" && operation.state !== "SYNCED")) {
      states.set(operation.payload.account_id, operation)
    }
  })
  return states
}

function mergeLocalAttendance(
  value: DailyWageResponse,
  operations: WorkerLocalOperation[],
): DailyWageResponse {
  const items = value.items.map((item) =>
    item.is_default || item.notes === MOVED_WAGE_PLACEHOLDER_NOTE
      ? {
          ...item,
          attendance_value: null,
          group_attendee_count: null,
          daily_wage_amount: "0.00",
          is_default: true,
        }
      : { ...item },
  )
  const available = value.available_accounts.map((account) => ({ ...account }))
  latestAttendanceStates(operations).forEach((operation, accountId) => {
    if (operation.state === "SYNCED" || operation.entity_type !== "ATTENDANCE") return
    let item = items.find((candidate) => candidate.account_id === accountId)
    if (!item) {
      const account = available.find((candidate) => candidate.account_id === accountId)
      if (!account) return
      item = addAvailableAccount(account, value.work_date)
      items.push(item)
    }
    item.attendance_value = operation.payload.attendance
    item.group_attendee_count = operation.payload.group_attendee_count
    item.notes = operation.payload.notes
    item.daily_wage_amount = calculateDailyWage(
      item.wage_rate_snapshot,
      item.attendance_value,
      item.group_attendee_count,
      item.account_type,
    ).toFixed(2)
    item.is_default = false
  })
  const present = new Set(items.map((item) => item.account_id))
  return {
    ...value,
    items,
    available_accounts: available.filter((account) => !present.has(account.account_id)),
  }
}

function attendanceSummary(attendance: AttendanceValue | null, groupCount: number | null): string {
  return groupCount !== null
    ? `${groupCount} workers`
    : attendance
      ? attendanceLabels[attendance]
      : "No attendance"
}

export function DailyWageEntry() {
  const { online, lastSync, syncNow, refreshStatus } = useWorkerOffline()
  const [workDate, setWorkDate] = useState(toDateInput)
  const [data, setData] = useState<DailyWageResponse | null>(null)
  const [items, setItems] = useState<DailyWageItem[]>([])
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState("")
  const [changedOnly, setChangedOnly] = useState(false)
  const [availableAccountId, setAvailableAccountId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [syncStates, setSyncStates] = useState<Map<number, WorkerLocalOperation>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await fetchDailyWages(workDate)
      await Promise.all([
        cacheDailyWages(result),
        fetchAccounts({ pageSize: 200 })
          .then((accounts) => cacheWorkerAccounts(accounts.items))
          .catch(() => undefined),
      ])
      await attachAttendanceServerSnapshots(result)
      const operations = await getAttendanceOperations(workDate)
      const states = latestAttendanceStates(operations)
      const merged = mergeLocalAttendance(result, operations)
      setData(merged)
      setItems(merged.items)
      setSyncStates(states)
      setDirtyIds(new Set())
      setAvailableAccountId("")
    } catch (loadError) {
      const cached = await readCachedDailyWages(workDate)
      if (cached) {
        const operations = await getAttendanceOperations(workDate)
        const states = latestAttendanceStates(operations)
        const merged = mergeLocalAttendance(cached, operations)
        setData(merged)
        setItems(merged.items)
        setSyncStates(states)
        setDirtyIds(new Set())
        setNotice("Offline roster loaded. New entries will be saved on this device.")
      } else {
        setError(loadError instanceof Error ? loadError.message : "Unable to load daily wages.")
        setData(null)
        setItems([])
        setSyncStates(new Map())
      }
    } finally {
      setLoading(false)
    }
  }, [workDate])

  useEffect(() => {
    void load()
  }, [lastSync, load])

  const changeItem = useCallback((accountId: number, change: Partial<DailyWageItem>) => {
    setItems((current) =>
      current.map((item) => {
        if (item.account_id !== accountId) return item
        const next = { ...item, ...change }
        return {
          ...next,
          daily_wage_amount: calculateDailyWage(
            next.wage_rate_snapshot,
            next.attendance_value,
            next.group_attendee_count,
            next.account_type,
          ).toFixed(2),
        }
      }),
    )
    setDirtyIds((current) => new Set(current).add(accountId))
    setNotice("")
  }, [])

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items
      .filter((item) => {
        if (changedOnly && !dirtyIds.has(item.account_id) && !syncStates.has(item.account_id)) return false
        return !query || `${item.account_code} ${item.display_name}`.toLowerCase().includes(query)
      })
      .toSorted(compareAccountCodes)
  }, [changedOnly, dirtyIds, items, search, syncStates])

  const availableAccounts = useMemo(
    () => (data?.available_accounts ?? []).toSorted(compareAccountCodes),
    [data?.available_accounts],
  )

  const dailyTotal = items.reduce((sum, item) => sum + money(item.daily_wage_amount), 0)
  const canEdit = data?.week.status === "NOT_STARTED" || data?.week.status === "DRAFT" || data?.week.status === "REOPENED"

  const addAccount = () => {
    const account = data?.available_accounts.find(
      (candidate) => candidate.account_id === Number(availableAccountId),
    )
    if (!account || items.some((item) => item.account_id === account.account_id)) return
    setItems((current) => [...current, addAvailableAccount(account, workDate)])
    setAvailableAccountId("")
  }

  const save = async () => {
    const changedItems = items.filter((item) => dirtyIds.has(item.account_id))
    if (!changedItems.length || !canEdit) return
    const incomplete = changedItems.find((item) =>
      item.account_type === "GROUP"
        ? item.group_attendee_count === null
        : item.attendance_value === null,
    )
    if (incomplete) {
      setError(`Select attendance for ${incomplete.account_code} · ${incomplete.display_name} before saving.`)
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    let queued = false
    try {
      await queueAttendanceOperations(
        workDate,
        changedItems.map((item) => ({
          account_id: item.account_id,
          attendance: item.account_type === "GROUP" ? null : item.attendance_value,
          group_attendee_count: item.account_type === "GROUP" ? item.group_attendee_count : null,
          notes: item.notes,
          expected_row_version: item.row_version,
        })),
      )
      queued = true
      if (data) {
        await cacheDailyWages({
          ...data,
          items,
          available_accounts: data.available_accounts.filter(
            (account) => !items.some((item) => item.account_id === account.account_id),
          ),
        })
      }
      setDirtyIds(new Set())
      setNotice(`${changedItems.length} entr${changedItems.length === 1 ? "y" : "ies"} saved on this device.`)
      await refreshStatus()
      if (online) {
        const result = await syncNow()
        setNotice(
          result.conflicts
            ? `${result.conflicts} item${result.conflicts === 1 ? " needs" : "s need"} conflict review.`
            : `${result.pushed} entr${result.pushed === 1 ? "y" : "ies"} synced online.`,
        )
      }
      await load()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save daily wages."
      if (queued) {
        setNotice("Entries are saved on this device and will sync when the connection returns.")
        await refreshStatus()
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const resolveConflict = async (operationId: string, resolution: "SERVER" | "LOCAL") => {
    setSaving(true)
    setError("")
    try {
      await resolveAttendanceConflict(operationId, resolution)
      await refreshStatus()
      if (resolution === "LOCAL" && online) await syncNow()
      setNotice(
        resolution === "SERVER"
          ? "Server entry retained."
          : "Device entry queued again with the current server version.",
      )
      await load()
    } catch (resolutionError) {
      setError(
        resolutionError instanceof Error
          ? resolutionError.message
          : "Unable to resolve this conflict.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-24 sm:pb-0">
      <SectionTitle
        eyebrow="Daily Wage Entry"
        title={formatDayDate(workDate)}
        description={
          data
            ? `${data.week.start_date} – ${data.week.end_date} · Select attendance explicitly for every entry you save.`
            : "Saturday–Friday work week · accounts close Friday evening and payment is made Saturday."
        }
        actions={
          <div className="flex items-center gap-2">
            <WorkerButton
              variant="secondary"
              className="min-w-11 px-0"
              aria-label="Previous day"
              onClick={() => setWorkDate((date) => addDays(date, -1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </WorkerButton>
            <input
              aria-label="Work date"
              type="date"
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-semibold"
            />
            <WorkerButton
              variant="secondary"
              className="min-w-11 px-0"
              aria-label="Next day"
              onClick={() => setWorkDate((date) => addDays(date, 1))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </WorkerButton>
          </div>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <div className="mt-3"><Notice tone="success">{notice}</Notice></div> : null}
      {!canEdit && data ? <div className="mt-3"><Notice tone="warning">This week is {data.week.status.toLowerCase()} and daily entries are read-only.</Notice></div> : null}

      <div className="mt-5 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search worker or ID</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search worker or ID"
              className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={changedOnly}
              onChange={(event) => setChangedOnly(event.target.checked)}
              className="size-4 accent-primary"
            />
            Changed entries only
          </label>
        </div>
      </div>

      {availableAccounts.length ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold">
              Add Outside Worker or Group for this date
              <select
                value={availableAccountId}
                onChange={(event) => setAvailableAccountId(event.target.value)}
                disabled={!canEdit}
                className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
              >
                <option value="">Select an account</option>
                {availableAccounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {workerAccountOptionLabel(account)} · {account.account_type === "GROUP" ? "Group" : "Outside"}
                  </option>
                ))}
              </select>
            </label>
            <WorkerButton onClick={addAccount} disabled={!availableAccountId || !canEdit}>
              <Plus className="size-4" aria-hidden="true" />
              Add to date
            </WorkerButton>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        {loading ? <LoadingState label="Loading daily wage entry…" /> : null}
        {!loading && !visibleItems.length ? <EmptyState>No workers match this view.</EmptyState> : null}
        {!loading && visibleItems.length ? (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const syncState = syncStates.get(item.account_id)
              const itemCanEdit = canEdit && syncState?.state !== "CONFLICT"
              const selectionRequired = item.is_default && !syncState && (
                item.account_type === "GROUP"
                  ? item.group_attendee_count === null
                  : item.attendance_value === null
              )
              return (
                <article key={item.account_id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{item.display_name}</h2>
                      {dirtyIds.has(item.account_id) ? <Badge tone="amber">Unsaved</Badge> : null}
                      {!dirtyIds.has(item.account_id) && syncState?.state === "SAVED_ON_DEVICE" ? <Badge tone="amber">Saved on Device</Badge> : null}
                      {!dirtyIds.has(item.account_id) && syncState?.state === "WAITING_TO_SYNC" ? <Badge tone="amber">Waiting to Sync</Badge> : null}
                      {!dirtyIds.has(item.account_id) && syncState?.state === "CONFLICT" ? <Badge tone="red">Conflict</Badge> : null}
                      {!dirtyIds.has(item.account_id) && syncState?.state === "SYNCED" ? <Badge tone="green">Synced</Badge> : null}
                      {!dirtyIds.has(item.account_id) && selectionRequired ? <Badge tone="amber">Selection required</Badge> : null}
                      {!dirtyIds.has(item.account_id) && !syncState && !selectionRequired ? <Badge tone="green">Saved</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.account_code} · {formatWholeINR(item.wage_rate_snapshot)}/day
                      {item.account_type === "GROUP" ? " per attendee" : ""}
                    </p>
                    {item.account_type === "GROUP" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.group_leader_name || "Group account"} · default {item.default_group_size ?? 0} workers
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Daily total</p>
                    <p className="font-bold tabular-nums">{formatWholeINR(item.daily_wage_amount)}</p>
                  </div>
                </div>

                {item.account_type === "GROUP" ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/55 p-3">
                    <div>
                      <p className="text-sm font-semibold">Workers attended</p>
                      <p className="text-xs text-muted-foreground">Change the count for this workday</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <WorkerButton
                        variant="secondary"
                        className="min-w-11 px-0"
                        aria-label={`Decrease attendance for ${item.display_name}`}
                        disabled={!itemCanEdit || (item.group_attendee_count ?? 0) <= 0}
                        onClick={() => changeItem(item.account_id, { group_attendee_count: Math.max(0, (item.group_attendee_count ?? 0) - 1) })}
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </WorkerButton>
                      <input
                        aria-label={`Workers attended for ${item.display_name}`}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={item.group_attendee_count ?? ""}
                        disabled={!itemCanEdit}
                        onChange={(event) => changeItem(item.account_id, {
                          group_attendee_count: event.target.value === ""
                            ? null
                            : Math.max(0, Number(event.target.value) || 0),
                        })}
                        className="h-11 w-16 rounded-lg border border-input bg-background text-center text-lg font-bold"
                      />
                      <WorkerButton
                        variant="secondary"
                        className="min-w-11 px-0"
                        aria-label={`Increase attendance for ${item.display_name}`}
                        disabled={!itemCanEdit}
                        onClick={() => changeItem(item.account_id, { group_attendee_count: (item.group_attendee_count ?? 0) + 1 })}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </WorkerButton>
                    </div>
                  </div>
                ) : (
                  <div className={cn("mt-4 grid gap-2", item.account_type === "OUTSIDE" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
                    {availableAttendance(item).map((value) => {
                      const selected = item.attendance_value === value
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!itemCanEdit}
                          aria-pressed={selected}
                          onClick={() => changeItem(item.account_id, { attendance_value: value })}
                          className={cn(
                            "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/45 hover:bg-primary/5",
                          )}
                        >
                          {selected ? <Check className="size-4" aria-hidden="true" /> : null}
                          {attendanceLabels[value]}
                        </button>
                      )
                    })}
                  </div>
                )}
                {syncState?.state === "CONFLICT" && syncState.entity_type === "ATTENDANCE" ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-bold">Conflict review required</p>
                    <p className="mt-1 text-xs">
                      {syncState.detail || "The server entry changed while this device was offline."}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-xs font-semibold">This device</dt>
                        <dd>{attendanceSummary(syncState.payload.attendance, syncState.payload.group_attendee_count)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold">Current server</dt>
                        <dd>
                          {syncState.server_snapshot
                            ? attendanceSummary(
                                syncState.server_snapshot.attendance_value,
                                syncState.server_snapshot.group_attendee_count,
                              )
                            : "Load server entry"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <WorkerButton
                        variant="secondary"
                        onClick={() => void resolveConflict(syncState.operation_id, "SERVER")}
                        disabled={saving}
                      >
                        Use Server
                      </WorkerButton>
                      <WorkerButton
                        onClick={() => void resolveConflict(syncState.operation_id, "LOCAL")}
                        disabled={saving || !syncState.server_snapshot?.row_version}
                      >
                        Retry Device Entry
                      </WorkerButton>
                    </div>
                  </div>
                ) : null}
                </article>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:left-64 sm:static sm:mt-5 sm:rounded-xl sm:border sm:p-4 sm:shadow-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Daily total</p>
            <p className="font-bold tabular-nums">{formatWholeINR(dailyTotal)}</p>
            <p className="text-[11px] text-muted-foreground">{dirtyIds.size} unsaved</p>
          </div>
          <WorkerButton onClick={save} disabled={saving || loading || !dirtyIds.size || !canEdit}>
            <Check className="size-4" aria-hidden="true" />
            {saving ? "Saving…" : online ? "Save Entries" : "Save on Device"}
          </WorkerButton>
        </div>
      </div>
    </div>
  )
}
