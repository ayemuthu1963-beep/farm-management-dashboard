"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/worker-management/section-header"
import { AccountTypeBadge, SyncStatusBadge, SyncStatusLegend } from "@/components/worker-management/status-badges"
import { useWorkerManagement } from "@/components/worker-management/worker-management-context"
import {
  computeWageAmount,
  farmAttendanceOptions,
  findWageEntryForDate,
  formatRupees,
  outsideAttendanceOptions,
  upsertWageEntry,
  type FarmAttendance,
  type OutsideAttendance,
} from "@/lib/worker-management"

interface DraftValue {
  farmAttendance?: FarmAttendance
  outsideAttendance?: OutsideAttendance
  groupCount?: number
}

export function WageEntrySection() {
  const { accounts, wageEntries, setWageEntries } = useWorkerManagement()
  const [selectedDate, setSelectedDate] = useState("2026-08-11")
  const [search, setSearch] = useState("")
  const [changedOnly, setChangedOnly] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({})

  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === "Active"), [accounts])

  function savedEntryFor(accountId: string) {
    return findWageEntryForDate(wageEntries, accountId, selectedDate)
  }

  function draftFor(accountId: string): DraftValue {
    if (drafts[accountId]) return drafts[accountId]
    const saved = savedEntryFor(accountId)
    return {
      farmAttendance: saved?.farmAttendance,
      outsideAttendance: saved?.outsideAttendance,
      groupCount: saved?.groupCount,
    }
  }

  function isChanged(accountId: string): boolean {
    const draft = drafts[accountId]
    if (!draft) return false
    const saved = savedEntryFor(accountId)
    return (
      draft.farmAttendance !== saved?.farmAttendance ||
      draft.outsideAttendance !== saved?.outsideAttendance ||
      draft.groupCount !== saved?.groupCount
    )
  }

  function updateDraft(accountId: string, value: DraftValue) {
    setDrafts((prev) => ({ ...prev, [accountId]: value }))
  }

  function handleDateChange(nextDate: string) {
    const hasUnsaved = activeAccounts.some((account) => isChanged(account.id))
    if (hasUnsaved && !window.confirm("You have unsaved changes for this date. Switch dates and discard them?")) {
      return
    }
    setDrafts({})
    setSelectedDate(nextDate)
  }

  const rows = useMemo(
    () =>
      activeAccounts.map((account) => {
        const draft = draftFor(account.id)
        const saved = savedEntryFor(account.id)
        const wage = computeWageAmount(account, draft)
        return { account, draft, saved, wage, changed: isChanged(account.id) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAccounts, drafts, wageEntries, selectedDate],
  )

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery =
        query.length === 0 ||
        row.account.name.toLowerCase().includes(query) ||
        row.account.id.toLowerCase().includes(query)
      const matchesChanged = !changedOnly || row.changed
      return matchesQuery && matchesChanged
    })
  }, [rows, search, changedOnly])

  const total = rows.reduce((sum, row) => sum + row.wage, 0)
  const unsavedCount = rows.filter((row) => row.changed).length

  function handleSave() {
    let next = wageEntries
    for (const row of rows) {
      if (!row.changed) continue
      next = upsertWageEntry(next, {
        id: row.saved?.id ?? `wage-${row.account.id}-${selectedDate}`,
        accountId: row.account.id,
        date: selectedDate,
        farmAttendance: row.draft.farmAttendance,
        outsideAttendance: row.draft.outsideAttendance,
        groupCount: row.draft.groupCount,
        wage: row.wage,
        syncStatus: "Saved on device",
        paidStatus: row.saved?.paidStatus ?? "Unpaid",
      })
    }
    setWageEntries(next)
    setDrafts({})
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Daily Wage Entry"
        description="Record attendance for Farm, Outside and Group accounts on a given date. Each account can only have one entry per date."
      />

      <SyncStatusLegend />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => handleDateChange(event.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Search accounts</span>
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or ID"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <label className="inline-flex items-center gap-2 pb-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={changedOnly}
                onChange={(event) => setChangedOnly(event.target.checked)}
                className="size-4 rounded border border-input"
              />
              Show changed only
            </label>
          </div>
        </div>

        {/* Sticky total / unsaved / save bar */}
        <div className="sticky top-0 z-10 mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              Total for date: <span className="font-semibold text-foreground">{formatRupees(total)}</span>
            </span>
            <span className={unsavedCount > 0 ? "font-medium text-warning-foreground" : "text-muted-foreground"}>
              {unsavedCount} unsaved change{unsavedCount === 1 ? "" : "s"}
            </span>
          </div>
          <Button type="button" onClick={handleSave} disabled={unsavedCount === 0}>
            <Check data-icon="inline-start" aria-hidden="true" />
            Save entries
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Rate</th>
                <th className="px-3 py-3">Attendance</th>
                <th className="px-3 py-3 text-right">Wage</th>
                <th className="px-3 py-3">Sync status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No accounts match your filters.
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ account, draft, saved, wage, changed }) => (
                  <tr key={account.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.name}</p>
                        <AccountTypeBadge type={account.type} />
                      </div>
                      <p className="text-xs text-muted-foreground">{account.id}</p>
                    </td>
                    <td className="px-3 py-4 align-top">
                      {formatRupees(account.rate)}
                      {account.type === "Group" ? " / head" : " / day"}
                    </td>
                    <td className="px-3 py-4 align-top">
                      {account.type === "Farm" ? (
                        <div className="flex flex-wrap gap-1" role="group" aria-label={`${account.name} attendance`}>
                          {farmAttendanceOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              aria-pressed={draft.farmAttendance === option}
                              onClick={() => updateDraft(account.id, { farmAttendance: option })}
                              className={
                                draft.farmAttendance === option
                                  ? "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                                  : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                              }
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {account.type === "Outside" ? (
                        <div className="flex flex-wrap gap-1" role="group" aria-label={`${account.name} attendance`}>
                          {outsideAttendanceOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              aria-pressed={draft.outsideAttendance === option}
                              onClick={() => updateDraft(account.id, { outsideAttendance: option })}
                              className={
                                draft.outsideAttendance === option
                                  ? "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                                  : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                              }
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {account.type === "Group" ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={account.memberCount}
                            value={draft.groupCount ?? ""}
                            onChange={(event) =>
                              updateDraft(account.id, {
                                groupCount: Math.min(
                                  Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                                  account.memberCount ?? 0,
                                ),
                              })
                            }
                            aria-label={`${account.name} attendance count`}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1.5"
                          />
                          <span className="text-xs text-muted-foreground">of {account.memberCount}</span>
                        </label>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-right align-top font-semibold">{formatRupees(wage)}</td>
                    <td className="px-3 py-4 align-top">
                      {changed ? (
                        <span className="text-xs font-medium text-warning-foreground">Unsaved</span>
                      ) : saved ? (
                        <SyncStatusBadge status={saved.syncStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not entered</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
