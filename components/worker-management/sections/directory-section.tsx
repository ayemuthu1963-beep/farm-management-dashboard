"use client"

import { useMemo, useState } from "react"
import { History, Pencil, Plus, PowerOff, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/worker-management/section-header"
import { AccountStatusBadge, AccountTypeBadge } from "@/components/worker-management/status-badges"
import { useWorkerManagement } from "@/components/worker-management/worker-management-context"
import { formatDisplayDate, formatRupees, nextAccountId, type Account, type AccountType } from "@/lib/worker-management"
import { AccountForm, type AccountFormSubmit } from "./account-form"

type TypeFilter = "All" | AccountType

const typeFilters: TypeFilter[] = ["All", "Farm", "Outside", "Group"]

export function DirectorySection() {
  const { accounts, setAccounts } = useWorkerManagement()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All")
  const [formMode, setFormMode] = useState<{ mode: "add" } | { mode: "edit"; account: Account } | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter((account) => {
      const matchesType = typeFilter === "All" || account.type === typeFilter
      const matchesQuery =
        query.length === 0 ||
        account.name.toLowerCase().includes(query) ||
        account.id.toLowerCase().includes(query) ||
        (account.groupHead ?? "").toLowerCase().includes(query)
      return matchesType && matchesQuery
    })
  }, [accounts, search, typeFilter])

  function handleAddOrEdit(values: AccountFormSubmit) {
    if (formMode?.mode === "edit") {
      const { account } = formMode
      setAccounts((prev) =>
        prev.map((existing) =>
          existing.id === account.id
            ? {
                ...existing,
                name: values.name,
                phone: values.phone,
                joinDate: values.joinDate,
                rate: values.rate,
                groupHead: values.groupHead,
                memberCount: values.memberCount,
              }
            : existing,
        ),
      )
      setFormMode(null)
      return
    }
    const id = nextAccountId(values.type, accounts)
    setAccounts((prev) => [
      ...prev,
      {
        id,
        type: values.type,
        name: values.name,
        phone: values.phone,
        joinDate: values.joinDate,
        rate: values.rate,
        status: "Active",
        statusHistory: [{ date: values.joinDate, status: "Active", note: "Account created" }],
        groupHead: values.groupHead,
        memberCount: values.memberCount,
      },
    ])
    setFormMode(null)
  }

  function toggleStatus(account: Account) {
    const today = new Date().toISOString().slice(0, 10)
    const nextStatus = account.status === "Active" ? "Inactive" : "Active"
    setAccounts((prev) =>
      prev.map((existing) =>
        existing.id === account.id
          ? {
              ...existing,
              status: nextStatus,
              statusHistory: [
                ...existing.statusHistory,
                {
                  date: today,
                  status: nextStatus,
                  note: nextStatus === "Inactive" ? "Deactivated" : "Reactivated",
                },
              ],
            }
          : existing,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Worker Directory"
        description="The local register of Farm, Outside and Group accounts working across Muthu Farms, with active status history."
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block w-full max-w-sm">
              <span className="sr-only">Search accounts</span>
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, ID or group head"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by account type">
              {typeFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTypeFilter(filter)}
                  aria-pressed={typeFilter === filter}
                  className={
                    typeFilter === filter
                      ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  }
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setFormMode(formMode?.mode === "add" ? null : { mode: "add" })}
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add account
          </Button>
        </div>

        {formMode ? (
          <div className="mt-5">
            <AccountForm
              account={formMode.mode === "edit" ? formMode.account : null}
              onSubmit={handleAddOrEdit}
              onCancel={() => setFormMode(null)}
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">No accounts match your search.</p>
          ) : (
            filtered.map((account) => (
              <div key={account.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{account.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{account.id}</p>
                  </div>
                  <AccountStatusBadge status={account.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <AccountTypeBadge type={account.type} />
                  {account.type === "Group" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      <Users className="size-3" aria-hidden="true" />
                      {account.memberCount} members · head {account.groupHead}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{account.phone ?? "—"}</span>
                  <span className="font-medium text-foreground">
                    {formatRupees(account.rate)} {account.type === "Group" ? "/ head" : "/ day"}
                  </span>
                </div>

                {expandedHistory === account.id ? (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status history</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {account.statusHistory
                        .toSorted((a, b) => (a.date < b.date ? 1 : -1))
                        .map((event, index) => (
                          <li key={`${account.id}-${index}`} className="text-xs">
                            <span className="font-medium text-foreground">{formatDisplayDate(event.date)}</span>{" "}
                            <span className="text-muted-foreground">
                              — {event.status}
                              {event.note ? `, ${event.note}` : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormMode({ mode: "edit", account })}
                  >
                    <Pencil data-icon="inline-start" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedHistory(expandedHistory === account.id ? null : account.id)}
                  >
                    <History data-icon="inline-start" aria-hidden="true" />
                    History
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => toggleStatus(account)}>
                    <PowerOff data-icon="inline-start" aria-hidden="true" />
                    {account.status === "Active" ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
