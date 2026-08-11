"use client"

import { useMemo, useState } from "react"
import { Check, MessageCircleQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/worker-management/section-header"
import { AccountTypeBadge } from "@/components/worker-management/status-badges"
import { useWorkerManagement } from "@/components/worker-management/worker-management-context"
import { findAccount, formatDisplayDate, type QueryStatus } from "@/lib/worker-management"

type StatusFilter = "All" | QueryStatus

const statusFilters: StatusFilter[] = ["All", "Open", "Resolved"]

export function QuerySection() {
  const { accounts, queries, setQueries } = useWorkerManagement()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolutionDraft, setResolutionDraft] = useState("")

  const filtered = useMemo(
    () =>
      queries
        .filter((query) => statusFilter === "All" || query.status === statusFilter)
        .toSorted((a, b) => (a.date < b.date ? 1 : -1)),
    [queries, statusFilter],
  )

  function startResolving(id: string) {
    setResolvingId(id)
    setResolutionDraft("")
  }

  function confirmResolve(id: string) {
    setQueries((prev) =>
      prev.map((query) =>
        query.id === id
          ? { ...query, status: "Resolved", resolutionNote: resolutionDraft.trim() || query.resolutionNote }
          : query,
      ),
    )
    setResolvingId(null)
    setResolutionDraft("")
  }

  const openCount = queries.filter((query) => query.status === "Open").length

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Query"
        description="Keep worker questions visible until they are answered and recorded, so nothing raised in the field gets lost."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          <MessageCircleQuestion className="size-5 text-primary" aria-hidden="true" />
          <span className="font-semibold text-foreground">{openCount}</span>
          <span className="text-muted-foreground">open quer{openCount === 1 ? "y" : "ies"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              aria-pressed={statusFilter === filter}
              className={
                statusFilter === filter
                  ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No queries match this filter.</p>
        ) : (
          filtered.map((query) => {
            const account = findAccount(accounts, query.accountId)
            return (
              <div key={query.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{query.subject}</p>
                      <span
                        className={
                          query.status === "Open"
                            ? "rounded-full bg-warning/25 px-2 py-1 text-xs font-medium text-warning-foreground"
                            : "rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
                        }
                      >
                        {query.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{account?.name ?? query.accountId}</span>
                      {account ? <AccountTypeBadge type={account.type} /> : null}
                      <span>· raised {formatDisplayDate(query.date)}</span>
                    </div>
                  </div>
                  {query.status === "Open" ? (
                    <Button type="button" size="sm" onClick={() => startResolving(query.id)}>
                      <Check data-icon="inline-start" aria-hidden="true" />
                      Mark resolved
                    </Button>
                  ) : null}
                </div>

                <p className="text-sm text-muted-foreground">{query.detail}</p>

                {query.status === "Resolved" && query.resolutionNote ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolution</p>
                    <p className="mt-1 text-foreground">{query.resolutionNote}</p>
                  </div>
                ) : null}

                {resolvingId === query.id ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium text-foreground">Resolution note</span>
                      <textarea
                        value={resolutionDraft}
                        onChange={(event) => setResolutionDraft(event.target.value)}
                        rows={2}
                        className="rounded-lg border border-input bg-background px-3 py-2"
                        placeholder="How was this resolved?"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => confirmResolve(query.id)}>
                        Confirm resolved
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setResolvingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
